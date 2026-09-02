import { base64ToUtf8, utf8ToBase64 } from './base64'
import {
  GITHUB_API,
  GITHUB_BRANCH,
  GITHUB_CONTENT_REPO,
  GITHUB_OWNER,
  isConfigured,
} from './config'

/**
 * GitHub content-repo read/write engine.
 *
 * Ported from the SDI Product Development Playbook
 * (App - GitHub Hosted/index.html:2097-2247), which has been running this in
 * production. The commit chain, the retry semantics and the `cache: 'no-store'`
 * placements are all load-bearing — see the comments at each step.
 *
 * ONE DELIBERATE DIFFERENCE from the Playbook: this module exposes the blob
 * `sha` and accepts an `expectedSha`, so a caller can detect that someone else
 * changed a file since it was loaded. The Playbook only detects a conflict
 * inside the seconds-wide window between reading the branch ref and patching
 * it, which means two editors who load in the morning and save in the
 * afternoon both "succeed" and the second silently overwrites the first.
 * See publish.ts for how that is surfaced.
 */

/* ---------- error reporting ------------------------------------------------ */

export interface GhError {
  kind: 'network' | 'http' | 'notoken' | 'unconfigured' | 'conflict'
  status: number
  path: string
}

let lastError: GhError | null = null

export function ghLastError(): GhError | null {
  return lastError
}

export function clearGhError(): void {
  lastError = null
}

/** Plain-English reason, shown verbatim in the publish status line. */
export function ghLastErrorText(): string {
  const e = lastError
  if (!e) return ''
  if (e.kind === 'unconfigured') {
    return 'the content repo is not configured yet (see src/sync/config.ts)'
  }
  if (e.kind === 'notoken') return 'no GitHub token — unlock with your editor password'
  if (e.kind === 'network') return 'no network response (offline, or the request was blocked)'
  if (e.status === 401) return 'your GitHub token is expired or was revoked (401)'
  if (e.status === 403) return 'permission denied or rate-limited (403) — wait a minute, then retry'
  if (e.status === 404) {
    return `this token cannot see ${GITHUB_CONTENT_REPO} (404) — check the token still lists that repo`
  }
  if (e.status === 409 || e.status === 422) {
    return 'another save landed first and the retries were exhausted — reload and try again'
  }
  if (e.status >= 500) return 'GitHub is having problems (5xx) — try again shortly'
  return `GitHub returned ${e.status} on ${e.path}`
}

/* ---------- request plumbing ----------------------------------------------- */

function headers(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
}

function repoUrl(path: string): string {
  return `${GITHUB_API}/repos/${GITHUB_OWNER}/${GITHUB_CONTENT_REPO}${path}`
}

/* ---------- reads ----------------------------------------------------------- */

export type ReadResult<T> =
  | { status: 'ok'; json: T; sha: string }
  | { status: 'not_found' }
  | { status: 'error' }

/**
 * Read a JSON file from the content repo.
 *
 * Two hops, and deliberately the Git Data API rather than the Contents API:
 * Contents only returns inline content reliably below ~1MB, and a program file
 * can exceed that. Step 1 gets the blob sha, step 2 fetches the blob.
 *
 * The three-way result matters: a caller must be able to treat "this file does
 * not exist yet" as a green light without mistaking a network blip for it.
 */
export async function readFile<T>(path: string, token: string): Promise<ReadResult<T>> {
  if (!isConfigured()) {
    lastError = { kind: 'unconfigured', status: 0, path }
    return { status: 'error' }
  }
  if (!token) {
    lastError = { kind: 'notoken', status: 0, path }
    return { status: 'error' }
  }

  try {
    const metaRes = await fetch(
      repoUrl(`/contents/${encodeURI(path)}?ref=${GITHUB_BRANCH}`),
      { headers: headers(token), cache: 'no-store' },
    )
    if (metaRes.status === 404) return { status: 'not_found' }
    if (!metaRes.ok) {
      lastError = { kind: 'http', status: metaRes.status, path }
      return { status: 'error' }
    }
    const meta = (await metaRes.json()) as { sha: string }

    const blobRes = await fetch(repoUrl(`/git/blobs/${meta.sha}`), {
      headers: headers(token),
      cache: 'no-store',
    })
    if (!blobRes.ok) {
      lastError = { kind: 'http', status: blobRes.status, path }
      return { status: 'error' }
    }
    const blob = (await blobRes.json()) as { content: string }
    return { status: 'ok', json: JSON.parse(base64ToUtf8(blob.content)) as T, sha: meta.sha }
  } catch {
    lastError = { kind: 'network', status: 0, path }
    return { status: 'error' }
  }
}

/** Current blob sha without downloading the body — the conflict pre-check. */
export async function readSha(path: string, token: string): Promise<string | null | 'error'> {
  if (!isConfigured() || !token) return 'error'
  try {
    const res = await fetch(repoUrl(`/contents/${encodeURI(path)}?ref=${GITHUB_BRANCH}`), {
      headers: headers(token),
      cache: 'no-store',
    })
    if (res.status === 404) return null // does not exist yet
    if (!res.ok) {
      lastError = { kind: 'http', status: res.status, path }
      return 'error'
    }
    const meta = (await res.json()) as { sha: string }
    return meta.sha
  } catch {
    lastError = { kind: 'network', status: 0, path }
    return 'error'
  }
}

