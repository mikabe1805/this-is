import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowLeftIcon,
  ArrowsPointingOutIcon,
  BookmarkIcon,
  HeartIcon,
  MapPinIcon,
  ShareIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import type { Hub, Place, Post } from '../types'
import { firebaseDataService } from '../services/firebaseDataService'
import { rankingService } from '../services/rankingService'
import { haptics } from '../utils/haptics'
import { useAuth } from '../contexts/AuthContext'
import { useModalDismiss } from '../hooks/useModalDismiss'
import { useSwipeToDismiss } from '../hooks/useSwipeToDismiss'
import HubImage from './HubImage'

type LoosePlace = Place & {
  primaryType?: string
  types?: string[]
  photos?: { name: string }[]
  mainImage?: string
  category?: string
  posts?: Post[]
  description?: string
  savedCount?: number
}

interface HubModalProps {
  isOpen: boolean
  onClose: () => void
  hub: Hub
  showBackButton?: boolean
  onBack?: () => void
  onOpenFullScreen?: () => void
  onSave?: () => void
  onShare?: () => void
  /** Start a post about this place. */
  onAddPost?: () => void
}

/**
 * Inline hub view rendered inside the modal stack — used when the user
 * clicks a place from inside ListModal / ProfileModal so they don't get
 * bounced out to the /place/:id route. The full page is always one tap
 * away via the expand button. This keeps the breadcrumb back to whatever
 * modal was open before.
 */
