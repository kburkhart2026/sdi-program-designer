import { useMemo } from 'react'
import type { CatalogIndex } from '../../data/catalog'
import { plural, totalPlaced } from '../../data/derive'
import { LIMITS, PROGRAM_TYPES, TYPE_PRESETS } from '../../types/program'
import { useProgram } from '../../store/useProgram'
import { useUi } from '../../store/useUi'
import { useRole } from '../../auth/RoleContext'
import { Button, Chip, Eyebrow, Stepper, ToggleChip } from '../../components/ui'
import s from './setup.module.css'

/**
 * Screen 1 — "What are you building?"
 *
 * This screen exists because dropping users into an empty grid left them
 * unable to tell what they were making. Declaring the shape up front means the
 * structure is always visible even before any content is placed.
 *
 * Viewers see the saved-program list and can open any program, but never the
 * form — there is nothing here for them to build.
 */
export function Setup({ index }: { index: CatalogIndex }) {
  const { canEdit } = useRole()
  const setup = useProgram((st) => st.setup)
  const programs = useProgram((st) => st.programs)
  const patchSetup = useProgram((st) => st.patchSetup)
  const setType = useProgram((st) => st.setType)
  const toggleSetupCred = useProgram((st) => st.toggleSetupCred)
  const toggleImportCourse = useProgram((st) => st.toggleImportCourse)
  const setImportAll = useProgram((st) => st.setImportAll)
  const buildScaffold = useProgram((st) => st.buildScaffold)
  const openProgram = useProgram((st) => st.openProgram)
  const deleteProgram = useProgram((st) => st.deleteProgram)

  const openSrc = useUi((u) => u.openSrc)
  const setUi = useUi((u) => u.set)
  const goto = useProgram((st) => st.goto)

  /** Remember where to come back to, so the Database's back button is honest. */
  function openDatabase() {
    setUi('dbReturn', 'setup')
    goto('database')
  }

  const preset = TYPE_PRESETS[setup.type]
  const courses = preset.configurable ? setup.courses : preset.courses
  const weeks = preset.configurable ? setup.weeks : preset.weeks
  const credits = preset.configurable ? setup.credits : preset.credits

  const importedCount = setup.imports.reduce((n, i) => n + i.courseIndexes.length, 0)
  // More courses ticked than the count set: the larger number wins, because
  // silently dropping a course the user explicitly chose would be worse.
  const overflow = importedCount > courses

  const summary = useMemo(() => {
    const effective = Math.max(courses, importedCount)
    const slots = effective * weeks
    const total = effective * credits
    const bits = [
      `${effective} ${effective === 1 ? 'course' : 'courses'} × ${weeks} ${weeks === 1 ? 'week' : 'weeks'} = ${plural(slots, 'module slot')}`,
      `${total % 1 === 0 ? total : total.toFixed(1)} credits`,
      setup.creds.length
        ? `tracking ${plural(setup.creds.length, 'credential')}`
        : 'no credential target',
    ]
    return bits.join(' · ')
  }, [courses, weeks, credits, importedCount, setup.creds.length])

  return (
    <div className={s.screen}>
      <div className={s.column}>
        {/* ---------- masthead ---------- */}
        <div className={`${s.masthead} on-dark`}>
          <img
            className={s.shield}
            src={`${import.meta.env.BASE_URL}assets/logo-shield-black-tan.png`}
            alt=""
          />
          <div>
            <Eyebrow light>SDI Program Designer</Eyebrow>
            <h1 className={s.title}>What are you building?</h1>
          </div>
        </div>

        <div className={`${s.introRow} on-dark`}>
          <p className={s.intro}>
            Set the shape of the program. Program Designer builds the week, module and assessment
            scaffold, then you drag lessons in from the Tooling U–SME database.
          </p>
          <div className={s.introAction}>
            <Button variant="onDark" onClick={openDatabase}>
              Browse all lessons →
            </Button>
          </div>
        </div>

        {/* ---------- form ---------- */}
        {canEdit && (
          <div className={s.form}>
            <div className={s.section}>
              <Eyebrow as="h2" id="setup-name">
                Program name
              </Eyebrow>
              <input
                className={s.nameInput}
                aria-labelledby="setup-name"
                placeholder="e.g. Manufacturing Technology Certificate"
                value={setup.name}
                onChange={(e) => patchSetup({ name: e.target.value })}
              />
            </div>

            {/* A radio-style choice, so it is a real fieldset. <legend> must be
                the fieldset's first child, so it carries the eyebrow style
                directly rather than being wrapped in a heading. */}
            <fieldset className={s.fieldset}>
              <legend className={s.legend}>Program type</legend>
              <div className={s.typeGrid}>
                {PROGRAM_TYPES.map((t) => {
                  const on = setup.type === t
                  return (
                    <button
                      key={t}
                      type="button"
                      aria-pressed={on}
                      className={`${s.typeCard} ${on ? s.typeCardOn : ''}`}
                      onClick={() => setType(t)}
                    >
                      <div className={s.typeLabel}>{t}</div>
                      <div className={s.typeHint}>{TYPE_PRESETS[t].hint}</div>
                    </button>
                  )
                })}
              </div>
            </fieldset>

            {/* Steppers appear for Custom only. Certificate and AS have fixed
                institutional geometry; exposing it invites data-entry errors. */}
            {preset.configurable && (
              <div className={s.section}>
                <Eyebrow as="h2">Program shape</Eyebrow>
                <div className={s.stepperGrid}>
                  <Stepper
                    label="Courses"
                    value={setup.courses}
                    {...LIMITS.courses}
                    onChange={(courses) => patchSetup({ courses })}
                  />
                  <Stepper
                    label="Credits per course"
                    value={setup.credits}
                    {...LIMITS.credits}
                    onChange={(credits) => patchSetup({ credits })}
                  />
                  <Stepper
                    label="Weeks per course"
                    value={setup.weeks}
                    {...LIMITS.weeks}
                    onChange={(weeks) => patchSetup({ weeks })}
                  />
                </div>
                <div className={s.typeHint}>
                  {plural(setup.courses, 'course')} · {plural(setup.weeks, 'week')} each ·{' '}
                  {setup.courses * setup.credits} credits total
                </div>
              </div>
            )}

            {/* Course reuse — only when there is something to reuse. */}
            {programs.length > 0 && (
              <div className={s.section}>
                <Eyebrow as="h2">
                  Build on an existing program <span className={s.optional}>· optional</span>
                </Eyebrow>
                <div className={s.reuseList}>
                  {programs.map((p) => {
                    const expanded = openSrc === p.id
                    const sel = setup.imports.find((i) => i.programId === p.id)?.courseIndexes ?? []
                    return (
                      <div key={p.id} className={s.reuseProgram}>
                        <button
                          type="button"
                          className={s.reuseHead}
                          aria-expanded={expanded}
                          onClick={() => setUi('openSrc', expanded ? null : p.id)}
                        >
                          <span aria-hidden="true">{expanded ? '▼' : '▶'}</span>
                          <span className={s.reuseName}>{p.name}</span>
                          <span className={s.reuseMeta}>
                            {sel.length > 0
                              ? `${sel.length} selected`
                              : plural(p.courses.length, 'course')}
                          </span>
                        </button>
                        {expanded && (
                          <div className={s.reuseBody}>
                            <div className={s.reuseActions}>
                              <Button
                                variant="ghost"
                                onClick={() =>
                                  setImportAll(p.id, p.courses.map((_, i) => i))
                                }
                              >
                                Select all
                              </Button>
                              <Button variant="ghost" onClick={() => setImportAll(p.id, null)}>
                                Clear
                              </Button>
                            </div>
                            {p.courses.map((c, i) => (
                              <label key={i} className={s.reuseCourse}>
                                <input
                                  type="checkbox"
                                  checked={sel.includes(i)}
                                  onChange={() => toggleImportCourse(p.id, i)}
                                />
                                <span className={s.reuseCourseCode}>C{i + 1}</span>
                                <span>{c.title || 'Untitled course'}</span>
                                <span className={s.reuseCount}>
                                  {c.weeks.reduce((n, w) => n + w.lessons.length, 0)}
                                </span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
                {overflow && (
                  <p className={s.overflowNote} role="status">
                    You selected {importedCount} courses but set {courses}. The program will be
                    built with {importedCount} — the larger number wins.
                  </p>
                )}
              </div>
            )}

            <div className={s.section}>
              <Eyebrow as="h2" id="setup-creds">
                Credentials this program should satisfy{' '}
                <span className={s.optional}>· drives coverage and overlap checks</span>
              </Eyebrow>
              <div className={s.credWrap} role="group" aria-labelledby="setup-creds">
                {index.credCodes.map((code) => (
                  <ToggleChip
                    key={code}
                    on={setup.creds.includes(code)}
                    onToggle={() => toggleSetupCred(code)}
                    label={`${code} — ${index.credByCode.get(code)?.title ?? code}`}
                  >
                    {code}
                  </ToggleChip>
                ))}
              </div>
            </div>

            <div className={s.footer}>
              <div className={s.summary} role="status">
                {summary}
              </div>
              <div style={{ marginLeft: 'auto' }}>
                <Button variant="primary" size="lg" onClick={buildScaffold}>
                  Build the scaffold
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ---------- saved programs ---------- */}
        <div className={s.savedHead}>
          <Eyebrow light as="h2">
            Saved programs
          </Eyebrow>
        </div>

        {programs.length === 0 ? (
          <p className={s.emptySaved}>
            {canEdit
              ? 'No programs yet. Set the shape above and build your first scaffold.'
              : 'No programs have been published yet.'}
          </p>
        ) : (
          <ul className={s.savedGrid}>
            {programs.map((p) => {
              const stripe =
                p.type === 'Certificate'
                  ? 'var(--sdi-red)'
                  : p.type === 'Custom'
                    ? 'var(--sdi-tan)'
                    : 'var(--sdi-maroon)'
              return (
                <li key={p.id} className={s.savedCard}>
                  <div className={s.stripe} style={{ background: stripe }} />
                  <div className={s.savedBody}>
                    <Eyebrow>{p.type}</Eyebrow>
                    <h3 className={s.savedName}>
                      <button className={s.savedOpen} onClick={() => openProgram(p.id)}>
                        {p.name}
                      </button>
                    </h3>
                    <div className={s.savedMeta}>
                      {plural(p.courses.length, 'course')} ·{' '}
                      {plural(p.courses[0]?.weeks.length ?? 0, 'week')} each ·{' '}
                      {p.courses.length * p.credits} credits
                    </div>
                    {p.creds.length > 0 && (
                      <div className={s.savedCreds}>
                        {p.creds.map((c) => (
                          <Chip key={c} tone="bone">
                            {c}
                          </Chip>
                        ))}
                      </div>
                    )}
                    {canEdit && (
                      <button
                        className={s.del}
                        aria-label={`Delete ${p.name}`}
                        onClick={() => {
                          if (confirm(`Delete "${p.name}"? This cannot be undone locally.`)) {
                            deleteProgram(p.id)
                          }
                        }}
                      >
                        ×
                      </button>
                    )}
                  </div>
                  <div className={s.savedFooter}>
                    <span>{plural(totalPlaced(p), 'lesson')}</span>
                    <span className={s.savedGo} aria-hidden="true">
                      Open →
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
