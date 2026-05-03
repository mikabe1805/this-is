import { useEffect } from 'react'
import { useBodyScrollLock } from './useBodyScrollLock'

/**
 * Wires up Esc-to-close AND body scroll-lock on a modal. Only attached while
 * `isOpen` is true. Click-outside is handled at JSX level by hanging onClick
 * on the backdrop div with stopPropagation on the modal panel — there's no
 * portable hook for that without ref plumbing, so we keep this tiny and
 * focused.
 *
 * Scroll-lock uses a refcount so stacked modals don't corrupt each other's
 * overflow state.
 */
export function useModalDismiss(isOpen: boolean, onClose: () => void) {
  useBodyScrollLock(isOpen)

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])
}
