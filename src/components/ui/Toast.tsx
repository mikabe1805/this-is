import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { haptics } from '../../utils/haptics'

/**
 * Global toast bar. Listens for `this-is:toast` CustomEvent on window:
 *   window.dispatchEvent(new CustomEvent('this-is:toast', {
 *     detail: { message: 'Saved', action: { label: 'View', href: '/list/abc' } }
 *   }))
 *
 * Mounted once in App.tsx. Toasts STACK (newest nearest the dock) instead of
 * clobbering each other, rise in on mount, and sit clear of the bottom nav via
 * a safe-area-aware offset. Auto-dismiss after ~2.4s (4.2s when an action is
 * present so the user has time to react).
 *
 * The optional `action` is a tappable affordance — a route to navigate to
 * (`href`) or a free-form click handler (`onClick`).
 */
type ToastAction = { label: string; href?: string; onClick?: () => void }
type ToastDetail = { message: string; tone?: 'info' | 'error' | 'success'; action?: ToastAction }
type ToastItem = ToastDetail & { id: number }

let _seq = 0

export default function Toast() {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const navigate = useNavigate()
  const timers = useRef<Record<number, ReturnType<typeof setTimeout>>>({})

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
    const tm = timers.current[id]
    if (tm) { clearTimeout(tm); delete timers.current[id] }
  }, [])

  useEffect(() => {
    const onToast = (e: Event) => {
      const detail = (e as CustomEvent).detail as ToastDetail | undefined
      if (!detail?.message) return
      const id = ++_seq
      // Cap at 3 visible — drop the oldest so the stack never marches up
      // the screen.
      setToasts(prev => [...prev.slice(-2), { ...detail, id }])
      // Confirmations and errors get distinct haptics; most info toasts in
      // this app are commit confirmations ("Saved", "Updated", "Following").
      if (detail.tone === 'error') haptics.warn()
      else haptics.success()
      const ttl = detail.action ? 4200 : 2400
      timers.current[id] = setTimeout(() => dismiss(id), ttl)
    }
    window.addEventListener('this-is:toast', onToast)
    return () => {
      window.removeEventListener('this-is:toast', onToast)
      Object.values(timers.current).forEach(clearTimeout)
      timers.current = {}
    }
  }, [dismiss])

  if (toasts.length === 0) return null

  const handleAction = (t: ToastItem) => {
    if (t.action?.href) navigate(t.action.href)
    else t.action?.onClick?.()
    dismiss(t.id)
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-2 px-4 w-full max-w-md pointer-events-none"
      style={{ bottom: 'calc(64px + env(safe-area-inset-bottom, 0px) + 16px)' }}
    >
      {toasts.map(t => {
        const isError = t.tone === 'error'
        return (
          <div
            key={t.id}
            className={`animate-toast-in pointer-events-auto max-w-full px-4 h-10 inline-flex items-center gap-3 rounded-full label-eyebrow shadow-cozy backdrop-blur-md ${
              isError
                ? 'bg-red-50/95 text-red-800 border border-red-200/80'
                : 'bg-ink/90 text-paper border border-ink/40'
            }`}
          >
            <span className="truncate">{t.message}</span>
            {t.action && (
              <button
                type="button"
                onClick={() => handleAction(t)}
                className={`-mr-1 px-2.5 h-7 rounded-full label-eyebrow shrink-0 transition-colors ${
                  isError
                    ? 'bg-red-200/60 text-red-900 hover:bg-red-200/90'
                    : 'bg-paper/15 text-paper hover:bg-paper/25'
                }`}
              >
                {t.action.label}
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
