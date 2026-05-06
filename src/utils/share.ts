/**
 * Cross-platform share helper. Uses the Web Share API on mobile (which opens
 * the native share sheet), falls back to copy-to-clipboard on desktop. The
 * caller passes a title + url; we return a small status so the UI can show
 * a toast or hint. Silent failures are intentional for the user-cancelled
 * Web Share case (the user dismissing the sheet should not trigger a toast).
 */
export type ShareStatus = 'shared' | 'copied' | 'cancelled' | 'error'

export async function shareLink(opts: { title?: string; text?: string; url: string }): Promise<ShareStatus> {
  const { title, text, url } = opts
  // Web Share API — mobile + Safari support sharing arbitrary urls. Bail out
  // for navigator.share that's typed-but-throws (some embedded browsers).
  const nav = typeof navigator !== 'undefined' ? navigator : null
  if (nav && typeof (nav as { share?: unknown }).share === 'function') {
    try {
      await (nav as { share: (data: ShareData) => Promise<void> }).share({ title, text, url })
      return 'shared'
    } catch (err) {
      // AbortError == user dismissed the sheet. Treat that as cancelled, not
      // an error — no toast, no fallback copy.
      if ((err as { name?: string })?.name === 'AbortError') return 'cancelled'
      // Fall through to clipboard fallback on any other failure.
    }
  }
  // Clipboard fallback — desktop, or browsers without Web Share.
  try {
    if (nav && (nav as { clipboard?: { writeText: (s: string) => Promise<void> } }).clipboard?.writeText) {
      await (nav as { clipboard: { writeText: (s: string) => Promise<void> } }).clipboard.writeText(url)
      return 'copied'
    }
  } catch (err) {
    console.warn('[shareLink] clipboard write failed', err)
  }
  return 'error'
}

/** Build a canonical url for a place hub or list. Always absolute so the
 *  shared link works when pasted anywhere. */
export function placeShareUrl(placeId: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://this-is-76332.web.app'
  return `${origin}/place/${placeId}`
}

export function listShareUrl(listId: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://this-is-76332.web.app'
  return `${origin}/list/${listId}`
}

export function userShareUrl(userId: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://this-is-76332.web.app'
  return `${origin}/user/${userId}`
}
