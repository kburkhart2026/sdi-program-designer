import { create } from 'zustand'
import type { Course, Program, ProgramType, Week } from '../types/program'
import { SCHEMA_VERSION, TYPE_PRESETS, makeCourse, makeProgramId, makeWeek } from '../types/program'
import { saveDrafts, saveDraftsNow } from '../sync/local'
import { useSession } from './useSession'

/**
 * Program data and every mutation that touches it.
 *
 * ROLE ENFORCEMENT. Read-only is not enforced by hiding buttons — it is
 * enforced here, by `guard()`, which every mutating action is wrapped in.
 * One check, in one place. The Playbook's equivalent is 72 hand-placed
 * `if (viewerModeForced) return;` lines and two subtly different predicates;
 * that works until someone adds a 73rd handler and forgets. Wrapping makes
 * forgetting impossible: an unwrapped action is visibly unwrapped.
 *
 * Hidden chrome and the `body.view-mode` CSS are still applied on top, as
 * defence in depth, and the read-only viewer PAT is the real backstop.
 */

export type Screen = 'setup' | 'build' | 'map' | 'database'

/** One program's courses selected for reuse in the setup import picker. */
export interface ImportSelection {
  programId: string
  courseIndexes: number[]
}

export interface SetupState {
  name: string
  type: ProgramType
  courses: number
  credits: number
  weeks: number
  creds: string[]
  imports: ImportSelection[]
}

export function initialSetup(): SetupState {
  const preset = TYPE_PRESETS.Certificate
  return {
    name: '',
    type: 'Certificate',
    courses: preset.courses,
    credits: preset.credits,
    weeks: preset.weeks,
    creds: [],
    imports: [],
  }
}

interface ProgramState {
  programs: Program[]
  activeId: string | null
  screen: Screen
  /** Program ids changed locally since the last successful publish. */
  dirty: string[]
  /** program id (and MANIFEST_PATH) -> blob sha at load time. */
  baseShas: Record<string, string>
  setup: SetupState
  hydrated: boolean

  // --- lifecycle ---
  hydrate: (input: {
    programs: Program[]
    baseShas: Record<string, string>
    dirty: string[]
  }) => void
  flushNow: () => void
  markPublished: (ids: string[], baseShas: Record<string, string>) => void
  replaceProgram: (program: Program, sha: string) => void

  // --- setup screen ---
  patchSetup: (patch: Partial<SetupState>) => void
  setType: (type: ProgramType) => void
  toggleSetupCred: (code: string) => void
  toggleImportCourse: (programId: string, courseIndex: number) => void
  setImportAll: (programId: string, courseIndexes: number[] | null) => void
  buildScaffold: () => void

  // --- navigation ---
  openProgram: (id: string) => void
  newProgram: () => void
  goto: (screen: Screen) => void

  // --- mutations ---
  deleteProgram: (id: string) => void
  renameProgram: (name: string) => void
  setPlos: (plos: string) => void
  setCourseField: (courseIndex: number, field: 'title' | 'description' | 'clo', value: string) => void
  setWeekField: (
    courseIndex: number,
    weekIndex: number,
    field: keyof Pick<Week, 'module' | 'discussion' | 'assessment' | 'video' | 'tools'>,
    value: string,
  ) => void
  addLesson: (courseIndex: number, weekIndex: number, lessonId: string) => void
  removeLesson: (courseIndex: number, weekIndex: number, lessonId: string) => void
  toggleReviewLesson: (courseIndex: number, weekIndex: number, lessonId: string) => void
  moveWeek: (courseIndex: number, from: number, to: number) => void
}

/* ---------- persistence ------------------------------------------------------
   Every mutation debounces a local save at 400ms. This is what guarantees work
   is never lost; Publish is a separate, explicit act. */

let saveTimer: ReturnType<typeof setTimeout> | undefined

function scheduleSave(get: () => ProgramState): void {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveTimer = undefined
    const { programs, baseShas, dirty } = get()
    void saveDrafts({ programs, baseShas, dirty }).then((ok) => {
      // false means BOTH IndexedDB and localStorage failed — almost always a
      // full quota. That is the one condition worth shouting about.
      useSession.getState().setStorageAlarm(!ok)
    })
  }, 400)
}

/** True when a local save is queued but not yet written — the unload guard. */
export function hasPendingSave(): boolean {
  return saveTimer !== undefined
}

/* ---------- the guard --------------------------------------------------------- */

function canEdit(): boolean {
  return useSession.getState().role !== 'viewer'
}

