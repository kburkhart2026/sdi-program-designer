import type { CatalogClass } from '../types/catalog'
import type { Program } from '../types/program'
import type { CatalogIndex } from './catalog'

/**
 * Everything derived from a program is computed here, per render, never stored.
 * Pure functions only — call sites wrap them in useMemo.
 */

/** Where a lesson sits. Both indices are 0-based; the UI adds 1 for display. */
export interface Placement {
  courseIndex: number
  weekIndex: number
}

/** lesson id -> every place it appears, in course/week order. */
export type PlacementMap = Map<string, Placement[]>

export function buildPlacements(program: Program | null): PlacementMap {
  const map: PlacementMap = new Map()
  if (!program) return map
  program.courses.forEach((course, courseIndex) => {
    course.weeks.forEach((week, weekIndex) => {
      for (const id of week.lessons) {
        const list = map.get(id)
        if (list) list.push({ courseIndex, weekIndex })
        else map.set(id, [{ courseIndex, weekIndex }])
      }
    })
  })
  return map
}

/** "C1·W3" — the chip on a placed lesson in the rail. */
export function formatPlacement(p: Placement): string {
  return `C${p.courseIndex + 1}·W${p.weekIndex + 1}`
}

/** "also C1 w2" — the amber flag on a lesson chip placed elsewhere. */
export function formatElsewhere(p: Placement): string {
  return `also C${p.courseIndex + 1} w${p.weekIndex + 1}`
}

/**
 * The overlap check. Two placements in the *same* course warn harder than
 * placements across courses — repetition across courses is legitimate when the
 * depth differs, so the copy distinguishes the two.
 */
export interface Overlap {
  count: number
  placements: Placement[]
  /** True when at least two placements share a course. */
  sameCourse: boolean
}

export function overlapFor(placements: PlacementMap, lessonId: string): Overlap | null {
  const list = placements.get(lessonId)
  if (!list || list.length < 2) return null
  const seen = new Set<number>()
  let sameCourse = false
  for (const p of list) {
    if (seen.has(p.courseIndex)) { sameCourse = true; break }
    seen.add(p.courseIndex)
  }
  return { count: list.length, placements: list, sameCourse }
}

/** Every lesson placed more than once — the "Reused across courses" list. */
export function duplicates(placements: PlacementMap): { id: string; placements: Placement[] }[] {
  const out: { id: string; placements: Placement[] }[] = []
  for (const [id, list] of placements) {
    if (list.length > 1) out.push({ id, placements: list })
  }
  return out
}

/** Coverage of one targeted credential: how many of its lessons are placed. */
export interface Coverage {
  code: string
  placed: number
  total: number
  /** 0–1. `total === 0` yields 0 rather than NaN. */
  ratio: number
  complete: boolean
  unplaced: number
}

export function coverageFor(
  index: CatalogIndex,
  placements: PlacementMap,
  codes: string[],
): Coverage[] {
  return codes.map((code) => {
    const cred = index.credByCode.get(code)
    const ids = cred ? cred.classes.map((c) => c.id) : []
    const total = ids.length
    const placed = ids.filter((id) => placements.has(id)).length
    return {
      code,
      placed,
      total,
      ratio: total === 0 ? 0 : placed / total,
      complete: total > 0 && placed === total,
      unplaced: Math.max(0, total - placed),
    }
  })
}

/** Lesson rows grouped by department, both levels alphabetical. */
export interface DeptGroup {
  dept: string
  lessons: CatalogClass[]
}

export function groupByDept(lessons: CatalogClass[]): DeptGroup[] {
  const map = new Map<string, CatalogClass[]>()
  for (const l of lessons) {
    const list = map.get(l.dept)
    if (list) list.push(l)
    else map.set(l.dept, [l])
  }
  const collate = (a: string, b: string) => a.localeCompare(b, 'en', { sensitivity: 'base' })
  return [...map.entries()]
    .sort((a, b) => collate(a[0], b[0]))
    .map(([dept, list]) => ({ dept, lessons: [...list].sort((a, b) => collate(a.name, b.name)) }))
}

/** Filter the rail: credential, free-text search, and the unplaced-only toggle. */
export function filterLessons(
  index: CatalogIndex,
  opts: { credFilter: string; query: string; unplacedOnly: boolean; placements: PlacementMap },
): CatalogClass[] {
  const { credFilter, query, unplacedOnly, placements } = opts

  let pool: CatalogClass[]
  if (credFilter === ALL_CREDS) {
    pool = index.catalog.classes
  } else {
    const cred = index.credByCode.get(credFilter)
    // Resolve through byId so rail rows always carry the deduplicated entry
    // (which knows every credential the lesson counts toward), not the
    // per-credential copy (which does not).
    pool = cred
      ? cred.classes.map((c) => index.byId.get(c.id)).filter((c): c is CatalogClass => !!c)
      : []
  }

  const q = query.trim().toLowerCase()
  if (q) {
    pool = pool.filter(
      (l) => l.name.toLowerCase().includes(q) || l.id.includes(q) || l.dept.toLowerCase().includes(q),
    )
  }
  if (unplacedOnly) pool = pool.filter((l) => !placements.has(l.id))
  return pool
}

export const ALL_CREDS = '__all'

/** Total lessons placed across the whole program (counting repeats once each). */
export function totalPlaced(program: Program | null): number {
  if (!program) return 0
  let n = 0
  for (const c of program.courses) for (const w of c.weeks) n += w.lessons.length
  return n
}

export function courseLessonCount(program: Program, courseIndex: number): number {
  const course = program.courses[courseIndex]
  if (!course) return 0
  return course.weeks.reduce((n, w) => n + w.lessons.length, 0)
}

/** Top N departments by placed-lesson count — the map's "content mix". */
export function departmentMix(
  index: CatalogIndex,
  program: Program,
  limit = 8,
): { dept: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const course of program.courses) {
    for (const week of course.weeks) {
      for (const id of week.lessons) {
        const dept = index.byId.get(id)?.dept
        if (!dept) continue
        counts.set(dept, (counts.get(dept) ?? 0) + 1)
      }
    }
  }
  return [...counts.entries()]
    .map(([dept, count]) => ({ dept, count }))
    .sort((a, b) => b.count - a.count || a.dept.localeCompare(b.dept))
    .slice(0, limit)
}

/** Course identity colour. Cycles by index; the tab strip repeats it as a key. */
export function courseColor(courseIndex: number): string {
  return `var(--course-${courseIndex % 12})`
}

/** "Course 2 of 8 · 8 weeks · 4 credits". All labels pluralize. */
export function plural(n: number, one: string, many = one + 's'): string {
  return `${n} ${n === 1 ? one : many}`
}
