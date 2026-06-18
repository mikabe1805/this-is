import { useEffect, useMemo, useRef, useState } from 'react'
import { MapPinIcon } from '@heroicons/react/24/outline'
import AppHeader from '../components/ui/AppHeader'
import PullSpinner from '../components/ui/PullSpinner'
import SearchOverlay from '../components/ui/SearchOverlay'
import DiscoveryCard, { type DiscoveryCardItem } from '../components/ui/DiscoveryCard'
import PageWatermark from '../components/ui/PageWatermark'
import { useAuth } from '../contexts/AuthContext'
import { useNavigation } from '../contexts/NavigationContext'
import { useModal } from '../contexts/ModalContext'
import { firebaseDataService, type TasteProfile } from '../services/firebaseDataService'
import { formatTimestamp } from '../utils/dateUtils'
import { readCoords } from '../utils/coords'
import { haptics } from '../utils/haptics'
import { usePullToRefresh } from '../hooks/usePullToRefresh'
import type { Hub, Place, User, Activity, List } from '../types/index.js'

interface FriendEvent {
  id: string
  user: User
  type: Activity['type']
  place?: Place
  list?: string
  listId?: string
  listRef?: List
  /** Set on follow events — the user that was followed. */
  targetUserId?: string
  targetUser?: User
  createdAt: string
}

const ACTION_LABEL: Record<Activity['type'] | 'visit' | 'follow', string> = {
  save: 'saved',
  visit: 'visited',
  like: 'liked',
  post: 'posted about',
  create_list: 'created list',
  follow: 'followed',
}

const HomeGreeting = ({ name }: { name?: string }) => {
  const hour = new Date().getHours()
  const part = hour < 5 ? 'Good night' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const first = (name || '').split(' ')[0]
  return first ? `${part}, ${first}` : part
}