const HubModal = ({
  isOpen,
  onClose,
  hub,
  showBackButton,
  onBack,
  onOpenFullScreen,
  onSave,
  onShare,
  onAddPost,
}: HubModalProps) => {
  const { currentUser } = useAuth()
  const [place, setPlace] = useState<LoosePlace | null>(hub as LoosePlace)
  const [loading, setLoading] = useState(false)
  const [myScore, setMyScore] = useState<number | null>(null)
  const [friendSavers, setFriendSavers] = useState<string[]>([])

  // "Opening a place teaches your taste" (×0.6) — restored for the modal flow
  // (taps open this modal now, not the /place route that used to record it),
  // and dwell-gated to ~1.5s so a quick peek / mis-tap doesn't write a signal.
  const placeForTasteRef = useRef<LoosePlace | null>(place)
  placeForTasteRef.current = place
  useEffect(() => {
    if (!isOpen || !currentUser) return
    const t = setTimeout(() => {
      const p = placeForTasteRef.current
      if (p) firebaseDataService.recordTasteFromPlace(currentUser.id, p as { primaryType?: string | null; types?: string[]; category?: string; tags?: string[]; name?: string; id?: string }, 0.6)
    }, 1500)
    return () => clearTimeout(t)
  }, [isOpen, currentUser?.id])

  // Personal score (Beli loop) + trusted-taste social proof for the header.
  useEffect(() => {
    if (!currentUser || !place?.id) { setMyScore(null); setFriendSavers([]); return }
    let cancelled = false
    const pid = place.id
    rankingService.getScores(currentUser.id).then(s => { if (!cancelled) setMyScore(typeof s[pid] === 'number' ? s[pid] : null) }).catch(() => {})
    firebaseDataService.getFriendSavedPlaceMap(currentUser.id).then(m => { if (!cancelled) setFriendSavers(m.get(pid) || []) }).catch(() => {})
    const onRanked = (e: Event) => {
      const d = (e as CustomEvent).detail as { placeId?: string; score?: number } | undefined
      if (d?.placeId === pid && typeof d.score === 'number') setMyScore(d.score)
    }
    window.addEventListener('this-is:ranked', onRanked as EventListener)
    return () => { cancelled = true; window.removeEventListener('this-is:ranked', onRanked as EventListener) }
  }, [currentUser?.id, place?.id])

  const sheetRef = useRef<HTMLDivElement>(null)
  useModalDismiss(isOpen, onClose)
  useSwipeToDismiss({ ref: sheetRef, onDismiss: onClose, enabled: isOpen })

  useEffect(() => {
    if (!isOpen || !hub?.id) return
    let cancelled = false
    void (async () => {
      setLoading(true)
      try {
        const fresh = (await firebaseDataService.getPlace(hub.id)) as unknown as LoosePlace | null
        if (!cancelled && fresh) setPlace(fresh)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [isOpen, hub?.id])

  if (!isOpen) return null

  const meta = [place?.primaryType?.replace(/_/g, ' '), (place?.address || '').split(',')[0]?.trim()].filter(Boolean).join(' · ')

  const modalContent = (
    <div
      className="fixed inset-0 z-[10003] flex items-end sm:items-center justify-center bg-[#1A1815]/55 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal={true}
        className="modal-paper w-full sm:max-w-md max-h-[92vh] rounded-t-3xl sm:rounded-3xl border border-edge overflow-hidden flex flex-col"
        style={{ boxShadow: '0 18px 60px rgba(46, 28, 13, 0.22), 0 4px 14px rgba(46, 28, 13, 0.08)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div data-drag-handle className="sm:hidden flex justify-center py-3 shrink-0 touch-none" aria-hidden>
          <span className="w-10 h-1 rounded-full bg-ink-faint" />
        </div>

        {/* Cover header — image priority: user upload → Google photo → riso poster */}
        <div data-drag-handle className="relative h-44 bg-paper-deep overflow-hidden">
          <HubImage
            userImage={place?.mainImage || place?.coverImage}
            photos={place?.photos}
            primaryType={place?.primaryType}
            types={place?.types}
            alt={place?.name || ''}
            aspect=""
            className="absolute inset-0 w-full h-full"
            loadStrategy="load"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#1A1815]/55 via-[#1A1815]/15 to-transparent" />

          <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-10">
            {showBackButton ? (
              <button
                type="button"
                onClick={onBack}
                aria-label="Back"
                className="h-9 w-9 rounded-full bg-white/20 backdrop-blur-md hover:bg-white/30 flex items-center justify-center"
              >
                <ArrowLeftIcon className="w-5 h-5 text-white" />
              </button>
            ) : <div />}
            <div className="flex items-center gap-2">
              {onOpenFullScreen && (
                <button
                  type="button"
                  onClick={onOpenFullScreen}
                  aria-label="Open full place"
                  className="h-9 w-9 rounded-full bg-white/20 backdrop-blur-md hover:bg-white/30 flex items-center justify-center"
                >
                  <ArrowsPointingOutIcon className="w-5 h-5 text-white" />
                </button>
              )}
              {onShare && (
                <button
                  type="button"
                  onClick={onShare}
                  aria-label="Share"
                  className="h-9 w-9 rounded-full bg-white/20 backdrop-blur-md hover:bg-white/30 flex items-center justify-center"
                >
                  <ShareIcon className="w-5 h-5 text-white" />
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="h-9 w-9 rounded-full bg-white/20 backdrop-blur-md hover:bg-white/30 flex items-center justify-center"
              >
                <XMarkIcon className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>

          <div className="absolute bottom-0 left-0 right-0 p-4 z-10">
            <h1 className="font-display text-[26px] leading-tight text-white drop-shadow-md">
              {place?.name || 'Place'}
            </h1>
            {meta && (
              <p className="font-mono text-[10px] tracking-[0.12em] uppercase text-white/85 mt-1">{meta}</p>
            )}
          </div>
        </div>

        {/* Body — light scroll. Real surface for full editing/posting is the
            /place/:id route; the modal is intentionally compact. */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 relative z-10">
          {(myScore !== null || friendSavers.length > 0) && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              {myScore !== null && (
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="inline-flex items-center justify-center h-8 min-w-8 px-2 rounded-full bg-accent-soft border border-accent/30 font-display text-[15px]"
                    style={{ color: 'var(--accent-deep)' }}
                  >
                    {myScore.toFixed(1)}
                  </span>
                  <span className="label-eyebrow text-ink-mute">Your score</span>
                </span>
              )}
              {friendSavers.length > 0 && (
                <span className="text-[12px] text-ink-soft inline-flex items-center gap-1.5">
                  <span className="accent-bead accent-bead-sm shrink-0" aria-hidden />
                  Saved by <span className="text-ink font-medium">{friendSavers[0]}</span>{friendSavers.length > 1 && ` +${friendSavers.length - 1} you follow`}
                </span>
              )}
            </div>
          )}
          {place?.description && (
            <p className="text-[14px] text-ink-soft leading-relaxed whitespace-pre-wrap">
              {place.description}
            </p>
          )}

          {(place?.posts?.length || 0) > 0 && (
            <section>
              <div className="flex items-center justify-between mb-2">
                <p className="label-eyebrow text-ink-mute">Recent posts</p>
                {onAddPost && (
                  <button type="button" onClick={() => { haptics.tap(); onAddPost() }} className="label-eyebrow text-accent hover:underline press">
                    + Add
                  </button>
                )}
              </div>
              <ul className="divide-y divide-edge border-y border-edge">
                {(place?.posts || []).slice(0, 4).map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => { if (onOpenFullScreen) { haptics.select(); onOpenFullScreen() } }}
                      disabled={!onOpenFullScreen}
                      className="w-full text-left py-3 -mx-1 px-1 rounded-lg hover:bg-paper-deep transition-colors press"
                    >
                      <p className="text-[14px] text-ink leading-snug line-clamp-3">{p.description}</p>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {!place?.description && !(place?.posts?.length || 0) && !loading && (
            <div className="py-8 text-center">
              <p className="font-display text-[20px] text-ink leading-tight">Quiet here.</p>
              <p className="text-[12px] text-ink-soft mt-1">Be the first to post about this place.</p>
              {onAddPost && (
                <button type="button" onClick={() => { haptics.tap(); onAddPost() }} className="btn-secondary press h-9 px-4 mt-4 label-eyebrow inline-flex items-center">
                  Write a post
                </button>
              )}
            </div>
          )}

          {/* Pick a cover photo — surfaces whenever the place has no
              user-set cover. Lets the first user (or any user) claim a
              photo for the place after the fact, instead of relying on
              the one-shot prompt at save time. */}
          {!place?.mainImage && !loading && place && (
            <button
              type="button"
              onClick={() => {
                try {
                  // Only forward googlePlaceId when it actually looks like
                  // one — passing a Firestore id under that key would just
                  // cause getDetails to fail, then the picker's searchText
                  // fallback would still recover photos by name+address.
                  const stored = (place as { googlePlaceId?: string }).googlePlaceId
                  const looksLikeGoogleId = !!stored && /^ChIJ/.test(stored)
                  window.dispatchEvent(new CustomEvent('openCoverPicker', {
                    detail: {
                      hubId: place.id,
                      googlePlaceId: looksLikeGoogleId ? stored : undefined,
                      hubName: place.name,
                      hubAddress: place.address,
                    }
                  }))
                } catch (e) { console.warn('[hub-modal] open cover picker failed', e) }
              }}
              className="w-full flex items-center justify-center gap-2 h-11 rounded-full bg-card border border-dashed border-edge text-[13px] font-medium text-ink-soft hover:text-ink hover:border-ink/40 transition-colors"
            >
              <span className="font-mono text-[10px] tracking-[0.10em] uppercase">Pick a cover photo</span>
            </button>
          )}
        </div>

        {/* Sticky action row */}
        {currentUser && (
          <div className="px-5 py-3 border-t border-edge flex gap-2 relative z-10">
            <button
              type="button"
              onClick={() => { haptics.tap(); onSave?.() }}
              className="btn-cta flex-1 h-11 inline-flex items-center justify-center gap-2 text-[14px] font-semibold"
            >
              <BookmarkIcon className="w-4 h-4" />
              Save
            </button>
            <button
              type="button"
              onClick={() => { haptics.tap(); onOpenFullScreen?.() }}
              className="btn-secondary flex-1 h-11 inline-flex items-center justify-center gap-2 text-[14px] font-medium"
            >
              <MapPinIcon className="w-4 h-4" />
              Full page
            </button>
          </div>
        )}
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}

export default HubModal
