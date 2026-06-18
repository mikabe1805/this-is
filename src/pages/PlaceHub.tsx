import {
  ArrowLeftIcon,
  BookmarkIcon,
  ChatBubbleLeftIcon,
  HeartIcon,
  MapPinIcon,
  PlusIcon,
  ShareIcon,
} from '@heroicons/react/24/outline'
import { BookmarkIcon as BookmarkIconSolid, HeartIcon as HeartIconSolid } from '@heroicons/react/24/solid'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import HubImage from '../components/HubImage'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import CommentsModal from '../components/CommentsModal'
import CreatePost from '../components/CreatePost'
import SaveModal from '../components/SaveModal'
import ShareModal from '../components/ShareModal'
import { pickTheme } from '../components/ui/categoryTheme'
import { useAuth } from '../contexts/AuthContext.tsx'
import { firebaseDataService } from '../services/firebaseDataService.js'
import { rankingService, sentimentBucket } from '../services/rankingService'
import type { List, Place, Post } from '../types/index.js'
import { formatTimestamp } from '../utils/dateUtils'
import { haptics } from '../utils/haptics'

type LoosePlace = Place & {
  primaryType?: string
  types?: string[]
  photos?: { name: string }[]
  mainImage?: string
  category?: string
  posts?: Post[]
  description?: string
  savedCount?: number
  coordinates?: { lat?: number; lng?: number }
}

const prettyType = (t?: string) => (t ? t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : null)

