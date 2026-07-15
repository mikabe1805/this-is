import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Avatar } from '../components/Avatar'
import { groupUpdatedAtMillis, type ActiveGroupPickSummary, type GroupCircle, type GroupSummary } from '../domain/groups'
import {
  buildGroupRecommendations,
  sparseGroupRecovery,
  type GroupRecommendation,
  type SparseGroupRecovery,
} from '../domain/groupRecommendation'
import { PLAN_CONTEXTS, type PlanContext } from '../domain/recommendation'
import {
  prototypeActivePickStorageKey,
  prototypeFailure,
  prototypeKind,
  prototypeRecentPickStorageKey,
} from '../lib/prototypeMode'
import { useGroup } from '../data/queries'
import { isPermissionDeniedError } from '../domain/dataState'
import {
  fetchGroupAudienceFromServer,
  leaveGroup,
  saveGroupQuickStart,
  updateGroupDraftPass,
  GroupRequestError,
  type GroupDraftPassInput,
} from '../data/groups'
import { haptics } from '../lib/haptics'
import { useSession } from '../state/session'
import { createGroupPick, PickRequestError } from '../data/picks'
import { track } from '../data/analytics'
import { GroupQuickStart } from '../components/GroupQuickStart'
import type { GroupQuickStartCategory, GroupQuickStartConstraint } from '../domain/groupQuickStart'
import { GroupCandidateCard } from '../components/GroupCandidateCard'
import { GroupInviteManager } from '../components/GroupInviteManager'
import { EXPLICIT_PLAN_AREA_MAX_LENGTH, normalizeExplicitPlanArea } from '../domain/planArea'
import { PLACE_OBSERVATION_LABELS, type PlaceObservationKey } from '../domain/placeObservations'
import { PickContextChips } from '../components/PickContextChips'
import { signIn } from '../lib/authWatch'
import { useGroupDraftPasses } from '../lib/useGroupDraftPasses'
import type { GroupDraftIdentity } from '../domain/groupDraft'
import type { GroupPick } from '../domain/picks'
import { useTransientGroupPlan } from '../state/useTransientGroupPlan'
import { GroupAudienceConfirmation } from '../components/GroupAudienceConfirmation'
import { buildGroupAudienceStamp, type GroupAudienceStamp } from '../domain/groupAudience'

const PLAN_REQUIREMENT_KEYS: PlaceObservationKey[] = [
  'family_friendly', 'quiet', 'easy_parking', 'outdoors', 'special_occasion',
]

const QUICK_START_CATEGORY_LABELS: Record<GroupQuickStartCategory, string> = {
  food: 'Food', coffee: 'Coffee', activity: 'Things to do',
}

const pendingPickKey = (groupId: string) => `__this_is_pending_group_pick:${groupId}`
const pendingLeaveKey = (groupId: string) => `__this_is_pending_group_leave:${groupId}`
const pendingQuickStartKey = (groupId: string) => `__this_is_pending_quick_start:${groupId}`

interface DraftPassAttempt {
  request: GroupDraftPassInput
  placeName: string
}

interface DraftPassFailure extends DraftPassAttempt {
  kind: 'unknown' | 'changed'
}

interface QuickStartValue {
  categoryHints: GroupQuickStartCategory[]
  constraintHints: GroupQuickStartConstraint[]
}

interface QuickStartAttempt extends QuickStartValue {
  groupId: string
  targetEpoch: number
  audience: GroupAudienceStamp
  checkingUnknown?: boolean
}

interface QuickStartRemovalAttempt {
  groupId: string
  targetEpoch: number
}

interface QuickStartAudienceReview {
  group: GroupSummary
  groupId: string
  targetEpoch: number
  value: QuickStartValue
  changed: boolean
}

interface QuickStartAudienceRefresh {
  attempt: QuickStartAttempt
  status: 'checking' | 'failed'
}

function recoverQuickStartFailure(groupId: string): 'save' | 'remove' | null {
  try {
    const pending = window.sessionStorage.getItem(pendingQuickStartKey(groupId))
    if (pending === 'save-committed') return 'save'
    if (pending === 'remove-committed') return 'remove'
  } catch { /* operation kind contains no taste data */ }
  return null
}

function sameQuickStartValue(
  current: { categoryHints: GroupQuickStartCategory[]; constraintHints: GroupQuickStartConstraint[] } | undefined,
  expected: QuickStartValue,
): boolean {
  if (!current) return false
  const categories = [...current.categoryHints].sort()
  const expectedCategories = [...expected.categoryHints].sort()
  const constraints = [...current.constraintHints].sort()
  const expectedConstraints = [...expected.constraintHints].sort()
  return categories.length === expectedCategories.length
    && categories.every((value, index) => value === expectedCategories[index])
    && constraints.length === expectedConstraints.length
    && constraints.every((value, index) => value === expectedConstraints[index])
}

function recoverPickCreationKey(groupId: string): string {
  try {
    return window.sessionStorage.getItem(pendingPickKey(groupId)) ?? crypto.randomUUID()
  } catch {
    return crypto.randomUUID()
  }
}

function sparseRecoveryCopy(recovery: SparseGroupRecovery): { heading: string; body: string } {
  if (recovery.kind === 'answerable_want') {
    return {
      heading: 'One shared place needs your honest answer.',
      body: `${recovery.authorName} wants to try ${recovery.placeLabel}. If ${QUICK_START_CATEGORY_LABELS[recovery.category]} generally sounds good to you, Quick start can let this.is show it with both reasons named. Otherwise, add a place you honestly want or love.`,
    }
  }
  if (recovery.kind === 'own_want') {
    const independentHint = recovery.category
      ? ` or independently chooses ${QUICK_START_CATEGORY_LABELS[recovery.category]} in Quick start`
      : ''
    return {
      heading: 'Your place needs one more reason.',
      body: `You want to try ${recovery.placeLabel}. It can appear when another person also Wants or Loves it${independentHint}. There is no need to upgrade your answer just to create a result.`,
    }
  }
  if (recovery.kind === 'other_want') {
    return {
      heading: 'One shared place needs another reason.',
      body: `${recovery.authorName} wants to try ${recovery.placeLabel}, but no one else has supplied a reason yet. Add a place you honestly want or love; you never need to agree just to create an answer.`,
    }
  }
  if (recovery.kind === 'memory_only') {
    return {
      heading: 'Tried is memory, not a group reason.',
      body: 'The group has shared Tried places, but Tried records personal history rather than support. Add a Want or Love when one comes to mind.',
    }
  }
  return {
    heading: 'Shared places need another reason.',
    body: 'A place appears with two people’s Want or Love, one member’s Love, or a Want plus another attendee’s matching Quick start hint. Tried stays memory, not support.',
  }
}

