import { useEffect, useRef } from 'react'
import type { Conflict } from '../../sync/publish'
import { Button } from '../../components/ui'
import s from './conflict.module.css'

/**
 * Shown when someone else published a program since this browser loaded it.
 *
 * The point of this dialog is that the alternative — the Playbook's behaviour —
 * is a silent overwrite. Nothing has been written to the repo when this
 * appears; the user picks what happens next.
 */
export function ConflictDialog({
  conflicts,
  onTakeTheirs,
  onDownloadMine,
  onOverwrite,
  onDismiss,
}: {
  conflicts: Conflict[]
  onTakeTheirs: (programId: string) => void
  onDownloadMine: (programId: string) => void
  onOverwrite: () => void
  onDismiss: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Move focus into the dialog and keep Escape working.
    ref.current?.querySelector<HTMLElement>('button')?.focus()
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onDismiss()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onDismiss])

  return (
    <div className={s.backdrop}>
      <div
        className={s.dialog}
        ref={ref}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="conflict-title"
        aria-describedby="conflict-desc"
      >
        <h2 className={s.title} id="conflict-title">
          Someone else published first
        </h2>
        <p className={s.desc} id="conflict-desc">
          {conflicts.length === 1
            ? 'This program changed in the content repo after you opened it.'
            : `${conflicts.length} programs changed in the content repo after you opened them.`}{' '}
          Nothing has been overwritten. Choose what to do with each one.
        </p>

        <ul className={s.list}>
          {conflicts.map((c) => (
            <li key={c.programId} className={s.item}>
              <div className={s.itemName}>{c.programName}</div>
              <div className={s.itemActions}>
                <Button onClick={() => onTakeTheirs(c.programId)}>
                  Reload theirs (discard mine)
                </Button>
                <Button variant="ghost" onClick={() => onDownloadMine(c.programId)}>
                  Download my copy
                </Button>
              </div>
            </li>
          ))}
        </ul>

        <div className={s.footer}>
          <Button variant="ghost" onClick={onDismiss}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={onOverwrite}
            title="Publish your version over theirs. Their changes stay in git history."
          >
            Overwrite with mine
          </Button>
        </div>
      </div>
    </div>
  )
}