const PlaceHub = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { currentUser: authUser } = useAuth()

  const [place, setPlace] = useState<LoosePlace | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [userLists, setUserLists] = useState<List[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Browser-tab title + meta description while this page is mounted.
  useDocumentTitle(
    place?.name,
    place ? `${place.name}${place.address ? ` · ${place.address.split(',')[0]}` : ''}${place.description ? ` — ${place.description.slice(0, 120)}` : ''}` : null,
  )

  const [showSaveModal, setShowSaveModal] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [showCreatePost, setShowCreatePost] = useState(false)
  const [showCommentsModal, setShowCommentsModal] = useState(false)
  const [activePost, setActivePost] = useState<Post | null>(null)

  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set())
  const [savedPosts, setSavedPosts] = useState<Set<string>>(new Set())
  const [tab, setTab] = useState<'posts' | 'about'>('posts')
  const [myScore, setMyScore] = useState<number | null>(null)
  const [friendSavers, setFriendSavers] = useState<string[]>([])

  // People the viewer FOLLOWS who've saved this place — trusted-taste social
  // proof. Reuses the cached friend-saved map (no per-place query).
  useEffect(() => {
    if (!authUser || !place?.id) { setFriendSavers([]); return }
    let cancelled = false
    firebaseDataService.getFriendSavedPlaceMap(authUser.id)
      .then(m => { if (!cancelled) setFriendSavers(m.get(place.id) || []) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [authUser?.id, place?.id])

  // The viewer's personal 0–10 score for this place (from the Beli-loop
  // ranking), shown as a badge and kept live when they (re)rank it.
  useEffect(() => {
    if (!authUser || !place?.id) { setMyScore(null); return }
    let cancelled = false
    rankingService.getScores(authUser.id)
      .then(s => { if (!cancelled) setMyScore(typeof s[place.id] === 'number' ? s[place.id] : null) })
      .catch(() => {})
    const onRanked = (e: Event) => {
      const d = (e as CustomEvent).detail as { placeId?: string; score?: number } | undefined
      if (d?.placeId === place.id && typeof d.score === 'number') setMyScore(d.score)
    }
    window.addEventListener('this-is:ranked', onRanked as EventListener)
    return () => { cancelled = true; window.removeEventListener('this-is:ranked', onRanked as EventListener) }
  }, [authUser?.id, place?.id])

  // Privacy filter for embedded `place.posts` — public always, friends only
  // to author + mutual-follow friends, private only to author. Without this,
  // private posts denormalized onto the place doc would render to anyone
  // who opens the hub.
  const filterPostsByPrivacy = async (posts: Post[]): Promise<Post[]> => {
    if (!authUser) return posts.filter(p => {
      const privacy = (p as { privacy?: string }).privacy
      return !privacy || privacy === 'public'
    })
    let friendIds = new Set<string>()
    try {
      const fr = await firebaseDataService.getUserFriends(authUser.id)
      friendIds = new Set(fr.map(u => u.id))
    } catch (e) {
      console.warn('[place-hub] friend lookup failed', e)
    }
    return posts.filter(p => {
      const privacy = (p as { privacy?: string }).privacy
      if (!privacy || privacy === 'public') return true
      if (privacy === 'friends') return p.userId === authUser.id || friendIds.has(p.userId)
      return p.userId === authUser.id
    })
  }

  const reloadPlace = async () => {
    if (!id) return
    try {
      const p = (await firebaseDataService.getPlace(id)) as unknown as LoosePlace | null
      if (!p) return
      setPlace(p)
      setPosts(await filterPostsByPrivacy(p.posts || []))
    } catch (e) {
      console.error('[place-hub] reload failed', e)
    }
  }

  useEffect(() => {
    if (!id) {
      setError('No place ID provided')
      setLoading(false)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        setLoading(true)
        setError(null)
        const p = (await firebaseDataService.getPlace(id)) as unknown as LoosePlace | null
        if (cancelled) return
        if (!p) {
          setError('Place not found')
          setLoading(false)
          return
        }
        setPlace(p)
        // Opening a place is a light interest signal — feeds the taste model
        // so even browsing (not just saving) teaches the app what you're drawn to.
        if (authUser) firebaseDataService.recordTasteFromPlace(authUser.id, p as { primaryType?: string|null; types?: string[]; category?: string; tags?: string[]; name?: string; id?: string }, 0.6)
        const visiblePosts = await filterPostsByPrivacy(p.posts || [])
        if (cancelled) return
        setPosts(visiblePosts)
      } catch (e) {
        console.error('[place-hub] load failed', e)
        if (!cancelled) setError('Failed to load place')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [id])

  // Refresh posts when a new post is created elsewhere for this place,
  // or when a save toggles savedCount.
  useEffect(() => {
    if (!id) return
    const onPosted = (e: Event) => {
      const detail = (e as CustomEvent).detail as { placeId?: string } | undefined
      if (!detail?.placeId || detail.placeId === id) void reloadPlace()
    }
    const onSaved = (e: Event) => {
      const detail = (e as CustomEvent).detail as { placeId?: string } | undefined
      if (detail?.placeId === id) void reloadPlace()
    }
    const onHubUpdated = (e: Event) => {
      const detail = (e as CustomEvent).detail as { hubId?: string } | undefined
      if (detail?.hubId === id) void reloadPlace()
    }
    window.addEventListener('this-is:posted', onPosted)
    window.addEventListener('this-is:saved', onSaved)
    window.addEventListener('this-is:hubUpdated', onHubUpdated)
    return () => {
      window.removeEventListener('this-is:posted', onPosted)
      window.removeEventListener('this-is:saved', onSaved)
      window.removeEventListener('this-is:hubUpdated', onHubUpdated)
    }
  }, [id])

  useEffect(() => {
    if (!authUser) return
    firebaseDataService.getUserLists(authUser.id).then(setUserLists).catch(() => setUserLists([]))
  }, [authUser])

  const meta = useMemo(() => {
    if (!place) return ''
    const parts = [prettyType(place.primaryType || place.types?.[0]), place.address?.split(',')[0]?.trim()]
      .filter(Boolean)
    return parts.join(' · ')
  }, [place])

  const theme = useMemo(() => pickTheme(place?.primaryType, place?.types), [place?.primaryType, place?.types])

  const handleSaveAction = async (status: 'loved' | 'tried' | 'want', rating?: 'liked' | 'neutral' | 'disliked', listIds?: string[], note?: string) => {
    if (!place || !authUser) return
    try {
      const ids = Array.isArray(listIds) ? listIds : []
      for (const lid of ids) {
        await firebaseDataService.savePlaceToList(place.id, lid, authUser.id, note, undefined, status, rating)
      }
      // Idempotent — bumps savedCount once per user-place pair regardless of list count.
      const incremented = await firebaseDataService.recordUserSave(place.id, authUser.id)
      if (incremented) {
        setPlace(p => (p ? { ...p, savedCount: (p.savedCount || 0) + 1 } : p))
      }
      try {
        window.dispatchEvent(new CustomEvent('this-is:saved', {
          detail: { placeId: place.id, status }
        }))
        // Experienced save → offer the pairwise ranking ("Beli loop"); the
        // toast is non-blocking and coexists with the cover picker below.
        const bucket = sentimentBucket(status, rating)
        window.dispatchEvent(new CustomEvent('this-is:toast', {
          detail: bucket
            ? { message: 'Saved', action: { label: 'Rank it', onClick: () => window.dispatchEvent(new CustomEvent('this-is:rank-place', { detail: { placeId: place.id, name: place.name, bucket } })) } }
            : { message: 'Saved' },
        }))
      } catch (e) { console.warn('[place-hub] saved-event dispatch failed', e) }
      // Offer to pick a cover photo if this place doesn't have one yet.
      // The global listener checks place.mainImage and skips silently when
      // a cover already exists, so this is safe to fire on every save.
      try {
        window.dispatchEvent(new CustomEvent('openCoverPicker', {
          detail: {
            hubId: place.id,
            googlePlaceId: (place as { googlePlaceId?: string }).googlePlaceId,
            hubName: place.name,
            hubAddress: place.address,
          },
        }))
      } catch (e) { console.warn('[place-hub] cover-picker dispatch failed', e) }
    } catch (e) {
      console.error('[place-hub] save failed', e)
    } finally {
      setShowSaveModal(false)
    }
  }

  const handleCreateList = async (
    data: { name: string; description: string; privacy: 'public' | 'private' | 'friends'; tags?: string[]; coverImage?: string },
    saveContext?: { status: 'loved' | 'tried' | 'want'; rating?: 'liked' | 'neutral' | 'disliked'; note?: string },
  ) => {
    if (!place || !authUser) return
    const newId = await firebaseDataService.createList({ ...data, tags: data.tags || [], userId: authUser.id })
    if (newId) {
      const status = saveContext?.status || 'loved'
      await firebaseDataService.savePlaceToList(place.id, newId, authUser.id, saveContext?.note, undefined, status, saveContext?.rating)
      const lists = await firebaseDataService.getUserLists(authUser.id)
      setUserLists(lists)
    }
    setShowSaveModal(false)
  }

  // Open the comments modal, fetching the real subcollection comments. The
  // posts here come from the place-doc's embedded array, whose `comments` is
  // usually stale/empty — so without this fetch the modal opened blank even
  // when the post had comments.
  const openComments = async (p: Post) => {
    haptics.tap()
    setActivePost(p)
    setShowCommentsModal(true)
    try {
      const fetched = await firebaseDataService.getCommentsForPost(p.id)
      setActivePost(cur => (cur && cur.id === p.id ? { ...cur, comments: fetched } : cur))
    } catch (e) {
      console.warn('[placehub] load comments failed', e)
    }
  }

  const handleLikePost = async (postId: string) => {
    const wasLiked = likedPosts.has(postId)
    haptics.tap()
    setLikedPosts(prev => {
      const next = new Set(prev)
      if (next.has(postId)) next.delete(postId)
      else next.add(postId)
      return next
    })
    // Liking a post about this place is a positive taste signal (not on un-like).
    if (!wasLiked && authUser && place) {
      firebaseDataService.recordTasteFromPlace(authUser.id, place as { primaryType?: string|null; types?: string[]; category?: string; tags?: string[]; name?: string; id?: string }, 1)
    }
    try {
      if (authUser) await firebaseDataService.likePost(postId, authUser.id)
    } catch {
      // ignore optimistic-only failure
    }
  }

  if (loading) {
    return (
      <div className="min-h-full">
        <div className="aspect-[4/3] bg-stone-100 animate-pulse" />
        <div className="px-5 pt-5 space-y-3">
          <div className="h-7 bg-stone-100 rounded animate-pulse w-3/4" />
          <div className="h-4 bg-stone-100 rounded animate-pulse w-1/2" />
          <div className="h-12 bg-stone-100 rounded-xl animate-pulse w-full mt-6" />
        </div>
      </div>
    )
  }

  if (error || !place) {
    return (
      <div className="min-h-full px-6 py-20 text-center">
        <p className="text-[15px] text-stone-700 mb-1">{error || 'Place not found'}</p>
        <button onClick={() => navigate(-1)} className="mt-4 text-[14px] font-medium text-stone-600 underline">
          Go back
        </button>
      </div>
    )
  }

  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(place.address || place.name)}`

  return (
    <div className="min-h-full bg-paper">
      <div className="relative aspect-[4/5] sm:aspect-[4/3] overflow-hidden">
        <HubImage
          photos={place.photos}
          userImage={(place as any).mainImage || (place as any).hubImage || (place as any).coverImage}
          primaryType={place.primaryType}
          types={place.types}
          alt={place.name}
          load
          aspect="aspect-[4/5] sm:aspect-[4/3]"
          className="w-full h-full"
        />
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/40 to-transparent pointer-events-none" />
        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 h-10 w-10 rounded-full bg-paper/95 backdrop-blur-sm flex items-center justify-center"
          aria-label="Back"
        >
          <ArrowLeftIcon className="w-5 h-5 text-ink" />
        </button>
        <button
          onClick={() => setShowShareModal(true)}
          className="absolute top-4 right-4 h-10 w-10 rounded-full bg-paper/95 backdrop-blur-sm flex items-center justify-center"
          aria-label="Share"
        >
          <ShareIcon className="w-5 h-5 text-ink" />
        </button>
      </div>

      <div className="relative px-5 pt-7 -mt-8 z-10">
        <div className="bg-paper rounded-t-[24px] -mx-5 px-5 pt-7">
          <p className="label-eyebrow flex items-center gap-1.5 mb-3" style={{ color: 'var(--accent-deep)' }}>
            <span className="accent-bead-sm accent-bead" />
            {theme.label}
          </p>
          <h1 className="font-display text-[44px] leading-[0.95] text-ink">
            {place.name}
          </h1>
          {myScore !== null && (
            <div className="mt-3 inline-flex items-center gap-2">
              <span
                className="inline-flex items-center justify-center h-9 min-w-9 px-2.5 rounded-full bg-accent-soft border border-accent/30 font-display text-[18px]"
                style={{ color: 'var(--accent-deep)' }}
              >
                {myScore.toFixed(1)}
              </span>
              <span className="label-eyebrow text-ink-mute">Your score</span>
            </div>
          )}
          {meta && (
            <p className="font-mono text-[11px] tracking-[0.14em] uppercase text-ink-mute mt-3 flex items-center gap-1.5">
              <MapPinIcon className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{meta}</span>
            </p>
          )}
          {(place.savedCount || posts.length) ? (
            <div className="flex items-center gap-3 mt-4">
              {place.savedCount ? (
                <span className="label-eyebrow text-ink-soft">
                  <span className="text-ink font-semibold">{place.savedCount}</span> {place.savedCount === 1 ? 'save' : 'saves'}
                </span>
              ) : null}
              {place.savedCount && posts.length ? (
                <span className="text-ink-faint">·</span>
              ) : null}
              {posts.length ? (
                <span className="label-eyebrow text-ink-soft">
                  <span className="text-ink font-semibold">{posts.length}</span> {posts.length === 1 ? 'post' : 'posts'}
                </span>
              ) : null}
            </div>
          ) : null}

          {/* Trusted-taste social proof — people you follow who saved this. */}
          {friendSavers.length > 0 && (
            <p className="mt-3 text-[13px] text-ink-soft flex items-center gap-1.5">
              <span className="accent-bead accent-bead-sm shrink-0" aria-hidden />
              <span>
                Saved by <span className="text-ink font-medium">{friendSavers[0]}</span>
                {friendSavers.length > 1 && ` + ${friendSavers.length - 1} more you follow`}
              </span>
            </p>
          )}

          <div className="mt-6 flex gap-2">
            <div className="relative flex-1">
              <span
                aria-hidden
                className="absolute pointer-events-none rounded-full"
                style={{
                  inset: -8,
                  background: 'radial-gradient(60% 100% at 28% 30%, rgba(240, 208, 138, 0.55) 0%, rgba(198, 139, 59, 0.30) 45%, transparent 70%)',
                  filter: 'blur(6px)',
                  zIndex: 0,
                }}
              />
              <button
                onClick={() => setShowSaveModal(true)}
                className="btn-cta relative w-full h-12 text-[14px] font-semibold flex items-center justify-center gap-2 z-10"
              >
                <BookmarkIcon className="w-[18px] h-[18px]" />
                Save
              </button>
            </div>
            <button
              onClick={() => setShowCreatePost(true)}
              className="btn-secondary flex-1 h-12 text-[14px] font-medium flex items-center justify-center gap-2"
            >
              <PlusIcon className="w-[18px] h-[18px]" />
              Post
            </button>
            <a
              href={directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary h-12 px-5 font-medium text-[14px] flex items-center justify-center gap-2"
              aria-label="Directions"
            >
              <MapPinIcon className="w-[18px] h-[18px]" />
            </a>
          </div>

          <div className="mt-8 border-b border-edge flex gap-6">
            {(['posts', 'about'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`pb-3 label-eyebrow transition-colors ${
                  tab === t
                    ? 'text-ink border-b-2 border-ink -mb-px'
                    : 'text-ink-mute hover:text-ink-soft'
                }`}
              >
                {t === 'posts' ? `Posts${posts.length ? ` · ${posts.length}` : ''}` : 'About'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="px-5 pt-6 pb-14">
        {tab === 'about' ? (
          <div className="space-y-6">
            {place.description && (
              <p className="font-display-italic text-[18px] text-ink leading-snug max-w-prose">
                {place.description}
              </p>
            )}
            {place.address && (
              <div>
                <div className="label-eyebrow text-ink-mute mb-1.5">Address</div>
                <p className="text-[14px] text-ink-soft">{place.address}</p>
              </div>
            )}
            {Array.isArray(place.tags) && place.tags.length > 0 && (
              <div>
                <div className="label-eyebrow text-ink-mute mb-2.5">Tags</div>
                <div className="flex flex-wrap gap-1.5">
                  {place.tags.slice(0, 12).map(t => (
                    <span key={t} className="px-3 h-7 rounded-full bg-card border border-edge font-mono text-[11px] tracking-wide text-ink-soft inline-flex items-center">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : posts.length === 0 ? (
          <div className="border border-edge rounded-[14px] px-5 py-12 text-center bg-card">
            <p className="font-display text-[26px] text-ink leading-tight">No posts yet.</p>
            <p className="text-[13px] text-ink-soft mt-2 max-w-xs mx-auto">Be the first to share what you thought of this place.</p>
            <button
              onClick={() => setShowCreatePost(true)}
              className="btn-cta mt-5 inline-flex items-center gap-1.5 px-5 h-10 label-eyebrow"
            >
              <PlusIcon className="w-4 h-4" /> Write a post
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-edge border-y border-edge">
            {posts.map(p => {
              const liked = likedPosts.has(p.id)
              const saved = savedPosts.has(p.id)
              // Optimistic count = server likes, adjusted by the difference
              // between my current toggle state and whether the server already
              // counts my like. The old formula only ever added (never removed
              // on un-like) and flickered once likedBy refreshed.
              const alreadyLikedByMe = (p.likedBy || []).includes(authUser?.id || '')
              const likeCount = Math.max(0, (p.likes || 0) + (liked ? 1 : 0) - (alreadyLikedByMe ? 1 : 0))
              return (
                <li key={p.id} className="py-5">
                  <div className="flex items-center gap-2.5">
                    {p.userAvatar ? (
                      <img src={p.userAvatar} alt={p.username || 'user'} className="w-9 h-9 rounded-full object-cover" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-paper-deep flex items-center justify-center font-mono text-[10px] tracking-wider text-ink-soft ring-1 ring-edge">
                        {(p.username || '?').slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-medium text-ink truncate leading-tight">{p.username || 'Anonymous'}</p>
                      <p className="font-mono text-[10px] tracking-[0.12em] uppercase text-ink-mute mt-0.5">{formatTimestamp(p.createdAt)}</p>
                    </div>
                  </div>
                  {p.images?.[0] && (
                    <img src={p.images[0]} alt={p.description || 'post'} loading="lazy" className="mt-4 w-full aspect-[4/3] object-cover rounded-[10px]" />
                  )}
                  {p.description && (
                    <p className="mt-3 text-[14px] text-ink-soft leading-relaxed whitespace-pre-wrap">
                      {p.description}
                    </p>
                  )}
                  <div className="flex items-center gap-1 mt-3 -ml-2">
                    <button
                      onClick={() => handleLikePost(p.id)}
                      aria-label={liked ? 'Unlike post' : 'Like post'}
                      aria-pressed={liked}
                      className={`h-9 px-3 rounded-full font-mono text-[11px] tracking-wide flex items-center gap-1.5 transition-colors ${
                        liked ? 'text-accent' : 'text-ink-mute hover:text-ink'
                      }`}
                    >
                      {liked ? <HeartIconSolid className="w-[18px] h-[18px]" /> : <HeartIcon className="w-[18px] h-[18px]" />}
                      {liked ? Math.max(likeCount, 1) : (likeCount > 0 ? likeCount : '')}
                    </button>
                    <button
                      onClick={() => { void openComments(p) }}
                      aria-label={`View comments (${p.comments?.length || 0})`}
                      className="h-9 px-3 rounded-full font-mono text-[11px] tracking-wide text-ink-mute hover:text-ink flex items-center gap-1.5"
                    >
                      <ChatBubbleLeftIcon className="w-[18px] h-[18px]" />
                      {p.comments?.length || ''}
                    </button>
                    <button
                      onClick={() => setSavedPosts(prev => { const n = new Set(prev); n.has(p.id) ? n.delete(p.id) : n.add(p.id); return n })}
                      aria-label={saved ? 'Remove bookmark' : 'Bookmark post'}
                      aria-pressed={saved}
                      className={`h-9 px-3 rounded-full font-mono text-[11px] flex items-center gap-1.5 transition-colors ml-auto ${
                        saved ? 'text-ink' : 'text-ink-mute hover:text-ink'
                      }`}
                    >
                      {saved ? <BookmarkIconSolid className="w-[18px] h-[18px]" /> : <BookmarkIcon className="w-[18px] h-[18px]" />}
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <SaveModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        place={{
          id: place.id,
          name: place.name,
          address: place.address || '',
          tags: place.tags || [],
          posts: place.posts || [],
          savedCount: place.savedCount || 0,
          createdAt: (place as { createdAt?: string }).createdAt || '',
        }}
        userLists={userLists}
        onSave={handleSaveAction}
        onCreateList={handleCreateList}
      />
      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        title={place.name}
        description={place.description || place.address || ''}
        url={typeof window !== 'undefined' ? window.location.href : ''}
        type="place"
      />
      <CreatePost
        isOpen={showCreatePost}
        onClose={() => setShowCreatePost(false)}
        preSelectedHub={{ id: place.id, name: place.name, address: place.address || '', description: place.description, lat: place.coordinates?.lat, lng: place.coordinates?.lng }}
      />
      {activePost && (
        <CommentsModal
          isOpen={showCommentsModal}
          onClose={() => { setShowCommentsModal(false); setActivePost(null) }}
          comments={activePost.comments || []}
          onAddComment={async (text: string) => {
            if (!authUser) return
            const created = await firebaseDataService.postComment(activePost.id, authUser.id, text)
            if (created) {
              const next = [...(activePost.comments || []), created]
              setActivePost({ ...activePost, comments: next })
              // Keep the post in the page-level list in sync too so the count
              // under the Comment button updates without a reload.
              setPosts(prev => prev.map(p => p.id === activePost.id ? { ...p, comments: next } : p))
            }
          }}
          onLikeComment={async (commentId: string) => {
            if (!authUser) return
            await firebaseDataService.likeComment(activePost.id, commentId, authUser.id)
          }}
          onReplyToComment={async (commentId: string, text: string) => {
            if (!authUser) return
            // Replies are stored as flat comments mentioning the parent. Until
            // a real reply schema exists, fall back to a regular comment so
            // the thought isn't dropped.
            const created = await firebaseDataService.postComment(activePost.id, authUser.id, `@${commentId.slice(0, 6)} ${text}`)
            if (created) {
              const next = [...(activePost.comments || []), created]
              setActivePost({ ...activePost, comments: next })
              setPosts(prev => prev.map(p => p.id === activePost.id ? { ...p, comments: next } : p))
            }
          }}
        />
      )}
    </div>
  )
}

export default PlaceHub
