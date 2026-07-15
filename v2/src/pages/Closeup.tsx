/** The place sheet: canonical facts, your private signal, exact-group sharing,
 * an optional Pick return, and one logistics handoff to Google Maps. */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getDetails, mapsDeepLink, type PlaceDetails } from '../lib/places'
import { rawPid, type PlaceDoc } from '../data/types'
import { typeLabel } from '../data/vibes'
import { useCatalog, useGroups, useMySaves, useSaveFlow } from '../data/queries'
import { setSaveMemory, setSaveNote, setSaveObservations, setSaveVisibility, type SaveablePlace } from '../data/saves'
import {
  fetchPick,
  fetchPickFromServer,
  PickRequestError,
  pickReceiptUrl,
  revokePickReceipt,
  updatePickStatus,
  watchPick,
} from '../data/picks'
import type { FriendSave, Tag } from '../data/social'
import { isGroupPick, mergePickSnapshot, type Pick, type PickStatus } from '../domain/picks'
import { PickContextChips } from '../components/PickContextChips'
import { useSession } from '../state/session'
import { signIn } from '../lib/authWatch'
import { haptics } from '../lib/haptics'
import {
  isPairPrototype,
  prototypeFailure,
  prototypeActivePickStorageKey,
  prototypeRecentPickStorageKey,
} from '../lib/prototypeMode'
import { PinVisual } from '../components/PinVisual'
import { track } from '../data/analytics'
import {
  fetchGroupAudienceFromServer,
  fetchGroupSignalShareStates,
  GroupRequestError,
  shareSignalWithGroup,
} from '../data/groups'
import { PlaceMemoryConfirmation } from '../components/PlaceMemoryConfirmation'
import { GroupAudienceConfirmation } from '../components/GroupAudienceConfirmation'
import { categoryPrimaryType, type DurablePlaceMemory } from '../domain/placeMemory'
import type { GroupCircle, GroupSummary, RecentGroupPickSummary } from '../domain/groups'
import { usePlacePhoto } from '../lib/usePlacePhoto'
import {
  observationsForGroup,
  PLACE_OBSERVATION_KEYS,
  PLACE_OBSERVATION_LABELS,
  type PlaceObservations,
} from '../domain/placeObservations'
import { PlaceObservationsEditor } from '../components/PlaceObservationsEditor'
import { dismissToast, showToast } from '../state/toast'
import { PRIVATE_PLACE_NOTE_MAX_LENGTH, SHARED_PLACE_NOTE_MAX_LENGTH } from '../domain/signals'
import {
  createGroupKeepShareHandoff,
  readGroupKeepShareHandoff,
} from '../domain/groupKeepBridge'
import { isPermissionDeniedError } from '../domain/dataState'
import { buildGroupAudienceStamp, type GroupAudienceStamp } from '../domain/groupAudience'

const TAGS: Tag[] = ['want', 'tried', 'loved']
type PickCloseStatus = Exclude<PickStatus, 'selected'>
type PickAuthorityStatus = 'checking' | 'server' | 'unavailable'
type GroupShareOperation = 'share' | 'remove' | 'update'
let closeupTargetEpoch = 0

interface GroupShareAttempt {
  groupId: string
  placeId: string
  targetEpoch: number
  operation: GroupShareOperation
  includeNote: boolean
  includeObservations: boolean
  audience?: GroupAudienceStamp
  checkingUnknown?: boolean
}

interface GroupShareOptions {
  includeNote: boolean
  includeObservations: boolean
}

interface GroupShareAudienceReview {
  group: GroupSummary
  attempt: GroupShareAttempt
  changed: boolean
}

interface GroupShareAudienceRefresh {
  attempt: GroupShareAttempt
  status: 'checking' | 'failed'
}

interface KeepTagAttempt {
  place: SaveablePlace
  tag: Tag
  prev: Tag | null
}

interface KeepObservationAttempt {
  observations: PlaceObservations
  previous: PlaceObservations
}

interface PickStatusPresentation {
  eyebrow: string
  title: string
  support?: string
  historyLabel?: string
  contextLabel: string
}

function pickStatusPresentation(pick: Pick): PickStatusPresentation {
  const groupPick = isGroupPick(pick)
  const selectedEyebrow = groupPick
    ? `${pick.groupName.toUpperCase()} \u00b7 ${pick.attendeeUids.length + (pick.guestCount ?? 0)} GOING`
    : `PICKED WITH ${pick.withName.toUpperCase()}`

  if (pick.status === 'selected') {
    return {
      eyebrow: selectedEyebrow,
      title: pick.reason,
      contextLabel: 'Saved plan context',
    }
  }

  if (pick.status === 'visited') {
    return {
      eyebrow: groupPick
        ? `${pick.groupName.toUpperCase()} \u00b7 ${pick.attendeeUids.length + (pick.guestCount ?? 0)} WERE ON THE PLAN`
        : `PICKED WITH ${pick.withName.toUpperCase()} \u00b7 CLOSED`,
      title: groupPick ? 'The group went.' : 'You went together.',
      support: 'Each person chooses Tried or Loved only for their own Keep.',
      historyLabel: 'WHY IT WAS PICKED',
      contextLabel: 'Plan context when picked',
    }
  }

  return {
    eyebrow: groupPick
      ? `${pick.groupName.toUpperCase()} \u00b7 PICK CLOSED`
      : `PICKED WITH ${pick.withName.toUpperCase()} \u00b7 CLOSED`,
    title: 'Not for us.',
    support: "Nobody's Keep changed. Anything you choose below stays only in your Keep.",
    historyLabel: 'WHY IT HAD BEEN CONSIDERED',
    contextLabel: 'Plan context when considered',
  }
}

class KeepNoteCommitUnconfirmed extends Error {
  constructor(readonly note: string) {
    super('Keep note response was not confirmed')
  }
}

/**
 * Remount per place: keying on placeId gives each spot page its own component
 * instance, so the note refs below belong to exactly one place—navigating
 * /p/A → /p/B can never flush A's note against B.
 */
export default function Closeup() {
  const { placeId } = useParams<{ placeId: string }>()
  return <CloseupView key={placeId ?? ''} />
}

