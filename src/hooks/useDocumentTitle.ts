import { useEffect } from 'react'

const DEFAULT_TITLE = 'this.is'
const SUFFIX = ' · this.is'

/**
 * Set document.title and (best-effort) the meta description while a route is
 * mounted. Restores both on unmount so the next route doesn't inherit stale
 * values. Pass `undefined` to keep whatever's currently set without changing
 * (e.g. while data is still loading).
 *
 * NOTE: Open Graph + Twitter Card tags are intentionally not handled here.
 * Social crawlers don't execute JS, so injecting og:* tags client-side does
 * nothing for link previews; that needs SSR or a static prerender.
 */
export function useDocumentTitle(title?: string | null, description?: string | null) {
  useEffect(() => {
    const prevTitle = document.title
    const metaDesc = document.querySelector<HTMLMetaElement>('meta[name="description"]')
    const prevDesc = metaDesc?.content ?? null

    if (typeof title === 'string') {
      const trimmed = title.trim()
      document.title = trimmed ? `${trimmed}${SUFFIX}` : DEFAULT_TITLE
    }
    if (typeof description === 'string' && metaDesc) {
      metaDesc.content = description
    }

    return () => {
      document.title = prevTitle
      if (metaDesc && prevDesc !== null) metaDesc.content = prevDesc
    }
  }, [title, description])
}
