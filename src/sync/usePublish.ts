import { useCallback, useRef, useState } from 'react'
import { useProgram } from '../store/useProgram'
import { useSession } from '../store/useSession'
import { ghLastErrorText } from './github'
import { publish as publishToRepo, pullProgram, type Conflict } from './publish'
import { downloadBlob, safeFileName } from '../export/document'

/**
 * Publish orchestration for the header button.
 *
 * `inFlight` is a ref, not state: without it, pressing Publish while a publish
 * is running starts a second commit chain against the same branch, and the two
 * race. The Playbook hit this exact bug and solved it the same way.
 */
export function usePublish() {
  const [conflicts, setConflicts] = useState<Conflict[] | null>(null)
  const inFlight = useRef(false)

  const setSync = useSession((s) => s.setSync)
  const token = useSession((s) => s.token)

  const run = useCallback(
    async (force: boolean) => {
      if (inFlight.current) return
      const { programs, dirty, baseShas, markPublished } = useProgram.getState()
      if (dirty.length === 0) {
        setSync('ok', 'Nothing to publish')
        return
      }

      inFlight.current = true
      setSync('publishing', `Publishing ${dirty.length}…`)

      try {
        const result = await publishToRepo({ programs, dirty, baseShas, token, force })

        if (result.status === 'ok') {
          markPublished(result.published, result.baseShas)
          setConflicts(null)
          setSync('ok', `Published ${result.published.length}`)
          return
        }
        if (result.status === 'nothing') {
          setSync('ok', 'Nothing to publish')
          return
        }
        if (result.status === 'conflict') {
          setConflicts(result.conflicts)
          setSync('conflict', 'Someone else published first')
          return
        }
        // Partial: whatever landed is no longer dirty; the rest retries later.
        if (result.published.length > 0) markPublished(result.published, result.baseShas)
        setSync('error', `Not published — ${ghLastErrorText()}`)
      } catch {
        setSync('error', 'Not published — unexpected error')
      } finally {
        inFlight.current = false
      }
    },
    [setSync, token],
  )

  const publishNow = useCallback(() => void run(false), [run])
  const overwrite = useCallback(() => void run(true), [run])

  /** Discard local changes to a conflicted program and take the published one. */
  const takeTheirs = useCallback(
    async (programId: string) => {
      const fresh = await pullProgram(programId, token)
      if (!fresh) {
        setSync('error', `Could not reload — ${ghLastErrorText()}`)
        return
      }
      useProgram.getState().replaceProgram(fresh.program, fresh.sha)
      setConflicts((cur) => {
        const next = (cur ?? []).filter((c) => c.programId !== programId)
        return next.length > 0 ? next : null
      })
      setSync('ok', 'Reloaded the published version')
    },
    [token, setSync],
  )

  /** Escape hatch before overwriting: keep a copy of the local version. */
  const downloadMine = useCallback((programId: string) => {
    const program = useProgram.getState().programs.find((p) => p.id === programId)
    if (!program) return
    downloadBlob(
      new Blob([JSON.stringify(program, null, 2)], { type: 'application/json' }),
      `${safeFileName(program.name)}-local-copy.json`,
    )
  }, [])

  return {
    conflicts,
    publishNow,
    overwrite,
    takeTheirs,
    downloadMine,
    dismissConflicts: () => setConflicts(null),
  }
}
