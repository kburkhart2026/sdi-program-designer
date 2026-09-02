import { useMemo } from 'react'
import type { Program } from '../../types/program'
import type { CatalogIndex } from '../../data/catalog'
import { buildPlacements, courseColor, courseLessonCount, plural } from '../../data/derive'
import { useProgram } from '../../store/useProgram'
import { useUi } from '../../store/useUi'
import { useRole } from '../../auth/RoleContext'
import { Stat } from '../../components/ui'
import { WeekCard } from './WeekCard'
import s from './builder.module.css'

/**
 * Centre column — course tab strip, course masthead, one column-header row,
 * and the stack of week cards.
 *
 * Course identity is carried by COLOUR: the masthead is filled with the
 * course's colour and the tab strip repeats it as a top border, so the tabs
 * read as a colour key. Users could not otherwise tell whether they were
 * looking at a different course or clicking through weeks of the same one.
 * The zero-padded COURSE number always accompanies it, so identity never
 * depends on colour alone.
 */
export function CourseGrid({ index, program }: { index: CatalogIndex; program: Program }) {
  const { canEdit } = useRole()
  const courseIndex = useUi((u) => u.course)
  const weekIndex = useUi((u) => u.week)
  const selectCourse = useUi((u) => u.selectCourse)
  const setCourseField = useProgram((st) => st.setCourseField)

  const placements = useMemo(() => buildPlacements(program), [program])

  const course = program.courses[courseIndex] ?? program.courses[0]
  if (!course) return null

  const colour = courseColor(courseIndex)
  const weeks = course.weeks.length

  return (
    <div className={s.centre}>
      <nav className={s.tabStrip} aria-label="Courses">
        {program.courses.map((_, i) => (
          <button
            key={i}
            className={`${s.tab} ${i === courseIndex ? s.tabOn : ''}`}
            style={{
              borderTopColor: courseColor(i),
              background: i === courseIndex ? courseColor(i) : undefined,
            }}
            aria-current={i === courseIndex ? 'true' : undefined}
            onClick={() => selectCourse(i)}
          >
            C{i + 1}
          </button>
        ))}
      </nav>

      <header className={`${s.masthead} on-dark`} style={{ background: colour }}>
        <div className={s.mastheadBadge}>
          <span className={s.mastheadBadgeLabel}>Course</span>
          <span className={s.mastheadBadgeNum}>{String(courseIndex + 1).padStart(2, '0')}</span>
        </div>

        <div className={s.mastheadMain}>
          <label className="sr-only" htmlFor="course-title">
            Course {courseIndex + 1} title
          </label>
          <input
            id="course-title"
            className={s.courseTitle}
            placeholder={`Course ${courseIndex + 1}`}
            value={course.title}
            readOnly={!canEdit}
            onChange={(e) => setCourseField(courseIndex, 'title', e.target.value)}
          />
          <div className={s.mastheadMeta}>
            Course {courseIndex + 1} of {program.courses.length} · {plural(weeks, 'week')} ·{' '}
            {program.credits} credits
          </div>
          {course.source && (
            <div className={s.reusedTag}>
              Reused from {course.source.programName} · C{course.source.courseNum}
            </div>
          )}
        </div>

        <div className={s.mastheadStat}>
          <Stat label="Lessons placed" value={courseLessonCount(program, courseIndex)} />
        </div>
      </header>

      {/* Column headers appear once, here — not repeated inside every card. */}
      <div className={s.colHeads} aria-hidden="true">
        <div className={`${s.colHead} ${s.colLesson}`}>Week · module · lessons</div>
        <div className={`${s.colHead} ${s.colText}`}>Discussion</div>
        <div className={`${s.colHead} ${s.colText}`}>Assessment</div>
        <div className={`${s.colHead} ${s.colText}`}>Video needs</div>
        <div className={`${s.colHead} ${s.colText}`}>Tools needed</div>
      </div>

      <div className={s.weekScroll}>
        <div className={s.weekStack}>
          {course.weeks.map((week, i) => (
            <WeekCard
              key={i}
              index={index}
              week={week}
              courseIndex={courseIndex}
              weekIndex={i}
              placements={placements}
              active={i === weekIndex}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
