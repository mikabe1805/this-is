/**
 * ADD A NEW PLACE — the Google autocomplete and exact Maps-link lanes, clearly
 * labeled so neither is confused with library search. Autocomplete is
 * session-tokened (debounce 350ms, ≥3 chars); the details call on selection
 * closes the billing session. An exact Place ID already present in a Maps URL
 * opens user confirmation without a Places request.
 * Selecting opens a user-memory review. Nothing is kept until the person
 * confirms their own label, category, and Want / Tried / Loved experience.
 *
 * Race rules: a sequence counter invalidates in-flight autocomplete responses
 * whenever the query changes or a selection lands, so stale suggestions can
 * never reappear under an empty input. The session token dies only when a
 * details call actually succeeds (that's what closes the session at Google);
 * a failed details keeps the token so a retry stays in the same session.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import {
  autocomplete,
  getCaptureDetails,
  mapsDeepLink,
  newSessionToken,
  placesEnabled,
  type PlaceDetails,
  type Suggestion,
} from '../lib/places'
import { useGroupAudience, useMySaves, useSaveFlow } from '../data/queries'
import { gid } from '../data/types'
import { useSession } from '../state/session'
import { dismissToast, showToast } from '../state/toast'
import { signIn } from '../lib/authWatch'
import { haptics } from '../lib/haptics'
import { looksLikeGoogleMapsUrl, sharedPlaceInput } from '../domain/mapsUrl'
import { resolveGoogleMapsInput } from '../lib/mapsShare'
import { PlaceMemoryConfirmation } from '../components/PlaceMemoryConfirmation'
import { PinVisual } from '../components/PinVisual'
import { GroupAudienceConfirmation } from '../components/GroupAudienceConfirmation'
import type { DurablePlaceMemory, UserPlaceCategory } from '../domain/placeMemory'
import type { FriendSave, Tag } from '../domain/signals'
import { prototypeFailure, prototypeKind } from '../lib/prototypeMode'
import {
  fetchGroupAudienceFromServer,
  fetchGroupSignalShareStates,
  GroupRequestError,
  shareSignalWithGroup,
} from '../data/groups'
import type { GroupCircle, GroupSummary } from '../domain/groups'
import { buildGroupAudienceStamp, type GroupAudienceStamp } from '../domain/groupAudience'
import {
  personalDiscoveryContinuation,
  personalDiscoveryMapsUrl,
  personalDiscoveryPrompts,
  personalDiscoveryQuery,
  type PersonalDiscoveryContinuation,
  type PersonalDiscoveryCategory,
} from '../domain/personalDiscovery'
import {
  PLACE_OBSERVATION_LABELS,
  observationsForGroup,
  practicalNeedObservationPatch,
  type PlaceObservationPatch,
  type PracticalNeedAnswer,
} from '../domain/placeObservations'
import type { PlanContext } from '../domain/recommendation'
import { useTransientGroupPlan } from '../state/useTransientGroupPlan'
import {
  createGroupKeepShareHandoff,
  groupKeepBridgeCandidates,
} from '../domain/groupKeepBridge'

interface PendingPlaceMemory {
  placeId: string
  googleLabel?: string
  googleContext?: string
  initialLabel: string
  initialCategory?: UserPlaceCategory
  initialArea?: string
  exactLinkIdentity?: boolean
  discoveryReturnContext?: DiscoveryReturnContext
}

interface DiscoveryReturnContext {
  category: PersonalDiscoveryCategory
  area: string
}

interface PersonalDiscoverySuccess {
  continuation: PersonalDiscoveryContinuation | null
}

interface CaptureAttempt {
  groupId?: string
  targetEpoch: number
  memory: DurablePlaceMemory
  tag: Tag
  observation?: PlaceObservationPatch
  includeObservations: boolean
  audience?: GroupAudienceStamp
  privateSaved?: boolean
  checkingShare?: boolean
}

interface CaptureAudienceReview {
  group: GroupSummary
  attempt: CaptureAttempt
  changed: boolean
}

const TAG_LABELS: Record<Tag, string> = { want: 'Want', tried: 'Tried', loved: 'Loved' }
const PRACTICAL_NEED_ANSWER_OPTIONS: ReadonlyArray<{
  answer: PracticalNeedAnswer
  label: string
}> = [
  { answer: 'yes', label: 'Yes' },
  { answer: 'no', label: 'No' },
  { answer: 'not_sure', label: 'Not sure' },
]
const DISCOVERY_CATEGORY_LABELS: Record<PersonalDiscoveryCategory, string> = {
  coffee: 'Coffee',
  food: 'Food',
  activity: 'Things to do',
  drinks: 'Drinks',
}
const KEEP_CATEGORY_LABELS: Record<UserPlaceCategory, string> = {
  food: 'Food',
  drinks: 'Drinks',
  coffee: 'Coffee',
  activity: 'Things to do',
  other: 'Other',
}
const PLAN_DISCOVERY_CATEGORY: Record<PlanContext, PersonalDiscoveryCategory | null> = {
  Anything: null,
  Food: 'food',
  Drinks: 'drinks',
  Coffee: 'coffee',
}
const UNSUPPORTED_PLACE_MESSAGE =
  'This Google result can\u2019t be kept safely in this version yet. Choose another result for the same place, or search for a different place.'

export default function Add() {
  const session = useSession()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const {
    draft: rawTransientGroupPlan,
    peekDraft: peekTransientGroupPlan,
    clearDraft: clearTransientGroupPlan,
  } = useTransientGroupPlan()
  const groupId = searchParams.get('group')?.trim() || null
  const addTargetIdentityRef = useRef({ groupId, epoch: 0 })
  const discoveryMode = searchParams.get('mode') === 'discover'
  const prototype = import.meta.env.DEV && prototypeKind() === 'group'
  const groupQuery = useGroupAudience(groupId ?? undefined)
  const prototypeGroupReadError = Boolean(
    prototype && groupId && prototypeFailure('add-group-read'),
  )
  const prototypeGroup = prototype && groupId
    ? queryClient.getQueryData<GroupCircle[]>(['prototypeGroups'])?.find(group => group.id === groupId) ?? null
    : null
  const groupAudience = groupId && !prototypeGroupReadError
    ? (prototype ? prototypeGroup : groupQuery.data ?? null)
    : null
  const groupAudienceError = prototypeGroupReadError
    ? { code: 'permission-denied' }
    : groupQuery.error
  const groupAudienceLoadFailed = Boolean(
    groupId && groupAudienceError && (prototypeGroupReadError || groupQuery.data === undefined),
  )
  const groupAudiencePending = Boolean(
    groupId && !prototype && !groupAudienceLoadFailed && groupQuery.isLoading,
  )
  const groupAudienceUnavailable = Boolean(
    groupId && !groupAudienceLoadFailed && !groupAudiencePending && !groupAudience,
  )
  const groupAudienceStillForming = Boolean(
    groupId && !groupAudienceLoadFailed && !groupAudiencePending
      && groupAudience?.status === 'forming',
  )
  const transientGroupPlanEvidence = groupId && groupAudience && session.status === 'signed-in'
    ? {
        groupId,
        memberUid: session.user.uid,
        permissionVersion: groupAudience.permissionVersion,
        memberUids: groupAudience.memberUids,
      }
    : null
  const transientGroupPlan = transientGroupPlanEvidence
    ? peekTransientGroupPlan(transientGroupPlanEvidence)
    : null
  const activePracticalNeed = groupAudience?.status === 'active'
    ? transientGroupPlan?.requiredObservation ?? null
    : null
  const planDiscoveryCategory = transientGroupPlan
    ? PLAN_DISCOVERY_CATEGORY[transientGroupPlan.context]
    : null
  const searchReady = session.status === 'signed-in'
    && (!groupId || groupAudience?.status === 'active')
  const personalSavesQuery = useMySaves({ enabled: searchReady && (discoveryMode || Boolean(groupId)) })
  const { setTag } = useSaveFlow()
  const initialSharedInput = useRef(sharedPlaceInput({
    title: searchParams.get('title'),
    text: searchParams.get('text'),
    url: searchParams.get('url'),
  }))
  const [text, setText] = useState(initialSharedInput.current)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [linkBusy, setLinkBusy] = useState(false)
  const [linkMessage, setLinkMessage] = useState<string | null>(() =>
    initialSharedInput.current ? 'Shared here from another app. Review it before adding.' : null
  )
  const [pendingMemory, setPendingMemory] = useState<PendingPlaceMemory | null>(() =>
    import.meta.env.DEV && (
      prototypeFailure('place-memory')
      || prototypeFailure('add-group-share-response')
      || prototypeFailure('add-group-audience-changed')
      || prototypeFailure('keep-tag-response')
    )
      ? { placeId: 'g:prototype-memory', googleLabel: 'Juniper Cafe', initialLabel: 'coffee after practice' }
      : null)
  const [captureTag, setCaptureTag] = useState<Tag | null>(null)
  const [practicalNeedAnswer, setPracticalNeedAnswer] = useState<PracticalNeedAnswer | null>(null)
  const [includeObservationsWithGroup, setIncludeObservationsWithGroup] = useState(false)
  const practicalNeedObservedAtRef = useRef<number | null>(null)
  const [captureFailure, setCaptureFailure] = useState<CaptureAttempt | null>(null)
  const [captureAudienceReview, setCaptureAudienceReview] = useState<CaptureAudienceReview | null>(null)
  const [groupShareFailure, setGroupShareFailure] = useState<CaptureAttempt | null>(null)
  const [groupSharePending, setGroupSharePending] = useState(false)
  const [audienceRefreshFailure, setAudienceRefreshFailure] = useState<CaptureAttempt | null>(null)
  const captureRecoveryButtonRef = useRef<HTMLButtonElement>(null)
  const groupShareRecoveryButtonRef = useRef<HTMLButtonElement>(null)
  const token = useRef<string | null>(null)
  const seq = useRef(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const discoveryAreaRef = useRef<HTMLInputElement>(null)
  const discoveryResultRef = useRef<HTMLButtonElement>(null)
  const externalDiscoveryRef = useRef<HTMLAnchorElement>(null)
  const discoverySuccessRef = useRef<HTMLHeadingElement>(null)
  const discoveryContinuationStartingRef = useRef(false)
  const appliedTransientPlanRef = useRef<string | null>(null)
  const personalDiscoveryUidRef = useRef<string | null | undefined>(undefined)
  const prototypeGroupShareResponseLostRef = useRef(false)
  const prototypeAudienceChangedRef = useRef(false)
  const [discoveryArea, setDiscoveryArea] = useState(() => searchParams.get('area')?.slice(0, 80) ?? '')
  const [discoveryCategory, setDiscoveryCategory] = useState<PersonalDiscoveryCategory | null>(null)
  const [externalDiscoveryQuery, setExternalDiscoveryQuery] = useState<string | null>(null)
  const [discoveryReturnOpen, setDiscoveryReturnOpen] = useState(false)
  const [discoverySuccess, setDiscoverySuccess] = useState<PersonalDiscoverySuccess | null>(null)
  const discoveryReturnContextRef = useRef<DiscoveryReturnContext | null>(null)
  const discoveryPrompts = useMemo(() => {
    const prompts = personalDiscoveryPrompts(personalSavesQuery.data ?? [])
    if (!planDiscoveryCategory) return prompts
    return [
      ...prompts.filter(prompt => prompt.category === planDiscoveryCategory),
      ...prompts.filter(prompt => prompt.category !== planDiscoveryCategory),
    ]
  }, [personalSavesQuery.data, planDiscoveryCategory])
  const groupKeepMemories = useMemo(() => groupId && groupAudience?.status === 'active'
    ? groupKeepBridgeCandidates(personalSavesQuery.data ?? [], {
        category: planDiscoveryCategory,
        area: transientGroupPlan?.planArea ?? '',
      })
    : [], [groupAudience?.status, groupId, personalSavesQuery.data, planDiscoveryCategory, transientGroupPlan?.planArea])
  const groupKeepHasPlanFilter = Boolean(planDiscoveryCategory || transientGroupPlan?.planArea)
  const autocompleteAvailable = placesEnabled || prototype
  const displayedSuggestions = discoveryMode ? suggestions.slice(0, 3) : suggestions

  useLayoutEffect(() => {
    if (addTargetIdentityRef.current.groupId === groupId) return
    addTargetIdentityRef.current = {
      groupId,
      epoch: addTargetIdentityRef.current.epoch + 1,
    }
    setCaptureFailure(null)
    setCaptureAudienceReview(null)
    setGroupShareFailure(null)
    setAudienceRefreshFailure(null)
    setGroupSharePending(false)
    prototypeGroupShareResponseLostRef.current = false
    prototypeAudienceChangedRef.current = false
    setLinkMessage('The target group changed. Review this place again before sharing anything.')
  }, [groupId])

  const retryGroupAudience = () => {
    if (prototypeGroupReadError) {
      const next = new URL(window.location.href)
      next.searchParams.delete('failure')
      window.location.assign(next.toString())
      return
    }
    void groupQuery.refetch()
  }

  const openGroupKeepMemory = (save: FriendSave) => {
    if (!groupId || !save.memory) return
    const handoff = createGroupKeepShareHandoff(groupId)
    if (!handoff) return
    haptics.tap()
    navigate(`/p/${encodeURIComponent(save.placeId)}?sharing=1`, { state: handoff })
  }

  useEffect(() => {
    if (!discoveryMode || !groupId || !transientGroupPlan) return
    const applicationKey = [
      transientGroupPlan.groupId,
      transientGroupPlan.permissionVersion,
      transientGroupPlan.context,
      transientGroupPlan.planArea,
      transientGroupPlan.requiredObservation ?? '',
    ].join('\0')
    if (appliedTransientPlanRef.current === applicationKey) return
    appliedTransientPlanRef.current = applicationKey
    if (!searchParams.has('area')) setDiscoveryArea(transientGroupPlan.planArea)
    setDiscoveryCategory(planDiscoveryCategory)
    setText('')
    setSuggestions([])
    setExternalDiscoveryQuery(null)
    setDiscoveryReturnOpen(false)
    discoveryReturnContextRef.current = null
  }, [discoveryMode, groupId, planDiscoveryCategory, searchParams, transientGroupPlan])

  useEffect(() => {
    setPracticalNeedAnswer(null)
    setIncludeObservationsWithGroup(false)
    practicalNeedObservedAtRef.current = null
  }, [activePracticalNeed, groupId])

  useEffect(() => {
    if (!groupId || !groupAudience || session.status !== 'signed-in') return
    if (rawTransientGroupPlan?.groupId === groupId && !transientGroupPlan) {
      clearTransientGroupPlan(groupId)
      appliedTransientPlanRef.current = null
      if (!searchParams.has('area')) setDiscoveryArea('')
      setDiscoveryCategory(null)
      setExternalDiscoveryQuery(null)
      setDiscoveryReturnOpen(false)
      discoveryReturnContextRef.current = null
      setText('')
      setSuggestions([])
      setLinkMessage('The group changed, so its temporary plan was reset. Choose what fits this time again.')
    }
  }, [clearTransientGroupPlan, groupAudience, groupId, rawTransientGroupPlan, searchParams, session.status, transientGroupPlan])

  useEffect(() => {
    if (discoveryMode) discoveryAreaRef.current?.focus()
    else inputRef.current?.focus()
  }, [discoveryMode])
  useLayoutEffect(() => {
    if (!captureFailure || setTag.isPending) return
    const button = captureRecoveryButtonRef.current
    if (button && !button.disabled) button.focus()
  }, [captureFailure, setTag.isPending])
  useLayoutEffect(() => {
    if ((!groupShareFailure && !audienceRefreshFailure) || groupSharePending) return
    const button = groupShareRecoveryButtonRef.current
    if (button && !button.disabled) button.focus()
  }, [audienceRefreshFailure, groupShareFailure, groupSharePending])
  useLayoutEffect(() => {
    if (!discoveryMode || displayedSuggestions.length === 0 || busyId) return
    window.requestAnimationFrame(() => discoveryResultRef.current?.focus())
  }, [discoveryMode, displayedSuggestions.length, busyId])
  useLayoutEffect(() => {
    if (!externalDiscoveryQuery) return
    window.requestAnimationFrame(() => {
      const link = externalDiscoveryRef.current
      link?.focus({ preventScroll: true })
      link?.scrollIntoView({ block: 'center', behavior: 'auto' })
    })
  }, [externalDiscoveryQuery])
  useLayoutEffect(() => {
    if (!discoveryReturnOpen) return
    window.requestAnimationFrame(() => {
      const input = inputRef.current
      input?.focus({ preventScroll: true })
      input?.scrollIntoView({ block: 'center', behavior: 'auto' })
    })
  }, [discoveryReturnOpen])
  useLayoutEffect(() => {
    if (!discoverySuccess) return
    window.requestAnimationFrame(() => {
      const heading = discoverySuccessRef.current
      heading?.focus({ preventScroll: true })
      heading?.scrollIntoView({ block: 'center', behavior: 'auto' })
    })
  }, [discoverySuccess])

  useEffect(() => {
    if (!discoveryMode || groupId) return
    const uid = session.status === 'signed-in'
      ? session.user.uid
      : session.status === 'signed-out'
        ? null
        : undefined
    if (uid === undefined) return
    const previousUid = personalDiscoveryUidRef.current
    personalDiscoveryUidRef.current = uid
    if (previousUid === undefined || previousUid === null || previousUid === uid) return
    seq.current++
    token.current = null
    setDiscoverySuccess(null)
    discoveryContinuationStartingRef.current = false
    setDiscoveryArea('')
    setDiscoveryCategory(null)
    setExternalDiscoveryQuery(null)
    setDiscoveryReturnOpen(false)
    discoveryReturnContextRef.current = null
    setPendingMemory(null)
    setCaptureFailure(null)
    setCaptureTag(null)
    setText('')
    setSuggestions([])
    setLinkMessage(null)
  }, [discoveryMode, groupId, session])

  useEffect(() => {
    if (!searchParams.has('title') && !searchParams.has('text') && !searchParams.has('url')) return
    const cleanUrl = new URL(window.location.href)
    cleanUrl.searchParams.delete('title')
    cleanUrl.searchParams.delete('text')
    cleanUrl.searchParams.delete('url')
    window.history.replaceState(window.history.state, '', cleanUrl)
  }, [searchParams])

  useEffect(() => {
    const mySeq = ++seq.current
    if (!searchReady) {
      token.current = null
      setSuggestions([])
      return
    }
    const q = text.trim()
    if (q.length < 3 || looksLikeGoogleMapsUrl(q)) {
      setSuggestions([])
      return
    }
    if (!autocompleteAvailable) {
      setSuggestions([])
      return
    }
    if (prototype) {
      const fixtureNames: Record<PersonalDiscoveryCategory, string> = {
        coffee: 'Copper Cup Coffee',
        food: 'Sunday Table',
        activity: 'Glasshouse Studio',
        drinks: 'The Amber Room',
      }
      const name = discoveryMode && discoveryCategory ? fixtureNames[discoveryCategory] : q
      setSuggestions([{
        support: 'supported',
        placeId: discoveryMode && discoveryCategory ? `prototype-discovery-${discoveryCategory}` : 'prototype-memory',
        name,
        text: discoveryMode ? `${name}, ${discoveryArea.trim()}` : `${name} · Development result`,
      }])
      return
    }
    const t = setTimeout(async () => {
      token.current ??= newSessionToken()
      const results = await autocomplete(q, token.current)
      if (seq.current === mySeq) {
        const displayedResults = discoveryMode ? results.slice(0, 3) : results
        setSuggestions(displayedResults)
        setLinkMessage(current => {
          if (displayedResults.length > 0) return current
          if (discoveryMode) {
            return `No result appeared for ${q}. Try another area or type a more specific place search.`
          }
          return current === 'Choose the exact Google result below.'
            ? 'No exact result appeared. Try the place name and neighborhood.'
            : current
        })
      }
    }, 350)
    return () => clearTimeout(t)
  }, [text, prototype, discoveryMode, discoveryCategory, discoveryArea, searchReady, autocompleteAvailable])

  const beginConfirmation = (
    details: PlaceDetails,
    initialLabel = '',
    initialCategory?: UserPlaceCategory,
    initialArea?: string,
  ) => {
    setCaptureTag(null)
    setPracticalNeedAnswer(null)
    setIncludeObservationsWithGroup(false)
    practicalNeedObservedAtRef.current = null
    setPendingMemory({
      placeId: gid(details.id),
      googleLabel: details.name,
      ...((details.address || details.primaryType)
        ? { googleContext: [details.primaryType?.replace(/_/g, ' '), details.address].filter(Boolean).join(' · ') }
        : {}),
      initialLabel,
      ...(initialCategory ? { initialCategory } : {}),
      ...(initialArea ? { initialArea } : {}),
    })
    setSuggestions([])
    setLinkMessage(null)
  }

  const chooseCaptureTag = (tag: Tag) => {
    setCaptureTag(tag)
    if (tag === 'tried') setIncludeObservationsWithGroup(false)
  }

  const choosePracticalNeedAnswer = (answer: PracticalNeedAnswer) => {
    haptics.tap()
    setPracticalNeedAnswer(answer)
    setIncludeObservationsWithGroup(false)
    practicalNeedObservedAtRef.current = answer === 'not_sure' ? null : Date.now()
  }

  const finishGroupCapture = async (targetGroupId: string, targetEpoch: number) => {
    if (targetGroupId !== addTargetIdentityRef.current.groupId
      || targetEpoch !== addTargetIdentityRef.current.epoch) return
    setGroupSharePending(false)
    setGroupShareFailure(null)
    setAudienceRefreshFailure(null)
    await queryClient.invalidateQueries({ queryKey: ['group', targetGroupId] })
    if (targetGroupId !== addTargetIdentityRef.current.groupId
      || targetEpoch !== addTargetIdentityRef.current.epoch) return
    navigate(`/g/${targetGroupId}`, { replace: true })
    haptics.success()
  }

  const refreshCaptureAudience = async (attempt: CaptureAttempt, resolveUnknown: boolean) => {
    if (!attempt.groupId
      || attempt.groupId !== addTargetIdentityRef.current.groupId
      || attempt.targetEpoch !== addTargetIdentityRef.current.epoch
      || session.status !== 'signed-in') {
      setGroupShareFailure(null)
      setAudienceRefreshFailure(null)
      setLinkMessage('The target group changed. Your private Keep is unchanged; review sharing for the current group again.')
      return
    }
    const targetGroupId = attempt.groupId
    const targetEpoch = attempt.targetEpoch
    setGroupSharePending(true)
    setAudienceRefreshFailure(null)
    try {
      const currentAudience = prototype
        ? queryClient.getQueryData<GroupCircle[]>(['prototypeGroups'])?.find(group => group.id === targetGroupId) ?? null
        : await fetchGroupAudienceFromServer(targetGroupId, session.user.uid)
      if (targetGroupId !== addTargetIdentityRef.current.groupId
        || targetEpoch !== addTargetIdentityRef.current.epoch) return
      if (!currentAudience) throw new Error('group-audience-unavailable')

      if (resolveUnknown) {
        // Reconcile the current projection before leaving the ambiguous state,
        // but do not mistake its coarse include flags for proof that this exact
        // tag/content write landed. A changed audience always gets a fresh review.
        if (!prototype) {
          await fetchGroupSignalShareStates([targetGroupId], session.user.uid, attempt.memory.placeId)
          if (targetGroupId !== addTargetIdentityRef.current.groupId
            || targetEpoch !== addTargetIdentityRef.current.epoch) return
        }
      }

      setGroupShareFailure(null)
      setCaptureAudienceReview({
        group: currentAudience,
        attempt: { ...attempt, audience: undefined, privateSaved: true, checkingShare: undefined },
        changed: true,
      })
    } catch {
      if (targetGroupId !== addTargetIdentityRef.current.groupId
        || targetEpoch !== addTargetIdentityRef.current.epoch) return
      setAudienceRefreshFailure(attempt)
      haptics.warn()
    } finally {
      if (targetGroupId === addTargetIdentityRef.current.groupId
        && targetEpoch === addTargetIdentityRef.current.epoch) setGroupSharePending(false)
    }
  }

  const confirmMemory = async (
    reviewedMemory: DurablePlaceMemory,
    exactAttempt?: CaptureAttempt,
  ) => {
    let attempt = exactAttempt
    if (!attempt) {
      if (!captureTag || (activePracticalNeed && !practicalNeedAnswer)) return
      const observation = activePracticalNeed && practicalNeedAnswer
        ? practicalNeedObservationPatch(
            activePracticalNeed,
            practicalNeedAnswer,
            practicalNeedObservedAtRef.current ?? Date.now(),
          )
        : null
      attempt = {
        ...(groupId ? { groupId } : {}),
        targetEpoch: addTargetIdentityRef.current.epoch,
        memory: reviewedMemory,
        tag: captureTag,
        ...(observation ? { observation } : {}),
        includeObservations: Boolean(
          observation
          && captureTag !== 'tried'
          && includeObservationsWithGroup,
        ),
      }
    }
    if (attempt.groupId !== (addTargetIdentityRef.current.groupId ?? undefined)
      || attempt.targetEpoch !== addTargetIdentityRef.current.epoch) {
      setCaptureFailure(null)
      setGroupShareFailure(null)
      setAudienceRefreshFailure(null)
      setCaptureAudienceReview(null)
      setLinkMessage('The target group changed. Nothing was replayed; review this place for the current group again.')
      return
    }
    const operationGroupId = attempt.groupId
    const operationEpoch = attempt.targetEpoch
    const { memory, tag: confirmedTag } = attempt
    const continuation = discoveryMode && !groupId
      ? personalDiscoveryContinuation(
          pendingMemory?.discoveryReturnContext?.category ?? discoveryCategory,
          pendingMemory?.discoveryReturnContext?.area ?? discoveryArea,
        )
      : null

    if (groupId && confirmedTag !== 'tried' && !attempt.audience) {
      if (!groupAudience) return
      const audience = buildGroupAudienceStamp(groupAudience)
      if (!audience) {
        setAudienceRefreshFailure(attempt)
        haptics.warn()
        return
      }
      if (!groupAudience.membershipLocked) {
        setCaptureAudienceReview({ group: groupAudience, attempt, changed: false })
        return
      }
      attempt = { ...attempt, audience }
    }

    try {
      if (!attempt.privateSaved) {
        await setTag.mutateAsync({
          tag: confirmedTag,
          place: { id: memory.placeId, memory },
          privateOnly: true,
          reviewSharing: !groupId && confirmedTag !== 'tried',
          privateCapture: !groupId,
          observation: attempt.observation,
        })
        if (operationGroupId !== (addTargetIdentityRef.current.groupId ?? undefined)
          || operationEpoch !== addTargetIdentityRef.current.epoch) return
        attempt = { ...attempt, privateSaved: true }
      }
      setCaptureFailure(null)
    if (groupId && confirmedTag === 'tried') {
      const targetGroupId = attempt.groupId
      if (!targetGroupId) return
      if (prototype && session.status === 'signed-in') {
          queryClient.setQueryData<GroupCircle[]>(['prototypeGroups'], current =>
            (current ?? []).map(group => {
            if (group.id !== targetGroupId) return group
              const removedCount = group.tastes.reduce((count, taste) => count + (
                taste.uid === session.user.uid
                  && taste.saves.some(item => item.placeId === memory.placeId) ? 1 : 0
              ), 0)
              return {
                ...group,
                projectionCount: Math.max(0, group.projectionCount - removedCount),
                tastes: group.tastes.map(taste => taste.uid === session.user.uid
                  ? { ...taste, saves: taste.saves.filter(item => item.placeId !== memory.placeId) }
                  : taste),
              }
            }))
        } else {
          try {
            await shareSignalWithGroup({ groupId: targetGroupId, placeId: memory.placeId, action: 'remove' })
            if (targetGroupId !== addTargetIdentityRef.current.groupId
              || operationEpoch !== addTargetIdentityRef.current.epoch) return
            await queryClient.invalidateQueries({ queryKey: ['group', targetGroupId] })
            if (targetGroupId !== addTargetIdentityRef.current.groupId
              || operationEpoch !== addTargetIdentityRef.current.epoch) return
          } catch {
            if (targetGroupId !== addTargetIdentityRef.current.groupId
              || operationEpoch !== addTargetIdentityRef.current.epoch) return
            showToast({
              kind: 'notice',
              text: `Kept privately. We couldn’t confirm whether it was removed from ${groupAudience?.name ?? 'the group'}; check group sharing below.`,
            })
            navigate(`/p/${memory.placeId}`, { replace: true, state: { checkGroupShare: groupId } })
            return
          }
        }
        showToast({
          kind: 'notice',
          text: `Kept privately. Choose Want or Loved to introduce it to ${groupAudience?.name}.`,
        })
        navigate(`/p/${memory.placeId}`, { replace: true })
        return
      }
      if (groupId) {
        const targetGroupId = attempt.groupId
        if (!targetGroupId) return
        setGroupSharePending(true)
        if (prototype && session.status === 'signed-in') {
          if (prototypeFailure('add-group-audience-changed') && !prototypeAudienceChangedRef.current) {
            prototypeAudienceChangedRef.current = true
            queryClient.setQueryData<GroupCircle[]>(['prototypeGroups'], current => {
              const target = (current ?? []).find(group => group.id === targetGroupId)
              const candidate = (current ?? []).flatMap(group => group.members)
                .find(member => target && !target.memberUids.includes(member.uid))
              if (!target || !candidate) return current
              return (current ?? []).map(group => group.id !== targetGroupId ? group : {
                ...group,
                memberUids: [...group.memberUids, candidate.uid],
                members: [...group.members, candidate],
                tastes: [...group.tastes, { uid: candidate.uid, name: candidate.displayName, saves: [] }],
              })
            })
            throw new GroupRequestError('audience-changed', 409)
          }
          const save = queryClient.getQueryData<FriendSave[]>(['mySaves', session.user.uid])
            ?.find(item => item.placeId === memory.placeId)
          if (save) {
            const projectedSave: FriendSave = { ...save, visibility: 'circle' }
            delete projectedSave.note
            if (attempt.includeObservations && save.observations) {
              projectedSave.observations = observationsForGroup(save.observations)
            } else {
              delete projectedSave.observations
            }
            queryClient.setQueryData<GroupCircle[]>(['prototypeGroups'], current =>
              (current ?? []).map(group => {
                if (group.id !== targetGroupId) return group
                const existingProjection = group.tastes.some(taste =>
                  taste.uid === session.user.uid && taste.saves.some(item => item.placeId === save.placeId))
                return {
                  ...group,
                  membershipLocked: true,
                  projectionCount: group.projectionCount + (existingProjection ? 0 : 1),
                  tastes: group.tastes.map(taste => taste.uid !== session.user.uid ? taste : {
                    ...taste,
                    saves: [projectedSave, ...taste.saves.filter(item => item.placeId !== save.placeId)],
                  }),
                }
              }))
          }
          if (prototypeFailure('add-group-share-response') && !prototypeGroupShareResponseLostRef.current) {
            prototypeGroupShareResponseLostRef.current = true
            throw new Error('prototype ambiguous group-share response')
          }
          await finishGroupCapture(targetGroupId, operationEpoch)
          return
        }
        try {
          if (!attempt.audience) throw new Error('group-audience-unavailable')
          await shareSignalWithGroup({
            groupId: targetGroupId,
            placeId: memory.placeId,
            includeObservations: attempt.includeObservations,
            audience: attempt.audience,
          })
          if (targetGroupId !== addTargetIdentityRef.current.groupId
            || operationEpoch !== addTargetIdentityRef.current.epoch) return
          await finishGroupCapture(targetGroupId, operationEpoch)
          return
        } catch (error) {
          if (targetGroupId !== addTargetIdentityRef.current.groupId
            || operationEpoch !== addTargetIdentityRef.current.epoch) return
          setGroupSharePending(false)
          if (error instanceof GroupRequestError && error.code === 'audience-changed') {
            setGroupShareFailure(null)
            void refreshCaptureAudience(attempt, Boolean(attempt.checkingShare))
          } else {
            setGroupShareFailure(attempt)
            haptics.warn()
          }
          return
        }
      }
      setPendingMemory(null)
      setText('')
      if (discoveryMode) {
        token.current = null
        setDiscoverySuccess({ continuation })
        discoveryContinuationStartingRef.current = false
        if (!continuation) setDiscoveryCategory(null)
        setExternalDiscoveryQuery(null)
        setDiscoveryReturnOpen(false)
        discoveryReturnContextRef.current = null
      }
    } catch (error) {
      if (operationGroupId !== (addTargetIdentityRef.current.groupId ?? undefined)
        || operationEpoch !== addTargetIdentityRef.current.epoch) return
      if (groupId && confirmedTag !== 'tried' && attempt.privateSaved) {
        setGroupSharePending(false)
        if (error instanceof GroupRequestError && error.code === 'audience-changed') {
          setGroupShareFailure(null)
          void refreshCaptureAudience(attempt, Boolean(attempt.checkingShare))
        } else {
          setGroupShareFailure(attempt)
          haptics.warn()
        }
      } else {
        dismissToast()
        setCaptureFailure(attempt)
      }
    }
  }

  const confirmCaptureAudience = () => {
    const review = captureAudienceReview
    if (!review
      || review.attempt.groupId !== addTargetIdentityRef.current.groupId
      || review.attempt.targetEpoch !== addTargetIdentityRef.current.epoch
      || review.group.id !== addTargetIdentityRef.current.groupId) {
      setCaptureAudienceReview(null)
      return
    }
    const audience = buildGroupAudienceStamp(review.group)
    if (!audience) {
      setCaptureAudienceReview(null)
      setAudienceRefreshFailure(review.attempt)
      haptics.warn()
      return
    }
    const attempt = { ...review.attempt, audience }
    setCaptureAudienceReview(null)
    void confirmMemory(attempt.memory, attempt)
  }

  const waitOnCaptureAudience = () => {
    const review = captureAudienceReview
    setCaptureAudienceReview(null)
    haptics.tap()
    if (review?.attempt.privateSaved
      && review.attempt.groupId === addTargetIdentityRef.current.groupId
      && review.attempt.targetEpoch === addTargetIdentityRef.current.epoch) {
      showToast({
        kind: 'notice',
        text: `Kept privately. Nothing was shared with ${review.group.name}.`,
      })
      navigate(`/p/${review.attempt.memory.placeId}`, { replace: true })
    }
  }

  const pick = async (s: Suggestion) => {
    if (busyId) return
    if (s.support === 'unsupported') {
      haptics.warn()
      setLinkMessage(UNSUPPORTED_PLACE_MESSAGE)
      return
    }
    setLinkMessage(null)
    haptics.tap()
    setBusyId(s.placeId)
    const userQuery = text.trim()
    seq.current++ // kill any in-flight autocomplete response
    try {
      let details: PlaceDetails | null = null
      if (import.meta.env.DEV && prototype) {
        details = {
          id: s.placeId,
          name: s.name,
          address: discoveryMode ? `${discoveryArea.trim()} · Development result` : 'Development result',
          primaryType: discoveryMode ? discoveryCategory ?? undefined : undefined,
        }
      } else if (token.current) {
        details = await getCaptureDetails(s.placeId, token.current, s.name)
      }
      if (details) {
        token.current = null // details succeeded — session closed at Google
        beginConfirmation(
          details,
          discoveryMode ? s.name : userQuery,
          discoveryMode ? discoveryCategory ?? undefined : undefined,
          discoveryMode ? discoveryArea.trim() : undefined,
        )
      } else {
        haptics.warn()
        showToast({ kind: 'notice', text: "Couldn't fetch that place — try again" })
      }
    } finally {
      setBusyId(null)
    }
  }

  const startDiscovery = (category: PersonalDiscoveryCategory) => {
    const query = personalDiscoveryQuery(category, discoveryArea)
    if (!query) {
      setLinkMessage('Type a specific city, neighborhood, or meeting area first.')
      discoveryAreaRef.current?.focus()
      return
    }
    haptics.tap()
    seq.current++
    setDiscoverySuccess(null)
    setDiscoveryCategory(category)
    setSuggestions([])
    if (!autocompleteAvailable) {
      token.current = null
      setText('')
      discoveryReturnContextRef.current = {
        category,
        area: discoveryArea.trim().replace(/\s+/g, ' '),
      }
      setDiscoveryReturnOpen(false)
      setExternalDiscoveryQuery(query)
      setLinkMessage(null)
      return
    }
    token.current = newSessionToken()
    discoveryReturnContextRef.current = null
    setDiscoveryReturnOpen(false)
    setExternalDiscoveryQuery(null)
    setText(query)
    setLinkMessage(`One Google search for ${query}. Choose a result to review it.`)
  }

  const findAnotherDiscoveryPlace = () => {
    if (!discoverySuccess || groupId) return
    if (discoveryContinuationStartingRef.current) return
    discoveryContinuationStartingRef.current = true
    const continuation = discoverySuccess.continuation
    if (continuation) {
      startDiscovery(continuation.category)
      return
    }
    setDiscoverySuccess(null)
    seq.current++
    token.current = null
    setSuggestions([])
    setExternalDiscoveryQuery(null)
    setDiscoveryReturnOpen(false)
    discoveryReturnContextRef.current = null
    setText('')
    setLinkMessage(null)
    window.setTimeout(() => discoveryAreaRef.current?.focus(), 0)
  }

  const resolveMapsLink = async (value: string) => {
    if (linkBusy) return
    setLinkBusy(true)
    setLinkMessage('Reading the Google Maps link…')
    seq.current++
    setSuggestions([])
    try {
      const result = await resolveGoogleMapsInput(value)
      if (result.kind === 'place-id') {
        const label = result.query?.trim().slice(0, 120) ?? ''
        const discoveryReturnContext = discoveryMode ? discoveryReturnContextRef.current : null
        token.current = null
        setCaptureTag(null)
        setPendingMemory({
          placeId: gid(result.placeId),
          ...(label ? { googleLabel: label } : {}),
          initialLabel: label,
          ...(discoveryReturnContext ? {
            initialCategory: discoveryReturnContext.category,
            initialArea: discoveryReturnContext.area,
            discoveryReturnContext,
          } : {}),
          exactLinkIdentity: true,
        })
        setLinkMessage(null)
        return
      }
      if (result.kind === 'search') {
        setText(result.query)
        setLinkMessage(autocompleteAvailable
          ? 'Choose the exact Google result below.'
          : 'That link did not contain an exact place identity. In Google Maps, use Share and paste the resulting place link.')
        return
      }
      throw new Error(result.kind === 'invalid' ? result.reason : 'unresolved-short-link')
    } catch {
      haptics.warn()
      setLinkMessage(autocompleteAvailable
        ? 'That link did not identify one place. Paste its place name instead.'
        : 'That link did not identify one place. In Google Maps, open the exact place, tap Share, and paste that place link.')
    } finally {
      setLinkBusy(false)
    }
  }

  const zeroApiDiscoveryHandoff = Boolean(
    discoveryMode && !autocompleteAvailable && externalDiscoveryQuery,
  )
  const placeInput = (
    <>
      <input
        id="add-place-input"
        ref={inputRef}
        className="add-input"
        placeholder={zeroApiDiscoveryHandoff
          ? 'Paste the exact place link from Google Maps\u2026'
          : !autocompleteAvailable
            ? 'Paste an exact Google Maps place link\u2026'
            : discoveryMode ? 'Or type your own place search\u2026' : 'Place name or Google Maps link\u2026'}
        value={text}
        onChange={event => {
          setText(event.target.value)
          if (!zeroApiDiscoveryHandoff) {
            setExternalDiscoveryQuery(null)
            setDiscoveryReturnOpen(false)
            discoveryReturnContextRef.current = null
          }
          setLinkMessage(null)
        }}
        onPaste={event => {
          const value = event.clipboardData.getData('text').trim()
          if (!looksLikeGoogleMapsUrl(value)) return
          event.preventDefault()
          setText(value)
          if (!zeroApiDiscoveryHandoff) {
            setExternalDiscoveryQuery(null)
            setDiscoveryReturnOpen(false)
            discoveryReturnContextRef.current = null
          }
          void resolveMapsLink(value)
        }}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
      />
      {looksLikeGoogleMapsUrl(text) && !linkBusy && (
        <button className="pill pill-primary press add-link-use" onClick={() => void resolveMapsLink(text)}>
          Use this Google Maps link
        </button>
      )}
      {linkMessage && <p className="t-small add-hint" role="status">{linkMessage}</p>}
    </>
  )
  const transientGroupPlanSummary = transientGroupPlan
    ? [
        `${transientGroupPlan.attendeeUids.length + (transientGroupPlan.guestIncluded ? 1 : 0)} going`,
        transientGroupPlan.context === 'Anything' ? '' : transientGroupPlan.context,
        transientGroupPlan.planArea,
        transientGroupPlan.requiredObservation
          ? PLACE_OBSERVATION_LABELS[transientGroupPlan.requiredObservation]
          : '',
      ].filter(Boolean).join(' · ')
    : ''
  const practicalNeedLabel = activePracticalNeed
    ? PLACE_OBSERVATION_LABELS[activePracticalNeed]
    : null
  const practicalNeedReview = practicalNeedLabel && groupAudience ? (
    <fieldset className="place-memory-practical-need">
      <legend className="eyebrow">CURRENT PLAN DETAIL</legend>
      <strong className="t-row-title">Does this place fit “{practicalNeedLabel}”?</strong>
      <p className="t-small">
        Answer only from what you personally know about this place. Not sure saves no evidence.
      </p>
      <div className="place-memory-practical-need-options" role="group" aria-label={`Does this place fit ${practicalNeedLabel}?`}>
        {PRACTICAL_NEED_ANSWER_OPTIONS.map(({ answer, label }) => (
          <button
            key={answer}
            className={`chip press${practicalNeedAnswer === answer ? ' is-on' : ''}`}
            aria-pressed={practicalNeedAnswer === answer}
            disabled={setTag.isPending || Boolean(captureFailure)}
            onClick={() => choosePracticalNeedAnswer(answer)}
          >
            {label}
          </button>
        ))}
      </div>
      {practicalNeedAnswer && practicalNeedAnswer !== 'not_sure' && captureTag && captureTag !== 'tried' && (
        <label className="place-memory-observation-consent">
          <input
            type="checkbox"
            checked={includeObservationsWithGroup}
            disabled={setTag.isPending || Boolean(captureFailure)}
            onChange={event => setIncludeObservationsWithGroup(event.target.checked)}
            aria-label={`Include my useful details with ${groupAudience.name}`}
          />
          <span>
            <strong>Include my useful details with {groupAudience.name}</strong>
            <small>
              Off by default. This shares this answer and any other useful details already saved for this place with this group only.
            </small>
          </span>
        </label>
      )}
      <p className="t-small place-memory-practical-need-status" role="status">
        {!practicalNeedAnswer
          ? 'Choose Yes, No, or Not sure. Nothing has been saved yet.'
          : practicalNeedAnswer === 'not_sure'
            ? 'No observation will be saved or shared.'
            : captureTag === 'tried'
              ? `Your answer will stay in your private Keep. Tried is not introduced to ${groupAudience.name}.`
              : includeObservationsWithGroup
                ? `Your personal record stays private; ${groupAudience.name} receives a group-only copy of your useful details.`
                : `Your answer will be saved to your private Keep only, not shared with ${groupAudience.name}.`}
      </p>
    </fieldset>
  ) : undefined

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="eyebrow">
            {groupId
              ? `${discoveryMode ? 'DISCOVER' : 'ADD'} FOR ${groupAudience?.name.toUpperCase() ?? 'A GROUP'}`
              : discoveryMode ? 'DISCOVER FOR KEEP' : 'ADD A NEW PLACE'}
          </h1>
          <p className="gmp-attribution" translate="no">Google Maps</p>
        </div>
      </header>

      {session.status === 'signed-out' ? (
        <section className="empty-state">
          <p className="t-body">Sign in to start keeping places.</p>
          <button className="pill pill-primary press" onClick={() => void signIn()}>
            Continue with Google
          </button>
        </section>
      ) : groupAudienceLoadFailed ? (
        <section className="empty-state" role="alert" aria-labelledby="add-group-load-failed-title">
          <p className="eyebrow">PRIVATE GROUP</p>
          <h2 id="add-group-load-failed-title" className="t-title">We couldn’t check this group.</h2>
          <p className="t-body">No group name or sharing audience was shown. Nothing has been saved or shared.</p>
          <div className="empty-state-actions">
            <button className="pill pill-primary press" onClick={retryGroupAudience}>Try again</button>
            <button className="pill pill-ghost press" onClick={() => navigate('/together', { replace: true })}>
              Back to Together
            </button>
          </div>
        </section>
      ) : groupAudiencePending ? (
        <section className="empty-state" role="status">
          <p className="eyebrow">CHECKING GROUP</p>
          <p className="t-body">Confirming the exact audience before anything can be shared.</p>
        </section>
      ) : groupAudienceUnavailable ? (
        <section className="empty-state" aria-labelledby="add-group-unavailable-title">
          <p className="eyebrow">GROUP ACCESS CHANGED</p>
          <h2 id="add-group-unavailable-title" className="t-title">That group isn’t available.</h2>
          <p className="t-body">Nothing has been saved or shared. Return to Together and choose a current group.</p>
          <button className="pill pill-primary press" onClick={() => navigate('/together', { replace: true })}>
            Back to Together
          </button>
        </section>
      ) : groupAudienceStillForming ? (
        <section className="empty-state" aria-labelledby="add-group-forming-title">
          <p className="eyebrow">GROUP STILL FORMING</p>
          <h2 id="add-group-forming-title" className="t-title">Finish the audience first.</h2>
          <p className="t-body">
            {groupAudience?.name} cannot receive taste until at least two people have joined. Nothing has been saved or shared from this screen.
          </p>
          <div className="empty-state-actions">
            <button className="pill pill-primary press" onClick={() => navigate(`/g/${groupId}`, { replace: true })}>
              Back to group
            </button>
            <button className="pill pill-ghost press" onClick={() => navigate(discoveryMode ? '/add?mode=discover' : '/add', { replace: true })}>
              Keep privately instead
            </button>
          </div>
        </section>
      ) : pendingMemory ? (
        <>
        {captureFailure && (
          <section className="closeup-data-warning" role="alert" aria-label="Keep save not confirmed">
            <span>
              <strong className="t-row-title">Keep save not confirmed.</strong>
              <span className="t-small">
                We couldn’t confirm {TAG_LABELS[captureFailure.tag]} with the reviewed label, kind, area{captureFailure.observation
                  ? `, and your ${PLACE_OBSERVATION_LABELS[captureFailure.observation.key]} ${captureFailure.observation.value === 'yes' ? 'Yes' : 'No'} answer`
                  : ''}. Checking repeats only that exact private Keep save.{groupAudience ? ` It does not share with ${groupAudience.name} yet; that is the next separate step.` : ''}
              </span>
            </span>
            <button
              ref={captureRecoveryButtonRef}
              className="pill pill-primary press"
              disabled={setTag.isPending}
              onClick={() => void confirmMemory(captureFailure.memory, captureFailure)}
            >{setTag.isPending ? 'Checking…' : 'Check Keep'}</button>
          </section>
        )}
        {groupShareFailure && (
          <section className="closeup-data-warning" role="alert" aria-label="Group sharing not confirmed">
            <span>
              <strong className="t-row-title">Saved privately. Group sharing not confirmed.</strong>
              <span className="t-small">
                Checking again can only repeat this exact share with the circle you reviewed. It will not rebuild the audience or change your private Keep.
              </span>
            </span>
            <button
              ref={groupShareRecoveryButtonRef}
              className="pill pill-primary press"
              disabled={groupSharePending}
              onClick={() => void confirmMemory(groupShareFailure.memory, {
                ...groupShareFailure,
                checkingShare: true,
              })}
            >{groupSharePending ? 'Checking…' : 'Check sharing'}</button>
          </section>
        )}
        {audienceRefreshFailure && (
          <section className="closeup-data-warning" role="alert" aria-label="Sharing circle needs review">
            <span>
              <strong className="t-row-title">Sharing circle needs another review.</strong>
              <span className="t-small">
                The earlier circle was not reused. Nothing will be shared until the current people can be checked and shown to you.
              </span>
            </span>
            <button
              ref={groupShareRecoveryButtonRef}
              className="pill pill-primary press"
              disabled={groupSharePending}
              onClick={() => void refreshCaptureAudience(audienceRefreshFailure, Boolean(audienceRefreshFailure.checkingShare))}
            >{groupSharePending ? 'Checking circle…' : 'Check circle'}</button>
          </section>
        )}
        <PlaceMemoryConfirmation
          placeId={pendingMemory.placeId}
          googleLabel={pendingMemory.googleLabel}
          googleContext={pendingMemory.googleContext}
          initialLabel={pendingMemory.initialLabel}
          initialCategory={pendingMemory.initialCategory}
          initialArea={pendingMemory.initialArea}
          guidance={pendingMemory.exactLinkIdentity
            ? pendingMemory.discoveryReturnContext
              ? `The link supplied one exact Google Maps identity. ${DISCOVERY_CATEGORY_LABELS[pendingMemory.discoveryReturnContext.category]} and ${pendingMemory.discoveryReturnContext.area} came from the choices you just made; review or change them before anything is kept. No Google Place Details request was made.`
              : 'The link supplied one exact Google Maps identity. You supply every detail that is kept below; no Google Place Details request was made.'
            : discoveryMode
              ? 'Google found the place; you decide whether it belongs in your taste. Your confirmed memory starts private unless this exact group is named below.'
              : undefined}
          signalTag={captureTag}
          onSignalTagChange={chooseCaptureTag}
          shareAudience={groupAudience?.name}
          shareIntent={!captureTag ? 'pending' : captureTag === 'tried' ? 'private' : 'share'}
          additionalReview={practicalNeedReview}
          additionalReviewReady={!activePracticalNeed || Boolean(practicalNeedAnswer)}
          actionLabel={!captureTag
            ? 'Choose Want, Tried, or Loved'
            : activePracticalNeed && !practicalNeedAnswer
              ? 'Answer the current plan detail'
            : groupId
              ? captureTag === 'tried'
                ? 'Keep privately as Tried'
                : `Keep & share as ${TAG_LABELS[captureTag]}`
              : `Keep privately as ${TAG_LABELS[captureTag]}`}
          busy={setTag.isPending || groupSharePending}
          locked={Boolean(captureFailure || groupShareFailure || audienceRefreshFailure)}
          onConfirm={memory => void confirmMemory(memory)}
          onCancel={() => {
            setPendingMemory(null)
            setCaptureFailure(null)
            setGroupShareFailure(null)
            setAudienceRefreshFailure(null)
            setPracticalNeedAnswer(null)
            setIncludeObservationsWithGroup(false)
            practicalNeedObservedAtRef.current = null
            window.setTimeout(() => {
              if (discoveryMode && externalDiscoveryQuery) inputRef.current?.focus()
              else if (discoveryMode) discoveryAreaRef.current?.focus()
              else inputRef.current?.focus()
            }, 0)
          }}
        />
        </>
      ) : discoverySuccess && discoveryMode && !groupId ? (
        <section
          className="personal-discovery-success"
          aria-labelledby="personal-discovery-success-title"
          aria-live="polite"
        >
          <p className="eyebrow">PRIVATE KEEP</p>
          <h2
            ref={discoverySuccessRef}
            id="personal-discovery-success-title"
            className="t-display"
            tabIndex={-1}
          >Kept privately</h2>
          <p className="t-body">
            {discoverySuccess.continuation
              ? `Keep looking for ${DISCOVERY_CATEGORY_LABELS[discoverySuccess.continuation.category].toLowerCase()} in ${discoverySuccess.continuation.area}, or finish for now.`
              : 'That place is in your Keep. Choose another direction, or finish for now.'}
          </p>
          <div className="personal-discovery-success-actions">
            <button className="pill pill-primary press" onClick={findAnotherDiscoveryPlace}>
              {discoverySuccess.continuation
                ? `Find another ${DISCOVERY_CATEGORY_LABELS[discoverySuccess.continuation.category]}`
                : 'Find another'}
            </button>
            <button className="pill pill-ghost press" onClick={() => navigate('/saved')}>
              Done &mdash; view Keep
            </button>
          </div>
          <p className="t-small">
            {discoverySuccess.continuation
              ? 'No new search starts until you choose Find another.'
              : 'Find another returns to your temporary area without guessing a category or starting a search.'}
          </p>
        </section>
      ) : (
        <>
          {groupId && groupAudience?.status === 'active' && (
            <section className="group-keep-bridge" aria-labelledby="group-keep-bridge-title">
              <div className="group-keep-bridge-head">
                <p className="eyebrow">FROM YOUR KEEP &middot; ONLY YOU</p>
                <h2 id="group-keep-bridge-title" className="t-display">Start with something you already know.</h2>
                <p className="t-small">
                  Only you can see these private memories here. Opening one shares nothing; {groupAudience.name} is named again before you choose. Notes and useful details stay hidden here.
                </p>
              </div>
              {personalSavesQuery.isPending ? (
                <div className="group-keep-bridge-loading skeleton" aria-label="Checking your private Keep" />
              ) : personalSavesQuery.isError ? (
                <p className="t-small" role="status">Your private Keep could not be checked. Nothing was exposed; you can still find a place below.</p>
              ) : groupKeepMemories.length > 0 ? (
                <ul className="group-keep-bridge-list" aria-label={`Private Keep memories to review for ${groupAudience.name}`}>
                  {groupKeepMemories.map(save => {
                    const memory = save.memory!
                    return (
                      <li key={save.id}>
                        <button
                          className="group-keep-memory press"
                          aria-label={`Review ${memory.label} for sharing with ${groupAudience.name}`}
                          onClick={() => openGroupKeepMemory(save)}
                        >
                          <PinVisual className="group-keep-memory-visual" hex={memory.hex} alt="" />
                          <span className="group-keep-memory-copy">
                            <small className="eyebrow">{save.tag === 'loved' ? 'LOVED' : 'WANT'}</small>
                            <strong>{memory.label}</strong>
                            <small>{[KEEP_CATEGORY_LABELS[memory.category], memory.area].filter(Boolean).join(' \u00b7 ')}</small>
                          </span>
                          <span className="group-keep-memory-action" aria-hidden>Review &rarr;</span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p className="t-small group-keep-bridge-empty">
                  {groupKeepHasPlanFilter
                    ? 'No private Want or Loved memory has the known kind and area in this plan. Missing details stay unknown; find one below or change the plan.'
                    : 'No private Want or Loved memory is ready to offer here yet. Find one below; nothing is shared until review.'}
                </p>
              )}
            </section>
          )}
          {discoveryMode && (
            <section className="personal-discovery" aria-labelledby="personal-discovery-title">
              <p className="eyebrow">TEMPORARY AREA · {autocompleteAvailable ? 'PRIVATE TASTE' : 'ZERO-API SEARCH'}</p>
              <h2 id="personal-discovery-title" className="t-display">Find somewhere worth keeping.</h2>
              <p className="t-body">
                Pick where this outing could happen. Your Want and Loved history only orders the directions below; the area is not saved as your location.
              </p>
              {transientGroupPlan && groupAudience && (
                <aside className="personal-discovery-plan-context" aria-label={`Continuing ${groupAudience.name} plan`}>
                  <p className="eyebrow">CONTINUING {groupAudience.name.toUpperCase()} PLAN</p>
                  <strong>{transientGroupPlanSummary}</strong>
                  <p className="t-small">
                    This draft stays only in this open app. Choose a direction to search; nothing is sent or saved until you act.
                  </p>
                </aside>
              )}
              <label className="personal-discovery-area">
                <span className="eyebrow">AREA FOR THIS SEARCH</span>
                <input
                  ref={discoveryAreaRef}
                  className="add-input"
                  value={discoveryArea}
                  onChange={event => {
                    setDiscoveryArea(event.target.value)
                    setDiscoveryCategory(null)
                    setExternalDiscoveryQuery(null)
                    setDiscoveryReturnOpen(false)
                    discoveryReturnContextRef.current = null
                    setText('')
                    setSuggestions([])
                    setLinkMessage(null)
                  }}
                  placeholder="e.g. Cresskill, NJ"
                  maxLength={80}
                  autoComplete="off"
                  aria-label="Area for discovery"
                />
              </label>
              <div className="personal-discovery-prompts" role="group" aria-label="What kind of place should we find?">
                {discoveryPrompts.map(prompt => (
                  <button
                    key={prompt.category}
                    className={`personal-discovery-prompt press${discoveryCategory === prompt.category ? ' is-on' : ''}`}
                    aria-pressed={discoveryCategory === prompt.category}
                    disabled={!personalDiscoveryQuery(prompt.category, discoveryArea)}
                    onClick={() => startDiscovery(prompt.category)}
                  >
                    <strong>{prompt.label}</strong>
                    <span>{prompt.detail}</span>
                  </button>
                ))}
              </div>
              {externalDiscoveryQuery && personalDiscoveryMapsUrl(externalDiscoveryQuery) && (
                <section
                  className="personal-discovery-handoff"
                  aria-labelledby="personal-discovery-handoff-title"
                >
                  <div>
                    <p className="eyebrow" id="personal-discovery-handoff-title">EXPLORE, THEN BRING ONE BACK</p>
                    <p className="t-small">
                      Google Maps receives only &ldquo;{externalDiscoveryQuery}&rdquo;. Choose one exact place there; this.is keeps nothing until you return and confirm it.
                    </p>
                  </div>
                  <div className="personal-discovery-handoff-actions">
                    <a
                      ref={externalDiscoveryRef}
                      className="pill pill-primary press"
                      href={personalDiscoveryMapsUrl(externalDiscoveryQuery) ?? undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                    >Explore in Google Maps <span aria-hidden>&#8599;</span></a>
                    <button
                      className="pill pill-ghost press"
                      type="button"
                      aria-expanded={discoveryReturnOpen}
                      aria-controls="personal-discovery-return"
                      onClick={() => setDiscoveryReturnOpen(true)}
                    >I found one &mdash; paste its link</button>
                  </div>
                  {discoveryReturnOpen && (
                    <div className="personal-discovery-return" id="personal-discovery-return">
                      <label className="eyebrow" htmlFor="add-place-input">EXACT GOOGLE MAPS PLACE LINK</label>
                      {placeInput}
                      <p className="t-small">
                        Your selected kind and area will be prefilled for review. Both stay editable, and nothing is saved yet.
                      </p>
                    </div>
                  )}
                </section>
              )}
              {!zeroApiDiscoveryHandoff && (
                <div className="personal-discovery-boundary">
                  <p className="eyebrow">{autocompleteAvailable ? 'ONE EXPLICIT SEARCH' : 'NO PLACES API REQUEST'}</p>
                  <p className="t-small">
                    {!autocompleteAvailable
                      ? `Google Maps receives only the area and kind you typed. this.is keeps no area or result until you return and confirm one exact place${groupAudience ? ` for ${groupAudience.name}` : ''}.`
                      : personalSavesQuery.isError
                      ? 'Keep could not be read, so these are broad choices rather than personalized ones. Nothing was inferred.'
                      : groupAudience
                        ? `Private Keep only orders these prompts. Reviewing Want or Loved will name ${groupAudience.name} before this one place is shared.`
                    : 'Choosing a prompt makes one Google autocomplete search. Review shows minimal live place context; a result reaches private Keep only after your confirmation.'}
                  </p>
                </div>
              )}
            </section>
          )}
          {!autocompleteAvailable && !discoveryMode && (
            <section className="add-capture-guide" aria-labelledby="add-link-guide-title">
              <p className="eyebrow">ZERO-API CAPTURE</p>
              <h2 id="add-link-guide-title" className="t-display">Share the exact place from Google Maps.</h2>
              <p className="t-body">
                Search is paused in this build, but an exact Google Maps place link still works. The link supplies identity only; you confirm every detail that reaches Keep.
              </p>
              <div className="add-capture-boundary">
                <p className="eyebrow">NO PLACE DETAILS REQUEST</p>
                <p className="t-small">
                  {groupAudience
                    ? `Nothing reaches ${groupAudience.name} until you confirm Want or Loved.`
                    : 'Nothing reaches Keep until you confirm it.'}
                </p>
              </div>
            </section>
          )}
          {!zeroApiDiscoveryHandoff && placeInput}
          {autocompleteAvailable && text.trim().length === 0 && !linkMessage && !discoveryMode && (
            <section className="add-capture-guide" aria-labelledby="add-capture-guide-title">
              <p className="eyebrow">ONE PLACE · REVIEW FIRST</p>
              <h2 id="add-capture-guide-title" className="t-display">
                {autocompleteAvailable ? 'Paste the link, or type the name.' : 'Paste its exact Google Maps link.'}
              </h2>
              <p className="t-body">
                {autocompleteAvailable
                  ? 'Google search waits for three letters. Choosing a result opens a review—it does not save the place yet.'
                  : 'The link opens a user-confirmed review without requesting Google Place Details. Nothing is saved merely by pasting.'}
              </p>
              <div className="add-capture-boundary">
                <p className="eyebrow">YOUR CONFIRMATION</p>
                <p className="t-small">
                  {groupId
                    ? `You confirm your label, category, and experience before ${groupAudience?.name} receives anything.`
                    : 'You confirm your own label, category, and experience before the place reaches Keep.'}
                </p>
              </div>
            </section>
          )}
          <ul className="add-suggestions">
            {displayedSuggestions.map((s, index) => (
              <li
                className={discoveryMode && s.support === 'supported' ? 'add-suggestion-row has-preview' : undefined}
                key={s.support === 'supported' ? s.placeId : `unsupported-${index}`}
              >
                <button
                  ref={discoveryMode && index === 0 ? discoveryResultRef : undefined}
                  className={`add-suggestion press${s.support === 'supported' && busyId === s.placeId ? ' is-busy' : ''}`}
                  disabled={Boolean(busyId)}
                  onClick={() => void pick(s)}
                >
                  <span className="add-suggestion-text">{s.text}</span>
                  <span className="eyebrow">
                    {s.support === 'unsupported'
                      ? 'WHY UNAVAILABLE'
                      : busyId === s.placeId ? 'OPENING…' : 'REVIEW'}
                  </span>
                </button>
                {discoveryMode && s.support === 'supported' && (
                  <a
                    className="add-suggestion-preview press"
                    href={mapsDeepLink(s.name, s.placeId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Preview ${s.name} in Google Maps (opens in a new tab)`}
                  >
                    <span>Preview in Google Maps</span>
                    <span aria-hidden="true">↗</span>
                  </a>
                )}
              </li>
            ))}
          </ul>
          {autocompleteAvailable && text.trim().length >= 3 && !looksLikeGoogleMapsUrl(text) && suggestions.length === 0 && !linkMessage && (
            <p className="t-small add-hint">Keep typing — Google needs a few more letters.</p>
          )}
        </>
      )}
      {captureAudienceReview && (
        <GroupAudienceConfirmation
          group={captureAudienceReview.group}
          sharingLabel="place"
          privateSaved={captureAudienceReview.attempt.privateSaved}
          includeUsefulDetails={captureAudienceReview.attempt.includeObservations}
          changed={captureAudienceReview.changed}
          onWait={waitOnCaptureAudience}
          onConfirm={confirmCaptureAudience}
        />
      )}
    </div>
  )
}
