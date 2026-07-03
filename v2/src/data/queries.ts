/**
 * TanStack Query hooks over the data core. Query + Firestore's persistent
 * local cache are the ONLY caching layers in v2. Saves live in the flat
 * `saves` collection (v2/FRIENDS.md) — one Want/Tried/Loved per person+place.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../lib/firebaseImpl'
import { useSession } from '../state/session'
import { showToast } from '../state/toast'
import { haptics } from '../lib/haptics'
import type { UserDoc } from './user'
import { cityKeyFrom, cityKeysAround, fetchCandidates, fetchCurated } from './candidates'
import { fetchPlaceSaves, fetchFriendFeed, fetchMySaves, type Tag } from './social'
import { setSave, clearSave, type SaveablePlace } from './saves'
import type { Coords } from '../lib/geo'

export function useUserDoc() {
  const session = useSession()
  const uid = session.status === 'signed-in' ? session.user.uid : null
  return useQuery({
    queryKey: ['userDoc', uid],
    enabled: Boolean(uid),
    staleTime: 60_000,
    queryFn: async (): Promise<UserDoc> => {
      const snap = await getDoc(doc(db, 'users', uid!))
      return snap.exists() ? (snap.data() as UserDoc) : {}
    },
  })
}

/** Your Wall — everywhere you Want/Tried/Loved. */
export function useMySaves() {
  const session = useSession()
  const uid = session.status === 'signed-in' ? session.user.uid : null
  return useQuery({
    queryKey: ['mySaves', uid],
    enabled: Boolean(uid),
    staleTime: 30_000,
    queryFn: () => fetchMySaves(uid!),
  })
}

/** The friend graph on a place — who saved it (you included), what they thought. */
export function usePlaceSaves(placeId: string | undefined) {
  return useQuery({
    queryKey: ['placeSaves', placeId],
    enabled: Boolean(placeId),
    staleTime: 30_000,
    queryFn: () => fetchPlaceSaves(placeId!),
  })
}

/** The friend feed — your circle's nights out, minus your own. */
export function useFriendFeed() {
  const session = useSession()
  const uid = session.status === 'signed-in' ? session.user.uid : undefined
  return useQuery({
    queryKey: ['friendFeed', uid],
    staleTime: 60_000,
    queryFn: () => fetchFriendFeed(uid),
  })
}

/** The curated catalog — the discovery product. City-wide, not cell-gated. */
export function useCurated() {
  return useQuery({
    queryKey: ['curated'],
    staleTime: 10 * 60_000,
    queryFn: () => fetchCurated(),
  })
}

/** The city candidate pool for search + long-tail fallback — the user's cell
 *  plus its 8 neighbors, so pools don't die at cell boundaries. */
export function useCandidates(coords: Coords | null) {
  const cityKey = cityKeyFrom(coords)
  return useQuery({
    queryKey: ['candidates', cityKey],
    enabled: Boolean(cityKey),
    staleTime: 5 * 60_000,
    queryFn: () => fetchCandidates(cityKeysAround(coords)),
  })
}

/**
 * The save gesture: set your Want / Tried / Loved on a place, which writes one
 * doc to the friend graph, fires a haptic (a warm success on Loved), and rises
 * an undo toast. `unsave` removes it from your Wall.
 */
export function useSaveFlow() {
  const qc = useQueryClient()
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['mySaves'] })
    void qc.invalidateQueries({ queryKey: ['placeSaves'] })
    void qc.invalidateQueries({ queryKey: ['friendFeed'] })
  }

  const setTag = useMutation({
    mutationFn: (args: { place: SaveablePlace; tag: Tag; prev?: Tag | null }) =>
      setSave(args.place, args.tag),
    onSuccess: (_d, args) => {
      if (args.tag === 'loved') haptics.success()
      else haptics.tap()
      invalidate()
      showToast({
        kind: 'save',
        placeId: args.place.id,
        tag: args.tag,
        prev: args.prev ?? null,
        place: args.place,
      })
    },
    onError: () => {
      haptics.warn()
      showToast({ kind: 'notice', text: "Couldn't save — try again" })
    },
  })

  const unsave = useMutation({
    mutationFn: (placeId: string) => clearSave(placeId),
    onSuccess: invalidate,
    onError: () => {
      haptics.warn()
      showToast({ kind: 'notice', text: "Couldn't remove it — try again" })
    },
  })

  return { setTag, unsave, invalidate }
}
