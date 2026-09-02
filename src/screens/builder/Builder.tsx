import { useEffect, useRef } from 'react'
import type { CatalogIndex } from '../../data/catalog'
import { plural, totalPlaced } from '../../data/derive'
import { useProgram, useActiveProgram } from '../../store/useProgram'
import { useUi } from '../../store/useUi'
import { useSession } from '../../store/useSession'
import { useRole } from '../../auth/RoleContext'
import { Button } from '../../components/ui'
import { exportCsv } from '../../export/csv'
import { exportPdf } from '../../export/pdf'
import { exportWord } from '../../export/word'
import { LessonPanel } from './LessonPanel'
import { CourseGrid } from './CourseGrid'
import { SidePanel } from './SidePanel'
import { ConflictDialog } from './ConflictDialog'
import { usePublish } from '../../sync/usePublish'
import s from './builder.module.css'

/** Screen 2 — the builder. Three columns; both side panels collapse. */
export function Builder({ index }: { index: CatalogIndex }) {
  const program = useActiveProgram()
  const { canEdit, canPublish, role } = useRole()
  const goto = useProgram((st) => st.goto)
  const newProgram = useProgram((st) => st.newProgram)
  const dirty = useProgram((st) => st.dirty)
  const exportOpen = useUi((u) => u.exportOpen)
  const setUi = useUi((u) => u.set)
  const lock = useSession((st) => st.lock)

  const publish = usePublish()
  const menuRef = useRef<HTMLDivElement>(null)
  const exportBtnRef = useRef<HTMLButtonElement>(null)

  // Dropdown: Escape closes and returns focus; an outside click closes.
  useEffect(() => {
    if (!exportOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setUi('exportOpen', false)
        exportBtnRef.current?.focus()
      }
    }
    function onClick(e: MouseEvent) {
      if (
        !menuRef.current?.contains(e.target as Node) &&
        !exportBtnRef.current?.contains(e.target as Node)
      ) {
        setUi('exportOpen', false)
      }
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClick)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onClick)
    }
  }, [exportOpen, setUi])

  if (!program) return null

  const weeks = program.courses[0]?.weeks.length ?? 0
  const isDirty = dirty.includes(program.id)

  function runExport(fn: () => void) {
    setUi('exportOpen', false)
    fn()
  }

  return (
    <div className={s.screen}>
      <a className="skip-link" href="#course-grid">
        Skip to course grid
      </a>

      <header className={`${s.appbar} on-dark`}>
        <span className={s.appTitle}>SDI Program Designer</span>
        {/* The program is what this screen is about, so it is the h1 — the
            panel headings below are h2s and the heading order works out. */}
        <h1 className={s.progName}>{program.name}</h1>
        <span className={s.progMeta}>
          {plural(program.courses.length, 'course')} · {plural(weeks, 'week')} each ·{' '}
          {program.courses.length * program.credits} credits
        </span>

        <div className={s.appbarRight}>
          <span className={s.lessonCount}>{plural(totalPlaced(program), 'lesson')}</span>

          {role === 'viewer' && <span className={s.viewBadge}>View only</span>}

          {canPublish && (
            <Button
              variant={isDirty ? 'primary' : 'onDark'}
              onClick={publish.publishNow}
              disabled={dirty.length === 0}
              title={
                dirty.length === 0
                  ? 'Everything is published'
                  : `Publish ${plural(dirty.length, 'change')} to the content repo`
              }
            >
              {dirty.length === 0 ? 'Published' : `Publish ${dirty.length}`}
            </Button>
          )}

          <Button variant="onDark" onClick={() => goto('map')}>
            Program map
          </Button>
          <Button
            variant="onDark"
            onClick={() => {
              setUi('dbReturn', 'build')
              goto('database')
            }}
          >
            Browse all lessons
          </Button>

          {/* inline-flex is required here: this button sits inside a
              position:relative wrapper and is not blockified by the flex
              container, so without it the control overflows the bar. */}
          <div className={s.exportWrap}>
            <Button
              ref={exportBtnRef}
              variant="onDark"
              aria-haspopup="menu"
              aria-expanded={exportOpen}
              onClick={() => setUi('exportOpen', !exportOpen)}
            >
              Export ▾
            </Button>
            {exportOpen && (
              <div className={s.menu} ref={menuRef} role="menu" aria-label="Export">
                <button
                  className={s.menuItem}
                  role="menuitem"
                  onClick={() => runExport(() => exportWord(index, program))}
                >
                  Word (.doc)
                </button>
                <button
                  className={s.menuItem}
                  role="menuitem"
                  onClick={() => runExport(() => exportCsv(index, program))}
                >
                  Excel (.csv)
                </button>
                <button
                  className={s.menuItem}
                  role="menuitem"
                  onClick={() =>
                    runExport(() => {
                      if (!exportPdf(index, program)) {
                        alert('Your browser blocked the print window. Allow popups and try again.')
                      }
                    })
                  }
                >
                  PDF
                </button>
                <p className={s.menuNote}>CSV is a flat export, not a formatted workbook.</p>
              </div>
            )}
          </div>

          <Button variant="onDark" onClick={newProgram}>
            All programs
          </Button>

          {/* The Playbook keeps a decrypted PAT in localStorage with no way to
              clear it. This is that missing affordance. */}
          {role !== 'local' && (
            <Button variant="onDark" onClick={lock} title="Forget the saved key on this device">
              Lock
            </Button>
          )}
        </div>
      </header>

      <div className={s.body}>
        <LessonPanel index={index} program={program} />
        <main id="course-grid" style={{ flex: 1, minWidth: 0, display: 'flex' }}>
          <CourseGrid index={index} program={program} />
        </main>
        <SidePanel index={index} program={program} />
      </div>

      {canEdit && publish.conflicts && (
        <ConflictDialog
          conflicts={publish.conflicts}
          onTakeTheirs={publish.takeTheirs}
          onDownloadMine={publish.downloadMine}
          onOverwrite={publish.overwrite}
          onDismiss={publish.dismissConflicts}
        />
      )}
    </div>
  )
}