const Home = () => {
  const { currentUser } = useAuth()
  const { openHubModal, openListModal, openProfileModal } = useNavigation()
  const { openSaveModal } = useModal()

  const [forYou, setForYou] = useState<DiscoveryCardItem[]>([])
  const [lanes, setLanes] = useState<{ key: string; title: string; items: DiscoveryCardItem[] }[]>([])
  // Resurfaced "want to try" saves — keeps the wishlist from being a graveyard.
  const [wantPlaces, setWantPlaces] = useState<DiscoveryCardItem[]>([])
  const [friendEvents, setFriendEvents] = useState<FriendEvent[]>([])
  const [savedPlaceCount, setSavedPlaceCount] = useState<number | null>(null)
  const [savedListCount, setSavedListCount] = useState<number | null>(null)
  const [loadingForYou, setLoadingForYou] = useState(true)
  const [loadingFriends, setLoadingFriends] = useState(true)
  const [searchOpen, setSearchOpen] = useState(false)
  const [locating, setLocating] = useState(false)
  const [taste, setTaste] = useState<TasteProfile | null>(null)
  const [popularTags, setPopularTags] = useState<string[]>([])
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  // Whether the last load had an effective location — drives which empty state
  // we show (a location prompt is wrong when location is already known).
  const [locKnown, setLocKnown] = useState(false)
  const placeRefs = useRef<Record<string, Place>>({})
  // Spare, already-fetched candidates (beyond the 12 shown) used to backfill the
  // grid instantly when a card is saved/dismissed — no extra fetch, no shrink.
  const poolTailRef = useRef<DiscoveryCardItem[]>([])
  // Debounce the post-save re-rank so a burst of saves coalesces into one reload.
  const rerankTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Tracks the latest currentUser.id so async loaders can detect a user
  // switch and bail before writing stale data into state.
  const currentUserIdRef = useRef<string | null>(null)

  // Remove a card from the grid + lanes, backfilling the grid from the spare
  // pool so it stays full (and even-numbered for the 2-col layout).
  const removeFromFeed = (id: string) => {
    setForYou(prev => {
      if (!prev.some(x => x.id === id)) return prev
      const next = prev.filter(x => x.id !== id)
      while (next.length < prev.length && poolTailRef.current.length > 0) {
        const cand = poolTailRef.current.shift()!
        if (cand.id !== id && !next.some(x => x.id === cand.id)) next.push(cand)
      }
      return next
    })
    setLanes(prev => prev
      .map(l => ({ ...l, items: l.items.filter(x => x.id !== id) }))
      .filter(l => l.items.length >= 3))
  }

  const loadForYou = async (refresh = false) => {
    if (!currentUser) return
    setLoadingForYou(true)
    try {
      const eff = await firebaseDataService.getEffectiveLocation(currentUser.id)
      setLocKnown(!!eff)
      const seed = refresh ? Date.now() : undefined
      // Taste-driven recommendations. getTasteRecommendations builds a profile
      // from the user's SAVES (strongest signal) + signup vibes + bio, queries
      // Google with vibe-rich phrases ("cozy specialty coffee shop", "scenic
      // beach") near them, blends in taste-ranked internal places, drops what
      // they've already saved, and ranks by taste fit + proximity. Each result
      // carries a "why" reason. Pull a wider pool (24) so the seen-set can
      // rotate picks across Refresh taps.
      const recs = await firebaseDataService.getTasteRecommendations(
        currentUser.id,
        eff ? { lat: eff.lat, lng: eff.lng } : null,
        { limit: 24, seed, forceFresh: refresh }
      )

      // Refresh = "show me different places". Drop ones already shown this
      // session; reset once the pool is exhausted.
      const SEEN_KEY = 'home_for_you_seen'
      const loadSeen = (): Set<string> => {
        try { const raw = sessionStorage.getItem(SEEN_KEY); return new Set(raw ? JSON.parse(raw) : []) } catch { return new Set() }
      }
      const persistSeen = (s: Set<string>) => {
        try { sessionStorage.setItem(SEEN_KEY, JSON.stringify(Array.from(s).slice(-200))) } catch { /* quota */ }
      }
      const seenIds = refresh ? loadSeen() : new Set<string>()
      let pool = recs
      if (refresh && seenIds.size > 0) {
        const filtered = recs.filter(p => !seenIds.has(p.id))
        if (filtered.length >= 6) pool = filtered
        else sessionStorage.removeItem(SEEN_KEY)
      }

      type PlaceLoose = Place & {
        reason?: string
        primaryType?: string
        types?: string[]
        photos?: { name: string }[]
        mainImage?: string
        hubImage?: string
        coverImage?: string
        location?: { address?: string }
        address?: string
      }
      const toItem = (rawP: PlaceLoose): DiscoveryCardItem => {
        const p = rawP
        placeRefs.current[p.id] = p
        const coords = readCoords(p)
        const distanceKm = eff && coords
          ? firebaseDataService.distanceKm(coords, { lat: eff.lat, lng: eff.lng })
          : undefined
        return {
          id: p.id,
          kind: 'place',
          title: p.name,
          subtitle: p.address || (p.location && p.location.address) || '',
          primaryType: p.primaryType,
          types: p.types,
          photos: p.photos,
          // Prefer a user-uploaded picture over the Google photo / poster.
          imageUrl: p.mainImage || p.hubImage || p.coverImage || undefined,
          distanceKm,
          savedCount: typeof (p as { savedCount?: number }).savedCount === 'number'
            ? (p as { savedCount?: number }).savedCount
            : undefined,
          // The "why" — e.g. "Because you love coffee".
          reason: p.reason,
        }
      }
      // Map a wider slice than we render (12) so a dismiss/save can backfill the
      // grid from already-fetched spares — no extra fetch, no shrinking grid.
      const allItems = (pool.slice(0, 24) as PlaceLoose[]).map(toItem)
      const items = allItems.slice(0, 12)
      // Bail if the auth user changed mid-flight.
      if (currentUser && currentUserIdRef.current !== currentUser.id) return
      poolTailRef.current = allItems.slice(12)
      pool.slice(0, 12).forEach(p => seenIds.add(p.id))
      persistSeen(seenIds)
      setForYou(items)

      // Themed lanes ("More coffee you'll love", "Beaches for your next trip").
      // Reuses the per-interest cache the recs above just warmed, so it adds no
      // Google calls in the common case. Exclude what's already in the grid so
      // lanes show MORE, not repeats.
      try {
        const shown = new Set(items.map(p => p.id))
        const laneData = await firebaseDataService.getTasteLanes(
          currentUser.id,
          eff ? { lat: eff.lat, lng: eff.lng } : null
        )
        if (currentUser && currentUserIdRef.current === currentUser.id) {
          const mapped = laneData.map(l => ({
            key: l.key,
            title: l.title,
            items: (l.items as PlaceLoose[])
              .filter(p => p?.id && !shown.has(p.id))
              .slice(0, 8)
              .map((p) => {
                placeRefs.current[p.id] = p
                const coords = readCoords(p)
                const distanceKm = eff && coords ? firebaseDataService.distanceKm(coords, { lat: eff.lat, lng: eff.lng }) : undefined
                return {
                  id: p.id,
                  kind: 'place' as const,
                  title: p.name,
                  subtitle: p.address || (p.location && p.location.address) || '',
                  primaryType: p.primaryType,
                  types: p.types,
                  photos: p.photos,
                  imageUrl: p.mainImage || p.hubImage || p.coverImage || undefined,
                  distanceKm,
                  savedCount: typeof (p as { savedCount?: number }).savedCount === 'number' ? (p as { savedCount?: number }).savedCount : undefined,
                } as DiscoveryCardItem
              }),
          })).filter(l => l.items.length >= 3)
          setLanes(mapped)
        }
      } catch (e) { console.warn('[home] lanes failed', e) }
    } catch (e) {
      console.error('[home] forYou failed', e)
      if (currentUser && currentUserIdRef.current === currentUser.id) { setForYou([]); setLanes([]) }
    } finally {
      if (currentUser && currentUserIdRef.current === currentUser.id) setLoadingForYou(false)
    }
  }

  const loadFriends = async () => {
    if (!currentUser) return
    setLoadingFriends(true)
    try {
      const friends = await firebaseDataService.getUserFriends(currentUser.id)
      const slice = friends.slice(0, 8)
      // Parallelize the per-friend activity fetches — was a serial loop (up
      // to 8 sequential roundtrips). On a slow connection that's 4-8s of
      // wall time before the friends section renders.
      const results = await Promise.all(
        slice.map(f =>
          firebaseDataService.getUserActivity(f.id, 4)
            .then(acts => ({ f, acts }))
            .catch(() => ({ f, acts: [] as Activity[] }))
        )
      )
      const all: FriendEvent[] = []
      for (const { f, acts } of results) {
        for (const a of acts) {
          all.push({
            id: a.id,
            user: f,
            type: a.type,
            place: a.place,
            list: a.list?.name,
            listId: a.list?.id,
            listRef: a.list as List | undefined,
            targetUserId: (a as { targetUserId?: string }).targetUserId,
            targetUser: (a as { targetUser?: User }).targetUser,
            createdAt: a.createdAt,
          })
        }
      }
      // Same user-switch bail as loadForYou — getUserFriends + 8 parallel
      // getUserActivity calls can run for several seconds on slow networks.
      if (currentUser && currentUserIdRef.current !== currentUser.id) return
      all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      setFriendEvents(all.slice(0, 8))
    } catch (e) {
      console.warn('[home] loadFriends failed', e)
      if (currentUser && currentUserIdRef.current === currentUser.id) setFriendEvents([])
    } finally {
      if (currentUser && currentUserIdRef.current === currentUser.id) setLoadingFriends(false)
    }
  }

  const loadStats = async () => {
    if (!currentUser) return
    try {
      const [places, lists] = await Promise.all([
        firebaseDataService.getSavedPlaces(currentUser.id).catch(() => []),
        firebaseDataService.getUserLists(currentUser.id).catch(() => []),
      ])
      setSavedPlaceCount(Array.isArray(places) ? places.length : 0)
      setSavedListCount(Array.isArray(lists) ? lists.filter((l: { userId?: string }) => l.userId === currentUser.id).length : 0)
      // Seed the saved-state set so For-You cards show a FILLED bookmark for
      // places already saved. Without this, every already-saved place rendered
      // an empty bookmark until the user re-saved it — eroding trust in the
      // core feature.
      if (Array.isArray(places)) setSavedIds(new Set(places.map((p: Place) => p.id)))
    } catch {
      setSavedPlaceCount(0)
      setSavedListCount(0)
    }
  }

  useEffect(() => {
    if (!currentUser) return
    // Stale-effect guard: if the user signs out or switches accounts mid-load,
    // the in-flight promises must not call setForYou / setFriendEvents with
    // the previous user's data. Each loader checks the latest id against the
    // ref and bails before writing state.
    currentUserIdRef.current = currentUser.id
    void loadForYou()
    void loadFriends()
    void loadStats()
    firebaseDataService.buildTasteProfile(currentUser.id).then(setTaste).catch(() => {})
    firebaseDataService.getPopularTags(20).then(setPopularTags).catch(() => {})
    try {
      const r = JSON.parse(localStorage.getItem('recentSearches') || '[]')
      if (Array.isArray(r)) setRecentSearches(r)
    } catch {
      // bad JSON in sessionStorage; ignore
    }
    // Re-run when the profile location changes too. Critical for the signup
    // flow: AuthContext flips currentUser to a minimal record before
    // setupNewUser writes the location, and the For-You feed needs to
    // re-fetch as soon as the profile gains a location string.
  }, [currentUser?.id, currentUser?.location])

  // Refresh saved-count and recommendations whenever a save happens elsewhere.
  useEffect(() => {
    if (!currentUser) return
    const onSaved = (e: Event) => {
      // Reflect the new save immediately in the bookmark state, then refresh
      // counts. The event carries the placeId of whatever was just saved.
      const pid = (e as CustomEvent).detail?.placeId as string | undefined
      if (pid) {
        setSavedIds(prev => new Set(prev).add(pid))
        // Recs are for NEW spots — drop the just-saved card and backfill from
        // the spare pool so the feed visibly reacts to the save right away.
        removeFromFeed(pid)
      }
      haptics.success()
      void loadStats()
      // A save just taught the model something — invalidate the cached profile
      // FIRST (the save's taste write may not have invalidated it yet on this
      // tick), then rebuild the taste header from fresh data.
      if (currentUser) {
        firebaseDataService.invalidateTasteProfile(currentUser.id)
        firebaseDataService.buildTasteProfile(currentUser.id).then(setTaste).catch(() => {})
        // Debounced re-rank: a save reshapes the taste vector, so re-pull and
        // re-rank the feed. NOT forceFresh — this reuses the 24h searchText
        // cache (zero Places cost) and only re-ranks the pool + internal places.
        if (rerankTimer.current) clearTimeout(rerankTimer.current)
        rerankTimer.current = setTimeout(() => { void loadForYou() }, 450)
      }
    }
    const onUserUpdated = (e: Event) => {
      const detail = (e as CustomEvent).detail as { fields?: string[] } | undefined
      if (!detail?.fields || detail.fields.includes('location')) void loadForYou()
    }
    window.addEventListener('this-is:saved', onSaved)
    window.addEventListener('this-is:userUpdated', onUserUpdated)
    return () => {
      window.removeEventListener('this-is:saved', onSaved)
      window.removeEventListener('this-is:userUpdated', onUserUpdated)
      if (rerankTimer.current) clearTimeout(rerankTimer.current)
    }
  }, [currentUser?.id])

  // Resurface the "want to try" wishlist so saves don't rot in a list. Loads
  // once + on any save; no Places cost (internal list read).
  useEffect(() => {
    if (!currentUser) { setWantPlaces([]); return }
    let cancelled = false
    const load = async () => {
      const places = await firebaseDataService.getStatusListPlaces(currentUser.id, 'want', 10).catch(() => [] as Place[])
      if (cancelled) return
      const items = places.map(rawP => {
        const p = rawP as Place & { primaryType?: string; types?: string[]; photos?: { name: string }[]; mainImage?: string; hubImage?: string; coverImage?: string; address?: string; location?: { address?: string } }
        placeRefs.current[p.id] = p
        return {
          id: p.id,
          kind: 'place' as const,
          title: p.name,
          subtitle: p.address || (p.location && p.location.address) || '',
          primaryType: p.primaryType,
          types: p.types,
          photos: p.photos,
          imageUrl: p.mainImage || p.hubImage || p.coverImage || undefined,
        } as DiscoveryCardItem
      })
      setWantPlaces(items)
    }
    void load()
    const onSaved = () => { void load() }
    window.addEventListener('this-is:saved', onSaved)
    return () => { cancelled = true; window.removeEventListener('this-is:saved', onSaved) }
  }, [currentUser?.id])

  const greeting = useMemo(() => HomeGreeting({ name: currentUser?.name }), [currentUser?.name])

  // The "we know you" line that makes the feed feel built for this person and
  // visibly deepen with use. Names the user's actual top interests + a
  // confidence eyebrow driven by how many signals we've gathered.
  const tasteSummary = useMemo(() => {
    if (!taste || !taste.hasSignal || taste.interests.length === 0) return null
    const labels = taste.interests.slice(0, 3).map(i => i.label)
    const joined = labels.length <= 1
      ? labels[0]
      : `${labels.slice(0, -1).join(', ')} & ${labels[labels.length - 1]}`
    const eyebrow = taste.confidence === 'known'
      ? 'Tuned to you'
      : taste.confidence === 'learning'
        ? 'Learning your taste'
        : 'Getting to know you'
    return { joined, eyebrow }
  }, [taste])

  const handleSavePlace = (it: DiscoveryCardItem) => {
    const raw = placeRefs.current[it.id]
    if (!raw) return
    type RichPlace = Place & {
      address?: string
      location?: { address?: string; lat?: number; lng?: number }
      coordinates?: { lat?: number; lng?: number }
      photos?: { name: string }[]
      primaryType?: string
      types?: string[]
      mainImage?: string
    }
    const p = raw as RichPlace
    // Carry every Google metadata field through to the SaveModal so
    // ensureHubFromPlace can persist a real place doc (photos, primaryType,
    // types, coordinates) — without these, list rows fall back to the
    // poster placeholder forever and the map view has nothing to plot.
    const hubLike = {
      id: p.id,
      name: p.name,
      address: p.address || p.location?.address || '',
      location: p.location || { address: p.address || '' },
      // readCoords handles Google's top-level lat/lng (the old check only looked
      // at p.coordinates / p.location, so recommended places saved with NO
      // coordinates and never pinned on the list map).
      coordinates: readCoords(p),
      tags: p.tags || [],
      photos: Array.isArray(p.photos) ? p.photos : [],
      primaryType: p.primaryType,
      types: p.types,
      mainImage: p.mainImage,
      posts: [],
    }
    // Don't mark saved on modal-OPEN — the user may cancel. The bookmark
    // fills when the `this-is:saved` event confirms an actual save.
    try { openSaveModal(hubLike as unknown as Hub) } catch (e) { console.warn('[home] openSaveModal failed', e) }
  }

  // "Not interested" — down-weight this place's interests in the taste model,
  // remember the dismissal so it won't resurface, and pull it from the feed.
  const handleDismiss = (it: DiscoveryCardItem) => {
    const raw = placeRefs.current[it.id] as (Place & { primaryType?: string | null; types?: string[]; category?: string; tags?: string[] }) | undefined
    if (currentUser && raw?.id) {
      firebaseDataService.markNotInterested(currentUser.id, raw as typeof raw & { id: string })
    }
    haptics.tap()
    removeFromFeed(it.id)
    window.dispatchEvent(new CustomEvent('this-is:toast', { detail: { message: "Got it — we'll show less like this." } }))
  }

  // Pull down at the top of the feed to refresh (forceFresh).
  const { pull, refreshing } = usePullToRefresh(() => loadForYou(true))

  return (
    <div className="min-h-full relative overflow-x-hidden">
      <PullSpinner pull={pull} refreshing={refreshing} />
      <PageWatermark variant="corners" anchor="top" size={420} opacity={0.28} />
      {/* Editorial masthead. Botanical lives in the page watermark, not in
          the title row — the page should feel atmospheric, not branded. */}
      <div className="paper-wash relative px-5 pt-4 pb-1">
        <div className="flex items-center justify-between relative">
          <div className="flex items-center gap-1.5">
            <span className="font-display-italic text-[18px] text-ink leading-none">this</span>
            <span className="accent-bead" />
            <span className="font-display-italic text-[18px] text-ink leading-none">is</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="label-eyebrow text-ink-mute">
              {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
            <span className="label-eyebrow flex items-center gap-1.5" style={{ color: 'var(--accent-deep)' }}>
              <span className="accent-bead-sm accent-bead" />
              №01
            </span>
          </div>
        </div>
        <div className="rule-dot mt-3" />
      </div>
      <AppHeader
        title={greeting + '.'}
        eyebrow="A field guide"
        subtitle={currentUser ? 'Where to next.' : undefined}
        searchPlaceholder="Search places, lists, friends"
        onSearchFocus={() => setSearchOpen(true)}
      />

      {(savedPlaceCount !== null || savedListCount !== null) && (
        <div className="px-5 pt-5">
          <div className="grid grid-cols-2 divide-x divide-edge border-y border-edge">
            <a href="/profile" className="px-2 py-3 group hover:bg-paper-deep transition-colors">
              <div className="label-eyebrow text-ink-mute">Saved</div>
              <div className="font-display text-[34px] leading-none mt-1.5 text-ink">
                {savedPlaceCount ?? '—'}
              </div>
              <div className="font-display-italic text-[12px] text-ink-mute mt-1.5">
                {savedPlaceCount === 0 ? 'a clean slate' : 'places worth coming back to'}
              </div>
            </a>
            <a href="/lists" className="px-2 py-3 pl-4 group hover:bg-paper-deep transition-colors">
              <div className="label-eyebrow text-ink-mute">Lists</div>
              <div className="font-display text-[34px] leading-none mt-1.5 text-ink">
                {savedListCount ?? '—'}
              </div>
              <div className="font-display-italic text-[12px] text-ink-mute mt-1.5">
                {savedListCount === 0 ? 'start one' : 'collections of yours'}
              </div>
            </a>
          </div>
        </div>
      )}

      <section className="px-5 pt-9">
        <div className="flex items-baseline justify-between mb-4">
          <div>
            <span className="label-eyebrow flex items-center gap-1.5" style={{ color: 'var(--accent-deep)' }}>
              <span className="accent-bead-sm accent-bead" /> {tasteSummary ? tasteSummary.eyebrow : '№ 01'}
            </span>
            <h2 className="font-display text-[28px] leading-none text-ink mt-1.5">
              For you<span style={{ color: 'var(--bloom)' }}>.</span>
            </h2>
            <div className="amber-hairline mt-2 w-12" />
            {tasteSummary && (
              <p className="font-display-italic text-[13px] text-ink-soft mt-2 max-w-[16rem] leading-snug">
                Tuned to your love of {tasteSummary.joined}.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => { haptics.tap(); void loadForYou(true) }}
            disabled={loadingForYou}
            className="label-eyebrow text-ink-soft hover:text-ink disabled:opacity-40 disabled:cursor-not-allowed press inline-flex items-center min-h-[44px] -my-2 -mr-2 px-2"
          >
            {loadingForYou ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
        {loadingForYou ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="animate-pulse aspect-[5/6] rounded-[14px] bg-paper-deep" />
            ))}
          </div>
        ) : forYou.length === 0 && locKnown ? (
          // Location IS known — the feed is just empty (no fresh picks, or all
          // candidates already saved/dismissed). Don't send the user on a
          // location goose-chase; offer a refresh instead.
          <div className="border border-edge rounded-[14px] px-5 py-10 text-center bg-card">
            <p className="font-display text-[22px] text-ink leading-tight">All caught up.</p>
            <p className="text-[13px] text-ink-soft mt-2">
              No fresh picks right now. Pull to refresh, or follow a few people whose taste you trust.
            </p>
            <button
              type="button"
              onClick={() => { haptics.tap(); void loadForYou(true) }}
              className="btn-cta h-10 px-4 mt-4 text-[13px] font-semibold inline-flex items-center gap-2"
            >
              Refresh picks
            </button>
          </div>
        ) : forYou.length === 0 ? (
          <div className="border border-edge rounded-[14px] px-5 py-10 text-center bg-card">
            <p className="font-display text-[22px] text-ink leading-tight">Nothing yet.</p>
            <p className="text-[13px] text-ink-soft mt-2">
              We need your location to surface places. Grant access or set it in <a className="text-accent underline-offset-4 hover:underline" href="/profile/edit" style={{ color: 'var(--accent-deep)' }}>your profile</a>.
            </p>
            <button
              type="button"
              disabled={locating}
              onClick={() => {
                if (!('geolocation' in navigator)) {
                  window.dispatchEvent(new CustomEvent('this-is:toast', { detail: { message: "This device can't share location — set it in your profile.", tone: 'error' } }))
                  return
                }
                setLocating(true)
                navigator.geolocation.getCurrentPosition(
                  () => { setLocating(false); void loadForYou(true) },
                  (err) => {
                    // Was a silent no-op: the empty state just sat there with
                    // no explanation of why nothing happened.
                    setLocating(false)
                    const msg = err.code === err.PERMISSION_DENIED
                      ? 'Location blocked. Set your city in your profile instead.'
                      : "Couldn't get your location. Try again or set it in your profile."
                    window.dispatchEvent(new CustomEvent('this-is:toast', { detail: { message: msg, tone: 'error', action: { label: 'Profile', href: '/profile/edit' } } }))
                  },
                  { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
                )
              }}
              className="btn-cta h-10 px-4 mt-4 text-[13px] font-semibold inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <MapPinIcon className="w-4 h-4" />
              {locating ? 'Finding you…' : 'Use my current location'}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {forYou.map((it, idx) => (
              <DiscoveryCard
                key={it.id}
                item={{ ...it, saved: savedIds.has(it.id) }}
                onOpen={() => {
                  haptics.select()
                  const p = placeRefs.current[it.id]
                  if (p) openHubModal(p as unknown as Hub, 'home')
                }}
                onSave={() => handleSavePlace(it)}
                onDismiss={() => handleDismiss(it)}
                /* Eager-load real photos only for the above-the-fold cards;
                   the rest stay posters until the place is opened (bounds the
                   Photo-SKU cost to ~6 per feed load). */
                loadImage={idx < 6}
                variant="compact"
              />
            ))}
          </div>
        )}
      </section>

      {/* Themed taste lanes — horizontally scrolling rows built from the
          user's top interests. Each one reads as "the app curated this lane
          for me". */}
      {!loadingForYou && lanes.map(lane => (
        <section key={lane.key} className="pt-9">
          <h2 className="px-5 font-display text-[22px] leading-none text-ink mb-4">
            {lane.title}<span style={{ color: 'var(--bloom)' }}>.</span>
          </h2>
          <div className="flex gap-3 overflow-x-auto px-5 pb-2" style={{ scrollbarWidth: 'none' }}>
            {lane.items.map((it, idx) => (
              <div key={it.id} className="w-[150px] shrink-0">
                <DiscoveryCard
                  item={{ ...it, saved: savedIds.has(it.id) }}
                  onOpen={() => { haptics.select(); const p = placeRefs.current[it.id]; if (p) openHubModal(p as unknown as Hub, 'home') }}
                  onSave={() => handleSavePlace(it)}
                  onDismiss={() => handleDismiss(it)}
                  loadImage={idx < 4}
                  variant="compact"
                />
              </div>
            ))}
          </div>
        </section>
      ))}

      {/* "Still want to try?" — resurfaced wishlist so saves don't rot. */}
      {!loadingForYou && wantPlaces.length >= 3 && (
        <section className="pt-9">
          <h2 className="px-5 font-display text-[22px] leading-none text-ink mb-1">
            Still want to try<span style={{ color: 'var(--bloom)' }}>?</span>
          </h2>
          <p className="px-5 font-display-italic text-[13px] text-ink-soft mb-4">From your want list.</p>
          <div className="flex gap-3 overflow-x-auto px-5 pb-2" style={{ scrollbarWidth: 'none' }}>
            {wantPlaces.map((it, idx) => (
              <div key={it.id} className="w-[150px] shrink-0">
                <DiscoveryCard
                  item={{ ...it, saved: savedIds.has(it.id) }}
                  onOpen={() => { haptics.select(); const p = placeRefs.current[it.id]; if (p) openHubModal(p as unknown as Hub, 'home') }}
                  onSave={() => handleSavePlace(it)}
                  loadImage={idx < 4}
                  variant="compact"
                />
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="px-5 pt-10 pb-12">
        <div className="flex items-baseline justify-between mb-4">
          <div>
            <span className="label-eyebrow flex items-center gap-1.5" style={{ color: 'var(--accent-deep)' }}>
              <span className="accent-bead-sm accent-bead" /> № 02
            </span>
            <h2 className="font-display text-[28px] leading-none text-ink mt-1.5">
              Friends<span style={{ color: 'var(--bloom)' }}>.</span>
            </h2>
            <div className="amber-hairline mt-2 w-12" />
          </div>
          <a href="/profile/following" className="label-eyebrow text-ink-soft hover:text-ink">
            All →
          </a>
        </div>
        {loadingFriends ? (
          <ul className="divide-y divide-edge border-y border-edge">
            {Array.from({ length: 3 }).map((_, i) => (
              <li key={i} className="animate-pulse flex items-center gap-3 px-1 py-4">
                <div className="w-10 h-10 rounded-full bg-paper-deep" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-paper-deep rounded w-2/3" />
                  <div className="h-3 bg-paper-deep rounded w-1/3" />
                </div>
              </li>
            ))}
          </ul>
        ) : friendEvents.length === 0 ? (
          <div className="border border-edge rounded-[14px] px-5 py-10 text-center bg-card">
            <p className="font-display text-[22px] text-ink leading-tight">Nobody yet.</p>
            <p className="text-[13px] text-ink-soft mt-2">Follow a few people whose taste you trust.</p>
          </div>
        ) : (
          <ul className="divide-y divide-edge border-y border-edge">
            {friendEvents.map(e => {
              const action = ACTION_LABEL[e.type] || 'updated'
              const target = e.place?.name || e.list || (e.type === 'follow' ? (e.targetUser?.name || e.targetUser?.username || '') : '')
              return (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => {
                      // Follow → followed user's profile modal.
                      // Like/save/post about a place → hub modal.
                      // Create-list / list-targeted activity → list modal.
                      // Fallback to the friend's profile only when neither side has data.
                      if (e.type === 'follow' && e.targetUserId) {
                        openProfileModal(e.targetUserId, 'home-activity')
                      } else if (e.type === 'create_list' && (e.listRef || e.listId)) {
                        const list = e.listRef || ({ id: e.listId, name: e.list || '' } as unknown as List)
                        openListModal(list, 'home-activity')
                      } else if (e.place) {
                        openHubModal(e.place as unknown as Hub, 'home-activity')
                      } else if (e.listRef || e.listId) {
                        const list = e.listRef || ({ id: e.listId, name: e.list || '' } as unknown as List)
                        openListModal(list, 'home-activity')
                      } else {
                        openProfileModal(e.user.id, 'home-activity')
                      }
                    }}
                    className="w-full flex items-center gap-3.5 px-1 py-4 text-left hover:bg-paper-deep transition-colors"
                  >
                    <button
                      type="button"
                      onClick={(ev) => { ev.stopPropagation(); openProfileModal(e.user.id, 'home-activity') }}
                      className="shrink-0 w-10 h-10 rounded-full overflow-hidden bg-paper-deep ring-1 ring-edge"
                      aria-label={`${e.user.name}'s profile`}
                    >
                      {e.user.avatar ? (
                        <img src={e.user.avatar} alt={e.user.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center font-mono text-[10px] tracking-wider text-ink-soft">
                          {(e.user.name || '?').slice(0, 2).toUpperCase()}
                        </div>
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] text-ink truncate leading-tight">
                        <span className="font-medium">{e.user.name}</span>{' '}
                        <span className="text-ink-mute font-mono text-[12px] tracking-wide">{action}</span>{' '}
                        <span className="font-display-italic text-[16px]">{target}</span>
                      </p>
                      <p className="font-mono text-[10px] tracking-[0.12em] uppercase text-ink-mute mt-0.5">{formatTimestamp(e.createdAt)}</p>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <SearchOverlay
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        recentSearches={recentSearches}
        popularTags={popularTags}
      />
    </div>
  )
}

export default Home
