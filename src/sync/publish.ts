import type { Program, ProgramSummary } from '../types/program'
import { migrateProgram } from '../data/migrate'
import { totalPlaced } from '../data/derive'
import { commitFile, readFile, readSha } from './github'
import { MANIFEST_PATH, programPath } from './config'

/**
 * Publish orchestration.
 *
 * Content repo layout — sharded per program:
 *
 *     manifest.json        { v, ts, programs: ProgramSummary[] }
 *     programs/<id>.json   { v, ts, program: Program }
 *
 * Sharding is what makes several editors workable: two designers on different
 * programs never write the same file, so they never contend at all.
 *
 * CONFLICT POLICY. Before writing anything we re-read each target's blob sha
 * and compare it to the sha we loaded. If it moved, someone else published in
 * the meantime and we STOP — no partial write, no silent overwrite. The caller
 * shows the user a choice. This is the piece the Playbook lacks, and it is the
 * difference between "last writer wins, quietly" and "you are told".
 */

export interface ManifestFile {
  v: 1
  ts: number
  programs: ProgramSummary[]
}

export interface ProgramFile {
  v: 1
  ts: number
  program: Program
}

export function summarise(p: Program): ProgramSummary {
  return {
    id: p.id,
    name: p.name,
    type: p.type,
    credits: p.credits,
    creds: p.creds,
    saved: p.saved,
    courseCount: p.courses.length,
    lessonCount: totalPlaced(p),
  }
}

/* ---------- pull ------------------------------------------------------------ */

export interface PullResult {
  status: 'ok' | 'empty' | 'error'
  programs: Program[]
  /** program id -> blob sha at load time. `MANIFEST_PATH` keys the manifest. */
  baseShas: Record<string, string>
}

/**
 * Load everything from the content repo.
 *
 * A missing manifest is `empty`, not an error — that is a content repo nobody
 * has published to yet, which is the normal first-run state.
 */
export async function pullAll(token: string): Promise<PullResult> {
  const manifest = await readFile<ManifestFile>(MANIFEST_PATH, token)
  if (manifest.status === 'not_found') {
    return { status: 'empty', programs: [], baseShas: {} }
  }
  if (manifest.status === 'error') {
    return { status: 'error', programs: [], baseShas: {} }
  }

  const baseShas: Record<string, string> = { [MANIFEST_PATH]: manifest.sha }
  const programs: Program[] = []

  for (const summary of manifest.json.programs ?? []) {
    const file = await readFile<ProgramFile>(programPath(summary.id), token)
    if (file.status === 'ok') {
      programs.push(migrateProgram(file.json.program))
      baseShas[summary.id] = file.sha
    } else if (file.status === 'error') {
      // One unreadable shard must not silently shrink the program list —
      // better to fail the whole pull than to present a partial library as complete.
      return { status: 'error', programs: [], baseShas: {} }
    }
    // 'not_found' -> listed in the manifest but the file is gone. Skip it; the
    // next publish rewrites the manifest without it.
  }

  programs.sort((a, b) => b.saved - a.saved)
  return { status: 'ok', programs, baseShas }
}

/** Re-read one program — the "reload theirs" branch of a conflict. */
export async function pullProgram(
  id: string,
  token: string,
): Promise<{ program: Program; sha: string } | null> {
  const file = await readFile<ProgramFile>(programPath(id), token)
  if (file.status !== 'ok') return null
  return { program: migrateProgram(file.json.program), sha: file.sha }
}

/* ---------- publish ---------------------------------------------------------- */

export interface Conflict {
  programId: string
  programName: string
}

export type PublishResult =
  | { status: 'ok'; baseShas: Record<string, string>; published: string[] }
  | { status: 'conflict'; conflicts: Conflict[] }
  | { status: 'error'; published: string[]; baseShas: Record<string, string> }
  | { status: 'nothing' }

export interface PublishInput {
  programs: Program[]
  /** Program ids with local changes. */
  dirty: string[]
  baseShas: Record<string, string>
  token: string
  /** Skip the conflict pre-check and overwrite. Only from an explicit choice. */
  force?: boolean
}

export async function publish(input: PublishInput): Promise<PublishResult> {
  const { programs, dirty, baseShas, token, force = false } = input
  const byId = new Map(programs.map((p) => [p.id, p]))
  const targets = dirty.filter((id) => byId.has(id))

  if (targets.length === 0) return { status: 'nothing' }

  // --- 1. Conflict pre-check, before a single byte is written ---------------
  if (!force) {
    const conflicts: Conflict[] = []
    for (const id of targets) {
      const remote = await readSha(programPath(id), token)
      if (remote === 'error') {
        return { status: 'error', published: [], baseShas }
      }
      const base = baseShas[id]
      // remote === null: the file does not exist yet. Only a conflict if we
      // thought we had loaded one — i.e. someone deleted it out from under us.
      //
      // remote is a sha but we hold no base: a published file exists that this
      // browser never read, so we cannot know whose copy is newer. Treat it as
      // a conflict too. Publishing anyway is exactly the silent overwrite this
      // whole check exists to prevent.
      const moved = remote === null ? Boolean(base) : base === undefined || remote !== base
      if (moved) {
        conflicts.push({ programId: id, programName: byId.get(id)?.name ?? id })
      }
    }
    if (conflicts.length > 0) return { status: 'conflict', conflicts }
  }

  // --- 2. Program files first, manifest last --------------------------------
  // Ordering matters: an interrupted publish must never leave the manifest
  // pointing at content that was never written. Manifest-last means the worst
  // case is an orphan program file, which is invisible and harmless.
  const nextShas: Record<string, string> = { ...baseShas }
  const published: string[] = []

  for (const id of targets) {
    const program = byId.get(id)!
    const file: ProgramFile = { v: 1, ts: Date.now(), program }
    const res = await commitFile(
      programPath(id),
      file,
      `Update ${program.name || 'untitled program'}`,
      token,
    )
    if (!res.ok) {
      // Stop here. The ids already written are reported so the caller can clear
      // them from the dirty set; the rest stay dirty and retry next time.
      return { status: 'error', published, baseShas: nextShas }
    }
    if (res.sha) nextShas[id] = res.sha
    published.push(id)
  }

  const manifest: ManifestFile = {
    v: 1,
    ts: Date.now(),
    programs: programs.map(summarise).sort((a, b) => b.saved - a.saved),
  }
  const manRes = await commitFile(MANIFEST_PATH, manifest, 'Update manifest', token)
  if (!manRes.ok) {
    return { status: 'error', published, baseShas: nextShas }
  }
  if (manRes.sha) nextShas[MANIFEST_PATH] = manRes.sha

  return { status: 'ok', baseShas: nextShas, published }
}

/** Remove a program from the content repo by rewriting the manifest without it. */
export async function publishDeletion(
  programs: Program[],
  token: string,
): Promise<boolean> {
  const manifest: ManifestFile = {
    v: 1,
    ts: Date.now(),
    programs: programs.map(summarise).sort((a, b) => b.saved - a.saved),
  }
  // The orphaned programs/<id>.json is left in place on purpose: git history
  // keeps it recoverable, and nothing reads a file the manifest does not list.
  const res = await commitFile(MANIFEST_PATH, manifest, 'Remove program', token)
  return res.ok
}