export default function Group() {
  const { groupId = '' } = useParams<{ groupId: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const session = useSession()
  const {
    draft: transientGroupPlan,
    rememberDraft: rememberTransientGroupPlan,
    consumeDraft: consumeTransientGroupPlan,
    clearDraft: clearTransientGroupPlan,
  } = useTransientGroupPlan()
  const myUid = session.status === 'signed-in' ? session.user.uid : null
  const groupQuery = useGroup(groupId)
  const prototype = prototypeKind() === 'group'
  const prototypeGroups = queryClient.getQueryData<GroupCircle[]>(['prototypeGroups']) ?? []
  const group = prototype
    ? prototypeGroups.find(item => item.id === groupId)
    : groupQuery.data ?? undefined
  const myTaste = group?.tastes.find(taste => taste.uid === myUid)
  const [context, setContext] = useState<PlanContext>('Anything')
  const [planArea, setPlanArea] = useState('')
  const [requiredObservation, setRequiredObservation] = useState<PlaceObservationKey | null>(null)
  const [pickedId, setPickedId] = useState<string | null>(null)
  const [excludedAttendeeUids, setExcludedAttendeeUids] = useState<Set<string>>(() => new Set())
  const welcomeStep: 'choices' | 'quick' = searchParams.get('welcome') === 'quick' ? 'quick' : 'choices'
  const [guestIncluded, setGuestIncluded] = useState(false)
  const [passedPlaces, setPassedPlaces] = useState<Record<string, string>>({})
  const [pendingPass, setPendingPass] = useState<GroupRecommendation | null>(null)
  const [draftPassFailure, setDraftPassFailure] = useState<DraftPassFailure | null>(null)
  const [confirmingLeave, setConfirmingLeave] = useState(false)
  const [leaveFailure, setLeaveFailure] = useState<'unknown' | null>(null)
  const [quickStartFailure, setQuickStartFailure] = useState<'save' | 'remove' | null>(null)
  const [pendingQuickStartAttempt, setPendingQuickStartAttempt] = useState<QuickStartAttempt | null>(null)
  const [pendingQuickStartRemovalAttempt, setPendingQuickStartRemovalAttempt] = useState<QuickStartRemovalAttempt | null>(null)
  const [lostQuickStartRecovery, setLostQuickStartRecovery] = useState<'save' | 'remove' | null>(
    () => recoverQuickStartFailure(groupId),
  )
  const [quickStartAudienceReview, setQuickStartAudienceReview] = useState<QuickStartAudienceReview | null>(null)
  const [quickStartAudienceRefresh, setQuickStartAudienceRefresh] = useState<QuickStartAudienceRefresh | null>(null)
  const [pickCommitFailure, setPickCommitFailure] = useState<'unknown' | 'changed' | null>(null)
  const [planContinuityNotice, setPlanContinuityNotice] = useState<string | null>(null)
  const trackedPlanGroupRef = useRef<string | null>(null)
  const passLedgerRef = useRef<HTMLElement>(null)
  const draftPassRecoveryButtonRef = useRef<HTMLButtonElement>(null)
  const deferredPassFocusRef = useRef<{ kind: 'ledger' | 'candidate'; placeId: string } | null>(null)
  const leaveButtonRef = useRef<HTMLButtonElement>(null)
  const pickCommitButtonRef = useRef<HTMLButtonElement>(null)
  const pickCreationKeyRef = useRef(recoverPickCreationKey(groupId))
  const prototypePickCommitRef = useRef<GroupPick | null>(null)
  const prototypeLeaveCommitRef = useRef(false)
  const prototypeQuickStartCommitRef = useRef<'save' | 'remove' | null>(recoverQuickStartFailure(groupId))
  const prototypeQuickStartAudienceChangedRef = useRef(false)
  const quickStartTargetRef = useRef(groupId)
  const currentGroupIdRef = useRef(groupId)
  const currentGroupIdentityRef = useRef({ groupId, epoch: 0 })
  const prototypeDraftPassResponseLostRef = useRef(new Set<string>())
  const restoredTransientPlanRef = useRef<string | null>(null)
  const departingForDiscoveryRef = useRef(false)

  useLayoutEffect(() => {
    currentGroupIdRef.current = groupId
    if (currentGroupIdentityRef.current.groupId !== groupId) {
      currentGroupIdentityRef.current = {
        groupId,
        epoch: currentGroupIdentityRef.current.epoch + 1,
      }
    }
    if (quickStartTargetRef.current === groupId) return
    const previousGroupId = quickStartTargetRef.current
    quickStartTargetRef.current = groupId
    setQuickStartFailure(null)
    setPendingQuickStartAttempt(null)
    setPendingQuickStartRemovalAttempt(null)
    setLostQuickStartRecovery(null)
    setQuickStartAudienceReview(null)
    setQuickStartAudienceRefresh(null)
    prototypeQuickStartCommitRef.current = null
    prototypeQuickStartAudienceChangedRef.current = false
    try { window.sessionStorage.removeItem(pendingQuickStartKey(previousGroupId)) } catch { /* operation marker only */ }
    setPlanContinuityNotice('The target group changed. Review any hint again before sharing.')
  }, [groupId])
  const openWelcomeStep = (step: 'choices' | 'quick') => {
    const next = new URLSearchParams(searchParams)
    next.set('welcome', step === 'quick' ? 'quick' : '1')
    navigate(`/g/${encodeURIComponent(groupId)}?${next.toString()}`, { replace: true })
  }
  const attendeeUids = useMemo(
    () => group?.memberUids.filter(uid => !excludedAttendeeUids.has(uid)) ?? [],
    [excludedAttendeeUids, group],
  )
  const attendeeSet = useMemo(() => new Set(attendeeUids), [attendeeUids])
  const normalizedPlanArea = normalizeExplicitPlanArea(planArea) || ''
  const planDetailsSummary = [
    normalizedPlanArea ? `Area: ${normalizedPlanArea}` : '',
    requiredObservation ? `Need: ${PLACE_OBSERVATION_LABELS[requiredObservation]}` : '',
  ].filter(Boolean).join(' · ') || 'Area or one practical need'

  const allCandidates = useMemo(
    () => group?.status === 'active' && !group.activePick && attendeeUids.length >= 2
      ? buildGroupRecommendations({
          members: group.tastes.filter(member => attendeeSet.has(member.uid)),
          context,
          guestCount: guestIncluded ? 1 : 0,
          explicitPlanArea: planArea,
          ...(requiredObservation ? { requiredObservation } : {}),
          ...(group.recentPick ? { excludePlaceIds: [group.recentPick.placeId] } : {}),
        })
      : [],
    [attendeeSet, attendeeUids.length, context, group, guestIncluded, planArea, requiredObservation],
  )
  const eligibleBeforePlan = useMemo(
    () => group?.status === 'active' && !group.activePick && attendeeUids.length >= 2
      ? buildGroupRecommendations({
          members: group.tastes.filter(member => attendeeSet.has(member.uid)),
          context: 'Anything',
          guestCount: guestIncluded ? 1 : 0,
          ...(group.recentPick ? { excludePlaceIds: [group.recentPick.placeId] } : {}),
        })
      : [],
    [attendeeSet, attendeeUids.length, group, guestIncluded],
  )
  const candidatePlaceIds = useMemo(
    () => allCandidates.map(candidate => candidate.save.placeId),
    [allCandidates],
  )
  const draftIdentity = useMemo<GroupDraftIdentity | null>(() => {
    const evidenceUpdatedAt = groupUpdatedAtMillis(group?.updatedAt)
    if (!group || group.status !== 'active' || group.activePick || attendeeUids.length < 2 || evidenceUpdatedAt <= 0) {
      return null
    }
    return {
      permissionVersion: group.permissionVersion,
      evidenceUpdatedAt,
      attendeeUids,
      guestCount: guestIncluded ? 1 : 0,
      context,
      planArea: normalizedPlanArea,
      ...(requiredObservation ? { requiredObservation } : {}),
      ...(group.recentPick ? { recentPlaceId: group.recentPick.placeId } : {}),
    }
  }, [attendeeUids, context, group, guestIncluded, normalizedPlanArea, requiredObservation])
  const sharedDraft = useGroupDraftPasses({
    enabled: !prototype,
    groupId,
    identity: draftIdentity,
    candidatePlaceIds,
  })
  const passedPlaceIds = useMemo(() => new Set(prototype
    ? Object.keys(passedPlaces)
    : sharedDraft.passes
      .filter(pass => pass.draftKey === sharedDraft.draftKey && pass.permissionVersion === group?.permissionVersion)
      .map(pass => pass.placeId)), [group?.permissionVersion, passedPlaces, prototype, sharedDraft.draftKey, sharedDraft.passes])
  const candidates = allCandidates.filter(candidate => !passedPlaceIds.has(candidate.save.placeId))
  const picked = candidates.find(candidate => candidate.save.placeId === pickedId)
  const pickOperationIdentity = [
    groupId,
    pickedId ?? '',
    attendeeUids.join(','),
    context,
    guestIncluded ? '1' : '0',
    normalizedPlanArea,
    requiredObservation ?? '',
  ].join('\0')

  useEffect(() => {
    if (departingForDiscoveryRef.current) return
    if (!group || !myUid || transientGroupPlan?.groupId !== group.id) return
    if (restoredTransientPlanRef.current === group.id) return
    restoredTransientPlanRef.current = group.id
    if (group.status !== 'active' || group.activePick) {
      clearTransientGroupPlan(group.id)
      setPlanContinuityNotice('The group changed while you were away, so that temporary plan was reset.')
      return
    }
    const restored = consumeTransientGroupPlan({
      groupId: group.id,
      memberUid: myUid,
      permissionVersion: group.permissionVersion,
      memberUids: group.memberUids,
    })
    if (!restored) {
      setPlanContinuityNotice('The group changed while you were away, so that temporary plan was reset.')
      return
    }
    const restoredAttendees = new Set(restored.attendeeUids)
    setExcludedAttendeeUids(new Set(group.memberUids.filter(uid => !restoredAttendees.has(uid))))
    setGuestIncluded(restored.guestIncluded)
    setContext(restored.context)
    setPlanArea(restored.planArea)
    setRequiredObservation(restored.requiredObservation)
    setPickedId(null)
    setPendingPass(null)
    setPassedPlaces({})
    setPlanContinuityNotice('Your temporary plan is back, recomputed from the group’s current shared taste.')
  }, [clearTransientGroupPlan, consumeTransientGroupPlan, group, myUid, transientGroupPlan])

  useEffect(() => {
    if (!pickedId || pendingPass) return
    window.requestAnimationFrame(() => pickCommitButtonRef.current?.focus())
  }, [pendingPass, pickedId])

  useEffect(() => {
    if (pickedId && passedPlaceIds.has(pickedId)) setPickedId(null)
  }, [passedPlaceIds, pickedId])

  useEffect(() => {
    if (!group || group.status !== 'active' || group.activePick || attendeeUids.length < 2) return
    if (transientGroupPlan?.groupId === group.id) return
    if (trackedPlanGroupRef.current === group.id) return
    trackedPlanGroupRef.current = group.id
    // One observation per opened group decision. Do not emit plan text, people,
    // place identities, or a stream of events while someone edits the controls.
    track('plan_viewed', { context, candidateCount: allCandidates.length })
  }, [allCandidates.length, attendeeUids.length, context, group, transientGroupPlan])

  useEffect(() => {
    if (!lostQuickStartRecovery || !group) return
    const landed = lostQuickStartRecovery === 'save'
      ? Boolean(myTaste?.quickStart)
      : !myTaste?.quickStart
    if (!landed) return
    setLostQuickStartRecovery(null)
    prototypeQuickStartCommitRef.current = null
    try { window.sessionStorage.removeItem(pendingQuickStartKey(groupId)) } catch { /* operation marker only */ }
  }, [group, groupId, lostQuickStartRecovery, myTaste?.quickStart])

  const finishQuickStartSave = (value: QuickStartValue, targetGroupId: string, targetEpoch: number) => {
    if (targetGroupId !== currentGroupIdRef.current || targetEpoch !== currentGroupIdentityRef.current.epoch) return
    setQuickStartFailure(null)
    setPendingQuickStartAttempt(null)
    setLostQuickStartRecovery(null)
    setQuickStartAudienceReview(null)
    setQuickStartAudienceRefresh(null)
    prototypeQuickStartCommitRef.current = null
    try { window.sessionStorage.removeItem(pendingQuickStartKey(targetGroupId)) } catch { /* no durable personal data */ }
    if (prototype && group && myUid) {
      queryClient.setQueryData<GroupCircle[]>(['prototypeGroups'], current =>
        (current ?? []).map(item => item.id !== group.id ? item : {
          ...item,
          membershipLocked: true,
          tastes: item.tastes.map(taste => taste.uid !== myUid ? taste : {
            ...taste,
            quickStart: {
              uid: myUid,
              ...value,
              permissionVersion: item.permissionVersion,
            },
          }),
        }))
    } else {
      void queryClient.invalidateQueries({ queryKey: ['group', targetGroupId] })
      void queryClient.invalidateQueries({ queryKey: ['groups'] })
    }
    haptics.success()
    navigate(`/g/${targetGroupId}`, { replace: true })
  }

  const refreshQuickStartAudience = async (attempt: QuickStartAttempt) => {
    if (attempt.groupId !== currentGroupIdRef.current || attempt.targetEpoch !== currentGroupIdentityRef.current.epoch) {
      setQuickStartAudienceRefresh(null)
      setPendingQuickStartAttempt(null)
      setPlanContinuityNotice('The target group changed. Nothing was replayed; review the hint again.')
      return
    }
    const value: QuickStartValue = {
      categoryHints: attempt.categoryHints,
      constraintHints: attempt.constraintHints,
    }
    setQuickStartAudienceRefresh({ attempt, status: 'checking' })
    try {
      const currentAudience = prototype
        ? queryClient.getQueryData<GroupCircle[]>(['prototypeGroups'])?.find(item => item.id === attempt.groupId) ?? null
        : myUid ? await fetchGroupAudienceFromServer(attempt.groupId, myUid) : null
      if (attempt.groupId !== currentGroupIdRef.current || attempt.targetEpoch !== currentGroupIdentityRef.current.epoch) return
      if (!currentAudience) throw new Error('group-audience-unavailable')

      if (attempt.checkingUnknown) {
        const currentCircle = prototype
          ? currentAudience as GroupCircle
          : (await groupQuery.refetch()).data ?? null
        if (attempt.groupId !== currentGroupIdRef.current || attempt.targetEpoch !== currentGroupIdentityRef.current.epoch) return
        const currentTaste = currentCircle?.tastes.find(taste => taste.uid === myUid)?.quickStart
        if (currentTaste?.permissionVersion === attempt.audience.permissionVersion
          && sameQuickStartValue(currentTaste, value)) {
          finishQuickStartSave(value, attempt.groupId, attempt.targetEpoch)
          return
        }
      }

      if (attempt.groupId !== currentGroupIdRef.current || attempt.targetEpoch !== currentGroupIdentityRef.current.epoch) return
      setQuickStartAudienceRefresh(null)
      setQuickStartAudienceReview({
        group: currentAudience,
        groupId: attempt.groupId,
        targetEpoch: attempt.targetEpoch,
        value,
        changed: true,
      })
    } catch {
      if (attempt.groupId !== currentGroupIdRef.current || attempt.targetEpoch !== currentGroupIdentityRef.current.epoch) return
      setQuickStartAudienceRefresh({ attempt, status: 'failed' })
      haptics.warn()
    }
  }

  const quickStart = useMutation({
    onMutate: (attempt: QuickStartAttempt) => {
      setPendingQuickStartAttempt(attempt)
      setQuickStartFailure(null)
    },
    mutationFn: async (attempt: QuickStartAttempt) => {
      if (!group || !myUid
        || attempt.groupId !== group.id
        || attempt.groupId !== currentGroupIdRef.current
        || attempt.targetEpoch !== currentGroupIdentityRef.current.epoch) {
        throw new Error('group-target-changed')
      }
      const value: QuickStartValue = {
        categoryHints: attempt.categoryHints,
        constraintHints: attempt.constraintHints,
      }
      if (prototype && prototypeFailure('quick-start-audience-changed') && !prototypeQuickStartAudienceChangedRef.current) {
        prototypeQuickStartAudienceChangedRef.current = true
        queryClient.setQueryData<GroupCircle[]>(['prototypeGroups'], current => {
          const candidate = (current ?? []).flatMap(item => item.members)
            .find(member => !group.memberUids.includes(member.uid))
          if (!candidate) return current
          return (current ?? []).map(item => item.id !== group.id ? item : {
            ...item,
            memberUids: [...item.memberUids, candidate.uid],
            members: [...item.members, candidate],
            tastes: [...item.tastes, { uid: candidate.uid, name: candidate.displayName, saves: [] }],
          })
        })
        throw new GroupRequestError('audience-changed', 409)
      }
      if (prototype && prototypeFailure('quick-start-save-response') && prototypeQuickStartCommitRef.current === null) {
        prototypeQuickStartCommitRef.current = 'save'
        queryClient.setQueryData<GroupCircle[]>(['prototypeGroups'], current =>
          (current ?? []).map(item => item.id !== group.id ? item : {
            ...item,
            membershipLocked: true,
            tastes: item.tastes.map(taste => taste.uid !== myUid ? taste : {
              ...taste,
              quickStart: {
                uid: myUid,
                ...value,
                permissionVersion: item.permissionVersion,
              },
            }),
          }))
        try { window.sessionStorage.setItem(pendingQuickStartKey(group.id), 'save-committed') } catch { /* fixture marker contains no taste */ }
        throw new Error('prototype ambiguous Quick start response')
      }
      if (!prototype) await saveGroupQuickStart({
        groupId: attempt.groupId,
        ...value,
        audience: attempt.audience,
      })
      return attempt
    },
    onSuccess: attempt => {
      finishQuickStartSave({
        categoryHints: attempt.categoryHints,
        constraintHints: attempt.constraintHints,
      }, attempt.groupId, attempt.targetEpoch)
    },
    onError: (error, attempt) => {
      if (attempt.groupId !== currentGroupIdRef.current || attempt.targetEpoch !== currentGroupIdentityRef.current.epoch) {
        setQuickStartFailure(null)
        setPendingQuickStartAttempt(null)
        setQuickStartAudienceReview(null)
        setQuickStartAudienceRefresh(null)
        setPlanContinuityNotice('The target group changed. Nothing was replayed; review the hint for the current group again.')
        return
      }
      if (error instanceof GroupRequestError && error.code === 'audience-changed') {
        setQuickStartFailure(null)
        void refreshQuickStartAudience(attempt)
        return
      }
      setQuickStartFailure('save')
      if (!prototype) {
        void queryClient.invalidateQueries({ queryKey: ['group', groupId] })
        void queryClient.invalidateQueries({ queryKey: ['groups'] })
      }
      haptics.warn()
    },
  })
  const removeQuickStart = useMutation({
    onMutate: (attempt: QuickStartRemovalAttempt) => {
      if (attempt.groupId !== currentGroupIdRef.current
        || attempt.targetEpoch !== currentGroupIdentityRef.current.epoch) return
      setQuickStartFailure(null)
      setPendingQuickStartRemovalAttempt(attempt)
    },
    mutationFn: async (attempt: QuickStartRemovalAttempt) => {
      if (!myUid
        || attempt.groupId !== currentGroupIdRef.current
        || attempt.targetEpoch !== currentGroupIdentityRef.current.epoch) {
        throw new Error('group-target-changed')
      }
      if (prototype && prototypeFailure('quick-start-remove-response') && prototypeQuickStartCommitRef.current === null) {
        prototypeQuickStartCommitRef.current = 'remove'
        queryClient.setQueryData<GroupCircle[]>(['prototypeGroups'], current =>
          (current ?? []).map(item => item.id !== attempt.groupId ? item : {
            ...item,
            tastes: item.tastes.map(taste => taste.uid !== myUid ? taste : {
              ...taste,
              quickStart: undefined,
            }),
          }))
        try { window.sessionStorage.setItem(pendingQuickStartKey(attempt.groupId), 'remove-committed') } catch { /* fixture marker contains no taste */ }
        throw new Error('prototype ambiguous Quick start removal response')
      }
      if (!prototype) await saveGroupQuickStart({ groupId: attempt.groupId, action: 'remove' })
    },
    onSuccess: (_result, attempt) => {
      if (attempt.groupId !== currentGroupIdRef.current
        || attempt.targetEpoch !== currentGroupIdentityRef.current.epoch) return
      setQuickStartFailure(null)
      setPendingQuickStartRemovalAttempt(null)
      prototypeQuickStartCommitRef.current = null
      try { window.sessionStorage.removeItem(pendingQuickStartKey(attempt.groupId)) } catch { /* no durable personal data */ }
      if (prototype && myUid) {
        queryClient.setQueryData<GroupCircle[]>(['prototypeGroups'], current =>
          (current ?? []).map(item => item.id !== attempt.groupId ? item : {
            ...item,
            tastes: item.tastes.map(taste => taste.uid !== myUid ? taste : {
              ...taste,
              quickStart: undefined,
            }),
          }))
      } else {
        void queryClient.invalidateQueries({ queryKey: ['group', attempt.groupId] })
      }
      haptics.tap()
      navigate(`/g/${attempt.groupId}`, { replace: true })
    },
    onError: (_error, attempt) => {
      if (attempt.groupId !== currentGroupIdRef.current
        || attempt.targetEpoch !== currentGroupIdentityRef.current.epoch) return
      setQuickStartFailure('remove')
      setPendingQuickStartRemovalAttempt(attempt)
      if (!prototype) void queryClient.invalidateQueries({ queryKey: ['group', attempt.groupId] })
      haptics.warn()
    },
  })
  const requestQuickStartSave = (value: QuickStartValue) => {
    if (!group) return
    const audience = buildGroupAudienceStamp(group)
    if (!audience) {
      setPlanContinuityNotice('The sharing circle could not be confirmed. Nothing was shared; check the group and review again.')
      haptics.warn()
      return
    }
    setLostQuickStartRecovery(null)
    prototypeQuickStartCommitRef.current = null
    try { window.sessionStorage.removeItem(pendingQuickStartKey(groupId)) } catch { /* operation marker only */ }
    if (!group.membershipLocked) {
      setQuickStartAudienceReview({
        group,
        groupId: group.id,
        targetEpoch: currentGroupIdentityRef.current.epoch,
        value,
        changed: false,
      })
      return
    }
    quickStart.mutate({
      groupId: group.id,
      targetEpoch: currentGroupIdentityRef.current.epoch,
      ...value,
      audience,
    })
  }
  const confirmQuickStartAudience = () => {
    const review = quickStartAudienceReview
    if (!review
      || review.groupId !== currentGroupIdRef.current
      || review.group.id !== currentGroupIdRef.current
      || review.targetEpoch !== currentGroupIdentityRef.current.epoch) {
      setQuickStartAudienceReview(null)
      setPlanContinuityNotice('The target group changed. Nothing was shared; review the hint for the current group again.')
      return
    }
    const audience = buildGroupAudienceStamp(review.group)
    if (!audience) {
      setQuickStartAudienceReview(null)
      setPlanContinuityNotice('The sharing circle could not be confirmed. Nothing was shared; check the group and review again.')
      haptics.warn()
      return
    }
    setQuickStartAudienceReview(null)
    quickStart.mutate({
      groupId: review.groupId,
      targetEpoch: review.targetEpoch,
      ...review.value,
      audience,
    })
  }
  const makeDraftPassAttempt = (
    action: 'pass' | 'undo',
    placeId: string,
    placeName: string,
  ): DraftPassAttempt | null => {
    if (!group) return null
    const draftKey = sharedDraft.draftKey ?? (prototype ? '0'.repeat(64) : '')
    if (!draftKey) return null
    return {
      placeName,
      request: {
        groupId: group.id,
        draftKey,
        attendeeUids: [...attendeeUids],
        placeId,
        context,
        guestCount: guestIncluded ? 1 : 0,
        ...(normalizedPlanArea ? { planArea: normalizedPlanArea } : {}),
        ...(requiredObservation ? { requiredObservation } : {}),
        action,
      },
    }
  }
  const draftPassMutation = useMutation({
    mutationFn: async (attempt: DraftPassAttempt) => {
      if (!group || !myUid) throw new Error('Missing group membership.')
      const responseFixture = attempt.request.action === 'pass'
        ? 'draft-pass-save-response'
        : 'draft-pass-undo-response'
      const attemptKey = JSON.stringify(attempt.request)
      if (prototype && prototypeFailure(responseFixture)
        && !prototypeDraftPassResponseLostRef.current.has(attemptKey)) {
        prototypeDraftPassResponseLostRef.current.add(attemptKey)
        throw new Error('prototype ambiguous draft-pass response')
      }
      if (!prototype) await updateGroupDraftPass(attempt.request)
      return attempt
    },
    onSuccess: attempt => {
      setDraftPassFailure(null)
      setPendingPass(null)
      setPickedId(null)
      deferredPassFocusRef.current = {
        kind: attempt.request.action === 'pass' ? 'ledger' : 'candidate',
        placeId: attempt.request.placeId,
      }
      if (prototype) {
        setPassedPlaces(current => {
          const next = { ...current }
          if (attempt.request.action === 'pass') next[attempt.request.placeId] = attempt.placeName
          else delete next[attempt.request.placeId]
          return next
        })
      }
      haptics.tap()
    },
    onError: (error, attempt) => {
      setPendingPass(null)
      setPickedId(null)
      setDraftPassFailure({
        ...attempt,
        kind: error instanceof GroupRequestError && error.code === 'draft-version-changed'
          ? 'changed'
          : 'unknown',
      })
      haptics.warn()
    },
  })

  useLayoutEffect(() => {
    if (!draftPassFailure || draftPassMutation.isPending) return
    const button = draftPassRecoveryButtonRef.current
    if (button && !button.disabled) button.focus()
  }, [draftPassFailure, draftPassMutation.isPending])

  useLayoutEffect(() => {
    const target = deferredPassFocusRef.current
    if (!target || draftPassMutation.isPending) return
    const ready = target.kind === 'ledger'
      ? passedPlaceIds.has(target.placeId)
      : candidates.some(candidate => candidate.save.placeId === target.placeId)
    if (!ready) return
    const selector = target.kind === 'ledger' ? '[data-undo-place-id]' : '[data-pass-place-id]'
    const dataKey = target.kind === 'ledger' ? 'undoPlaceId' : 'passPlaceId'
    const root = target.kind === 'ledger' ? passLedgerRef.current : document
    const button = [...(root?.querySelectorAll<HTMLButtonElement>(selector) ?? [])]
      .find(item => item.dataset[dataKey] === target.placeId)
    if (!button) return
    button.focus()
    if (document.activeElement === button) deferredPassFocusRef.current = null
  }, [candidates, draftPassMutation.isPending, passedPlaceIds])

  const commitPick = useMutation({
    mutationFn: async (input: { candidate: GroupRecommendation; creationKey: string }) => {
      const { candidate, creationKey } = input
      if (!group || !candidate.save.memory) throw new Error('Missing group Pick evidence.')
      const attendees = group.members.filter(member => attendeeSet.has(member.uid))
      const request = {
        groupId: group.id,
        creationKey,
        attendeeUids,
        placeId: candidate.save.placeId,
        context,
        guestCount: guestIncluded ? 1 as const : 0 as const,
        ...(normalizedPlanArea ? { planArea: normalizedPlanArea } : {}),
        ...(requiredObservation ? { requiredObservation } : {}),
      }
      if (prototype && prototypeFailure('pick-create-response') && prototypePickCommitRef.current) {
        return prototypePickCommitRef.current
      }
      const pick = await createGroupPick(request, {
        kind: 'group',
        groupId: group.id,
        groupName: group.name,
        groupPermissionVersion: group.permissionVersion,
        memberUids: group.memberUids,
        attendeeUids,
        attendees,
        ...(guestIncluded ? { guestCount: 1 as const } : {}),
        placeId: candidate.save.placeId,
        memory: candidate.save.memory,
        reasonCode: candidate.reasonCode,
        reason: candidate.reason,
        context,
        ...(normalizedPlanArea ? { planArea: normalizedPlanArea } : {}),
        ...(requiredObservation ? { requiredObservation } : {}),
      })
      if (prototype && prototypeFailure('pick-create-response')) {
        prototypePickCommitRef.current = pick
        throw new Error('prototype ambiguous Pick response')
      }
      return pick
    },
    onSuccess: pick => {
      try { window.sessionStorage.removeItem(pendingPickKey(pick.groupId)) } catch { /* operation keys carry no taste data */ }
      pickCreationKeyRef.current = crypto.randomUUID()
      prototypePickCommitRef.current = null
      setPickCommitFailure(null)
      const activePick: ActiveGroupPickSummary = {
        id: pick.id,
        placeId: pick.placeId,
        label: pick.memory.label,
        attendeeCount: pick.attendeeUids.length + (pick.guestCount ?? 0),
        createdAt: pick.createdAt,
      }
      const addCurrentPick = <T extends GroupSummary>(items: T[] | undefined) =>
        (items ?? []).map(item => item.id === pick.groupId
          ? { ...item, activePick, recentPick: undefined }
          : item)
      queryClient.setQueriesData<GroupSummary[]>({ queryKey: ['groups'] }, addCurrentPick)
      queryClient.setQueriesData<GroupCircle | null>({ queryKey: ['group', pick.groupId] }, current =>
        current ? { ...current, activePick } : current)
      if (prototype) {
        window.sessionStorage.setItem(prototypeActivePickStorageKey(pick.groupId), JSON.stringify(activePick))
        window.sessionStorage.removeItem(prototypeRecentPickStorageKey(pick.groupId))
        queryClient.setQueryData<GroupCircle[]>(['prototypeGroups'], addCurrentPick)
      }
      track('pick_created', { context })
      queryClient.setQueryData(['pick', pick.id, myUid], pick)
      navigate(`/p/${pick.placeId}?pick=${pick.id}`)
    },
    onError: error => {
      haptics.warn()
      setPickCommitFailure(error instanceof PickRequestError
        && ['pick-already-open', 'pick-operation-conflict'].includes(error.code)
        ? 'changed'
        : 'unknown')
      if (!prototype) void groupQuery.refetch()
    },
  })

  const previousPickIdentityRef = useRef(pickOperationIdentity)
  useEffect(() => {
    if (previousPickIdentityRef.current === pickOperationIdentity) return
    previousPickIdentityRef.current = pickOperationIdentity
    try { window.sessionStorage.removeItem(pendingPickKey(groupId)) } catch { /* operation keys carry no taste data */ }
    pickCreationKeyRef.current = crypto.randomUUID()
    prototypePickCommitRef.current = null
    setPickCommitFailure(null)
    commitPick.reset()
  }, [commitPick, groupId, pickOperationIdentity])
  const leaveMutation = useMutation({
    mutationFn: async (targetGroupId: string) => {
      if (!prototype) {
        await leaveGroup(targetGroupId)
        return
      }
      if (prototypeFailure('leave-group-response') && !prototypeLeaveCommitRef.current) {
        prototypeLeaveCommitRef.current = true
        window.sessionStorage.setItem(pendingLeaveKey(targetGroupId), 'committed')
        throw new Error('prototype ambiguous group-leave response')
      }
    },
    onSuccess: (_data, targetGroupId) => {
      setLeaveFailure(null)
      if (prototype) {
        prototypeLeaveCommitRef.current = false
        window.sessionStorage.removeItem(pendingLeaveKey(targetGroupId))
        queryClient.setQueryData<GroupCircle[]>(['prototypeGroups'], current =>
          (current ?? []).filter(item => item.id !== targetGroupId))
      }
      void queryClient.invalidateQueries({ queryKey: ['groups'] })
      haptics.success()
      navigate('/together', { replace: true })
    },
    onError: () => {
      setLeaveFailure('unknown')
      haptics.warn()
    },
  })

  if (session.status === 'signed-out') {
    return (
      <div className="page group-page">
        <button className="eyebrow back-link press" onClick={() => navigate(-1)}>← BACK</button>
        <section className="empty-state invite-scene group-invite-scene group-auth-gate">
          <p className="eyebrow">PRIVATE GROUP</p>
          <h1 className="t-display">Sign in to open your group.</h1>
          <p className="t-body">Group names, members, and shared taste stay hidden until your account is confirmed as a current member.</p>
          <button className="pill pill-primary press" onClick={() => void signIn()}>Continue with Google</button>
        </section>
      </div>
    )
  }

  if (!prototype && groupQuery.isPending) {
    return <div className="page"><div className="together-skeleton skeleton" aria-hidden /></div>
  }

  if (!group) {
    const denied = prototypeFailure('permission') || isPermissionDeniedError(groupQuery.error)
    return (
      <div className="page">
        <button className="eyebrow back-link press" onClick={() => navigate(-1)}>← BACK</button>
        <section className="empty-state" role={groupQuery.error ? 'alert' : undefined}>
          <p className="eyebrow">PRIVATE GROUP</p>
          <h1 className="t-display">
            {denied ? 'Your access to this group changed.' : 'This group isn’t available.'}
          </h1>
          <p className="t-body">
            {denied
              ? 'No group taste evidence was shown. Return to Together to see groups you currently belong to.'
              : 'It may have closed, or the invitation may no longer be active.'}
          </p>
          <button className="pill pill-primary press" onClick={() => navigate('/together')}>Back to Together</button>
        </section>
      </div>
    )
  }

  const showingWelcome = group.status === 'active' && ['1', 'quick'].includes(searchParams.get('welcome') ?? '')
  const myFirstName = group.members.find(member => member.uid === myUid)?.displayName.split(/\s+/)[0] ?? 'You'
  const waitingForIndependentReason = group.projectionCount > 0 && eligibleBeforePlan.length === 0
  const sparseRecovery = waitingForIndependentReason && myUid
    ? sparseGroupRecovery({
        members: group.tastes.filter(member => attendeeSet.has(member.uid)),
        memberUid: myUid,
        ...(group.recentPick ? { excludePlaceIds: [group.recentPick.placeId] } : {}),
      })
    : null
  const sparseCopy = sparseRecovery ? sparseRecoveryCopy(sparseRecovery) : null
  const passedEntries = prototype
    ? Object.entries(passedPlaces).map(([placeId, placeName]) => ({
        placeId,
        placeName,
        actorUid: myUid ?? '',
        actorName: myFirstName,
      }))
    : sharedDraft.passes
      .filter(pass => pass.draftKey === sharedDraft.draftKey && pass.permissionVersion === group.permissionVersion)
      .map(pass => ({
        placeId: pass.placeId,
        placeName: allCandidates.find(candidate => candidate.save.placeId === pass.placeId)?.save.memory?.label ?? 'this place',
        actorUid: pass.actorUid,
        actorName: group.members.find(member => member.uid === pass.actorUid)?.displayName.split(/\s+/)[0] ?? 'Someone',
      }))
  const focusPassButton = (placeId: string) => {
    window.requestAnimationFrame(() => {
      const button = [...document.querySelectorAll<HTMLButtonElement>('[data-pass-place-id]')]
        .find(item => item.dataset.passPlaceId === placeId)
      button?.focus()
    })
  }
  const cancelPicked = () => {
    const placeId = picked?.save.placeId
    setPickedId(null)
    if (!placeId) return
    window.requestAnimationFrame(() => {
      const button = [...document.querySelectorAll<HTMLButtonElement>('[data-select-place-id]')]
        .find(item => item.dataset.selectPlaceId === placeId)
      button?.focus()
    })
  }
  const cancelPendingPass = () => {
    const placeId = pendingPass?.save.placeId
    setPendingPass(null)
    if (placeId) focusPassButton(placeId)
  }
  const cancelLeave = () => {
    setConfirmingLeave(false)
    leaveMutation.reset()
    window.requestAnimationFrame(() => leaveButtonRef.current?.focus())
  }
  const openDiscoveryForCurrentPlan = () => {
    if (group.status === 'active' && myUid) {
      departingForDiscoveryRef.current = true
      const remembered = rememberTransientGroupPlan({
        groupId: group.id,
        memberUid: myUid,
        permissionVersion: group.permissionVersion,
        memberUids: [...group.memberUids],
        attendeeUids: [...attendeeUids],
        guestIncluded,
        context,
        planArea: normalizedPlanArea,
        requiredObservation,
      })
      if (!remembered) {
        departingForDiscoveryRef.current = false
        setPlanContinuityNotice('Choose at least two current group members before continuing this plan.')
        return
      }
    }
    navigate(`/add?mode=discover&group=${encodeURIComponent(group.id)}`)
  }
  const planEmpty = (
    <section className="empty-state plan-empty">
      <h2 className="t-display">
        {allCandidates.length > 0
          ? 'Nothing left in this draft.'
          : requiredObservation
          ? `Nothing confirms ${PLACE_OBSERVATION_LABELS[requiredObservation]}${normalizedPlanArea ? ` in ${normalizedPlanArea}` : ''}.`
          : normalizedPlanArea
          ? `No confirmed places match ${normalizedPlanArea}.`
          : waitingForIndependentReason
          ? sparseCopy?.heading ?? 'Shared places need another reason.'
          : 'Nothing honest fits yet.'}
      </h2>
      <p className="t-body">
        {allCandidates.length > 0
          ? 'You passed on every current candidate. Undo one above, or change who is going or what fits this time.'
          : requiredObservation
          ? 'This needs at least one attributed group-shared Yes and no conflicting No. Missing details stay unknown. Clear the need or add a place with evidence.'
          : normalizedPlanArea
          ? 'Places with no confirmed area stay unknown. Clear this draft area, or add a place that belongs here.'
          : group.projectionCount === 0
          ? 'No one has shared a place or Quick start hint with this group. Nothing from anyone’s private Keep appears automatically.'
          : waitingForIndependentReason
          ? sparseCopy?.body ?? 'The group needs one more independent reason before a place can appear.'
          : 'Try Anything. The group needs more explicit evidence before this can answer.'}
      </p>
      {group.status === 'active' && allCandidates.length === 0 && (
        <div className="plan-empty-actions">
          {requiredObservation && (
            <button className="pill pill-primary press" disabled={Boolean(draftPassFailure)} onClick={() => setRequiredObservation(null)}>Clear need</button>
          )}
          {normalizedPlanArea && (
            <button className={`pill ${requiredObservation ? 'pill-ghost' : 'pill-primary'} press`} disabled={Boolean(draftPassFailure)} onClick={() => setPlanArea('')}>Clear area</button>
          )}
          {!normalizedPlanArea && !requiredObservation && context !== 'Anything' && eligibleBeforePlan.length > 0 && (
            <button className="pill pill-primary press" disabled={Boolean(draftPassFailure)} onClick={() => setContext('Anything')}>Show Anything</button>
          )}
          <button className={`pill ${normalizedPlanArea || requiredObservation || (context !== 'Anything' && eligibleBeforePlan.length > 0) ? 'pill-ghost' : 'pill-primary'} press`} disabled={Boolean(draftPassFailure)} onClick={openDiscoveryForCurrentPlan}>
            Choose or find a place
          </button>
          {sparseRecovery?.kind === 'own_want' && (
            <Link className="pill pill-ghost press" to={`/p/${encodeURIComponent(sparseRecovery.placeId)}`}>
              Review my Want
            </Link>
          )}
          {!normalizedPlanArea && !requiredObservation
            && (group.projectionCount === 0 || sparseRecovery?.kind === 'answerable_want') && (
            <button
              className="pill pill-ghost press"
              onClick={() => openWelcomeStep('quick')}
            >
              {sparseRecovery?.kind === 'answerable_want'
                ? 'Answer with Quick start'
                : myTaste?.quickStart ? 'Edit Quick start' : 'Quick start'}
            </button>
          )}
        </div>
      )}
    </section>
  )

  return (
    <div className={`page group-page${showingWelcome ? ' is-welcoming' : ''}`}>
      <button className="eyebrow back-link press" onClick={() => navigate(-1)}>← BACK</button>

      <header className="group-head">
        <GroupAvatars group={group} size={48} />
        <p className="eyebrow">{group.members.length} {group.members.length === 1 ? 'PERSON' : 'PEOPLE'} · {group.name.toUpperCase()}</p>
        {group.activePick ? (
          <section className="group-current-pick is-recovery-hero" aria-labelledby="group-current-pick-title">
            <div>
              <p className="eyebrow">CURRENT PICK · {group.activePick.attendeeCount} GOING</p>
              <h1 id="group-current-pick-title" className="t-display">{group.activePick.label}</h1>
              <p className="t-small">Close this Pick after the outing before this group starts another.</p>
            </div>
            <Link
              className="pill pill-primary press"
              to={`/p/${encodeURIComponent(group.activePick.placeId)}?pick=${encodeURIComponent(group.activePick.id)}`}
            >
              Open current Pick
            </Link>
          </section>
        ) : group.status === 'active' && candidates.length === 0 ? null : (
          <div className="group-refractive-field">
            <h1 className="t-display">
              {group.status === 'forming'
                ? <>Invite your people.<br />Nothing shared yet.</>
                : candidates.length === 1
                ? <>One place.<br />A real reason.</>
                : candidates.length === 2
                ? <>Two places.<br />Real reasons.</>
                : <>Three places.<br />Real reasons.</>}
            </h1>
            <p className="t-small">
              {group.status === 'forming'
                ? 'The group begins when someone explicitly accepts.'
                : candidates.length === 1 && candidates[0]?.save.memory
                ? `${candidates[0].save.memory.label} is the only place with enough shared evidence right now.`
                : 'Support is counted. Missing taste stays unknown.'}
            </p>
          </div>
        )}
      </header>

      {planContinuityNotice && (
        <p className="group-plan-continuity t-small" role="status">{planContinuityNotice}</p>
      )}

      {showingWelcome && (
        welcomeStep === 'quick' ? (
          quickStartAudienceRefresh ? (
            <section className="group-quick-start group-audience-refresh" role="alert" aria-labelledby="group-audience-refresh-title">
              <p className="eyebrow">SHARING CIRCLE CHANGED</p>
              <h2 id="group-audience-refresh-title" className="t-display">Check who is in this group now.</h2>
              <p className="t-body">
                The earlier circle was not reused. Your same hint choices are waiting, but nothing will be tried again until the current people can be reviewed.
              </p>
              <div className="group-quick-actions">
                <button
                  className="pill pill-primary press"
                  disabled={quickStartAudienceRefresh.status === 'checking'}
                  onClick={() => void refreshQuickStartAudience(quickStartAudienceRefresh.attempt)}
                >
                  {quickStartAudienceRefresh.status === 'checking' ? 'Checking circle…' : 'Check circle'}
                </button>
                <button
                  className="pill pill-ghost press"
                  disabled={quickStartAudienceRefresh.status === 'checking'}
                  onClick={() => navigate(`/g/${group.id}`, { replace: true })}
                >Wait for everyone</button>
              </div>
            </section>
          ) : (
            lostQuickStartRecovery ? (
              <section className="group-quick-start group-audience-recovery-note" role="status">
                <p className="eyebrow">EXACT REVIEW ENDED</p>
                <h2 className="t-display">Review {lostQuickStartRecovery === 'save' ? 'this hint' : 'the removal'} again.</h2>
                <p className="t-body">
                  The earlier page closed before its exact sharing circle could be retained. Review again starts a new choice; it is not a check of that earlier request.
                </p>
                <div className="group-quick-actions">
                  <button
                    className="pill pill-primary press"
                    onClick={() => {
                      setLostQuickStartRecovery(null)
                      prototypeQuickStartCommitRef.current = null
                      try { window.sessionStorage.removeItem(pendingQuickStartKey(groupId)) } catch { /* operation marker only */ }
                    }}
                  >Review again</button>
                  <button className="pill pill-ghost press" onClick={() => navigate(`/g/${group.id}`, { replace: true })}>Not now</button>
                </div>
              </section>
            ) : (
              <GroupQuickStart
                groupName={group.name}
                memberNames={group.members.map(member => member.displayName)}
                busy={quickStart.isPending || removeQuickStart.isPending}
                uncertainAction={quickStartFailure}
                initialCategoryHints={myTaste?.quickStart?.categoryHints}
                initialConstraintHints={myTaste?.quickStart?.constraintHints}
                recovery={sparseRecovery?.kind === 'answerable_want' ? {
                  authorName: sparseRecovery.authorName,
                  placeLabel: sparseRecovery.placeLabel,
                  category: sparseRecovery.category,
                } : undefined}
                onSave={requestQuickStartSave}
                onRetry={() => {
                  if (quickStartFailure === 'save' && pendingQuickStartAttempt) {
                    quickStart.mutate({ ...pendingQuickStartAttempt, checkingUnknown: true })
                  }
                  if (quickStartFailure === 'remove' && pendingQuickStartRemovalAttempt) {
                    removeQuickStart.mutate(pendingQuickStartRemovalAttempt)
                  }
                }}
                onRemove={myTaste?.quickStart ? () => removeQuickStart.mutate({
                  groupId: group.id,
                  targetEpoch: currentGroupIdentityRef.current.epoch,
                }) : undefined}
                onCancel={() => quickStartFailure
                  ? navigate(`/g/${group.id}`, { replace: true })
                  : openWelcomeStep('choices')}
              />
            )
          )
        ) : (
          <section className="group-welcome" aria-labelledby="group-welcome-title">
            <p className="eyebrow">YOU’RE IN · NOTHING REQUIRED</p>
            <h2 id="group-welcome-title" className="t-display">Help this group learn what you like.</h2>
            <p className="t-body">
              No place comes to mind? That’s fine. Choose one broad kind, add a place you already know, or skip. Nothing from your private Keep is shared automatically.
            </p>
            <div className="group-welcome-choices">
              <button className="group-welcome-choice press" onClick={() => openWelcomeStep('quick')}>
                <strong className="t-row-title">Quick start</strong>
                <span className="t-small">Can’t name a place? Choose Food, Coffee, or Things to do. Sharing a hint closes invitations.</span>
              </button>
              <button className="group-welcome-choice press" onClick={openDiscoveryForCurrentPlan}>
                <strong className="t-row-title">Choose or find a place</strong>
                <span className="t-small">Start with a private Want or Loved memory, search a temporary area, or name somewhere you know. Only the reviewed place can be shared; sharing closes invitations.</span>
              </button>
              <button className="group-welcome-choice press" onClick={() => navigate(`/g/${group.id}`, { replace: true })}>
                <strong className="t-row-title">Not now</strong>
                <span className="t-small">Share nothing yet. You can add taste later, and invitations stay open.</span>
              </button>
            </div>
          </section>
        )
      )}

      <section className={`group-audience-state${group.membershipLocked ? ' is-fixed' : ' is-open'}`} aria-label="Group membership audience">
        <p className="eyebrow">
          {group.membershipLocked ? `SHARING CIRCLE · ${group.members.length} PEOPLE` : `INVITATIONS OPEN · ${group.members.length} OF 6 PEOPLE`}
        </p>
        <p className="t-small">
          {group.membershipLocked
            ? `Invitations are closed. Shared taste belongs only to these ${group.members.length} people.`
            : 'Make one private link per person before anyone shares taste. After the first Quick start or shared place, invitations close so earlier evidence never reaches a later joiner.'}
        </p>
      </section>

      <GroupInviteManager
        groupId={group.id}
        groupName={group.name}
        groupStatus={group.status}
        memberCount={group.members.length}
        membershipLocked={group.membershipLocked}
        prototype={prototype}
      />

      {!group.activePick && group.status === 'active' && allCandidates.length === 0 && planEmpty}

      {!group.activePick && group.recentPick && (
        <section className="group-recent-pick" aria-labelledby="group-recent-pick-title">
          <div>
            <p className="eyebrow">LAST PICK · THE GROUP WENT</p>
            <h2 id="group-recent-pick-title" className="t-row-title">{group.recentPick.label}</h2>
            <p className="t-small">Each person who went can keep their own Tried or Loved outcome.</p>
          </div>
          <Link
            className="pill pill-ghost press"
            to={`/p/${encodeURIComponent(group.recentPick.placeId)}?pick=${encodeURIComponent(group.recentPick.id)}`}
          >
            Open last Pick
          </Link>
        </section>
      )}

      {!group.activePick && (<>
      {group.status === 'active' && eligibleBeforePlan.length > 0 && (
        <section className="group-attendees" aria-labelledby="group-attendees-label">
          <p id="group-attendees-label" className="eyebrow">WHO’S GOING?</p>
          <div className="group-attendee-picker">
            {group.members.map(member => {
              const attending = attendeeSet.has(member.uid)
              const isMe = member.uid === myUid
              return (
                <button
                  key={member.uid}
                  className={`group-attendee press${attending ? ' is-attending' : ''}`}
                  aria-pressed={attending}
                  disabled={isMe || Boolean(draftPassFailure)}
                  onClick={() => {
                    setExcludedAttendeeUids(current => {
                      const next = new Set(current)
                      if (attending) next.add(member.uid)
                      else next.delete(member.uid)
                      return next
                    })
                    setPickedId(null)
                    setPendingPass(null)
                    setPassedPlaces({})
                  }}
                >
                  <Avatar name={member.displayName} hex={member.avatarHex} size={30} />
                  <span>{isMe ? 'You' : member.displayName.split(/\s+/)[0]}</span>
                </button>
              )
            })}
            <button
              className={`group-attendee group-guest-attendee press${guestIncluded ? ' is-attending' : ''}`}
              aria-pressed={guestIncluded}
              disabled={Boolean(draftPassFailure)}
              onClick={() => {
                setGuestIncluded(current => !current)
                setPickedId(null)
                setPendingPass(null)
                setPassedPlaces({})
              }}
            >
              <span className="group-guest-mark" aria-hidden>+</span>
              <span>Guest</span>
            </button>
          </div>
          {attendeeUids.length < 2 && <p className="t-small" role="status">Choose at least one other person.</p>}
          {guestIncluded && (
            <p className="group-guest-note t-small">
              Guest counts as unknown for this plan. No name, profile, or taste is stored.
            </p>
          )}
        </section>
      )}

      {group.status === 'active' && eligibleBeforePlan.length > 0 && attendeeUids.length >= 2 && (
        <section className="group-context" aria-labelledby="group-context-label">
          <p id="group-context-label" className="eyebrow">WHAT FITS THIS TIME?</p>
          <div className="plan-chips">
            {PLAN_CONTEXTS.map(option => (
              <button
                key={option}
                className={`pill press${context === option ? ' pill-primary' : ' pill-ghost'}`}
                aria-pressed={context === option}
                disabled={Boolean(draftPassFailure)}
                onClick={() => {
                  setContext(option)
                  setPickedId(null)
                  setPendingPass(null)
                  setPassedPlaces({})
                }}
              >
                {option}
              </button>
            ))}
          </div>
          <details className="group-plan-details">
            <summary className="press">
              <span>
                <span className="eyebrow">PLAN DETAILS · OPTIONAL</span>
                <span className="t-small">{planDetailsSummary}</span>
              </span>
              <span className="group-plan-details-mark" aria-hidden>+</span>
            </summary>
            <div className="group-plan-details-body">
              <section className="group-plan-requirement" aria-labelledby="group-plan-requirement-label">
                <p id="group-plan-requirement-label" className="eyebrow">NEEDS THIS TIME?</p>
                <div className="plan-detail-chips">
                  {PLAN_REQUIREMENT_KEYS.map(key => (
                    <button
                      key={key}
                      className={`chip press${requiredObservation === key ? ' is-on' : ''}`}
                      aria-pressed={requiredObservation === key}
                      disabled={Boolean(draftPassFailure)}
                      onClick={() => {
                        setRequiredObservation(current => current === key ? null : key)
                        setPickedId(null)
                        setPendingPass(null)
                        setPassedPlaces({})
                      }}
                    >{PLACE_OBSERVATION_LABELS[key]}</button>
                  ))}
                </div>
                <p className="t-small">
                  One at a time. A group-shared Yes must exist and any No fails closed; missing stays unknown. Used only for this draft.
                </p>
              </section>
              <label className="group-plan-area">
                <span className="eyebrow">WHERE THIS TIME?</span>
                <input
                  className="group-plan-area-input"
                  aria-label="Area for this plan"
                  aria-describedby="group-plan-area-help"
                  placeholder="e.g. Cresskill, NJ"
                  value={planArea}
                  disabled={Boolean(draftPassFailure)}
                  maxLength={EXPLICIT_PLAN_AREA_MAX_LENGTH}
                  autoComplete="off"
                  onChange={event => {
                    setPlanArea(event.target.value)
                    setPickedId(null)
                    setPendingPass(null)
                    setPassedPlaces({})
                  }}
                />
                <small id="group-plan-area-help" className="t-small">
                  Matches only areas members typed on places. Used for this draft only; never saved to a person or group.
                </small>
              </label>
            </div>
          </details>
          <p className="group-adaptation-note t-small" aria-live="polite">
            {context === 'Anything' && !requiredObservation && !normalizedPlanArea
              ? `These ${attendeeUids.length + (guestIncluded ? 1 : 0)} people’s shared taste · no location profile.`
              : <>
                  Adapting to these {attendeeUids.length + (guestIncluded ? 1 : 0)} people’s shared taste
                  {context === 'Anything' ? '.' : ` for ${context.toLowerCase()}.`}{' '}
                  {requiredObservation
                    ? `Requiring ${PLACE_OBSERVATION_LABELS[requiredObservation]} from attributed group-shared details; disagreement fails closed. `
                    : ''}
                  {normalizedPlanArea
                    ? `Showing only places whose member-confirmed area matches “${normalizedPlanArea}”; missing area stays unknown. No location profile.`
                    : 'No location profile.'}
                </>}
          </p>
          {myTaste?.quickStart && (
            <button
              className="pill pill-ghost press group-edit-hints"
              disabled={Boolean(draftPassFailure)}
              onClick={() => openWelcomeStep('quick')}
            >
              Edit my Quick start
            </button>
          )}
        </section>
      )}

      {draftPassFailure && (
        <section className="group-pass-recovery" role="alert" aria-labelledby="group-pass-recovery-title">
          <p className="eyebrow">{draftPassFailure.kind === 'changed' ? 'DRAFT CHANGED' : 'RESPONSE NOT CONFIRMED'}</p>
          <h2 id="group-pass-recovery-title" className="t-row-title">
            {draftPassFailure.kind === 'changed'
              ? 'Use the current group answer.'
              : draftPassFailure.request.action === 'pass'
              ? 'Pass status unknown.'
              : 'Undo status unknown.'}
          </h2>
          <p className="t-small">
            {draftPassFailure.kind === 'changed'
              ? `The group evidence changed before ${draftPassFailure.placeName} could be checked. The older draft was not applied to this new answer.`
              : draftPassFailure.request.action === 'pass'
              ? `We couldn’t confirm whether ${draftPassFailure.placeName} was passed on. Checking again can only repeat this same attributed pass for the reviewed people and plan; it cannot change anyone’s Keep.`
              : `We couldn’t confirm whether your pass on ${draftPassFailure.placeName} was undone. Checking again can only repeat this same undo for the reviewed people and plan; it cannot change anyone’s Keep.`}
          </p>
          <div className="group-resolution-actions">
            <button
              ref={draftPassRecoveryButtonRef}
              className="pill pill-primary press"
              disabled={draftPassMutation.isPending}
              onClick={() => {
                if (draftPassFailure.kind === 'changed') {
                  setDraftPassFailure(null)
                  draftPassMutation.reset()
                  return
                }
                draftPassMutation.mutate(draftPassFailure)
              }}
            >
              {draftPassMutation.isPending
                ? 'Checking…'
                : draftPassFailure.kind === 'changed'
                ? 'Use current draft'
                : draftPassFailure.request.action === 'pass'
                ? 'Check pass'
                : 'Check undo'}
            </button>
            <button className="pill pill-ghost press" onClick={() => navigate('/together')}>Close for now</button>
          </div>
        </section>
      )}

      {passedEntries.length > 0 && (
        <section
          ref={passLedgerRef}
          className="group-pass-ledger"
          aria-label="Places passed on in this draft"
          aria-live="polite"
        >
          <p className="eyebrow">THIS DRAFT</p>
          {passedEntries.map(entry => (
            <div className="group-pass-entry" key={entry.placeId}>
              <span><b>{entry.actorName} passed</b> on {entry.placeName}.</span>
              {entry.actorUid === myUid && (
                <button
                  className="candidate-pass press"
                  data-undo-place-id={entry.placeId}
                  disabled={draftPassMutation.isPending || Boolean(draftPassFailure)}
                  onClick={() => {
                    const attempt = makeDraftPassAttempt('undo', entry.placeId, entry.placeName)
                    if (attempt) draftPassMutation.mutate(attempt)
                  }}
                >
                  {draftPassMutation.isPending ? 'Updating…' : 'Undo'}
                </button>
              )}
            </div>
          ))}
          <p className="t-small">
            {prototype
              ? 'Visible here only. Nobody’s Keep history changed.'
              : 'Synced with this group for six hours. Nobody’s Keep history changed.'}
          </p>
        </section>
      )}

      {!prototype && sharedDraft.status === 'error' && (
        <p className="t-small plan-resolution-error" role="alert">
          Draft passes aren’t syncing right now. Refresh before making the Pick.
        </p>
      )}

      {candidates.length ? (
        <section className="group-candidates" aria-label="Recommended places">
          {candidates.map(candidate => (
            <GroupCandidateCard
              key={candidate.save.placeId}
              groupId={group.id}
              candidate={candidate}
              context={context}
              selected={candidate.save.placeId === pickedId}
              disabled={Boolean(draftPassFailure) || draftPassMutation.isPending || (!prototype && sharedDraft.status !== 'live')}
              onSelect={() => setPickedId(candidate.save.placeId)}
              onRequestPass={() => {
                setPickedId(null)
                setPendingPass(candidate)
              }}
            />
          ))}
        </section>
      ) : allCandidates.length > 0 ? planEmpty : null}

      {pendingPass?.save.memory && (
        <aside
          className="group-pass-confirmation"
          role="alertdialog"
          aria-labelledby="group-pass-title"
          aria-describedby="group-pass-description"
          onKeyDown={event => {
            if (event.key !== 'Escape') return
            event.preventDefault()
            cancelPendingPass()
          }}
        >
          <div>
            <p className="eyebrow">ATTRIBUTED PASS</p>
            <strong id="group-pass-title" className="t-row-title">Pass on {pendingPass.save.memory.label}?</strong>
            <p id="group-pass-description" className="t-small">
              This draft will show “{myFirstName} passed.” It removes this option for now,
              but does not add a dislike or change anyone’s Keep.
            </p>
          </div>
          <div className="group-resolution-actions">
            <button
              className="pill pill-primary press"
              disabled={draftPassMutation.isPending || Boolean(draftPassFailure)}
              onClick={() => {
                const placeId = pendingPass.save.placeId
                const placeName = pendingPass.save.memory?.label ?? 'this place'
                const attempt = makeDraftPassAttempt('pass', placeId, placeName)
                if (attempt) draftPassMutation.mutate(attempt)
              }}
            >
              {draftPassMutation.isPending ? 'Saving pass…' : 'Confirm pass'}
            </button>
            <button className="pill pill-ghost press" autoFocus disabled={draftPassMutation.isPending} onClick={cancelPendingPass}>Keep it</button>
          </div>
        </aside>
      )}

      {picked?.save.memory && !pendingPass && (
        <aside className="group-resolution" aria-label="Selected place confirmation" aria-live="polite">
          <div>
            <p className="eyebrow">READY FOR GROUP PICK · {attendeeUids.length + (guestIncluded ? 1 : 0)} GOING</p>
            <strong className="t-row-title">{picked.save.memory.label}</strong>
            <p className="t-small">{picked.reason}</p>
            <PickContextChips
              context={context}
              planArea={normalizedPlanArea}
              requiredObservation={requiredObservation}
              label="This Pick's plan context"
            />
          </div>
          <div className="group-resolution-actions">
            <button
              ref={pickCommitButtonRef}
              className="pill pill-primary press"
              disabled={commitPick.isPending || Boolean(draftPassFailure) || (!prototype && sharedDraft.status !== 'live')}
              onClick={() => {
                if (pickCommitFailure === 'changed') {
                  void groupQuery.refetch()
                  return
                }
                try {
                  window.sessionStorage.setItem(pendingPickKey(groupId), pickCreationKeyRef.current)
                } catch { /* retry remains safe for this mount */ }
                commitPick.mutate({ candidate: picked, creationKey: pickCreationKeyRef.current })
              }}
            >
              {commitPick.isPending
                ? 'Saving Pick…'
                : !prototype && sharedDraft.status === 'loading'
                ? 'Checking this draft…'
                : pickCommitFailure === 'unknown'
                ? 'Check Pick'
                : pickCommitFailure === 'changed'
                ? 'Refresh group'
                : 'Make this the Pick'}
            </button>
            <button className="pill pill-ghost press" onClick={cancelPicked}>Choose another</button>
          </div>
          {pickCommitFailure === 'unknown' && (
            <p className="t-small plan-resolution-error" role="alert">
              We couldn’t confirm whether the Pick was made. Checking again won’t make a second Pick.
            </p>
          )}
          {pickCommitFailure === 'changed' && (
            <p className="t-small plan-resolution-error" role="alert">
              This draft changed or another Pick opened. Refresh the group before choosing again.
            </p>
          )}
        </aside>
      )}
      </>)}

      <section className="group-leave-action" aria-label="Group membership controls">
        <p className="t-small">Your personal Keep stays yours if you leave.</p>
        {leaveFailure && !confirmingLeave ? (
          <>
            <p className="t-small pick-return-error" role="alert">
              We couldn’t confirm whether you left. Checking again can only finish leaving; it cannot rejoin you or remove your personal Keep.
            </p>
            <button
              ref={leaveButtonRef}
              className="pill pill-primary press"
              onClick={() => setConfirmingLeave(true)}
            >Check membership</button>
          </>
        ) : !leaveFailure ? (
          <button
            ref={leaveButtonRef}
            className="toast-ghost press"
            disabled={leaveMutation.isPending || Boolean(draftPassFailure)}
            onClick={() => {
              leaveMutation.reset()
              setLeaveFailure(null)
              setPickedId(null)
              setPendingPass(null)
              setConfirmingLeave(true)
            }}
          >
            Leave group
          </button>
        ) : null}
      </section>

      {confirmingLeave && (
        <aside
          className="group-pass-confirmation group-leave-confirmation"
          role="alertdialog"
          aria-labelledby="group-leave-title"
          aria-describedby="group-leave-description"
          onKeyDown={event => {
            if (event.key !== 'Escape' || leaveMutation.isPending) return
            event.preventDefault()
            cancelLeave()
          }}
        >
          <div>
            <p className="eyebrow">LEAVE {group.name.toUpperCase()}</p>
            <h2 id="group-leave-title" className="t-row-title">Leave this group?</h2>
            <p id="group-leave-description" className="t-small">
              {group.members.length <= 2
                ? 'This closes the two-person group for both people. Group evidence and public Pick links are removed; your personal Keep stays yours.'
                : 'You lose access immediately. Your group evidence and public Pick links are removed; everyone’s personal Keep stays their own.'}
            </p>
            {leaveFailure && (
              <p className="t-small pick-return-error" role="alert">
                We couldn’t confirm whether you left. Checking again can only finish leaving; it cannot rejoin you or remove your personal Keep.
              </p>
            )}
          </div>
          <div className="group-resolution-actions">
            <button
              className="toast-ghost press group-leave-confirm-button"
              disabled={leaveMutation.isPending}
              onClick={() => leaveMutation.mutate(group.id)}
            >
              {leaveMutation.isPending
                ? leaveFailure ? 'Checking…' : 'Leaving…'
                : leaveFailure ? 'Check membership' : 'Confirm leave'}
            </button>
            <button className="pill pill-primary press" autoFocus disabled={leaveMutation.isPending} onClick={cancelLeave}>
              {leaveFailure ? 'Close for now' : 'Stay'}
            </button>
          </div>
        </aside>
      )}
      {quickStartAudienceReview && (
        <GroupAudienceConfirmation
          group={quickStartAudienceReview.group}
          sharingLabel="hint"
          changed={quickStartAudienceReview.changed}
          onWait={() => {
            setQuickStartAudienceReview(null)
            haptics.tap()
          }}
          onConfirm={confirmQuickStartAudience}
        />
      )}
    </div>
  )
}

function GroupAvatars({ group, size }: { group: GroupCircle; size: number }) {
  return (
    <div className="group-avatars" aria-label={group.members.map(member => member.displayName).join(', ')}>
      {group.members.map(member => (
        <Avatar key={member.uid} name={member.displayName} hex={member.avatarHex} size={size} />
      ))}
    </div>
  )
}
