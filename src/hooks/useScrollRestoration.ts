import { useEffect } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

/**
 * Restores scroll position on back-navigation for the app's scroll container
 * (`[data-scroll-root]` in App.tsx — scrolling happens there, NOT on window,
 * so React Router's built-in ScrollRestoration can't help).
 *
 * Behavior:
 *   - PUSH / REPLACE → scroll to top (you opened a new page).
 *   - POP (back/forward) → restore the saved offset for that history entry.
 *
 * The fix for the "back dumps me at the top of the feed" complaint. Because
 * lazy routes + async data mean the page may not be tall enough to scroll yet
 * when we restore, we retry over a few frames until the target is reachable.
 */
const positions = new Map<string, number>()

export function useScrollRestoration() {
  const location = useLocation()
  const navType = useNavigationType()
  const key = location.key

  useEffect(() => {
    const el = document.querySelector<HTMLElement>('[data-scroll-root]')
    if (!el) return

    let raf = 0
    if (navType === 'POP' && positions.has(key)) {
      const target = positions.get(key) || 0
      let tries = 0
      const restore = () => {
        el.scrollTop = target
        // Keep nudging until the content is tall enough to hold the offset, or
        // we give up after ~0.5s.
        if (Math.abs(el.scrollTop - target) > 2 && tries < 30) {
          tries++
          raf = requestAnimationFrame(restore)
        }
      }
      raf = requestAnimationFrame(restore)
    } else {
      el.scrollTop = 0
    }

    const onScroll = () => { positions.set(key, el.scrollTop) }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      if (raf) cancelAnimationFrame(raf)
      positions.set(key, el.scrollTop)
      el.removeEventListener('scroll', onScroll)
    }
  }, [key, navType])
}
