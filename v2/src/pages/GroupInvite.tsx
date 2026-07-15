import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { acceptGroupInvite, fetchGroupInvite, GroupRequestError, type GroupInvitePreview } from '../data/groups'
import type { GroupCircle } from '../domain/groups'
import { setSession, useSession } from '../state/session'
import { useUserDoc } from '../data/queries'
import { signIn } from '../lib/authWatch'
import { haptics } from '../lib/haptics'
import { Avatar } from '../components/Avatar'
import { prototypeFailure, prototypeKind } from '../lib/prototypeMode'

function prototypeJoinedGroup(invite: GroupInvitePreview, uid: string, displayName: string): GroupCircle {
  return {
    id: invite.groupId,
    name: invite.groupName,
    status: 'active',
    memberUids: ['group-ari', 'group-vivian', 'group-dev', uid],
    members: [
      { uid: 'group-ari', displayName: 'Ari', avatarHex: '#6B8E5A' },
      { uid: 'group-vivian', displayName: 'Vivian', avatarHex: '#5A6B8E' },
      { uid: 'group-dev', displayName: 'Dev', avatarHex: '#8E7A5A' },
      { uid, displayName, avatarHex: '#8E5A6B' },
    ],
    permissionVersion: 1,
    membershipLocked: false,
    projectionCount: 0,
    tastes: [
      { uid: 'group-ari', name: 'Ari', saves: [] },
      { uid: 'group-vivian', name: 'Vivian', saves: [] },
      { uid: 'group-dev', name: 'Dev', saves: [] },
      { uid, name: displayName, saves: [] },
    ],
    changeLabel: 'You just joined · nothing shared yet',
  }
}

