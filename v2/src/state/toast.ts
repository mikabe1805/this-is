/**
 * Toast store — the save toast is the trust surface of the one action that
 * isn't discovery. App-wide law: no confirm dialogs anywhere; undo toasts only.
 */
import { useSyncExternalStore } from 'react'
import type { Tag } from '../data/social'
import type { SaveablePlace } from '../data/saves'

export type SaveToastData = {
  kind: 'save'
  placeId: string
  tag: Tag
  /** The tag before this action (null if it wasn't saved) — so Undo restores. */
  prev: Tag | null
  place: SaveablePlace
  /** A private Add capture may offer an explicit, never-automatic group handoff. */
  reviewSharing?: boolean
  /** The just-completed capture had no group audience and should say so plainly. */
  privateCapture?: boolean
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

export function showToast(data: SaveToastData | NoticeToastData, ms = 6000): void {
  if (timer) clearTimeout(timer)
  current = { ...data, id: nextId++ }
  emit()
  timer = setTimeout(() => {
    current = null
    emit()
  }, ms)
}

export function dismissToast(): void {
  if (timer) clearTimeout(timer)
  timer = null
  current = null
  emit()
}

function subscribe(l: () => void): () => void {
  listeners.add(l)
  return () => listeners.delete(l)
}

const get = () => current

export function useToast(): Toast | null {
  return useSyncExternalStore(subscribe, get, get)
}