/* ---------- writes ----------------------------------------------------------- */

const MAX_ATTEMPTS = 3 // non-fast-forward retries
const RETRY_DELAY_MS = 500
const NETWORK_RETRY_ATTEMPTS = 3

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

export interface CommitResult {
  ok: boolean
  /** New blob sha on success — the caller stores it as the next baseSha. */
  sha?: string
}

/**
 * Commit one JSON file.
 *
 * Chain per attempt: blob -> ref -> base commit -> tree -> commit -> PATCH ref.
 * `force: false` on the final PATCH is the conflict detector: the commit's
 * parent is the ref read moments earlier, so the patch fails if the branch
 * moved underneath us.
 *
 * Two nested retry loops, with different jobs:
 *  - outer catches *thrown* exceptions (connection dropped mid-upload) and
 *    redoes the whole chain including the blob upload;
 *  - inner retries only a non-fast-forward rejection, rebasing onto the new tip.
 *
 * Only 409/422 counts as a race. 401/403/404/5xx are not races and returning
 * immediately on them avoids three pointless round trips against a dead token.
 */
export async function commitFile(
  path: string,
  json: unknown,
  message: string,
  token: string,
): Promise<CommitResult> {
  if (!isConfigured()) {
    lastError = { kind: 'unconfigured', status: 0, path }
    return { ok: false }
  }
  if (!token) {
    lastError = { kind: 'notoken', status: 0, path }
    return { ok: false }
  }

  const body = JSON.stringify(json, null, 2)

  for (let netAttempt = 0; netAttempt < NETWORK_RETRY_ATTEMPTS; netAttempt++) {
    try {
      // 1. Blob. Built once per network attempt, reused across rebase retries.
      const blobRes = await fetch(repoUrl('/git/blobs'), {
        method: 'POST',
        headers: headers(token),
        body: JSON.stringify({ content: utf8ToBase64(body), encoding: 'base64' }),
      })
      if (!blobRes.ok) {
        lastError = { kind: 'http', status: blobRes.status, path }
        return { ok: false }
      }
      const newBlobSha = ((await blobRes.json()) as { sha: string }).sha

      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        // 2. Branch ref. `cache: 'no-store'` is a real bug fix, not caution:
        // the browser HTTP cache served a stale parent sha, turning every
        // write after the first into a 422 that retrying could never clear.
        const refRes = await fetch(repoUrl(`/git/refs/heads/${GITHUB_BRANCH}`), {
          headers: headers(token),
          cache: 'no-store',
        })
        if (!refRes.ok) {
          lastError = { kind: 'http', status: refRes.status, path }
          return { ok: false }
        }
        const parentCommitSha = ((await refRes.json()) as { object: { sha: string } }).object.sha

        // 3. Base tree.
        const commitRes = await fetch(repoUrl(`/git/commits/${parentCommitSha}`), {
          headers: headers(token),
          cache: 'no-store',
        })
        if (!commitRes.ok) {
          lastError = { kind: 'http', status: commitRes.status, path }
          return { ok: false }
        }
        const baseTreeSha = ((await commitRes.json()) as { tree: { sha: string } }).tree.sha

        // 4. Tree.
        const treeRes = await fetch(repoUrl('/git/trees'), {
          method: 'POST',
          headers: headers(token),
          body: JSON.stringify({
            base_tree: baseTreeSha,
            tree: [{ path, mode: '100644', type: 'blob', sha: newBlobSha }],
          }),
        })
        if (!treeRes.ok) {
          lastError = { kind: 'http', status: treeRes.status, path }
          return { ok: false }
        }
        const newTreeSha = ((await treeRes.json()) as { sha: string }).sha

        // 5. Commit.
        const newCommitRes = await fetch(repoUrl('/git/commits'), {
          method: 'POST',
          headers: headers(token),
          body: JSON.stringify({
            message,
            tree: newTreeSha,
            parents: [parentCommitSha],
          }),
        })
        if (!newCommitRes.ok) {
          lastError = { kind: 'http', status: newCommitRes.status, path }
          return { ok: false }
        }
        const newCommitSha = ((await newCommitRes.json()) as { sha: string }).sha

        // 6. Move the branch. force:false -> 422/409 if someone else moved it.
        const patchRes = await fetch(repoUrl(`/git/refs/heads/${GITHUB_BRANCH}`), {
          method: 'PATCH',
          headers: headers(token),
          body: JSON.stringify({ sha: newCommitSha, force: false }),
        })
        if (patchRes.ok) {
          lastError = null
          return { ok: true, sha: newBlobSha }
        }

        const isRace = patchRes.status === 422 || patchRes.status === 409
        if (!isRace) {
          lastError = { kind: 'http', status: patchRes.status, path }
          return { ok: false }
        }

        // Race. Usually the branch moved for an unrelated path, so rebasing is
        // correct and lossless. Loop to re-read the ref and rebuild on the new tip.
        lastError = { kind: 'conflict', status: patchRes.status, path }
        if (attempt < MAX_ATTEMPTS - 1) await sleep(RETRY_DELAY_MS)
      }
      return { ok: false } // rebase retries exhausted; lastError already set
    } catch {
      lastError = { kind: 'network', status: 0, path }
      if (netAttempt < NETWORK_RETRY_ATTEMPTS - 1) await sleep(RETRY_DELAY_MS)
    }
  }
  return { ok: false }
}
