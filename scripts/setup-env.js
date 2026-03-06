#!/usr/bin/env node
/**
 * Copies server/.env.example to server/.env (if the file does not already
 * exist) and replaces placeholder secrets with randomly-generated values so
 * developers can start the app immediately after cloning without any manual
 * configuration.
 *
 * Run automatically as the `predev` npm script.
 */

const { existsSync, readFileSync, writeFileSync } = require('fs');
const { randomBytes } = require('crypto');
const path = require('path');

const root = path.resolve(__dirname, '..');
const dest = path.join(root, 'server', '.env');
const src  = path.join(root, 'server', '.env.example');

if (existsSync(dest)) {
  // .env already present — nothing to do.
  process.exit(0);
}

if (!existsSync(src)) {
  console.warn('setup-env: server/.env.example not found — skipping .env creation.');
  process.exit(0);
}

let content = readFileSync(src, 'utf8');

// Replace well-known placeholder values with secure random secrets.
content = content
  .replace('replace-with-a-strong-random-secret',         randomBytes(32).toString('hex'))
  .replace('replace-with-a-strong-random-session-secret', randomBytes(32).toString('hex'));

writeFileSync(dest, content, 'utf8');
console.log('✔  Created server/.env with generated secrets (from server/.env.example).');
console.log('   Edit server/.env to configure Google OAuth or other optional variables.');
