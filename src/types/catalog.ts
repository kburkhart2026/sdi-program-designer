/**
 * Shape of public/catalog.json — 162KB, generated from two SME workbooks.
 * Read-only to the app. Regenerate from the workbooks, never hand-edit.
 * Provenance and the URL-extraction gotcha are in docs/data-model.md.
 *
 * VOCABULARY: the JSON key is `classes`, but SDI calls these **lessons** and
 * the UI must say "lesson" everywhere. "Class" is reserved for something else.
 * The types below keep the JSON key and rename at the boundary.
 */

/** One Tooling U–SME class, as it appears inside a credential's ordered list. */
export interface CatalogCredentialClass {
  dept: string
  name: string
  /** e.g. "260220". String, not number — some have leading zeroes. */
  id: string
  url: string
}

/** Microcredential lab entry. Only on `kind: 'micro'` credentials. */
export interface CatalogLab {
  topic: string
  code: string
  name: string
}

/** Workbook content for credentials that have no lesson mapping at all. */
export interface CatalogNote {
  label: string
  url?: string | null
  text: string
}

export interface CatalogCredential {
  /** e.g. "EVF", "CMfgT", "Mechatronics Foundations". */
  code: string
  title: string
  source: string
  /** 'micro' = Tooling U microcredential. 'other' = the synthetic credential
   *  holding catalog courses that map to no SME certification. */
  kind?: 'micro' | 'other'
  /** The per-credential ordered list. Empty for Lean Silver/Gold and CMTSE. */
  classes: CatalogCredentialClass[]
  labs?: CatalogLab[]
  /** Rendered instead of a lesson list when `classes` is empty. */
  notes?: CatalogNote[]
}

/** One entry in the deduplicated index — 283 of these. */
export interface CatalogClass {
  id: string
  name: string
  dept: string
  /** null when the source workbook had no hyperlink (one lesson: 260250). */
  url: string | null
  /** Every credential this lesson counts toward. Powers overlap + coverage. */
  creds: string[]
  /**
   * Tooling U FunctionalArea — one of 11 broad headings. Present for any
   * lesson the catalog export knows about. The lesson rail groups the `Other`
   * credential by this instead of by department, because 11 headings navigate
   * far better than the 30+ departments those 397 courses span.
   */
  topic?: string
  /** Course description from the catalog export. Shown in the detail panel. */
  description?: string
}

export interface Catalog {
  generated: string
  credentials: CatalogCredential[]
  /** Deduplicated across all credentials. */
  classes: CatalogClass[]
}

/** Fallback when a lesson has no URL in the workbook. */
export const TOOLING_U_FALLBACK_URL = 'https://learn.toolingu.com/'
