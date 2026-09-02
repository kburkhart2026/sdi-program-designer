import { create } from 'zustand'
import { ALL_CREDS } from '../data/derive'

/**
 * Transient view state. Never persisted, never published — losing all of it on
 * reload is correct behaviour.
 */
interface UiState {
  /** Active course index. */
  course: number
  /** Active week index — drives which week the outcomes panel is scoped to. */
  week: number
  /** Selected lesson id; swaps the right panel to detail when set. */
  sel: string | null

  // lesson rail filters
  q: string
  credFilter: string
  unplacedOnly: boolean

  // drag state
  /** Week index currently under a lesson drag. */
  over: number | null
  /** Week index being reordered. */
  weekDrag: number | null

  // chrome
  railHidden: boolean
  sideHidden: boolean
  courseOpen: boolean
  exportOpen: boolean
  /** Program id expanded in the setup import picker. */
  openSrc: string | null

  // --- Catalog Database (tool 2) ---
  // Deliberately separate from `q` / `sel` above: browsing the catalog must
  // never disturb the filters or selection the user set up in the builder.
  /** Selected credential code. */
  dbCred: string
  dbQ: string
  dbSharedOnly: boolean
  /** Selected lesson id within the Database. */
  dbSel: string | null
  /** Screen to return to from the Database. */
  dbReturn: 'setup' | 'build'

  /** Politely announced to screen readers — drops, moves, filter counts. */
  announcement: string

  set: <K extends keyof UiState>(key: K, value: UiState[K]) => void
  selectCourse: (index: number) => void
  selectCredential: (code: string) => void
  announce: (message: string) => void
  reset: () => void
}

const initial = {
  course: 0,
  week: 0,
  sel: null as string | null,
  q: '',
  credFilter: ALL_CREDS,
  unplacedOnly: false,
  over: null as number | null,
  weekDrag: null as number | null,
  railHidden: false,
  sideHidden: false,
  courseOpen: true,
  exportOpen: false,
  openSrc: null as string | null,
  dbCred: 'CMfgT',
  dbQ: '',
  dbSharedOnly: false,
  dbSel: null as string | null,
  dbReturn: 'setup' as 'setup' | 'build',
  announcement: '',
}

export const useUi = create<UiState>((set) => ({
  ...initial,

  set: (key, value) => set({ [key]: value } as Pick<UiState, typeof key>),

  /** Switching course clears the lesson selection, per the interaction spec. */
  selectCourse: (index) => set({ course: index, week: 0, sel: null }),

  /** Switching credential clears the lesson selection and the search. */
  selectCredential: (code) => set({ dbCred: code, dbSel: null, dbQ: '' }),

  announce: (message) => set({ announcement: message }),

  reset: () => set(initial),
}))
