import { useState, type FormEvent } from 'react'
import { useSession } from '../store/useSession'
import styles from './gate.module.css'

/**
 * The unlock gate.
 *
 * The link carries no credential — only a `#e` or `#v` marker — so this
 * password is what turns a URL into access. The encrypted key file is fetched
 * before the gate renders, which is why a broken deployment can say so up
 * front instead of rejecting every password the user tries.
 */
export function Gate() {
  const role = useSession((s) => s.role)
  const busy = useSession((s) => s.gateBusy)
  const error = useSession((s) => s.gateError)
  const unavailable = useSession((s) => s.gateUnavailable)
  const submitPassword = useSession((s) => s.submitPassword)

  const [password, setPassword] = useState('')

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!password || busy || unavailable) return
    void submitPassword(password)
  }

  const isViewer = role === 'viewer'

  return (
    <div className={styles.overlay}>
      <div className={styles.card}>
        <img
          className={styles.shield}
          src={`${import.meta.env.BASE_URL}assets/logo-shield-black-tan.png`}
          alt=""
        />
        <div className={styles.eyebrow}>SDI Program Designer</div>
        <h1 className={styles.title}>{isViewer ? 'View-only access' : 'Editor access'}</h1>
        <p className={styles.blurb}>
          {isViewer
            ? 'Enter the password you were given to view this curriculum.'
            : 'Enter the editor password to open Program Designer and publish changes.'}
        </p>

        <form onSubmit={onSubmit}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="gate-password">
              Password
            </label>
            <input
              id="gate-password"
              className={styles.input}
              type="password"
              autoComplete="current-password"
              autoFocus
              value={password}
              disabled={Boolean(unavailable) || busy}
              onChange={(e) => setPassword(e.target.value)}
              aria-describedby="gate-message"
              aria-invalid={Boolean(error) || undefined}
            />
          </div>
          <button
            className={styles.submit}
            type="submit"
            disabled={Boolean(unavailable) || busy || !password}
          >
            {busy ? 'Unlocking…' : 'Unlock'}
          </button>
        </form>

        {/* role="status" so the outcome reaches a screen reader without stealing focus */}
        <div
          id="gate-message"
          role="status"
          className={[
            styles.message,
            unavailable ? styles.unavailable : error ? styles.error : '',
          ].join(' ')}
        >
          {unavailable || error || (busy ? 'Checking…' : '')}
        </div>
      </div>
    </div>
  )
}
