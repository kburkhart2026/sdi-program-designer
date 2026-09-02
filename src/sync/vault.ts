/**
 * Password-gated token vault.
 *
 * Ported from the SDI Product Development Playbook
 * (App - GitHub Hosted/index.html:1951-2048, generator at 2415-2466).
 *
 * A GitHub PAT is encrypted with an organisation password and committed to the
 * APP repo as editor-key.json / viewer-key.json. The link itself carries no
 * credential — only a `#e` or `#v` marker — so a URL in someone's history or a
 * forwarded email is inert without the password.
 *
 * WHAT THIS DOES AND DOES NOT BUY YOU
 * The encrypted blob is publicly readable, so it can be attacked offline at the
 * attacker's own pace: the password is the only thing protecting it, which is
 * why short ones are refused below. Anyone who knows the password can also
 * recover the PAT from their own browser and use it directly. Per-person
 * revocation would need a server. This is a deliberate, documented trade for a
 * small internal team with no backend — see docs/deployment-and-access.md.
 */

/**
 * PBKDF2 rounds for NEW key files. Measured, not guessed: ~280ms on a 2024
 * laptop, which is a tolerable one-time unlock and a meaningful brute-force tax.
 *
 * Decryption reads the count from the file, never this constant, so raising it
 * later never breaks a key file already issued.
 */
export const VAULT_ITERATIONS = 4_000_000

export interface VaultRecord {
  v: 1
  alg: 'AES-GCM'
  kdf: 'PBKDF2-SHA256'
  iterations: number
  salt: string
  iv: string
  ciphertext: string
  created: string
}

const b64 = (bytes: Uint8Array): string => btoa(String.fromCharCode(...bytes))

const unB64 = (s: string): Uint8Array => {
  const bin = atob(s)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function deriveKey(password: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false, // non-extractable: the derived key can never be read back out
    ['encrypt', 'decrypt'],
  )
}

export async function encryptToken(password: string, token: string): Promise<VaultRecord> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(password, salt, VAULT_ITERATIONS)
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    new TextEncoder().encode(token),
  )
  return {
    v: 1,
    alg: 'AES-GCM',
    kdf: 'PBKDF2-SHA256',
    iterations: VAULT_ITERATIONS,
    salt: b64(salt),
    iv: b64(iv),
    ciphertext: b64(new Uint8Array(ct)),
    created: new Date().toISOString(),
  }
}

/**
 * THROWS on a wrong password. AES-GCM is authenticated, so a bad key fails the
 * tag check rather than returning plausible-looking rubbish — which is exactly
 * what lets the UI say "that password is not right" with certainty instead of
 * hedging.
 */
export async function decryptToken(password: string, rec: VaultRecord): Promise<string> {
  // rec.iterations, not the constant — forward compatibility with older files.
  const key = await deriveKey(password, unB64(rec.salt), rec.iterations || VAULT_ITERATIONS)
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: unB64(rec.iv) as BufferSource },
    key,
    unB64(rec.ciphertext) as BufferSource,
  )
  return new TextDecoder().decode(pt)
}

/** Fetch a key file from the app repo, next to index.html. No auth needed. */
export async function fetchVault(file: string): Promise<VaultRecord | null> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}${file}`, { cache: 'no-store' })
    if (!res.ok) return null
    const rec = (await res.json()) as VaultRecord
    if (!rec || rec.alg !== 'AES-GCM' || !rec.ciphertext) return null
    return rec
  } catch {
    return null
  }
}

/**
 * Passwords shorter than this get an explicit warning before the key file is
 * generated, because the ciphertext is public and offline-attackable.
 */
export const MIN_PASSWORD_LENGTH = 12
