import type { List, ListPlace, Hub, Place } from '../types/index.js'
import { MapPinIcon, HeartIcon, BookmarkIcon, ShareIcon, EllipsisHorizontalIcon, ArrowLeftIcon, StarIcon, MapIcon, MagnifyingGlassIcon, CameraIcon } from '@heroicons/react/24/outline'
import { useState, useEffect, useRef, Fragment } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useNavigation } from '../contexts/NavigationContext.tsx'
import PlusDropdown from '../components/PlusDropdown'
import HubSearchModal from '../components/HubSearchModal'
import SaveModal from '../components/SaveModal'
import CreatePost from '../components/CreatePost'
import EmbedFromModal from '../components/EmbedFromModal'
import ListMenuDropdown from '../components/ListMenuDropdown'
import EditListModal from '../components/EditListModal'
import EditPlaceModal from '../components/EditPlaceModal'
import ConfirmModal from '../components/ConfirmModal'
import PrivacyModal from '../components/PrivacyModal'
// SearchAndFilter removed in UX refresh — replaced by inline editorial input
import { firebaseListService } from '../services/firebaseListService';
import { firebaseDataService } from '../services/firebaseDataService';
import { useAuth } from '../contexts/AuthContext'
import { useFilters } from '../contexts/FiltersContext'
import { PageHeader } from '../components/primitives/PageHeader'
import { ActionBar } from '../components/primitives/ActionBar'
import { CardShell } from '../components/primitives/CardShell'
import { MapCalloutCard } from '../components/primitives/MapCalloutCard'
import HubImage from '../components/HubImage'
import ListMap from '../components/ListMap'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { formatTimestamp } from '../utils/dateUtils'
import { tripBadge } from '../utils/listHelpers'
import { haptics } from '../utils/haptics'
import { listShareUrl } from '../utils/share'
import { rankingService, sentimentBucket } from '../services/rankingService'

