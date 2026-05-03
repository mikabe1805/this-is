import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import DiscoveryCard, { type DiscoveryCardItem } from '../components/ui/DiscoveryCard'
import PageWatermark from '../components/ui/PageWatermark'
import { useAuth } from '../contexts/AuthContext'
import { useNavigation } from '../contexts/NavigationContext'
import { useModal } from '../contexts/ModalContext'
import { firebaseDataService } from '../services/firebaseDataService'
import { useSearch } from '../hooks/useSearch'
import { searchText as googleSearchText, type PlaceLite } from '../lib/placesNew'
import type { Place, List, User } from '../types/index.js'

const MIN_INTERNAL_PLACES_THRESHOLD = 4
const GOOGLE_FALLBACK_DEBOUNCE_MS = 500

const RECENT_KEY = 'recentSearches'

const Search = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { currentUser } = useAuth()
  const { openHubModal, openListModal, openProfileModal } = useNavigation()
  const { openSaveModal } = useModal()
  const { searchQuery, setSearchQuery, displayResults, isSearching, performSearch } = useSearch()

  const [popularTags, setPopularTags] = useState<string[]>([])
  const [recents, setRecents] = useState<string[]>([])
  const [googleResults, setGoogleResults] = useState<PlaceLite[]>([])
  const [googleLoading, setGoogleLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const placeRefs = useRef<Record<string, Place | (PlaceLite & { source: 'google' })>>({})
  const googleAbortRef = useRef<AbortController | null>(null)

  // Hydrate from URL ?q=
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const q = (params.get('q') || '').trim()
    if (q && q !== searchQuery) {
      setSearchQuery(q)
      performSearch(q)
    }
  }, [location.search])

  useEffect(() => {
    firebaseDataService.getPopularTags(20).then(setPopularTags).catch(() => {})
    try {
      // localStorage so recents survive across sessions, not just the tab.
      const r = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]')
      if (Array.isArray(r)) setRecents(r)
    } catch {
      // bad JSON; ignore
    }
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [])

  // Debounced auto-search: fire performSearch ~300ms after the user stops
  // typing. Without this, results never appear unless the user presses Enter.
  useEffect(() => {
    const q = searchQuery.trim()
    if (!q) return
    const t = window.setTimeout(() => { performSearch(q) }, 300)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery])

  const submit = (q: string) => {
    const trimmed = q.trim()
    if (!trimmed) return
    setSearchQuery(trimmed)
    performSearch(trimmed)
    try {
      const next = [trimmed, ...recents.filter(r => r !== trimmed)].slice(0, 8)
      localStorage.setItem(RECENT_KEY, JSON.stringify(next))
      setRecents(next)
    } catch (e) {
      console.warn('[search] failed to persist recents', e)
    }
    navigate(`/search?q=${encodeURIComponent(trimmed)}`, { replace: true })
  }

  const internalPlaces = useMemo(() => {
    const arr = (displayResults as { places?: unknown[] }).places || []
    return arr.map((entry) => {
      const p = ('item' in (entry as Record<string, unknown>) ? (entry as { item: Place }).item : entry) as Place & {
        primaryType?: string
        types?: string[]
        photos?: { name: string }[]
        mainImage?: string
        hubImage?: string
        coverImage?: string
        coordinates?: { lat?: number; lng?: number; latitude?: number; longitude?: number }
        address?: string
      }
      placeRefs.current[p.id] = p
      const item: DiscoveryCardItem = {
        id: p.id,
        kind: 'place',
        title: p.name,
        subtitle: p.address,
        primaryType: p.primaryType,
        types: p.types,
        photos: p.photos,
        imageUrl: p.mainImage || p.hubImage || p.coverImage || undefined,
      }
      return { item, raw: p }
    })
  }, [displayResults])

  const internalIdSet = useMemo(() => new Set(internalPlaces.map(p => p.item.id)), [internalPlaces])

  // Google fallback: when internal results for the typed query are thin, fetch
  // matching places from Google and merge them into the Places section. Lets
  // the user search for "H Mart" and save it even if no one's claimed it yet.
  useEffect(() => {
    const q = searchQuery.trim()
    if (!q) {
      setGoogleResults([])
      googleAbortRef.current?.abort()
      return
    }

    if (isSearching) return
    if (internalPlaces.length >= MIN_INTERNAL_PLACES_THRESHOLD) {
      setGoogleResults([])
      return
    }

    googleAbortRef.current?.abort()
    const controller = new AbortController()
    googleAbortRef.current = controller

    const timer = setTimeout(async () => {
      try {
        setGoogleLoading(true)
        const eff = currentUser ? await firebaseDataService.getEffectiveLocation(currentUser.id) : null
        if (controller.signal.aborted) return
        const results = await googleSearchText(q, eff ? { lat: eff.lat, lng: eff.lng, max: 12 } : { max: 12 })
        if (controller.signal.aborted) return
        const filtered = results.filter(r => !internalIdSet.has(r.id))
        setGoogleResults(filtered)
      } catch (e) {
        if (!controller.signal.aborted) console.warn('[search] google fallback failed', e)
      } finally {
        if (!controller.signal.aborted) setGoogleLoading(false)
      }
    }, GOOGLE_FALLBACK_DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [searchQuery, isSearching, internalPlaces.length, currentUser?.id])

  const googlePlaces = useMemo(() => {
    return googleResults.map(p => {
      const tagged: PlaceLite & { source: 'google' } = { ...p, source: 'google' }
      placeRefs.current[p.id] = tagged
      const meta: string | undefined = p.address
      const item: DiscoveryCardItem = {
        id: p.id,
        kind: 'place',
        title: p.name,
        subtitle: meta,
        primaryType: p.primaryType,
        types: p.types,
        photos: p.photos,
        imageUrl: (p as Place & { mainImage?: string }).mainImage || undefined,
      }
      return { item, raw: tagged }
    })
  }, [googleResults])

  const places = useMemo(() => [...internalPlaces, ...googlePlaces], [internalPlaces, googlePlaces])

  const lists = useMemo(() => {
    const arr = (displayResults as { lists?: unknown[] }).lists || []
    return arr.map((entry) => {
      const l = ('item' in (entry as Record<string, unknown>) ? (entry as { item: List }).item : entry) as List & { hubs?: unknown[]; coverImage?: string }
      const item: DiscoveryCardItem = {
        id: l.id,
        kind: 'list',
        title: l.name,
        subtitle: `${(l.hubs as unknown[] | undefined)?.length || 0} places`,
        imageUrl: l.coverImage,
      }
      return { item, raw: l }
    })
  }, [displayResults])

  const users = useMemo(() => {
    const arr = (displayResults as { users?: unknown[] }).users || []
    return arr.map((entry) => {
      const u = ('item' in (entry as Record<string, unknown>) ? (entry as { item: User }).item : entry) as User & { bio?: string; avatar?: string }
      return { id: u.id, title: u.name || 'User', bio: u.bio || '', avatar: u.avatar, raw: u }
    })
  }, [displayResults])

  const hasQuery = searchQuery.trim().length > 0
  const hasResults = places.length + lists.length + users.length > 0

  const handleSavePlace = (it: DiscoveryCardItem) => {
    const p = placeRefs.current[it.id]
    if (!p) return
    const hubLike: Record<string, unknown> = {
      id: p.id,
      name: p.name,
      address: (p as { address?: string }).address || '',
      location: { address: (p as { address?: string }).address || '' },
      tags: ((p as unknown as { tags?: string[] }).tags) || [],
      posts: [],
    }
    // SaveModal's onSave handler in App.tsx calls ensureHubFromPlace, so a
    // Google candidate transparently becomes a hub on save.
    try { openSaveModal(hubLike as never) } catch { /* save modal optional */ }
  }

  return (
    <div className="min-h-full relative overflow-x-hidden">
      <PageWatermark variant="branch" anchor="top-right" size={240} opacity={0.20} />
      <header className="sticky top-0 z-30 bg-paper/95 backdrop-blur-md">
        <div className="px-5 pt-5 pb-4">
          <p className="label-eyebrow text-ink-mute mb-2">Search</p>
          <div className="flex items-center gap-2 h-12 px-4 rounded-full bg-card border border-edge focus-within:border-ink/40 transition-colors">
            <MagnifyingGlassIcon className="w-[18px] h-[18px] text-ink-mute shrink-0" />
            <input
              ref={inputRef}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submit(searchQuery) }}
              placeholder="Try “h mart”, “coffee”, “Anna”…"
              className="flex-1 bg-transparent outline-none text-[15px] text-ink placeholder:text-ink-mute"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => { setSearchQuery(''); navigate('/search', { replace: true }) }}
                className="text-ink-mute hover:text-ink"
                aria-label="Clear"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
        <div className="border-b border-edge mx-5" />
      </header>

      <div className="px-5 pt-5 pb-12">
        {!hasQuery ? (
          <div>
            {recents.length > 0 && (
              <section className="mb-8">
                <h3 className="label-eyebrow text-ink-mute mb-3">Recent</h3>
                <ul className="divide-y divide-edge border-y border-edge">
                  {recents.slice(0, 6).map(r => (
                    <li key={r}>
                      <button
                        type="button"
                        onClick={() => submit(r)}
                        className="w-full flex items-center gap-3 py-3 text-left hover:text-accent transition-colors"
                      >
                        <MagnifyingGlassIcon className="w-4 h-4 text-ink-mute shrink-0" />
                        <span className="font-display-italic text-[18px] text-ink truncate">{r}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {popularTags.length > 0 && (
              <section>
                <h3 className="label-eyebrow text-ink-mute mb-3">Popular</h3>
                <div className="flex flex-wrap gap-1.5">
                  {popularTags.slice(0, 16).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => submit(t)}
                      className="px-3.5 h-8 rounded-full bg-card border border-edge label-eyebrow text-ink-soft hover:bg-ink hover:text-paper hover:border-ink transition-colors"
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </section>
            )}

            {recents.length === 0 && popularTags.length === 0 && (
              <p className="font-display-italic text-[20px] text-ink-mute text-center mt-12">Start typing to search.</p>
            )}
          </div>
        ) : isSearching ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="animate-pulse aspect-[5/6] rounded-[14px] bg-paper-deep" />
            ))}
          </div>
        ) : !hasResults ? (
          <div className="text-center py-20">
            <p className="font-display text-[28px] text-ink leading-tight">No matches.</p>
            <p className="text-[13px] text-ink-soft mt-2">Try a different word, or browse Explore.</p>
          </div>
        ) : (
          <div className="space-y-9">
            {places.length > 0 && (
              <section>
                <div className="flex items-baseline justify-between mb-4">
                  <h3 className="label-eyebrow text-ink">
                    Places <span className="text-ink-mute">· {places.length}</span>
                  </h3>
                  {googlePlaces.length > 0 && (
                    <span className="font-mono text-[10px] tracking-[0.10em] uppercase text-accent">
                      {internalPlaces.length === 0 ? 'fresh from google' : `+${googlePlaces.length} from google`}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {places.map(({ item, raw }) => (
                    <DiscoveryCard
                      key={item.id}
                      item={item}
                      onOpen={() => openHubModal(raw as Place, 'search')}
                      onSave={() => handleSavePlace(item)}
                      variant="compact"
                    />
                  ))}
                </div>
                {googleLoading && googlePlaces.length === 0 && internalPlaces.length < MIN_INTERNAL_PLACES_THRESHOLD && (
                  <p className="font-mono text-[10px] tracking-[0.12em] uppercase text-center text-ink-mute mt-4">Looking for more…</p>
                )}
              </section>
            )}

            {lists.length > 0 && (
              <section>
                <h3 className="label-eyebrow text-ink mb-4">
                  Lists <span className="text-ink-mute">· {lists.length}</span>
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {lists.map(({ item, raw }) => (
                    <DiscoveryCard
                      key={item.id}
                      item={item}
                      onOpen={() => openListModal(raw, 'search')}
                      variant="compact"
                    />
                  ))}
                </div>
              </section>
            )}

            {users.length > 0 && (
              <section>
                <h3 className="label-eyebrow text-ink mb-4">
                  People <span className="text-ink-mute">· {users.length}</span>
                </h3>
                <ul className="divide-y divide-edge border-y border-edge">
                  {users.map(u => (
                    <li key={u.id}>
                      <button
                        type="button"
                        onClick={() => openProfileModal(u.id, 'search')}
                        className="w-full flex items-center gap-3.5 py-3.5 text-left hover:bg-paper-deep -mx-1 px-1 transition-colors"
                      >
                        <span className="shrink-0 w-11 h-11 rounded-full overflow-hidden bg-paper-deep ring-1 ring-edge">
                          {u.avatar ? (
                            <img src={u.avatar} alt={u.title} className="w-full h-full object-cover" />
                          ) : (
                            <span className="w-full h-full flex items-center justify-center font-mono text-[11px] tracking-wider text-ink-soft">
                              {u.title.slice(0, 2).toUpperCase()}
                            </span>
                          )}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-[15px] font-medium text-ink truncate">{u.title}</span>
                          {u.bio && <span className="block text-[12px] text-ink-soft truncate mt-0.5">{u.bio}</span>}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default Search