/** Wrap a mutating action so a viewer can never invoke it. */
function guard<A extends unknown[]>(fn: (...args: A) => void): (...args: A) => void {
  return (...args: A) => {
    if (!canEdit()) return
    fn(...args)
  }
}

/* ---------- scaffold generation ------------------------------------------------ */

/**
 * Build the program from the setup form.
 *
 * Reused courses are DEEP COPIES carrying a provenance record, not live links.
 * Editing the new program never changes the source. Live linking raises sync
 * questions ("the certificate changed after the AS was approved — now what?")
 * that have no agreed answer, so copying is the honest behaviour.
 */
export function buildProgramFromSetup(setup: SetupState, saved: Program[]): Program {
  const preset = TYPE_PRESETS[setup.type]
  const weeks = preset.configurable ? setup.weeks : preset.weeks
  const credits = preset.configurable ? setup.credits : preset.credits
  const wanted = preset.configurable ? setup.courses : preset.courses

  const imported: Course[] = []
  for (const sel of setup.imports) {
    const src = saved.find((p) => p.id === sel.programId)
    if (!src) continue
    for (const idx of [...sel.courseIndexes].sort((a, b) => a - b)) {
      const course = src.courses[idx]
      if (!course) continue
      const copy = structuredClone(course) as Course
      copy.source = { programName: src.name, courseNum: idx + 1 }
      imported.push(copy)
    }
  }

  // If more courses were selected than the count set, the larger number wins —
  // silently dropping a course the user explicitly ticked would be worse.
  const total = Math.max(wanted, imported.length)
  const courses: Course[] = []
  for (let i = 0; i < total; i++) {
    const reused = imported[i]
    if (reused) {
      // Normalise a reused course to this program's week count without
      // discarding authored content: pad short, keep long.
      while (reused.weeks.length < weeks) reused.weeks.push(makeWeek())
      courses.push(reused)
    } else {
      courses.push(makeCourse(weeks))
    }
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    id: makeProgramId(),
    name: setup.name.trim() || 'Untitled program',
    type: setup.type,
    credits,
    creds: [...setup.creds],
    plos: '',
    saved: Date.now(),
    courses,
  }
}

/* ---------- store ---------------------------------------------------------------- */

