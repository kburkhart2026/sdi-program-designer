/**
 * UTF-8 safe base64. Ported from the SDI Product Development Playbook
 * (App - GitHub Hosted/index.html:1924-1935).
 *
 * Plain btoa/atob operate on latin1 and corrupt any non-ASCII character —
 * curly quotes and em dashes in a course description are enough to break a
 * commit. GitHub also wraps blob content at 60 chars, hence the newline strip.
 */

export function utf8ToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str)
  let bin = ''
  // Chunked: String.fromCharCode(...bytes) blows the call stack past ~100KB.
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(bin)
}

export function base64ToUtf8(b64: string): string {
  const bin = atob(b64.replace(/\n/g, ''))
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}
