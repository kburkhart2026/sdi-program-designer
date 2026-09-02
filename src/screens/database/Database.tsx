import { useMemo } from 'react'
import type { CatalogClass, CatalogCredential } from '../../types/catalog'
import { lessonUrl, shortCredentialTitle, type CatalogIndex } from '../../data/catalog'
import { bokFor, bokHref } from '../../data/bok'
import { plural } from '../../data/derive'
import { useProgram } from '../../store/useProgram'
import { useUi } from '../../store/useUi'
import { Button, Eyebrow } from '../../components/ui'
import s from './database.module.css'

/**
 * Screen 4 — the Tooling U–SME Catalog Database.
 *
 * The reference tool. Answers "what lessons exist, which credentials does this
 * lesson count toward, where is the official body of knowledge." Read-only by
 * nature, so it needs no role gating: there is nothing here to mutate.
 *
 * Conceptually the front door — you browse, then you build — which is why it
 * cross-links with the Designer in both directions.
 */
export function Database({ index }: { index: CatalogIndex }) {
  const goto = useProgram((st) => st.goto)

  const cred = useUi((u) => u.dbCred)
  const q = useUi((u) => u.dbQ)
  const sharedOnly = useUi((u) => u.dbSharedOnly)
  const sel = useUi((u) => u.dbSel)
  const dbReturn = useUi((u) => u.dbReturn)
  const setUi = useUi((u) => u.set)
  const selectCredential = useUi((u) => u.selectCredential)

  /** Credential codes, alphabetical. Certifications and microcredentials
      interleaved, not sectioned — the distinction does not help you find one. */
  const credentials = useMemo(
    () =>
      [...index.catalog.credentials].sort((a, b) =>
        a.code.localeCompare(b.code, 'en', { sensitivity: 'base' }),
      ),
    [index],
  )

  const current: CatalogCredential | undefined =
    credentials.find((c) => c.code === cred) ?? credentials[0]

  /** How many credentials each lesson counts toward — drives the coverage chip. */
  const shareCount = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of index.catalog.classes) m.set(c.id, c.creds.length)
    return m
  }, [index])

  const { sections, matchCount } = useMemo(() => {
    if (!current) return { sections: [], matchCount: 0 }
    const needle = q.trim().toLowerCase()

    let rows = current.classes.filter(
      (c) =>
        !needle ||
        c.name.toLowerCase().includes(needle) ||
        c.id.includes(needle) ||
        (c.dept || '').toLowerCase().includes(needle),
    )
    if (sharedOnly) rows = rows.filter((c) => (shareCount.get(c.id) ?? 1) > 1)

    const byDept = new Map<string, typeof rows>()
    for (const c of rows) {
      const key = c.dept || 'Unassigned'
      const list = byDept.get(key)
      if (list) list.push(c)
      else byDept.set(key, [c])
    }
    const collate = (a: string, b: string) => a.localeCompare(b, 'en', { sensitivity: 'base' })

    return {
      matchCount: rows.length,
      sections: [...byDept.entries()].sort((a, b) => collate(a[0], b[0])).map(([dept, list]) => ({
        dept,
        lessons: [...list].sort((a, b) => collate(a.name, b.name)),
      })),
    }
  }, [current, q, sharedOnly, shareCount])

  if (!current) return null

  const hasLessons = current.classes.length > 0
  const notes = current.notes ?? []
  const showNotes = !hasLessons && notes.length > 0
  const showEmpty = hasLessons && matchCount === 0

  const deptCount = new Set(current.classes.map((c) => c.dept || '—')).size
  const sharedHere = current.classes.filter((c) => (shareCount.get(c.id) ?? 1) > 1).length

  const summary = hasLessons
    ? `${current.classes.length} Tooling U lessons across ${plural(deptCount, 'department')}. ` +
      `${sharedHere} of them also count toward another credential.`
    : 'No lesson mapping in the workbook — this credential is covered by review materials and reading lists.'

  // The deduplicated entry knows every credential a lesson counts toward; the
  // per-credential copy does not, so always resolve through byId.
  const selected: CatalogClass | undefined = sel ? index.byId.get(sel) : undefined
  const docs = bokFor(current.code)

  return (
    <div className={s.screen}>
      <a className="skip-link" href="#catalog-results">
        Skip to lesson list
      </a>

      <header className={`${s.appbar} on-dark`}>
        <span className={s.appTitle}>Tooling U–SME Catalog</span>
        <Button variant="onDark" onClick={() => goto(dbReturn)}>
          ← Program Designer
        </Button>
        <div className={s.totals}>
          <span>{plural(index.catalog.credentials.length, 'credential')}</span>
          <span>{index.totalLessons} unique lessons</span>
          <span>{index.sharedLessons} shared</span>
        </div>
      </header>

      <div className={s.body}>
        {/* ---------- credentials ---------- */}
        <nav className={s.left} aria-label="Credentials">
          <div className={s.leftHead}>
            {/* A plain label, not a heading: the <nav> already carries
                aria-label="Credentials", and this sits before the <h1> in DOM
                order, so making it a heading would report an h2 ahead of the
                page's h1. */}
            <Eyebrow>Credentials</Eyebrow>
          </div>
          <ul className={s.credList}>
            {credentials.map((c) => {
              const on = c.code === current.code
              return (
                <li key={c.code}>
                  <button
                    className={`${s.credRow} ${on ? s.credRowOn : ''}`}
                    aria-current={on ? 'true' : undefined}
                    onClick={() => selectCredential(c.code)}
                  >
                    <span className={s.credRowTop}>
                      <span className={s.credCode}>{c.code}</span>
                      <span className={s.credCount}>
                        {c.classes.length || '—'}
                        <span className="sr-only">
                          {c.classes.length
                            ? ` ${plural(c.classes.length, 'lesson')}`
                            : ' no lesson mapping'}
                        </span>
                      </span>
                    </span>
                    <span className={s.credTitle}>{shortCredentialTitle(c.title)}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* ---------- lessons ---------- */}
        <main className={s.centre}>
          <div className={s.centreHead}>
            <div className={s.headRow}>
              <div className={s.headMain}>
                <div className={s.headEyebrow}>
                  {current.kind === 'micro' ? 'Microcredential' : `Certification · ${current.code}`}
                </div>
                <h1 className={s.headTitle}>{current.title}</h1>
                <p className={s.headSummary}>{summary}</p>
              </div>
              <div style={{ marginLeft: 'auto', flexShrink: 0 }}>
                <label className="sr-only" htmlFor="catalog-search">
                  Search lessons in {current.code}
                </label>
                <input
                  id="catalog-search"
                  className={s.search}
                  type="search"
                  placeholder="Search lessons"
                  value={q}
                  onChange={(e) => setUi('dbQ', e.target.value)}
                />
              </div>
            </div>

            {/* Disabled for the credentials with no lesson mapping — a filter
                that cannot change anything should not look operable, and the
                sticky "Shared only" state otherwise reads as an active filter
                over a list of workbook notes. */}
            <div className={s.tabRow}>
              <button
                className={`${s.tab} ${!sharedOnly ? s.tabOn : ''}`}
                aria-pressed={!sharedOnly}
                disabled={!hasLessons}
                onClick={() => setUi('dbSharedOnly', false)}
              >
                All lessons
              </button>
              <button
                className={`${s.tab} ${sharedOnly ? s.tabOn : ''}`}
                aria-pressed={sharedOnly}
                disabled={!hasLessons}
                onClick={() => setUi('dbSharedOnly', true)}
              >
                Shared only
              </button>
              <span className={s.resultLabel} role="status">
                {hasLessons ? `${matchCount} shown` : `${notes.length} entries`}
              </span>
            </div>
          </div>

          <div className={s.scroll} id="catalog-results">
            {sections.map((section) => (
              <section className={s.deptBlock} key={section.dept}>
                <div className={s.deptHead}>
                  <h2 className={s.deptName}>{section.dept}</h2>
                  <span className={s.deptCount}>{plural(section.lessons.length, 'lesson')}</span>
                </div>
                {section.lessons.map((lesson) => {
                  const n = shareCount.get(lesson.id) ?? 1
                  const on = sel === lesson.id
                  return (
                    <button
                      key={lesson.id}
                      className={`${s.lessonRow} ${on ? s.lessonRowOn : ''}`}
                      aria-pressed={on}
                      onClick={() => setUi('dbSel', lesson.id)}
                    >
                      <span className={s.lessonName}>{lesson.name}</span>
                      {/* No lesson IDs in the list — they live in the detail panel. */}
                      <span className={`${s.chip} ${n > 1 ? s.chipShared : s.chipOnly}`}>
                        {n > 1 ? `+${n - 1} more` : 'only here'}
                      </span>
                    </button>
                  )
                })}
              </section>
            ))}

            {showNotes && (
              <div className={s.notes}>
                <h2 className={s.notesHead}>From the workbook</h2>
                {notes.map((note, i) => (
                  <article className={s.note} key={i}>
                    <div className={s.noteLabel}>{note.label}</div>
                    {note.text && (
                      // The workbook uses "*" as a bullet separator inside one cell.
                      <p className={s.noteText}>{note.text.replace(/\s*\*\s*/g, '\n').trim()}</p>
                    )}
                    {note.url && (
                      <a
                        className={s.noteUrl}
                        href={note.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {note.url.split('?')[0]}
                        <span className="sr-only"> (opens in a new tab)</span>
                      </a>
                    )}
                  </article>
                ))}
              </div>
            )}

            {showEmpty && <p className={s.empty}>No lessons match that search.</p>}
          </div>
        </main>

        {/* ---------- body of knowledge + lesson detail ---------- */}
        <aside className={s.right} aria-label="Body of knowledge and lesson detail">
          <div className={s.bok}>
            <Eyebrow as="h2">Body of knowledge · {current.code}</Eyebrow>
            {docs.length === 0 ? (
              // Say so explicitly rather than showing an empty panel.
              <p className={s.bokNone}>No body of knowledge on file for this credential.</p>
            ) : (
              docs.map((doc) => (
                <a
                  key={doc.file + doc.title}
                  className={s.bokDoc}
                  href={bokHref(doc)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span className={s.bokText}>
                    <span className={s.bokTitle}>{doc.title}</span>
                    <span className={s.bokMeta}>{doc.meta}</span>
                  </span>
                  <span className={s.bokTag} aria-hidden="true">
                    PDF
                  </span>
                  <span className="sr-only">PDF, opens in a new tab</span>
                </a>
              ))
            )}
          </div>

          {selected ? (
            <div>
              <div className={s.detailSection}>
                <Eyebrow as="h2">Lesson</Eyebrow>
                <h3 className={s.detailName}>{selected.name}</h3>
                <p className={s.detailMeta}>
                  {selected.id} · {selected.dept || 'Unassigned'}
                </p>
              </div>

              <div className={`${s.detailSection} ${s.stack}`}>
                <Eyebrow as="h2">Counts toward</Eyebrow>
                {selected.creds.map((code) => {
                  const c = index.credByCode.get(code)
                  return (
                    <button
                      key={code}
                      className={s.credJump}
                      onClick={() => selectCredential(code)}
                    >
                      <span className={s.credJumpCode}>{code}</span>
                      <span className={s.credJumpTitle}>
                        {c ? shortCredentialTitle(c.title) : ''}
                      </span>
                    </button>
                  )
                })}
              </div>

              <div className={s.detailSectionLast}>
                <Eyebrow as="h2">Lesson content</Eyebrow>
                <p className={s.linkNote}>
                  {selected.url
                    ? 'Direct lesson page from the mapping workbook.'
                    : 'No lesson link in the workbook — opens the Tooling U catalog.'}
                </p>
                <a
                  className={s.openBtn}
                  href={lessonUrl(selected)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open on Tooling U
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              </div>
            </div>
          ) : (
            <p className={s.noDetail}>
              Select a lesson to see which credentials it counts toward and open the lesson on
              Tooling U.
            </p>
          )}
        </aside>
      </div>
    </div>
  )
}
