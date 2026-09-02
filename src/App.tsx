import { useEffect, useState } from 'react'
import type { Catalog } from './types/catalog'
import type { Program } from './types/program'
import { buildIndex, fetchCatalog, type CatalogIndex } from './data/catalog'
import { loadDrafts } from './sync/local'
import { pullAll } from './sync/publish'
import { isConfigured } from './sync/config'
import { hasPendingSave, useProgram } from './store/useProgram'
import { useSession } from './store/useSession'
import { useUi } from './store/useUi'
import { RoleProvider } from './auth/RoleContext'
import { Gate } from './auth/Gate'
import { Setup } from './screens/setup/Setup'
import { Builder } from './screens/builder/Builder'
import { ProgramMap } from './screens/map/ProgramMap'
import { Database } from './screens/database/Database'
import { Button } from './components/ui'
import s from './app.module.css'

export default function App() {
  const [index, setIndex] = useState<CatalogIndex | null>(null)
  const [catalogError, setCatalogError] = useState('')
  const [booting, setBooting] = useState(true)
  const [attempt, setAttempt] = useState(0)

  const initSession = useSession((st) => st.init)
  const gateOpen = useSession((st) => st.gateOpen)
  const ready = useSession((st) => st.ready)
  const token = useSession((st) => st.token)
  const role = useSession((st) => st.role)
  const sync = useSession((st) => st.sync)
  const syncMessage = useSession((st) => st.syncMessage)
  const setSync = useSession((st) => st.setSync)
  const storageAlarm = useSession((st) => st.storageAlarm)

  const hydrate = useProgram((st) => st.hydrate)
  const hydrated = useProgram((st) => st.hydrated)
  const screen = useProgram((st) => st.screen)
  const announcement = useUi((u) => u.announcement)

  /* --- 1. Work out who this is. Nothing loads until the gate resolves. --- */
  useEffect(() => {
    void initSession()
  }, [initSession])

  /* --- 2. Catalog. Retried by bumping `attempt`. --- */
  useEffect(() => {
    const ac = new AbortController()
    setCatalogError('')
    fetchCatalog(ac.signal)
      .then((catalog: Catalog) => setIndex(buildIndex(catalog)))
      .catch((err: unknown) => {
        if (ac.signal.aborted) return
        setCatalogError(err instanceof Error ? err.message : 'Could not load the lesson catalog.')
      })
    return () => ac.abort()
  }, [attempt])

  /* --- 3. Content: local drafts first, then the content repo. ------------- */
  useEffect(() => {
    if (!ready || hydrated) return
    let cancelled = false

    void (async () => {
      const drafts = await loadDrafts()

      // No repo behind us: local drafts are all there is.
      if (!isConfigured() || !token) {
        if (!cancelled) {
          hydrate({ programs: drafts.programs, baseShas: drafts.baseShas, dirty: drafts.dirty })
          setBooting(false)
        }
        return
      }

      setSync('loading', 'Loading…')
      const remote = await pullAll(token)
      if (cancelled) return

      if (remote.status === 'error') {
        // Fall back to whatever is local rather than showing an empty app —
        // but say so, because publishing from a stale base is how edits get lost.
        hydrate({ programs: drafts.programs, baseShas: drafts.baseShas, dirty: drafts.dirty })
        setSync('error', 'Could not reach the content repo — showing your local copy')
        setBooting(false)
        return
      }

      // Merge: the repo is the truth for anything published, and unpublished
      // local work always survives a reload.
      const merged: Program[] = [...remote.programs]
      for (const id of drafts.dirty) {
        const local = drafts.programs.find((p) => p.id === id)
        if (!local) continue
        const at = merged.findIndex((p) => p.id === id)
        if (at === -1) merged.push(local)
        else merged[at] = local
      }
      merged.sort((a, b) => b.saved - a.saved)

      hydrate({
        programs: merged,
        baseShas: { ...drafts.baseShas, ...remote.baseShas },
        dirty: drafts.dirty,
      })
      setSync(drafts.dirty.length > 0 ? 'idle' : 'ok', drafts.dirty.length > 0 ? '' : 'Up to date')
      setBooting(false)
    })()

    return () => {
      cancelled = true
    }
  }, [ready, hydrated, token, hydrate, setSync])

  /* --- 4. Never lose the last keystroke. ---------------------------------
     beforeunload cannot await IndexedDB and Chrome skips it on tab discard,
     so visibilitychange carries the real work — the page is still alive there,
     so an async write actually completes. */
  useEffect(() => {
    const flush = () => useProgram.getState().flushNow()

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      flush()
      const { dirty } = useProgram.getState()
      // Only warn when unpublished work would be invisible to everyone else.
      if (dirty.length > 0 && useSession.getState().role === 'editor') {
        e.preventDefault()
        e.returnValue = ''
      } else if (hasPendingSave()) {
        e.preventDefault()
        e.returnValue = ''
      }
    }

    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  }, [])

  /* ---------- render ---------- */

  if (gateOpen) {
    return (
      <RoleProvider>
        <Gate />
      </RoleProvider>
    )
  }

  if (catalogError) {
    return (
      <div className={s.boot}>
        <div className={s.bootCard}>
          <h1 className={s.bootTitle}>Lesson catalog unavailable</h1>
          <p className={s.bootText}>{catalogError}</p>
          <Button variant="primary" onClick={() => setAttempt((n) => n + 1)}>
            Try again
          </Button>
        </div>
      </div>
    )
  }

  if (!index || !ready || (booting && !hydrated)) {
    return (
      <div className={s.boot}>
        <div className={s.bootCard}>
          <p className={s.bootText} role="status">
            Loading SDI Program Designer…
          </p>
        </div>
      </div>
    )
  }

  return (
    <RoleProvider>
      {storageAlarm && (
        <div className={s.alarm} role="alert">
          Your edits are <b>not being saved</b> in this browser — its storage is full or blocked.
          Publish now, or export the program, before closing this tab.
        </div>
      )}

      {screen === 'build' ? (
        <Builder index={index} />
      ) : screen === 'map' ? (
        <ProgramMap index={index} />
      ) : screen === 'database' ? (
        <Database index={index} />
      ) : (
        <Setup index={index} />
      )}

      {/* Publish/save state. Failures stay put; successes fade after 2.8s. */}
      {syncMessage && (
        <div
          className={[
            s.toast,
            sync === 'error' || sync === 'conflict' ? s.toastError : '',
            sync === 'ok' ? s.toastOk : '',
          ].join(' ')}
          role="status"
        >
          {syncMessage}
        </div>
      )}

      {role === 'local' && isConfigured() && (
        <div className={s.localNote}>Local drafts only — open an editor link to publish.</div>
      )}

      {/* One polite live region for drops, moves, filters and removals. */}
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>
    </RoleProvider>
  )
}
