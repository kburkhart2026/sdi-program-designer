#!/usr/bin/env node
/**
 * Generate an encrypted key file for the Program Designer.
 *
 *   node scripts/make-key.mjs editor
 *   node scripts/make-key.mjs viewer
 *
 * Prompts for the GitHub PAT and a password, encrypts the PAT with the
 * password, and writes public/editor-key.json or public/viewer-key.json.
 * Commit that file — the ciphertext is safe to publish; the password is not.
 *
 * Parameters MUST stay in step with src/sync/vault.ts. The iteration count is
 * written into the file and read back from it, so raising ITERATIONS here
 * never breaks a key file already issued.
 */

import { webcrypto as crypto } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { createInterface } from 'node:readline/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { stdin, stdout } from 'node:process'

const ITERATIONS = 4_000_000
const MIN_PASSWORD_LENGTH = 12

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const role = process.argv[2]
if (role !== 'editor' && role !== 'viewer') {
  console.error('Usage: node scripts/make-key.mjs <editor|viewer>')
  process.exit(1)
}

/**
 * Prompting works two ways:
 *  - interactive TTY: one question at a time;
 *  - piped stdin: every line is read up front and consumed in order, so the
 *    script can be driven from a rotation runbook or a test.
 * readline/promises alone cannot do the second — the stream ends and pending
 * questions never resolve.
 */
const interactive = stdin.isTTY
const piped = interactive ? [] : (await readAll()).split('\n')
let pipeAt = 0
const rl = interactive ? createInterface({ input: stdin, output: stdout }) : null

async function readAll() {
  const chunks = []
  for await (const chunk of stdin) chunks.push(chunk)
  return Buffer.concat(chunks).toString('utf8')
}

async function ask(prompt) {
  if (rl) return rl.question(prompt)
  const line = piped[pipeAt++] ?? ''
  stdout.write(prompt + (line ? '·'.repeat(Math.min(line.length, 24)) : '') + '\n')
  return line
}

const scope =
  role === 'editor'
    ? 'Contents: Read and write'
    : 'Contents: Read-only'

console.log(`\nGenerating ${role}-key.json`)
console.log(`The token you paste must be a fine-grained PAT scoped to ONLY the`)
console.log(`content repo, with ${scope}.\n`)

const token = (await ask('GitHub personal access token: ')).trim()
if (!token) {
  console.error('No token given — nothing written.')
  process.exit(1)
}

const password = (await ask(`Password for ${role}s: `)).trim()
if (!password) {
  console.error('No password given — nothing written.')
  process.exit(1)
}

if (password.length < MIN_PASSWORD_LENGTH) {
  console.log(
    `\n  WARNING: that password is ${password.length} characters.\n` +
      `  The encrypted file is PUBLIC, so it can be attacked offline at the\n` +
      `  attacker's own pace. Use ${MIN_PASSWORD_LENGTH}+ characters — a passphrase of a few\n` +
      `  unrelated words is easiest to share and hardest to crack.\n`,
  )
  const go = (await ask('Use it anyway? (y/N): ')).trim().toLowerCase()
  if (go !== 'y') {
    console.error('Aborted — nothing written.')
    process.exit(1)
  }
}

const confirm = (await ask('Confirm the password: ')).trim()
rl?.close()

if (confirm !== password) {
  console.error('\nThe two passwords do not match — nothing written.')
  process.exit(1)
}

const b64 = (bytes) => Buffer.from(bytes).toString('base64')

const salt = crypto.getRandomValues(new Uint8Array(16))
const iv = crypto.getRandomValues(new Uint8Array(12))

const base = await crypto.subtle.importKey(
  'raw',
  new TextEncoder().encode(password),
  'PBKDF2',
  false,
  ['deriveKey'],
)
const key = await crypto.subtle.deriveKey(
  { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
  base,
  { name: 'AES-GCM', length: 256 },
  false,
  ['encrypt', 'decrypt'],
)
const ciphertext = await crypto.subtle.encrypt(
  { name: 'AES-GCM', iv },
  key,
  new TextEncoder().encode(token),
)

const record = {
  v: 1,
  alg: 'AES-GCM',
  kdf: 'PBKDF2-SHA256',
  iterations: ITERATIONS,
  salt: b64(salt),
  iv: b64(iv),
  ciphertext: b64(new Uint8Array(ciphertext)),
  created: new Date().toISOString(),
}

const out = resolve(ROOT, 'public', `${role}-key.json`)
writeFileSync(out, JSON.stringify(record, null, 2) + '\n')

console.log(`\nWrote ${out}`)
console.log(`Commit it, then share the link and the password separately:`)
console.log(`  https://<user>.github.io/<repo>/#${role === 'editor' ? 'e' : 'v'}\n`)
console.log(`The link carries no credential. Anyone without the password gets nothing.\n`)
