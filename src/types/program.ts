/**
 * Program schema — what an instructional designer authors in Program Designer.
 *
 * FIELD NAMES: docs/data-model.md flags that the prototype stored the
 * Discussion column as `week.assessment` and the Assessment column as
 * `week.applied`, a leftover from an earlier naming. That doc instructs the
 * real schema to fix it, so this one does:
 *
 *     prototype `assessment` (held Discussion) -> `discussion`
 *     prototype `applied`    (held Assessment) -> `assessment`
 *
 * src/data/migrate.ts performs the rename on any imported prototype data.
 */

export const SCHEMA_VERSION = 1 as const

export type ProgramType = 'Certificate' | 'Associate of Science' | 'Custom'

/** One row of the scaffold. */
export interface Week {
  module: string
  /** Lesson ids, ordered. Duplicates within one week are rejected on drop. */
  lessons: string[]
  /**
   * Ids from `lessons` taught as review/refresher rather than new instruction.
   *
   * Per PLACEMENT, not per lesson: the same lesson is routinely new material
   * early in a program and review later, so the flag has to belong to the week
   * it sits in, not to the catalog entry.
   *
   * Optional, so programs saved before this existed load untouched; migrate.ts
   * normalises it to [] on read.
   */
  reviewLessons?: string[]
  discussion: string
  assessment: string
  video: string
  tools: string
}

/** Provenance on a course deep-copied from another program. */
export interface CourseSource {
  programName: string
  /** 1-based, as shown to the user. */
  courseNum: number
}

export interface Course {
  title: string
  description: string
  /** Course learning outcomes, one per line. */
  clo: string
  /** Present only on reused courses. Copies, never live links. */
  source?: CourseSource
  weeks: Week[]
}

export interface Program {
  schemaVersion: typeof SCHEMA_VERSION
  id: string
  name: string
  type: ProgramType
  /** Credits per course. 4 for Certificate and AS. */
  credits: number
  /** Credential codes this program targets. Drives coverage. */
  creds: string[]
  /** Program learning outcomes — program-level, static across all courses. */
  plos: string
  /** Epoch ms, for sorting the program cards. */
  saved: number
  courses: Course[]
}

/** The lightweight per-program record carried in the content repo manifest. */
export interface ProgramSummary {
  id: string
  name: string
  type: ProgramType
  credits: number
  creds: string[]
  saved: number
  courseCount: number
  lessonCount: number
}

/* ---------- Program-type presets ------------------------------------------
   Certificate and AS have fixed geometry: 8 weeks, 4 credits, always. This was
   explicit user direction — exposing these as editable for standard types
   invites data-entry errors. The steppers appear for Custom only. */

export interface TypePreset {
  courses: number
  weeks: number
  credits: number
  /** Total program credits, shown in the setup summary. */
  totalCredits: number
  hint: string
  /** Whether the course/credit/week steppers are shown. */
  configurable: boolean
}

export const TYPE_PRESETS: Record<ProgramType, TypePreset> = {
  Certificate: {
    courses: 8, weeks: 8, credits: 4, totalCredits: 32,
    hint: '8 courses · 8 weeks each · 32 credits',
    configurable: false,
  },
  'Associate of Science': {
    courses: 11, weeks: 8, credits: 4, totalCredits: 44,
    hint: '11 courses · 8 weeks each · 44 credits',
    configurable: false,
  },
  Custom: {
    courses: 4, weeks: 8, credits: 4, totalCredits: 16,
    hint: 'Set courses, credits and weeks yourself',
    configurable: true,
  },
}

export const PROGRAM_TYPES: ProgramType[] = ['Certificate', 'Associate of Science', 'Custom']

/** Stepper bounds, from the spec. */
export const LIMITS = {
  courses: { min: 1, max: 40, step: 1 },
  credits: { min: 0.5, max: 12, step: 0.5 },
  weeks: { min: 1, max: 16, step: 1 },
} as const

/* ---------- Factories ------------------------------------------------------ */

/** Cells start empty. No placeholder content the user has to delete. */
export function makeWeek(): Week {
  return { module: '', lessons: [], reviewLessons: [], discussion: '', assessment: '', video: '', tools: '' }
}

export function makeCourse(weeks: number): Course {
  return {
    title: '',
    description: '',
    clo: '',
    weeks: Array.from({ length: weeks }, makeWeek),
  }
}

export function makeProgramId(): string {
  return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}
