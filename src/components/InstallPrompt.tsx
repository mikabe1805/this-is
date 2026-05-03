import { useEffect, useState } from 'react'
import { ArrowDownTrayIcon, XMarkIcon, ShareIcon, PlusIcon } from '@heroicons/react/24/outline'
import { createPortal } from 'react-dom'

type BIPEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

const STORAGE_KEY = 'this-is:install-prompt-dismissed-at'
const COOLDOWN_DAYS = 14

const isIOS = () =>
  typeof navigator !== 'undefined' &&
  /iPad|iPhone|iPod/.test(navigator.userAgent) &&
  !(window as unknown as { MSStream?: unknown }).MSStream

const isStandalone = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true)

function recentlyDismissed(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return false
    const ts = Number(raw)
    if (!Number.isFinite(ts)) return false
    return Date.now() - ts < COOLDOWN_DAYS * 24 * 60 * 60 * 1000
  } catch {
    return false
  }
}

export default function InstallPrompt() {
  const [bip, setBip] = useState<BIPEvent | null>(null)
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (isStandalone()) return
    if (recentlyDismissed()) return

    const onBip = (e: Event) => {
      e.preventDefault()
      setBip(e as BIPEvent)
      setShow(true)
    }
    window.addEventListener('beforeinstallprompt', onBip)

    if (isIOS()) {
      const timer = setTimeout(() => setShow(true), 4000)
      return () => {
        clearTimeout(timer)
        window.removeEventListener('beforeinstallprompt', onBip)
      }
    }
    return () => window.removeEventListener('beforeinstallprompt', onBip)
  }, [])

  const dismiss = () => {
    setShow(false)
    try { localStorage.setItem(STORAGE_KEY, String(Date.now())) } catch {}
  }

  const install = async () => {
    if (!bip) return
    try {
      await bip.prompt()
      const result = await bip.userChoice
      if (result.outcome === 'accepted') {
        setShow(false)
      } else {
        dismiss()
      }
    } catch (e) {
      console.warn('[install] prompt failed', e)
      dismiss()
    }
  }

  if (!show) return null

  const ios = isIOS()

  return createPortal(
    <div
      className="fixed left-0 right-0 z-[10010] px-4 pointer-events-none"
      style={{ bottom: 'calc(env(safe-area-inset-bottom) + 88px)' }}
    >
      <div className="mx-auto max-w-md pointer-events-auto">
        <div
          className="modal-paper border border-edge rounded-2xl px-4 py-3.5 flex items-start gap-3"
          style={{ boxShadow: '0 12px 36px rgba(46, 28, 13, 0.18)' }}
        >
          <div className="w-9 h-9 rounded-full glass-honey flex items-center justify-center shrink-0 relative z-10">
            <ArrowDownTrayIcon className="w-5 h-5 text-ink" />
          </div>
          <div className="flex-1 min-w-0 relative z-10">
            <p className="font-display text-[16px] leading-tight text-ink">Add to home screen</p>
            {ios ? (
              <p className="text-[12px] text-ink-soft mt-0.5 leading-snug">
                Tap <ShareIcon className="w-3.5 h-3.5 inline-block align-[-2px]" /> Share, then{' '}
                <span className="inline-flex items-center gap-0.5 font-medium text-ink">
                  <PlusIcon className="w-3 h-3" />Add to Home Screen
                </span>.
              </p>
            ) : (
              <p className="text-[12px] text-ink-soft mt-0.5 leading-snug">
                Install for full-screen access — same as a native app.
              </p>
            )}
            {!ios && (
              <button
                type="button"
                onClick={install}
                className="btn-cta h-8 px-3 mt-2 text-[12px] font-semibold"
              >
                Install
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss"
            className="h-8 w-8 -mr-1 rounded-full hover:bg-paper-deep flex items-center justify-center text-ink-mute shrink-0 relative z-10"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
