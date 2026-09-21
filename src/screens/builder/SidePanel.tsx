import { useMemo, useState } from 'react'
import type { Program } from '../../types/program'
import type { CatalogIndex } from '../../data/catalog'
import { lessonUrl } from '../../data/catalog'
import {
  buildPlacements,
  courseColor,
  coverageFor,
  duplicates,
  formatPlacement,
  overlapFor,
  plural,
} from '../../data/derive'
import { useProgram } from '../../store/useProgram'
import { useUi } from '../../store/useUi'
import { useRole } from '../../auth/RoleContext'
import { Button, Chip, Eyebrow, Rail } from '../../components/ui'
import s from './builder.module.css'

/**
 * Right panel — outcomes, lesson detail, coverage.
 *
 * Shows lesson detail when a lesson is selected, coverage when nothing is.
 */
export function SidePanel({ index, program }: { index: CatalogIndex; program: Program }) {
  const { canEdit } = useRole()
  const sideHidden = useUi((u) => u.sideHidden)
  const courseOpen = useUi((u) => u.courseOpen)
  const sel = useUi((u) => u.sel)
  const courseIndex = useUi((u) => u.course)
  const setUi = useUi((u) => u.set)
  const selectCourse = useUi((u) => u.selectCourse)

  const setPlos = useProgram((st) => st.setPlos)
  const setCourseField = useProgram((st) => st.setCourseField)

  const placements = useMemo(() => buildPlacements(program), [program])
  const course = program.courses[courseIndex]
  const colour = courseColor(courseIndex)

  if (sideHidden) {
    return (
      <Rail
        label="Outcomes & coverage"
        side="right"
        controls="side-panel"
        onExpand={() => setUi('sideHidden', false)}
      />
    )
  }

  return (
    <aside className={s.right} id="side-panel" aria-label="Outcomes and coverage">
      {/* Panel header, mirroring the lesson panel's on the left. The chevron
          points the other way because the panel collapses to the right. */}
      <div className={s.sidePanelHead}>
        <button
          className={s.collapse}
          onClick={() => setUi('sideHidden', true)}
          aria-expanded
          aria-controls="side-panel"
          aria-label="Collapse outcomes and coverage"
          title="Collapse"
        >
          ›
        </button>
        <Eyebrow>Outcomes &amp; coverage</Eyebrow>
      </div>

      {/* ---------- outcomes ---------- */}
      <div className={s.sideSection}>
        <button
          className={s.sideHeadBtn}
          aria-expanded={courseOpen}
          aria-controls="outcomes-body"
          onClick={() => setUi('courseOpen', !courseOpen)}
        >
          <Eyebrow as="h2">Outcomes</Eyebrow>
          <span style={{ marginLeft: 'auto', color: 'var(--gray-500)' }} aria-hidden="true">
            {courseOpen ? '▼' : '▶'}
          </span>
        </button>

        {courseOpen && (
          <div id="outcomes-body">
            <div className={s.field}>
              <div className={s.fieldHead}>
                <label className={s.barCode} htmlFor="plos">
                  Program learning outcomes
                </label>
                <span className={`${s.scopeChip} ${s.scopeChipProgram}`}>Whole program</span>
              </div>
              <textarea
                id="plos"
                className={s.area}
                rows={4}
                placeholder="PLOs for the program — one per line. These stay the same across every course."
                value={program.plos}
                readOnly={!canEdit}
                onChange={(e) => setPlos(e.target.value)}
              />
            </div>

            {course && (
              <>
                <div className={`${s.field} ${s.courseScoped}`} style={{ borderLeftColor: colour }}>
                  <div className={s.fieldHead}>
                    <label className={s.barCode} htmlFor="course-desc">
                      Course description
                    </label>
                    <span className={s.scopeChip} style={{ background: colour }}>
                      Course {courseIndex + 1}
                    </span>
                  </div>
                  <textarea
                    id="course-desc"
                    className={s.area}
                    rows={3}
                    placeholder="What this course covers and what a student can do at the end of it."
                    value={course.description}
                    readOnly={!canEdit}
                    onChange={(e) => setCourseField(courseIndex, 'description', e.target.value)}
                  />
                </div>

                <div className={`${s.field} ${s.courseScoped}`} style={{ borderLeftColor: colour }}>
                  <div className={s.fieldHead}>
                    <label className={s.barCode} htmlFor="course-clo">
                      Course learning outcomes
                    </label>
                    <span className={s.scopeChip} style={{ background: colour }}>
                      Course {courseIndex + 1}
                    </span>
                  </div>
                  <textarea
                    id="course-clo"
                    className={s.area}
                    rows={3}
                    placeholder="CLOs for this course — one per line."
                    value={course.clo}
                    readOnly={!canEdit}
                    onChange={(e) => setCourseField(courseIndex, 'clo', e.target.value)}
                  />
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {sel ? (
        <LessonDetail index={index} program={program} lessonId={sel} />
      ) : (
        <CoveragePanel
          index={index}
          program={program}
          onJump={(courseIdx, lessonId) => {
            selectCourse(courseIdx)
            setUi('sel', lessonId)
          }}
        />
      )}

      {/* Coverage/duplication reporting is what viewers most want, so it is
          never hidden from them — only the editing above is. */}
      {!sel && duplicates(placements).length === 0 && null}
    </aside>
  )
}

/* ---------- lesson detail ------------------------------------------------- */

function LessonDetail({
  index,
  program,
  lessonId,
}: {
  index: CatalogIndex
  program: Program
  lessonId: string
}) {
  const { canEdit } = useRole()
  const placements = useMemo(() => buildPlacements(program), [program])
  const addLesson = useProgram((st) => st.addLesson)
  const toggleReviewLesson = useProgram((st) => st.toggleReviewLesson)
  const courseIndex = useUi((u) => u.course)
  const announce = useUi((u) => u.announce)
  const [targetWeek, setTargetWeek] = useState(0)

  const lesson = index.byId.get(lessonId)
  if (!lesson) return null

  const overlap = overlapFor(placements, lessonId)
  const mine = placements.get(lessonId) ?? []
  const weeks = program.courses[courseIndex]?.weeks.length ?? 0

  return (
    <div className={s.sideSection}>
      <h2 className={s.detailName}>{lesson.name}</h2>
      <div className={s.detailMeta}>
        {lesson.id} · {lesson.dept}
        {lesson.topic && lesson.topic !== lesson.dept ? ` · ${lesson.topic}` : ''}
      </div>
      {lesson.description && <p className={s.detailDesc}>{lesson.description}</p>}

      {overlap && (
        <p
          className={`${s.overlap} ${overlap.sameCourse && !overlap.anyReview ? s.overlapStrong : ''}`}
          role="status"
        >
          Placed {overlap.count} times:{' '}
          {overlap.placements.map((p) => formatPlacement(p)).join(', ')}.{' '}
          {/* Marking a repeat as review IS the user saying the repeat is
              deliberate, so the warning stops arguing with them. */}
          {overlap.anyReview
            ? 'One of these is marked review, so the repeat looks intentional.'
            : overlap.sameCourse
              ? 'Two of these are in the same course — almost certainly a duplicate.'
              : 'Fine if the depth differs between courses.'}
        </p>
      )}

      {/* Review is a property of each PLACEMENT, so a single toggle here would
          be ambiguous for a lesson sitting in several weeks. One row each. */}
      {mine.length > 0 && (
        <div className={s.placementList}>
          <Eyebrow as="h3">{mine.length === 1 ? 'Placement' : 'Placements'}</Eyebrow>
          {mine.map((p) => (
            <div className={s.placementRow} key={`${p.courseIndex}-${p.weekIndex}`}>
              <span className={s.placementWhere}>{formatPlacement(p)}</span>
              {canEdit ? (
                <button
                  className={`${s.chipReview} ${p.review ? s.chipReviewOn : ''}`}
                  style={{ opacity: 1 }}
                  aria-pressed={p.review}
                  onClick={() => {
                    toggleReviewLesson(p.courseIndex, p.weekIndex, lessonId)
                    announce(
                      `${lesson.name} in course ${p.courseIndex + 1} week ${p.weekIndex + 1} ${
                        p.review ? 'no longer marked' : 'marked'
                      } as a review lesson.`,
                    )
                  }}
                >
                  Review
                </button>
              ) : (
                p.review && (
                  <span className={`${s.chipReview} ${s.chipReviewOn}`} style={{ opacity: 1 }}>
                    Review
                  </span>
                )
              )}
            </div>
          ))}
        </div>
      )}

      <Eyebrow as="h3">Counts toward</Eyebrow>
      <div className={s.savedCreds} style={{ display: 'flex', flexWrap: 'wrap', gap: 4, margin: '6px 0 12px' }}>
        {lesson.creds.map((code) => (
          <Chip key={code} tone={program.creds.includes(code) ? 'on' : 'default'}>
            {code}
          </Chip>
        ))}
      </div>

      {/* Keyboard-only placement. Invisible to pointer users — the visual
          "place in week" grid was deliberately removed as redundant with
          drag-and-drop — but native HTML5 drag has no keyboard equivalent,
          so this is how a keyboard user places a lesson. */}
      {canEdit && weeks > 0 && (
        <div className={s.kbdOnly}>
          <label htmlFor="kbd-week">Place in week</label>
          <select
            id="kbd-week"
            className={s.select}
            style={{ width: 'auto' }}
            value={targetWeek}
            onChange={(e) => setTargetWeek(Number(e.target.value))}
          >
            {Array.from({ length: weeks }, (_, i) => (
              <option key={i} value={i}>
                Week {i + 1}
              </option>
            ))}
          </select>
          <Button
            variant="primary"
            onClick={() => {
              addLesson(courseIndex, targetWeek, lessonId)
              announce(`${lesson.name} placed in course ${courseIndex + 1}, week ${targetWeek + 1}.`)
            }}
          >
            Place
          </Button>
        </div>
      )}

      <Button
        variant="primary"
        block
        onClick={() => window.open(lessonUrl(lesson), '_blank', 'noopener')}
      >
        Open on Tooling U
      </Button>
    </div>
  )
}

/* ---------- coverage ------------------------------------------------------- */

function CoveragePanel({
  index,
  program,
  onJump,
}: {
  index: CatalogIndex
  program: Program
  onJump: (courseIndex: number, lessonId: string) => void
}) {
  const placements = useMemo(() => buildPlacements(program), [program])
  const coverage = useMemo(
    () => coverageFor(index, placements, program.creds),
    [index, placements, program.creds],
  )
  const dupes = useMemo(() => duplicates(placements), [placements])

  return (
    <>
      <div className={s.sideSection}>
        <Eyebrow as="h2">Credential coverage</Eyebrow>
        <div style={{ marginTop: 9 }}>
          {program.creds.length === 0 ? (
            <p className={s.quiet}>
              No credential targets were set for this program. Pick lessons freely, or start over to
              add targets.
            </p>
          ) : (
            coverage.map((c) => (
              <div key={c.code} className={s.bar}>
                <div className={s.barTop}>
                  <span className={s.barCode}>{c.code}</span>
                  <span className={s.barRatio}>
                    {c.placed} / {c.total}
                  </span>
                </div>
                <div
                  className={s.barTrack}
                  role="progressbar"
                  aria-valuenow={c.placed}
                  aria-valuemin={0}
                  aria-valuemax={c.total}
                  aria-label={`${c.code} coverage: ${c.placed} of ${c.total} lessons placed`}
                >
                  <div
                    className={`${s.barFill} ${c.complete ? s.barFillDone : ''}`}
                    style={{ width: `${Math.round(c.ratio * 100)}%` }}
                  />
                </div>
                {c.unplaced > 0 && (
                  <div className={s.barNote}>{plural(c.unplaced, 'lesson')} still unplaced</div>
                )}
                {/* The ratio above is unchanged — a review lesson is still
                    taught. This just shows how much of the coverage is
                    refresher rather than new instruction. */}
                {c.reviewOnly > 0 && (
                  <div className={s.barNote}>
                    {c.reviewOnly} of {c.placed} placed {c.reviewOnly === 1 ? 'is' : 'are'} review
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <div className={s.sideSection}>
        <Eyebrow as="h2">Reused across courses</Eyebrow>
        <div style={{ marginTop: 9 }}>
          {dupes.length === 0 ? (
            <p className={s.quiet}>No lesson is placed twice.</p>
          ) : (
            dupes.map((d) => {
              const first = d.placements[0]
              return (
                <button
                  key={d.id}
                  className={s.dupRow}
                  onClick={() => first && onJump(first.courseIndex, d.id)}
                >
                  <span>{index.byId.get(d.id)?.name ?? d.id}</span>
                  <span className={s.dupWhere}>
                    {d.placements.map((p) => formatPlacement(p)).join(' · ')}
                  </span>
                </button>
              )
            })
          )}
        </div>
      </div>
    </>
  )
}
