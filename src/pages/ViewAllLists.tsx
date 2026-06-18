import type { List } from '../types/index.js'
import { ArrowLeftIcon, BookmarkIcon, HeartIcon, MapPinIcon, PlusIcon, CalendarIcon } from '@heroicons/react/24/outline'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useNavigation } from '../contexts/NavigationContext.tsx'
import { useAuth } from '../contexts/AuthContext.js'
import { firebaseDataService } from '../services/firebaseDataService.js'
import { firebaseListService } from '../services/firebaseListService.js'
import CreateListModal from '../components/CreateListModal'
import EditListModal from '../components/EditListModal'
import ConfirmModal from '../components/ConfirmModal'
import { formatTimestamp } from '../utils/dateUtils'
import { tripBadge } from '../utils/listHelpers'

const SORT_OPTIONS = [
  { key: 'recent', label: 'Recent' },
  { key: 'popular', label: 'Popular' },
  { key: 'alphabetical', label: 'A→Z' },
  { key: 'places', label: 'Most places' },
] as const

type SortKey = typeof SORT_OPTIONS[number]['key']

const ViewAllLists = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { openListModal } = useNavigation()
  const { currentUser: authUser } = useAuth()

  const [allLists, setAllLists] = useState<List[]>([])
  const [creators, setCreators] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<SortKey>('recent')
  const [showOnlyMine, setShowOnlyMine] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editList, setEditList] = useState<List | null>(null)
  const [confirmConfig, setConfirmConfig] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null)

  // Pre-fill from URL (e.g. ?sort=popular&onlyMine=false)
  useEffect(() => {
    const sort = searchParams.get('sort') as SortKey | null
    const onlyMine = searchParams.get('onlyMine')
    if (sort && SORT_OPTIONS.some(o => o.key === sort)) setSortBy(sort)
    if (onlyMine != null) setShowOnlyMine(onlyMine !== 'false')
  }, [searchParams])

  useEffect(() => {
    if (!authUser) return
    let cancelled = false
    void (async () => {
      setLoading(true)
      try {
        let lists: List[] = await firebaseDataService.getUserLists(authUser.id)
        if (!showOnlyMine) {
          const following = await firebaseDataService.getUserFollowing(authUser.id)
          const friendListsArrays = await Promise.all(
            following.map(f => firebaseDataService.getUserLists(f.id).then(ls => ls.filter(l => l.privacy === 'public')))
          )
          lists = [...lists, ...friendListsArrays.flat()]
        }
        if (cancelled) return
        setAllLists(lists)

        const creatorIds = Array.from(new Set(lists.map(l => l.userId)))
        const map: Record<string, string> = {}
        await Promise.all(creatorIds.map(async id => {
          map[id] = await firebaseDataService.getUserDisplayName(id)
        }))
        if (!cancelled) setCreators(map)
      } catch (e) {
        console.error('[view-all-lists] load failed', e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [authUser, showOnlyMine])

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return allLists
      .filter(list => {
        if (showOnlyMine && authUser && list.userId !== authUser.id) return false
        if (!q) return true
        return (
          list.name.toLowerCase().includes(q) ||
          (list.description || '').toLowerCase().includes(q) ||
          (list.tags || []).some(t => t.toLowerCase().includes(q))
        )
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'popular': return (b.likes || 0) - (a.likes || 0)
          case 'alphabetical': return a.name.localeCompare(b.name)
          case 'places': return ((b.hubs?.length || 0) - (a.hubs?.length || 0))
          case 'recent':
          default:
            return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
        }
      })
  }, [allLists, searchQuery, sortBy, showOnlyMine, authUser])

  const handleDeleteList = (list: List) => {
    setConfirmConfig({
      title: 'Delete list',
      message: `Are you sure you want to delete "${list.name}"? This can't be undone.`,
      onConfirm: () => {
        firebaseListService.deleteList(list.id)
        setAllLists(prev => prev.filter(l => l.id !== list.id))
      },
    })
  }

  return (
    <div className="relative min-h-full overflow-x-hidden">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-paper/90 backdrop-blur-md">
        <div className="px-5 pt-5 pb-3 flex items-center justify-between gap-3">
          <button
            onClick={() => { if (window.history.length > 1) navigate(-1); else navigate('/profile') }}
            aria-label="Back"
            className="h-10 w-10 rounded-full hover:bg-paper-deep flex items-center justify-center"
          >
            <ArrowLeftIcon className="w-5 h-5 text-ink" />
          </button>
          <div className="text-center min-w-0">
            <p className="label-eyebrow text-ink-mute">Lists</p>
            <h1 className="font-display text-[22px] leading-none text-ink truncate">
              {showOnlyMine ? 'Your lists' : 'All lists'}
            </h1>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            aria-label="Create list"
            className="btn-cta h-10 px-3.5 inline-flex items-center gap-1.5 text-[13px] font-semibold"
          >
            <PlusIcon className="w-4 h-4" />
            New
          </button>
        </div>

        {/* Search */}
        <div className="px-5 pb-3">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search your lists…"
            className="w-full h-11 px-4 rounded-full border border-edge bg-card text-[14px] text-ink placeholder:text-ink-mute outline-none focus:border-ink/40"
          />
        </div>

        {/* Filters / sort */}
        <div className="px-5 pb-3 flex items-center justify-between gap-3 overflow-x-auto">
          <div className="flex items-center gap-1.5 shrink-0">
            {SORT_OPTIONS.map(opt => {
              const active = sortBy === opt.key
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setSortBy(opt.key)}
                  aria-pressed={active}
                  className={`h-8 px-3 rounded-full text-[12px] font-medium border transition-colors whitespace-nowrap ${
                    active ? 'bg-paper-deep border-ink text-ink' : 'bg-card border-edge text-ink-soft hover:border-ink/40'
                  }`}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
          <label className="inline-flex items-center gap-2 shrink-0 cursor-pointer">
            <input
              type="checkbox"
              checked={showOnlyMine}
              onChange={e => setShowOnlyMine(e.target.checked)}
              className="w-4 h-4 accent-ink rounded"
            />
            <span className="font-mono text-[10px] tracking-[0.10em] uppercase text-ink-mute">Only mine</span>
          </label>
        </div>
        <div className="border-b border-edge mx-5" />
      </header>

      {/* Content */}
      <div className="px-5 pt-4 pb-12">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="animate-pulse aspect-[5/3] rounded-2xl bg-paper-deep" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="border border-edge rounded-[14px] px-5 py-10 text-center bg-card">
            <p className="font-display text-[22px] text-ink leading-tight">No lists yet.</p>
            <p className="text-[13px] text-ink-soft mt-2">
              Create one to start grouping the places you love.
            </p>
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="btn-cta h-10 px-4 mt-4 text-[13px] font-semibold inline-flex items-center gap-2"
            >
              <PlusIcon className="w-4 h-4" />
              New list
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filtered.map(list => {
              const isOwner = authUser?.id === list.userId
              return (
                <article
                  key={list.id}
                  onClick={() => openListModal(list, 'view-all-lists')}
                  className="group relative rounded-2xl border border-edge bg-card overflow-hidden cursor-pointer transition-shadow hover:shadow-lg"
                >
                  <div className="relative aspect-[5/3] bg-paper-deep overflow-hidden">
                    {list.coverImage ? (
                      <img
                        src={list.coverImage}
                        alt={list.name}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <BookmarkIcon className="w-10 h-10 text-ink-faint" />
                      </div>
                    )}
                    <div className="absolute inset-0 pointer-events-none"
                         style={{ background: 'linear-gradient(to top, rgba(26,24,21,0.55), transparent 55%)' }} />
                    <div className="absolute bottom-3 left-3 right-3 text-white">
                      <p className="font-mono text-[10px] tracking-[0.14em] uppercase opacity-80 truncate">
                        {list.privacy === 'private' ? 'Private' : list.privacy === 'friends' ? 'Friends only' : 'Public'} · {list.hubs?.length || 0} {list.hubs?.length === 1 ? 'place' : 'places'}
                      </p>
                      <h3 className="font-display text-[20px] leading-[1.05] line-clamp-2 mt-0.5">
                        {list.name}
                      </h3>
                    </div>
                  </div>

                  <div className="px-3.5 py-3 space-y-2">
                    {list.description && (
                      <p className="text-[13px] text-ink-soft line-clamp-2">{list.description}</p>
                    )}
                    {list.tags && list.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {list.tags.slice(0, 3).map(tag => (
                          <span
                            key={tag}
                            className="inline-flex items-center px-2 h-6 rounded-full bg-paper-deep border border-edge text-[10px] font-mono tracking-[0.10em] uppercase text-ink-soft"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-1">
                      <p className="font-mono text-[10px] tracking-[0.10em] uppercase text-ink-mute truncate">
                        {creators[list.userId] && !isOwner ? `By ${creators[list.userId]} · ` : ''}{formatTimestamp(list.updatedAt as any)}
                      </p>
                      <div className="flex items-center gap-2 text-ink-mute shrink-0">
                        {tripBadge(list) && (
                          <span className="inline-flex items-center gap-1 text-[11px]" style={{ color: 'var(--accent-deep)' }}>
                            <CalendarIcon className="w-3.5 h-3.5" />
                            {tripBadge(list)}
                          </span>
                        )}
                        {typeof list.likes === 'number' && list.likes > 0 && (
                          <span className="inline-flex items-center gap-1 text-[11px]">
                            <HeartIcon className="w-3.5 h-3.5" />
                            {list.likes}
                          </span>
                        )}
                        {(list as any).location?.address && (
                          <span className="inline-flex items-center gap-1 text-[11px] truncate max-w-[80px]">
                            <MapPinIcon className="w-3.5 h-3.5" />
                            <span className="truncate">{(list as any).location.address}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {isOwner && (
                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setEditList(list) }}
                          className="btn-secondary flex-1 h-8 text-[11px] font-mono tracking-[0.10em] uppercase"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleDeleteList(list) }}
                          className="flex-1 h-8 rounded-full bg-card border border-edge text-[11px] font-mono tracking-[0.10em] uppercase text-ink-mute hover:text-red-700 hover:border-red-200 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>

      <CreateListModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onCreate={() => {
          // CreateListModal persists the list itself now. We just dispatch
          // the saved event so Profile / Home stats refresh, and close.
          // (Previously this callback also called createList, which would
          // have double-created the list if the modal had ever fired it.)
          window.dispatchEvent(new CustomEvent('this-is:saved', { detail: {} }))
          setShowCreate(false)
        }}
      />

      <EditListModal
        isOpen={!!editList}
        onClose={() => setEditList(null)}
        list={editList}
        onSave={(listData) => {
          if (editList) {
            firebaseListService.updateList(editList.id, listData)
            setAllLists(prev => prev.map(l => l.id === editList.id ? { ...l, ...listData } as List : l))
          }
        }}
      />

      <ConfirmModal
        isOpen={!!confirmConfig}
        onClose={() => setConfirmConfig(null)}
        title={confirmConfig?.title || ''}
        message={confirmConfig?.message || ''}
        onConfirm={() => { confirmConfig?.onConfirm(); setConfirmConfig(null) }}
        confirmText="Delete"
        type="danger"
      />
    </div>
  )
}

export default ViewAllLists
