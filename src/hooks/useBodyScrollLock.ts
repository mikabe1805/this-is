import { useEffect } from 'react'

/**
 * Lock the page body from scrolling while a modal is open. Uses a module-level
 * refcount so multiple stacked modals all contribute to the same lock — and
 * the lock is only released when the *last* modal closes. Without the
 * refcount, two stacked modals racing to save/restore `body.style.overflow`
 * leave the page either permanently locked or permanently unlocked depending
 * on close order.
 */
let lockCount = 0
let originalOverflow: string | null = null

function acquire() {
  if (typeof document === 'undefined') return
  if (lockCount === 0) {
    originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }
  lockCount += 1
}

function release() {
  if (typeof document === 'undefined') return
  lockCount = Math.max(0, lockCount - 1)
  if (lockCount === 0) {
    document.body.style.overflow = originalOverflow ?? ''
    originalOverflow = null
  }
}

export function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return
    acquire()
    return release
  }, [active])
}
