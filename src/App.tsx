import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect, lazy, Suspense } from 'react'
import { NavigationProvider } from './contexts/NavigationContext.tsx'
import { FiltersProvider } from './contexts/FiltersContext.tsx'
import { ModalProvider, useModal } from './contexts/ModalContext.tsx'
import { AuthProvider, useAuth } from './contexts/AuthContext.tsx'
import type { List } from './types/index.js'
import Navbar from './components/Navbar.tsx'
import CreatePost from './components/CreatePost.tsx'
import CreateListModal from './components/CreateListModal.tsx'
import NavigationModals from './components/NavigationModals.tsx';
import InstallPrompt from './components/InstallPrompt.tsx';
import Toast from './components/ui/Toast.tsx';
// Eager-load Home so the most common landing page doesn't show a loader.
import Home from './pages/Home.tsx'
import Auth from './pages/Auth.tsx'
// Code-split everything else. Each becomes its own chunk so the entry bundle
// is much smaller and pages download lazily as the user navigates. Was a
// 1.4MB monolith on first load — now Home loads first and the rest stream in.
const Profile = lazy(() => import('./pages/Profile.tsx'))
const EditProfile = lazy(() => import('./pages/EditProfile.tsx'))
const Following = lazy(() => import('./pages/Following.tsx'))
const Settings = lazy(() => import('./pages/Settings.tsx'))
const Search = lazy(() => import('./pages/Search.tsx'))
const Explore = lazy(() => import('./pages/Explore.tsx'))
const ListView = lazy(() => import('./pages/ListView.tsx'))
const ViewAllLists = lazy(() => import('./pages/ViewAllLists.tsx'))
const Favorites = lazy(() => import('./pages/SavedLists.tsx'))
const PlaceHub = lazy(() => import('./pages/PlaceHub.tsx'))
const UserProfile = lazy(() => import('./pages/UserProfile.tsx'))
import { setupViewportHandler } from './utils/viewportHandler.ts'
import EmbedFromModal from './components/EmbedFromModal.tsx'
import SaveModal from './components/SaveModal.tsx'
import CoverPhotoPicker from './components/CoverPhotoPicker.tsx'
import SaveListToFolderModal from './components/SaveListToFolderModal.tsx'
import { firebaseDataService } from './services/firebaseDataService.js'

const RouteFallback = () => (
  <div className="flex items-center justify-center h-full py-20">
    <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-ink-mute">Loading…</span>
  </div>
)

