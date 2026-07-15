import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createGroupInvite,
  GroupRequestError,
  listGroupInvites,
  revokeGroupInvite,
  watchGroupInviteClosure,
  type CreatorGroupInvite,
} from '../data/groups'
import { haptics } from '../lib/haptics'
import { prototypeFailure } from '../lib/prototypeMode'

type InviteStatus = 'idle' | 'creating' | 'recovered' | 'copied' | 'shared' | 'revoking' | 'revoke-unknown' | 'revoked' | 'closed' | 'capacity' | 'error'

const pendingInviteKey = (groupId: string) => `__this_is_pending_invite:${groupId}`
const pendingInviteRevocationKey = (groupId: string) => `__this_is_pending_invite_revoke:${groupId}`

function recoverInviteCreationKey(groupId: string): string {
  try {
    return window.sessionStorage.getItem(pendingInviteKey(groupId)) ?? crypto.randomUUID()
  } catch {
    return crypto.randomUUID()
  }
}

export function GroupInviteManager(props: {
  groupId: string
  groupName: string
  groupStatus: 'forming' | 'active'
  memberCount: number
  membershipLocked: boolean
  prototype: boolean
}) {
  const { groupId, groupName, groupStatus, memberCount, membershipLocked, prototype } = props
  const [links, setLinks] = useState<CreatorGroupInvite[]>([])
  const [status, setStatus] = useState<InviteStatus>('idle')
  const [actionToken, setActionToken] = useState<string | null>(null)
  const [confirmingToken, setConfirmingToken] = useState<string | null>(null)
  const [uncertainRevocationToken, setUncertainRevocationToken] = useState<string | null>(null)
  const activeTokens = useRef(new Set<string>())
  const revokeTrigger = useRef<HTMLButtonElement | null>(null)
  const revokeSafeAction = useRef<HTMLButtonElement | null>(null)
  const creationKey = useRef(recoverInviteCreationKey(groupId))
  const prototypeRevokedTokens = useRef(new Set<string>())

  const rememberCreationAttempt = () => {
    try { window.sessionStorage.setItem(pendingInviteKey(groupId), creationKey.current) } catch { /* retry remains safe for this mount */ }
  }
  const finishCreationAttempt = () => {
    try { window.sessionStorage.removeItem(pendingInviteKey(groupId)) } catch { /* no durable personal data */ }
    creationKey.current = crypto.randomUUID()
  }

  const mergeLinks = useCallback((incoming: CreatorGroupInvite[]) => {
    setLinks(current => {
      const merged = [...new Map([...current, ...incoming].map(link => [link.token, link])).values()]
        .sort((a, b) => a.expiresAt - b.expiresAt)
      activeTokens.current = new Set(merged.map(link => link.token))
      return merged
    })
  }, [])

  const closeLink = useCallback((token: string) => {
    if (!activeTokens.current.has(token)) return
    activeTokens.current.delete(token)
    setLinks(current => current.filter(link => link.token !== token))
    setConfirmingToken(current => current === token ? null : current)
    setUncertainRevocationToken(current => current === token ? null : current)
    setActionToken(token)
    setStatus('closed')
  }, [])

  useEffect(() => {
    if (prototype || membershipLocked || memberCount >= 6) return
    let cancelled = false
    void listGroupInvites(groupId).then(recovered => {
      if (!cancelled) mergeLinks(recovered)
    }).catch(() => {
      // The group listener owns authorization recovery. A failed convenience
      // listing must not erase a locally created link or group evidence.
    })
    return () => { cancelled = true }
  }, [groupId, memberCount, membershipLocked, mergeLinks, prototype])

  const tokenKey = links.map(link => link.token).join('|')
  useEffect(() => {
    if (prototype || !tokenKey) return
    const stops = links.map(link => watchGroupInviteClosure(link.token, () => closeLink(link.token)))
    return () => stops.forEach(stop => stop())
  // `tokenKey` is the stable subscription identity; depending on `links`
  // would reopen every listener after unrelated copied/shared status changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closeLink, prototype, tokenKey])

  if (membershipLocked || memberCount >= 6) return null

  const makeInvite = async () => {
    if (status === 'creating') return
    setStatus('creating')
    setActionToken(null)
    haptics.tap()
    rememberCreationAttempt()
    try {
      if (prototype && prototypeFailure('invite-capacity')) {
        setStatus('capacity')
        return
      }
      if (prototype && prototypeFailure('invite-create-response')) {
        throw new Error('prototype ambiguous invite response')
      }
      const token = prototype
        ? `prototype-${groupId}-${links.length + 1}`
        : await createGroupInvite(groupId, creationKey.current)
      const alreadyKnown = activeTokens.current.has(token)
      const now = Date.now()
      const invite = { token, createdAt: now, expiresAt: now + 7 * 24 * 60 * 60 * 1000 }
      activeTokens.current.add(token)
      mergeLinks([invite])
      finishCreationAttempt()
      setStatus(alreadyKnown ? 'recovered' : 'idle')
      if (prototype && prototypeFailure('invite-consumed')) {
        window.setTimeout(() => closeLink(token), 0)
      }
      haptics.success()
    } catch (error) {
      haptics.warn()
      setStatus(error instanceof GroupRequestError && error.code === 'invite-capacity-reserved'
        ? 'capacity'
        : 'error')
    }
  }

  const inviteUrl = (token: string) => `${window.location.origin}/gi/${token}`
  const copyInvite = async (token: string) => {
    try {
      await navigator.clipboard.writeText(inviteUrl(token))
      setActionToken(token)
      setStatus('copied')
      haptics.success()
    } catch {
      setActionToken(token)
      setStatus('error')
      haptics.warn()
    }
  }
  const shareInvite = async (token: string) => {
    if (!navigator.share) return
    try {
      await navigator.share({ title: `Join ${groupName} on this.is`, url: inviteUrl(token) })
      setActionToken(token)
      setStatus('shared')
      haptics.success()
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        setActionToken(token)
        setStatus('error')
        haptics.warn()
      }
    }
  }
  const cancelRevocation = () => {
    setConfirmingToken(null)
    window.requestAnimationFrame(() => revokeTrigger.current?.focus())
  }
  const confirmRevocation = async (token: string) => {
    if (status === 'revoking') return
    setActionToken(token)
    setStatus('revoking')
    try {
      if (!prototype) await revokeGroupInvite(token)
      if (prototype && prototypeFailure('invite-revoke-response') && !prototypeRevokedTokens.current.has(token)) {
        prototypeRevokedTokens.current.add(token)
        window.sessionStorage.setItem(pendingInviteRevocationKey(groupId), 'committed')
        throw new Error('prototype ambiguous invite-revocation response')
      }
      activeTokens.current.delete(token)
      setLinks(current => current.filter(link => link.token !== token))
      setUncertainRevocationToken(null)
      if (prototype) window.sessionStorage.removeItem(pendingInviteRevocationKey(groupId))
      setConfirmingToken(null)
      setStatus('revoked')
      haptics.success()
    } catch {
      setUncertainRevocationToken(token)
      setStatus('revoke-unknown')
      window.requestAnimationFrame(() => revokeSafeAction.current?.focus())
      haptics.warn()
    }
  }

  return (
    <section className="group-invite-action" aria-label="Invite links you created">
      <div className="group-invite-summary">
        <p className="eyebrow">ONE LINK · ONE PERSON</p>
        <p className="t-small">Make a separate private link for each person. Each stops working after one person joins and expires in seven days.</p>
      </div>
      {links.map((link, index) => {
        const isActing = actionToken === link.token
        const revocationUnknown = uncertainRevocationToken === link.token
        const label = links.length > 1 ? `Invite link ${index + 1}` : 'Invite link'
        return (
          <div className="group-invite-card" aria-label={`Private invite link ${index + 1}`} key={link.token}>
            <div className="group-invite-card-meta">
              <p className="eyebrow">ONE PERSON · LINK {index + 1}</p>
              <p className="t-small">Expires {new Date(link.expiresAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</p>
            </div>
            {confirmingToken !== link.token && <div className="group-invite-controls">
              {revocationUnknown ? (
                <button
                  ref={element => { if (element) revokeTrigger.current = element }}
                  className="pill pill-primary press"
                  onClick={event => {
                    revokeTrigger.current = event.currentTarget
                    setConfirmingToken(link.token)
                  }}
                >Check link</button>
              ) : (
                <>
                  <button className="pill pill-primary press" onClick={() => void copyInvite(link.token)}>Copy link</button>
                  {typeof navigator.share === 'function' && (
                    <button className="pill pill-ghost press" onClick={() => void shareInvite(link.token)}>Share link</button>
                  )}
                  <button
                    ref={element => { if (element) revokeTrigger.current = element }}
                    className="toast-ghost press group-invite-cancel"
                    aria-label={links.length > 1 ? `Cancel link ${index + 1}` : 'Cancel link'}
                    onClick={event => {
                      revokeTrigger.current = event.currentTarget
                      setConfirmingToken(link.token)
                    }}
                  >Cancel link</button>
                </>
              )}
            </div>}
            {!revocationUnknown && confirmingToken !== link.token && (
              <details className="group-invite-url-disclosure">
                <summary
                  className="press"
                  role="button"
                  aria-label={links.length > 1 ? `Show or hide full invite link ${index + 1}` : 'Show or hide full invite link'}
                >
                  <span className="group-invite-url-closed">Show full link</span>
                  <span className="group-invite-url-open">Hide full link</span>
                  <span className="group-invite-url-mark" aria-hidden>+</span>
                </summary>
                <input className="group-invite-url" aria-label={label} readOnly value={inviteUrl(link.token)} onFocus={event => event.currentTarget.select()} />
              </details>
            )}
            {isActing && status === 'copied' && <p className="t-small" role="status">Copied. Send this link directly to one person.</p>}
            {isActing && status === 'shared' && <p className="t-small" role="status">Shared. Only the first person to use this link can join.</p>}
            {revocationUnknown && confirmingToken !== link.token && (
              <p className="t-small pick-return-error" role="alert">
                We couldn’t confirm whether this invite was revoked. Checking again can only revoke this same link; it cannot restore or replace it.
              </p>
            )}
            {confirmingToken === link.token && (
              <aside
                className="group-invite-revoke-confirm"
                role="alertdialog"
                aria-labelledby={`group-invite-revoke-title-${index}`}
                aria-describedby={`group-invite-revoke-description-${index}`}
                onKeyDown={event => {
                  if (event.key !== 'Escape' || status === 'revoking') return
                  event.preventDefault()
                  cancelRevocation()
                }}
              >
                <div>
                  <h3 id={`group-invite-revoke-title-${index}`} className="t-row-title">Revoke this invite link?</h3>
                  <p id={`group-invite-revoke-description-${index}`} className="t-small">It will stop working immediately. Your group and its current members will not change.</p>
                  {revocationUnknown && (
                    <p className="t-small pick-return-error" role="alert">
                      We couldn’t confirm whether this invite was revoked. Checking again can only revoke this same link; it cannot restore or replace it.
                    </p>
                  )}
                </div>
                <div className="group-invite-controls">
                  <button className="toast-ghost press group-leave-confirm-button" disabled={status === 'revoking'} onClick={() => void confirmRevocation(link.token)}>
                    {status === 'revoking' ? revocationUnknown ? 'Checking…' : 'Revoking…' : revocationUnknown ? 'Check link' : 'Revoke link'}
                  </button>
                  <button ref={revokeSafeAction} className="pill pill-primary press" autoFocus disabled={status === 'revoking'} onClick={cancelRevocation}>{revocationUnknown ? 'Close for now' : 'Keep link'}</button>
                </div>
              </aside>
            )}
          </div>
        )
      })}

      {!confirmingToken && (
        <button
          className={`pill ${status === 'error' && !actionToken ? 'pill-primary' : 'pill-ghost'} press`}
          disabled={status === 'creating'}
          onClick={() => void makeInvite()}
        >
          {status === 'creating'
            ? 'Making link…'
            : status === 'error' && !actionToken
              ? 'Try making link again'
            : links.length > 0
              ? 'Make link for someone else'
              : groupStatus === 'forming' ? 'Make one-person link' : 'Invite one person'}
        </button>
      )}
      {status === 'revoked' && <p className="t-small" role="status">Invite link revoked. Make another only if you still need a seat.</p>}
      {status === 'recovered' && <p className="t-small" role="status">Your earlier link was already made. This retry did not reserve another seat.</p>}
      {status === 'closed' && <p className="t-small" role="status">That invite is no longer active. Make another only if you still need a seat.</p>}
      {status === 'capacity' && <p className="t-small" role="status">Every remaining seat already has a live invite link. Wait for someone to join or for a link to expire.</p>}
      {status === 'error' && (
        <p className="t-small" role="alert">
          {actionToken && links.some(link => link.token === actionToken)
            ? 'That action didn’t work. The link is unchanged; open Show full link if you need to copy it manually.'
            : 'We couldn’t confirm whether the link was made. Trying again won’t reserve another seat.'}
        </p>
      )}
    </section>
  )
}
