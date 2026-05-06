import { useEffect, useMemo, useRef, useState } from 'react'
import AppHeader from '../components/ui/AppHeader'
import SearchOverlay from '../components/ui/SearchOverlay'
import DiscoveryCard, { type DiscoveryCardItem } from '../components/ui/DiscoveryCard'
import PageWatermark from '../components/ui/PageWatermark'
import { useAuth } from '../contexts/AuthContext'
import { useNavigation } from '../contexts/NavigationContext'
import { useModal } from '../contexts/ModalContext'
import { firebaseDataService } from '../services/firebaseDataService'
import { readCoords } from '../utils/coords'
import type { Place, List, User } from '../types/index.js'

type FeedItem = DiscoveryCardItem & {
  raw: Place | List | User
  itemKind: 'place' | 'list' | 'user'
  isExternal?: boolean
}

// 'open' (Open now) was dropped because the field it gated on (`openNow`) is
// never populated by the suggested-places or external-recommendations APIs.
// The tab returned an empty result every time. Re-add it once the upstream
// field is actually plumbed in.
const FILTER_KEYS = ['all', 'nearby', 'lists', 'friends'] as const
type FilterKey = (typeof FILTER_KEYS)[number]

const FILTER_LABELS: Record<FilterKey, string> = {
  all: 'All',
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
        // Internal results come from our places collection; external results
        // come from Google. The same place can appear in both (a Google
        // candidate that's already been claimed by some user). Their ids are
        // different, so id-only dedup misses the duplicate. Add a normalised
        // name+address fingerprint and prefer the internal record.
        const merged = [...internal, ...external]
        const seenIds = new Set<string>()
        const seenFingerprints = new Set<string>()
        const fingerprint = (p: any) => {
          const name = String(p?.name || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
          const addr = String(p?.address || p?.location?.address || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
          return name && addr ? `${name}|${addr.slice(0, 24)}` : ''
        }
        const unique = merged.filter((p: any) => {
          const id = p.id || ''
          if (id && seenIds.has(id)) return false
          const fp = fingerprint(p)
          if (fp && seenFingerprints.has(fp)) return false
          if (id) seenIds.add(id)
          if (fp) seenFingerprints.add(fp)
          return true
        })
        feed = unique.map((p: any) => {
          const coords = readCoords(p)
          const distanceKm = eff && coords
            ? firebaseDataService.distanceKm(coords, { lat: eff.lat, lng: eff.lng })
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
      const p = it.raw as Place & {
        address?: string
        location?: { address?: string; lat?: number; lng?: number }
        coordinates?: { lat?: number; lng?: number }
        photos?: { name: string }[]
        primaryType?: string
        types?: string[]
        mainImage?: string
      }
      const hubLike: Record<string, unknown> = {
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
      try { openSaveModal(hubLike as never) } catch (e) { console.warn('[explore] openSaveModal failed', e) }
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
