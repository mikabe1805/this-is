import { useState } from 'react'
import { useSession } from '../state/session'

type AccessAction = 'refresh' | 'sign-out' | null

/** Family-alpha-only shell. It intentionally renders no identity or app data. */
export function FamilyAlphaAccessGate() {
  const session = useSession()
  const [action, setAction] = useState<AccessAction>(null)
  const [actionError, setActionError] = useState(false)
  const checking = session.status === 'unknown' || session.status === 'access-checking'
  const unavailable = session.status === 'access-pending' && session.reason === 'unavailable'

  const refreshAccess = async () => {
    if (action) return
    setAction('refresh')
    setActionError(false)
    try {
      const auth = await import('../lib/authWatch')
      await auth.refreshFamilyAlphaAccess()
    } catch {
      setActionError(true)
    } finally {
      setAction(null)
    }
  }

  const switchAccount = async () => {
    if (action) return
    setAction('sign-out')
    setActionError(false)
    try {
      const auth = await import('../lib/authWatch')
      await auth.signOutUser()
    } catch {
      setActionError(true)
    } finally {
      setAction(null)
    }
  }

  return (
    <section className="family-alpha-access" aria-labelledby="family-alpha-access-title" aria-busy={checking}>
      <div className="family-alpha-access-glow" aria-hidden />
      <div className="family-alpha-access-plaque">
        <span className="family-alpha-access-mark" aria-hidden>this.is</span>
        <p className="eyebrow">PRIVATE FAMILY PREVIEW</p>
        <h1 className="t-display" id="family-alpha-access-title">
          {checking
            ? 'Checking family access.'
            : unavailable
              ? 'We could not confirm this account.'
              : 'This preview is not open for this account yet.'}
        </h1>
        <p className="t-body family-alpha-access-copy">
          {checking
            ? 'Places, groups, and profile details stay closed while this account is checked securely.'
            : unavailable
              ? 'The access check did not finish. Your places and groups stayed closed; try again when you are connected.'
              : 'Ask the person who invited you to approve this Google account. Your places and groups have not been loaded.'}
        </p>
        <p className="t-small family-alpha-access-status" aria-live="polite">
          {checking ? 'Checking securely…' : 'Already approved? Refresh the access token below.'}
        </p>
        {!checking && (
          <div className="family-alpha-access-actions">
            <button
              className="pill pill-primary press"
              disabled={Boolean(action)}
              onClick={() => void refreshAccess()}
            >
              {action === 'refresh' ? 'Checking…' : 'Check again'}
            </button>
            <button
              className="pill pill-ghost press"
              disabled={Boolean(action)}
              onClick={() => void switchAccount()}
            >
              {action === 'sign-out' ? 'Signing out…' : 'Use another account'}
            </button>
          </div>
        )}
        {actionError && (
          <p className="t-small family-alpha-access-error" role="alert">
            That action did not finish. Nothing was opened or changed; please try again.
          </p>
        )}
      </div>
    </section>
  )
}
