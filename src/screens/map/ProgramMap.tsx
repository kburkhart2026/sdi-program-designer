import { useMemo } from 'react'
import type { CatalogIndex } from '../../data/catalog'
import {
  buildPlacements,
  courseColor,
  courseLessonCount,
  coverageFor,
  departmentMix,
  plural,
  totalPlaced,
} from '../../data/derive'
import { useActiveProgram, useProgram } from '../../store/useProgram'
import { Button, Eyebrow, Stat } from '../../components/ui'
import s from './map.module.css'

/**
 * Screen 3 — the program map.
 *
 * A separate screen rather than a print stylesheet over the builder: the
 * audience is a meeting, not a filing cabinet. Navigation is hidden under
 * @media print, so what you see is what prints.
 *
 * Available to viewers unchanged, including print — a dean needs this without
 * edit rights.
 */
export function ProgramMap({ index }: { index: CatalogIndex }) {
  const program = useActiveProgram()
  const goto = useProgram((st) => st.goto)

  const placements = useMemo(() => buildPlacements(program), [program])
  const coverage = useMemo(
    () => (program ? coverageFor(index, placements, program.creds) : []),
    [index, placements, program],
  )
  const mix = useMemo(() => (program ? departmentMix(index, program) : []), [index, program])

  if (!program) return null

  const weeks = program.courses[0]?.weeks.length ?? 0
  const bandColour = courseColor(0)
  const maxDept = mix[0]?.count ?? 1

  return (
    <div className={s.screen}>
      <div className={s.column}>
        <div className={`${s.controls} noprint`}>
          <Button onClick={() => goto('build')}>← Back to builder</Button>
          <Button variant="primary" onClick={() => window.print()}>
            Print
          </Button>
        </div>

        <div className={s.card}>
          <header className={`${s.band} on-dark`} style={{ background: bandColour }}>
            <Eyebrow light>{program.type}</Eyebrow>
            <h1 className={s.progTitle}>{program.name}</h1>
            <div className={s.statRow}>
              <Stat label="Courses" value={program.courses.length} />
              <Stat label={weeks === 1 ? 'Week each' : 'Weeks each'} value={weeks} />
              <Stat label="Credits" value={program.courses.length * program.credits} />
              <Stat label={totalPlaced(program) === 1 ? 'Lesson' : 'Lessons'} value={totalPlaced(program)} />
            </div>
          </header>

          <section className={s.section}>
            <Eyebrow as="h2">Course sequence</Eyebrow>
            <ul className={s.tiles}>
              {program.courses.map((course, i) => (
                <li key={i} className={s.tile}>
                  <div className={s.tileBar} style={{ background: courseColor(i) }}>
                    <span className={s.tileBarLabel}>Course</span>
                    <span className={s.tileBarNum}>{String(i + 1).padStart(2, '0')}</span>
                  </div>
                  <div className={s.tileBody}>
                    <div className={s.tileTitle}>{course.title || 'Untitled course'}</div>
                    <div className={s.tileMeta}>
                      {plural(course.weeks.length, 'week')} ·{' '}
                      {plural(courseLessonCount(program, i), 'lesson')}
                    </div>
                    {course.source && (
                      <div className={s.tileReused}>
                        from {course.source.programName} C{course.source.courseNum}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className={s.section}>
            <Eyebrow as="h2">Credential coverage</Eyebrow>
            {coverage.length === 0 ? (
              <p className={s.quiet}>No credentials are being tracked for this program.</p>
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
                    aria-label={`${c.code}: ${c.placed} of ${c.total} lessons placed`}
                  >
                    <div
                      className={`${s.barFill} ${c.complete ? s.barFillDone : ''}`}
                      style={{ width: `${Math.round(c.ratio * 100)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </section>

          <section className={s.section}>
            <Eyebrow as="h2">Content mix by department</Eyebrow>
            {mix.length === 0 ? (
              <p className={s.quiet}>No lessons have been placed yet.</p>
            ) : (
              mix.map((d) => (
                <div key={d.dept} className={s.bar}>
                  <div className={s.barTop}>
                    <span className={s.barCode}>{d.dept}</span>
                    <span className={s.barRatio}>{d.count}</span>
                  </div>
                  <div
                    className={s.barTrack}
                    role="progressbar"
                    aria-valuenow={d.count}
                    aria-valuemin={0}
                    aria-valuemax={maxDept}
                    aria-label={`${d.dept}: ${plural(d.count, 'lesson')}`}
                  >
                    {/* Scaled to the largest department, not to the total —
                        the comparison that matters is between departments. */}
                    <div
                      className={`${s.barFill} ${s.barFillDept}`}
                      style={{ width: `${Math.round((d.count / maxDept) * 100)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
