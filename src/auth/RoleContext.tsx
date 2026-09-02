import { createContext, useContext, useEffect, type ReactNode } from 'react'
import { useSession, type Role } from '../store/useSession'

/**
 * One `canEdit` boolean, available anywhere without prop-drilling.
 *
 * docs/deployment-and-access.md asks for exactly this: "a single canEdit
 * derived boolean threaded through the component tree (context, not
 * prop-drilling)". Components use it to decide what to *render*; the store's
 * guard() decides what may actually *happen*. Both matter — this one prevents
 * offering an affordance that would silently do nothing.
 */

interface RoleValue {
  role: Role
  canEdit: boolean
  /** Editor with a content repo behind it, so Publish is meaningful. */
  canPublish: boolean
}

const RoleCtx = createContext<RoleValue>({ role: 'local', canEdit: true, canPublish: false })

export function RoleProvider({ children }: { children: ReactNode }) {
  const role = useSession((s) => s.role)
  const token = useSession((s) => s.token)

  const canEdit = role !== 'viewer'
  const canPublish = role === 'editor' && Boolean(token)

  // Layer 3 of the role defence: a body class the stylesheet keys off, so
  // read-only styling never depends on every component remembering to ask.
  useEffect(() => {
    document.body.classList.toggle('view-mode', !canEdit)
    return () => document.body.classList.remove('view-mode')
  }, [canEdit])

  return <RoleCtx.Provider value={{ role, canEdit, canPublish }}>{children}</RoleCtx.Provider>
}

export function useRole(): RoleValue {
  return useContext(RoleCtx)
}

/** Shorthand for the common case. */
export function useCanEdit(): boolean {
  return useContext(RoleCtx).canEdit
}
