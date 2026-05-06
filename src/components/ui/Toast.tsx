import { useEffect, useState } from 'react'

/**
 * Tiny global toast bar. Listens for `this-is:toast` CustomEvent on window:
 *   window.dispatchEvent(new CustomEvent('this-is:toast', {
 *     detail: { message: 'Link copied' }
 *   }))
 *
 * Mounted once in App.tsx. Auto-dismisses after 2.4s. Stacks at the bottom
 * so it doesn't clash with the floating action bar.
 */
type ToastDetail = { message: string; tone?: 'info' | 'error' }

export default function Toast() {
  const [toast, setToast] = useState<ToastDetail | null>(null)

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
    const t = setTimeout(() => setToast(null), 2400)
    return () => clearTimeout(t)
  }, [toast])

  if (!toast) return null

  const isError = toast.tone === 'error'
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed left-1/2 -translate-x-1/2 bottom-24 z-[100] pointer-events-none"
    >
      <div
        className={`px-4 h-10 inline-flex items-center rounded-full label-eyebrow shadow-cozy backdrop-blur-md ${
          isError
            ? 'bg-red-50/95 text-red-800 border border-red-200/80'
            : 'bg-ink/90 text-paper border border-ink/40'
        }`}
      >
        {toast.message}
      </div>
    </div>
  )
}