function CloseupView() {
  const { placeId } = useParams<{ placeId: string }>()
  const id = placeId ?? ''
  const closeupTargetIdentityRef = useRef<{ placeId: string; epoch: number; active: boolean } | null>(null)
  if (!closeupTargetIdentityRef.current) {
    closeupTargetIdentityRef.current = { placeId: id, epoch: ++closeupTargetEpoch, active: true }
  }
  const closeupTargetMatches = (attempt: { placeId: string; targetEpoch: number }) => {
    const current = closeupTargetIdentityRef.current
    return Boolean(current?.active && current.placeId === attempt.placeId && current.epoch === attempt.targetEpoch)
  }
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const [params, setParams] = useSearchParams()
  const session = useSession()
  useLayoutEffect(() => {
    if (closeupTargetIdentityRef.current) closeupTargetIdentityRef.current.active = true
    return () => {
      if (closeupTargetIdentityRef.current) closeupTargetIdentityRef.current.active = false
    }
  }, [])
  const myUid = session.status === 'signed-in' ? session.user.uid : null
  const pickId = params.get('pick')
  const prototype = isPairPrototype()
  const prototypeMemoryError = prototype && prototypeFailure('closeup-memory')
  const prototypePickError = prototype && prototypeFailure('closeup-pick')
  const pickAuthorityIdentity = `${myUid ?? ''}:${pickId ?? ''}`
  const pickQueryKey = useMemo(() => ['pick', pickId, myUid] as const, [myUid, pickId])
  const pickAuthorityIdentityRef = useRef(pickAuthorityIdentity)
  const pickAuthorityRevisionRef = useRef(0)
  const lastAuthoritativeTerminalRef = useRef<string | null>(null)
  if (pickAuthorityIdentityRef.current !== pickAuthorityIdentity) {
    pickAuthorityIdentityRef.current = pickAuthorityIdentity
    pickAuthorityRevisionRef.current += 1
    lastAuthoritativeTerminalRef.current = null
  }
  const [pickAuthority, setPickAuthority] = useState<{
    identity: string
    status: PickAuthorityStatus
    pickStatus?: PickStatus
  }>(() => ({
    identity: pickAuthorityIdentity,
    status: prototype || !pickId || !myUid ? 'server' : 'checking',
  }))
  const authorityStatus = prototype || !pickId || !myUid
    ? 'server'
    : pickAuthority.identity === pickAuthorityIdentity
      ? pickAuthority.status
      : 'checking'
  const setCurrentPickAuthority = (
    identity: string,
    status: PickAuthorityStatus,
    pickStatus?: PickStatus,
  ) => {
    if (pickAuthorityIdentityRef.current === identity) {
      setPickAuthority({ identity, status, ...(pickStatus ? { pickStatus } : {}) })
    }
  }

  const catalogQuery = useCatalog()
  const groupsQuery = useGroups()
  const savesQuery = useMySaves()
  const catalog = catalogQuery.data
  const saves = prototypeMemoryError
    ? undefined
    : savesQuery.data?.filter(save => save.placeId === id)
  const { setTag, unsave, invalidate } = useSaveFlow()
  const pickQuery = useQuery({
    queryKey: pickQueryKey,
    queryFn: async () => {
      const expectedIdentity = `${myUid ?? ''}:${pickId ?? ''}`
      const expectedRevision = pickAuthorityRevisionRef.current
      if (prototype) return fetchPick(pickId!)
      setCurrentPickAuthority(expectedIdentity, 'checking')
      try {
        const next = await fetchPickFromServer(pickId!)
        if (
          pickAuthorityIdentityRef.current !== expectedIdentity
          || pickAuthorityRevisionRef.current !== expectedRevision
        ) {
          return queryClient.getQueryData<Pick | null>(pickQueryKey) ?? null
        }
        if (!next) {
          pickAuthorityRevisionRef.current += 1
          queryClient.setQueryData<Pick | null>(pickQueryKey, null)
          setCurrentPickAuthority(expectedIdentity, 'unavailable')
          return null
        }
        setCurrentPickAuthority(expectedIdentity, 'server', next.status)
        return mergePickSnapshot(
          queryClient.getQueryData<Pick | null>(pickQueryKey),
          next,
          true,
        )
      } catch (error) {
        if (
          pickAuthorityIdentityRef.current !== expectedIdentity
          || pickAuthorityRevisionRef.current !== expectedRevision
        ) {
          return queryClient.getQueryData<Pick | null>(pickQueryKey) ?? null
        }
        if (isPermissionDeniedError(error)
          || (error instanceof PickRequestError && error.code === 'invalid-pick-id')) {
          pickAuthorityRevisionRef.current += 1
          queryClient.setQueryData<Pick | null>(pickQueryKey, null)
          setCurrentPickAuthority(expectedIdentity, 'unavailable')
        }
        throw error
      }
    },
    enabled: Boolean(pickId) && Boolean(myUid),
    staleTime: prototype ? Infinity : 0,
    refetchOnMount: prototype ? undefined : 'always',
    refetchOnWindowFocus: prototype ? false : 'always',
  })
  const pick = prototypePickError ? undefined : pickQuery.data
  const pickActionsAuthoritative = Boolean(pick) && (
    prototype
    || (authorityStatus === 'server' && pickAuthority.pickStatus === pick?.status)
  )
  const pickAuthorityUnavailable = authorityStatus === 'unavailable'

  useEffect(() => {
    if (pickActionsAuthoritative) return
    setConfirmingDismiss(false)
    setConfirmingReceiptRevocation(false)
  }, [pickActionsAuthoritative])

  useEffect(() => {
    if (prototype || !pickId || !myUid) return
    const expectedIdentity = `${myUid}:${pickId}`
    return watchPick(pickId, update => {
      if (pickAuthorityIdentityRef.current !== expectedIdentity) return
      if (!update.pick) {
        if (update.serverAuthoritative) {
          pickAuthorityRevisionRef.current += 1
          queryClient.setQueryData<Pick | null>(pickQueryKey, null)
          setCurrentPickAuthority(expectedIdentity, 'unavailable')
        } else {
          setCurrentPickAuthority(expectedIdentity, 'checking')
        }
        return
      }
      const previous = queryClient.getQueryData<Pick | null>(pickQueryKey)
      // Firestore's origin-persistent cache can outlive an account. A cached
      // listener snapshot may refine only an existing uid-scoped in-memory
      // Pick; it can never seed a newly signed-in account's empty query.
      if (update.serverAuthoritative || previous) {
        if (update.serverAuthoritative) pickAuthorityRevisionRef.current += 1
        queryClient.setQueryData<Pick | null>(pickQueryKey, current =>
          mergePickSnapshot(current, update.pick!, update.serverAuthoritative))
      }
      setCurrentPickAuthority(
        expectedIdentity,
        update.serverAuthoritative ? 'server' : 'checking',
        update.serverAuthoritative ? update.pick.status : undefined,
      )
      if (update.serverAuthoritative && update.pick.status === 'selected') {
        lastAuthoritativeTerminalRef.current = null
      }
      const authoritativeTerminalKey = update.serverAuthoritative && update.pick.status !== 'selected'
        ? `${expectedIdentity}:${update.pick.status}:${update.pick.updatedAt}`
        : null
      if (
        authoritativeTerminalKey
        && lastAuthoritativeTerminalRef.current !== authoritativeTerminalKey
        && isGroupPick(update.pick)
      ) {
        lastAuthoritativeTerminalRef.current = authoritativeTerminalKey
        setPickCloseFailure(null)
        setConfirmingDismiss(false)
        setConfirmingReceiptRevocation(false)
        void queryClient.invalidateQueries({ queryKey: ['groups'] })
        void queryClient.invalidateQueries({ queryKey: ['group', update.pick.groupId] })
      }
    }, error => {
      if (pickAuthorityIdentityRef.current !== expectedIdentity) return
      if (isPermissionDeniedError(error)
        || (error instanceof PickRequestError && error.code === 'invalid-pick-id')) {
        pickAuthorityRevisionRef.current += 1
        queryClient.setQueryData<Pick | null>(pickQueryKey, null)
        setCurrentPickAuthority(expectedIdentity, 'unavailable')
      } else {
        setCurrentPickAuthority(expectedIdentity, 'checking')
      }
    })
  }, [myUid, pickId, pickQueryKey, prototype, queryClient])

  const pickMemory = pick && isGroupPick(pick) && pick.placeId === id
    ? pick.memory
    : undefined
  const pickLookupRequired = Boolean(pickId) && Boolean(myUid)
  const personalLookupError = prototypeMemoryError ? { code: 'permission-denied' } : savesQuery.error
  const pickLookupError = prototypePickError ? { code: 'permission-denied' } : pickQuery.error
  const personalDataUnavailable = Boolean(
    myUid && personalLookupError && (prototypeMemoryError || savesQuery.data === undefined),
  )
  const pickDataUnavailable = Boolean(
    pickLookupRequired && (
      pickAuthorityUnavailable
      || (pickLookupError && (prototypePickError || pickQuery.data === undefined))
    ),
  )
  // A valid Pick carries enough authorized place memory to keep the shared plan usable even when
  // only this attendee's private Keep lookup failed. Without that Pick memory, fail closed before
  // any provider fallback can misstate a data error as a missing place.
  const placeLookupFailed = pickDataUnavailable || (personalDataUnavailable && !pickMemory)

  const mySave = saves?.find(save => save.uid === myUid)
  const myMemory = mySave?.memory
  const catalogThis = catalog?.find(c => c.id === id)
  const savedPlace = saves?.find(save => save.place)?.place
  const resolvedSnapshot = pickMemory
    ? {
        name: pickMemory.label,
        primaryType: categoryPrimaryType(pickMemory.category),
        neighborhood: pickMemory.area,
        hex: pickMemory.hex,
        coordsFetchedAt: undefined,
      }
    : myMemory
    ? {
        name: myMemory.label,
        primaryType: categoryPrimaryType(myMemory.category),
        neighborhood: myMemory.area,
        hex: myMemory.hex,
        coordsFetchedAt: undefined,
      }
    : catalogThis
      ? {
          name: catalogThis.name,
          primaryType: catalogThis.primaryType,
          neighborhood: catalogThis.neighborhood,
          hex: catalogThis.photoHex,
          lat: catalogThis.lat,
          lng: catalogThis.lng,
          coordsFetchedAt: catalogThis.coordsFetchedAt,
        }
    : savedPlace
      ? { ...savedPlace, coordsFetchedAt: undefined }
      : null
  const snapshot = placeLookupFailed ? null : resolvedSnapshot
  const lookupReady = !placeLookupFailed && (prototype ||
    ((catalogQuery.isSuccess || catalogQuery.isError) &&
      (!myUid || savesQuery.isSuccess)))
  // A Pick URL must not fall through to paid Details while auth is still unknown.
  // Once auth settles signed-out it may behave like an ordinary place URL; a
  // signed-in attendee waits for the authorized Pick memory first.
  const pickLookupReady = !pickId
    || session.status === 'signed-out'
    || (session.status === 'signed-in' && pickQuery.isSuccess)

  // A Pick already carries its chosen durable memory. Wait for that authorized
  // lookup before considering an explicit Details call for an otherwise unknown place.
  const detailsQuery = useQuery({
    queryKey: ['placeDetails', id, 'full'],
    queryFn: async (): Promise<Partial<PlaceDetails> | null> =>
      getDetails(rawPid(id)),
    staleTime: Infinity,
    enabled: Boolean(id) && !placeLookupFailed && lookupReady && pickLookupReady && !prototype && !snapshot,
  })
  const details = detailsQuery.data
  const detailsResolved = Boolean(snapshot) ||
    (lookupReady && pickLookupReady && (prototype || detailsQuery.isSuccess || detailsQuery.isError))
  const placeUnavailable = !placeLookupFailed && !snapshot && !details && !saves?.length && lookupReady && detailsResolved
  const placeLoading = !placeLookupFailed && !snapshot && !details && !placeUnavailable

  const name = snapshot?.name ?? details?.name ?? (saves?.length ? 'Saved place' : '')
  const hex = snapshot?.hex ?? '#3A2B31'
  const primaryType = snapshot?.primaryType ?? details?.primaryType
  const neighborhood = snapshot?.neighborhood
  const chip = [typeLabel(primaryType), neighborhood]
    .filter(Boolean)
    .join(' · ')
  const photo = usePlacePhoto(id, Boolean(mySave))
  const myTag = mySave?.tag
  const visibility = mySave?.visibility ?? 'private'
  const isPickAttendee = Boolean(pick && (!isGroupPick(pick) || (myUid && pick.attendeeUids.includes(myUid))))
  const hasOpenPick = Boolean(pick && pick.placeId === id && pick.status === 'selected')
  const pickPresentation = pick ? pickStatusPresentation(pick) : null
  const receiptToken = pick && isGroupPick(pick) && pick.shareToken
    && Date.now() < pick.createdAt + 30 * 24 * 60 * 60 * 1000
    ? pick.shareToken
    : null
  const prototypeGroups = prototype
    ? queryClient.getQueryData<GroupCircle[]>(['prototypeGroups']) ?? []
    : []
  const activeGroups = (prototype ? prototypeGroups : groupsQuery.data ?? [])
    .filter(group => group.status === 'active')
  const activeGroupIds = activeGroups.map(group => group.id)
  const rawRouteState = location.state && typeof location.state === 'object'
    ? location.state as Record<string, unknown>
    : null
  const groupKeepShareHandoff = readGroupKeepShareHandoff(rawRouteState)
  // Existing lost-response recovery passes only `checkGroupShare`; retain that
  // exact-row focus without granting it the new automatic return behavior.
  const checkGroupShareId = groupKeepShareHandoff?.checkGroupShare
    ?? createGroupKeepShareHandoff(rawRouteState?.checkGroupShare)?.checkGroupShare
  const groupDirectoryPending = !prototype && groupsQuery.isPending
  const groupDirectoryUnavailable = !prototype
    && Boolean(groupsQuery.error && groupsQuery.data === undefined)
  const shareStatesQuery = useQuery({
    queryKey: ['groupSignalShareStates', myUid, id, activeGroupIds],
    enabled: !prototype && Boolean(myUid) && Boolean(mySave) && activeGroupIds.length > 0,
    staleTime: 30_000,
    queryFn: () => fetchGroupSignalShareStates(activeGroupIds, myUid!, id),
  })
  const [note, setNote] = useState(mySave?.note ?? '')
  const [noteChecking, setNoteChecking] = useState(false)
  const noteDirty = useRef(false)
  const noteRef = useRef<HTMLTextAreaElement>(null)
  const noteCommitRef = useRef<Promise<FriendSave | null> | null>(null)
  const savedNote = mySave?.note ?? ''
  useEffect(() => { if (!noteDirty.current) setNote(savedNote) }, [savedNote])
  useEffect(() => { if (params.get('note') === '1') noteRef.current?.focus() }, [params])
  const commitNote = (): Promise<FriendSave | null> => {
    if (noteCommitRef.current) return noteCommitRef.current
    if (!mySave || !noteDirty.current) return Promise.resolve(mySave ?? null)
    const trimmed = note.trim()
    if (trimmed === (mySave.note ?? '')) {
      noteDirty.current = false
      return Promise.resolve(mySave)
    }
    noteDirty.current = false
    const updated = { ...mySave, note: trimmed }
    setNoteChecking(true)
    const commit = setSaveNote(id, trimmed)
      .then(() => {
        if (prototype && prototypeFailure('keep-note-response') && !prototypeNoteResponseLostRef.current) {
          prototypeNoteResponseLostRef.current = true
          throw new KeepNoteCommitUnconfirmed(trimmed)
        }
        const update = (current: FriendSave[] | undefined) =>
          (current ?? []).map(save => save.uid === myUid && save.placeId === id ? updated : save)
        queryClient.setQueryData<FriendSave[]>(['mySaves', myUid], update)
        queryClient.setQueriesData<FriendSave[]>({ queryKey: ['placeSaves', id] }, update)
        if (prototype && myUid) {
          queryClient.setQueryData<GroupCircle[]>(['prototypeGroups'], current => (current ?? []).map(group => ({
            ...group,
            tastes: group.tastes.map(taste => taste.uid !== myUid ? taste : {
              ...taste,
              saves: taste.saves.map(save => {
                if (save.placeId !== id || save.note === undefined) return save
                const projected = { ...save }
                if (trimmed) projected.note = trimmed
                else delete projected.note
                return projected
              }),
            }),
          })))
        }
        setKeepNoteFailure(null)
        if (!prototype) invalidate()
        return updated
      })
      .catch(() => {
        noteDirty.current = false
        setNote(trimmed)
        dismissToast()
        setKeepNoteFailure({ note: trimmed })
        throw new KeepNoteCommitUnconfirmed(trimmed)
      })
      .finally(() => {
        noteCommitRef.current = null
        setNoteChecking(false)
      })
    noteCommitRef.current = commit
    return commit
  }
  const latest = useRef({ has: Boolean(mySave), note })
  latest.current = { has: Boolean(mySave), note }
  useEffect(() => () => {
    const { has, note: latestNote } = latest.current
    if (has && noteDirty.current) void setSaveNote(id, latestNote)
  }, [id])
  const [groupShareOptions, setGroupShareOptions] = useState<Record<string, GroupShareOptions>>({})
  const [legacyVisibilityFailure, setLegacyVisibilityFailure] = useState(false)
  const [keepTagFailure, setKeepTagFailure] = useState<KeepTagAttempt | null>(null)
  const [keepRemovalFailure, setKeepRemovalFailure] = useState<string | null>(null)
  const [keepMemoryFailure, setKeepMemoryFailure] = useState<DurablePlaceMemory | null>(null)
  const [keepNoteFailure, setKeepNoteFailure] = useState<{ note: string } | null>(null)
  const [keepObservationFailure, setKeepObservationFailure] = useState<KeepObservationAttempt | null>(null)
  const [pendingKeepFailure, setPendingKeepFailure] = useState<{ memory: DurablePlaceMemory; tag: Tag } | null>(null)
  const [groupShareFailure, setGroupShareFailure] = useState<GroupShareAttempt | null>(null)
  const [groupShareAudienceReview, setGroupShareAudienceReview] = useState<GroupShareAudienceReview | null>(null)
  const [groupShareAudienceRefresh, setGroupShareAudienceRefresh] = useState<GroupShareAudienceRefresh | null>(null)
  const [receiptNotice, setReceiptNotice] = useState<'idle' | 'copied' | 'shared' | 'revoked' | 'error'>('idle')
  const [confirmingReceiptRevocation, setConfirmingReceiptRevocation] = useState(false)
  const [receiptRevocationFailure, setReceiptRevocationFailure] = useState<'unknown' | null>(null)
  const [confirmingDismiss, setConfirmingDismiss] = useState(false)
  const [pickCloseFailure, setPickCloseFailure] = useState<'unknown' | 'changed' | null>(null)
  const [pickCloseAttempt, setPickCloseAttempt] = useState<PickCloseStatus | null>(null)
  const revokeReceiptButtonRef = useRef<HTMLButtonElement>(null)
  const dismissPickButtonRef = useRef<HTMLButtonElement>(null)
  const pickReturnTitleRef = useRef<HTMLHeadingElement>(null)
  const localPickCloseFocusPendingRef = useRef(false)
  const groupShareRecoveryButtonRef = useRef<HTMLButtonElement>(null)
  const groupShareHandoffRowRef = useRef<HTMLDivElement>(null)
  const groupSharingSectionRef = useRef<HTMLElement>(null)
  const legacyVisibilityRecoveryButtonRef = useRef<HTMLButtonElement>(null)
  const keepMutationRecoveryButtonRef = useRef<HTMLButtonElement>(null)
  const groupShareHandoffFocusedRef = useRef(false)
  const groupSharingSectionFocusedRef = useRef(false)
  const prototypeLegacyVisibilityResponseLostRef = useRef(false)
  const prototypeMemoryResponseLostRef = useRef(false)
  const prototypeNoteResponseLostRef = useRef(false)
  const prototypeObservationResponseLostRef = useRef(false)
  const prototypeCloseResponseLostRef = useRef(false)
  const prototypeReceiptResponseLostRef = useRef(false)
  const prototypeGroupShareResponseLostRef = useRef(new Set<string>())
  const prototypeGroupShareAudienceChangedRef = useRef(false)
  const prototypeShareStates = prototype && myUid
    ? prototypeGroups.flatMap(group => {
      const save = group.tastes.find(taste => taste.uid === myUid)?.saves.find(item => item.placeId === id)
      return save ? [{
        groupId: group.id,
        includeNote: Boolean(save.note),
        includeObservations: Boolean(save.observations && Object.keys(save.observations).length > 0),
      }] : []
    })
    : []
  const shareStates = prototype ? prototypeShareStates : shareStatesQuery.data ?? []

  const finishGroupShare = (shared: boolean, input: GroupShareAttempt) => {
    if (!closeupTargetMatches(input)) return
    setGroupShareFailure(null)
    setGroupShareAudienceRefresh(null)
    queryClient.setQueryData<Awaited<ReturnType<typeof fetchGroupSignalShareStates>>>(
      ['groupSignalShareStates', myUid, input.placeId, activeGroupIds],
      current => shared
        ? [{
          groupId: input.groupId,
          includeNote: input.includeNote,
          includeObservations: input.includeObservations,
        }, ...(current ?? []).filter(state => state.groupId !== input.groupId)]
        : (current ?? []).filter(state => state.groupId !== input.groupId),
    )
    setGroupShareOptions(current => {
      if (!(input.groupId in current)) return current
      const next = { ...current }
      delete next[input.groupId]
      return next
    })
    haptics.tap()
    void queryClient.invalidateQueries({ queryKey: ['group', input.groupId] })
    if (shared
      && input.operation === 'share'
      && groupKeepShareHandoff?.returnToGroup === input.groupId
      && activeGroupIds.includes(input.groupId)) {
      navigate(`/g/${encodeURIComponent(input.groupId)}`, { replace: true })
    }
  }

  const refreshGroupShareAudience = async (attempt: GroupShareAttempt, resolveUnknown: boolean) => {
    if (!myUid || !closeupTargetMatches(attempt)) return
    setGroupShareAudienceRefresh({ attempt, status: 'checking' })
    try {
      const currentAudience = prototype
        ? queryClient.getQueryData<GroupCircle[]>(['prototypeGroups'])?.find(group => group.id === attempt.groupId) ?? null
        : await fetchGroupAudienceFromServer(attempt.groupId, myUid)
      if (!closeupTargetMatches(attempt)) return
      if (!currentAudience) throw new Error('group-audience-unavailable')

      if (resolveUnknown) {
        // Reconcile the current projection before leaving the ambiguous state,
        // but its coarse include flags are not proof this exact tag/content
        // update landed. A changed audience always receives a fresh review.
        if (!prototype) await fetchGroupSignalShareStates([attempt.groupId], myUid, attempt.placeId)
        if (!closeupTargetMatches(attempt)) return
      }

      setGroupShareFailure(null)
      setGroupShareAudienceRefresh(null)
      setGroupShareAudienceReview({
        group: currentAudience,
        attempt: { ...attempt, audience: undefined, checkingUnknown: undefined },
        changed: true,
      })
    } catch {
      if (!closeupTargetMatches(attempt)) return
      setGroupShareAudienceRefresh({ attempt, status: 'failed' })
      haptics.warn()
    }
  }

  const groupShare = useMutation({
    mutationFn: async (input: GroupShareAttempt) => {
      if (!closeupTargetMatches(input)) throw new Error('place-target-changed')
      const willShare = input.operation !== 'remove'
      const currentSave = willShare && input.includeNote ? await commitNote() : mySave
      if (!closeupTargetMatches(input)) throw new Error('place-target-changed')
      if (!prototype) {
        if (!willShare) return shareSignalWithGroup({
          groupId: input.groupId,
          placeId: input.placeId,
          action: 'remove',
        })
        if (!input.audience) throw new Error('group-audience-unavailable')
        return shareSignalWithGroup({
          groupId: input.groupId,
          placeId: input.placeId,
          includeNote: input.includeNote,
          includeObservations: input.includeObservations,
          action: 'share',
          audience: input.audience,
        })
      }
      if (!myUid || !currentSave) throw new Error('signal-unavailable')
      if (willShare && prototypeFailure('group-share-audience-changed') && !prototypeGroupShareAudienceChangedRef.current) {
        prototypeGroupShareAudienceChangedRef.current = true
        queryClient.setQueryData<GroupCircle[]>(['prototypeGroups'], current => {
          const target = (current ?? []).find(group => group.id === input.groupId)
          const candidate = (current ?? []).flatMap(group => group.members)
            .find(member => target && !target.memberUids.includes(member.uid))
          if (!target || !candidate) return current
          return (current ?? []).map(group => group.id !== input.groupId ? group : {
            ...group,
            memberUids: [...group.memberUids, candidate.uid],
            members: [...group.members, candidate],
            tastes: [...group.tastes, { uid: candidate.uid, name: candidate.displayName, saves: [] }],
          })
        })
        throw new GroupRequestError('audience-changed', 409)
      }
      const projected: FriendSave = {
        ...currentSave,
        visibility: 'circle',
      }
      if (!input.includeNote) delete projected.note
      if (input.includeObservations && currentSave.observations) {
        projected.observations = observationsForGroup(currentSave.observations)
      } else delete projected.observations
      queryClient.setQueryData<GroupCircle[]>(['prototypeGroups'], current =>
        (current ?? []).map(group => {
          if (group.id !== input.groupId) return group
          const wasShared = group.tastes.some(taste =>
            taste.uid === myUid && taste.saves.some(save => save.placeId === input.placeId))
          return {
            ...group,
            membershipLocked: true,
            projectionCount: group.projectionCount + (willShare && !wasShared ? 1 : !willShare && wasShared ? -1 : 0),
            tastes: group.tastes.map(taste => taste.uid !== myUid ? taste : {
              ...taste,
              saves: willShare
                ? [projected, ...taste.saves.filter(save => save.placeId !== input.placeId)]
                : taste.saves.filter(save => save.placeId !== input.placeId),
            }),
          }
        }))
      const failureName = input.operation === 'remove'
        ? 'group-share-remove-response'
        : 'group-share-save-response'
      const operationKey = JSON.stringify({
        groupId: input.groupId,
        placeId: input.placeId,
        operation: input.operation,
        includeNote: input.includeNote,
        includeObservations: input.includeObservations,
        audience: input.audience,
      })
      if (prototypeFailure(failureName) && !prototypeGroupShareResponseLostRef.current.has(operationKey)) {
        prototypeGroupShareResponseLostRef.current.add(operationKey)
        throw new Error('prototype ambiguous group-share response')
      }
      return willShare
    },
    onSuccess: finishGroupShare,
    onError: (error, input) => {
      if (!closeupTargetMatches(input)) return
      if (error instanceof KeepNoteCommitUnconfirmed) {
        setGroupShareFailure(null)
        haptics.warn()
        return
      }
      if (error instanceof GroupRequestError && error.code === 'audience-changed') {
        setGroupShareFailure(null)
        void refreshGroupShareAudience(input, Boolean(input.checkingUnknown))
        return
      }
      setGroupShareFailure(input)
      haptics.warn()
    },
  })
  const requestGroupShare = (
    group: GroupSummary,
    draft: Omit<GroupShareAttempt, 'placeId' | 'targetEpoch'>,
  ) => {
    const identity = closeupTargetIdentityRef.current
    if (!identity?.active || identity.placeId !== id) return
    const attempt: GroupShareAttempt = {
      ...draft,
      placeId: identity.placeId,
      targetEpoch: identity.epoch,
    }
    if (attempt.operation === 'remove') {
      groupShare.mutate({ ...attempt, audience: undefined, checkingUnknown: undefined })
      return
    }
    const audience = buildGroupAudienceStamp(group)
    if (!audience) {
      setGroupShareAudienceRefresh({ attempt, status: 'failed' })
      haptics.warn()
      return
    }
    if (!group.membershipLocked) {
      setGroupShareAudienceReview({ group, attempt, changed: false })
      return
    }
    groupShare.mutate({ ...attempt, audience })
  }
  const confirmGroupShareAudience = () => {
    const review = groupShareAudienceReview
    if (!review || !closeupTargetMatches(review.attempt)) {
      setGroupShareAudienceReview(null)
      return
    }
    const audience = buildGroupAudienceStamp(review.group)
    if (!audience) {
      setGroupShareAudienceReview(null)
      setGroupShareAudienceRefresh({ attempt: review.attempt, status: 'failed' })
      haptics.warn()
      return
    }
    setGroupShareAudienceReview(null)
    groupShare.mutate({ ...review.attempt, audience })
  }
  useLayoutEffect(() => {
    if ((!groupShareFailure && groupShareAudienceRefresh?.status !== 'failed') || groupShare.isPending) return
    const button = groupShareRecoveryButtonRef.current
    if (button && !button.disabled) button.focus()
  }, [groupShare.isPending, groupShareAudienceRefresh?.status, groupShareFailure])
  const shareStatesUnavailable = prototype
    ? prototypeFailure('group-share-read')
    : Boolean(shareStatesQuery.error && shareStatesQuery.data === undefined)
  const shareStatesPending = !prototype && !shareStatesUnavailable && shareStatesQuery.isPending
  const shareStatesStale = !prototype && Boolean(shareStatesQuery.error && shareStatesQuery.data !== undefined)
  const retryGroupShareStates = () => {
    if (prototype && prototypeFailure('group-share-read')) {
      const next = new URL(window.location.href)
      next.searchParams.delete('failure')
      window.location.assign(next.toString())
      return
    }
    void shareStatesQuery.refetch()
  }
  const reviewGroupSharing = params.get('sharing') === '1'
  useEffect(() => {
    if (
      groupShareHandoffFocusedRef.current || !checkGroupShareId
      || shareStatesPending || shareStatesUnavailable
      || !activeGroupIds.includes(checkGroupShareId)
    ) return
    groupShareHandoffFocusedRef.current = true
    window.requestAnimationFrame(() => {
      const row = groupShareHandoffRowRef.current
      row?.scrollIntoView({ block: 'center', behavior: 'auto' })
      window.requestAnimationFrame(() => row?.focus({ preventScroll: true }))
    })
  }, [activeGroupIds, checkGroupShareId, shareStatesPending, shareStatesUnavailable])
  useEffect(() => {
    if (
      groupSharingSectionFocusedRef.current || !reviewGroupSharing || !mySave
      || groupDirectoryPending
    ) return
    groupSharingSectionFocusedRef.current = true
    window.requestAnimationFrame(() => {
      const section = groupSharingSectionRef.current
      section?.scrollIntoView({ block: 'center', behavior: 'auto' })
      window.requestAnimationFrame(() => section?.focus({ preventScroll: true }))
    })
  }, [groupDirectoryPending, mySave, reviewGroupSharing])

  const updateObservationCache = (observations: PlaceObservations) => {
    const update = (current: FriendSave[] | undefined) => (current ?? []).map(save =>
      save.uid === myUid && save.placeId === id
        ? { ...save, ...(Object.keys(observations).length > 0 ? { observations } : { observations: undefined }) }
        : save)
    queryClient.setQueryData<FriendSave[]>(['mySaves', myUid], update)
    queryClient.setQueriesData<FriendSave[]>({ queryKey: ['placeSaves', id] }, update)
  }
  const observationSave = useMutation({
    mutationFn: async (observations: PlaceObservations) => {
      await setSaveObservations(id, observations)
      if (prototype && prototypeFailure('keep-observation-response') && !prototypeObservationResponseLostRef.current) {
        prototypeObservationResponseLostRef.current = true
        throw new Error('prototype ambiguous useful-detail response')
      }
    },
    onMutate: observations => {
      const previous = mySave?.observations ?? {}
      updateObservationCache(observations)
      return previous
    },
    onError: (_error, _observations, previous) => {
      updateObservationCache(previous ?? {})
      dismissToast()
      setKeepObservationFailure({ observations: _observations, previous: previous ?? {} })
      haptics.warn()
    },
    onSuccess: (_value, observations) => {
      setKeepObservationFailure(null)
      if (prototype && myUid) {
        queryClient.setQueryData<GroupCircle[]>(['prototypeGroups'], current => (current ?? []).map(group => ({
          ...group,
          tastes: group.tastes.map(taste => taste.uid !== myUid ? taste : {
            ...taste,
            saves: taste.saves.map(save => {
              if (save.placeId !== id || save.observations === undefined) return save
              const projected = { ...save }
              if (Object.keys(observations).length > 0) projected.observations = observationsForGroup(observations)
              else delete projected.observations
              return projected
            }),
          }),
        })))
      }
      haptics.tap()
      if (!prototype) invalidate()
    },
  })

  const editingMemory = params.get('edit') === 'details'
  const closeMemoryEditor = () => {
    if ((location.state as { placeMemoryEditor?: boolean } | null)?.placeMemoryEditor) {
      navigate(-1)
      return
    }
    const next = new URLSearchParams(params)
    next.delete('edit')
    setParams(next, { replace: true })
  }
  const openMemoryEditor = () => {
    const next = new URLSearchParams(params)
    next.set('edit', 'details')
    const priorState = location.state && typeof location.state === 'object' ? location.state : {}
    setParams(next, { state: { ...priorState, placeMemoryEditor: true } })
  }
  const updateMemoryCache = (memory: DurablePlaceMemory) => {
    const updateSave = (save: FriendSave): FriendSave => save.uid === myUid && save.placeId === id
      ? {
          ...save,
          memory,
          place: {
            name: memory.label,
            primaryType: categoryPrimaryType(memory.category),
            hex: memory.hex,
          },
        }
      : save
    const updateSaves = (current: FriendSave[] | undefined) => (current ?? []).map(updateSave)
    queryClient.setQueryData<FriendSave[]>(['mySaves', myUid], updateSaves)
    queryClient.setQueriesData<FriendSave[]>({ queryKey: ['placeSaves', id] }, updateSaves)
    queryClient.setQueryData<PlaceDoc[]>(['placeCatalog'], current => (current ?? []).map(place =>
      place.id === id
        ? { ...place, name: memory.label, primaryType: categoryPrimaryType(memory.category), photoHex: memory.hex }
        : place))
    if (prototype && myUid) {
      queryClient.setQueryData<GroupCircle[]>(['prototypeGroups'], current => (current ?? []).map(group => ({
        ...group,
        tastes: group.tastes.map(taste => taste.uid !== myUid ? taste : {
          ...taste,
          saves: taste.saves.map(updateSave),
        }),
      })))
    }
  }
  const memoryEdit = useMutation({
    mutationFn: async (memory: DurablePlaceMemory) => {
      await setSaveMemory(id, memory)
      if (prototype && prototypeFailure('keep-memory-response') && !prototypeMemoryResponseLostRef.current) {
        prototypeMemoryResponseLostRef.current = true
        throw new Error('prototype ambiguous place-memory response')
      }
    },
    onMutate: () => dismissToast(),
    onSuccess: (_value, memory) => {
      setKeepMemoryFailure(null)
      updateMemoryCache(memory)
      closeMemoryEditor()
      haptics.tap()
      showToast({ kind: 'notice', text: 'Place details updated.' })
      if (!prototype) {
        invalidate()
        activeGroupIds.forEach(groupId => {
          void queryClient.invalidateQueries({ queryKey: ['group', groupId] })
        })
      }
    },
    onError: (_error, memory) => {
      dismissToast()
      setKeepMemoryFailure(memory)
      haptics.warn()
    },
  })

  const retireLegacyVisibility = useMutation({
    mutationFn: async () => {
      await setSaveVisibility(id, 'private')
      if (prototype && prototypeFailure('keep-privacy-response') && !prototypeLegacyVisibilityResponseLostRef.current) {
        prototypeLegacyVisibilityResponseLostRef.current = true
        throw new Error('prototype ambiguous privacy response')
      }
    },
    onMutate: () => dismissToast(),
    onSuccess: () => {
      const update = (current: FriendSave[] | undefined) =>
        (current ?? []).map(save => save.uid === myUid && save.placeId === id
          ? { ...save, visibility: 'private' as const }
          : save)
      queryClient.setQueryData<FriendSave[]>(['mySaves', myUid], update)
      queryClient.setQueriesData<FriendSave[]>({ queryKey: ['placeSaves', id] }, update)
      if (!isPairPrototype()) invalidate()
      setLegacyVisibilityFailure(false)
      haptics.tap()
    },
    onError: () => {
      setLegacyVisibilityFailure(true)
      haptics.warn()
    },
  })

  useLayoutEffect(() => {
    if (!legacyVisibilityFailure || retireLegacyVisibility.isPending) return
    const button = legacyVisibilityRecoveryButtonRef.current
    if (button && !button.disabled) button.focus()
  }, [legacyVisibilityFailure, retireLegacyVisibility.isPending])

  const keepRecoveryPending = keepTagFailure || pendingKeepFailure
    ? setTag.isPending
    : keepRemovalFailure
    ? unsave.isPending
    : keepMemoryFailure
    ? memoryEdit.isPending
    : keepNoteFailure
    ? noteChecking
    : keepObservationFailure
    ? observationSave.isPending
    : false
  useLayoutEffect(() => {
    const hasFailure = Boolean(
      keepTagFailure
      || keepRemovalFailure
      || keepMemoryFailure
      || keepNoteFailure
      || keepObservationFailure
      || pendingKeepFailure,
    )
    if (!hasFailure || keepRecoveryPending) return
    const button = keepMutationRecoveryButtonRef.current
    if (button && !button.disabled) button.focus()
  }, [
    keepMemoryFailure,
    keepNoteFailure,
    keepObservationFailure,
    keepRecoveryPending,
    keepRemovalFailure,
    keepTagFailure,
    pendingKeepFailure,
  ])

  // The acquisition: tapping Loved sweeps the picture-light across the hero
  // once (the celebrate haptic rides along via useSaveFlow).
  const [sweeping, setSweeping] = useState(false)
  const [pendingSave, setPendingSave] = useState<{
    tag: Tag
    source: 'keep' | 'pick'
  } | null>(null)
  const personalWriteFrozen = legacyVisibilityFailure
    || Boolean(keepTagFailure)
    || Boolean(keepRemovalFailure)
    || Boolean(keepMemoryFailure)
    || Boolean(keepNoteFailure)
    || Boolean(keepObservationFailure)
    || Boolean(pendingKeepFailure)

  const runTagAttempt = (attempt: KeepTagAttempt) => {
    dismissToast()
    setTag.mutate(attempt, {
      onSuccess: () => setKeepTagFailure(null),
      onError: () => {
        dismissToast()
        setKeepTagFailure(attempt)
      },
    })
  }

  const runRemovalAttempt = (placeId: string) => {
    dismissToast()
    unsave.mutate(placeId, {
      onSuccess: () => setKeepRemovalFailure(null),
      onError: () => {
        dismissToast()
        setKeepRemovalFailure(placeId)
      },
    })
  }

  const onTag = (tag: Tag) => {
    if (session.status !== 'signed-in') { haptics.tap(); void signIn(); return }
    if (personalWriteFrozen) return
    if (myTag === tag) return
    if (!mySave?.memory) {
      setPendingSave({ tag, source: 'keep' })
      return
    }
    if (tag === 'loved') {
      setSweeping(true)
      window.setTimeout(() => setSweeping(false), 380)
    }
    runTagAttempt({ place: { id, memory: mySave.memory }, tag, prev: myTag ?? null })
  }
  const onRemove = () => {
    if (!mySave || personalWriteFrozen) return
    runRemovalAttempt(id)
  }

  const pickStatus = useMutation({
    mutationFn: async (status: PickCloseStatus) => {
      const result = await updatePickStatus(pickId!, status)
      if (prototype && prototypeFailure('pick-close-response') && !prototypeCloseResponseLostRef.current) {
        prototypeCloseResponseLostRef.current = true
        throw new Error('prototype ambiguous Pick-close response')
      }
      return result
    },
    onMutate: status => {
      localPickCloseFocusPendingRef.current = true
      setPickCloseAttempt(status)
      setPickCloseFailure(null)
    },
    onSuccess: (result, status) => {
      setPickCloseFailure(null)
      setConfirmingDismiss(false)
      if (!result.changed) {
        void pickQuery.refetch()
        if (pick && isGroupPick(pick)) {
          void queryClient.invalidateQueries({ queryKey: ['groups'] })
          void queryClient.invalidateQueries({ queryKey: ['group', pick.groupId] })
        }
        return
      }
      track('pick_closed', { status })
      queryClient.setQueryData(pickQueryKey, pick
        ? {
            ...pick,
            status,
            updatedAt: Date.now(),
            ...(status === 'dismissed' && isGroupPick(pick) ? { shareToken: undefined } : {}),
          }
        : pick)
      if (pick && isGroupPick(pick)) {
        const recentPick: RecentGroupPickSummary | undefined = status === 'visited'
          ? {
              id: pick.id,
              placeId: pick.placeId,
              label: pick.memory.label,
              attendeeCount: pick.attendeeUids.length + (pick.guestCount ?? 0),
              createdAt: pick.createdAt,
              visitedAt: Date.now(),
            }
          : undefined
        const clearCurrentPick = <T extends GroupSummary>(items: T[] | undefined) =>
          (items ?? []).map(item => item.id === pick.groupId
            ? { ...item, activePick: undefined, recentPick }
            : item)
        queryClient.setQueriesData<GroupSummary[]>({ queryKey: ['groups'] }, clearCurrentPick)
        queryClient.setQueriesData<GroupCircle | null>({ queryKey: ['group', pick.groupId] }, current =>
          current ? { ...current, activePick: undefined } : current)
        if (prototype) {
          window.sessionStorage.removeItem(prototypeActivePickStorageKey(pick.groupId))
          if (recentPick) {
            window.sessionStorage.setItem(prototypeRecentPickStorageKey(pick.groupId), JSON.stringify(recentPick))
          } else {
            window.sessionStorage.removeItem(prototypeRecentPickStorageKey(pick.groupId))
          }
          queryClient.setQueryData<GroupCircle[]>(['prototypeGroups'], clearCurrentPick)
        }
        else {
          void queryClient.invalidateQueries({ queryKey: ['groups'] })
          void queryClient.invalidateQueries({ queryKey: ['group', pick.groupId] })
        }
      }
    },
    onError: error => {
      localPickCloseFocusPendingRef.current = false
      haptics.warn()
      setPickCloseFailure(error instanceof PickRequestError && error.code === 'pick-outcome-conflict'
        ? 'changed'
        : 'unknown')
    },
  })

  useEffect(() => {
    if (!localPickCloseFocusPendingRef.current || !pick || pick.status === 'selected') return
    localPickCloseFocusPendingRef.current = false
    window.requestAnimationFrame(() => {
      const title = pickReturnTitleRef.current
      title?.focus({ preventScroll: true })
      title?.scrollIntoView({ block: 'center', behavior: 'auto' })
    })
  }, [pick])

  const cancelPickDismissal = () => {
    setConfirmingDismiss(false)
    pickStatus.reset()
    window.requestAnimationFrame(() => dismissPickButtonRef.current?.focus())
  }

  const receiptRevocation = useMutation({
    mutationFn: async (targetPickId: string) => {
      if (!pickActionsAuthoritative) throw new Error('pick-status-unconfirmed')
      await revokePickReceipt(targetPickId)
      if (prototype && prototypeFailure('pick-receipt-revoke-response') && !prototypeReceiptResponseLostRef.current) {
        prototypeReceiptResponseLostRef.current = true
        throw new Error('prototype ambiguous Pick-receipt revocation response')
      }
    },
    onMutate: () => setReceiptNotice('idle'),
    onSuccess: () => {
      queryClient.setQueryData<Pick | null>(pickQueryKey, current =>
        current && isGroupPick(current) ? { ...current, shareToken: undefined } : current)
      setConfirmingReceiptRevocation(false)
      setReceiptRevocationFailure(null)
      setReceiptNotice('revoked')
      haptics.tap()
    },
    onError: () => {
      setReceiptRevocationFailure('unknown')
      haptics.warn()
    },
  })

  async function shareReceipt(token: string) {
    if (!pickActionsAuthoritative) return
    const url = pickReceiptUrl(token)
    try {
      if (navigator.share) {
        await navigator.share({ title: `${name} · this.is`, text: pick?.reason, url })
        setReceiptNotice('shared')
      } else {
        await navigator.clipboard.writeText(url)
        setReceiptNotice('copied')
      }
      haptics.tap()
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setReceiptNotice('error')
      haptics.warn()
    }
  }

  const cancelReceiptRevocation = () => {
    setConfirmingReceiptRevocation(false)
    receiptRevocation.reset()
    window.requestAnimationFrame(() => revokeReceiptButtonRef.current?.focus())
  }

  const recordPickOutcome = async (tag: Extract<Tag, 'tried' | 'loved'>) => {
    if (session.status !== 'signed-in' || !pickActionsAuthoritative) return
    if (myTag === tag) return
    if (!mySave?.memory) {
      setPendingSave({ tag, source: 'pick' })
      return
    }
    if (tag === 'loved') {
      setSweeping(true)
      window.setTimeout(() => setSweeping(false), 380)
    }
    runTagAttempt({ place: { id, memory: mySave.memory }, tag, prev: myTag ?? null })
  }

  const confirmMemory = async (memory: DurablePlaceMemory) => {
    if (!pendingSave) return
    const { tag } = pendingSave
    try {
      await setTag.mutateAsync({ place: { id, memory }, tag, prev: myTag ?? null })
      setPendingKeepFailure(null)
      setPendingSave(null)
    } catch {
      dismissToast()
      setPendingKeepFailure({ memory, tag })
    }
  }

  const retryNoteCommit = () => {
    if (!keepNoteFailure) return
    setNote(keepNoteFailure.note)
    noteDirty.current = true
    void commitNote().catch(() => haptics.warn())
  }

  const observationRecoveryKey = keepObservationFailure
    ? PLACE_OBSERVATION_KEYS.find(key =>
      keepObservationFailure.previous[key]?.value !== keepObservationFailure.observations[key]?.value)
    : undefined
  const observationRecoveryDescription = observationRecoveryKey
    ? `${PLACE_OBSERVATION_LABELS[observationRecoveryKey]} → ${keepObservationFailure?.observations[observationRecoveryKey]?.value === 'yes'
      ? 'Yes'
      : keepObservationFailure?.observations[observationRecoveryKey]?.value === 'no'
      ? 'No'
      : 'Not set'}`
    : 'the reviewed useful-detail choices'

  const dismissPick = async () => {
    if (!pickId || !pickActionsAuthoritative) return
    try {
      await pickStatus.mutateAsync('dismissed')
    } catch {
      // Mutation exposes its visible error state.
    }
  }

  const markPickVisited = async () => {
    if (!pickId || !pickActionsAuthoritative) return
    try {
      await pickStatus.mutateAsync('visited')
    } catch {
      // Mutation exposes its visible error state.
    }
  }

  const recoverPickClose = async () => {
    if (pickCloseFailure === 'changed') {
      const refreshed = await pickQuery.refetch()
      if (refreshed.data?.status && refreshed.data.status !== 'selected') {
        setPickCloseFailure(null)
        setConfirmingDismiss(false)
        if (isGroupPick(refreshed.data)) {
          void queryClient.invalidateQueries({ queryKey: ['groups'] })
          void queryClient.invalidateQueries({ queryKey: ['group', refreshed.data.groupId] })
        }
      }
      return
    }
    if (!pickCloseAttempt) return
    try {
      await pickStatus.mutateAsync(pickCloseAttempt)
    } catch {
      // The recovery state remains visible with the exact attempted outcome.
    }
  }

  const retryPlaceLookup = () => {
    if (prototypeMemoryError || prototypePickError) {
      const next = new URL(window.location.href)
      next.searchParams.delete('failure')
      window.location.assign(next.toString())
      return
    }
    if (personalDataUnavailable) void savesQuery.refetch()
    if (pickDataUnavailable) void pickQuery.refetch()
  }

  const pickReceiptControls = pickActionsAuthoritative && pick && isGroupPick(pick) && receiptToken ? (
    <div className="pick-receipt-controls">
      <p className="eyebrow">SEND TO THE CHAT</p>
      <p className="t-small">
        {pick.status === 'visited'
          ? 'A 30-day no-sign-in link says the group went, shows the broad reason, and says how many were on the plan. No names, notes, or taste history.'
          : 'A 30-day no-sign-in link shows this place, the broad reason, and how many are going. No names, notes, or taste history.'}
      </p>
      {receiptRevocationFailure ? (
        !confirmingReceiptRevocation ? <>
          <p className="t-small pick-return-error" role="alert">
            We couldn’t confirm whether the public link was revoked. Checking again can only remove that same link; it cannot restore or replace it.
          </p>
          <div className="pick-receipt-actions">
            <button
              ref={revokeReceiptButtonRef}
              className="pill pill-primary press"
              onClick={() => setConfirmingReceiptRevocation(true)}
            >Check link</button>
          </div>
        </> : null
      ) : (
        <div className="pick-receipt-actions">
          <button className="pill pill-ghost press" onClick={() => void shareReceipt(receiptToken)}>
            Share Pick
          </button>
          <button
            ref={revokeReceiptButtonRef}
            className="toast-ghost press"
            disabled={receiptRevocation.isPending}
            onClick={() => {
              receiptRevocation.reset()
              setReceiptRevocationFailure(null)
              setConfirmingReceiptRevocation(true)
            }}
          >
            Revoke link
          </button>
        </div>
      )}
    </div>
  ) : null

  if (placeLookupFailed) {
    const pickFailed = pickDataUnavailable
    return (
      <div className="page">
        <button className="eyebrow back-link press" onClick={() => navigate(-1)}>← BACK</button>
        <section className="empty-state" role="alert">
          <p className="eyebrow">{pickFailed ? 'PRIVATE PICK' : 'PRIVATE KEEP'}</p>
          <h1 className="t-display">
            {pickFailed ? 'We couldn’t load this Pick.' : 'We couldn’t load this place.'}
          </h1>
          <p className="t-body">
            {pickFailed
              ? 'No place, group, attendee, or shared reason was shown. Nothing in anyone’s Keep changed.'
              : 'No saved label, note, or sharing state was shown. Your Keep may still contain it, and nothing was changed.'}
          </p>
          <div className="empty-state-actions">
            <button className="pill pill-primary press" onClick={retryPlaceLookup}>Try again</button>
            <Link to={pickFailed ? '/together' : '/saved'} className="pill pill-ghost press">
              {pickFailed ? 'Back to Together' : 'Back to Keep'}
            </Link>
          </div>
        </section>
      </div>
    )
  }

  if (placeUnavailable) {
    return (
      <div className="page">
        <button className="eyebrow back-link press" onClick={() => navigate(-1)}>← BACK</button>
        <section className="empty-state" role="alert">
          <p className="eyebrow">PLACE UNAVAILABLE</p>
          <h1 className="t-display">We couldn’t find this place.</h1>
          <p className="t-body">
            The link may be old, or Google may no longer return it. Nothing in your Keep was removed.
          </p>
          <div className="empty-state-actions">
            <Link to="/add" className="pill pill-primary press">Find the place again</Link>
            <button className="pill pill-ghost press" onClick={() => void detailsQuery.refetch()}>Try again</button>
          </div>
        </section>
      </div>
    )
  }

  if (placeLoading) {
    return (
      <div className="page" aria-busy="true">
        <button className="eyebrow back-link press" onClick={() => navigate(-1)}>← BACK</button>
        <div className="closeup-visual skeleton" aria-hidden />
      </div>
    )
  }

  return (
    <div className={`page closeup${myTag === 'loved' ? ' is-loved' : ''}`}>
      <button className="eyebrow back-link press" onClick={() => navigate(-1)}>← BACK</button>

      <PinVisual
        hex={hex}
        photoSrc={photo.src}
        attribution={photo.credit}
        attributionUri={photo.sourceUri}
        alt={name}
        className={`closeup-visual${photo.src ? '' : ' is-fallback'}${sweeping ? ' is-sweeping' : ''}`}
      />

      <header className="closeup-head">
        <h1 className="t-display">{name}</h1>
        {chip && <p className="eyebrow">{chip}</p>}
        {details?.address && <p className="t-small closeup-address">{details.address}</p>}
      </header>

      {pick && pickPresentation && pick.placeId === id && (
        <section className={`pick-return is-${pick.status}`} aria-labelledby="pick-return-title">
          <div className="pick-status-summary" role="status" aria-live="polite" aria-atomic="true">
            <p className="eyebrow">{pickPresentation.eyebrow}</p>
            <h2
              ref={pickReturnTitleRef}
              id="pick-return-title"
              className="t-row-title"
              tabIndex={-1}
            >
              {pickPresentation.title}
            </h2>
            {pickPresentation.support && <p className="t-small">{pickPresentation.support}</p>}
          </div>
          {pickPresentation.historyLabel && (
            <div className="pick-status-history">
              <p className="eyebrow">{pickPresentation.historyLabel}</p>
              <p className="t-small">{pick.reason}</p>
            </div>
          )}
          {isGroupPick(pick) && (
            <PickContextChips
              context={pick.context}
              planArea={pick.planArea}
              requiredObservation={pick.requiredObservation}
              label={pickPresentation.contextLabel}
            />
          )}
          {pick.status === 'selected' && (
            <div className="pick-logistics">
              <a
                className="pill pill-primary press"
                href={mapsDeepLink(name, rawPid(id))}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => haptics.tap()}
              >
                Open in Google Maps ↗
              </a>
            </div>
          )}
          {pick.status === 'selected' && pickReceiptControls}
          {pick.status === 'selected' && isPickAttendee && pickActionsAuthoritative && (
            <details className="pick-after-visit">
              <summary>
                <span>
                  <span className="eyebrow">AFTER THE OUTING</span>
                  <span className="t-small">Close this Pick when the plan is over.</span>
                </span>
                <span className="pick-after-visit-mark" aria-hidden="true">+</span>
              </summary>
              <p className="t-small">This closes the shared Pick for everyone. Your own Tried or Loved stays separate.</p>
              <div className="pick-return-actions">
                {pickCloseFailure ? (
                  <button
                    className="pill pill-primary press"
                    disabled={pickStatus.isPending}
                    onClick={() => void recoverPickClose()}
                  >
                    {pickCloseFailure === 'changed' ? 'Reload Pick' : 'Check outcome'}
                  </button>
                ) : <>
                  <button
                    className="pill pill-primary press"
                    disabled={pickStatus.isPending}
                    onClick={() => void markPickVisited()}
                  >
                    We went
                  </button>
                  <button
                    ref={dismissPickButtonRef}
                    className="toast-ghost press"
                    disabled={pickStatus.isPending}
                    onClick={() => {
                      pickStatus.reset()
                      setConfirmingDismiss(true)
                    }}
                  >
                    Not for us
                  </button>
                </>}
              </div>
            </details>
          )}
          {pick.status === 'selected' && isPickAttendee && !pickActionsAuthoritative && (
            <div className="pick-after-visit" role="status">
              <p className="eyebrow">CHECKING PICK</p>
              <p className="t-small">Current status is being confirmed before anyone can close or share this Pick.</p>
            </div>
          )}
          {pick.status === 'selected' && !isPickAttendee && (
            <div className="pick-after-visit">
              <p className="eyebrow">AFTER THE OUTING</p>
              <p className="t-small">The people going can close this Pick for everyone.</p>
            </div>
          )}
          {pick.status === 'visited' && isPickAttendee && !personalDataUnavailable && pickActionsAuthoritative && (
            <div className="pick-personal-outcome">
              <p className="t-small">How was it for you? Only your Keep changes.</p>
              <div className="pick-return-actions">
                <button
                  className={`pill press${myTag === 'tried' ? ' pill-primary' : ' pill-ghost'}`}
                  aria-pressed={myTag === 'tried'}
                  disabled={setTag.isPending}
                  onClick={() => void recordPickOutcome('tried')}
                >
                  Keep as Tried
                </button>
                <button
                  className={`pill press${myTag === 'loved' ? ' pill-primary' : ' pill-ghost'}`}
                  aria-pressed={myTag === 'loved'}
                  disabled={setTag.isPending}
                  onClick={() => void recordPickOutcome('loved')}
                >
                  Keep as Loved
                </button>
              </div>
              {(myTag === 'tried' || myTag === 'loved') && (
                <p className="t-small pick-return-result" role="status">Your Keep says {myTag}. Other people choose for themselves.</p>
              )}
            </div>
          )}
          {pick.status !== 'selected' && isPickAttendee && !pickActionsAuthoritative && (
            <p className="t-small pick-return-result" role="status">
              This terminal outcome is cached. Checking current access before changing Keep or the public link.
            </p>
          )}
          {pick.status === 'visited' && !isPickAttendee && (
            <p className="t-small pick-return-result">Only people who were on the plan can add their own outcome.</p>
          )}
          {pick.status === 'visited' && pickReceiptControls}
          {pick.status !== 'dismissed' && receiptNotice === 'copied' && <p className="t-small pick-return-result" role="status">Pick link copied. Paste it into the chat.</p>}
          {pick.status !== 'dismissed' && receiptNotice === 'shared' && <p className="t-small pick-return-result" role="status">Pick opened in your share sheet.</p>}
          {pick.status !== 'dismissed' && receiptNotice === 'revoked' && <p className="t-small pick-return-result" role="status">Public link revoked.</p>}
          {pick.status !== 'dismissed' && receiptNotice === 'error' && <p className="t-small pick-return-error" role="alert">Couldn’t change the Pick link. Try again.</p>}
          {pickCloseFailure === 'unknown' && !confirmingDismiss && (
            <p className="t-small pick-return-error" role="alert">
              We couldn’t confirm how the Pick closed. Checking again won’t close it twice or change the outcome.
            </p>
          )}
          {pickCloseFailure === 'changed' && !confirmingDismiss && (
            <p className="t-small pick-return-error" role="alert">
              This Pick was already closed with a different outcome. Reload it before doing anything else.
            </p>
          )}
        </section>
      )}

      {pickMemory && personalDataUnavailable && (
        <section className="closeup-data-warning" role="status">
          <span>
            <small className="eyebrow">PRIVATE KEEP</small>
            <strong className="t-row-title">Your Keep couldn’t be checked.</strong>
            <span className="t-small">The shared Pick is still available. Personal outcomes and memory controls wait until your private Keep reloads.</span>
          </span>
          <button className="pill pill-ghost press" onClick={retryPlaceLookup}>Check my Keep</button>
        </section>
      )}

      {pickActionsAuthoritative && confirmingReceiptRevocation && pick && pick.status !== 'dismissed' && isGroupPick(pick) && receiptToken && (
        <aside
          className="group-pass-confirmation pick-dismiss-confirmation"
          role="alertdialog"
          aria-labelledby="receipt-revoke-title"
          aria-describedby="receipt-revoke-description"
          onKeyDown={event => {
            if (event.key !== 'Escape' || receiptRevocation.isPending) return
            event.preventDefault()
            cancelReceiptRevocation()
          }}
        >
          <div>
            <p className="eyebrow">PUBLIC LINK</p>
            <h2 id="receipt-revoke-title" className="t-row-title">Stop this Pick link?</h2>
            <p id="receipt-revoke-description" className="t-small">
              Anyone you sent it to will lose access. The Pick stays open, but this link cannot be restored or replaced.
            </p>
            {receiptRevocationFailure && (
              <p className="t-small pick-return-error" role="alert">
                We couldn’t confirm whether the public link was revoked. Checking again can only remove that same link; it cannot restore or replace it.
              </p>
            )}
          </div>
          <div className="group-resolution-actions">
            <button
              className="toast-ghost press pick-dismiss-confirm-button"
              disabled={receiptRevocation.isPending}
              onClick={() => receiptRevocation.mutate(pick.id)}
            >
              {receiptRevocation.isPending
                ? receiptRevocationFailure ? 'Checking…' : 'Revoking…'
                : receiptRevocationFailure ? 'Check link' : 'Revoke public link'}
            </button>
            <button
              className="pill pill-primary press"
              autoFocus
              disabled={receiptRevocation.isPending}
              onClick={cancelReceiptRevocation}
            >
              {receiptRevocationFailure ? 'Close for now' : 'Keep link active'}
            </button>
          </div>
        </aside>
      )}

      {pickActionsAuthoritative && confirmingDismiss && pick?.status === 'selected' && isPickAttendee && (
        <aside
          className="group-pass-confirmation pick-dismiss-confirmation"
          role="alertdialog"
          aria-labelledby="pick-dismiss-title"
          aria-describedby="pick-dismiss-description"
          onKeyDown={event => {
            if (event.key !== 'Escape' || pickStatus.isPending) return
            event.preventDefault()
            cancelPickDismissal()
          }}
        >
          <div>
            <p className="eyebrow">SHARED ACTION</p>
            <h2 id="pick-dismiss-title" className="t-row-title">Close this Pick for everyone?</h2>
            <p id="pick-dismiss-description" className="t-small">
              {isGroupPick(pick)
                ? `This closes it for all ${pick.attendeeUids.length + (pick.guestCount ?? 0)} people going, revokes any public link, and will not show a Last Pick saying the group went. Nobody’s personal Keep changes. You can’t undo this.`
                : 'This closes it for both people without changing either person’s Keep. You can’t undo this.'}
            </p>
            {pickCloseFailure === 'unknown' && (
              <p className="t-small pick-return-error" role="alert">
                We couldn’t confirm how the Pick closed. Checking again won’t close it twice or change the outcome.
              </p>
            )}
            {pickCloseFailure === 'changed' && (
              <p className="t-small pick-return-error" role="alert">
                This Pick was already closed with a different outcome. Reload it before doing anything else.
              </p>
            )}
          </div>
          <div className="group-resolution-actions">
            <button
              className="toast-ghost press pick-dismiss-confirm-button"
              disabled={pickStatus.isPending}
              onClick={() => void (pickCloseFailure ? recoverPickClose() : dismissPick())}
            >
              {pickStatus.isPending
                ? 'Checking…'
                : pickCloseFailure === 'unknown'
                ? 'Check outcome'
                : pickCloseFailure === 'changed'
                ? 'Reload Pick'
                : 'Close as Not for us'}
            </button>
            <button
              className="pill pill-primary press"
              autoFocus
              disabled={pickStatus.isPending}
              onClick={cancelPickDismissal}
            >
              {pickCloseFailure ? 'Close for now' : 'Keep Pick open'}
            </button>
          </div>
        </aside>
      )}

      {pendingSave && (
        <>
        {pendingKeepFailure && (
          <section className="closeup-data-warning" role="alert" aria-label="Pick outcome Keep save not confirmed">
            <span>
              <strong className="t-row-title">Keep outcome not confirmed.</strong>
              <span className="t-small">We couldn’t confirm {pendingKeepFailure.tag} with the reviewed Pick memory. Checking again repeats only that exact private outcome; it cannot change the shared Pick or another person’s Keep.</span>
            </span>
            <button
              ref={keepMutationRecoveryButtonRef}
              className="pill pill-primary press"
              disabled={setTag.isPending}
              onClick={() => void confirmMemory(pendingKeepFailure.memory)}
            >{setTag.isPending ? 'Checking…' : 'Check Keep'}</button>
          </section>
        )}
        <PlaceMemoryConfirmation
          placeId={id}
          googleLabel={pendingSave.source === 'pick' ? undefined : details?.name}
          initialLabel={pendingSave.source === 'pick' ? pickMemory?.label : undefined}
          initialCategory={pendingSave.source === 'pick' ? pickMemory?.category : undefined}
          initialArea={pendingSave.source === 'pick' ? pickMemory?.area : undefined}
          guidance={pendingSave.source === 'pick'
            ? 'This came from the group’s Pick. Confirm or rewrite it before it becomes your private place memory.'
            : undefined}
          actionLabel={pendingSave.source === 'pick'
            ? `Keep as ${pendingSave.tag === 'loved' ? 'Loved' : 'Tried'} for me`
            : `Keep as ${pendingSave.tag[0].toUpperCase()}${pendingSave.tag.slice(1)}`}
          busy={setTag.isPending || pickStatus.isPending}
          locked={Boolean(pendingKeepFailure)}
          onConfirm={memory => void confirmMemory(memory)}
          onCancel={() => setPendingSave(null)}
        />
        </>
      )}

      {/* Your Want / Tried / Loved + the door out. */}
      <div className="closeup-actions" hidden={Boolean(pendingSave) || personalDataUnavailable}>
        {pick?.status === 'dismissed' && <p className="eyebrow closeup-actions-label">YOUR PRIVATE KEEP</p>}
        {(!pick || pick.status === 'dismissed') && (
          <div
            className="seg"
            role="group"
            aria-label={pick?.status === 'dismissed' ? 'Save privately to your Keep as' : 'Save as'}
          >
            {TAGS.map(t => (
              <button
                key={t}
                className={`seg-tab press${myTag === t ? ' is-active' : ''}`}
                aria-pressed={myTag === t}
                disabled={personalWriteFrozen}
                onClick={() => onTag(t)}
              >
                {t}
              </button>
            ))}
          </div>
        )}
        {!hasOpenPick && (
          <a
            className={`pill ${pick?.status === 'dismissed' ? 'pill-ghost' : 'pill-primary'} press`}
            href={mapsDeepLink(name, rawPid(id))}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={pick?.status === 'dismissed'
              ? 'Directions for me in Google Maps (opens a new tab)'
              : 'Directions in Google Maps (opens a new tab)'}
            onClick={() => haptics.tap()}
          >
            {pick?.status === 'dismissed' ? 'Directions for me ↗' : 'Directions ↗'}
          </a>
        )}
      </div>

      {keepTagFailure && (
        <section className="closeup-data-warning" role="alert" aria-label="Keep change not confirmed">
          <span>
            <strong className="t-row-title">Keep change not confirmed.</strong>
            <span className="t-small">
              We couldn’t confirm whether {myMemory?.label ?? 'this place'} changed to {keepTagFailure.tag}. Checking again can only repeat that exact choice; it cannot share the place with a new group or change another place.
            </span>
          </span>
          <button
            ref={keepMutationRecoveryButtonRef}
            className="pill pill-primary press"
            disabled={setTag.isPending}
            onClick={() => runTagAttempt(keepTagFailure)}
          >{setTag.isPending ? 'Checking…' : `Check ${keepTagFailure.tag}`}</button>
        </section>
      )}

      {keepRemovalFailure && mySave && (
        <section className="closeup-data-warning" role="alert" aria-label="Keep removal not confirmed">
          <span>
            <strong className="t-row-title">Keep removal not confirmed.</strong>
            <span className="t-small">
              We couldn’t confirm whether {myMemory?.label ?? 'this place'} was removed. Checking again can only finish removing this place from Keep and its existing group shares; it cannot remove another place or group membership.
            </span>
          </span>
          <button
            ref={keepMutationRecoveryButtonRef}
            className="pill pill-primary press"
            disabled={unsave.isPending}
            onClick={() => runRemovalAttempt(keepRemovalFailure)}
          >{unsave.isPending ? 'Checking…' : 'Check removal'}</button>
        </section>
      )}

      {keepMemoryFailure && (
        <section className="closeup-data-warning" role="alert" aria-label="Place details not confirmed">
          <span>
            <strong className="t-row-title">Place details not confirmed.</strong>
            <span className="t-small">
              We couldn’t confirm the reviewed label, kind, and area for {keepMemoryFailure.label}. Checking again can only repeat those exact details; existing group shares may follow the correction, but no new group receives the place.
            </span>
          </span>
          <button
            ref={keepMutationRecoveryButtonRef}
            className="pill pill-primary press"
            disabled={memoryEdit.isPending}
            onClick={() => memoryEdit.mutate(keepMemoryFailure)}
          >{memoryEdit.isPending ? 'Checking…' : 'Check details'}</button>
        </section>
      )}

      {keepNoteFailure && (
        <section className="closeup-data-warning" role="alert" aria-label="Private note not confirmed">
          <span>
            <strong className="t-row-title">Note not confirmed.</strong>
            <span className="t-small">
              We couldn’t confirm the note shown below. Checking again can only repeat that exact private note; a group sees it only where you had already chosen to include notes.
            </span>
          </span>
          <button
            ref={keepMutationRecoveryButtonRef}
            className="pill pill-primary press"
            disabled={noteChecking}
            onClick={retryNoteCommit}
          >{noteChecking ? 'Checking…' : 'Check note'}</button>
        </section>
      )}

      {keepObservationFailure && (
        <section className="closeup-data-warning" role="alert" aria-label="Useful detail not confirmed">
          <span>
            <strong className="t-row-title">Useful detail not confirmed.</strong>
            <span className="t-small">
              We couldn’t confirm {observationRecoveryDescription}. Checking again can only repeat that exact detail; a group sees it only where useful details were already included.
            </span>
          </span>
          <button
            ref={keepMutationRecoveryButtonRef}
            className="pill pill-primary press"
            disabled={observationSave.isPending}
            onClick={() => observationSave.mutate(keepObservationFailure.observations)}
          >{observationSave.isPending ? 'Checking…' : 'Check detail'}</button>
        </section>
      )}

      {mySave && (
        <details
          className={`closeup-personal-memory${hasOpenPick ? ' is-secondary' : ' is-primary'}`}
          open={hasOpenPick ? undefined : true}
        >
          <summary>
            <span className="closeup-personal-memory-copy">
              <span className="eyebrow">YOUR PRIVATE KEEP</span>
              <span className="t-small">
                {myTag ? `${myTag[0].toUpperCase()}${myTag.slice(1)} stays yours.` : 'Your place memory stays yours.'}
                {' '}Open only if you want to edit it during this shared Pick.
              </span>
            </span>
            <span className="closeup-personal-memory-mark" aria-hidden="true">+</span>
          </summary>
          <div className="closeup-personal-memory-body">
          {editingMemory && myMemory ? (
            <PlaceMemoryConfirmation
              placeId={id}
              initialLabel={myMemory.label}
              initialCategory={myMemory.category}
              initialArea={myMemory.area}
              actionLabel="Save place details"
              busy={memoryEdit.isPending}
              locked={Boolean(keepMemoryFailure)}
              onConfirm={memory => memoryEdit.mutate(memory)}
              onCancel={closeMemoryEditor}
            />
          ) : (
            <>
              {myMemory && (
                <section className="closeup-memory-details" aria-labelledby="closeup-memory-details-title">
                  <span>
                    <p id="closeup-memory-details-title" className="eyebrow">YOUR PLACE DETAILS</p>
                    <p className="t-small">
                      {myMemory.category}{myMemory.area ? ` · ${myMemory.area}` : ' · no area added'}
                      {' · '}user-confirmed
                    </p>
                  </span>
                  <button
                    className="toast-ghost press"
                    disabled={personalWriteFrozen}
                    onClick={openMemoryEditor}
                  >Edit</button>
                </section>
              )}
              {visibility === 'circle' && (
                <section className="signal-visibility" aria-labelledby="legacy-sharing-title">
                  <p className="eyebrow">OLDER SHARING</p>
                  <h2 id="legacy-sharing-title" className="t-row-title">Still shared outside groups</h2>
                  <p className="t-small signal-visibility-copy">
                    This older save may still be visible to accepted connections. Making it private
                    keeps any exact group shares below.
                  </p>
                  <button
                    ref={legacyVisibilityRecoveryButtonRef}
                    className="pill pill-primary press"
                    disabled={personalWriteFrozen && !legacyVisibilityFailure || retireLegacyVisibility.isPending}
                    onClick={() => retireLegacyVisibility.mutate()}
                  >
                    {retireLegacyVisibility.isPending
                      ? legacyVisibilityFailure ? 'Checking…' : 'Making private…'
                      : legacyVisibilityFailure ? 'Check privacy' : 'Make this place private'}
                  </button>
                  {legacyVisibilityFailure && (
                    <p className="t-small pick-return-error" role="alert">
                      We couldn’t confirm whether older connection sharing was removed. Checking again can only repeat this same privacy change; it cannot remove the place from Keep or any group.
                    </p>
                  )}
                </section>
              )}
              {(reviewGroupSharing || activeGroups.length > 0) && (
                <section
                  ref={groupSharingSectionRef}
                  className={`group-signal-sharing${reviewGroupSharing ? ' is-handoff' : ''}`}
                  aria-labelledby="group-signal-sharing-title"
                  tabIndex={reviewGroupSharing ? -1 : undefined}
                >
                  <p className="eyebrow">SHARE WITH A GROUP</p>
                  <h2 id="group-signal-sharing-title" className="group-signal-sharing-title">Private for now</h2>
                  <p className="t-small">Only groups you choose below can see this place. Joining a group never exposes it.</p>
                  {groupDirectoryPending ? (
                    <p className="t-small" role="status">Checking your active groups…</p>
                  ) : groupDirectoryUnavailable ? (
                    <div className="closeup-data-warning" role="alert">
                      <span>
                        <strong className="t-row-title">Groups couldn’t be checked.</strong>
                        <span className="t-small">This place is still private. No sharing choice is being guessed.</span>
                      </span>
                      <button className="pill pill-ghost press" onClick={() => void groupsQuery.refetch()}>Check groups</button>
                    </div>
                  ) : activeGroups.length === 0 ? (
                    <div className="closeup-data-warning" role="status">
                      <span>
                        <strong className="t-row-title">Private for now.</strong>
                        <span className="t-small">Join or create an active group before choosing who receives this place.</span>
                      </span>
                      <Link className="pill pill-ghost press" to="/people">Open People</Link>
                    </div>
                  ) : shareStatesUnavailable ? (
                    <div className="closeup-data-warning" role="alert">
                      <span>
                        <strong className="t-row-title">Group sharing couldn’t be checked.</strong>
                        <span className="t-small">No group is being labeled shared or not shared. Nothing was changed.</span>
                      </span>
                      <button className="pill pill-ghost press" onClick={retryGroupShareStates}>Check sharing</button>
                    </div>
                  ) : shareStatesPending ? (
                    <p className="t-small" role="status">Checking the exact groups that have this place…</p>
                  ) : (
                    <>
                      {(note.trim().length > 0 || Object.keys(mySave.observations ?? {}).length > 0) && (
                        <p className="t-small group-sharing-options-help">Choose what comes with the place when you share or update it.</p>
                      )}
                      <div className="group-share-list">
                        {activeGroups.map(group => {
                          const shareState = shareStates.find(state => state.groupId === group.id)
                          const shared = Boolean(shareState)
                          const shareOptions = groupShareOptions[group.id] ?? {
                            includeNote: Boolean(shareState?.includeNote),
                            includeObservations: Boolean(shareState?.includeObservations),
                          }
                          const included = [
                            shareState?.includeNote ? 'note' : null,
                            shareState?.includeObservations ? 'useful details' : null,
                          ].filter(Boolean)
                          const nextIncluded = [
                            shareOptions.includeNote ? 'note' : null,
                            shareOptions.includeObservations ? 'useful details' : null,
                          ].filter(Boolean)
                          const optionsChanged = shared && (
                            shareOptions.includeNote !== Boolean(shareState?.includeNote)
                            || shareOptions.includeObservations !== Boolean(shareState?.includeObservations)
                          )
                          const setShareOption = (key: keyof GroupShareOptions, value: boolean) => {
                            setGroupShareOptions(current => ({
                              ...current,
                              [group.id]: { ...shareOptions, [key]: value },
                            }))
                          }
                          const uncertainAttempt = groupShareFailure?.groupId === group.id
                            ? groupShareFailure
                            : null
                          const audienceRefresh = groupShareAudienceRefresh?.attempt.groupId === group.id
                            ? groupShareAudienceRefresh
                            : null
                          const checkLabel = uncertainAttempt?.operation === 'remove'
                            ? 'Check removal'
                            : uncertainAttempt?.operation === 'update'
                            ? 'Check included details'
                            : 'Check sharing'
                          const checkAriaLabel = `${checkLabel} with ${group.name}`
                          const exactIncluded = uncertainAttempt
                            ? [
                              uncertainAttempt.includeNote ? 'your note' : null,
                              uncertainAttempt.includeObservations ? 'your useful details' : null,
                            ].filter(Boolean)
                            : []
                          return (
                            <div
                              ref={group.id === checkGroupShareId ? groupShareHandoffRowRef : undefined}
                              className={`group-share-item${group.id === checkGroupShareId ? ' is-handoff' : ''}`}
                              aria-label={`${group.name} sharing`}
                              tabIndex={group.id === checkGroupShareId ? -1 : undefined}
                              key={group.id}
                            >
                              <span className="group-share-copy">
                                <strong>{group.name}</strong>
                                <small aria-live="polite">
                                  {audienceRefresh
                                    ? 'Sharing circle needs review'
                                    : uncertainAttempt
                                    ? 'Share status unknown'
                                    : shared
                                    ? `Shared · ${included.length > 0 ? `${included.join(' + ')} included` : 'place only'}`
                                    : 'Not shared with this group'}
                                </small>
                              </span>
                              <button
                                ref={element => {
                                  if (!uncertainAttempt) return
                                  groupShareRecoveryButtonRef.current = element
                                  if (element && !groupShare.isPending) {
                                    window.requestAnimationFrame(() => window.requestAnimationFrame(() => element.focus()))
                                  }
                                }}
                                className={`pill press${shared && !uncertainAttempt ? ' pill-ghost' : ' pill-primary'}`}
                                aria-label={uncertainAttempt
                                  ? checkAriaLabel
                                  : shared ? `Stop sharing with ${group.name}` : `Share with ${group.name}`}
                                disabled={personalWriteFrozen || groupShare.isPending || Boolean(groupShareAudienceRefresh) || Boolean(groupShareFailure && !uncertainAttempt)}
                                onClick={() => uncertainAttempt
                                  ? groupShare.mutate({ ...uncertainAttempt, checkingUnknown: true })
                                  : requestGroupShare(group, {
                                    groupId: group.id,
                                    operation: shared ? 'remove' : 'share',
                                    includeNote: shareOptions.includeNote,
                                    includeObservations: shareOptions.includeObservations,
                                  })}
                              >
                                {groupShare.isPending && (groupShare.variables?.groupId === group.id)
                                  ? uncertainAttempt ? 'Checking…' : 'Changing…'
                                  : uncertainAttempt ? checkLabel : shared ? 'Stop sharing' : 'Share place'}
                              </button>
                              {!uncertainAttempt && (note.trim().length > 0 || Object.keys(mySave.observations ?? {}).length > 0) && (
                                <div className="group-share-options">
                                  {note.trim().length > 0 && (
                                    <label className="group-note-choice">
                                      <input
                                        type="checkbox"
                                        aria-label={`Include my current note with ${group.name}`}
                                        checked={shareOptions.includeNote}
                                        disabled={personalWriteFrozen || groupShare.isPending || Boolean(groupShareFailure || groupShareAudienceRefresh)}
                                        onChange={event => setShareOption('includeNote', event.target.checked)}
                                      />
                                      <span className="t-small">Include current note</span>
                                    </label>
                                  )}
                                  {Object.keys(mySave.observations ?? {}).length > 0 && (
                                    <label className="group-note-choice">
                                      <input
                                        type="checkbox"
                                        aria-label={`Include my useful details with ${group.name}`}
                                        checked={shareOptions.includeObservations}
                                        disabled={personalWriteFrozen || groupShare.isPending || Boolean(groupShareFailure || groupShareAudienceRefresh)}
                                        onChange={event => setShareOption('includeObservations', event.target.checked)}
                                      />
                                      <span className="t-small">Include useful details</span>
                                    </label>
                                  )}
                                </div>
                              )}
                              {optionsChanged && !uncertainAttempt && !groupShareFailure && (
                                <button
                                  className="toast-ghost press group-share-update"
                                  aria-label={`Update ${group.name}: ${nextIncluded.length > 0 ? nextIncluded.join(' + ') : 'place only'}`}
                                  disabled={personalWriteFrozen || groupShare.isPending || Boolean(groupShareAudienceRefresh)}
                                  onClick={() => requestGroupShare(group, {
                                    groupId: group.id,
                                    operation: 'update',
                                    includeNote: shareOptions.includeNote,
                                    includeObservations: shareOptions.includeObservations,
                                  })}
                                >Update: {nextIncluded.length > 0 ? nextIncluded.join(' + ') : 'place only'}</button>
                              )}
                              {uncertainAttempt && (
                                <p className="t-small pick-return-error" role="alert">
                                  {uncertainAttempt.operation === 'remove'
                                    ? `We couldn’t confirm whether ${myMemory?.label ?? 'this place'} stopped being shared with ${group.name}. Checking again can only repeat this same removal; it cannot remove the place from Keep or another group.`
                                    : uncertainAttempt.operation === 'update'
                                    ? `We couldn’t confirm whether ${group.name} received the reviewed included details. Checking again can only repeat this same update${exactIncluded.length > 0 ? ` with ${exactIncluded.join(' and ')}` : ' as place only'}; it cannot share with another group or change Keep.`
                                    : `We couldn’t confirm whether ${myMemory?.label ?? 'this place'} was shared with ${group.name}. Checking again can only repeat this same share${exactIncluded.length > 0 ? ` with ${exactIncluded.join(' and ')}` : ' as place only'}; it cannot share with another group or change Keep.`}
                                </p>
                              )}
                              {audienceRefresh && (
                                <div className="group-share-audience-recovery" role="alert">
                                  <p className="t-small pick-return-error">
                                    The earlier circle was not reused. This place stays private to its last confirmed audiences until the current people are shown to you.
                                  </p>
                                  <button
                                    ref={groupShareRecoveryButtonRef}
                                    className="toast-ghost press"
                                    disabled={audienceRefresh.status === 'checking'}
                                    onClick={() => void refreshGroupShareAudience(
                                      audienceRefresh.attempt,
                                      Boolean(audienceRefresh.attempt.checkingUnknown),
                                    )}
                                  >{audienceRefresh.status === 'checking' ? 'Checking circle…' : 'Check circle'}</button>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                      {shareStatesStale && (
                        <div className="closeup-data-warning" role="status">
                          <span>
                            <strong className="t-row-title">Showing the last confirmed sharing.</strong>
                            <span className="t-small">A refresh failed; no group has been relabeled.</span>
                          </span>
                          <button className="pill pill-ghost press" onClick={retryGroupShareStates}>Check again</button>
                        </div>
                      )}
                    </>
                  )}
                </section>
              )}
              <section className="place-note-editor" aria-labelledby="place-note-title">
                <div className="place-note-head">
                  <span>
                    <p id="place-note-title" className="eyebrow">
                      {visibility === 'circle' ? 'LEGACY-SHARED NOTE' : 'PRIVATE NOTE'}
                    </p>
                    <p id="place-note-help" className="t-small">
                      {visibility === 'circle'
                        ? 'This older save may still expose its note to accepted legacy connections. Use the privacy cleanup above before treating it as private.'
                        : `What to order, when it works, or why you’d return. Private unless you include it with a group; candidate cards show at most ${SHARED_PLACE_NOTE_MAX_LENGTH} characters.`}
                    </p>
                  </span>
                  <small className="place-note-count" aria-label={`${note.length} of ${PRIVATE_PLACE_NOTE_MAX_LENGTH} characters`}>
                    {note.length}/{PRIVATE_PLACE_NOTE_MAX_LENGTH}
                  </small>
                </div>
                <textarea
                  ref={noteRef}
                  className="closeup-note"
                  aria-label={visibility === 'circle' ? 'A note shared with legacy connections' : 'A private note'}
                  aria-describedby="place-note-help"
                  placeholder="e.g. order the cardamom bun after practice…"
                  value={note}
                  disabled={personalWriteFrozen}
                  maxLength={PRIVATE_PLACE_NOTE_MAX_LENGTH}
                  onChange={e => { noteDirty.current = true; setNote(e.target.value) }}
                  onBlur={() => { void commitNote().catch(() => haptics.warn()) }}
                  rows={2}
                />
              </section>
          <PlaceObservationsEditor
            observations={mySave.observations ?? {}}
            busy={observationSave.isPending}
            locked={personalWriteFrozen}
            onChange={observations => observationSave.mutate(observations)}
          />
          <button className="toast-ghost press closeup-remove" disabled={personalWriteFrozen} onClick={onRemove}>
            Remove from Keep
          </button>
            </>
          )}
          </div>
        </details>
      )}

      <p className="t-small closeup-attcol">
        Place data: <span className="google-mark">Google Maps</span>
        {photo.credit ? ` · photo ${photo.credit}` : ''}
      </p>

      {groupShareAudienceReview && (
        <GroupAudienceConfirmation
          group={groupShareAudienceReview.group}
          sharingLabel="place"
          operation={groupShareAudienceReview.attempt.operation === 'update' ? 'update' : 'share'}
          includeCurrentNote={groupShareAudienceReview.attempt.includeNote}
          includeUsefulDetails={groupShareAudienceReview.attempt.includeObservations}
          changed={groupShareAudienceReview.changed}
          onWait={() => {
            setGroupShareAudienceReview(null)
            haptics.tap()
          }}
          onConfirm={confirmGroupShareAudience}
        />
      )}

    </div>
  )
}
