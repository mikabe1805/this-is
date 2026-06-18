import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { XMarkIcon, MagnifyingGlassIcon, PaperAirplaneIcon, LinkIcon } from '@heroicons/react/24/outline'
import { useAuth } from '../contexts/AuthContext'
import { firebaseDataService } from '../services/firebaseDataService'
import { firebaseMessagingService } from '../services/firebaseMessagingService'
import { useModalDismiss } from '../hooks/useModalDismiss'
import { haptics } from '../utils/haptics'
import type { User } from '../types'

interface SendToFriendModalProps {
  isOpen: boolean
  onClose: () => void
  /** What's being shared — used in the seeded message text. */
  shareTitle: string
  /** In-app path, e.g. /place/abc or /list/xyz. */
  shareUrl: string
}

/**
 * Send a place/list to a friend as a DM. Picks from the people you follow +
 * your friends, opens (or reuses) the 1:1 thread, and seeds it with a message
 * linking the place/list. This is the direct, intentional sharing path the
 * product vision calls for — built on the now-working messaging layer.
 */
export default function SendToFriendModal({ isOpen, onClose, shareTitle, shareUrl }: SendToFriendModalProps) {
  const { currentUser } = useAuth()
  const [people, setPeople] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [sendingId, setSendingId] = useState<string | null>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  useModalDismiss(isOpen, onClose)

  useEffect(() => {
    if (!isOpen || !currentUser) return
    let cancelled = false
    setLoading(true)
    setQ('')
    Promise.all([
      firebaseDataService.getUserFollowing(currentUser.id).catch(() => [] as User[]),
      firebaseDataService.getUserFriends(currentUser.id).catch(() => [] as User[]),
    ]).then(([following, friends]) => {
      if (cancelled) return
      const byId = new Map<string, User>()
      for (const u of [...friends, ...following]) if (u?.id && u.id !== currentUser.id) byId.set(u.id, u)
      setPeople(Array.from(byId.values()))
    }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [isOpen, currentUser])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return people
    return people.filter(u => (u.name || '').toLowerCase().includes(s) || (u.username || '').toLowerCase().includes(s))
  }, [people, q])

  const handleSend = async (friend: User) => {
    if (!currentUser || sendingId) return
    setSendingId(friend.id)
    try {
      const threadId = await firebaseMessagingService.getOrCreateThread(currentUser.id, friend.id)
      if (!threadId) throw new Error('no thread')
      const origin = typeof window !== 'undefined' ? window.location.origin : ''
      // shareUrl may be an absolute href (from window.location.href) or an
      // in-app path (/place/abc) — handle both without doubling the origin.
      const link = /^https?:\/\//i.test(shareUrl) ? shareUrl : `${origin}${shareUrl}`
      const text = `Check out ${shareTitle} — ${link}`
      const sent = await firebaseMessagingService.sendMessage(threadId, currentUser.id, text)
      if (!sent) throw new Error('send failed')
      haptics.success()
      onClose()
      const first = (friend.name || friend.username || 'friend').split(' ')[0]
      window.dispatchEvent(new CustomEvent('this-is:toast', {
        detail: { message: `Sent to ${first}`, action: { label: 'Open', href: `/messages/${threadId}` } },
      }))
    } catch {
      haptics.warn()
      window.dispatchEvent(new CustomEvent('this-is:toast', { detail: { message: "Couldn't send. Try again.", tone: 'error' } }))
    } finally {
      setSendingId(null)
    }
  }

  const resolvedLink = useMemo(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    return /^https?:\/\//i.test(shareUrl) ? shareUrl : `${origin}${shareUrl}`
  }, [shareUrl])

  const copyLink = async () => {
    haptics.tap()
    try {
      await navigator.clipboard.writeText(resolvedLink)
      onClose()
      window.dispatchEvent(new CustomEvent('this-is:toast', { detail: { message: 'Link copied' } }))
    } catch {
      window.dispatchEvent(new CustomEvent('this-is:toast', { detail: { message: "Couldn't copy. Try again.", tone: 'error' } }))
    }
  }

  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-[10001] flex items-end sm:items-center justify-center bg-[#1A1815]/55 backdrop-blur-sm" onClick={onClose}>
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal
        className="modal-paper w-full sm:max-w-md max-h-[80vh] rounded-t-[24px] sm:rounded-[24px] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-edge">
          <div className="min-w-0">
            <p className="label-eyebrow text-ink-mute">Send to a friend</p>
            <p className="font-display text-[18px] text-ink leading-tight truncate">{shareTitle}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="h-9 w-9 rounded-full hover:bg-paper-deep flex items-center justify-center shrink-0">
            <XMarkIcon className="w-5 h-5 text-ink" />
          </button>
        </div>

        <div className="px-5 py-3 border-b border-edge">
          <div className="flex items-center gap-2 h-11 px-4 rounded-full bg-card border border-edge focus-within:border-ink/40 transition-colors">
            <MagnifyingGlassIcon className="w-4 h-4 text-ink-mute shrink-0" />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search people"
              aria-label="Search people"
              className="flex-1 bg-transparent outline-none text-[14px] text-ink placeholder:text-ink-mute"
            />
          </div>
        </div>

        {/* Copy link — the non-DM share option, so this doubles as the app's
            share sheet (pick a friend, or grab a link). */}
        <button
          type="button"
          onClick={copyLink}
          className="mx-3 mt-3 mb-1 flex items-center gap-3 px-3 py-2.5 rounded-xl border border-edge hover:bg-paper-deep transition-colors text-left press"
        >
          <span className="w-10 h-10 rounded-full bg-accent-soft flex items-center justify-center shrink-0">
            <LinkIcon className="w-5 h-5" style={{ color: 'var(--accent-deep)' }} />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-[15px] text-ink font-medium">Copy link</span>
            <span className="block text-[12px] text-ink-mute truncate">Share anywhere</span>
          </span>
        </button>

        <div className="flex-1 overflow-y-auto px-2 py-2">
          {loading ? (
            <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-ink-mute text-center py-10">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="text-[13px] text-ink-soft text-center py-10 px-6">
              {people.length === 0 ? 'Follow people to share places with them.' : 'No matches.'}
            </p>
          ) : (
            <ul>
              {filtered.map(u => (
                <li key={u.id}>
                  <button
                    type="button"
                    disabled={!!sendingId}
                    onClick={() => handleSend(u)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-paper-deep transition-colors text-left disabled:opacity-50 press"
                  >
                    <span className="w-10 h-10 rounded-full overflow-hidden bg-paper-deep ring-1 ring-edge shrink-0">
                      {u.avatar
                        ? <img src={u.avatar} alt="" className="w-full h-full object-cover" />
                        : <span className="w-full h-full flex items-center justify-center font-mono text-[10px] text-ink-soft">{(u.name || u.username || '?').slice(0, 2).toUpperCase()}</span>}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[15px] text-ink font-medium truncate">{u.name || u.username}</span>
                      {u.username && <span className="block text-[12px] text-ink-mute truncate">@{u.username}</span>}
                    </span>
                    {sendingId === u.id
                      ? <span className="label-eyebrow text-ink-mute shrink-0">Sending…</span>
                      : <PaperAirplaneIcon className="w-5 h-5 text-accent shrink-0" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