const ListView = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { openHubModal, goBack } = useNavigation()
  const { currentUser } = useAuth()
  const [list, setList] = useState<List | null>(null)
  const [creatorName, setCreatorName] = useState<string>('')
  const [listPlaces, setListPlaces] = useState<(ListPlace & { status: 'want' | 'tried' | 'loved', feeling?: 'amazing' | 'good' | 'okay' | 'disappointing' })[]>([])
  const [isLiked, setIsLiked] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const [showMapModal, setShowMapModal] = useState(false)
  const [showFullImage, setShowFullImage] = useState(false)
  const [cardMenuOpen, setCardMenuOpen] = useState<string | null>(null)
  const [showHubSearchModal, setShowHubSearchModal] = useState(false)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [showCreatePost, setShowCreatePost] = useState(false)
  const [showEmbedFromModal, setShowEmbedFromModal] = useState(false)
  const [hubToSave, setHubToSave] = useState<Hub | null>(null)
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null)
  const [showListMenu, setShowListMenu] = useState(false)
  const [showEditListModal, setShowEditListModal] = useState(false)
  const [showEditPlaceModal, setShowEditPlaceModal] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [showPrivacyModal, setShowPrivacyModal] = useState(false)
  const [selectedPlaceToEdit, setSelectedPlaceToEdit] = useState<any>(null)
  const [selectedPlaceToRemove, setSelectedPlaceToRemove] = useState<any>(null)
  const [confirmModalConfig, setConfirmModalConfig] = useState({
    title: '',
    message: '',
    onConfirm: () => {}
  })
  const listMenuButtonRef = useRef<HTMLButtonElement>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'places' | 'posts' | 'map'>('places')
  const [mapCalloutPlace, setMapCalloutPlace] = useState<ListPlace | null>(null)
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null)
  
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('popular')
  const [activeFilters, setActiveFilters] = useState<string[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [recommended, setRecommended] = useState<Place[]>([])
  const [showAdvanced, setShowAdvanced] = useState(false)
  const { filters, setFilters } = useFilters()

  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'not-found' | 'error'>('loading')
  const [myScores, setMyScores] = useState<Record<string, number>>({})

  // The viewer's personal place scores (Beli loop) → a badge on each row.
  useEffect(() => {
    if (!currentUser) return
    let cancelled = false
    const load = () => rankingService.getScores(currentUser.id).then(s => { if (!cancelled) setMyScores(s) }).catch(() => {})
    void load()
    const onRanked = () => { rankingService.invalidate(currentUser.id); void load() }
    window.addEventListener('this-is:ranked', onRanked)
    return () => { cancelled = true; window.removeEventListener('this-is:ranked', onRanked) }
  }, [currentUser?.id])

  useDocumentTitle(
    list?.name,
    list ? `${list.name}${creatorName ? ` by ${creatorName}` : ''}${list.description ? ` — ${list.description.slice(0, 120)}` : ''}` : null,
  )

  const fetchList = async () => {
    if (!id) {
      setLoadState('not-found')
      return
    }
    setLoadState('loading')
    try {
      const fetchedList = await firebaseListService.getList(id)
      if (!fetchedList) {
        setList(null)
        setLoadState('not-found')
        return
      }
      setList(fetchedList)
      const places = await firebaseListService.getPlacesForList(id)
      setListPlaces(places.map(p => ({ ...p, status: 'loved' })))
      // Self-heal saved places that have no coordinates (old save path dropped
      // Google's lat/lng) so the list map can actually pin them. Bounded +
      // writes coords back to the doc, so it's a one-time cost per place.
      const missing = places.map(p => p.place).filter(pl => pl && !pl.coordinates)
      if (missing.length > 0) {
        firebaseDataService.backfillMissingCoords(missing as never[]).then(patched => {
          if (patched.size === 0) return
          setListPlaces(prev => prev.map(lp =>
            lp.place && patched.has(lp.place.id)
              ? { ...lp, place: { ...lp.place, coordinates: patched.get(lp.place.id)! } }
              : lp
          ))
        }).catch(() => {})
      }
      if (fetchedList.userId) {
        try {
          const name = await firebaseDataService.getUserDisplayName(fetchedList.userId)
          setCreatorName(name)
        } catch {
          /* creator name is decorative; ignore */
        }
      }
      setLoadState('ready')
    } catch (e) {
      console.error('[list-view] fetch failed', e)
      setLoadState('error')
    }
  }

  useEffect(() => {
    void fetchList()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // Refresh when a save targets this list (or any save — cheap to refetch).
  useEffect(() => {
    if (!id) return
    const onSaved = () => {
      // Refresh on any save — the place may have been added to or removed
      // from any list, and we don't always get listIds in the event detail.
      void fetchList()
    }
    window.addEventListener('this-is:saved', onSaved)
    return () => window.removeEventListener('this-is:saved', onSaved)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // Sync selectedTags with global FiltersContext
  useEffect(()=>{ setSelectedTags(filters.tags || []) }, [filters.tags])

  // Debounce search query
  useEffect(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
    searchDebounceRef.current = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 400);
    
    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, [searchQuery])

  // Load recommendations for this list based on its tags
  useEffect(() => {
    const load = async () => {
      const tags = selectedTags.length > 0 ? selectedTags : (list?.tags || [])
      try {
        const places = await firebaseDataService.getSuggestedPlaces({ tags, limit: 12 })
        setRecommended(places)
      } catch { setRecommended([]) }
    }
    load()
  }, [list?.id, selectedTags])

  // Parallax banner effect
  const bannerRef = useRef<HTMLDivElement | null>(null)
  const [scrollY, setScrollY] = useState(0)
  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (list && currentUser) {
      setIsLiked(list.likedBy?.includes(currentUser.id) || false)
      // Check if user has saved this list
      firebaseListService.isListSaved(list.id, currentUser.id).then(setIsSaved)
    }
  }, [list, currentUser])

  // Search and filter options - using standard options from other pages
  const sortOptions = [
    { key: 'relevance', label: 'Relevance' },
    { key: 'popular', label: 'Most Popular' },
    { key: 'recent', label: 'Most Recent' },
    { key: 'nearby', label: 'Closest to Location' },
  ]

  const filterOptions = [
    { key: 'coffee', label: 'Coffee' },
    { key: 'food', label: 'Food' },
    { key: 'work-friendly', label: 'Work-Friendly' },
  ]

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    )
  }

  // Scroll to top when component mounts or when id changes
  useEffect(() => {
    // Force scroll to top with multiple methods
    const scrollToTop = () => {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
      if (document.documentElement) {
        document.documentElement.scrollTop = 0
      }
      if (document.body) {
        document.body.scrollTop = 0
      }
    }
    
    // Try immediately
    scrollToTop()
    
    // Try after DOM is ready
    requestAnimationFrame(scrollToTop)
    
    // Try after a short delay
    const timer = setTimeout(scrollToTop, 100)
    
    return () => clearTimeout(timer)
  }, [id])
  
  // Get all unique tags from places for filtering
  const allTags = Array.from(new Set(
    listPlaces.flatMap(place => place.place.tags)
  )).sort()

  const availableTags = allTags.length > 0 ? allTags : ['coffee', 'cozy', 'work-friendly', 'tacos', 'authentic', 'quick', 'outdoors', 'scenic']

  // Filter and sort places
  const filteredPlaces = listPlaces.filter(place => {
    // Search filter (using debounced query)
    if (debouncedSearchQuery) {
      const query = debouncedSearchQuery.toLowerCase()
      const matchesName = place.place.name.toLowerCase().includes(query)
      const matchesAddress = place.place.address.toLowerCase().includes(query)
      const matchesTags = place.place.tags.some(tag => tag.toLowerCase().includes(query))
      const matchesNote = place.note?.toLowerCase().includes(query)
      
      if (!matchesName && !matchesAddress && !matchesTags && !matchesNote) {
        return false
      }
    }

    // Tag-based filter (using standard filter options)
    if (activeFilters.length > 0) {
      const hasMatchingFilter = activeFilters.some(filter => {
        switch (filter) {
          case 'coffee':
            return place.place.tags.includes('coffee')
          case 'food':
            return place.place.tags.some(tag => ['food', 'tacos', 'restaurant', 'cafe', 'dining'].includes(tag))
          case 'work-friendly':
            return place.place.tags.includes('work-friendly')
          default:
            return place.place.tags.includes(filter)
        }
      })
      if (!hasMatchingFilter) {
        return false
      }
    }

    // Tag filter
    if (selectedTags.length > 0) {
      if (!selectedTags.some(tag => place.place.tags.includes(tag))) {
        return false
      }
    }

    return true
  })

  // Sort places. A trip keeps its ITINERARY order (the order places were added,
  // i.e. the list's hubs[] order that getPlacesForList preserves) rather than
  // re-sorting by popularity/recency.
  const sortedPlaces = list?.isTrip
    ? filteredPlaces
    : [...filteredPlaces].sort((a, b) => {
        switch (sortBy) {
          case 'popular':
            return (b.place.savedCount || 0) - (a.place.savedCount || 0)
          case 'recent':
            return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime()
          case 'nearby':
            // For now, just sort by name since we don't have location data
            // In a real app, this would sort by distance from user's location
            return a.place.name.localeCompare(b.place.name)
          default:
            return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime()
        }
      })

  const getStatusColor = (status: string, feeling?: string) => {
    switch (status) {
      case 'loved':
        return 'bg-accent-soft text-accent-deep border-edge'
      case 'tried':
        switch (feeling) {
          case 'amazing':
            return 'bg-emerald-100 text-emerald-700 border-emerald-200'
          case 'good':
            return 'bg-paper-deep text-ink border-edge'
          case 'okay':
            return 'bg-amber-100 text-amber-700 border-amber-200'
          case 'disappointing':
            return 'bg-red-100 text-red-700 border-red-200'
          default:
            return 'bg-paper-deep text-ink border-edge'
        }
      case 'want':
        return 'bg-card text-ink-soft border-edge'
      default:
        return 'bg-card text-ink-mute border-edge'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'loved':
        return <HeartIcon className="w-4 h-4 fill-current" />
      case 'tried':
        return <StarIcon className="w-4 h-4 fill-current" />
      case 'want':
        return <BookmarkIcon className="w-4 h-4" />
      default:
        return <BookmarkIcon className="w-4 h-4" />
    }
  }

  const handlePlaceClick = (listPlace: ListPlace) => {
    // Convert Place to Hub format
    const hub: Hub = {
      id: listPlace.place.id,
      name: listPlace.place.name,
      description: `A great place to visit in ${listPlace.place.address}`,
      tags: listPlace.place.tags,
      images: (listPlace.place as any).mainImage ? [(listPlace.place as any).mainImage] : [],
      location: {
        address: listPlace.place.address,
        lat: listPlace.place.coordinates?.lat || 37.7749,
        lng: listPlace.place.coordinates?.lng || -122.4194,
      },
      googleMapsUrl: `https://www.google.com/maps/search/${encodeURIComponent(listPlace.place.name + ' ' + listPlace.place.address)}`,
      mainImage: (listPlace.place as any).mainImage,
      posts: listPlace.place.posts,
      lists: [],
    }
    openHubModal(hub, 'list-view')
  }

  // Check if current user owns this list
  const isOwner = list?.userId === currentUser?.id

  const handleCreatePost = () => {
    setShowCreatePost(true)
  }

  const handleSaveHub = () => {
    setShowHubSearchModal(true)
  }

  const handleEmbedFrom = () => {
    setShowEmbedFromModal(true)
  }

  // Embed posts are created inside EmbedFromModal itself (it calls
  // firebasePostService.createEmbedPost and dispatches this-is:posted).
  // No additional handler needed here — the listener that refreshes posts
  // on the post-event picks it up.

  const handleSaveToPlace = (place: Place) => {
    setSelectedPlace(place)
    setShowSaveModal(true)
  }

  const handleHubSelected = (hub: Hub) => {
    setHubToSave(hub)
    setShowHubSearchModal(false)
    setShowSaveModal(true)
  }

  const handleSave = async (status: 'loved' | 'tried' | 'want', rating?: 'liked' | 'neutral' | 'disliked', listIds?: string[], note?: string) => {
    if (!hubToSave || !currentUser) { setShowSaveModal(false); setHubToSave(null); return }
    const place = hubToSave
    const ids = Array.isArray(listIds) ? listIds : []
    try {
      // Save to EVERY picked list (was only listIds[0] — extra picks were
      // silently dropped), then run the same side-effects as the global save
      // pipeline so the save mirror/savedCount, taste model, and listeners all
      // stay in sync (previously this bespoke path skipped all of them).
      for (const lid of ids) {
        await firebaseListService.savePlaceToList(place.id, lid, currentUser.id, note, status, rating)
      }
      await firebaseDataService.recordStatusSave(currentUser.id, place.id, status, rating, note)
      await firebaseDataService.recordUserSave(place.id, currentUser.id, firebaseDataService.placeSignals(place))
      firebaseDataService.recordTasteFromPlace(
        currentUser.id,
        place as { id?: string; primaryType?: string | null; types?: string[]; category?: string; tags?: string[]; name?: string },
        status === 'loved' ? 3 : status === 'tried' ? 2 : 1.5,
      )
      window.dispatchEvent(new CustomEvent('this-is:saved', { detail: { placeId: place.id, status } }))
      haptics.success()
      const bucket = sentimentBucket(status, rating)
      window.dispatchEvent(new CustomEvent('this-is:toast', {
        detail: bucket
          ? { message: 'Saved', action: { label: 'Rank it', onClick: () => window.dispatchEvent(new CustomEvent('this-is:rank-place', { detail: { placeId: place.id, name: place.name, bucket } })) } }
          : { message: 'Saved' },
      }))
    } catch (e) {
      console.error('[listview] save failed', e)
      haptics.warn()
      window.dispatchEvent(new CustomEvent('this-is:toast', { detail: { message: "Couldn't save. Try again.", tone: 'error' } }))
    } finally {
      setShowSaveModal(false)
      setHubToSave(null)
    }
  }

  // Assign a trip stop to an itinerary day (null = unschedule). Optimistic.
  const handleSetTripDay = async (placeId: string, day: number | null) => {
    if (!list) return
    setListPlaces(prev => prev.map(lp => lp.placeId === placeId ? { ...lp, tripDay: day ?? undefined } : lp))
    setCardMenuOpen(null)
    try {
      await firebaseListService.updateListPlace(list.id, placeId, { tripDay: day })
    } catch (e) {
      console.error('[list-view] set trip day failed', e)
    }
  }

  const handleShareList = () => {
    if (!list) return
    haptics.tap()
    // Open the in-app share sheet (send to a friend as a DM, or copy link) so a
    // trip is one tap to share with the people you actually travel with.
    window.dispatchEvent(new CustomEvent('this-is:send-to-friend', {
      detail: { title: list.name, url: listShareUrl(list.id) },
    }))
  }

  const handleCreateList = async (listData: { name: string; description: string; privacy: 'public' | 'private' | 'friends'; tags?: string[]; coverImage?: File }) => {
    if (currentUser) {
      const newListId = await firebaseListService.createList({ ...listData, tags: listData.tags || [], userId: currentUser.id })
      if (newListId && hubToSave) {
        await firebaseListService.savePlaceToList(hubToSave.id, newListId, currentUser.id, undefined, 'loved') // Default to loved status
      }
    }
  }

  const handleEditPlace = (listPlace: ListPlace) => {
    setSelectedPlaceToEdit(listPlace)
    setShowEditPlaceModal(true)
    setCardMenuOpen(null)
  }

  const handleRemovePlace = (listPlace: ListPlace) => {
    setSelectedPlaceToRemove(listPlace)
    setConfirmModalConfig({
      title: 'Remove Place',
      message: `Are you sure you want to remove "${listPlace.place.name}" from this list? This action cannot be undone.`,
      onConfirm: async () => {
        if (list) {
          await firebaseListService.removePlaceFromList(list.id, listPlace.place.id)
          setListPlaces(prev => prev.filter(p => p.place.id !== listPlace.place.id))
        }
      }
    })
    setShowConfirmModal(true)
    setCardMenuOpen(null)
  }

  const handleAddFirstPlace = () => {
    // In a real app, this would open the hub search modal
    setShowHubSearchModal(true)
  }

  const handleEditList = () => {
    setShowEditListModal(true)
    setShowListMenu(false)
  }

  const handleChangePrivacy = () => {
    setShowPrivacyModal(true)
    setShowListMenu(false)
  }

  const handlePrivacyChange = async (newPrivacy: 'public' | 'private' | 'friends') => {
    if (list) {
      await firebaseListService.updateList(list.id, { privacy: newPrivacy })
      setList(prev => prev ? { ...prev, privacy: newPrivacy } : null)
    }
  }

  const handleBack = () => {
    goBack()
  }

  const handleDeleteList = () => {
    if (list) {
      setConfirmModalConfig({
        title: 'Delete List',
        message: `Are you sure you want to delete "${list.name}"? This action cannot be undone and will remove all places from this list.`,
        onConfirm: async () => {
          await firebaseListService.deleteList(list.id)
          navigate('/profile')
        }
      })
      setShowConfirmModal(true)
      setShowListMenu(false)
    }
  }
  
  const handleLike = async () => {
    if (!list) return
    if (!currentUser) {
      navigate('/auth')
      return
    }
    await firebaseListService.likeList(list.id, currentUser.id)
    setIsLiked(prev => !prev)
    setList(prev => prev ? { ...prev, likes: isLiked ? (prev.likes || 1) - 1 : (prev.likes || 0) + 1 } : null)
  }

  const handleSaveList = async () => {
    if (!list) return
    if (!currentUser) {
      navigate('/auth')
      return
    }
    await firebaseListService.saveList(list.id, currentUser.id)
    setIsSaved(prev => !prev)
  }

  if (loadState === 'not-found') {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 py-16 text-center">
        <p className="font-display text-[24px] text-ink leading-tight">List not found.</p>
        <p className="text-[13px] text-ink-soft mt-2">It may have been deleted or made private.</p>
        <button onClick={() => navigate('/')} className="btn-secondary mt-5 h-10 px-4 label-eyebrow">Go home</button>
      </div>
    )
  }

  if (loadState === 'error') {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 py-16 text-center">
        <p className="font-display text-[24px] text-ink leading-tight">Couldn't load this list.</p>
        <p className="text-[13px] text-ink-soft mt-2">Check your connection and try again.</p>
        <button onClick={() => void fetchList()} className="btn-cta mt-5 h-10 px-4 label-eyebrow">Retry</button>
      </div>
    )
  }

  if (!list) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div>Loading...</div>
      </div>
    )
  }

  // Trip framing: a date-range badge + the places tab reads as an "Itinerary".
  const trip = tripBadge(list)
  // Multi-day trips group their itinerary by day.
  const tripStartDate = (() => {
    const m = (list.tripStart || '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null
  })()
  const tripDayCount = (() => {
    if (!trip || !tripStartDate) return 1
    const me = (list.tripEnd || '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
    const end = me ? new Date(Number(me[1]), Number(me[2]) - 1, Number(me[3])) : tripStartDate
    return Math.max(1, Math.round((end.getTime() - tripStartDate.getTime()) / 86400000) + 1)
  })()
  const multiDay = !!trip && tripDayCount > 1
  const dayHeaderLabel = (day: number | 'none') => {
    if (day === 'none') return 'Unscheduled'
    const d = new Date(tripStartDate!)
    d.setDate(d.getDate() + (day - 1))
    return `Day ${day} · ${d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`
  }
  // Order by day (stable → keeps itinerary order within a day); unscheduled last.
  const itinerary = multiDay
    ? [...sortedPlaces].sort((a, b) => ((a.tripDay ?? 9999) - (b.tripDay ?? 9999)))
    : sortedPlaces

  return (
    <div className="relative min-h-full overflow-x-hidden">
      {/* PageHeader now uses glass internally, no extra background needed */}
      <PageHeader
        coverUrl={list.coverImage}
        title={list.name}
        subtitle={trip ? `${trip}${creatorName ? ` · by ${creatorName}` : ''}` : `by ${creatorName}`}
        rightActions={
          <button 
            onClick={() => { if (window.history.length > 1) navigate(-1); else handleBack() }}
            className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
            aria-label="Go back"
          >
            <ArrowLeftIcon className="w-5 h-5 text-white" />
          </button>
        }
      />

      {/* List Info */}
      <div className="relative z-10 p-5 space-y-5">
        {/* Editorial tabs */}
        <div className="border-b border-edge flex gap-6">
          {(['overview', 'places', 'posts', 'map'] as const).map(t => {
            const active = activeTab === t
            const count = t === 'places' ? sortedPlaces.length : null
            return (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={`pb-3 label-eyebrow transition-colors ${
                  active ? 'text-ink border-b-2 border-ink -mb-px' : 'text-ink-mute hover:text-ink-soft'
                }`}
                aria-pressed={active}
              >
                {t === 'overview' ? 'Overview' : t === 'places' ? `${trip ? 'Itinerary' : 'Places'}${count !== null ? ` · ${count}` : ''}` : t === 'posts' ? 'Posts' : 'Map'}
              </button>
            )
          })}
        </div>

        {/* List Info - Only show in overview tab */}
        {activeTab === 'overview' && (
        <CardShell variant="glass" className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <button
                onClick={handleLike}
                aria-label={isLiked ? 'Unlike list' : 'Like list'}
                aria-pressed={isLiked}
                className={`p-2 rounded-lg transition glass ${
                  isLiked
                    ? 'text-aurum-300'
                    : 'text-body hover:bg-white/10'
                }`}
              >
                <HeartIcon className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
              </button>
              <button
                onClick={handleSaveList}
                aria-label={isSaved ? 'Unsave list' : 'Save list'}
                aria-pressed={isSaved}
                className={`p-2 rounded-lg transition glass ${
                  isSaved
                    ? 'text-aurum-300'
                    : 'text-body hover:bg-white/10'
                }`}
              >
                <BookmarkIcon className={`w-5 h-5 ${isSaved ? 'fill-current' : ''}`} />
              </button>
              <button onClick={handleShareList} className="p-2 rounded-lg glass text-body hover:bg-white/10 transition press" aria-label="Share list">
                <ShareIcon className="w-5 h-5" />
              </button>
              <button
                onClick={() => setShowMapModal(true)}
                className="p-2 rounded-lg glass text-body hover:bg-white/10 transition"
                aria-label="View all on map"
              >
                <MapIcon className="w-5 h-5" />
              </button>
            </div>
            {isOwner && (
              <button
                ref={listMenuButtonRef}
                onClick={() => setShowListMenu(true)}
                className="p-2 rounded-lg glass text-body hover:bg-white/10 transition"
              >
                <EllipsisHorizontalIcon className="w-5 h-5" />
              </button>
            )}
          </div>
          
          <div className="flex flex-wrap gap-2 mb-3">
            {list.tags.map((tag) => (
              <span
                key={tag}
                className="px-3 py-1 bg-aurum-200/50 text-bark-900 text-sm rounded-full border border-aurum-200/70"
              >
                #{tag}
              </span>
            ))}
          </div>
          
          <div className="flex items-center gap-4 text-sm text-meta">
            <span>{sortedPlaces.length} places</span>
            <span aria-hidden>•</span>
            <span>Updated {formatTimestamp(list.updatedAt)}</span>
          </div>
        </CardShell>
        )}

        {/* Description - Only show in overview tab */}
        {activeTab === 'overview' && list.description && (
          <CardShell variant="glass" className="p-4">
            <h3 className="text-sm font-semibold text-title mb-2">Description</h3>
            <p className="text-body text-sm leading-relaxed">{list.description}</p>
          </CardShell>
        )}
      </div>

      {/* Scoped search - editorial input */}
      {activeTab === 'places' && (
        <div className="relative z-10 px-5 pb-4">
          <div className="flex items-center gap-2 h-11 px-4 rounded-full bg-card border border-edge focus-within:border-ink/40 transition-colors">
            <MagnifyingGlassIcon className="w-[18px] h-[18px] text-ink-mute shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter places in this list"
              className="flex-1 bg-transparent outline-none text-[14px] text-ink placeholder:text-ink-mute"
              aria-label="Search places in this list"
            />
          </div>
        </div>
      )}

      {/* Recommended for your list - Only show in overview tab */}
      {activeTab === 'overview' && recommended.length > 0 && (
        <div className="relative z-10 px-5 pb-3">
          <div className="mb-3">
            <span className="label-eyebrow flex items-center gap-1.5" style={{ color: 'var(--accent-deep)' }}>
              <span className="accent-bead-sm accent-bead" />
              Picked for this list
            </span>
            <h3 className="font-display text-[24px] leading-tight text-ink mt-1.5">
              You might add<span style={{ color: 'var(--accent)' }}>.</span>
            </h3>
            <div className="amber-hairline mt-2 w-12" />
          </div>
          <ul className="divide-y divide-edge border-y border-edge">
            {recommended.slice(0, 6).map((p) => (
              <li key={p.id}>
                <button
                  onClick={() => handlePlaceClick({ id: '', place: p, status: 'loved', addedAt: new Date().toISOString() } as any)}
                  className="w-full flex items-center gap-3.5 py-3.5 text-left hover:bg-paper-deep -mx-1 px-1 transition-colors"
                >
                  <div className="w-12 h-12 rounded-[10px] overflow-hidden bg-paper-deep ring-1 ring-edge shrink-0">
                    <HubImage
                      userImage={(p as any).mainImage || (p as any).hubImage || (p as any).coverImage}
                      photos={(p as any).photos}
                      primaryType={(p as any).primaryType}
                      types={(p as any).types}
                      alt={p.name}
                      aspect=""
                      className="w-full h-full"
                      loadStrategy="load"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-display text-[18px] leading-tight text-ink truncate">{p.name}</div>
                    <div className="font-mono text-[10px] tracking-[0.12em] uppercase text-ink-mute mt-1 truncate">
                      {p.address}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Empty state for overview tab */}
      {activeTab === 'overview' && sortedPlaces.length === 0 && (
        <div className="relative z-10 px-5">
          <div className="border border-edge rounded-[14px] px-5 py-12 text-center bg-card">
            <p className="font-display text-[26px] text-ink leading-tight">An empty page.</p>
            <p className="text-[13px] text-ink-soft mt-2">Add a place and the list comes to life.</p>
          </div>
        </div>
      )}

      {/* Selected Tags */}
      {selectedTags.length > 0 && (
        <div className="relative z-10 px-5 pb-3">
          <div className="flex flex-wrap gap-1.5">
            {selectedTags.map(tag => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className="glass-leaf px-3 h-7 rounded-full label-eyebrow flex items-center gap-1.5 transition-transform press"
              >
                {tag}
                <span aria-hidden>×</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Content: places - Only show in places tab */}
      {activeTab === 'places' && (
      <div className="relative z-10 p-4 space-y-8 max-w-2xl mx-auto">
        {(() => {
          let lastDay: number | 'none' | null = null
          let dayStop = 0
          return itinerary.map((listPlace, idx) => {
          const dk: number | 'none' = typeof listPlace.tripDay === 'number' ? listPlace.tripDay : 'none'
          const showHeader = multiDay && dk !== lastDay
          if (dk !== lastDay) dayStop = 0
          lastDay = dk
          dayStop += 1
          const stopNum = multiDay ? dayStop : idx + 1
          return (
          <Fragment key={listPlace.id}>
          {showHeader && (
            <div className="flex items-center gap-3 pt-2">
              <span className="label-eyebrow text-ink whitespace-nowrap">{dayHeaderLabel(dk)}</span>
              <span className="flex-1 h-px bg-edge" />
            </div>
          )}
          <div
            onClick={() => handlePlaceClick(listPlace)}
            className="glass rounded-3xl shadow-botanical overflow-hidden hover:shadow-cozy transition-all duration-300 flex flex-col relative cursor-pointer"
          >
            {/* Itinerary stop indicator (trips only): a day selector for the
                owner on multi-day trips, else a stop number. */}
            {trip && (multiDay && isOwner ? (
              <select
                value={typeof listPlace.tripDay === 'number' ? String(listPlace.tripDay) : ''}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => handleSetTripDay(listPlace.placeId, e.target.value === '' ? null : Number(e.target.value))}
                aria-label="Assign itinerary day"
                className="absolute top-4 left-4 z-20 h-7 rounded-full bg-ink text-paper font-mono text-[10px] tracking-wide pl-2.5 pr-1 border-0 cursor-pointer"
              >
                <option value="">— Day</option>
                {Array.from({ length: tripDayCount }).map((_, i) => (
                  <option key={i + 1} value={i + 1}>Day {i + 1}</option>
                ))}
              </select>
            ) : (
              <span className="absolute top-4 left-4 z-20 h-7 min-w-7 px-2 rounded-full bg-ink text-paper font-display text-[14px] flex items-center justify-center shadow-cozy">
                {multiDay && typeof listPlace.tripDay !== 'number' ? '–' : stopNum}
              </span>
            ))}
            {/* Three-dot menu — only the list owner can edit or remove a
                place. Hiding the entry point entirely is cleaner than letting
                non-owners tap into a backend permission failure. */}
            {isOwner && (
              <div className="absolute top-4 right-4 z-20">
                <button
                  className="glass hover:bg-white/20 rounded-full p-2 shadow-soft focus:outline-none"
                  onClick={(e) => {
                    e.stopPropagation()
                    setCardMenuOpen(cardMenuOpen === listPlace.id ? null : listPlace.id)
                  }}
                  aria-label="Open actions menu"
                >
                  <EllipsisHorizontalIcon className="w-6 h-6 text-body" />
                </button>
                {cardMenuOpen === listPlace.id && (
                  <div className="absolute right-0 mt-2 w-32 glass rounded-xl shadow-botanical py-2 z-30">
                    <button
                      className="block w-full text-left px-4 py-2 text-body hover:bg-white/10 rounded-t-xl"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleEditPlace(listPlace)
                      }}
                    >Edit</button>
                    <button
                      className="block w-full text-left px-4 py-2 text-red-600 hover:bg-red-500/20 rounded-b-xl"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRemovePlace(listPlace)
                      }}
                    >Remove</button>
                  </div>
                )}
              </div>
            )}
            {/* Hub Image on top */}
            <div className="w-full h-40 bg-white/10 flex-shrink-0 relative overflow-hidden rounded-t-3xl">
              <HubImage
                userImage={(listPlace.place as any).mainImage || (listPlace.place as any).hubImage || (listPlace.place as any).coverImage}
                photos={(listPlace.place as any).photos}
                primaryType={(listPlace.place as any).primaryType}
                types={(listPlace.place as any).types}
                alt={listPlace.place.name}
                aspect=""
                className="w-full h-full"
                loadStrategy="load"
              />
            </div>
            {/* Content below image */}
            <div className="flex-1 p-6 flex flex-col gap-2">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h4 className="font-serif font-semibold text-title mb-1 text-lg flex items-center gap-2">
                    <span className="truncate">{listPlace.place.name}</span>
                    {typeof myScores[listPlace.place.id] === 'number' && (
                      <span
                        className="shrink-0 inline-flex items-center justify-center h-6 min-w-6 px-1.5 rounded-full bg-accent-soft border border-accent/30 font-display text-[13px]"
                        style={{ color: 'var(--accent-deep)' }}
                        title="Your score"
                      >
                        {myScores[listPlace.place.id].toFixed(1)}
                      </span>
                    )}
                  </h4>
                  <div className="flex items-center text-body text-sm mb-2">
                    <MapPinIcon className="w-4 h-4 mr-1" />
                    {listPlace.place.address}
                  </div>
                </div>
                {/* Status Badge */}
                <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(listPlace.status, listPlace.feeling)}`}>
                  {getStatusIcon(listPlace.status)}
                  <span className="capitalize">{listPlace.status}</span>
                  {listPlace.status === 'tried' && listPlace.feeling && (
                    <span className="ml-1">• {listPlace.feeling}</span>
                  )}
                </div>
              </div>
              {listPlace.note && (
                <p className="text-sm text-body mb-2 italic">"{listPlace.note}"</p>
              )}
              <div className="flex flex-wrap gap-1 mb-2">
                {listPlace.place.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-1 bg-white/10 text-meta text-xs rounded-full border border-white/20"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center space-x-4 text-sm text-meta">
                  <span className="flex items-center">
                    <BookmarkIcon className="w-4 h-4 mr-1" />
                    {listPlace.place.savedCount || 0} {(listPlace.place.savedCount || 0) === 1 ? 'save' : 'saves'}
                  </span>
                  <span aria-hidden>•</span>
                  <span>Added {formatTimestamp(listPlace.addedAt)}</span>
                </div>
              </div>
            </div>
          </div>
          </Fragment>
          )
          })
        })()}
        {/* Empty State */}
        {sortedPlaces.length === 0 && (
          <div className="glass rounded-2xl p-8 text-center shadow-botanical">
            {listPlaces.length === 0 ? (
              <>
                <BookmarkIcon className="w-16 h-16 text-bark-700/50 mx-auto mb-4" />
                <h3 className="text-lg font-serif font-semibold text-title mb-2">No places yet</h3>
                <p className="text-body mb-4">Start building your list by adding your favorite places</p>
                <button 
                  onClick={handleAddFirstPlace}
                  className="pill pill--primary"
                >
                  Add Your First Place
                </button>
              </>
            ) : (
              <>
                <BookmarkIcon className="w-16 h-16 text-bark-700/50 mx-auto mb-4" />
                <h3 className="text-lg font-serif font-semibold text-title mb-2">No places found</h3>
                <p className="text-body mb-4">Try adjusting your search or filters</p>
                <button 
                  onClick={() => {
                    setSearchQuery('')
                    setActiveFilters([])
                    setSelectedTags([])
                    setSortBy('recent')
                  }}
                  className="pill pill--primary"
                >
                  Clear Filters
                </button>
              </>
            )}
          </div>
        )}
      </div>
      )}

      {/* Posts Tab */}
      {activeTab === 'posts' && (
        <div className="relative z-10 p-4">
          <CardShell variant="glass" className="p-8 text-center">
            <CameraIcon className="w-16 h-16 text-bark-700/50 mx-auto mb-4" />
            <h3 className="text-lg font-serif font-semibold text-title mb-2">No Posts Yet</h3>
            <p className="text-body mb-4">Posts from places in this list will appear here</p>
          </CardShell>
        </div>
      )}

      {/* Map Tab */}
      {activeTab === 'map' && (
        <div className="relative z-10 px-4 pb-6">
          <div className="relative">
            <ListMap
              places={listPlaces}
              height="65vh"
              selectedPlaceId={mapCalloutPlace?.place.id || null}
              onSelectPlace={(lp) => setMapCalloutPlace(lp)}
            />
            {mapCalloutPlace && (
              <MapCalloutCard
                place={{
                  id: mapCalloutPlace.place.id,
                  name: mapCalloutPlace.place.name,
                  address: mapCalloutPlace.place.address,
                  distance: '',
                  mainImage: (mapCalloutPlace.place as any).mainImage,
                  tags: mapCalloutPlace.place.tags
                }}
                onSave={() => handleSaveToPlace(mapCalloutPlace.place)}
                onAddPost={() => handleCreatePost()}
                onClose={() => setMapCalloutPlace(null)}
                anchoredToMap={true}
              />
            )}
          </div>
        </div>
      )}
      {/* Map Modal — fullscreen view of all list places */}
      {showMapModal && (
        <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center sm:p-4 bg-[#1A1815]/55 backdrop-blur-sm" onClick={() => setShowMapModal(false)}>
          <div
            className="modal-paper relative w-full sm:max-w-3xl rounded-t-3xl sm:rounded-3xl border border-edge max-h-[92vh] flex flex-col overflow-hidden"
            style={{ boxShadow: '0 18px 60px rgba(46, 28, 13, 0.22)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div data-drag-handle className="sm:hidden flex justify-center py-3 shrink-0" aria-hidden>
              <span className="w-10 h-1 rounded-full bg-ink-faint" />
            </div>
            <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-edge relative z-10">
              <p className="label-eyebrow text-ink-mute">Map view</p>
              <button
                type="button"
                onClick={() => setShowMapModal(false)}
                aria-label="Close map"
                className="h-9 w-9 rounded-full hover:bg-paper-deep flex items-center justify-center text-ink"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 p-4 relative">
              <ListMap
                places={listPlaces}
                height="70vh"
                selectedPlaceId={mapCalloutPlace?.place.id || null}
                onSelectPlace={(lp) => setMapCalloutPlace(lp)}
              />
              {mapCalloutPlace && (
                <MapCalloutCard
                  place={{
                    id: mapCalloutPlace.place.id,
                    name: mapCalloutPlace.place.name,
                    address: mapCalloutPlace.place.address,
                    distance: '',
                    mainImage: (mapCalloutPlace.place as any).mainImage,
                    tags: mapCalloutPlace.place.tags
                  }}
                  onSave={() => handleSaveToPlace(mapCalloutPlace.place)}
                  onAddPost={() => handleCreatePost()}
                  onClose={() => setMapCalloutPlace(null)}
                  anchoredToMap={true}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Image Overlay */}
      {showFullImage && list.coverImage && (
        <div className="fixed inset-0 z-[100000] bg-black/90 flex items-center justify-center" onClick={() => setShowFullImage(false)}>
          <img src={list.coverImage} alt={list.name} className="max-w-[95vw] max-h-[95vh] object-contain" />
          <button className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/20 border border-white/40 backdrop-blur-sm flex items-center justify-center" onClick={() => setShowFullImage(false)}>
            <span className="text-white text-lg">Ã—</span>
          </button>
        </div>
      )}


      {/* Hub Search Modal */}
      <HubSearchModal
        isOpen={showHubSearchModal}
        onClose={() => setShowHubSearchModal(false)}
        onSelectHub={handleHubSelected}
      />

      {/* Save Modal */}
      {hubToSave && (
        <SaveModal
          isOpen={showSaveModal}
          onClose={() => {
            setShowSaveModal(false)
            setHubToSave(null)
          }}
          place={{
            id: hubToSave.id,
            name: hubToSave.name,
            address: hubToSave.location.address,
            tags: hubToSave.tags,
            posts: hubToSave.posts,
            savedCount: 0,
            createdAt: new Date().toISOString(),
            hubImage: hubToSave.mainImage
          }}
          userLists={[]}
          selectedListIds={[list.id]} // Pre-select the current list
          onSave={handleSave}
          onCreateList={handleCreateList}
        />
      )}

      {/* Create Post Modal */}
      <CreatePost
        isOpen={showCreatePost}
        onClose={() => setShowCreatePost(false)}
        preSelectedListIds={[list.id]} // Pre-select the current list
      />

      {/* Embed From Modal */}
      <EmbedFromModal
        isOpen={showEmbedFromModal}
        onClose={() => setShowEmbedFromModal(false)}
      />

      {/* Save Modal */}
      {selectedPlace && (
        <SaveModal
          isOpen={showSaveModal}
          onClose={() => {
            setShowSaveModal(false)
            setSelectedPlace(null)
          }}
          place={selectedPlace}
          userLists={[]}
          onSave={handleSave}
          onCreateList={handleCreateList}
        />
      )}

      {/* List Menu Dropdown */}
      <ListMenuDropdown
        isOpen={showListMenu}
        onClose={() => setShowListMenu(false)}
        buttonRef={listMenuButtonRef}
        onEditList={handleEditList}
        onChangePrivacy={handleChangePrivacy}
        onDeleteList={handleDeleteList}
      />

      {/* Edit List Modal */}
      <EditListModal
        isOpen={showEditListModal}
        onClose={() => setShowEditListModal(false)}
        list={list}
        onSave={async (listData) => {
          // Persist + reflect locally. This was a console.log no-op, so editing
          // a list from its own page silently discarded every change.
          if (!list) return
          try {
            await firebaseListService.updateList(list.id, listData as never)
            setList(prev => (prev ? { ...prev, ...listData } as typeof prev : prev))
            window.dispatchEvent(new CustomEvent('this-is:toast', { detail: { message: 'List updated' } }))
          } catch (e) {
            console.error('[list-view] update list failed', e)
            window.dispatchEvent(new CustomEvent('this-is:toast', { detail: { message: "Couldn't save. Try again.", tone: 'error' } }))
          } finally {
            setShowEditListModal(false)
          }
        }}
      />

      {/* Edit Place Modal */}
      {selectedPlaceToEdit && (
        <EditPlaceModal
          isOpen={showEditPlaceModal}
          onClose={() => {
            setShowEditPlaceModal(false)
            setSelectedPlaceToEdit(null)
          }}
          listPlace={selectedPlaceToEdit}
          onSave={async (placeData) => {
            // Was a no-op (just `console.log`); user edits silently disappeared
            // on Save. Now persists via updateListPlace and refreshes locally
            // so the card reflects the new note/status/feeling immediately.
            const placeId = selectedPlaceToEdit.place?.id || selectedPlaceToEdit.placeId || selectedPlaceToEdit.id
            if (list && placeId) {
              try {
                await firebaseListService.updateListPlace(list.id, placeId, {
                  note: placeData.note,
                  status: placeData.status,
                  triedRating: placeData.feeling,
                })
                setListPlaces(prev => prev.map(lp => {
                  const id = (lp as any).place?.id || (lp as any).placeId
                  if (id !== placeId) return lp
                  return { ...lp, note: placeData.note, status: placeData.status, feeling: placeData.feeling }
                }))
              } catch (e) {
                console.error('[list-view] failed to save place edits', e)
              }
            }
            setShowEditPlaceModal(false)
            setSelectedPlaceToEdit(null)
          }}
        />
      )}

      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={confirmModalConfig.onConfirm}
        title={confirmModalConfig.title}
        message={confirmModalConfig.message}
        confirmText="Delete"
        type="danger"
      />

      {/* Privacy Modal */}
      <PrivacyModal
        isOpen={showPrivacyModal}
        onClose={() => setShowPrivacyModal(false)}
        currentPrivacy={list.privacy || 'public'}
        onPrivacyChange={handlePrivacyChange}
        listName={list.name}
      />

      {/* Action Bar */}
      <ActionBar
        primary={
          isOwner ? (
            <PlusDropdown 
              onCreatePost={handleCreatePost} 
              onSaveHub={handleSaveHub} 
              onEmbedFrom={handleEmbedFrom}
              variant="list"
            />
          ) : (
            <button
              onClick={handleSaveList}
              className={`w-full py-3 px-4 rounded-xl font-semibold transition pill ${
                isSaved 
                  ? 'pill--primary' 
                  : 'pill--quiet'
              }`}
            >
              {isSaved ? 'Saved' : 'Save List'}
            </button>
          )
        }
        secondary={[
          <button
            key="like"
            onClick={handleLike}
            className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium transition pill pill--quiet ${
              isLiked 
                ? 'text-aurum-300' 
                : ''
            }`}
          >
            <HeartIcon className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
            {isLiked ? 'Liked' : 'Like'}
          </button>,
          <button
            key="map"
            onClick={() => setShowMapModal(true)}
            className="flex items-center justify-center gap-2 pill pill--quiet py-3 px-4 rounded-xl font-medium transition"
          >
            <MapIcon className="w-4 h-4" />
            Map
          </button>
        ]}
      />
    </div>
  )
}

export default ListView

