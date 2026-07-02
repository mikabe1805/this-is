/**
 * Toast store — the save toast is the entire trust surface of the core
 * action, so it gets a real (tiny) store instead of a window event bus.
 * App-wide law: no confirm dialogs anywhere; undo toasts only.
 */
import { useSyncExternalStore } from 'react'
// Type-only import — erased at compile time, so this store stays out of the
// Firebase chunk graph.
import type { SaveReceipt } from '../data/pins'

export type SaveToastData = {
  kind: 'save'
  pinId: string
  boardId: string
  boardName: string
  status: 'want' | 'been'
  /** Carried so Undo can restore-or-delete without a lookup. */
  receipt: SaveReceipt
}

export type NoticeToastData = {
  kind: 'notice'
  text: string
}

export type Toast = (SaveToastData | NoticeToastData) & { id: number }

let current: Toast | null = null
let nextId = 1
let timer: ReturnType<typeof setTimeout> | null = null
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach(l => l())
}

export function showToast(data: SaveToastData | NoticeToastData, ms = 7000): void {
  if (timer) clearTimeout(timer)
  current = { ...data, id: nextId++ }
  emit()
  timer = setTimeout(() => {
    current = null
    emit()
  }, ms)
}

/**
 * Patch the visible toast in place (e.g. after a re-file or a Been toggle).
 * Returns false when no save toast is showing, so callers can fall back to a
 * fresh notice instead of confirming into the void.
 */
export function updateToast(patch: Partial<SaveToastData>): boolean {
  if (!current || current.kind !== 'save') return false
  current = { ...current, ...patch }
  emit()
  return true
}

export function dismissToast(): void {
  if (timer) clearTimeout(timer)
  timer = null
  current = null
  emit()
}

/** Suspend auto-dismiss — the user is interacting (e.g. the picker is open). */
export function holdToast(): void {
  if (timer) clearTimeout(timer)
  timer = null
}

/** Re-arm auto-dismiss after an interaction settles. */
export function armToast(ms = 4000): void {
  if (!current) return
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    current = null
    emit()
  }, ms)
}

function subscribe(l: () => void): () => void {
  listeners.add(l)
  return () => listeners.delete(l)
}

const get = () => current

export function useToast(): Toast | null {
  return useSyncExternalStore(subscribe, get, get)
}
