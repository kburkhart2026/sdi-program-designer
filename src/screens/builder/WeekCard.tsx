import type { DragEvent } from 'react'
import type { Week } from '../../types/program'
import type { CatalogIndex } from '../../data/catalog'
import { formatElsewhere, plural, type PlacementMap } from '../../data/derive'
import { useProgram } from '../../store/useProgram'
import { useUi } from '../../store/useUi'
import { useRole } from '../../auth/RoleContext'
import { WEEK_DRAG_PREFIX, clearDrag, dragState } from './dragState'
import s from './builder.module.css'

/** The four free-text columns, in order. Labels are the user-facing names. */
const TEXT_FIELDS = [
  { key: 'discussion', label: 'Discussion' },
  { key: 'assessment', label: 'Assessment' },
  { key: 'video', label: 'Video needs' },
  { key: 'tools', label: 'Tools needed' },
] as const

export function WeekCard({
  index,
  week,
  courseIndex,
  weekIndex,
  placements,
  active,
}: {
  index: CatalogIndex
  week: Week
  courseIndex: number
  weekIndex: number
  placements: PlacementMap
  active: boolean
}) {
  const { canEdit } = useRole()
  const setWeekField = useProgram((st) => st.setWeekField)
  const addLesson = useProgram((st) => st.addLesson)
  const removeLesson = useProgram((st) => st.removeLesson)
  const toggleReviewLesson = useProgram((st) => st.toggleReviewLesson)
  const moveWeek = useProgram((st) => st.moveWeek)

  const over = useUi((u) => u.over)
  const weekDrag = useUi((u) => u.weekDrag)
  const sel = useUi((u) => u.sel)
  const setUi = useUi((u) => u.set)
  const announce = useUi((u) => u.announce)

  const isOver = over === weekIndex && dragState.lessonId !== null
  const isDropBefore = over === weekIndex && dragState.weekIndex !== null
  const isSource = weekDrag === weekIndex

  /* ---------- drop handling ---------- */

  function onDragOver(e: DragEvent) {
    if (!canEdit) return
    // Without preventDefault the browser refuses the drop outright.
    e.preventDefault()
    e.dataTransfer.dropEffect = dragState.weekIndex !== null ? 'move' : 'copy'
    if (over !== weekIndex) setUi('over', weekIndex)
  }

  function onDragLeave() {
    if (over === weekIndex) setUi('over', null)
  }

  function onDrop(e: DragEvent) {
    if (!canEdit) return
    e.preventDefault()
    setUi('over', null)

    // Check the week-reorder state FIRST: a week drag also carries text/plain,
    // and treating it as a lesson id would silently do nothing.
    const from = dragState.weekIndex
    if (from !== null) {
      if (from !== weekIndex) {
        moveWeek(courseIndex, from, weekIndex)
        announce(`Week ${from + 1} moved to position ${weekIndex + 1}.`)
      }
      clearDrag()
      setUi('weekDrag', null)
      return
    }

    const payload = dragState.lessonId ?? e.dataTransfer.getData('text/plain')
    if (!payload || payload.startsWith(WEEK_DRAG_PREFIX)) return
    if (week.lessons.includes(payload)) {
      announce('That lesson is already in this week.')
    } else {
      addLesson(courseIndex, weekIndex, payload)
      announce(`${index.byId.get(payload)?.name ?? 'Lesson'} placed in week ${weekIndex + 1}.`)
    }
    clearDrag()
  }

  /* ---------- keyboard week reorder ---------- */

  function onGripKeyDown(e: React.KeyboardEvent) {
    if (!canEdit || !e.altKey) return
    if (e.key === 'ArrowUp' && weekIndex > 0) {
      e.preventDefault()
      moveWeek(courseIndex, weekIndex, weekIndex - 1)
      announce(`Week moved to position ${weekIndex}.`)
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      moveWeek(courseIndex, weekIndex, weekIndex + 1)
      announce(`Week moved to position ${weekIndex + 2}.`)
    }
  }

  const count = week.lessons.length

  return (
    <section
      className={[
        s.week,
        active && s.weekActive,
        isOver && s.weekDragOver,
        isDropBefore && s.weekDropBefore,
        isSource && s.weekDragSource,
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label={`Week ${weekIndex + 1}${week.module ? `, ${week.module}` : ''}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <header
        className={`${s.weekHead} ${active ? s.weekHeadActive : ''}`}
        draggable={canEdit}
        onDragStart={(e) => {
          if (!canEdit) return
          dragState.weekIndex = weekIndex
          dragState.lessonId = null
          e.dataTransfer.setData('text/plain', `${WEEK_DRAG_PREFIX}${weekIndex}`)
          e.dataTransfer.effectAllowed = 'move'
          setUi('weekDrag', weekIndex)
        }}
        onDragEnd={() => {
          clearDrag()
          setUi('weekDrag', null)
          setUi('over', null)
        }}
      >
        {canEdit && (
          <button
            className={s.grip}
            aria-label={`Reorder week ${weekIndex + 1}. Hold Alt and press the up or down arrow.`}
            onKeyDown={onGripKeyDown}
          >
            <span aria-hidden="true">⠿</span>
          </button>
        )}
        <button
          className={`${s.weekNum} ${active ? s.weekNumActive : ''}`}
          onClick={() => setUi('week', weekIndex)}
          aria-pressed={active}
        >
          Week {weekIndex + 1}
        </button>

        <label className="sr-only" htmlFor={`module-${courseIndex}-${weekIndex}`}>
          Module title for week {weekIndex + 1}
        </label>
        <input
          id={`module-${courseIndex}-${weekIndex}`}
          className={s.moduleInput}
          placeholder="Module title"
          value={week.module}
          readOnly={!canEdit}
          onFocus={() => setUi('week', weekIndex)}
          onChange={(e) => setWeekField(courseIndex, weekIndex, 'module', e.target.value)}
        />

        <span className={s.weekCount}>{count === 0 ? 'empty' : plural(count, 'lesson')}</span>
      </header>

      <div className={s.weekBody}>
        <div className={s.lessonCell}>
          {count === 0 ? (
            <div className={`${s.dropEmpty} ${isOver ? s.dropEmptyActive : ''}`}>
              {isOver ? `Drop to place in week ${weekIndex + 1}` : 'Drag lessons here'}
            </div>
          ) : (
            week.lessons.map((id) => {
              const lesson = index.byId.get(id)
              const elsewhere = (placements.get(id) ?? []).filter(
                (p) => !(p.courseIndex === courseIndex && p.weekIndex === weekIndex),
              )
              const isReview = (week.reviewLessons ?? []).includes(id)
              return (
                <div
                  key={id}
                  className={`${s.lessonChip} ${sel === id ? s.lessonChipSel : ''}`}
                  onClick={() => setUi('sel', id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setUi('sel', id)
                    }
                    if (canEdit && (e.key === 'Delete' || e.key === 'Backspace')) {
                      e.preventDefault()
                      removeLesson(courseIndex, weekIndex, id)
                      announce(`${lesson?.name ?? 'Lesson'} removed from week ${weekIndex + 1}.`)
                    }
                    // R toggles review without leaving the chip, matching the
                    // Delete shortcut already on this element.
                    if (canEdit && (e.key === 'r' || e.key === 'R')) {
                      e.preventDefault()
                      toggleReviewLesson(courseIndex, weekIndex, id)
                      announce(
                        `${lesson?.name ?? 'Lesson'} ${isReview ? 'no longer marked' : 'marked'} as a review lesson.`,
                      )
                    }
                  }}
                >
                  <span className={s.chipName}>{lesson?.name ?? `Unknown lesson ${id}`}</span>
                  {elsewhere[0] && (
                    <span className={s.chipFlag} title="This lesson is placed elsewhere too">
                      {formatElsewhere(elsewhere[0])}
                    </span>
                  )}
                  {/* Viewers see the tag on marked lessons but get no control:
                      a static span, not a button. */}
                  {canEdit ? (
                    <button
                      className={`${s.chipReview} ${isReview ? s.chipReviewOn : ''}`}
                      aria-pressed={isReview}
                      title={isReview ? 'Marked as a review lesson' : 'Mark as a review lesson'}
                      aria-label={`Review lesson: ${lesson?.name ?? 'lesson'}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleReviewLesson(courseIndex, weekIndex, id)
                        announce(
                          `${lesson?.name ?? 'Lesson'} ${isReview ? 'no longer marked' : 'marked'} as a review lesson.`,
                        )
                      }}
                    >
                      Review
                    </button>
                  ) : (
                    isReview && <span className={`${s.chipReview} ${s.chipReviewOn}`}>Review</span>
                  )}
                  {canEdit && (
                    <button
                      className={s.chipX}
                      aria-label={`Remove ${lesson?.name ?? 'lesson'} from week ${weekIndex + 1}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        removeLesson(courseIndex, weekIndex, id)
                        announce(`${lesson?.name ?? 'Lesson'} removed from week ${weekIndex + 1}.`)
                      }}
                    >
                      ×
                    </button>
                  )}
                </div>
              )
            })
          )}
        </div>

        {TEXT_FIELDS.map((f) => (
          <div key={f.key} className={s.textCell}>
            <label className="sr-only" htmlFor={`${f.key}-${courseIndex}-${weekIndex}`}>
              {f.label} for week {weekIndex + 1}
            </label>
            <textarea
              id={`${f.key}-${courseIndex}-${weekIndex}`}
              className={s.cellArea}
              rows={2}
              placeholder="—"
              value={week[f.key]}
              readOnly={!canEdit}
              onFocus={() => setUi('week', weekIndex)}
              onChange={(e) => setWeekField(courseIndex, weekIndex, f.key, e.target.value)}
            />
          </div>
        ))}
      </div>
    </section>
  )
}
