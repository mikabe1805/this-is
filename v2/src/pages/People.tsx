import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useSession } from '../state/session'
import { useGroups } from '../data/queries'
import { Avatar } from '../components/Avatar'
import { signIn } from '../lib/authWatch'
import { prototypeFailure, prototypeKind } from '../lib/prototypeMode'
import type { GroupCircle } from '../domain/groups'
import { isPermissionDeniedError } from '../domain/dataState'

export default function People() {
  const session = useSession()
  const queryClient = useQueryClient()
  const groupsQuery = useGroups({ freshOnMount: true })
  const myUid = session.status === 'signed-in' ? session.user.uid : ''
  const groupPrototype = prototypeKind() === 'group'
  const prototypeGroupsError = groupPrototype && prototypeFailure('people-permission')
  const groupsError = prototypeGroupsError ? { code: 'permission-denied' } : groupsQuery.error
  // A background failure may keep rendering a previously authorized directory.
  // A cold failure has no evidence that the person has zero groups and must fail closed.
  const groupsLoadFailed = session.status === 'signed-in'
    && Boolean(groupsError)
    && (prototypeGroupsError || groupsQuery.data === undefined)
  const groups = groupsLoadFailed ? [] : groupPrototype
    ? queryClient.getQueryData<GroupCircle[]>(['prototypeGroups']) ?? []
    : groupsQuery.data ?? []
  const groupsReady = !groupsLoadFailed && (groupPrototype || !groupsQuery.isPending)
  const memberships = new Map<string, { groupId: string; groupName: string }[]>()
  const people = new Map<string, { uid: string; displayName: string; avatarHex: string }>()
  for (const group of groups) {
    for (const member of group.members) {
      if (member.uid === myUid) continue
      people.set(member.uid, member)
      const shared = memberships.get(member.uid) ?? []
      shared.push({ groupId: group.id, groupName: group.name })
      memberships.set(member.uid, shared)
    }
  }
  const groupsWaitingForPeople = groups.filter(group =>
    !group.membershipLocked && group.members.length < 6,
  )
  const formingDestinations = groupsWaitingForPeople.length > 0 ? groupsWaitingForPeople : groups
  const retryGroups = () => {
    if (prototypeGroupsError) {
      const next = new URL(window.location.href)
      next.searchParams.delete('failure')
      window.location.assign(next.toString())
      return
    }
    void groupsQuery.refetch()
  }

  return (
    <div className="page people-page">
      <header className="page-header people-header">
        <div>
          <p className="eyebrow">PEOPLE</p>
          <h1 className="t-display">The people in your groups.</h1>
          <p className="t-body people-intro">
            People appear here only through a group you explicitly share.
          </p>
        </div>
        <Link to="/settings" className="pill pill-ghost press">Settings</Link>
      </header>

      {session.status === 'signed-out' && (
        <section className="empty-state">
          <h2 className="t-display">Start with people you trust.</h2>
          <p className="t-body">Sign in to create or join a recurring group.</p>
          <button className="pill pill-primary press" onClick={() => void signIn()}>Continue with Google</button>
        </section>
      )}

      {groupsLoadFailed && (
        <section className="empty-state" role="alert">
          <p className="eyebrow">PRIVATE GROUPS</p>
          <h2 className="t-display">We couldn’t load your people.</h2>
          <p className="t-body">
            {isPermissionDeniedError(groupsError)
              ? 'No group names or membership were shown. Check your account access and try again.'
              : 'Your groups may still be there. Nothing from Keep was changed.'}
          </p>
          <button className="pill pill-primary press" onClick={retryGroups}>Try again</button>
        </section>
      )}

      {session.status === 'signed-in' && groupsReady && groups.length === 0 && (
        <section className="empty-state">
          <h2 className="t-display">Make your first group.</h2>
          <p className="t-body">A group can be two to six people and grows useful from what each person chooses to share.</p>
          <Link to="/groups/new" className="pill pill-primary press">Create a group</Link>
        </section>
      )}

      {session.status === 'signed-in' && groupsReady && groups.length > 0 && people.size === 0 && (
        <section className="people-forming-state" aria-labelledby="people-forming-title">
          <p className="eyebrow">
            {groupsWaitingForPeople.length > 0 ? 'INVITE THE FIRST PERSON' : 'NO OTHER MEMBERS YET'}
          </p>
          <h2 id="people-forming-title" className="t-display">
            {groups.length === 1 ? 'Your group is ready for people.' : 'Your groups are ready for people.'}
          </h2>
          <p className="t-body">
            {groupsWaitingForPeople.length > 0
              ? 'Open a group to make a private, one-person invite link. Nothing from Keep is shared until you choose it.'
              : 'Membership is fixed for now. Open a group to review who can join; nothing from Keep was shared automatically.'}
          </p>
          <nav className="people-forming-links" aria-label="Groups waiting for people">
            {formingDestinations.map(group => (
              <Link key={group.id} to={`/g/${group.id}`} className="people-forming-link press">
                <span>
                  <small className="eyebrow">{group.status === 'forming' ? 'WAITING' : 'OPEN GROUP'}</small>
                  <strong>{group.name}</strong>
                </span>
                <span aria-hidden>→</span>
              </Link>
            ))}
          </nav>
        </section>
      )}

      {session.status === 'signed-in' && people.size > 0 && (
        <ul className="people-directory">
          {[...people.values()].map(person => {
            const shared = [...(memberships.get(person.uid) ?? [])]
              .sort((a, b) => a.groupName.localeCompare(b.groupName) || a.groupId.localeCompare(b.groupId))
            return (
              <li key={person.uid} className="people-card">
                <Avatar name={person.displayName} hex={person.avatarHex} size={48} />
                <div className="people-card-copy">
                  <strong className="t-row-title">{person.displayName}</strong>
                  {shared.length === 1 ? (
                    <Link to={`/g/${shared[0].groupId}`} className="people-group-link press">
                      <span>{shared[0].groupName}</span><span aria-hidden>→</span>
                    </Link>
                  ) : (
                    <details className="people-shared-groups">
                      <summary className="press">{shared.length} shared groups</summary>
                      <nav className="people-group-links" aria-label={`Groups shared with ${person.displayName}`}>
                        {shared.map(item => (
                          <Link key={item.groupId} to={`/g/${item.groupId}`} className="people-group-link press">
                            <span>{item.groupName}</span><span aria-hidden>→</span>
                          </Link>
                        ))}
                      </nav>
                    </details>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
