/* Date Deck — a swipe deck for two, with no backend.
 *
 * The ideas arrive as AES-256-GCM ciphertext and are decrypted in the browser with a
 * shared passphrase (see tools/date-deck.js). Swipes live in localStorage under two
 * profiles, so handing the phone over is enough to find matches. When you're on separate
 * phones, "send your swipes" packs your likes into a base64url code the other side imports.
 */

const DECK_URL = new URL('ideas.enc.json', import.meta.url).href;

const PROFILES = [
  { id: 'tobias', name: 'Tobias' },
  { id: 'julia', name: 'Julia' },
];

const KEY = {
  votes: (profile) => `dd:v1:votes:${profile}`,
  done: 'dd:v1:done',
  profile: 'dd:v1:profile',
  pass: 'dd:v1:pass',
};

const SEASONS = [
  { id: 'spring', label: 'Spring' },
  { id: 'summer', label: 'Summer' },
  { id: 'autumn', label: 'Autumn' },
  { id: 'winter', label: 'Winter' },
];

const WHEN = [
  { id: 'any', label: 'Any time' },
  { id: 'weekday', label: 'Weekday evening' },
  { id: 'weekend', label: 'Weekend' },
];

const SWIPE_THRESHOLD = 90;
const VISIBLE_CARDS = 3;

const $ = (id) => document.getElementById(id);

const state = {
  deck: null,          // { categories, ideas }
  byId: new Map(),
  profile: null,
  votes: {},           // profile -> { likes: Set, nopes: Set }
  done: {},            // idea id -> ISO date string or true
  filters: { when: 'any', seasons: new Set(), categories: new Set() },
  filtersOpen: false,
  queue: [],
  view: 'deck',
  pendingImport: null,
  busy: false,
};

/* ---------------------------------------------------------------- storage */

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode / quota — the session still works, it just won't survive a reload */
  }
}

function loadVotes() {
  for (const { id } of PROFILES) {
    const stored = readJSON(KEY.votes(id), { likes: [], nopes: [] });
    state.votes[id] = {
      likes: new Set(stored.likes || []),
      nopes: new Set(stored.nopes || []),
    };
  }
  state.done = readJSON(KEY.done, {});
}

function saveVotes(profile) {
  const v = state.votes[profile];
  writeJSON(KEY.votes(profile), { likes: [...v.likes], nopes: [...v.nopes] });
}

function saveDone() {
  writeJSON(KEY.done, state.done);
}

/* ----------------------------------------------------------------- crypto */

function b64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

async function decryptDeck(envelope, passphrase) {
  const material = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey'],
  );
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: b64ToBytes(envelope.salt), iterations: envelope.iter, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  );
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64ToBytes(envelope.iv) }, key, b64ToBytes(envelope.ct),
  );
  return JSON.parse(new TextDecoder().decode(plaintext));
}

/* ------------------------------------------------------------ share codes */

