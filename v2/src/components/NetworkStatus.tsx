import { useCallback, useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

interface ConnectionState {
  online: boolean
  lastOnlineAt: number | null
}

function initialConnection(): ConnectionState {
  const online = typeof navigator === 'undefined' || navigator.onLine
  return { online, lastOnlineAt: online ? Date.now() : null }
}

export function NetworkStatus() {
  const queryClient = useQueryClient()
  const [connection, setConnection] = useState<ConnectionState>(initialConnection)
  const [retryMessage, setRetryMessage] = useState('')

  const resume = useCallback(async () => {
    try {
      await queryClient.resumePausedMutations()
      await queryClient.invalidateQueries()
    } catch {
      // Individual queries and mutations retain their own recoverable error state.
    }
  }, [queryClient])

  useEffect(() => {
    const onOffline = () => {
      setRetryMessage('')
      setConnection(current => ({ online: false, lastOnlineAt: current.lastOnlineAt ?? Date.now() }))
    }
    const onOnline = () => {
      setRetryMessage('')
      setConnection({ online: true, lastOnlineAt: Date.now() })
      void resume()
    }
    window.addEventListener('offline', onOffline)
    window.addEventListener('online', onOnline)
    return () => {
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('online', onOnline)
    }
  }, [resume])

  if (connection.online) return null

  const retry = () => {
    if (!navigator.onLine) {
      setRetryMessage('Still offline.')
      return
    }
    setConnection({ online: true, lastOnlineAt: Date.now() })
    setRetryMessage('')
    void resume()
  }
  const lastOnline = connection.lastOnlineAt
    ? new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })
      .format(connection.lastOnlineAt)
    : null

  return (
    <section className="network-status" role="status" aria-live="polite">
      <div>
        <strong>Offline</strong>
        <p>
          Showing saved data when available. Changes sync after reconnecting.
          {lastOnline ? ` Last online ${lastOnline}.` : ''}
        </p>
        {retryMessage && <p className="network-status-retry">{retryMessage}</p>}
      </div>
      <button className="pill pill-ghost press" onClick={retry}>Retry</button>
    </section>
  )
}