// Global modals component (moved above usage)
const GlobalModals = () => {
  const { showSaveModal, showCreatePost, saveModalData, createPostData, closeSaveModal, closeCreatePostModal } = useModal()
  const { currentUser } = useAuth()
  const [userLists, setUserLists] = useState<List[]>([]);
  const [coverPick, setCoverPick] = useState<{ hubId: string; googlePlaceId?: string; hubName: string; hubAddress?: string } | null>(null)
  const [saveListToFolder, setSaveListToFolder] = useState<List | null>(null)

  // Listen for the "Save list" intent dispatched from ListModal — opens a
  // dedicated picker that nests the list inside one of the user's lists
  // (folder-style) instead of the regular place-save flow.
  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent).detail as { list?: List } | undefined
      if (detail?.list) setSaveListToFolder(detail.list)
    }
    window.addEventListener('openSaveListToFolder', onOpen)
    return () => window.removeEventListener('openSaveListToFolder', onOpen)
  }, [])

  // Manual cover-picker trigger — dispatched from HubModal so users can
  // re-open the picker for any place they've already saved that doesn't
  // have a cover image yet. Especially important for places saved before
  // the googlePlaceId-storage fix.
  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent).detail as { hubId?: string; googlePlaceId?: string; hubName?: string; hubAddress?: string } | undefined
      if (detail?.hubId && detail?.hubName) {
        setCoverPick({
          hubId: detail.hubId,
          googlePlaceId: detail.googlePlaceId || undefined,
          hubName: detail.hubName,
          hubAddress: detail.hubAddress,
        })
      }
    }
    window.addEventListener('openCoverPicker', onOpen)
    return () => window.removeEventListener('openCoverPicker', onOpen)
  }, [])

  useEffect(() => {
    const fetchLists = async () => {
      if (currentUser) {
        const lists = await firebaseDataService.getUserLists(currentUser.id);
        setUserLists(lists);
      }
    };
    // Hydrate user lists whenever any list-pickering modal might open. Was
    // gated on showSaveModal only, which left SaveListToFolderModal opening
    // with empty options if the user hadn't opened SaveModal first.
    if (showSaveModal || saveListToFolder) {
      fetchLists();
    }
  }, [showSaveModal, saveListToFolder, currentUser]);


  return (
    <>
      {/* Save Modal */}
      {showSaveModal && saveModalData && (saveModalData.hub || saveModalData.list) && (
        <SaveModal
          isOpen={showSaveModal}
          onClose={closeSaveModal}
          place={saveModalData.hub ? {
            id: saveModalData.hub.id,
            name: saveModalData.hub.name,
            address: saveModalData.hub.location?.address || 'No address available',
            tags: saveModalData.hub.tags,
            posts: saveModalData.hub.posts,
            savedCount: 0,
            createdAt: '2024-01-15'
          } : {
            id: saveModalData.list!.id,
            name: saveModalData.list!.name,
            address: 'List',
            tags: saveModalData.list!.tags,
            posts: [],
            savedCount: 0,
            createdAt: saveModalData.list!.createdAt || '2024-01-15'
          }}
          userLists={userLists}
          onSave={async (status, rating, listIds, note) => {
            if (!currentUser) return;
            const seedHub: any = saveModalData.hub
            const seedList: any = saveModalData.list

            // Silent Google→Hub conversion: if the place isn't a real hub yet, ensure one
            // before any list operation. This makes "save" the implicit claim action.
            const ensured = seedHub
              ? await firebaseDataService.ensureHubFromPlace({
                  id: seedHub.id,
                  name: seedHub.name,
                  address: seedHub.address || (seedHub as { location?: { address?: string } })?.location?.address,
                  coordinates: (seedHub as { coordinates?: { lat: number; lng: number } }).coordinates,
                  location: (seedHub as { location?: { address?: string; lat?: number; lng?: number } }).location,
                  photos: seedHub.photos,
                  primaryType: seedHub.primaryType,
                  types: seedHub.types,
                })
              : null
            const placeId = ensured?.id || (seedHub ? seedHub.id : seedList.id)
            // Prefer the stored googlePlaceId — survives the Google→Firestore
            // id swap so the CoverPhotoPicker can fetch photos from Google
            // even on the second save of an already-claimed hub.
            const googlePlaceId: string | null = ensured?.googlePlaceId || (typeof seedHub?.id === 'string' && /^ChIJ/.test(seedHub.id) ? seedHub.id : null)
            // Show the cover-photo picker either when this user just created
            // the hub, or when an earlier auto-claimed hub exists but doesn't
            // have a cover yet — same intent: "first user with photos available
            // gets to set the cover."
            const needsCover = !!(seedHub && ensured && (ensured.created || !ensured.mainImage))

            const owned = userLists || []
            const ids = Array.isArray(listIds) ? listIds : []

            // Check for duplicates
            const already: string[] = []
            for (const lid of ids) {
              const exists = await firebaseDataService.isPlaceInList(lid, placeId)
              if (exists) already.push(lid)
            }
            if (already.length > 0) {
              const names = owned.filter(l => already.includes(l.id)).map(l => l.name).join(', ')
              const overwrite = window.confirm(`You've already saved this hub to the following lists: ${names}.\nWould you like to overwrite your previous save?`)
              if (!overwrite) return
            }

            try {
              for (const listId of ids) {
                await firebaseDataService.savePlaceToList(placeId, listId, currentUser.id, note, undefined, status, rating);
              }
              // Idempotent save-count bump — once per user-place pair, not once per list.
              await firebaseDataService.recordUserSave(placeId, currentUser.id)

              if (seedHub) {
                await firebaseDataService.trackUserInteraction(currentUser.id, 'save', {
                  placeId,
                  query: seedHub.name
                });
              }
              // Notify subscribers (Home stats, Profile lists, etc.) so they can
              // refresh their saved counts and saved-state markers.
              window.dispatchEvent(new CustomEvent('this-is:saved', { detail: { placeId, status } }))
              window.dispatchEvent(new CustomEvent('this-is:toast', { detail: { message: 'Saved' } }))
            } catch (e) {
              // Surface failures so the user knows the save didn't take. Without
              // this the modal closes with no feedback and the place silently
              // doesn't appear in their list.
              console.error('[GlobalModals] save failed', e)
              window.dispatchEvent(new CustomEvent('this-is:toast', { detail: { message: "Couldn't save. Try again.", tone: 'error' } }))
            }
            closeSaveModal()
            // First-saver perk: pick a cover photo. Open the picker
            // whenever the hub doesn't have a cover image yet — even if we
            // don't have a Google place_id, the picker now falls back to
            // searchText(name + address) to recover photos.
            if (needsCover) {
              setCoverPick({
                hubId: placeId,
                googlePlaceId: googlePlaceId || undefined,
                hubName: seedHub.name,
                hubAddress: seedHub.address || (seedHub as { location?: { address?: string } })?.location?.address || undefined,
              })
            }
          }}
          onCreateList={async (listData, saveContext) => {
            if (!currentUser) return;
            const seedHub: any = saveModalData.hub
            const seedList: any = saveModalData.list
            const ensured = seedHub
              ? await firebaseDataService.ensureHubFromPlace({
                  id: seedHub.id,
                  name: seedHub.name,
                  address: seedHub.address || (seedHub as { location?: { address?: string } })?.location?.address,
                  coordinates: (seedHub as { coordinates?: { lat: number; lng: number } }).coordinates,
                  location: (seedHub as { location?: { address?: string; lat?: number; lng?: number } }).location,
                  photos: seedHub.photos,
                  primaryType: seedHub.primaryType,
                  types: seedHub.types,
                })
              : null
            const placeId = ensured?.id || (seedHub ? seedHub.id : seedList.id)
            const googlePlaceId: string | null = ensured?.googlePlaceId || (typeof seedHub?.id === 'string' && /^ChIJ/.test(seedHub.id) ? seedHub.id : null)
            const needsCover = !!(seedHub && ensured && (ensured.created || !ensured.mainImage))
            const newListId = await firebaseDataService.createList({
              ...listData,
              userId: currentUser.id,
              tags: listData.tags || []
            });
            if (newListId) {
              // Use the status / rating / note the user picked on the previous
              // SaveModal screen instead of hardcoding 'loved'. Falls back to
              // 'loved' only when no context was forwarded (legacy callers).
              const status = saveContext?.status || 'loved'
              const rating = saveContext?.rating
              const noteToSave = saveContext?.note
              await firebaseDataService.savePlaceToList(placeId, newListId, currentUser.id, noteToSave, undefined, status, rating);
              await firebaseDataService.recordUserSave(placeId, currentUser.id)
              // Keep local cache fresh so the next save flow shows the new list
              // immediately without waiting for the modal-open re-fetch.
              try {
                const fresh = await firebaseDataService.getUserLists(currentUser.id)
                setUserLists(fresh)
              } catch (e) {
                console.warn('[GlobalModals] failed to refresh user lists after create', e)
              }
              window.dispatchEvent(new CustomEvent('this-is:saved', { detail: { placeId, status, newListId } }))
            }
            closeSaveModal()
            if (needsCover) {
              setCoverPick({
                hubId: placeId,
                googlePlaceId: googlePlaceId || undefined,
                hubName: seedHub.name,
                hubAddress: seedHub.address || (seedHub as { location?: { address?: string } })?.location?.address || undefined,
              })
            }
          }}
        />
      )}

      {coverPick && (
        <CoverPhotoPicker
          isOpen
          onClose={() => setCoverPick(null)}
          hubId={coverPick.hubId}
          googlePlaceId={coverPick.googlePlaceId}
          hubName={coverPick.hubName}
          hubAddress={coverPick.hubAddress}
        />
      )}

      <SaveListToFolderModal
        isOpen={!!saveListToFolder}
        onClose={() => setSaveListToFolder(null)}
        list={saveListToFolder}
        userLists={userLists}
        onCreateNewFolder={() => {
          // Hand off to the existing CreateListModal — close this picker
          // first so the two modals don't stack.
          setSaveListToFolder(null)
          setTimeout(() => {
            try { window.dispatchEvent(new CustomEvent('openCreateList')) } catch (e) { console.warn('[saveListToFolder] open create-list failed', e) }
          }, 50)
        }}
        onConfirm={async (parentListIds) => {
          if (!currentUser || !saveListToFolder) { setSaveListToFolder(null); return }
          for (const parentId of parentListIds) {
            if (parentId === saveListToFolder.id) continue
            await firebaseDataService.saveListToList(saveListToFolder.id, parentId, currentUser.id)
          }
          window.dispatchEvent(new CustomEvent('this-is:saved', {
            detail: { listId: saveListToFolder.id, parents: parentListIds }
          }))
          setSaveListToFolder(null)
        }}
      />


      {/* Create Post Modal */}
      {showCreatePost && createPostData && (
        <CreatePost
          isOpen={showCreatePost}
          onClose={closeCreatePostModal}
          preSelectedHub={createPostData.hub ? {
            id: createPostData.hub.id,
            name: createPostData.hub.name,
            address: createPostData.hub.location.address,
            description: createPostData.hub.description,
            lat: createPostData.hub.location.lat,
            lng: createPostData.hub.location.lng
          } : undefined}
          preSelectedListIds={createPostData.list ? [createPostData.list.id] : undefined}
        />
      )}
    </>
  )
}

