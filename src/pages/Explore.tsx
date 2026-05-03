import { useEffect, useMemo, useRef, useState } from 'react'
import AppHeader from '../components/ui/AppHeader'
import SearchOverlay from '../components/ui/SearchOverlay'
import DiscoveryCard, { type DiscoveryCardItem } from '../components/ui/DiscoveryCard'
import PageWatermark from '../components/ui/PageWatermark'
import { useAuth } from '../contexts/AuthContext'
import { useNavigation } from '../contexts/NavigationContext'
import { useModal } from '../contexts/ModalContext'
import { firebaseDataService } from '../services/firebaseDataService'
import type { Place, List, User } from '../types/index.js'

type FeedItem = DiscoveryCardItem & {
  raw: Place | List | User
  itemKind: 'place' | 'list' | 'user'
  isExternal?: boolean
}

const FILTER_KEYS = ['all', 'open', 'nearby', 'lists', 'friends'] as const
type FilterKey = (typeof FILTER_KEYS)[number]

const FILTER_LABELS: Record<FilterKey, string> = {
  all: 'All',
  open: 'Open now',
  nearby: 'Nearby',
  lists: 'Lists',
  friends: 'Friends',
}

const Explore = () => {
  const { currentUser } = useAuth()
  const { openHubModal, openListModal, openProfileModal } = useNavigation()
  const { openSaveModal } = useModal()

  const [items, setItems] = useState<FeedItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<FilterKey>('all')
  const [searchOpen, setSearchOpen] = useState(false)
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [popularTags, setPopularTags] = useState<string[]>([])
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const cacheRef = useRef<Record<string, { t: number; items: FeedItem[] }>>({})

  useEffect(() => {
    if (!currentUser) return
    void load(filter)
    firebaseDataService.getPopularTags(20).then(setPopularTags).catch(() => {})
    try {
      const r = JSON.parse(localStorage.getItem('recentSearches') || '[]')
      if (Array.isArray(r)) setRecentSearches(r)
    } catch {}
  }, [currentUser, filter])

  const load = async (key: FilterKey) => {
    if (!currentUser) return
    const cacheKey = `feed:${key}`
    const cached = cacheRef.current[cacheKey]
    if (cached && Date.now() - cached.t < 2 * 60 * 1000) {
      setItems(cached.items)
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    try {
      const eff = await firebaseDataService.getEffectiveLocation(currentUser.id)
      let feed: FeedItem[] = []

      if (key === 'lists') {
        const search = await firebaseDataService.performSearch('', {}, 24)
        const lists = search.lists || []
        feed = lists.slice(0, 24).map(l => ({
          id: l.id,
          kind: 'list',
          itemKind: 'list',
          title: l.name,
          subtitle: `${(l as any).hubs?.length || 0} places`,
          imageUrl: (l as any).coverImage || (l as any).hubs?.[0]?.mainImage,
          raw: l as any,
        }))
      } else if (key === 'friends') {
        try {
          const following = currentUser ? await firebaseDataService.getUserFollowing(currentUser.id) : []
          feed = (following || []).map((u: any) => ({
            id: u.id,
            kind: 'user',
            itemKind: 'user',
            title: u.name || u.username || 'User',
            subtitle: u.bio || '',
            imageUrl: u.avatar,
            raw: u as User,
          }))
        } catch {
          feed = []
        }
      } else {
        const internal = await firebaseDataService.getSuggestedPlaces({ limit: 18 })
        let external: any[] = []
        if (eff) {
          external = await firebaseDataService.getBatchedExternalRecommendations(eff.lat, eff.lng, { limit: 18 })
        }
        const merged = [...internal, ...external]
        const seen = new Set<string>()
        const unique = merged.filter((p: any) => {
          const k = (p.id || '') + '|' + (p.name || '')
          if (seen.has(k)) return false
          seen.add(k)
          return true
        })
        feed = unique.map((p: any) => {
          const c = p.coordinates || p.location || {}
          const lat = typeof c.lat === 'number' ? c.lat : c.latitude
          const lng = typeof c.lng === 'number' ? c.lng : c.longitude
          const distanceKm = eff && typeof lat === 'number' && typeof lng === 'number'
            ? firebaseDataService.distanceKm({ lat, lng }, { lat: eff.lat, lng: eff.lng })
            : undefined
          return {
            id: p.id,
            kind: 'place',
            itemKind: 'place',
            title: p.name,
            subtitle: p.address,
            primaryType: p.primaryType,
            types: p.types,
            photos: p.photos,
            imageUrl: p.mainImage || p.hubImage || p.coverImage || undefined,
            distanceKm,
            savedCount: p.savedCount,
            postCount: Array.isArray(p.posts) ? p.posts.length : undefined,
            isExternal: p.source === 'google',
            raw: p as Place,
          }
        })
        if (key === 'nearby') {
          // True filter: only places within ~10km of the user. Without this
          // the toggle was just sorting the same global pool, which made it
          // indistinguishable from "All".
          const NEARBY_MAX_KM = 10
          feed = feed
            .filter(it => typeof it.distanceKm === 'number' && (it.distanceKm as number) <= NEARBY_MAX_KM)
            .sort((a, b) => (a.distanceKm || 0) - (b.distanceKm || 0))
        } else if (key === 'open') {
          feed = feed.filter(it => (it.raw as any)?.openNow === true)
        }
      }

      cacheRef.current[cacheKey] = { t: Date.now(), items: feed }
      setItems(feed)
    } catch (e) {
      console.error('[explore] load failed', e)
      setItems([])
    } finally {
      setIsLoading(false)
    }
  }

  const filtered = useMemo(() => items, [items])

  const handleOpen = (it: FeedItem) => {
    if (it.itemKind === 'place') openHubModal(it.raw as Place, 'explore')
    else if (it.itemKind === 'list') openListModal(it.raw as List, 'explore')
    else openProfileModal((it.raw as User).id, 'explore')
  }

  const handleSave = (it: FeedItem) => {
    if (it.itemKind === 'place') {
      const p = it.raw as Place
      const hubLike: any = {
        id: p.id,
        name: p.name,
        location: { address: (p as any).address || '' },
        tags: (p as any).tags || [],
        posts: [],
      }
      try { openSaveModal(hubLike) } catch {}
      setSavedIds(prev => new Set(prev).add(it.id))
    }
  }

  return (
    <div className="min-h-full relative overflow-x-hidden">
      <PageWatermark variant="bouquet" anchor="bottom-left" size={320} opacity={0.18} flip />
      <AppHeader
        title="Where to next."
        eyebrow="Discover"
        subtitle="Places near you, hand-picked and worth the trip."
        onSearchFocus={() => setSearchOpen(true)}
      />

      <div className="px-5 pt-4 pb-3 sticky top-[152px] z-20 bg-paper/90 backdrop-blur-md">
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-5 px-5">
          {FILTER_KEYS.map(k => {
            const active = filter === k
            return (
              <button
                key={k}
                type="button"
                onClick={() => setFilter(k)}
                className={`shrink-0 h-8 px-3.5 rounded-full label-eyebrow transition-colors ${
                  active
                    ? 'bg-ink text-paper'
                    : 'bg-transparent text-ink-soft hover:text-ink border border-edge'
                }`}
              >
                {FILTER_LABELS[k]}
              </button>
            )
          })}
        </div>
      </div>

      <div className="px-5 pt-5 pb-12">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="animate-pulse aspect-[5/6] rounded-[14px] bg-paper-deep" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <p className="font-display text-[28px] text-ink leading-tight">Nothing here.</p>
            <p className="text-[13px] text-ink-soft mt-2">Try a different filter, or set your location in your profile.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map(it => (
              <DiscoveryCard
                key={it.id}
                item={{ ...it, saved: savedIds.has(it.id) }}
                onOpen={() => handleOpen(it)}
                onSave={it.itemKind === 'place' ? () => handleSave(it) : undefined}
                variant="compact"
              />
            ))}
          </div>
        )}
      </div>

      <SearchOverlay
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        recentSearches={recentSearches}
        popularTags={popularTags}
      />
    </div>
  )
}

export default Explore
