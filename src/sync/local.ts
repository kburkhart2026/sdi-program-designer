import type { Program } from '../types/program'
import { migrateProgramList } from '../data/migrate'

/**
 * Local draft store — IndexedDB, with a localStorage mirror.
 *
 * This is the layer that means work is never lost: every mutation lands here on
 * a 400ms debounce, whether or not GitHub is reachable and whether or not the
 * user ever presses Publish. GitHub is the shared copy; this is the working copy.
 *
 * The two-store arrangement (and `loadDrafts` taking whichever is NEWER by
 * timestamp) is carried over from the Playbook, where preferring IndexedDB
 * unconditionally destroyed edits that only existed in the mirror: the unload
 * flush can write localStorage synchronously but can only *fire* an IndexedDB
 * write, which the browser frequently kills mid-transaction.
 */

const DB_NAME = 'sdi_program_designer'
const DB_VERSION = 1
const STORE = 'drafts'
const RECORD_KEY = 'current'
const LS_MIRROR = 'sdi_pd_drafts_v1'

export interface DraftRecord {
  v: 1
  ts: number
  programs: Program[]
  /** Blob shas the programs were loaded at, for conflict detection on publish. */
  baseShas: Record<string, string>
  /** Program ids with local changes not yet published. */
  dirty: string[]
}

function emptyRecord(): DraftRecord {
  return { v: 1, ts: 0, programs: [], baseShas: {}, dirty: [] }
}

/* ---------- IndexedDB ------------------------------------------------------- */

let dbPromise: Promise<IDBDatabase | null> | null = null

/** Give up on IndexedDB after this and run on the localStorage mirror alone. */
const OPEN_TIMEOUT_MS = 3000

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve) => {
    // `indexedDB.open` can hang indefinitely with NO event ever firing: another
    // tab holding an older version blocks the upgrade, a delete is pending, or
    // some private-mode implementations simply never settle. Without a timeout
    // that wedges boot, because loadDrafts() never resolves and the app sits on
    // its loading screen forever. Falling back to the mirror is always better
    // than not starting.
    let settled = false
    const finish = (db: IDBDatabase | null) => {
      if (settled) return
      settled = true
      resolve(db)
    }
    const timer = setTimeout(() => finish(null), OPEN_TIMEOUT_MS)

    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
      }
      req.onsuccess = () => {
        clearTimeout(timer)
        finish(req.result)
      }
      // Private browsing and some locked-down profiles reject IDB outright.
      // That is survivable — the localStorage mirror carries on alone.
      req.onerror = () => {
        clearTimeout(timer)
        finish(null)
      }
      req.onblocked = () => {
        clearTimeout(timer)
        finish(null)
      }
    } catch {
      clearTimeout(timer)
      finish(null)
    }
  })
  return dbPromise
}

async function idbGet(): Promise<DraftRecord | null> {
  const db = await openDb()
  if (!db) return null
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readonly')
      const req = tx.objectStore(STORE).get(RECORD_KEY)
      req.onsuccess = () => resolve((req.result as DraftRecord) ?? null)
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

async function idbPut(rec: DraftRecord): Promise<boolean> {
  const db = await openDb()
  if (!db) return false
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(rec, RECORD_KEY)
      tx.oncomplete = () => resolve(true)
      tx.onerror = () => resolve(false)
      tx.onabort = () => resolve(false)
    } catch {
      resolve(false)
    }
  })
}

/** Fire-and-forget write for unload paths, which cannot await a transaction. */
function idbPutSync(rec: DraftRecord): void {
  void openDb().then((db) => {
    if (!db) return
    try {
      db.transaction(STORE, 'readwrite').objectStore(STORE).put(rec, RECORD_KEY)
    } catch {
      /* nothing useful to do while the page is being torn down */
    }
  })
}

/* ---------- localStorage mirror --------------------------------------------- */

function lsGet(): DraftRecord | null {
  try {
    const raw = localStorage.getItem(LS_MIRROR)
    return raw ? (JSON.parse(raw) as DraftRecord) : null
  } catch {
    return null
  }
}

function lsPut(rec: DraftRecord): boolean {
  try {
    localStorage.setItem(LS_MIRROR, JSON.stringify(rec))
    return true
  } catch {
    // Almost always the ~5MB quota. The caller raises the storage alarm.
    return false
  }
}

/* ---------- public API ------------------------------------------------------- */

/** Reads both stores and takes whichever is newer. See the note at the top. */
export async function loadDrafts(): Promise<DraftRecord> {
  const [fromIdb, fromLs] = [await idbGet(), lsGet()]
  const best =
    fromIdb && fromLs ? (fromIdb.ts >= fromLs.ts ? fromIdb : fromLs) : (fromIdb ?? fromLs)
  if (!best) return emptyRecord()

  return {
    v: 1,
    ts: typeof best.ts === 'number' ? best.ts : 0,
    // Run stored programs back through the migration so a record written by an
    // older build (or imported from the prototype) is normalised on read.
    programs: migrateProgramList(best.programs),
    baseShas: best.baseShas ?? {},
    dirty: Array.isArray(best.dirty) ? best.dirty : [],
  }
}

/** Returns false only when BOTH stores failed — that is the alarm condition. */
export async function saveDrafts(rec: Omit<DraftRecord, 'v' | 'ts'>): Promise<boolean> {
  const full: DraftRecord = { v: 1, ts: Date.now(), ...rec }
  const idbOk = await idbPut(full)
  const lsOk = lsPut(full)
  return idbOk || lsOk
}

/**
 * Synchronous flush for pagehide/beforeunload. Writes the mirror immediately
 * and fires the IndexedDB write without awaiting it.
 */
export function saveDraftsNow(rec: Omit<DraftRecord, 'v' | 'ts'>): void {
  const full: DraftRecord = { v: 1, ts: Date.now(), ...rec }
  lsPut(full)
  idbPutSync(full)
}

export async function clearDrafts(): Promise<void> {
  try {
    localStorage.removeItem(LS_MIRROR)
  } catch {
    /* ignore */
  }
  const db = await openDb()
  if (!db) return
  try {
    db.transaction(STORE, 'readwrite').objectStore(STORE).delete(RECORD_KEY)
  } catch {
    /* ignore */
  }
}
