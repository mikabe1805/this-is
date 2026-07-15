export const PAIR_PROTOTYPE_STORAGE_KEY = '__this_is_pair_prototype'
export const prototypeSignalStorageKey = (uid: string, placeId: string) =>
  `__this_is_signal:${uid}:${placeId}`
export const prototypeSignalVisibilityStorageKey = (uid: string, placeId: string) =>
  `__this_is_signal_visibility:${uid}:${placeId}`
export const prototypeActivePickStorageKey = (groupId: string) => `__this_is_active_pick:${groupId}`
export const prototypeRecentPickStorageKey = (groupId: string) => `__this_is_recent_pick:${groupId}`

export type PrototypeKind = 'group'

/** Which reproducible development-only QA world is active. */
export function prototypeKind(): PrototypeKind | null {
  if (!import.meta.env.DEV || typeof window === 'undefined') return null
  const requested = new URLSearchParams(window.location.search).get('prototype')
  if (requested === 'group') return requested
  const stored = window.sessionStorage.getItem(PAIR_PROTOTYPE_STORAGE_KEY)
  if (stored === 'group') return 'group'
  return null
}

/** Generic prototype guard retained under the old name for existing call sites. */
export function isPairPrototype(): boolean {
  return prototypeKind() !== null
}

/** Development-only failure fixtures for browser-checking recovery states. */
export function prototypeFailure(name: string): boolean {
  if (!isPairPrototype() || typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get('failure') === name
}
