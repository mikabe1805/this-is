/**
 * /i/:uid — the invite link, the magic first-open of the friend graph
 * (v2/FRIENDS.md GTM). Opening a friend's link connects you both: an invite is
 * a mutual follow, so their nights out land in your feed and yours in theirs.
 *
 * Signed out → we show who invited you and sign you in first; the same URL
 * survives the redirect, so the follow lands the moment auth resolves. Signed
 * in → we connect you once (ref-guarded) and drop you on Home, where their
 * saves are already waiting.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from '../state/session'
import { addMutualFollow, fetchUsers } from '../data/user'
import { signIn } from '../lib/authWatch'
import { showToast } from '../state/toast'
import { haptics } from '../lib/haptics'
import { Avatar } from '../components/Avatar'

export default function Invite() {
  const { uid: inviterUid = '' } = useParams<{ uid: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const session = useSession()
  const myUid = session.status === 'signed-in' ? session.user.uid : null
  const isSelf = myUid !== null && myUid === inviterUid

  const { data: inviter } = useQuery({
    queryKey: ['user', inviterUid],
    enabled: Boolean(inviterUid),
    staleTime: 5 * 60_000,
    queryFn: async () => (await fetchUsers([inviterUid]))[0],
  })

  const [status, setStatus] = useState<'idle' | 'connecting' | 'done' | 'error'>('idle')
  const ran = useRef(false)

  const connect = useCallback(() => {
    if (!myUid || !inviterUid || isSelf) return
    setStatus('connecting')
    void addMutualFollow(inviterUid)
      .then(() => {
        haptics.success()
        void qc.invalidateQueries({ queryKey: ['userDoc'] })
        void qc.invalidateQueries({ queryKey: ['friendFeed'] })
        setStatus('done')
      })
      .catch(() => {
        haptics.warn()
        setStatus('error')
      })
  }, [myUid, inviterUid, isSelf, qc])

  // Auto-connect once, as soon as we know who's signed in.
  useEffect(() => {
    if (ran.current || !myUid || isSelf) return
    ran.current = true
    connect()
  }, [myUid, isSelf, connect])

  // Once connected, slip into Home where their rooms are already waiting. The
  // inviter name is read via a ref so a late-arriving profile can't re-run this
  // effect (which would re-toast and reset the redirect countdown).
  const nameRef = useRef('your friend')
  nameRef.current = inviter?.displayName ?? 'your friend'
  useEffect(() => {
    if (status !== 'done') return
    showToast({ kind: 'notice', text: `You and ${nameRef.current} now follow each other.` })
    const t = setTimeout(() => navigate('/home', { replace: true }), 1400)
    return () => clearTimeout(t)
  }, [status, navigate])

  const name = inviter?.displayName ?? 'A friend'
  const hex = inviter?.avatarHex ?? '#8E5A6B'

  if (isSelf) {
    return (
      <div className="page">
        <section className="empty-state invite-scene">
          <p className="eyebrow">YOUR INVITE</p>
          <h1 className="t-display">This one's yours.</h1>
          <p className="t-body">Share this link and whoever opens it sees where you go — and you see them.</p>
          <button
            className="pill pill-primary press"
            onClick={() => { haptics.tap(); navigate('/settings') }}
          >
            Copy it in Settings
          </button>
        </section>
      </div>
    )
  }

  return (
    <div className="page">
      <section className="empty-state invite-scene">
        <Avatar name={name} hex={hex} size={64} />
        <p className="eyebrow invite-eyebrow">{inviter ? `${name.toUpperCase()} INVITED YOU` : 'YOU WERE INVITED'}</p>
        <h1 className="t-display">See where {inviter ? name.split(/\s+/)[0] : 'they'} actually goes.</h1>

        {status === 'done' ? (
          <p className="t-body">Connected. Opening your feed…</p>
        ) : session.status === 'signed-in' ? (
          status === 'error' ? (
            <>
              <p className="t-body">That didn't connect.</p>
              <button className="pill pill-primary press" onClick={() => { haptics.tap(); connect() }}>
                Try again
              </button>
            </>
          ) : (
            <p className="t-body">{status === 'connecting' ? 'Connecting you…' : 'One tap and their rooms are in your feed.'}</p>
          )
        ) : (
          <>
            <p className="t-body invite-sub">
              this.is is a low-lit map of where the people you trust actually go. Sign in and you'll
              follow each other.
            </p>
            <button className="pill pill-primary press" onClick={() => { haptics.tap(); void signIn() }}>
              Continue with Google
            </button>
          </>
        )}
      </section>
    </div>
  )
}
