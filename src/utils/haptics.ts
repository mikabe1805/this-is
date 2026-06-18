/**
 * Lightweight haptic feedback with two backends.
 *
 *   1. **iOS native bridge** — when the app runs inside its WKWebView wrapper,
 *      a `window.webkit.messageHandlers.haptic` handler (registered by the
 *      native shell) maps a semantic type → `UIImpactFeedbackGenerator` /
 *      `UINotificationFeedbackGenerator`. This is the real iOS feel; the web
 *      Vibration API does NOT exist on iOS Safari/WKWebView.
 *   2. **`navigator.vibrate`** — Android / Chrome (including installed PWAs).
 *
 * If neither is present every call no-ops gracefully — no feature detection at
 * the call site. The native handler must be registered in the iOS wrapper for
 * (1) to produce a buzz; until then these calls are harmless no-ops there.
 *
 * Gated on two things:
 *   1. The user's `hapticFeedback` preference. The canonical value lives in the
 *      Firestore prefs doc, but we mirror it to localStorage so this module can
 *      decide synchronously on the tap path (a Firestore read per tap would be
 *      absurd). Settings keeps the mirror in sync via `setEnabled`.
 *   2. `prefers-reduced-motion` — users who opt out of motion get no buzz.
 */

const PREF_KEY = 'this-is:haptics'

/** Semantic feedback types the native iOS bridge understands. */
type HapticType = 'light' | 'medium' | 'success' | 'warning'

function preferenceAllows(): boolean {
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

function iosBridge(): ((type: HapticType) => void) | null {
  try {
    const handler = (window as any)?.webkit?.messageHandlers?.haptic
    if (handler && typeof handler.postMessage === 'function') {
      return (type: HapticType) => handler.postMessage(type)
    }
  } catch {
    /* not in a WKWebView bridge — ignore */
  }
  return null
}

function canVibrate(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
}

/**
 * Fire feedback. `type` drives the native iOS generator; `pattern` is the
 * Android `navigator.vibrate` fallback for the same intent.
 */
function fire(type: HapticType, pattern: number | number[]) {
  if (!preferenceAllows()) return
  const bridge = iosBridge()
  if (bridge) {
    try { bridge(type) } catch { /* ignore */ }
    return
  }
  if (canVibrate()) {
    try { navigator.vibrate(pattern) } catch { /* ignore */ }
  }
}

export const haptics = {
  /** A light tick — taps, toggles, opening a sheet. */
  tap: () => fire('light', 8),
  /** A slightly firmer tick — selecting an option. */
  select: () => fire('medium', 12),
  /** A two-beat confirm — save, follow, message sent. */
  success: () => fire('success', [10, 30, 16]),
  /** A heavier triple — destructive / error feedback. */
  warn: () => fire('warning', [22, 40, 22]),
  /** Keep the localStorage mirror in sync with the saved preference. */
  setEnabled: (on: boolean) => {
    try { localStorage.setItem(PREF_KEY, String(on)) } catch { /* ignore */ }
  },
}
