import { create } from 'zustand'
import {
  EDITOR_KEY_FILE,
  LS_EDITOR_TOKEN,
  LS_VIEWER_TOKEN,
  VIEWER_KEY_FILE,
  isConfigured,
} from '../sync/config'
import { decryptToken, fetchVault, type VaultRecord } from '../sync/vault'

/**
 * Session: who is using the app, and with what token.
 *
 * Three roles:
 *   'viewer' — opened a #v link. Read-only, everywhere.
 *   'editor' — opened a #e link. Full edit plus Publish.
 *   'local'  — no link fragment, or no content repo configured. Full edit, but
 *              drafts stay in this browser; Publish is unavailable and says so.
 *
 * VIEWER WINS over editor when both are somehow present. Opening a shared
 * view-only link in your own browser must stay read-only — otherwise you can
 * edit inside what you believe is a preview of what colleagues see.
 */

export type Role = 'viewer' | 'editor' | 'local'

export type SyncState = 'idle' | 'loading' | 'saving' | 'publishing' | 'ok' | 'error' | 'conflict'

interface SessionState {
  role: Role
  token: string
  /** True once a token is in hand, or immediately for 'local'. */
  ready: boolean
  /** A gate is required and has not been passed. */
  gateOpen: boolean
  gateFile: string
  gateRecord: VaultRecord | null
  gateError: string
  gateBusy: boolean
  /** Set when the key file itself is missing — a deployment problem, not a typo. */
  gateUnavailable: string

  sync: SyncState
  /** Sticky on failure, auto-clearing on success. See setSync. */
  syncMessage: string
  /** Both local stores failed — the red rescue banner. */
  storageAlarm: boolean

  init: () => Promise<void>
  submitPassword: (password: string) => Promise<void>
  lock: () => void
  setSync: (state: SyncState, message?: string) => void
  setStorageAlarm: (on: boolean) => void
}

function roleFromHash(): Role {
  const h = typeof location === 'undefined' ? '' : location.hash
  if (/(?:^#|&)v(?:=|&|$)/.test(h)) return 'viewer'
  if (/(?:^#|&)e(?:=|&|$)/.test(h)) return 'editor'
  return 'local'
}

function cached(key: string): string {
  try {
    return localStorage.getItem(key) ?? ''
  } catch {
    return ''
  }
}

function cache(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* private mode — the user re-enters the password next visit */
  }
}

let syncClearTimer: ReturnType<typeof setTimeout> | undefined

export const useSession = create<SessionState>((set, get) => ({
  role: 'local',
  token: '',
  ready: false,
  gateOpen: false,
  gateFile: '',
  gateRecord: null,
  gateError: '',
  gateBusy: false,
  gateUnavailable: '',
  sync: 'idle',
  syncMessage: '',
  storageAlarm: false,

  async init() {
    const role = roleFromHash()

    // Local mode: nothing to unlock, and nothing to talk to.
    if (role === 'local' || !isConfigured()) {
      set({ role: isConfigured() ? role : 'local', ready: true, gateOpen: false })
      return
    }

    const lsKey = role === 'viewer' ? LS_VIEWER_TOKEN : LS_EDITOR_TOKEN
    const existing = cached(lsKey)
    if (existing) {
      set({ role, token: existing, ready: true, gateOpen: false })
      return
    }

    // Fetch the key file BEFORE showing the gate, so a broken deployment says
    // so instead of silently rejecting every password the user tries.
    const file = role === 'viewer' ? VIEWER_KEY_FILE : EDITOR_KEY_FILE
    const rec = await fetchVault(file)
    set({
      role,
      gateOpen: true,
      gateFile: file,
      gateRecord: rec,
      gateUnavailable: rec ? '' : `This link is not set up yet — ${file} was not found.`,
      ready: false,
    })
  },

  async submitPassword(password) {
    const { gateRecord, role } = get()
    if (!gateRecord) return
    set({ gateBusy: true, gateError: '' })
    try {
      // AES-GCM is authenticated, so a wrong password throws here rather than
      // yielding a plausible-looking wrong token.
      const token = await decryptToken(password, gateRecord)
      cache(role === 'viewer' ? LS_VIEWER_TOKEN : LS_EDITOR_TOKEN, token)
      set({ token, ready: true, gateOpen: false, gateBusy: false, gateError: '' })
    } catch {
      set({ gateBusy: false, gateError: 'That password is not right. Try again.' })
    }
  },

  /**
   * Forget the decrypted token and reload.
   *
   * The Playbook has this function but its button was retired, which leaves a
   * decrypted PAT sitting in localStorage on any machine that ever opened a
   * link. Here it stays reachable from the header.
   */
  lock() {
    try {
      localStorage.removeItem(LS_VIEWER_TOKEN)
      localStorage.removeItem(LS_EDITOR_TOKEN)
    } catch {
      /* ignore */
    }
    location.reload()
  },

  setSync(state, message = '') {
    clearTimeout(syncClearTimer)
    set({ sync: state, syncMessage: message })
    // Success fades; failure does NOT. Carrying on unaware that a publish
    // failed is the whole risk, so the message stays until the next success.
    if (state === 'ok') {
      syncClearTimer = setTimeout(() => {
        if (get().sync === 'ok') set({ sync: 'idle', syncMessage: '' })
      }, 2800)
    }
  },

  setStorageAlarm(on) {
    set({ storageAlarm: on })
  },
}))

/** The single derived permission. Everything mutating consults this. */
export function canEditFor(role: Role): boolean {
  return role !== 'viewer'
}
