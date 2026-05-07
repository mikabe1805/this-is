import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * Tiny global toast bar. Listens for `this-is:toast` CustomEvent on window:
 *   window.dispatchEvent(new CustomEvent('this-is:toast', {
 *     detail: { message: 'Saved', action: { label: 'View', href: '/list/abc' } }
 *   }))
 *
 * Mounted once in App.tsx. Auto-dismisses after ~2.4s (4s when an action
 * is present so the user has time to react). Stacks at the bottom so it
 * doesn't clash with the floating action bar.
 *
 * The optional `action` is a tappable affordance — it can be a route to
 * navigate to (`href`) or a free-form click handler (`onClick`). The
 * latter has to be set via dispatchEvent on the same tick — it isn't
 * serializable across event boundaries, but for in-page firing that's
 * fine.
 */
type ToastAction = { label: string; href?: string; onClick?: () => void }
type ToastDetail = { message: string; tone?: 'info' | 'error'; action?: ToastAction }

export default function Toast() {
  const [toast, setToast] = useState<ToastDetail | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const onToast = (e: Event) => {
      const detail = (e as CustomEvent).detail as ToastDetail | undefined
      if (!detail?.message) return
      setToast(detail)
    }
    window.addEventListener('this-is:toast', onToast)
    return () => window.removeEventListener('this-is:toast', onToast)
  }, [])

  useEffect(() => {
    if (!toast) return
    // Hold actionable toasts on screen a bit longer so the user can tap.
    const ttl = toast.action ? 4200 : 2400
    const t = setTimeout(() => setToast(null), ttl)
    return () => clearTimeout(t)
  }, [toast])

  if (!toast) return null

  const isError = toast.tone === 'error'
  const handleAction = () => {
    if (!toast.action) return
    if (toast.action.href) navigate(toast.action.href)
    else toast.action.onClick?.()
    setToast(null)
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed left-1/2 -translate-x-1/2 bottom-24 z-[100]"
    >
      <div
        className={`px-4 h-10 inline-flex items-center gap-3 rounded-full label-eyebrow shadow-cozy backdrop-blur-md ${
          isError
            ? 'bg-red-50/95 text-red-800 border border-red-200/80'
            : 'bg-ink/90 text-paper border border-ink/40'
        }`}
      >
        <span>{toast.message}</span>
        {toast.action && (
          <button
            type="button"
            onClick={handleAction}
            className={`-mr-1 px-2.5 h-7 rounded-full label-eyebrow transition-colors ${
              isError
                ? 'bg-red-200/60 text-red-900 hover:bg-red-200/90'
                : 'bg-paper/15 text-paper hover:bg-paper/25'
            }`}
          >
            {toast.action.label}
          </button>
        )}
      </div>
    </div>
  )
}
