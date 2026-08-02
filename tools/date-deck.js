#!/usr/bin/env node
'use strict';

// Encrypts the date-idea deck for /julia/.
//
// The repository is public, so the deck never gets committed in the clear. It is
// stored as AES-256-GCM ciphertext with a PBKDF2-SHA256 key, in an envelope the
// browser can open with plain WebCrypto (see assets/date-deck/app.js).
//
//   node tools/date-deck.js encrypt ideas.json assets/date-deck/ideas.enc.json
//   node tools/date-deck.js decrypt assets/date-deck/ideas.enc.json ideas.json
//   node tools/date-deck.js rekey   assets/date-deck/ideas.enc.json
//
// The passphrase is read from $DECK_PASSPHRASE, or prompted for without echo.

const crypto = require('crypto');
const fs = require('fs');
const readline = require('readline');

const ITERATIONS = 600000;
const DIGEST = 'sha256';
const KEY_BYTES = 32;
const SALT_BYTES = 16;
const IV_BYTES = 12;

function deriveKey(passphrase, salt) {
  return crypto.pbkdf2Sync(passphrase, salt, ITERATIONS, KEY_BYTES, DIGEST);
}

function encrypt(plaintext, passphrase) {
  const salt = crypto.randomBytes(SALT_BYTES);
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv('aes-256-gcm', deriveKey(passphrase, salt), iv);
  const body = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  // WebCrypto expects the GCM tag appended to the ciphertext.
  const ct = Buffer.concat([body, cipher.getAuthTag()]);
  return {
    v: 1,
    kdf: 'PBKDF2-SHA256',
    iter: ITERATIONS,
    salt: salt.toString('base64'),
    cipher: 'AES-256-GCM',
    iv: iv.toString('base64'),
    ct: ct.toString('base64'),
  };
}

function decrypt(envelope, passphrase) {
  if (envelope.v !== 1 || envelope.kdf !== 'PBKDF2-SHA256' || envelope.cipher !== 'AES-256-GCM') {
    throw new Error('unsupported envelope format');
  }
  const salt = Buffer.from(envelope.salt, 'base64');
  const iv = Buffer.from(envelope.iv, 'base64');
  const ct = Buffer.from(envelope.ct, 'base64');
  const body = ct.subarray(0, ct.length - 16);
  const tag = ct.subarray(ct.length - 16);
  const key = crypto.pbkdf2Sync(passphrase, salt, envelope.iter, KEY_BYTES, DIGEST);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  try {
    return Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8');
  } catch {
    throw new Error('wrong passphrase (authentication failed)');
  }
}

function askPassphrase(label) {
  if (process.env.DECK_PASSPHRASE) return Promise.resolve(process.env.DECK_PASSPHRASE);
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const onData = (char) => {
      // Redraw the prompt without the typed characters.
      if (!['\n', '\r', ''].includes(String(char))) {
        readline.clearLine(process.stdout, 0);
        readline.cursorTo(process.stdout, 0);
        process.stdout.write(label);
      }
    };
    process.stdin.on('data', onData);
    rl.question(label, (answer) => {
      process.stdin.removeListener('data', onData);
      process.stdout.write('\n');
      rl.close();
      resolve(answer);
    });
  });
}

async function main() {
  const [command, ...args] = process.argv.slice(2);

  if (command === 'encrypt') {
    const [input, output] = args;
    if (!input || !output) throw new Error('usage: date-deck.js encrypt <plaintext.json> <out.enc.json>');
    const plaintext = fs.readFileSync(input, 'utf8');
    JSON.parse(plaintext); // fail early on malformed input
    const passphrase = await askPassphrase('Passphrase: ');
    fs.writeFileSync(output, JSON.stringify(encrypt(plaintext, passphrase)) + '\n');
    console.log(`encrypted ${plaintext.length} bytes -> ${output}`);
    return;
  }

  if (command === 'decrypt') {
    const [input, output] = args;
    if (!input) throw new Error('usage: date-deck.js decrypt <enc.json> [out.json]');
    const envelope = JSON.parse(fs.readFileSync(input, 'utf8'));
    const passphrase = await askPassphrase('Passphrase: ');
    const plaintext = decrypt(envelope, passphrase);
    if (output) {
      fs.writeFileSync(output, plaintext);
      console.log(`decrypted -> ${output}`);
    } else {
      process.stdout.write(plaintext);
    }
    return;
  }

  if (command === 'rekey') {
    const [file] = args;
    if (!file) throw new Error('usage: date-deck.js rekey <enc.json>');
    const envelope = JSON.parse(fs.readFileSync(file, 'utf8'));
    const oldPass = await askPassphrase('Current passphrase: ');
    const plaintext = decrypt(envelope, oldPass);
    delete process.env.DECK_PASSPHRASE; // never reuse the old one for the prompt below
    const newPass = await askPassphrase('New passphrase: ');
    const confirm = await askPassphrase('Repeat new passphrase: ');
    if (newPass !== confirm) throw new Error('passphrases do not match');
    fs.writeFileSync(file, JSON.stringify(encrypt(plaintext, newPass)) + '\n');
    console.log(`rekeyed ${file}`);
    return;
  }

  console.error('usage: date-deck.js <encrypt|decrypt|rekey> ...');
  process.exitCode = 1;
}

main().catch((err) => {
  console.error(`error: ${err.message}`);
  process.exitCode = 1;
});