function bytesToB64url(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlToBytes(text) {
  const clean = text.trim().replace(/-/g, '+').replace(/_/g, '/');
  return b64ToBytes(clean + '='.repeat((4 - (clean.length % 4)) % 4));
}

async function maybeDeflate(bytes) {
  if (typeof CompressionStream === 'undefined') return null;
  try {
    const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
    const out = new Uint8Array(await new Response(stream).arrayBuffer());
    return out.length < bytes.length ? out : null;
  } catch {
    return null;
  }
}

async function inflate(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function bitsetFrom(ids, byteLength) {
  const bits = new Uint8Array(byteLength);
  for (const id of ids) {
    const bit = id - 1;
    if (bit >= 0 && bit < byteLength * 8) bits[bit >> 3] |= 1 << (bit & 7);
  }
  return bits;
}

function idsFrom(bits) {
  const ids = [];
  for (let bit = 0; bit < bits.length * 8; bit += 1) {
    if (bits[bit >> 3] & (1 << (bit & 7))) ids.push(bit + 1);
  }
  return ids;
}

function bitsetLength() {
  const maxId = state.deck.ideas.reduce((m, idea) => Math.max(m, idea.id), 0);
  return Math.ceil(maxId / 8);
}

async function buildShareCode() {
  const width = bitsetLength();
  const votes = state.votes[state.profile];
  const seen = new Set([...votes.likes, ...votes.nopes]);
  const payload = new Uint8Array(2 + width * 3);
  payload[0] = 1;
  payload[1] = PROFILES.findIndex((p) => p.id === state.profile);
  payload.set(bitsetFrom(votes.likes, width), 2);
  payload.set(bitsetFrom(seen, width), 2 + width);
  payload.set(bitsetFrom(Object.keys(state.done).map(Number), width), 2 + width * 2);

  const deflated = await maybeDeflate(payload);
  const body = deflated || payload;
  const frame = new Uint8Array(body.length + 1);
  frame[0] = deflated ? 0x02 : 0x01;
  frame.set(body, 1);
  return bytesToB64url(frame);
}

async function readShareCode(text) {
  const frame = b64urlToBytes(text.replace(/^.*#s=/, ''));
  if (frame.length < 2 || (frame[0] !== 0x01 && frame[0] !== 0x02)) {
    throw new Error("That doesn't look like a Date Deck code.");
  }
  const payload = frame[0] === 0x02 ? await inflate(frame.subarray(1)) : frame.subarray(1);
  if (payload[0] !== 1) throw new Error('That code was made by a newer version of the deck.');

  const profile = PROFILES[payload[1]];
  if (!profile) throw new Error('That code names a person this deck does not know.');

  const width = (payload.length - 2) / 3;
  if (!Number.isInteger(width)) throw new Error('That code is incomplete.');

  return {
    profile: profile.id,
    likes: idsFrom(payload.subarray(2, 2 + width)),
    seen: idsFrom(payload.subarray(2 + width, 2 + width * 2)),
    done: idsFrom(payload.subarray(2 + width * 2)),
  };
}

function applyShareCode(parsed) {
  const votes = state.votes[parsed.profile];
  const likes = new Set(parsed.likes);
  for (const id of likes) {
    votes.likes.add(id);
    votes.nopes.delete(id);
  }
  for (const id of parsed.seen) {
    if (!likes.has(id) && !votes.likes.has(id)) votes.nopes.add(id);
  }
  for (const id of parsed.done) {
    if (!state.done[id]) state.done[id] = true;
  }
  saveVotes(parsed.profile);
  saveDone();
  return { profile: parsed.profile, likes: likes.size };
}

/* ------------------------------------------------------------------ deck */

function matchesFilters(idea) {
  const { when, seasons, categories } = state.filters;
  if (when === 'weekday' && !idea.wd) return false;
  if (when === 'weekend' && !idea.we) return false;
  if (categories.size && !categories.has(idea.c)) return false;
  if (seasons.size) {
    // All-year ideas belong to every season, so they always survive a season filter.
    if (idea.s.length && !idea.s.some((s) => seasons.has(s))) return false;
  }
  return true;
}

function activeFilterCount() {
  const { when, seasons, categories } = state.filters;
  return (when === 'any' ? 0 : 1) + (seasons.size ? 1 : 0) + (categories.size ? 1 : 0);
}

function rebuildQueue() {
  const votes = state.votes[state.profile];
  state.queue = state.deck.ideas.filter(
    (idea) => !votes.likes.has(idea.id) && !votes.nopes.has(idea.id) && matchesFilters(idea),
  );
}

function undecidedCount() {
  const votes = state.votes[state.profile];
  return state.deck.ideas.filter((i) => !votes.likes.has(i.id) && !votes.nopes.has(i.id)).length;
}

function matchIds() {
  const [a, b] = PROFILES.map((p) => state.votes[p.id].likes);
  return state.deck.ideas.filter((i) => a.has(i.id) && b.has(i.id)).map((i) => i.id);
}

/* --------------------------------------------------------------- rendering */

function whenLabel(idea) {
  if (idea.wd && idea.we) return 'Weekday evening or weekend';
  if (idea.wd) return 'Weekday evening';
  if (idea.we) return 'Weekend';
  return '';
}

function seasonLabel(idea) {
  if (!idea.s.length) return 'All year';
  return idea.s.map((s) => SEASONS.find((x) => x.id === s).label).join(' / ');
}

function buildCard(idea, depth) {
  const card = document.createElement('article');
  card.className = 'card';
  if (depth === 1) card.classList.add('card--behind');
  if (depth >= 2) card.classList.add('card--back');
  card.dataset.id = String(idea.id);

  const category = document.createElement('p');
  category.className = 'card__category';
  category.textContent = state.deck.categories[idea.c];

  const title = document.createElement('h2');
  title.className = 'card__title';
  title.textContent = idea.t;

  card.append(category, title);

  // Notes that only restate the season would just repeat the badge below.
  if (idea.n && idea.n.toLowerCase() !== seasonLabel(idea).toLowerCase()) {
    const note = document.createElement('p');
    note.className = 'card__note';
    note.textContent = idea.n;
    card.append(note);
  }

  const badges = document.createElement('div');
  badges.className = 'card__badges';
  for (const text of [whenLabel(idea), seasonLabel(idea)].filter(Boolean)) {
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = text;
    badges.append(badge);
  }
  card.append(badges);

  const index = document.createElement('p');
  index.className = 'card__index';
  index.textContent = `#${idea.id}`;
  card.append(index);

  for (const [cls, text] of [['like', 'LIKE'], ['nope', 'NOPE']]) {
    const stamp = document.createElement('span');
    stamp.className = `stamp stamp--${cls}`;
    stamp.textContent = text;
    card.append(stamp);
  }

  return card;
}

function renderStack() {
  const stack = $('card-stack');
  stack.textContent = '';

  const cards = state.queue.slice(0, VISIBLE_CARDS);
  // Later siblings paint on top, so build back-to-front.
  for (let depth = cards.length - 1; depth >= 0; depth -= 1) {
    stack.append(buildCard(cards[depth], depth));
  }

  const hasCards = cards.length > 0;
  const deckVisible = !state.filtersOpen;
  stack.hidden = !hasCards || !deckVisible;
  $('deck-controls').hidden = !hasCards || !deckVisible;
  $('deck-empty').hidden = hasCards || !deckVisible;

  if (!hasCards) renderEmptyDeck();
  if (hasCards) attachSwipe(stack.lastElementChild);

  const remaining = state.queue.length;
  $('deck-remaining').textContent = remaining ? `${remaining} left` : '';
}

function renderEmptyDeck() {
  const filtered = activeFilterCount() > 0;
  const left = undecidedCount();
  const action = $('deck-empty-action');

  if (filtered && left > 0) {
    $('deck-empty-title').textContent = 'Nothing left in this filter.';
    $('deck-empty-text').textContent = `${left} ideas are still waiting behind other filters.`;
    action.hidden = false;
    action.textContent = 'Clear filters';
  } else {
    $('deck-empty-title').textContent = 'You have been through all 501.';
    $('deck-empty-text').textContent = 'Hand the phone over, or check what you both liked.';
    action.hidden = false;
    action.textContent = 'See matches';
  }
  action.dataset.action = filtered && left > 0 ? 'clear-filters' : 'matches';
}

function renderFilters() {
  const when = $('filter-when');
  when.textContent = '';
  for (const option of WHEN) {
    when.append(chip(option.label, state.filters.when === option.id, () => {
      state.filters.when = option.id;
      onFiltersChanged();
    }));
  }

  const seasons = $('filter-season');
  seasons.textContent = '';
  for (const option of SEASONS) {
    seasons.append(chip(option.label, state.filters.seasons.has(option.id), () => {
      toggleSet(state.filters.seasons, option.id);
      onFiltersChanged();
    }));
  }

  const categories = $('filter-categories');
  categories.textContent = '';
  state.deck.categories.forEach((name, index) => {
    categories.append(chip(name, state.filters.categories.has(index), () => {
      toggleSet(state.filters.categories, index);
      onFiltersChanged();
    }));
  });

  const count = activeFilterCount();
  const badge = $('filter-badge');
  badge.hidden = count === 0;
  badge.textContent = String(count);
}

function chip(label, active, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = active ? 'chip is-on' : 'chip';
  button.textContent = label;
  button.setAttribute('aria-pressed', String(active));
  button.addEventListener('click', onClick);
  return button;
}

function toggleSet(set, value) {
  if (set.has(value)) set.delete(value);
  else set.add(value);
}

function onFiltersChanged() {
  renderFilters();
  rebuildQueue();
  renderStack();
}

function renderMatches() {
  const ids = matchIds();
  const list = $('match-list');
  list.textContent = '';

  $('match-count').textContent = String(ids.length);
  $('matches-empty').hidden = ids.length > 0;
  $('btn-tonight').hidden = ids.length === 0;

  const inFilter = ids.filter((id) => matchesFilters(state.byId.get(id)));
  const doneCount = ids.filter((id) => state.done[id]).length;
  const parts = [`${ids.length} ${ids.length === 1 ? 'match' : 'matches'}`];
  if (doneCount) parts.push(`${doneCount} done`);
  if (activeFilterCount() && inFilter.length !== ids.length) {
    parts.push(`${inFilter.length} in the current filters`);
  }
  $('matches-summary').textContent = ids.length ? parts.join(' · ') : '';

  // Not-yet-done first, so the list stays useful as it fills up.
  const ordered = [...ids].sort((a, b) => Number(Boolean(state.done[a])) - Number(Boolean(state.done[b])));

  for (const id of ordered) {
    const idea = state.byId.get(id);
    const item = document.createElement('li');
    item.className = state.done[id] ? 'match is-done' : 'match';

    const check = document.createElement('button');
    check.type = 'button';
    check.className = 'match__check';
    check.textContent = '✓';
    check.setAttribute('aria-pressed', String(Boolean(state.done[id])));
    check.setAttribute('aria-label', state.done[id] ? `Mark ${idea.t} as not done` : `Mark ${idea.t} as done`);
    check.addEventListener('click', () => toggleDone(id));

    const body = document.createElement('div');
    body.className = 'match__body';

    const title = document.createElement('div');
    title.className = 'match__title';
    title.textContent = idea.t;

    const meta = document.createElement('div');
    meta.className = 'match__meta';
    meta.textContent = metaLine(idea, state.done[id]);

    body.append(title, meta);
    item.append(check, body);
    list.append(item);
  }
}

function metaLine(idea, done) {
  const bits = [state.deck.categories[idea.c]];
  if (idea.n) bits.push(idea.n);
  if (typeof done === 'string') bits.push(`done ${formatDate(done)}`);
  else if (done) bits.push('done');
  return bits.join(' · ');
}

function formatDate(iso) {
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.valueOf())) return iso;
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function toggleDone(id) {
  if (state.done[id]) delete state.done[id];
  else state.done[id] = new Date().toISOString().slice(0, 10);
  saveDone();
  renderMatches();
}

function pickTonight() {
  const candidates = matchIds().filter(
    (id) => !state.done[id] && matchesFilters(state.byId.get(id)),
  );
  const box = $('tonight');
  if (!candidates.length) {
    box.hidden = false;
    box.textContent = '';
    const label = document.createElement('p');
    label.className = 'tonight__label';
    label.textContent = 'Nothing left';
    const title = document.createElement('p');
    title.className = 'tonight__title';
    title.textContent = 'You have done every match.';
    box.append(label, title);
    return;
  }

  const idea = state.byId.get(candidates[Math.floor(Math.random() * candidates.length)]);
  box.hidden = false;
  box.textContent = '';

  const label = document.createElement('p');
  label.className = 'tonight__label';
  label.textContent = 'Tonight';

  const title = document.createElement('p');
  title.className = 'tonight__title';
  title.textContent = idea.t;

  const meta = document.createElement('p');
  meta.className = 'tonight__meta';
  meta.textContent = metaLine(idea);

  box.append(label, title, meta);
}

function renderProfile() {
  const profile = PROFILES.find((p) => p.id === state.profile);
  $('profile-initial').textContent = profile.name[0];
  $('profile-name').textContent = profile.name;

  const votes = state.votes[state.profile];
  const other = PROFILES.find((p) => p.id !== state.profile);
  $('sync-status').textContent =
    `${profile.name}: ${votes.likes.size} liked, ${votes.nopes.size} passed. ` +
    `${other.name}: ${state.votes[other.id].likes.size} liked.`;
}

/* --------------------------------------------------------------- swiping */

function attachSwipe(card) {
  let startX = 0;
  let startY = 0;
  let dx = 0;
  let dy = 0;
  let dragging = false;

  const like = card.querySelector('.stamp--like');
  const nope = card.querySelector('.stamp--nope');

  const onDown = (event) => {
    if (state.busy) return;
    dragging = true;
    startX = event.clientX;
    startY = event.clientY;
    card.setPointerCapture(event.pointerId);
    card.classList.remove('card--settling');
  };

  const onMove = (event) => {
    if (!dragging) return;
    dx = event.clientX - startX;
    dy = event.clientY - startY;
    card.style.transform = `translate(${dx}px, ${dy}px) rotate(${dx / 18}deg)`;
    const strength = Math.min(Math.abs(dx) / SWIPE_THRESHOLD, 1);
    like.style.opacity = dx > 0 ? strength : 0;
    nope.style.opacity = dx < 0 ? strength : 0;
  };

  const onUp = () => {
    if (!dragging) return;
    dragging = false;
    if (Math.abs(dx) > SWIPE_THRESHOLD) {
      commitSwipe(dx > 0 ? 'like' : 'nope', card, dy);
    } else {
      card.classList.add('card--settling');
      card.style.transform = '';
      like.style.opacity = 0;
      nope.style.opacity = 0;
    }
    dx = 0;
    dy = 0;
  };

  card.addEventListener('pointerdown', onDown);
  card.addEventListener('pointermove', onMove);
  card.addEventListener('pointerup', onUp);
  card.addEventListener('pointercancel', onUp);
}

function commitSwipe(verdict, card, dy = 0) {
  if (state.busy || !state.queue.length) return;
  state.busy = true;

  const idea = state.queue[0];
  const votes = state.votes[state.profile];
  votes[verdict === 'like' ? 'likes' : 'nopes'].add(idea.id);
  saveVotes(state.profile);

  const direction = verdict === 'like' ? 1 : -1;
  card.classList.add('card--animating');
  card.style.transform = `translate(${direction * window.innerWidth}px, ${dy}px) rotate(${direction * 24}deg)`;
  card.style.opacity = '0';
  card.querySelector(`.stamp--${verdict}`).style.opacity = '1';

  window.setTimeout(() => {
    state.busy = false;
    rebuildQueue();
    renderStack();
    renderMatches();
    renderProfile();
  }, 300);
}

function swipeTop(verdict) {
  const card = $('card-stack').lastElementChild;
  if (card) commitSwipe(verdict, card);
}

/* ----------------------------------------------------------------- views */

function showView(view) {
  state.view = view;
  for (const name of ['deck', 'matches', 'settings']) {
    $(`view-${name}`).hidden = name !== view;
  }
  for (const tab of document.querySelectorAll('.tab')) {
    tab.classList.toggle('is-active', tab.dataset.view === view);
  }
  if (view === 'matches') renderMatches();
  if (view === 'settings') refreshShareCode();
}

function showScreen(name) {
  for (const screen of ['lock', 'profile', 'main']) {
    $(`screen-${screen}`).hidden = screen !== name;
  }
}

let toastTimer = null;
function toast(message) {
  const el = $('toast');
  el.textContent = message;
  el.hidden = false;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => { el.hidden = true; }, 2200);
}

async function copy(text, label) {
  try {
    await navigator.clipboard.writeText(text);
    toast(`${label} copied`);
  } catch {
    const area = $('share-code');
    area.focus();
    area.select();
    toast('Press copy on your keyboard');
  }
}

let shareToken = 0;

// Building the code is async (it compresses), so blank the box and hold the copy
// buttons until it lands — otherwise you can copy a stale code from last time.
async function refreshShareCode() {
  const token = ++shareToken;
  const area = $('share-code');
  area.value = '';
  area.placeholder = 'Generating…';
  $('btn-copy-code').disabled = true;
  $('btn-copy-link').disabled = true;

  const code = await buildShareCode();
  if (token !== shareToken) return;

  area.value = code;
  $('btn-copy-code').disabled = false;
  $('btn-copy-link').disabled = false;
  renderProfile();
}

/* ------------------------------------------------------------------ boot */

function startApp() {
  state.byId = new Map(state.deck.ideas.map((idea) => [idea.id, idea]));
  loadVotes();

  const stored = localStorage.getItem(KEY.profile);
  if (PROFILES.some((p) => p.id === stored)) {
    state.profile = stored;
    enterMain();
  } else {
    showScreen('profile');
  }
}

function enterMain() {
  showScreen('main');
  renderProfile();
  renderFilters();
  rebuildQueue();
  renderStack();
  renderMatches();
  showView(state.view);

  if (state.pendingImport) {
    const code = state.pendingImport;
    state.pendingImport = null;
    importCode(code, true);
  }
}

function chooseProfile(id) {
  state.profile = id;
  localStorage.setItem(KEY.profile, id);
  enterMain();
}

async function importCode(text, fromLink = false) {
  const status = $('import-status');
  try {
    const parsed = await readShareCode(text);
    const result = applyShareCode(parsed);
    const name = PROFILES.find((p) => p.id === result.profile).name;
    status.classList.remove('is-error');
    status.textContent = `Imported ${result.likes} likes from ${name}.`;
    $('import-code').value = '';
    rebuildQueue();
    renderStack();
    renderMatches();
    renderProfile();
    if (fromLink) {
      showView('matches');
      toast(`${name}'s swipes imported`);
    }
  } catch (error) {
    status.classList.add('is-error');
    status.textContent = error.message;
    if (fromLink) {
      showView('settings');
      toast('That link could not be read');
    }
  }
}

async function unlock(event) {
  event.preventDefault();
  const input = $('lock-input');
  const submit = $('lock-submit');
  const error = $('lock-error');

  error.hidden = true;
  submit.disabled = true;
  submit.textContent = 'Unlocking…';
  // Let the button repaint before PBKDF2 blocks the thread on slower phones.
  await new Promise((resolve) => window.setTimeout(resolve, 20));

  try {
    const envelope = await (await fetch(DECK_URL, { cache: 'no-cache' })).json();
    state.deck = await decryptDeck(envelope, input.value);
    const store = $('lock-remember').checked ? localStorage : sessionStorage;
    store.setItem(KEY.pass, input.value);
    input.value = '';
    startApp();
  } catch {
    error.textContent = 'That passphrase does not open the deck.';
    error.hidden = false;
    input.select();
  } finally {
    submit.disabled = false;
    submit.textContent = 'Unlock';
  }
}

async function tryStoredPassphrase() {
  const saved = localStorage.getItem(KEY.pass) || sessionStorage.getItem(KEY.pass);
  if (!saved) return false;
  try {
    const envelope = await (await fetch(DECK_URL, { cache: 'no-cache' })).json();
    state.deck = await decryptDeck(envelope, saved);
    startApp();
    return true;
  } catch {
    // Stale passphrase (rekeyed since) — fall back to the lock screen.
    localStorage.removeItem(KEY.pass);
    sessionStorage.removeItem(KEY.pass);
    return false;
  }
}

function resetEverything() {
  if (!window.confirm('Erase both people’s swipes and the saved passphrase on this device?')) return;
  for (const { id } of PROFILES) localStorage.removeItem(KEY.votes(id));
  localStorage.removeItem(KEY.done);
  localStorage.removeItem(KEY.profile);
  localStorage.removeItem(KEY.pass);
  sessionStorage.removeItem(KEY.pass);
  window.location.hash = '';
  window.location.reload();
}

function wireEvents() {
  $('lock-form').addEventListener('submit', unlock);

  for (const button of document.querySelectorAll('.profile-btn')) {
    button.addEventListener('click', () => chooseProfile(button.dataset.profile));
  }

  const switchProfile = () => {
    localStorage.removeItem(KEY.profile);
    state.view = 'deck';
    showScreen('profile');
  };
  $('profile-switch').addEventListener('click', switchProfile);
  $('btn-switch-profile').addEventListener('click', switchProfile);

  for (const tab of document.querySelectorAll('.tab')) {
    tab.addEventListener('click', () => showView(tab.dataset.view));
  }

  $('filter-toggle').addEventListener('click', () => setFiltersOpen(!state.filtersOpen));
  $('filter-done').addEventListener('click', () => setFiltersOpen(false));
  $('filter-clear').addEventListener('click', clearFilters);

  $('deck-empty-action').addEventListener('click', (event) => {
    if (event.currentTarget.dataset.action === 'clear-filters') clearFilters();
    else showView('matches');
  });

  $('btn-like').addEventListener('click', () => swipeTop('like'));
  $('btn-nope').addEventListener('click', () => swipeTop('nope'));

  document.addEventListener('keydown', (event) => {
    if ($('screen-main').hidden || state.view !== 'deck') return;
    if (event.target.matches('input, textarea')) return;
    if (event.key === 'ArrowRight') swipeTop('like');
    if (event.key === 'ArrowLeft') swipeTop('nope');
  });

  $('btn-tonight').addEventListener('click', pickTonight);

  $('btn-copy-code').addEventListener('click', () => copy($('share-code').value, 'Code'));
  $('btn-copy-link').addEventListener('click', () => {
    const url = `${window.location.origin}${window.location.pathname}#s=${$('share-code').value}`;
    copy(url, 'Link');
  });
  $('btn-import').addEventListener('click', () => importCode($('import-code').value));
  $('btn-reset').addEventListener('click', resetEverything);
}

function setFiltersOpen(open) {
  state.filtersOpen = open;
  $('filter-panel').hidden = !open;
  $('filter-toggle').setAttribute('aria-expanded', String(open));
  renderStack();
}

function clearFilters() {
  state.filters = { when: 'any', seasons: new Set(), categories: new Set() };
  onFiltersChanged();
}

async function boot() {
  wireEvents();

  const hash = window.location.hash;
  if (hash.startsWith('#s=')) {
    state.pendingImport = hash.slice(3);
    history.replaceState(null, '', window.location.pathname);
  }

  if (!(await tryStoredPassphrase())) {
    showScreen('lock');
    $('lock-input').focus();
  }
}

boot();
