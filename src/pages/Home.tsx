import { useEffect, useMemo, useRef, useState } from 'react'
import AppHeader from '../components/ui/AppHeader'
import SearchOverlay from '../components/ui/SearchOverlay'
import DiscoveryCard, { type DiscoveryCardItem } from '../components/ui/DiscoveryCard'
import PageWatermark from '../components/ui/PageWatermark'
import { useAuth } from '../contexts/AuthContext'
import { useNavigation } from '../contexts/NavigationContext'
import { useModal } from '../contexts/ModalContext'
import { firebaseDataService } from '../services/firebaseDataService'
import { formatTimestamp } from '../utils/dateUtils'
import type { Hub, Place, User, Activity, List } from '../types/index.js'

interface FriendEvent {
  id: string
  user: User
  type: Activity['type']
  place?: Place
  list?: string
  listId?: string
  listRef?: List
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
  const [friendEvents, setFriendEvents] = useState<FriendEvent[]>([])
  const [savedPlaceCount, setSavedPlaceCount] = useState<number | null>(null)
  const [savedListCount, setSavedListCount] = useState<number | null>(null)
  const [loadingForYou, setLoadingForYou] = useState(true)
  const [loadingFriends, setLoadingFriends] = useState(true)
  const [searchOpen, setSearchOpen] = useState(false)
  const [popularTags, setPopularTags] = useState<string[]>([])
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const placeRefs = useRef<Record<string, Place>>({})

