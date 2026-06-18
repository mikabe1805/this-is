import { useEffect, useRef, useState } from 'react'

/**
 * Pull-to-refresh for the app's inner scroll region. The document root is
 * locked (`position: fixed; touch-action: none`) and all scrolling lives on
 * `[data-scroll-root]` (the `<main>` in App.tsx), so native overscroll PTR
 * isn't available — this implements it manually: when the user drags down while
 * already at the top, we resist the pull and, past a threshold, fire `onRefresh`.
 *
 * Returns `{ pull, refreshing }` so the caller can render an indicator. The
 * touchmove listener is non-passive (needed to preventDefault the rubber-band)
 * but only acts while genuinely pulling down at scrollTop 0, so normal scrolling
 * is untouched.
 */
export function usePullToRefresh(onRefresh: () => Promise<void> | void, opts: { threshold?: number } = {}) {
  const threshold = opts.threshold ?? 70
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  const onRefreshRef = useRef(onRefresh)
  onRefreshRef.current = onRefresh
  const pullRef = useRef(0)
  const refreshingRef = useRef(false)
  const startY = useRef<number | null>(null)
  const active = useRef(false)

  const applyPull = (v: number) => { pullRef.current = v; setPull(v) }
  const setRefreshingBoth = (v: boolean) => { refreshingRef.current = v; setRefreshing(v) }

  useEffect(() => {
    const el = document.querySelector('[data-scroll-root]') as HTMLElement | null
    if (!el) return

    const onStart = (e: TouchEvent) => {
      if (refreshingRef.current || el.scrollTop > 0) { active.current = false; return }
      const t = e.touches[0]
      if (!t) return
      startY.current = t.clientY
      active.current = true
    }

    const onMove = (e: TouchEvent) => {
      if (!active.current || startY.current === null || refreshingRef.current) return
      const t = e.touches[0]
      if (!t) return
      const dy = t.clientY - startY.current
      // Bail if they're scrolling up, or the list scrolled off the top.
      if (dy <= 0 || el.scrollTop > 0) {
        if (pullRef.current) applyPull(0)
        active.current = false
        return
      }
      e.preventDefault()
      applyPull(Math.min(dy * 0.5, threshold * 1.6)) // rubber-band resistance
    }

    const onEnd = () => {
      if (!active.current) return
      active.current = false
      startY.current = null
      if (pullRef.current >= threshold) {
        setRefreshingBoth(true)
        applyPull(threshold)
        Promise.resolve(onRefreshRef.current()).finally(() => {
          setRefreshingBoth(false)
          applyPull(0)
        })
      } else {
        applyPull(0)
      }
    }

    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd, { passive: true })
    el.addEventListener('touchcancel', onEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', onEnd)
    }
  }, [threshold])

  return { pull, refreshing, threshold }
}
