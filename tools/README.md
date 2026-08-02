# Date deck tooling

`date-deck.js` maintains the encrypted deck behind `/julia/`
(`assets/date-deck/ideas.enc.json`).

This repository is public, so the ideas are never committed in the clear. They live as
AES-256-GCM ciphertext with a PBKDF2-SHA256 key (600,000 iterations), in an envelope the
browser opens with plain WebCrypto — there is no server and no build step.

Node 18+ is all you need; the script has no dependencies.

## Add or edit ideas

```sh
node tools/date-deck.js decrypt assets/date-deck/ideas.enc.json ideas.json
# edit ideas.json
node tools/date-deck.js encrypt ideas.json assets/date-deck/ideas.enc.json
git commit -am "Update date deck"
```

`ideas.json` is gitignored, so an accidental `git add .` cannot leak it. Delete it when
you're done — `decrypt` always brings it back.

Each idea looks like this:

```json
{ "id": 5, "t": "Ice skating on a frozen lake", "c": 0, "wd": false, "we": true,
  "n": "winter, only when officially cleared", "s": ["winter"] }
```

| Field | Meaning |
| --- | --- |
| `id` | Stable identifier. **Never reuse or renumber these** — share codes are keyed on them. New ideas get the next free number. |
| `t` | The idea itself |
| `c` | Index into the top-level `categories` array |
| `wd` / `we` | Doable on a weekday evening / on a weekend |
| `n` | Free-text note shown on the card |
| `s` | Seasons for the season filter: any of `spring`, `summer`, `autumn`, `winter`. Empty means all year. |

## Change the passphrase

```sh
node tools/date-deck.js rekey assets/date-deck/ideas.enc.json
```

Decrypts with the current passphrase, re-encrypts with a new one, in place. Swipes already
stored on a phone survive it — they're keyed on idea `id`, not on the passphrase. Everyone
just has to unlock again.

Prefer a passphrase of several words. Because the ciphertext is public, a single dictionary
word can be brute-forced offline with no rate limiting; the 600k PBKDF2 iterations slow that
down but do not fix it.

`$DECK_PASSPHRASE` is read if set, which is handy for scripting but puts the passphrase in
your shell history — leave it unset to get a prompt instead.