  const loadForYou = async (refresh = false) => {
    if (!currentUser) return
    setLoadingForYou(true)
    try {
      const eff = await firebaseDataService.getEffectiveLocation(currentUser.id)
      const seed = refresh ? Date.now() : undefined
      // Pull a much wider candidate pool than we'll show, so successive
      // Refresh taps can keep finding fresh places. The external limit being
      // ≥ 40 is what triggers `getExternalSuggestedPlaces`'s multi-call
      // strategy — three Google searches with different type mixes and
      // geographic offsets. Single-call returns ≤ 20 candidates which the
      // seen-set filter exhausts after 2 refreshes.
      const internal = await firebaseDataService.getSuggestedPlaces({
        tags: (currentUser as unknown as { tags?: string[] }).tags || [],
        location: eff ? { lat: eff.lat, lng: eff.lng } : undefined,
        limit: 40,
        seed,
      })
      let external: Place[] = []
      if (eff) {
        external = await firebaseDataService.getBatchedExternalRecommendations(eff.lat, eff.lng, {
          limit: 60,
          forceFresh: refresh,
          seed,
        })
      }
      const merged: Place[] = [...internal, ...external]
      const seen = new Set<string>()
      let unique = merged.filter((p) => {
        const k = (p.id || '') + '|' + (p.name || '')
        if (seen.has(k)) return false
        seen.add(k)
        return true
      })

      // Refresh = "show me different places". Drop ones we've already shown
      // this session. If we'd run out of candidates after filtering, reset the
      // seen-set and start over from the fresh pool.
      const SEEN_KEY = 'home_for_you_seen'
      const loadSeen = (): Set<string> => {
        try {
          const raw = sessionStorage.getItem(SEEN_KEY)
          return new Set(raw ? JSON.parse(raw) : [])
        } catch {
          return new Set()
        }
      }
      const persistSeen = (s: Set<string>) => {
        try {
          // Cap so the set doesn't grow unbounded.
          const arr = Array.from(s).slice(-200)
          sessionStorage.setItem(SEEN_KEY, JSON.stringify(arr))
        } catch {
          // sessionStorage full or denied; not fatal
        }
      }
      const seenIds = refresh ? loadSeen() : new Set<string>()
      if (refresh && seenIds.size > 0) {
        const filtered = unique.filter(p => !seenIds.has(p.id))
        if (filtered.length >= 6) {
          unique = filtered
        } else {
          // Pool exhausted — reset and show whatever we got.
          sessionStorage.removeItem(SEEN_KEY)
        }
      }
      type PlaceLoose = Place & {
        primaryType?: string
        types?: string[]
        photos?: { name: string }[]
        mainImage?: string
        hubImage?: string
        coverImage?: string
        coordinates?: { lat?: number; lng?: number; latitude?: number; longitude?: number }
        location?: { lat?: number; lng?: number; latitude?: number; longitude?: number; address?: string }
        address?: string
      }
      const finalPicks = unique.slice(0, 12)
      const items: DiscoveryCardItem[] = finalPicks.map((rawP) => {
        const p = rawP as PlaceLoose
        placeRefs.current[p.id] = p
        const c = p.coordinates || p.location || {}
        const lat = typeof c.lat === 'number' ? c.lat : c.latitude
        const lng = typeof c.lng === 'number' ? c.lng : c.longitude
        const distanceKm = eff && typeof lat === 'number' && typeof lng === 'number'
          ? firebaseDataService.distanceKm({ lat, lng }, { lat: eff.lat, lng: eff.lng })
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
        }
      })
      // Remember what we just showed so the next Refresh skips them.
      finalPicks.forEach(p => seenIds.add(p.id))
      persistSeen(seenIds)
      setForYou(items)
    } catch (e) {
      console.error('[home] forYou failed', e)
      setForYou([])
    } finally {
      setLoadingForYou(false)
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
            createdAt: a.createdAt,
          })
        }
      }
      all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      setFriendEvents(all.slice(0, 8))
    } catch (e) {
      console.warn('[home] loadFriends failed', e)
      setFriendEvents([])
    } finally {
      setLoadingFriends(false)
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
      setSavedListCount(Array.isArray(lists) ? lists.filter((l: any) => l.userId === currentUser.id).length : 0)
    } catch {
      setSavedPlaceCount(0)
      setSavedListCount(0)
    }
  }

  useEffect(() => {
    if (!currentUser) return
    void loadForYou()
    void loadFriends()
    void loadStats()
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
    const onSaved = () => { void loadStats() }
    const onUserUpdated = (e: Event) => {
      const detail = (e as CustomEvent).detail as { fields?: string[] } | undefined
      if (!detail?.fields || detail.fields.includes('location')) void loadForYou()
    }
    window.addEventListener('this-is:saved', onSaved)
    window.addEventListener('this-is:userUpdated', onUserUpdated)
    return () => {
      window.removeEventListener('this-is:saved', onSaved)
      window.removeEventListener('this-is:userUpdated', onUserUpdated)
    }
  }, [currentUser?.id])

  const greeting = useMemo(() => HomeGreeting({ name: currentUser?.name }), [currentUser?.name])

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
      coordinates: p.coordinates || (p.location?.lat && p.location?.lng ? { lat: p.location.lat, lng: p.location.lng } : undefined),
      tags: p.tags || [],
      photos: Array.isArray(p.photos) ? p.photos : [],
      primaryType: p.primaryType,
      types: p.types,
      mainImage: p.mainImage,
      posts: [],
    }
    try { openSaveModal(hubLike as unknown as Hub) } catch (e) { console.warn('[home] openSaveModal failed', e) }
    setSavedIds(prev => new Set(prev).add(it.id))
  }

  return (
    <div className="min-h-full relative overflow-x-hidden">
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
              <span className="accent-bead-sm accent-bead" /> № 01
            </span>
            <h2 className="font-display text-[28px] leading-none text-ink mt-1.5">
              For you<span style={{ color: 'var(--bloom)' }}>.</span>
            </h2>
            <div className="amber-hairline mt-2 w-12" />
          </div>
          <button
            type="button"
            onClick={() => void loadForYou(true)}
            className="label-eyebrow text-ink-soft hover:text-ink"
          >
            Refresh
          </button>
        </div>
        {loadingForYou ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="animate-pulse aspect-[5/6] rounded-[14px] bg-paper-deep" />
            ))}
          </div>
        ) : forYou.length === 0 ? (
          <div className="border border-edge rounded-[14px] px-5 py-10 text-center bg-card">
            <p className="font-display text-[22px] text-ink leading-tight">Nothing yet.</p>
            <p className="text-[13px] text-ink-soft mt-2">
              We need your location to surface places. Grant access or set it in <a className="text-accent underline-offset-4 hover:underline" href="/profile/edit" style={{ color: 'var(--accent-deep)' }}>your profile</a>.
            </p>
            <button
              type="button"
              onClick={() => {
                if (!('geolocation' in navigator)) return
                navigator.geolocation.getCurrentPosition(
                  () => { void loadForYou(true) },
                  () => { /* permission denied — link to profile is the fallback */ },
                  { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
                )
              }}
              className="btn-cta h-10 px-4 mt-4 text-[13px] font-semibold inline-flex items-center gap-2"
            >
              📍 Use my current location
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {forYou.map(it => (
              <DiscoveryCard
                key={it.id}
                item={{ ...it, saved: savedIds.has(it.id) }}
                onOpen={() => {
                  const p = placeRefs.current[it.id]
                  if (p) openHubModal(p as unknown as Hub, 'home')
                }}
                onSave={() => handleSavePlace(it)}
                variant="compact"
              />
            ))}
          </div>
        )}
      </section>

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
              const target = e.place?.name || e.list || ''
              return (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => {
                      // Like/save/post about a place → hub modal.
                      // Create-list / list-targeted activity → list modal.
                      // Fallback to the friend's profile only when neither side has data.
                      if (e.type === 'create_list' && (e.listRef || e.listId)) {
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
