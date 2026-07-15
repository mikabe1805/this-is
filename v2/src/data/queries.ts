/**
 * TanStack Query hooks over the data core. Query + Firestore's persistent
 * local cache are the ONLY caching layers in v2. Saves live in the flat
 * `saves` collection (v2/FRIENDS.md) — one Want/Tried/Loved per person+place.
 */
import { useEffect, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { doc, getDoc, onSnapshot } from 'firebase/firestore'
import { db } from '../lib/firebaseImpl'
import { useSession } from '../state/session'
import { showToast } from '../state/toast'
import { haptics } from '../lib/haptics'
import type { UserDoc } from './user'
import { fetchCatalog } from './candidates'
import { fetchMySaves, type FriendSave, type Tag } from './social'
import { setSave, clearSave, type SaveablePlace } from './saves'
import { isPairPrototype, prototypeFailure, prototypeSignalStorageKey } from '../lib/prototypeMode'
import { fetchConnections, otherConnectionUids } from './connections'
import { track } from './analytics'
import { fetchGroup, fetchGroupAudience, fetchGroups, validGroupDocumentId } from './groups'
import { normalizeGroupSummary, type GroupCircle, type GroupSummary } from '../domain/groups'
import { planLiveGroupSummary } from '../domain/groupLiveState'
import { categoryPrimaryType } from '../domain/placeMemory'
import { observationsForGroup, type PlaceObservationPatch } from '../domain/placeObservations'

export function useUserDoc() {
  const session = useSession()
  const uid = session.status === 'signed-in' ? session.user.uid : null
  return useQuery({
    queryKey: ['userDoc', uid],
    enabled: Boolean(uid),
    staleTime: isPairPrototype() ? Infinity : 60_000,
    queryFn: async (): Promise<UserDoc> => {
      const snap = await getDoc(doc(db, 'users', uid!))
      return snap.exists() ? (snap.data() as UserDoc) : {}
    },
  })
}

/** The intentional circle comes only from explicit two-person connections. */
export function useCircleUids() {
  const session = useSession()
  const uid = session.status === 'signed-in' ? session.user.uid : null
  const connections = useQuery({
    queryKey: ['connections', uid],
    enabled: Boolean(uid) && !isPairPrototype(),
    staleTime: 60_000,
    queryFn: () => fetchConnections(uid!),
  })
  const connected = uid ? otherConnectionUids(connections.data ?? [], uid) : []
  return {
    ...connections,
    data: [...new Set(connected)],
  }
}

interface UseGroupsOptions {
  /** Primary directories revalidate on deliberate entry/focus, never by polling. */
  freshOnMount?: boolean
}

/** Accepted recurring groups. Membership and signal projection are server-owned. */
export function useGroups({ freshOnMount = false }: UseGroupsOptions = {}) {
  const session = useSession()
  const uid = session.status === 'signed-in' ? session.user.uid : null
  return useQuery({
    queryKey: ['groups', uid],
    enabled: Boolean(uid) && !isPairPrototype(),
    staleTime: 30_000,
    refetchOnMount: freshOnMount ? 'always' : undefined,
    refetchOnWindowFocus: freshOnMount ? 'always' : false,
    queryFn: () => fetchGroups(uid!),
  })
}

export function useGroup(groupId: string | undefined) {
  const session = useSession()
  const qc = useQueryClient()
  const uid = session.status === 'signed-in' ? session.user.uid : null
  const enabled = Boolean(uid) && validGroupDocumentId(groupId) && !isPairPrototype()
  const query = useQuery({
    queryKey: ['group', groupId, uid],
    enabled,
    staleTime: 30_000,
    queryFn: () => fetchGroup(groupId!),
  })
  useEffect(() => {
    if (!enabled || !groupId || !uid) return
    const queryKey = ['group', groupId, uid] as const
    return onSnapshot(doc(db, 'groups', groupId), snapshot => {
      if (!snapshot.exists()) {
        qc.setQueryData<GroupCircle | null>(queryKey, null)
        return
      }
      const next = normalizeGroupSummary(snapshot.id, snapshot.data())
      const current = qc.getQueryData<GroupCircle | null>(queryKey)
      if (!next || !current) return
      const plan = planLiveGroupSummary(current, next)
      if (plan.action === 'refetch') {
        void qc.invalidateQueries({ queryKey, exact: true })
      } else {
        qc.setQueryData<GroupCircle | null>(queryKey, plan.value)
      }
    }, () => {
      // Permission loss must remove cached taste immediately. Offline Firestore
      // continues from its local cache and does not use this terminal callback.
      qc.setQueryData<GroupCircle | null>(queryKey, null)
    })
  }, [enabled, groupId, qc, uid])
  return query
}

/** One-document audience check for Add. It never loads group taste. */
export function useGroupAudience(groupId: string | undefined) {
  const session = useSession()
  const qc = useQueryClient()
  const uid = session.status === 'signed-in' ? session.user.uid : null
  const enabled = Boolean(uid) && validGroupDocumentId(groupId) && !isPairPrototype()
  const query = useQuery({
    queryKey: ['groupAudience', groupId, uid],
    enabled,
    staleTime: 30_000,
    queryFn: () => fetchGroupAudience(groupId!, uid!),
  })
  useEffect(() => {
    if (!enabled || !groupId || !uid) return
    const queryKey = ['groupAudience', groupId, uid] as const
    return onSnapshot(doc(db, 'groups', groupId), snapshot => {
      if (!snapshot.exists()) {
        qc.setQueryData<GroupSummary | null>(queryKey, null)
        return
      }
      const next = normalizeGroupSummary(snapshot.id, snapshot.data())
      qc.setQueryData<GroupSummary | null>(queryKey, next?.memberUids.includes(uid) ? next : null)
    }, () => {
      qc.setQueryData<GroupSummary | null>(queryKey, null)
    })
  }, [enabled, groupId, qc, uid])
  return query
}

/** Your Wall — everywhere you Want/Tried/Loved. */
export function useMySaves({ enabled = true }: { enabled?: boolean } = {}) {
  const session = useSession()
  const uid = session.status === 'signed-in' ? session.user.uid : null
  return useQuery({
    queryKey: ['mySaves', uid],
    enabled: Boolean(uid) && enabled,
    staleTime: isPairPrototype() ? Infinity : 30_000,
    queryFn: () => fetchMySaves(uid!),
  })
}

/** Retained only for authorized prototype/compatibility place-page lookups. */
export function useCatalog() {
  return useQuery({
    queryKey: ['placeCatalog'],
    staleTime: 10 * 60_000,
    queryFn: () => fetchCatalog(),
  })
}

/**
 * The save gesture: set your Want / Tried / Loved on a place, which writes one
 * private-first Keep record, fires a haptic (a warm success on Loved), and rises
 * an undo toast. `unsave` removes it from Keep.
 */
export function useSaveFlow() {
  const qc = useQueryClient()
  const session = useSession()
  const uid = session.status === 'signed-in' ? session.user.uid : null
  const prototypeLostTagOperations = useRef(new Set<string>())
  const prototypeLostRemovalOperations = useRef(new Set<string>())
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['mySaves'] })
    void qc.invalidateQueries({ queryKey: ['placeSaves'] })
  }

  const setPrototypeSave = (place: SaveablePlace, tag: Tag, privateOnly = false) => {
    if (!uid) return
    const previous = qc.getQueryData<FriendSave[]>(['mySaves', uid])
      ?.find(item => item.placeId === place.id && item.uid === uid)
    const storedValue = window.sessionStorage.getItem(prototypeSignalStorageKey(uid, place.id))
    const stored = storedValue ? JSON.parse(storedValue) as Partial<FriendSave> : undefined
    const next: FriendSave = {
      ...previous,
      id: `${uid}__${place.id}`,
      uid,
      placeId: place.id,
      tag: stored?.tag ?? tag,
      visibility: privateOnly ? 'private' : stored?.visibility ?? previous?.visibility ?? 'private',
      ts: stored?.ts ?? previous?.ts ?? Date.now(),
      memory: stored?.memory ?? place.memory,
      ...(stored?.note !== undefined ? { note: stored.note } : {}),
      ...(stored?.observations !== undefined ? { observations: stored.observations } : {}),
      place: {
        name: place.memory.label,
        primaryType: categoryPrimaryType(place.memory.category),
        hex: place.memory.hex,
      },
    }
    const unchanged = Boolean(previous
      && previous.tag === next.tag
      && previous.visibility === next.visibility
      && previous.ts === next.ts
      && previous.memory?.placeId === next.memory?.placeId
      && previous.memory?.label === next.memory?.label
      && previous.memory?.category === next.memory?.category
      && previous.memory?.area === next.memory?.area
      && previous.memory?.hex === next.memory?.hex
      && previous.note === next.note
      && JSON.stringify(previous.observations) === JSON.stringify(next.observations))
    if (unchanged) return
    const upsert = (current: FriendSave[] | undefined) => [
      next,
      ...(current ?? []).filter(item => item.placeId !== place.id || item.uid !== uid),
    ]
    qc.setQueryData<FriendSave[]>(['mySaves', uid], upsert)
    qc.setQueriesData<FriendSave[]>({ queryKey: ['placeSaves', place.id] }, upsert)
    // A newly captured prototype place has no detail query yet. Seed the exact
    // signed-in-only audience key so opening it from Keep sees the same memory.
    qc.setQueryData<FriendSave[]>(['placeSaves', place.id, [uid]], upsert)
    qc.setQueryData<GroupCircle[]>(['prototypeGroups'], current => (current ?? []).map(group => ({
      ...group,
      tastes: group.tastes.map(taste => taste.uid !== uid ? taste : {
        ...taste,
        saves: taste.saves.map(save => {
          if (save.placeId !== place.id) return save
          const projected = {
            ...save,
            tag: next.tag,
            ts: next.ts,
            memory: next.memory,
            place: next.place,
          }
          if (save.note !== undefined) {
            if (next.note !== undefined) projected.note = next.note
            else delete projected.note
          }
          if (save.observations !== undefined) {
            if (next.observations !== undefined) projected.observations = observationsForGroup(next.observations)
            else delete projected.observations
          }
          return projected
        }),
      }),
    })))
  }

  const removePrototypeSave = (placeId: string) => {
    if (!uid) return
    const remove = (current: FriendSave[] | undefined) =>
      (current ?? []).filter(item => item.placeId !== placeId || item.uid !== uid)
    qc.setQueryData<FriendSave[]>(['mySaves', uid], remove)
    qc.setQueriesData<FriendSave[]>({ queryKey: ['placeSaves', placeId] }, remove)
    qc.setQueryData<FriendSave[]>(['placeSaves', placeId, [uid]], remove)
    qc.setQueryData<GroupCircle[]>(['prototypeGroups'], current => (current ?? []).map(group => {
      const removedCount = group.tastes.reduce((count, taste) => count + (
        taste.uid === uid && taste.saves.some(save => save.placeId === placeId) ? 1 : 0
      ), 0)
      if (removedCount === 0) return group
      return {
        ...group,
        projectionCount: Math.max(0, group.projectionCount - removedCount),
        tastes: group.tastes.map(taste => taste.uid === uid
          ? { ...taste, saves: taste.saves.filter(save => save.placeId !== placeId) }
          : taste),
      }
    }))
  }

  const setTag = useMutation({
    mutationFn: async (args: {
      place: SaveablePlace
      tag: Tag
      prev?: Tag | null
      privateOnly?: boolean
      reviewSharing?: boolean
      privateCapture?: boolean
      observation?: PlaceObservationPatch
    }) => {
      await setSave(args.place, args.tag, {
        privateOnly: args.privateOnly,
        observation: args.observation,
      })
      const operationKey = [
        args.place.id,
        args.tag,
        args.privateOnly === true,
        JSON.stringify(args.place.memory),
        JSON.stringify(args.observation ?? null),
      ].join(':')
      if (isPairPrototype() && prototypeFailure('keep-tag-response')
        && !prototypeLostTagOperations.current.has(operationKey)) {
        prototypeLostTagOperations.current.add(operationKey)
        throw new Error('prototype ambiguous Keep tag response')
      }
    },
    onSuccess: (_d, args) => {
      track('signal_saved', { tag: args.tag })
      if (args.tag === 'loved') haptics.celebrate()
      else haptics.tap()
      if (isPairPrototype()) setPrototypeSave(args.place, args.tag, args.privateOnly === true)
      else invalidate()
      showToast({
        kind: 'save',
        placeId: args.place.id,
        tag: args.tag,
        prev: args.prev ?? null,
        place: args.place,
        reviewSharing: args.reviewSharing,
        privateCapture: args.privateCapture,
      })
    },
    onError: () => {
      haptics.warn()
      showToast({ kind: 'notice', text: "Keep change not confirmed. Reopen the place and check its current state before changing it again." })
    },
  })

  const unsave = useMutation({
    mutationFn: async (placeId: string) => {
      await clearSave(placeId)
      if (isPairPrototype() && prototypeFailure('keep-remove-response')
        && !prototypeLostRemovalOperations.current.has(placeId)) {
        prototypeLostRemovalOperations.current.add(placeId)
        throw new Error('prototype ambiguous Keep removal response')
      }
    },
    onSuccess: (_data, placeId) => {
      if (isPairPrototype()) removePrototypeSave(placeId)
      else invalidate()
    },
    onError: () => {
      haptics.warn()
      showToast({ kind: 'notice', text: "Keep removal not confirmed. Reopen the place or Keep to check whether it is still there." })
    },
  })

  return { setTag, unsave, invalidate }
}