export const useProgram = create<ProgramState>((set, get) => {
  /** Deep-copy, mutate, mark dirty, schedule a save. The only write path. */
  const mutate = (id: string | null, recipe: (p: Program) => void): void => {
    const targetId = id ?? get().activeId
    if (!targetId) return
    const programs = get().programs.map((p) => {
      if (p.id !== targetId) return p
      const copy = structuredClone(p) as Program
      recipe(copy)
      copy.saved = Date.now()
      return copy
    })
    const dirty = get().dirty.includes(targetId) ? get().dirty : [...get().dirty, targetId]
    set({ programs, dirty })
    scheduleSave(get)
  }

  return {
    programs: [],
    activeId: null,
    screen: 'setup',
    dirty: [],
    baseShas: {},
    setup: initialSetup(),
    hydrated: false,

    hydrate({ programs, baseShas, dirty }) {
      set({ programs, baseShas, dirty, hydrated: true })
    },

    flushNow() {
      clearTimeout(saveTimer)
      saveTimer = undefined
      const { programs, baseShas, dirty } = get()
      saveDraftsNow({ programs, baseShas, dirty })
    },

    markPublished(ids, baseShas) {
      set({ dirty: get().dirty.filter((d) => !ids.includes(d)), baseShas })
      scheduleSave(get)
    },

    replaceProgram(program, sha) {
      set({
        programs: get().programs.map((p) => (p.id === program.id ? program : p)),
        baseShas: { ...get().baseShas, [program.id]: sha },
        dirty: get().dirty.filter((d) => d !== program.id),
      })
      scheduleSave(get)
    },

    /* --- setup --- */

    patchSetup(patch) {
      set({ setup: { ...get().setup, ...patch } })
    },

    setType(type) {
      const preset = TYPE_PRESETS[type]
      // Adopt the preset geometry. For Certificate/AS the steppers vanish, so
      // these values are the only ones that can apply.
      set({
        setup: {
          ...get().setup,
          type,
          courses: preset.courses,
          weeks: preset.weeks,
          credits: preset.credits,
        },
      })
    },

    toggleSetupCred(code) {
      const { creds } = get().setup
      get().patchSetup({
        creds: creds.includes(code) ? creds.filter((c) => c !== code) : [...creds, code],
      })
    },

    toggleImportCourse(programId, courseIndex) {
      const imports = [...get().setup.imports]
      const at = imports.findIndex((i) => i.programId === programId)
      if (at === -1) {
        imports.push({ programId, courseIndexes: [courseIndex] })
      } else {
        const entry = imports[at]!
        const has = entry.courseIndexes.includes(courseIndex)
        const next = has
          ? entry.courseIndexes.filter((i) => i !== courseIndex)
          : [...entry.courseIndexes, courseIndex]
        if (next.length === 0) imports.splice(at, 1)
        else imports[at] = { programId, courseIndexes: next }
      }
      get().patchSetup({ imports })
    },

    setImportAll(programId, courseIndexes) {
      const imports = get().setup.imports.filter((i) => i.programId !== programId)
      if (courseIndexes && courseIndexes.length > 0) imports.push({ programId, courseIndexes })
      get().patchSetup({ imports })
    },

    buildScaffold: guard(() => {
      const program = buildProgramFromSetup(get().setup, get().programs)
      set({
        programs: [program, ...get().programs],
        activeId: program.id,
        screen: 'build',
        dirty: [...get().dirty, program.id],
        setup: initialSetup(),
      })
      scheduleSave(get)
    }),

    /* --- navigation (not mutations: viewers navigate freely) --- */

    openProgram(id) {
      set({ activeId: id, screen: 'build' })
    },

    newProgram() {
      set({ setup: initialSetup(), activeId: null, screen: 'setup' })
    },

    goto(screen) {
      set({ screen })
    },

    /* --- mutations --- */

    deleteProgram: guard((id) => {
      const programs = get().programs.filter((p) => p.id !== id)
      set({
        programs,
        dirty: get().dirty.filter((d) => d !== id),
        activeId: get().activeId === id ? null : get().activeId,
        screen: get().activeId === id ? 'setup' : get().screen,
      })
      scheduleSave(get)
    }),

    renameProgram: guard((name) => mutate(null, (p) => { p.name = name })),

    setPlos: guard((plos) => mutate(null, (p) => { p.plos = plos })),

    setCourseField: guard((courseIndex, field, value) =>
      mutate(null, (p) => {
        const course = p.courses[courseIndex]
        if (course) course[field] = value
      }),
    ),

    setWeekField: guard((courseIndex, weekIndex, field, value) =>
      mutate(null, (p) => {
        const week = p.courses[courseIndex]?.weeks[weekIndex]
        if (week) week[field] = value
      }),
    ),

    addLesson: guard((courseIndex, weekIndex, lessonId) =>
      mutate(null, (p) => {
        const week = p.courses[courseIndex]?.weeks[weekIndex]
        // Duplicates within the same week are meaningless, so ignore rather
        // than warn — the drop simply does nothing visible.
        if (week && !week.lessons.includes(lessonId)) week.lessons.push(lessonId)
      }),
    ),

    removeLesson: guard((courseIndex, weekIndex, lessonId) =>
      mutate(null, (p) => {
        const week = p.courses[courseIndex]?.weeks[weekIndex]
        if (!week) return
        week.lessons = week.lessons.filter((id) => id !== lessonId)
        // Drop the review flag with the placement, or it becomes an orphan
        // that silently reapplies if the lesson is dragged back in later.
        week.reviewLessons = (week.reviewLessons ?? []).filter((id) => id !== lessonId)
      }),
    ),

    toggleReviewLesson: guard((courseIndex, weekIndex, lessonId) =>
      mutate(null, (p) => {
        const week = p.courses[courseIndex]?.weeks[weekIndex]
        if (!week || !week.lessons.includes(lessonId)) return
        const current = week.reviewLessons ?? []
        week.reviewLessons = current.includes(lessonId)
          ? current.filter((id) => id !== lessonId)
          : [...current, lessonId]
      }),
    ),

    moveWeek: guard((courseIndex, from, to) =>
      mutate(null, (p) => {
        const course = p.courses[courseIndex]
        if (!course) return
        if (from === to || from < 0 || to < 0) return
        if (from >= course.weeks.length || to >= course.weeks.length) return
        const [moved] = course.weeks.splice(from, 1)
        if (moved) course.weeks.splice(to, 0, moved)
      }),
    ),
  }
})

/** The active program, or null. */
export function useActiveProgram(): Program | null {
  return useProgram((s) => s.programs.find((p) => p.id === s.activeId) ?? null)
}
