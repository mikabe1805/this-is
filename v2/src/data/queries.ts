/**
 * TanStack Query hooks over the data core. Query + Firestore's persistent
 * local cache are the ONLY caching layers in v2.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { collection, doc, getDoc, getDocs } from 'firebase/firestore'
import { db } from '../lib/firebaseImpl'
import { useSession } from '../state/session'
import { showToast, updateToast } from '../state/toast'
import { haptics } from '../lib/haptics'
import type { Board, Pin, PinStatus } from './types'
import { listBoards } from './boards'
import { savePin, undoSave, refilePin, setPinStatus, type SaveOptions, type SaveReceipt } from './pins'
import type { UserDoc } from './user'
import { cityKeyFrom, cityKeysAround, fetchCandidates, fetchCurated } from './candidates'
import type { Coords } from '../lib/geo'

export function usePins() {
  const session = useSession()
  const uid = session.status === 'signed-in' ? session.user.uid : null
  return useQuery({
    queryKey: ['pins', uid],
    enabled: Boolean(uid),
    staleTime: 30_000,
    queryFn: async (): Promise<Pin[]> => {
      const snap = await getDocs(collection(db, 'users', uid!, 'pins'))
      return snap.docs
        .map(d => ({ id: d.id, ...(d.data() as Omit<Pin, 'id'>) }))
        .sort((a, b) => b.lastTouchedAt - a.lastTouchedAt)
    },
  })
}

export function useBoards() {
  const session = useSession()
  const uid = session.status === 'signed-in' ? session.user.uid : null
  return useQuery({
    queryKey: ['boards', uid],
    enabled: Boolean(uid),
    staleTime: 30_000,
    queryFn: () => listBoards(uid!),
  })
}

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

export function usePin(pinId: string | undefined): Pin | undefined {
  const { data } = usePins()
  return pinId ? data?.find(p => p.id === pinId) : undefined
}

export function useBoard(boardId: string | undefined): Board | undefined {
  const { data } = useBoards()
  return boardId ? data?.find(b => b.id === boardId) : undefined
}

/**
 * The full save gesture: one tap → committed pin + haptic + undo toast.
 * Returns mutations for save / undo / re-file / status so every surface
 * shares the identical flow.
 */
export function useSaveFlow() {
  const qc = useQueryClient()
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['pins'] })
    void qc.invalidateQueries({ queryKey: ['boards'] })
  }

  const save = useMutation({
    mutationFn: (opts: SaveOptions) => savePin(opts),
    onSuccess: receipt => {
      haptics.success()
      invalidate()
      showToast({
        kind: 'save',
        pinId: receipt.pinId,
        boardId: receipt.boardId,
        boardName: receipt.boardName,
        status: receipt.status,
        receipt,
      })
    },
    onError: () => {
      haptics.warn()
      showToast({ kind: 'notice', text: "Couldn't save — try again" })
    },
  })

  const undo = useMutation({
    mutationFn: (receipt: SaveReceipt) => undoSave(receipt),
    onSuccess: invalidate,
    onError: () => {
      haptics.warn()
      showToast({ kind: 'notice', text: "Couldn't undo — still saved" })
    },
  })

  const refile = useMutation({
    mutationFn: (args: { pinId: string; boardId: string; boardName: string }) =>
      refilePin(args.pinId, args.boardId),
    onSuccess: (_data, args) => {
      haptics.select()
      invalidate()
      // If the save toast already expired, confirm with a fresh notice.
      if (!updateToast({ boardId: args.boardId, boardName: args.boardName })) {
        showToast({ kind: 'notice', text: `Moved to ${args.boardName}` })
      }
    },
    onError: () => {
      haptics.warn()
      showToast({ kind: 'notice', text: "Couldn't move it — try again" })
    },
  })

  const setStatus = useMutation({
    mutationFn: (args: { pinId: string; status: PinStatus }) =>
      setPinStatus(args.pinId, args.status),
    onSuccess: (_data, args) => {
      if (args.status === 'been') haptics.success()
      invalidate()
      updateToast({ status: args.status === 'released' ? 'want' : args.status })
    },
  })

  return { save, undo, refile, setStatus, invalidate }
}
