import { useEffect, useRef } from 'react'

/**
 * Bottom-sheet swipe-to-dismiss. Attach a ref to the modal panel; when the
 * user drags it down past `threshold` px, `onDismiss` fires. Below the
 * threshold the panel follows the finger and snaps back on release. No-op
 * outside touch contexts (desktop mouse drags don't trigger this).
 *
 * Usage:
 *   const ref = useRef<HTMLDivElement>(null)
 *   useSwipeToDismiss({ ref, onDismiss: onClose, enabled: isOpen })
 *   return <div ref={ref}>...</div>
 *
 * The hook only listens while `enabled` is true and detaches cleanly on
 * unmount, so it won't leak listeners across modal opens.
 */
export function useSwipeToDismiss(opts: {
  ref: React.RefObject<HTMLElement | null>
  onDismiss: () => void
  enabled: boolean
  threshold?: number
}) {
  const { ref, onDismiss, enabled, threshold = 100 } = opts
  // Track drag state in refs so we don't re-render the modal on every touchmove.
  const startY = useRef<number | null>(null)
  const lastY = useRef<number | null>(null)
  const dragging = useRef(false)

  useEffect(() => {
    if (!enabled) return
    const el = ref.current
    if (!el) return

    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0]
      if (!t) return
      // Only initiate when the gesture starts on the drag handle. Without
      // this, dragging inside a scrollable child (e.g. comments list) would
      // hijack the user's intent to scroll and accidentally dismiss.
      const target = e.target as Element | null
      if (!target || !target.closest('[data-drag-handle]')) return
      startY.current = t.clientY
      lastY.current = t.clientY
      dragging.current = true
      el.style.transition = 'none'
    }

    const onTouchMove = (e: TouchEvent) => {
      if (!dragging.current || startY.current === null) return
      const t = e.touches[0]
      if (!t) return
      const dy = t.clientY - startY.current
      lastY.current = t.clientY
      if (dy > 0) {
        // Resist the pull a bit (rubber-band feel) and never go negative.
        el.style.transform = `translateY(${dy}px)`
      } else {
        el.style.transform = ''
      }
    }

    const onTouchEnd = () => {
      if (!dragging.current || startY.current === null || lastY.current === null) {
        dragging.current = false
        return
      }
      const dy = lastY.current - startY.current
      el.style.transition = 'transform 220ms ease'
      el.style.transform = ''
      dragging.current = false
      startY.current = null
      lastY.current = null
      if (dy > threshold) onDismiss()
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: true })
    el.addEventListener('touchend', onTouchEnd)
    el.addEventListener('touchcancel', onTouchEnd)

    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('touchcancel', onTouchEnd)
      el.style.transition = ''
      el.style.transform = ''
    }
  }, [ref, onDismiss, enabled, threshold])
}
