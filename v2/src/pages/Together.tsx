/**
 * TOGETHER is the front door: recurring groups first, places second. There is
 * no generic discovery feed and no fresh round of voting to manufacture a decision.
 */
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLayoutEffect, useRef, useState } from 'react'
import { useSession } from '../state/session'
import { useCircleUids, useGroups, useUserDoc } from '../data/queries'
import { fetchUsers } from '../data/user'
import { Avatar } from '../components/Avatar'
import { signIn } from '../lib/authWatch'
import { isPermissionDeniedError } from '../domain/dataState'
import type { GroupCircle, GroupSummary } from '../domain/groups'
import { prototypeFailure, prototypeKind } from '../lib/prototypeMode'
import { migratePairToGroup } from '../data/connections'
import type { FriendUser } from '../domain/signals'

const PAIR_MIGRATION_PROTOTYPE_PERSON: FriendUser = {
  uid: 'prototype-pair-sol',
  displayName: 'Sol',
  avatarHex: '#826457',
}
const PAIR_MIGRATION_PROTOTYPE_GROUP_ID = 'prototype-pair-mika-sol'

export default function Together() {
  const session = useSession()
  const myUid = session.status === 'signed-in' ? session.user.uid : null
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const userQuery = useUserDoc()
  const circleQuery = useCircleUids()
  const groupsQuery = useGroups({ freshOnMount: true })
  const userDoc = userQuery.data
  const following = circleQuery.data ?? []
  const peopleQuery = useQuery({
    queryKey: ['followingUsers', following],
    enabled: following.length > 0,
    staleTime: 5 * 60_000,
    queryFn: () => fetchUsers(following),
  })
  const people = peopleQuery.data
  const groupPrototype = prototypeKind() === 'group'
  const prototypeGroups = queryClient.getQueryData<GroupCircle[]>(['prototypeGroups']) ?? []
  const prototypeRefreshError = groupPrototype && prototypeFailure('together-refresh')
  const prototypeLegacyError = groupPrototype && prototypeFailure('together-legacy')
  const prototypePairMigration = groupPrototype && prototypeFailure('pair-migration-response')
  const [pairMigrationFailureUid, setPairMigrationFailureUid] = useState<string | null>(null)
  const pairMigrationRecoveryButtonRef = useRef<HTMLButtonElement>(null)
  const prototypePairMigrationCommitRef = useRef<GroupCircle | null>(null)
  const pairMigration = useMutation({
    mutationFn: async (otherUid: string) => {
      if (!groupPrototype) return migratePairToGroup(otherUid)
      const person = otherUid === PAIR_MIGRATION_PROTOTYPE_PERSON.uid
        ? PAIR_MIGRATION_PROTOTYPE_PERSON
        : null
      const me = prototypeGroups.flatMap(item => item.members)
        .find(member => member.uid === myUid)
      if (!person || !me) throw new Error('pair-unavailable')
      const pairGroup: GroupCircle = prototypePairMigrationCommitRef.current ?? {
        id: PAIR_MIGRATION_PROTOTYPE_GROUP_ID,
        name: `${me.displayName.split(/\s+/)[0]} & ${person.displayName.split(/\s+/)[0]}`,
        status: 'active',
        memberUids: [me.uid, person.uid].sort(),
        members: [me, person].sort((first, second) => first.uid.localeCompare(second.uid)),
        permissionVersion: 1,
        membershipLocked: true,
        projectionCount: 0,
        tastes: [
          { uid: me.uid, name: me.displayName, saves: [] },
          { uid: person.uid, name: person.displayName, saves: [] },
        ],
        changeLabel: 'Moved from one accepted pair',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      if (prototypePairMigration && !prototypePairMigrationCommitRef.current) {
        prototypePairMigrationCommitRef.current = pairGroup
        throw new Error('prototype ambiguous pair-migration response')
      }
      queryClient.setQueryData<GroupCircle[]>(['prototypeGroups'], current =>
        (current ?? []).some(item => item.id === pairGroup.id) ? current : [...(current ?? []), pairGroup])
      return pairGroup.id
    },
    onSuccess: async groupId => {
      setPairMigrationFailureUid(null)
      prototypePairMigrationCommitRef.current = null
      if (!groupPrototype) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['connections'] }),
          queryClient.invalidateQueries({ queryKey: ['groups'] }),
        ])
      }
      navigate(`/g/${groupId}`)
    },
    onError: (_error, otherUid) => {
      setPairMigrationFailureUid(otherUid)
      if (!groupPrototype) {
        void queryClient.invalidateQueries({ queryKey: ['connections'] })
        void queryClient.invalidateQueries({ queryKey: ['groups'] })
      }
    },
  })

  useLayoutEffect(() => {
    if (!pairMigrationFailureUid || pairMigration.isPending) return
    const button = pairMigrationRecoveryButtonRef.current
    if (button && !button.disabled) button.focus()
  }, [pairMigration.isPending, pairMigrationFailureUid])

  if (session.status === 'signed-out') {
    return (
      <div className="page together-page">
        <header className="masthead">
          <h1 className="wordmark">this.is</h1>
          <p className="masthead-sub">Find the place your group has a truthful reason to choose.</p>
        </header>
        <section className="together-hero">
          <p className="eyebrow">PRIVATE TASTE, USEFUL TOGETHER</p>
          <h2 className="t-display">Bring back the places your people already trust.</h2>
          <p className="t-body together-copy">
            Keep places you want, tried, or loved. Invite the two to six people you actually
            plan with. this.is finds exact matches and named member introductions without
            pretending missing taste is agreement.
          </p>
          <button className="pill pill-primary press together-signin" onClick={() => void signIn()}>
            Start with your people
          </button>
        </section>
        <section className="overlap-demo" aria-label="Example group evidence">
          <div className="group-demo-avatars" aria-hidden><span>M</span><span>V</span><span>A</span><span>D</span></div>
          <p className="eyebrow">FAMILY SUNDAY · 4 PEOPLE</p>
          <h3 className="t-display">Ari can introduce the group.</h3>
          <p className="t-small">One person loved it. The other three stay unknown until they weigh in.</p>
        </section>
      </div>
    )
  }

  const clearPrototypeFailure = () => {
    const next = new URL(window.location.href)
    next.searchParams.delete('failure')
    window.location.assign(next.toString())
  }
  const retryGroups = () => {
    if (prototypeRefreshError) clearPrototypeFailure()
    else void groupsQuery.refetch()
  }
  const retryLegacy = () => {
    if (prototypeLegacyError) {
      clearPrototypeFailure()
      return
    }
    void userQuery.refetch()
    void circleQuery.refetch()
    if (following.length) void peopleQuery.refetch()
  }

  if (groupPrototype) return (
    <GroupIndex
      groups={prototypeGroups}
      prototype
      legacyPeople={prototypePairMigration ? [PAIR_MIGRATION_PROTOTYPE_PERSON] : []}
      migratingUid={pairMigration.isPending ? pairMigration.variables : undefined}
      migrationFailureUid={pairMigrationFailureUid}
      onMigrationRecoveryButton={element => { pairMigrationRecoveryButtonRef.current = element }}
      onMigrate={uid => pairMigration.mutate(uid)}
      directoryRefreshError={prototypeRefreshError}
      legacyLoadError={prototypeLegacyError}
      onRetryGroups={retryGroups}
      onRetryLegacy={retryLegacy}
    />
  )

  const groupsColdError = groupsQuery.error && groupsQuery.data === undefined
  if (groupsColdError) {
    const denied = isPermissionDeniedError(groupsQuery.error)
    return (
      <div className="page together-page">
        <header className="masthead">
          <p className="eyebrow">TOGETHER</p>
          <h1 className="wordmark">this.is</h1>
        </header>
        <section className="empty-state" role="alert">
          <h2 className="t-display">We couldn’t load your groups.</h2>
          <p className="t-body">
            {denied
              ? 'No group names, members, or shared taste were shown. Check your account access and try again.'
              : 'Your groups may still be there. Nothing from Keep was changed.'}
          </p>
          <button className="pill pill-primary press" onClick={retryGroups}>Try again</button>
        </section>
      </div>
    )
  }

  const resolved = people ?? []
  const groups = groupsQuery.data ?? []
  const directoryRefreshError = Boolean(groupsQuery.error)
  const legacyLoadError = Boolean(userQuery.error ?? circleQuery.error ?? peopleQuery.error)
  const legacyLoading = userQuery.isPending || circleQuery.isPending ||
    (following.length > 0 && peopleQuery.isPending)

  if (groups.length > 0) return (
    <GroupIndex
      groups={groups}
      legacyPeople={resolved}
      migratingUid={pairMigration.isPending ? pairMigration.variables : undefined}
      onMigrate={uid => pairMigration.mutate(uid)}
      migrationFailureUid={pairMigrationFailureUid}
      onMigrationRecoveryButton={element => { pairMigrationRecoveryButtonRef.current = element }}
      directoryRefreshError={directoryRefreshError}
      legacyLoadError={legacyLoadError}
      onRetryGroups={retryGroups}
      onRetryLegacy={retryLegacy}
    />
  )

  const loading = groupsQuery.isPending || legacyLoading

  return (
    <div className="page together-page">
      <header className="masthead together-masthead">
        <div>
          <p className="eyebrow">TOGETHER</p>
          <h1 className="t-display">Who are we getting together?</h1>
        </div>
        <Link to="/groups/new" className="pill pill-ghost press">New group</Link>
      </header>

      {loading && <div className="together-skeleton skeleton" aria-hidden />}

      {!loading && directoryRefreshError && (
        <TogetherDataWarning kind="groups" onRetry={retryGroups} />
      )}

      {!loading && legacyLoadError && (
        <TogetherDataWarning kind="legacy" onRetry={retryLegacy} />
      )}

      {!loading && resolved.length === 0 && (
        <section className="empty-state together-empty">
          <div className="overlap-orbit is-empty" aria-hidden><span>Y</span><span>+</span></div>
          <h2 className="t-display">Start with someone you trust.</h2>
          <p className="t-body">Group membership is always explicit. Invite someone you actually plan with.</p>
          <Link to="/groups/new" className="pill pill-primary press">Create a group</Link>
        </section>
      )}

      {resolved.length > 0 && (
        <section className="together-list">
          <p className="t-small together-intro">
            These accepted pairs predate groups. Move each one without changing its audience.
          </p>
          {resolved.map(person => {
            const uncertain = pairMigrationFailureUid === person.uid
            const pending = pairMigration.isPending && pairMigration.variables === person.uid
            return (
            <article key={person.uid} className={`together-pair-migration${uncertain ? ' is-uncertain' : ''}`}>
              <div className="together-person">
                <div className="together-avatar-pair" aria-hidden>
                  <Avatar name={userDoc?.displayName ?? 'You'} hex={userDoc?.avatarHex ?? '#8E5A6B'} size={44} />
                  <Avatar name={person.displayName} hex={person.avatarHex} size={44} />
                </div>
                <span className="together-person-copy">
                  <strong className="t-row-title">You &amp; {person.displayName}</strong>
                  <small className="t-small">Existing pair · your audience will not change</small>
                </span>
              </div>
              <button
                ref={uncertain ? pairMigrationRecoveryButtonRef : undefined}
                className="pill pill-ghost press"
                aria-label={uncertain ? `Check group with ${person.displayName}` : undefined}
                disabled={pairMigration.isPending || Boolean(pairMigrationFailureUid && !uncertain)}
                onClick={() => pairMigration.mutate(person.uid)}
              >
                {pending ? (uncertain ? 'Checking…' : 'Moving…') : uncertain ? 'Check group' : 'Make this a 2-person group'}
              </button>
              {uncertain && (
                <p className="t-small pair-migration-recovery" role="alert">
                  We couldn’t confirm whether you and {person.displayName} moved. Checking again can only return the same two-person group; it cannot add people or move private places or notes.
                </p>
              )}
            </article>
            )
          })}
        </section>
      )}
    </div>
  )
}

