import type { Course, Program, ProgramType, Week } from '../types/program'
import { SCHEMA_VERSION, makeWeek } from '../types/program'

/**
 * Import of prototype data into the real schema.
 *
 * docs/data-model.md lists three migrations the prototype performed on read,
 * plus the field rename it told us to do properly here. We carry the intent:
 *
 *   1. A single-program legacy key is wrapped into a program list.
 *   2. week.assessment values of "Discussion + quiz" / "Discussion" (old
 *      defaults) are cleared — they were prefilled text users had to delete.
 *   3. Any week.plo is folded up into program.plos and the per-week field dropped.
 *   4. RENAME: prototype `assessment` (Discussion column) -> `discussion`,
 *      prototype `applied` (Assessment column) -> `assessment`.
 *
 * Input is untrusted JSON from a file the user picked, so everything is
 * defensive: unknown shapes yield a valid empty-ish program rather than throwing.
 */

/** Old prefilled defaults that must not survive into a real program. */
const STALE_DEFAULTS = new Set(['Discussion + quiz', 'Discussion'])

type Loose = Record<string, unknown>

const str = (v: unknown): string => (typeof v === 'string' ? v : '')
const num = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])

function migrateWeek(raw: unknown, collectPlo: (plo: string) => void): Week {
  if (!raw || typeof raw !== 'object') return makeWeek()
  const w = raw as Loose

  // (3) week.plo folds up to the program.
  const plo = str(w.plo)
  if (plo.trim()) collectPlo(plo)

  // (4) the rename. Already-migrated data uses the new names, so prefer those
  // and fall back to the legacy ones — this makes the function idempotent.
  const discussion = 'discussion' in w ? str(w.discussion) : str(w.assessment)
  const assessment = 'discussion' in w ? str(w.assessment) : str(w.applied)

  const lessons = arr(w.lessons).filter((id): id is string => typeof id === 'string')

  return {
    module: str(w.module),
    lessons,
    // Absent before this field existed. Intersected with `lessons` so a flag
    // can never outlive the placement it describes.
    reviewLessons: arr(w.reviewLessons)
      .filter((id): id is string => typeof id === 'string')
      .filter((id) => lessons.includes(id)),
    // (2) drop the old prefilled defaults.
    discussion: STALE_DEFAULTS.has(discussion.trim()) ? '' : discussion,
    assessment,
    video: str(w.video),
    tools: str(w.tools),
  }
}

function migrateCourse(raw: unknown, collectPlo: (plo: string) => void): Course {
  if (!raw || typeof raw !== 'object') return { title: '', description: '', clo: '', weeks: [] }
  const c = raw as Loose
  const src = c.source as Loose | undefined

  const course: Course = {
    title: str(c.title),
    description: str(c.description),
    clo: str(c.clo),
    weeks: arr(c.weeks).map((w) => migrateWeek(w, collectPlo)),
  }
  if (src && typeof src === 'object' && str(src.programName)) {
    course.source = { programName: str(src.programName), courseNum: num(src.courseNum, 1) }
  }
  return course
}

const VALID_TYPES: ProgramType[] = ['Certificate', 'Associate of Science', 'Custom']

export function migrateProgram(raw: unknown): Program {
  const p = (raw && typeof raw === 'object' ? raw : {}) as Loose

  // PLOs collected out of per-week fields, appended after any program-level value.
  const folded: string[] = []
  const collect = (plo: string) => { if (!folded.includes(plo)) folded.push(plo) }

  const courses = arr(p.courses).map((c) => migrateCourse(c, collect))

  const declared = str(p.plos).trim()
  const plos = [declared, ...folded].filter(Boolean).join('\n')

  const type = VALID_TYPES.includes(str(p.type) as ProgramType)
    ? (str(p.type) as ProgramType)
    : 'Custom'

  return {
    schemaVersion: SCHEMA_VERSION,
    id: str(p.id) || 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    name: str(p.name) || 'Untitled program',
    type,
    credits: num(p.credits, 4),
    creds: arr(p.creds).filter((c): c is string => typeof c === 'string'),
    plos,
    saved: num(p.saved, Date.now()),
    courses,
  }
}

/**
 * Accepts either a program list or (1) a single legacy program object, and
 * returns a normalised list. Also tolerates the `{ programs: [...] }` wrapper
 * a backup file uses.
 */
export function migrateProgramList(raw: unknown): Program[] {
  if (Array.isArray(raw)) return raw.map(migrateProgram)

  if (raw && typeof raw === 'object') {
    const o = raw as Loose
    if (Array.isArray(o.programs)) return o.programs.map(migrateProgram)
    // (1) a bare single program.
    if ('courses' in o || 'name' in o) return [migrateProgram(o)]
  }
  return []
}