function AppContent() {
  const [activeTab, setActiveTab] = useState('home')
  const [showCreatePost, setShowCreatePost] = useState(false)
  const [showEmbedFromModal, setShowEmbedFromModal] = useState(false)
  const [showCreateList, setShowCreateList] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { currentUser } = useAuth()

  // Prevent scroll when touching navbar area (but allow button interactions)
  useEffect(() => {
    const handleTouchMove = (e: TouchEvent) => {
      const target = e.target as HTMLElement
      const nav = target.closest('nav')
      if (nav && !target.closest('button')) {
        e.preventDefault()
      }
    }

    const handleWheel = (e: WheelEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('nav')) {
        e.preventDefault()
      }
    }

    document.addEventListener('touchmove', handleTouchMove, { passive: false })
    document.addEventListener('wheel', handleWheel, { passive: false })

    return () => {
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('wheel', handleWheel)
    }
  }, [])

  // Setup viewport handler to prevent keyboard displacement
  useEffect(() => {
    const cleanup = setupViewportHandler()
    return cleanup
  }, [])

  // Tailwind runtime verification stamp
  useEffect(() => {
    ;(window as any).__build = Date.now()
    console.log('[UI] tailwind=on', (window as any).__build)
  }, [])

  // Update active tab based on current route. Was only matching the four
  // root routes — every deep route (/place/:id, /list/:id, /user/:id,
  // /profile/edit, etc.) left whatever tab was last highlighted, which gave
  // the wrong indicator when the user landed directly on a shared URL
  // (defaulting to 'home' without actually being on home).
  useEffect(() => {
    const path = location.pathname
    if (path === '/' || path === '/home') setActiveTab('home')
    else if (path.startsWith('/explore')) setActiveTab('explore')
    else if (path.startsWith('/search')) setActiveTab('search')
    else if (
      path.startsWith('/profile') ||
      path === '/lists' ||
      path === '/favorites' ||
      path === '/settings' ||
      path.startsWith('/user/')
    ) setActiveTab('profile')
    else setActiveTab('') // /place/:id, /list/:id — no nav root owns these
  }, [location.pathname])

  // Listen for create list event
  useEffect(() => {
    const handleOpenCreateList = () => {
      setShowCreateList(true)
    }

    window.addEventListener('openCreateList', handleOpenCreateList)
    return () => {
      window.removeEventListener('openCreateList', handleOpenCreateList)
    }
  }, [])

  const handleTabChange = (tab: string) => {
    setActiveTab(tab)
    switch (tab) {
      case 'home': navigate('/'); break
      case 'explore': navigate('/explore'); break
      case 'search': navigate('/search'); break
      case 'profile': navigate('/profile'); break
      default: navigate('/')
    }
  }

  // If user is not authenticated, show auth page
  if (!currentUser) {
    return <Auth />
  }

  return (
    <>
      <div className="h-dvh">
        <div className="max-w-md mx-auto h-full">
          <div className="flex flex-col h-full">
              {/* Main Content Area */}
              <main className="flex-1 overflow-y-auto pb-28 overflow-x-hidden" data-scroll-root>
                <Suspense fallback={<RouteFallback />}>
                  <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/home" element={<Home />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/profile/edit" element={<EditProfile />} />
                    <Route path="/profile/following" element={<Following />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/search" element={<Search />} />
                    <Route path="/explore" element={<Explore />} />
                    <Route path="/list/:id" element={<ListView />} />
                    <Route path="/lists" element={<ViewAllLists />} />
                    <Route path="/favorites" element={<Favorites />} />
                    <Route path="/place/:id" element={<PlaceHub />} />
                    <Route path="/user/:userId" element={<UserProfile />} />
                  </Routes>
                </Suspense>
              </main>
              {/* Bottom Navigation */}
              <Navbar
                activeTab={activeTab}
                setActiveTab={handleTabChange}
                onCreatePost={() => setShowCreatePost(true)}
                onEmbedFrom={() => setShowEmbedFromModal(true)}
              />
            </div>
          </div>
        </div>

      {/* Create Post Modal */}
      <CreatePost 
        isOpen={showCreatePost} 
        onClose={() => setShowCreatePost(false)} 
      />

      {/* Embed From Modal */}
      <EmbedFromModal
        isOpen={showEmbedFromModal}
        onClose={() => setShowEmbedFromModal(false)}
      />

      {/* Create List Modal */}
      <CreateListModal
        isOpen={showCreateList}
        onClose={() => setShowCreateList(false)}
        onCreate={(newListId) => {
          // The list was already persisted inside the modal. Fire the saved
          // event so any open Profile / Favorites view refetches its lists,
          // then route the user into the new list. ListView fetches fresh
          // data on mount, so no manual cache invalidation needed here.
          window.dispatchEvent(new CustomEvent('this-is:saved', { detail: { newListId } }))
          navigate(`/list/${newListId}`)
        }}
      />

      {/* Global Modals */}
      <GlobalModals />

      {/* All navigation modals */}
      <NavigationModals />

      {/* Global toast bar — fires off `this-is:toast` CustomEvents. */}
      <Toast />
    </>
  )
}

function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <NavigationProvider>
        <FiltersProvider>
          <ModalProvider>
            {children}
            <InstallPrompt />
          </ModalProvider>
        </FiltersProvider>
      </NavigationProvider>
    </AuthProvider>
  )
}

function App() {
  useEffect(() => {
    try {
      ;(window as any).__ui_build = new Date().toISOString()
      console.log('[UI] build', (window as any).__ui_build)
      const sunlight = document.querySelector('.sunlight-layer') as HTMLElement | null
      const root = document.getElementById('root') as HTMLElement | null
      if (sunlight && root) {
        console.table({
          sunlightZ: getComputedStyle(sunlight).zIndex,
          appZ: getComputedStyle(root).zIndex,
        })
      }
    } catch {}
  }, [])
  return (
    <Providers>
      {/* Subtle global sunlight layer for depth */}
      <div className="sunlight-layer" />
      <div className="relative z-10">
        <AppContent />
      </div>
    </Providers>
  )
}

export default App