type GroupIndexItem = GroupSummary | GroupCircle

function groupIndexSummary(group: GroupIndexItem): string {
  if (group.activePick) return `Current Pick · ${group.activePick.label}`
  if (group.recentPick) return `Last Pick · ${group.recentPick.label}`
  if (group.status === 'forming') return 'Waiting for someone to join'
  return group.projectionCount === 0
    ? 'No shared place signals yet'
    : `${group.projectionCount} shared place ${group.projectionCount === 1 ? 'signal' : 'signals'}`
}

function GroupIndex({
  groups,
  prototype = false,
  legacyPeople = [],
  migratingUid,
  onMigrate,
  migrationFailureUid,
  onMigrationRecoveryButton,
  directoryRefreshError = false,
  legacyLoadError = false,
  onRetryGroups,
  onRetryLegacy,
}: {
  groups: GroupIndexItem[]
  prototype?: boolean
  legacyPeople?: FriendUser[]
  migratingUid?: string
  onMigrate?: (uid: string) => void
  migrationFailureUid?: string | null
  onMigrationRecoveryButton?: (element: HTMLButtonElement | null) => void
  directoryRefreshError?: boolean
  legacyLoadError?: boolean
  onRetryGroups?: () => void
  onRetryLegacy?: () => void
}) {
  const orderedGroups = groups.map((group, position) => ({ group, position }))
    .sort((a, b) => Number(Boolean(b.group.activePick)) - Number(Boolean(a.group.activePick)) || a.position - b.position)
  return (
    <div className="page together-page group-index-page">
      <header className="masthead together-masthead">
        <div>
          <p className="eyebrow">TOGETHER</p>
          <h1 className="t-display">Who are we getting together?</h1>
          <p className="t-body together-copy">Open a group to see what its explicitly shared taste can answer now.</p>
        </div>
        <Link to="/groups/new" className="pill pill-ghost press">New group</Link>
      </header>

      <section className="group-index" aria-label="Your groups">
        {orderedGroups.map(({ group }) => (
          <Link
            key={group.id}
            to={`/g/${group.id}`}
            className={`group-index-card press${group.activePick ? ' has-current-pick' : group.status === 'forming' ? ' is-forming' : ' is-active'}`}
          >
            <span className="group-index-copy">
              <strong className="t-display">{group.name}</strong>
              <small className="t-small">{groupIndexSummary(group)}</small>
            </span>
            <span className="group-avatars" aria-label={group.members.map(member => member.displayName).join(', ')}>
              {group.members.map(member => (
                <Avatar key={member.uid} name={member.displayName} hex={member.avatarHex} size={38} />
              ))}
            </span>
            <span className="group-index-arrow" aria-hidden>→</span>
          </Link>
        ))}
      </section>

      {directoryRefreshError && onRetryGroups && (
        <TogetherDataWarning kind="groups" onRetry={onRetryGroups} />
      )}

      {legacyLoadError && onRetryLegacy && (
        <TogetherDataWarning kind="legacy" onRetry={onRetryLegacy} />
      )}

      {legacyPeople.length > 0 && onMigrate && (
        <section className="group-pair-migrations" aria-labelledby="pair-migration-title">
          <p className="eyebrow">EXISTING PAIRS</p>
          <h2 id="pair-migration-title" className="t-row-title">Bring them into Together.</h2>
          <p className="t-small">Each pair becomes a normal two-person group. The audience stays exactly the same; private places and notes do not move.</p>
          {legacyPeople.map(person => {
            const uncertain = migrationFailureUid === person.uid
            const pending = migratingUid === person.uid
            return (
            <article key={person.uid} className={`group-pair-migration-card${uncertain ? ' is-uncertain' : ''}`}>
              <Avatar name={person.displayName} hex={person.avatarHex} size={38} />
              <span>
                <strong className="t-row-title">You &amp; {person.displayName}</strong>
                <small className="t-small">Two people, one ordinary group</small>
              </span>
              <button
                ref={uncertain ? onMigrationRecoveryButton : undefined}
                className="pill pill-ghost press"
                aria-label={uncertain ? `Check group with ${person.displayName}` : undefined}
                disabled={Boolean(migratingUid) || Boolean(migrationFailureUid && !uncertain)}
                onClick={() => onMigrate(person.uid)}
              >
                {pending ? (uncertain ? 'Checking…' : 'Moving…') : uncertain ? 'Check group' : 'Move'}
              </button>
              {uncertain && (
                <p className="t-small pair-migration-recovery" role="alert">
                  We couldn’t confirm whether you and {person.displayName} moved. Checking again can only return the same two-person group; it cannot add people or move private places or notes.
                </p>
              )}
            </article>
            )
          })}
        </section>
      )}

      {prototype && <p className="t-small group-prototype-note">Group study · local fixture only</p>}
    </div>
  )
}

function TogetherDataWarning({
  kind,
  onRetry,
}: {
  kind: 'groups' | 'legacy'
  onRetry: () => void
}) {
  const groups = kind === 'groups'
  return (
    <section className="together-data-warning" role="status">
      <span>
        <small className="eyebrow">{groups ? 'LAST LOADED GROUPS' : 'OLDER PAIRS'}</small>
        <strong className="t-row-title">
          {groups ? 'Group updates couldn’t be checked.' : 'Older pairs couldn’t be checked.'}
        </strong>
        <span className="t-small">
          {groups
            ? 'The groups above are your last authorized copy. Retry before relying on recent membership or Picks.'
            : 'Your current groups are still available. Retry only if you need to move a pre-group connection.'}
        </span>
      </span>
      <button className="pill pill-ghost press" onClick={onRetry}>
        {groups ? 'Check group updates' : 'Check older pairs'}
      </button>
    </section>
  )
}
