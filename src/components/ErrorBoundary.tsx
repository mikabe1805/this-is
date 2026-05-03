import React from 'react'

interface State {
  error: Error | null
  errorInfo: React.ErrorInfo | null
}

/**
 * Catches render-time errors anywhere in the tree and shows a friendly
 * recovery UI instead of a white screen. This is the safety net of last
 * resort — most legitimate failures should be handled inline at the call
 * site. But when the app loads legacy data with missing fields and a
 * defensive `?.` was forgotten somewhere, this prevents the entire app
 * from going dark.
 */
export default class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  state: State = { error: null, errorInfo: null }

  static getDerivedStateFromError(error: Error): State {
    return { error, errorInfo: null }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] caught:', error, errorInfo)
    this.setState({ error, errorInfo })
  }

  handleReset = () => {
    this.setState({ error: null, errorInfo: null })
  }

  handleHardReload = () => {
    try {
      // Wipe service worker cache so we don't reload into the same broken
      // bundle. This is the "kick everything" recovery.
      if ('serviceWorker' in navigator) {
        void navigator.serviceWorker.getRegistrations().then(rs => Promise.all(rs.map(r => r.unregister())))
      }
      if ('caches' in window) {
        void caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
      }
    } catch {}
    window.location.replace('/')
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="min-h-full flex items-center justify-center p-6 bg-paper text-ink">
        <div className="max-w-sm w-full text-center modal-paper border border-edge rounded-2xl p-6">
          <p className="label-eyebrow text-ink-mute">Something glitched</p>
          <h1 className="font-display text-[26px] leading-tight mt-2">Lost the trail<span style={{ color: 'var(--bloom)' }}>.</span></h1>
          <p className="text-[13px] text-ink-soft mt-2">
            The app hit an unexpected error. Your data is safe — try closing this view and going back.
          </p>
          {this.state.error?.message && (
            <p className="font-mono text-[10px] tracking-[0.10em] uppercase text-ink-mute mt-4 break-words">
              {this.state.error.message.slice(0, 120)}
            </p>
          )}
          <div className="flex gap-2 mt-5">
            <button
              type="button"
              onClick={this.handleReset}
              className="btn-secondary flex-1 h-11 text-[14px] font-semibold"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={this.handleHardReload}
              className="btn-cta flex-1 h-11 text-[14px] font-semibold"
            >
              Reload app
            </button>
          </div>
        </div>
      </div>
    )
  }
}
