import { useMemo } from 'react'
import type { CatalogIndex } from '../../data/catalog'
import {
  ALL_CREDS,
  buildPlacements,
  filterLessons,
  formatPlacement,
  groupByDept,
  plural,
} from '../../data/derive'
import type { Program } from '../../types/program'
import { useUi } from '../../store/useUi'
import { useRole } from '../../auth/RoleContext'
import { Eyebrow, Rail } from '../../components/ui'
import { dragState } from './dragState'
import s from './builder.module.css'

/**
 * Left panel — the lesson database rail.
 *
 * Rows are grouped by department, draggable, and show a `C1·W3` chip plus 55%
 * opacity once placed. Say "lessons", never "classes": SDI reserves "class"
 * for something else, and the underlying JSON key is not user-visible.
 */
export function LessonPanel({
  index,
  program,
}: {
  index: CatalogIndex
  program: Program
}) {
  const { canEdit } = useRole()
  const railHidden = useUi((u) => u.railHidden)
  const q = useUi((u) => u.q)
  const credFilter = useUi((u) => u.credFilter)
  const unplacedOnly = useUi((u) => u.unplacedOnly)
  const sel = useUi((u) => u.sel)
  const setUi = useUi((u) => u.set)

  const placements = useMemo(() => buildPlacements(program), [program])

  const lessons = useMemo(
    () => filterLessons(index, { credFilter, query: q, unplacedOnly, placements }),
    [index, credFilter, q, unplacedOnly, placements],
  )
  // The `Other` credential spans 30+ departments but only 11 functional areas,
  // so it groups by topic. Every other view keeps the department headings.
  const cred = index.credByCode.get(credFilter)
  const groupBy = cred?.kind === 'other' ? 'topic' : 'dept'
  const groups = useMemo(() => groupByDept(lessons, groupBy), [lessons, groupBy])

  if (railHidden) {
    return (
      <Rail
        label="Lesson database"
        side="left"
        controls="lesson-panel"
        onExpand={() => setUi('railHidden', false)}
      />
    )
  }

  return (
    <aside className={s.left} id="lesson-panel" aria-label="Lesson database">
      <div className={s.panelHead}>
        <div className={s.panelHeadRow}>
          <Eyebrow as="h2">Lesson database</Eyebrow>
          <button
            className={s.collapse}
            onClick={() => setUi('railHidden', true)}
            aria-expanded
            aria-controls="lesson-panel"
            aria-label="Collapse lesson database"
            title="Collapse"
          >
            ‹
          </button>
        </div>

        <label className="sr-only" htmlFor="cred-filter">
          Filter lessons by credential
        </label>
        <select
          id="cred-filter"
          className={s.select}
          value={credFilter}
          onChange={(e) => setUi('credFilter', e.target.value)}
        >
          <option value={ALL_CREDS}>All lessons ({index.totalLessons})</option>
          {/* Two groups: credential-bearing SME certifications, and the
              catalog courses that map to none of them. */}
          <optgroup label="SME certifications">
            {index.credCodes
              .filter((code) => index.credByCode.get(code)?.kind !== 'other')
              .map((code) => (
                <option key={code} value={code}>
                  {code} ({index.credLessonCount.get(code) ?? 0})
                </option>
              ))}
          </optgroup>
          {index.credCodes.some((code) => index.credByCode.get(code)?.kind === 'other') && (
            <optgroup label="Tooling U catalog">
              {index.credCodes
                .filter((code) => index.credByCode.get(code)?.kind === 'other')
                .map((code) => (
                  <option key={code} value={code}>
                    {code} ({index.credLessonCount.get(code) ?? 0})
                  </option>
                ))}
            </optgroup>
          )}
        </select>

        <label className="sr-only" htmlFor="lesson-search">
          Search lessons
        </label>
        <input
          id="lesson-search"
          className={s.search}
          type="search"
          placeholder="Search lessons"
          value={q}
          onChange={(e) => setUi('q', e.target.value)}
        />

        <div className={s.filterRow}>
          <button
            className={`${s.filterToggle} ${unplacedOnly ? s.filterOn : ''}`}
            aria-pressed={unplacedOnly}
            onClick={() => setUi('unplacedOnly', !unplacedOnly)}
          >
            Not yet placed
          </button>
          {/* Announced politely so filtering is not a silent change. */}
          <span className={s.resultCount} role="status">
            {lessons.length} shown
          </span>
        </div>
      </div>

      <div className={s.lessonList}>
        {groups.length === 0 && (
          <p className={s.emptyList}>
            No lessons match{q ? ` “${q}”` : ''}
            {unplacedOnly ? ' that are still unplaced' : ''}.
          </p>
        )}

        {groups.map((group) => (
          <section key={group.dept} aria-label={group.dept}>
            <h3 className={s.deptHead}>{group.dept}</h3>
            {group.lessons.map((lesson) => {
              const placed = placements.get(lesson.id)
              const isSel = sel === lesson.id
              return (
                <button
                  key={lesson.id}
                  className={[
                    s.lessonRow,
                    isSel && s.lessonRowSel,
                    placed && s.lessonRowPlaced,
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  draggable={canEdit}
                  aria-pressed={isSel}
                  onClick={() => setUi('sel', lesson.id)}
                  onDragStart={(e) => {
                    if (!canEdit) return
                    dragState.lessonId = lesson.id
                    dragState.weekIndex = null
                    e.dataTransfer.setData('text/plain', lesson.id)
                    e.dataTransfer.effectAllowed = 'copy'
                  }}
                  onDragEnd={() => {
                    dragState.lessonId = null
                    setUi('over', null)
                  }}
                >
                  <span className={s.lessonRowName}>
                    {lesson.name}
                    {/* Under a topic heading the department is no longer implied
                        by the group, so surface it per row. */}
                    {groupBy === 'topic' && lesson.dept && (
                      <span className={s.lessonRowDept}>{lesson.dept}</span>
                    )}
                  </span>
                  {placed && placed[0] && (
                    <span className={s.placedChip} title={`Placed in ${plural(placed.length, 'place')}`}>
                      {formatPlacement(placed[0])}
                      {placed.length > 1 ? ` +${placed.length - 1}` : ''}
                    </span>
                  )}
                </button>
              )
            })}
          </section>
        ))}
      </div>
    </aside>
  )
}