export default function GroupInvite() {
  const { token = '' } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const session = useSession()
  const userQuery = useUserDoc()
  const uid = session.status === 'signed-in' ? session.user.uid : null
  const prototype = prototypeKind() === 'group'
  const prototypeNewRecipient = prototype
    && new URLSearchParams(window.location.search).get('prototypeAuth') === 'invite-new'
  const [status, setStatus] = useState<'idle' | 'joining' | 'error'>('idle')
  const [joinFailure, setJoinFailure] = useState<'unknown' | 'unavailable' | null>(null)
  const prototypeAcceptCommitted = useRef(false)
  const inviteQuery = useQuery({
    queryKey: ['groupInvite', token, uid],
    enabled: Boolean(token),
    staleTime: 5 * 60_000,
    retry: false,
    queryFn: (): Promise<GroupInvitePreview | null> => {
      if (prototypeFailure('invite-read')) return Promise.reject(new Error('prototype invite read failure'))
      if (prototypeFailure('invite-locked')) return Promise.resolve(null)
      return prototype ? Promise.resolve({
          groupId: 'prototype-invite-family',
          groupName: 'Family Sunday',
          invitedBy: 'group-ari',
          inviterName: 'Ari',
          inviterAvatarHex: '#6B8E5A',
          memberCountAtCreation: 3,
          status: prototypeFailure('invite-already-accepted') ? 'accepted' : 'active',
          ...(prototypeFailure('invite-already-accepted') ? { acceptedBy: uid ?? 'group-mika' } : {}),
          expiresAt: { toMillis: () => Date.now() + 7 * 24 * 60 * 60 * 1000 },
        }) : fetchGroupInvite(token)
    },
  })
  const invite = inviteQuery.data
  const profileLoadFailed = Boolean(uid && (userQuery.isError || prototypeFailure('invite-profile')))
  const currentDisplayName = userQuery.data?.displayName
    ?? (session.status === 'signed-in' ? session.user.displayName : null)
    ?? 'Mika'
  const selfInvite = Boolean(uid && invite?.invitedBy === uid)

  useEffect(() => {
    if (!prototype || !uid || invite?.status !== 'accepted' || invite.acceptedBy !== uid) return
    const joinedGroup = prototypeJoinedGroup(invite, uid, currentDisplayName)
    queryClient.setQueryData<GroupCircle[]>(['prototypeGroups'], current => [
      ...(current ?? []).filter(group => group.id !== joinedGroup.id),
      joinedGroup,
    ])
  }, [currentDisplayName, invite, prototype, queryClient, uid])

  const continueWithGoogle = async () => {
    haptics.tap()
    if (!prototypeNewRecipient) {
      await signIn()
      return
    }
    const fixtureUid = 'group-new-recipient'
    queryClient.setQueryData(['userDoc', fixtureUid], {})
    setSession({
      status: 'signed-in',
      user: { uid: fixtureUid, displayName: null, photoURL: null },
    })
  }

  const accept = async () => {
    if (!invite || !uid || status === 'joining') return
    setStatus('joining')
    setJoinFailure(null)
    haptics.tap()
    try {
      const groupId = prototype ? invite.groupId : await acceptGroupInvite(token)
      if (prototype) {
        const alreadyCommitted = prototypeAcceptCommitted.current
        const joinedGroup = prototypeJoinedGroup(invite, uid, currentDisplayName)
        queryClient.setQueryData<GroupCircle[]>(['prototypeGroups'], current => [
          ...(current ?? []).filter(group => group.id !== joinedGroup.id),
          joinedGroup,
        ])
        prototypeAcceptCommitted.current = true
        if (prototypeFailure('invite-accept-response') && !alreadyCommitted) {
          throw new Error('prototype ambiguous acceptance response')
        }
      }
      await queryClient.invalidateQueries({ queryKey: ['groups'] })
      haptics.success()
      navigate(`/g/${groupId}?welcome=1`, { replace: true })
    } catch (error) {
      haptics.warn()
      setJoinFailure(error instanceof GroupRequestError && error.status === 409 ? 'unavailable' : 'unknown')
      setStatus('error')
    }
  }

  if (inviteQuery.isLoading || (uid && userQuery.isLoading && !profileLoadFailed)) {
    return <div className="page"><div className="together-skeleton skeleton" aria-hidden /></div>
  }
  if (inviteQuery.isError) {
    return <div className="page"><section className="empty-state invite-scene" role="alert">
      <p className="eyebrow">LINK CHECK INTERRUPTED</p>
      <h1 className="t-display">We couldn’t check this link.</h1>
      <p className="t-body">The invite may still be active. Check your connection and try again.</p>
      <button className="pill pill-primary press" onClick={() => void inviteQuery.refetch()}>Retry link</button>
      <button className="pill pill-ghost press" onClick={() => navigate('/together')}>Open this.is</button>
    </section></div>
  }
  if (!invite) {
    return <div className="page"><section className="empty-state invite-scene" role="alert">
      <p className="eyebrow">INVITE UNAVAILABLE</p>
      <h1 className="t-display">This group link can’t be opened.</h1>
      <p className="t-body">It may have expired, been used, or the group’s membership may have changed.</p>
      <button className="pill pill-ghost press" onClick={() => navigate('/together')}>Open this.is</button>
    </section></div>
  }

  if (invite.status === 'accepted' && uid && invite.acceptedBy === uid) {
    return <div className="page group-invite-page"><section className="empty-state invite-scene group-invite-scene">
      <Avatar name={invite.inviterName} hex={invite.inviterAvatarHex} size={64} />
      <p className="eyebrow invite-eyebrow">MEMBERSHIP CONFIRMED</p>
      <h1 className="t-display">You already joined {invite.groupName}.</h1>
      <p className="t-body invite-sub">This link’s one seat was accepted by your account. Opening the group will not share anything else from Keep.</p>
      <button
        className="pill pill-primary press"
        onClick={() => navigate(`/g/${invite.groupId}${prototype ? '?prototype=group' : ''}`)}
      >
        Open {invite.groupName}
      </button>
    </section></div>
  }

  return (
    <div className="page group-invite-page"><section className="empty-state invite-scene group-invite-scene">
      <Avatar name={invite.inviterName} hex={invite.inviterAvatarHex} size={64} />
      <p className="eyebrow invite-eyebrow">{invite.inviterName.toUpperCase()} INVITED YOU</p>
      <h1 className="t-display">Join {invite.groupName}.</h1>
      <p className="t-body invite-sub">
        When {invite.inviterName} made this link, {invite.memberCountAtCreation}{' '}
        {invite.memberCountAtCreation === 1 ? 'person was' : 'people were'} in the group. Membership may have changed since then.
        {' '}Joining shares your name and avatar with whoever is there now. Your personal Keep stays private.
      </p>
      <ul className="group-invite-promises" aria-label="What joining shares">
        <li>Nothing is copied from Keep.</li>
        <li>You choose whether to share an exact place or a broad Quick start.</li>
        <li>You can leave later; your personal Keep stays yours.</li>
      </ul>
      {!uid ? (
        <button className="pill pill-primary press" onClick={() => void continueWithGoogle()}>Continue with Google</button>
      ) : selfInvite ? (
        <button className="pill pill-primary press" onClick={() => navigate(`/g/${invite.groupId}`)}>Back to your group</button>
      ) : profileLoadFailed ? (
        <div className="invite-account-recovery" role="alert">
          <p className="t-small">We couldn’t check your account, so joining is paused. No group membership or place sharing changed.</p>
          <button className="pill pill-primary press" onClick={() => void userQuery.refetch()}>Retry account</button>
        </div>
      ) : !userQuery.data?.onboardedAt ? (
        <button className="pill pill-primary press" onClick={() => navigate(`/onboarding?groupInvite=${encodeURIComponent(token)}`)}>
          Set up your name
        </button>
      ) : (
        joinFailure === 'unavailable' ? (
          <button className="pill pill-primary press" onClick={() => navigate('/together')}>Open this.is</button>
        ) : (
          <button className="pill pill-primary press" disabled={status === 'joining'} onClick={() => void accept()}>
            {status === 'joining' ? 'Joining…' : status === 'error' ? 'Check membership' : `Join ${invite.groupName}`}
          </button>
        )
      )}
      {status === 'error' && joinFailure === 'unknown' && <p className="t-small" role="alert">We couldn’t confirm the result. Checking again won’t join you twice or share places.</p>}
      {status === 'error' && joinFailure === 'unavailable' && <p className="t-small" role="alert">This link can no longer add you. No membership or place sharing changed in this attempt.</p>}
      <p className="t-small invite-consent">This private link works once and expires after seven days. Membership is limited to six people.</p>
    </section></div>
  )
}
