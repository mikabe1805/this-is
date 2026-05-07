import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeftIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { firebaseDataService } from '../services/firebaseDataService'
import { firebaseMessagingService, type DirectMessage } from '../services/firebaseMessagingService'
import { formatTimestamp } from '../utils/dateUtils'
import type { User } from '../types/index.js'

const MessageThread = () => {
  const { threadId = '' } = useParams<{ threadId: string }>()
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const [messages, setMessages] = useState<DirectMessage[]>([])
  const [otherUser, setOtherUser] = useState<User | null>(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Derive the "other" user id from the deterministic thread id.
  // Format: `<sortedAId>__<sortedBId>`. If currentUser is one of the two,
  // the other id is the remaining segment.
  const otherUserId = useMemo(() => {
    if (!threadId || !currentUser) return null
    const parts = threadId.split('__')
    if (parts.length !== 2) return null
    return parts.find(p => p !== currentUser.id) || null
  }, [threadId, currentUser])

  // Load the other user's profile for the header.
  useEffect(() => {
    if (!otherUserId) return
    let cancelled = false
    firebaseDataService.getCurrentUser(otherUserId)
      .then(u => { if (!cancelled) setOtherUser(u) })
      .catch(() => { if (!cancelled) setOtherUser(null) })
    return () => { cancelled = true }
  }, [otherUserId])

  // Live-subscribe to messages.
  useEffect(() => {
    if (!threadId || !currentUser) return
    const unsub = firebaseMessagingService.subscribeMessages(threadId, setMessages)
    return () => unsub()
  }, [threadId, currentUser])

  // Auto-scroll to bottom when new messages arrive.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages.length])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentUser || !threadId || !draft.trim() || sending) return
    setSending(true)
    const text = draft.trim()
    setDraft('')
    try {
      const sent = await firebaseMessagingService.sendMessage(threadId, currentUser.id, text)
      if (!sent) {
        setDraft(text)
        window.dispatchEvent(new CustomEvent('this-is:toast', { detail: { message: "Couldn't send. Try again.", tone: 'error' } }))
      }
    } catch (err) {
      console.error('[message-thread] send failed', err)
      setDraft(text)
      window.dispatchEvent(new CustomEvent('this-is:toast', { detail: { message: "Couldn't send. Try again.", tone: 'error' } }))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="relative h-full flex flex-col bg-paper">
      <header className="sticky top-0 z-30 bg-paper/90 backdrop-blur-md">
        <div className="px-5 pt-5 pb-3 flex items-center gap-3">
          <button
            onClick={() => { if (window.history.length > 1) navigate(-1); else navigate('/messages') }}
            aria-label="Back"
            className="h-10 w-10 rounded-full hover:bg-paper-deep flex items-center justify-center"
          >
            <ArrowLeftIcon className="w-5 h-5 text-ink" />
          </button>
          <button
            type="button"
            onClick={() => otherUser && navigate(`/user/${otherUser.id}`)}
            className="flex-1 flex items-center gap-3 text-left hover:bg-paper-deep rounded-full px-2 py-1 -ml-2 transition-colors"
          >
            <img
              src={otherUser?.avatar || '/assets/default-avatar.svg'}
              alt=""
              className="w-9 h-9 rounded-full object-cover bg-paper-deep ring-1 ring-edge shrink-0"
            />
            <div className="flex-1 min-w-0">
              <p className="font-display text-[18px] leading-tight text-ink truncate">
                {otherUser?.name || otherUser?.username || 'Loading…'}
              </p>
              {otherUser?.username && (
                <p className="font-mono text-[10px] tracking-[0.10em] uppercase text-ink-mute mt-0.5 truncate">@{otherUser.username}</p>
              )}
            </div>
          </button>
        </div>
        <div className="border-b border-edge mx-5" />
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 max-w-2xl mx-auto w-full">
        {messages.length === 0 ? (
          <div className="border border-edge rounded-[14px] px-5 py-10 text-center bg-card mt-4">
            <p className="font-display text-[20px] text-ink leading-tight">Say hi.</p>
            <p className="text-[13px] text-ink-soft mt-2">No messages yet — go ahead.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {messages.map((m, i) => {
              const mine = m.senderId === currentUser?.id
              const prev = messages[i - 1]
              const showTimestamp = !prev || (new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime()) > 5 * 60 * 1000
              return (
                <li key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div className="max-w-[78%]">
                    {showTimestamp && (
                      <p className={`font-mono text-[10px] tracking-[0.10em] uppercase text-ink-mute mb-1 ${mine ? 'text-right' : 'text-left'}`}>
                        {formatTimestamp(m.createdAt)}
                      </p>
                    )}
                    <div
                      className={`px-3.5 py-2.5 rounded-2xl text-[14px] leading-relaxed whitespace-pre-wrap break-words ${
                        mine
                          ? 'bg-ink text-paper rounded-br-md'
                          : 'bg-card border border-edge text-ink rounded-bl-md'
                      }`}
                    >
                      {m.text}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <form
        onSubmit={handleSend}
        className="sticky bottom-0 z-20 bg-paper/95 backdrop-blur-md border-t border-edge px-5 py-3"
      >
        <div className="flex items-center gap-2 max-w-2xl mx-auto">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={`Message ${otherUser?.name?.split(' ')[0] || ''}…`}
            maxLength={1000}
            className="flex-1 h-11 px-4 rounded-full bg-card border border-edge text-[14px] text-ink placeholder:text-ink-mute outline-none focus:border-ink/40"
          />
          <button
            type="submit"
            disabled={!draft.trim() || sending}
            aria-label="Send"
            className="btn-cta h-11 w-11 rounded-full flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <PaperAirplaneIcon className="w-5 h-5" />
          </button>
        </div>
      </form>
    </div>
  )
}

export default MessageThread
