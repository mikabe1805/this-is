import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeftIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { firebaseDataService } from '../services/firebaseDataService'
import { firebaseMessagingService, type DirectMessage } from '../services/firebaseMessagingService'
import { formatChatTime } from '../utils/dateUtils'
import { haptics } from '../utils/haptics'
import type { User } from '../types/index.js'

// A locally-held copy of a message that hasn't been confirmed by the server yet.
type LocalMessage = DirectMessage & { pending?: boolean }

const MessageThread = () => {
  const { threadId = '' } = useParams<{ threadId: string }>()
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  // Server snapshot + optimistic (pending) sends, merged for render.
  const [serverMessages, setServerMessages] = useState<DirectMessage[]>([])
  const [pending, setPending] = useState<LocalMessage[]>([])
  const [otherUser, setOtherUser] = useState<User | null>(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  // How much the iOS soft keyboard overlaps the layout viewport — used to lift
  // the composer above it (dvh doesn't shrink for the keyboard; visualViewport
  // does). 0 on desktop / when closed, so this is a no-op there.
  const [kbInset, setKbInset] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Merge server + pending, de-duped by id (so a confirmed optimistic message
  // collapses onto its server copy) and ordered oldest→newest.
  const messages = useMemo<LocalMessage[]>(() => {
    const seen = new Set<string>()
    const merged: LocalMessage[] = []
    for (const m of [...serverMessages, ...pending]) {
      if (seen.has(m.id)) continue
      seen.add(m.id)
      merged.push(m)
    }
    return merged.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  }, [serverMessages, pending])

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

  // Live-subscribe to messages. Each snapshot also prunes any optimistic temp
  // the server has now confirmed (matched by real id).
  useEffect(() => {
    if (!threadId || !currentUser) return
    const unsub = firebaseMessagingService.subscribeMessages(threadId, rows => {
      setServerMessages(rows)
      setPending(prev => prev.filter(p => !rows.some(r => r.id === p.id)))
    })
    return () => unsub()
  }, [threadId, currentUser])

  // Mark the thread read on open and whenever a new message lands while it's
  // open — clears the unread dot/badge in the inbox in real time.
  useEffect(() => {
    if (!threadId || !currentUser) return
    void firebaseMessagingService.markThreadRead(threadId, currentUser.id)
  }, [threadId, currentUser?.id, serverMessages.length])

  // Track the iOS keyboard via visualViewport so the composer lifts above it
  // instead of being buried at the bottom of the (keyboard-agnostic) dvh shell.
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => {
      const overlap = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
      setKbInset(overlap)
      if (overlap > 0 && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    update()
    return () => { vv.removeEventListener('resize', update); vv.removeEventListener('scroll', update) }
  }, [])

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
    haptics.tap()
    // Optimistic: show the bubble instantly so the input doesn't empty into a
    // void on a slow link. The temp carries its own id; on success we swap in
    // the real id so the subscription can reconcile it (duplicate-safe even if
    // the same text is sent twice).
    const tempId = `tmp-${messages.length}-${text.length}-${Math.round(performance.now())}`
    const temp: LocalMessage = { id: tempId, senderId: currentUser.id, text, createdAt: new Date().toISOString(), pending: true }
    setPending(prev => [...prev, temp])
    try {
      const sent = await firebaseMessagingService.sendMessage(threadId, currentUser.id, text)
      if (!sent) throw new Error('sendMessage returned null')
      haptics.success()
      // Re-key the temp to the real id; dedup/prune then collapses it onto the
      // server copy when the snapshot arrives.
      setPending(prev => prev.map(p => (p.id === tempId ? { ...p, id: sent.id, pending: false } : p)))
    } catch (err) {
      console.error('[message-thread] send failed', err)
      haptics.warn()
      setPending(prev => prev.filter(p => p.id !== tempId))
      setDraft(text)
      window.dispatchEvent(new CustomEvent('this-is:toast', { detail: { message: "Couldn't send. Try again.", tone: 'error' } }))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="relative h-full flex flex-col bg-paper">
      <header className="sticky top-0 z-30 bg-paper/90 backdrop-blur-md">
        <div className="px-5 safe-top pb-3 flex items-center gap-3">
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
              {otherUser ? (
                <p className="font-display text-[18px] leading-tight text-ink truncate">
                  {otherUser.name || otherUser.username}
                </p>
              ) : (
                <span className="skeleton inline-block h-[18px] w-32 rounded-md align-middle" />
              )}
              {otherUser?.username && (
                <p className="font-mono text-[10px] tracking-[0.10em] uppercase text-ink-mute mt-0.5 truncate">@{otherUser.username}</p>
              )}
            </div>
          </button>
        </div>
        <div className="border-b border-edge mx-5" />
      </header>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-5 py-4 max-w-2xl mx-auto w-full"
        style={kbInset > 0 ? { paddingBottom: kbInset } : undefined}
      >
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
                        {formatChatTime(m.createdAt)}
                      </p>
                    )}
                    <div
                      className={`px-3.5 py-2.5 rounded-2xl text-[14px] leading-relaxed whitespace-pre-wrap break-words transition-opacity ${
                        mine
                          ? 'bg-ink text-paper rounded-br-md'
                          : 'bg-card border border-edge text-ink rounded-bl-md'
                      } ${(m as LocalMessage).pending ? 'opacity-60' : 'opacity-100'}`}
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
        className="sticky bottom-0 z-20 bg-paper/95 backdrop-blur-md border-t border-edge px-5 pt-3"
        style={{
          paddingBottom: 'max(env(safe-area-inset-bottom), 0.75rem)',
          transform: kbInset > 0 ? `translateY(-${kbInset}px)` : undefined,
        }}
      >
        <div className="flex items-center gap-2 max-w-2xl mx-auto">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={`Message ${otherUser?.name?.split(' ')[0] || ''}…`}
            maxLength={1000}
            enterKeyHint="send"
            autoComplete="off"
            className="flex-1 h-11 px-4 rounded-full bg-card border border-edge text-[16px] text-ink placeholder:text-ink-mute outline-none focus:border-ink/40"
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
