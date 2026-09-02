import type { Catalog, CatalogClass, CatalogCredential } from '../types/catalog'
import { TOOLING_U_FALLBACK_URL } from '../types/catalog'

/**
 * Catalog loading and lookup. Fetched once on mount; read-only thereafter.
 *
 * Ships as a static asset for this build. When a backend lands, move it behind
 * an API — nothing here assumes it came from a file.
 */

/** Respects Vite's `base`, so this resolves under a Pages project path. */
const CATALOG_URL = `${import.meta.env.BASE_URL}catalog.json`

export async function fetchCatalog(signal?: AbortSignal): Promise<Catalog> {
  const res = await fetch(CATALOG_URL, { signal })
  if (!res.ok) {
    throw new Error(`Could not load the lesson catalog (HTTP ${res.status}).`)
  }
  const json = (await res.json()) as Catalog
  if (!json || !Array.isArray(json.classes) || !Array.isArray(json.credentials)) {
    throw new Error('The lesson catalog is present but malformed.')
  }
  return json
}

/** Derived lookups built once per catalog, not per render. */
export interface CatalogIndex {
  catalog: Catalog
  /** lesson id -> lesson. */
  byId: Map<string, CatalogClass>
  /** credential code -> credential. */
  credByCode: Map<string, CatalogCredential>
  /** Credential codes, alphabetical — the order the setup chips use. */
  credCodes: string[]
  /** Lesson count per credential code, for the filter <select>. */
  credLessonCount: Map<string, number>
  /** Departments present in the deduplicated index, alphabetical. */
  depts: string[]
  totalLessons: number
  /** Lessons counting toward two or more credentials. */
  sharedLessons: number
}

export function buildIndex(catalog: Catalog): CatalogIndex {
  const byId = new Map<string, CatalogClass>()
  for (const c of catalog.classes) byId.set(c.id, c)

  const credByCode = new Map<string, CatalogCredential>()
  const credLessonCount = new Map<string, number>()
  for (const cr of catalog.credentials) {
    credByCode.set(cr.code, cr)
    credLessonCount.set(cr.code, cr.classes.length)
  }

  const credCodes = [...credByCode.keys()].sort((a, b) =>
    a.localeCompare(b, 'en', { sensitivity: 'base' }),
  )

  const depts = [...new Set(catalog.classes.map((c) => c.dept))].sort((a, b) =>
    a.localeCompare(b, 'en', { sensitivity: 'base' }),
  )

  return {
    catalog,
    byId,
    credByCode,
    credCodes,
    credLessonCount,
    depts,
    totalLessons: catalog.classes.length,
    sharedLessons: catalog.classes.filter((c) => c.creds.length > 1).length,
  }
}

/** One lesson had no hyperlink in the source workbook; fall back rather than 404. */
export function lessonUrl(lesson: CatalogClass | undefined): string {
  return lesson?.url ?? TOOLING_U_FALLBACK_URL
}

/** Lesson names always end in a level number, e.g. "Cutting Tool Materials 321". */
export function lessonName(index: CatalogIndex, id: string): string {
  return index.byId.get(id)?.name ?? `Unknown lesson ${id}`
}

/**
 * Credential titles carry their own code in a trailing parenthetical, e.g.
 * "Electrical Vehicle Fundamentals (EVF)". Wherever the code is already shown
 * beside the title, strip it rather than printing it twice.
 */
export function shortCredentialTitle(title: string): string {
  return title.replace(/\s*\([^)]*\)\s*$/, '')
}
