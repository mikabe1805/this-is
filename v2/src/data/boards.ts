import { collection, doc, getDocs, setDoc } from 'firebase/firestore'
import { db } from '../lib/firebaseImpl'
import { requireUid } from '../state/session'
import type { Board } from './types'

export const DEFAULT_BOARD_NAME = 'Saved'

export async function listBoards(uid: string): Promise<Board[]> {
  const snap = await getDocs(collection(db, 'users', uid, 'boards'))
  return snap.docs
    .map(d => ({ id: d.id, ...(d.data() as Omit<Board, 'id'>) }))
    .sort((a, b) => b.lastUsedAt - a.lastUsedAt)
}

/**
 * The likely-board guess behind the one-tap save:
 * most shared vibe tags → most recently used → none (caller creates "Saved").
 */
export function pickLikelyBoard(boards: Board[], vibeTags: string[]): Board | null {
  if (!boards.length) return null
  let best = boards[0]
  let bestScore = -1
  for (const b of boards) {
    const score = (b.vibeTags ?? []).filter(t => vibeTags.includes(t)).length
    if (score > bestScore) {
      best = b
      bestScore = score
    }
  }
  // Zero overlap everywhere → boards[0] is already the most recently used.
  return best
}

export async function createBoard(name: string, coverHex = '#3A2B31'): Promise<Board> {
  const uid = requireUid()
  const ref = doc(collection(db, 'users', uid, 'boards'))
  const now = Date.now()
  const board: Omit<Board, 'id'> = {
    name: name.trim(),
    coverHex,
    vibeTags: [],
    pinCount: 0,
    createdAt: now,
    lastUsedAt: now,
  }
  await setDoc(ref, board)
  return { id: ref.id, ...board }
}
