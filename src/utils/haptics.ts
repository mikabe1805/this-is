/**
 * Lightweight haptic feedback.
 *
 * `navigator.vibrate` fires real vibration on Android / Chrome (including
 * installed PWAs). iOS Safari has no Vibration API, so every call no-ops
 * gracefully — no feature detection needed at the call site.
 *
 * Gated on two things:
 *   1. The user's `hapticFeedback` preference. The canonical value lives in the
 *      Firestore prefs doc, but we mirror it to localStorage so this module can
 *      decide synchronously on the tap path (a Firestore read per tap would be
 *      absurd). Settings keeps the mirror in sync via `setEnabled`.
 *   2. `prefers-reduced-motion` — users who opt out of motion get no buzz.
 */

const PREF_KEY = 'this-is:haptics'

function enabled(): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return false
  try {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false
  } catch {
    /* matchMedia unavailable — ignore */
  }
  try {
    const v = localStorage.getItem(PREF_KEY)
    return v === null ? true : v === 'true' // default on
  } catch {
    return true
  }
}

function buzz(pattern: number | number[]) {
  if (!enabled()) return
  try { navigator.vibrate(pattern) } catch { /* ignore */ }
}

export const haptics = {
  /** A light tick — taps, toggles, opening a sheet. */
  tap: () => buzz(8),
  /** A slightly firmer tick — selecting an option. */
  select: () => buzz(12),
  /** A two-beat confirm — save, follow, message sent. */
  success: () => buzz([10, 30, 16]),
  /** A heavier triple — destructive / error feedback. */
  warn: () => buzz([22, 40, 22]),
  /** Keep the localStorage mirror in sync with the saved preference. */
  setEnabled: (on: boolean) => {
    try { localStorage.setItem(PREF_KEY, String(on)) } catch { /* ignore */ }
  },
}
