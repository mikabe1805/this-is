import { useEffect, useState } from 'react'
import { ArrowLeftIcon, ChatBubbleLeftIcon } from '@heroicons/react/24/outline'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { firebaseMessagingService, type MessageThread } from '../services/firebaseMessagingService'
import { formatRelativeTime } from '../utils/dateUtils'

const Messages = () => {
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const [threads, setThreads] = useState<MessageThread[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!currentUser) return
    setLoading(true)
    // Live subscription so new/updated threads and last-message previews
    // appear without a manual refresh.
    const unsub = firebaseMessagingService.subscribeMyThreads(currentUser.id, rows => {
      setThreads(rows)
      setLoading(false)
    })
    return () => { unsub() }
  }, [currentUser])

  return (
    <div className="relative min-h-full bg-paper">
      <header className="sticky top-0 z-30 bg-paper/90 backdrop-blur-md">
        <div className="px-5 safe-top pb-3 flex items-center gap-3">
          <button
            onClick={() => { if (window.history.length > 1) navigate(-1); else navigate('/profile') }}
            aria-label="Back"
            className="h-10 w-10 rounded-full hover:bg-paper-deep flex items-center justify-center"
          >
            <ArrowLeftIcon className="w-5 h-5 text-ink" />
          </button>
          <h1 className="font-display text-[22px] leading-none text-ink">Messages</h1>
        </div>
        <div className="border-b border-edge mx-5" />
      </header>

      <div className="relative z-10 px-5 py-5 max-w-2xl mx-auto">
        {loading ? (
          <ul className="divide-y divide-edge border-y border-edge">
            {Array.from({ length: 6 }).map((_, i) => (
              <li key={i} className="flex items-center gap-3 px-1 py-3.5">
                <span className="skeleton w-12 h-12 rounded-full shrink-0" />
                <span className="flex-1 min-w-0">
                  <span className="skeleton block h-[14px] w-1/3 rounded-md" />
                  <span className="skeleton block h-[12px] w-2/3 rounded-md mt-2" />
                </span>
              </li>
            ))}
          </ul>
        ) : threads.length === 0 ? (
          <div className="border border-edge rounded-[14px] px-5 py-12 text-center bg-card">
            <ChatBubbleLeftIcon className="w-8 h-8 text-ink-mute mx-auto mb-3" />
            <p className="font-display text-[22px] text-ink leading-tight">No messages yet.</p>
            <p className="text-[13px] text-ink-soft mt-2 max-w-sm mx-auto">
              Open someone's profile and tap Message to start a conversation.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-edge border-y border-edge">
            {threads.map(t => {
              const other = t.otherUser
              const unread = !!t.unread
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => navigate(`/messages/${t.id}`, { viewTransition: true })}
                    className="w-full flex items-center gap-3 px-1 py-3.5 text-left hover:bg-paper-deep transition-colors"
                  >
                    <img
                      src={other?.avatar || '/assets/default-avatar.svg'}
                      alt={other?.name || ''}
                      className="w-12 h-12 rounded-full object-cover bg-paper-deep ring-1 ring-edge shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <p className={`font-display text-[18px] leading-tight truncate ${unread ? 'text-ink font-semibold' : 'text-ink'}`}>
                          {other?.name || other?.username || 'Unknown'}
                        </p>
                        {t.lastMessageAt && (
                          <span className={`font-mono text-[10px] tracking-[0.10em] uppercase shrink-0 ${unread ? 'text-accent' : 'text-ink-mute'}`}>
                            {formatRelativeTime(t.lastMessageAt)}
                          </span>
                        )}
                      </div>
                      {t.lastMessage ? (
                        <p className={`text-[13px] truncate mt-0.5 ${unread ? 'text-ink font-medium' : 'text-ink-soft'}`}>
                          {t.lastSenderId === currentUser?.id ? 'You: ' : ''}{t.lastMessage}
                        </p>
                      ) : (
                        <p className="text-[12px] text-ink-mute italic mt-0.5">Conversation started · no messages yet</p>
                      )}
                    </div>
                    {unread && <span className="accent-bead accent-bead-sm shrink-0" aria-label="Unread" />}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

export default Messages
