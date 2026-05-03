import React, { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { navigationHistory } from '../utils/navigationHistory.js'
import type { Hub, List, User } from '../types/index.js'
import { firebaseDataService } from '../services/firebaseDataService.js'

interface NavigationContextType {
  // Modal states
  showHubModal: boolean
  showListModal: boolean
  showProfileModal: boolean
  selectedHub: Hub | null
  selectedList: List | null
  selectedUserId: string | null
  selectedPostId: string | null
  hubModalOptions: { initialTab?: 'overview' | 'posts', postId?: string } | null
  showPostOverlay: boolean

  // Navigation methods
  openHubModal: (hub: Hub, from?: string, options?: { initialTab?: 'overview' | 'posts' }) => void
  openListModal: (list: List, from?: string) => void
  openProfileModal: (userId: string, from?: string) => void
  openPostOverlay: (postId: string) => void
  closePostOverlay: () => void
  closeHubModal: () => void
  closeListModal: () => void
  closeProfileModal: () => void
  goBack: () => void
  exitModalFlow: () => void
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined)

export const useNavigation = () => {
  const context = useContext(NavigationContext)
  if (!context) {
    throw new Error('useNavigation must be used within a NavigationProvider')
  }
  return context
}

interface NavigationProviderProps {
  children: ReactNode
}

export const NavigationProvider = ({ children }: NavigationProviderProps) => {
  const navigate = useNavigate()
  const [showHubModal, setShowHubModal] = useState(false)
  const [showListModal, setShowListModal] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [showPostModal, setShowPostModal] = useState(false)
  const [selectedHub, setSelectedHub] = useState<Hub | null>(null)
  const [selectedList, setSelectedList] = useState<List | null>(null)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null)
  
  // Back navigation state
  const [hubModalFrom, setHubModalFrom] = useState<string | null>(null)
  const [listModalFrom, setListModalFrom] = useState<string | null>(null)
  const [profileModalFrom, setProfileModalFrom] = useState<string | null>(null)
  const [postModalFrom, setPostModalFrom] = useState<string | null>(null)
  const [previousList, setPreviousList] = useState<List | null>(null)
  const [previousUserId, setPreviousUserId] = useState<string | null>(null)
  const [hubModalOptions, setHubModalOptions] = useState<{ initialTab?: 'overview' | 'posts', postId?: string } | null>(null)
  const [showPostOverlay, setShowPostOverlay] = useState(false);

  const openPostOverlay = (postId: string) => {
    setSelectedPostId(postId);
    setShowPostOverlay(true);
  };

  const closePostOverlay = () => {
    setShowPostOverlay(false);
    setSelectedPostId(null);
  };


  // UX refresh: hubs are routes now, not modals. Keep the function name for
  // call-site compatibility, but just navigate to /place/:id. Optional postId is
  // forwarded as a query param so PlaceHub can scroll to a specific post.
  //
  // Google-candidates: silently materialize on open. The id we get from a
  // Google card is the Places API placeId; that doc doesn't exist in the
  // `places/` collection yet, so navigating directly would 404. Calling
  // `ensureHubFromPlace` first creates the hub doc (or returns the existing
  // id when one already matches), so the route is always valid.
  const openHubModal = async (hub: Hub, from: string = 'unknown', options: { initialTab?: 'overview' | 'posts', postId?: string } = {}) => {
    const candidateId = hub?.id
    if (!candidateId) return

    // Resolve the hub id (silently materialize a Google place into a hub
    // doc if it doesn't exist yet).
    let resolvedId = candidateId
    let resolvedHub: Hub = hub
    try {
      const ensured = await firebaseDataService.ensureHubFromPlace({
        id: candidateId,
        placeId: (hub as Hub & { placeId?: string }).placeId,
        name: hub.name,
        address: (hub as Hub & { address?: string; location?: { address?: string } }).address
          || (hub as Hub & { location?: { address?: string } }).location?.address,
        description: (hub as Hub & { description?: string }).description,
        coordinates: (hub as Hub & { coordinates?: { lat?: number; lng?: number }; location?: { lat?: number; lng?: number } }).coordinates
          || (hub as Hub & { location?: { lat?: number; lng?: number } }).location,
        photos: (hub as Hub & { photos?: { name: string }[] }).photos,
        primaryType: (hub as Hub & { primaryType?: string }).primaryType,
        types: (hub as Hub & { types?: string[] }).types,
      })
      if (ensured?.id) {
        resolvedId = ensured.id
        resolvedHub = { ...hub, id: ensured.id } as Hub
      }
    } catch (e) {
      console.warn('[openHubModal] ensureHubFromPlace failed; using raw id', e)
    }

    // Modal-stack mode: when invoked from inside an existing modal flow,
    // keep the user in the modal stack rather than navigating to the
    // /place/:id route. Clicking a place inside ListModal used to bounce
    // the user out to a full-screen page and lose the breadcrumb back to
    // the list — now we keep the list modal underneath, push the hub onto
    // navigationHistory, and render an inline HubModal on top.
    const inModalContext = showListModal || showProfileModal || showHubModal
    if (inModalContext) {
      if (from !== 'back') {
        navigationHistory.push({ type: 'hub', id: resolvedId, from })
      }
      setSelectedHub(resolvedHub)
      setHubModalOptions(options)
      setShowHubModal(true)
      // Keep list/profile underneath visually but hide them so the hub modal
      // is the foreground panel. Closing the hub modal will pop history and
      // re-open the underlying list/profile via goBack.
      if (showListModal) setShowListModal(false)
      if (showProfileModal) setShowProfileModal(false)
      if (!from.endsWith('-back')) setHubModalFrom(from)
      return
    }

    // Standalone mode: navigate to the route as before.
    closePostOverlay()
    setShowHubModal(false)
    setSelectedHub(null)
    const params = new URLSearchParams()
    if (options.postId) params.set('post', options.postId)
    if (options.initialTab) params.set('tab', options.initialTab)
    const qs = params.toString()
    navigate(`/place/${resolvedId}${qs ? `?${qs}` : ''}`)
  }

  const openListModal = (list: List, from: string = 'unknown') => {
    console.log('Opening list modal from:', from, 'list:', list.name)
    if (from !== 'back') {
      navigationHistory.push({ type: 'list', id: list.id, from })
    }

    if (showHubModal) {
      setShowHubModal(false)
    } else if (showProfileModal) {
      setPreviousUserId(selectedUserId)
      setShowProfileModal(false)
    }
    
    closePostOverlay();

    setSelectedList(list)
    setShowListModal(true)
    if (!from.endsWith('-back')) {
      setListModalFrom(from)
    }
  }

  const openProfileModal = (userId: string, from: string = 'unknown') => {
    console.log('Opening profile modal from:', from, 'userId:', userId)
    if (from !== 'back') {
      navigationHistory.push({ type: 'user', id: userId, from })
    }

    if (showHubModal) {
      setShowHubModal(false)
    }
    if (showPostModal) {
      setShowPostModal(false)
    }

    closePostOverlay();

    setSelectedUserId(userId)
    setShowProfileModal(true)
    setProfileModalFrom(from)
  }



  const closeHubModal = () => {
    console.log('Closing hub modal, from was:', hubModalFrom)
    if (hubModalFrom === 'list-modal' && previousList) {
      openListModal(previousList, 'hub-modal-back')
    } else if (hubModalFrom === 'profile-modal' && previousUserId) {
      openProfileModal(previousUserId, 'hub-modal-back')
    }
    
    setShowHubModal(false)
    setSelectedHub(null)
    setHubModalFrom(null)
    setPreviousList(null)
    setPreviousUserId(null)
  }
  
  const closeListModal = () => {
    console.log('Closing list modal, from was:', listModalFrom)
    if (listModalFrom === 'profile-modal' && previousUserId) {
      openProfileModal(previousUserId, 'list-modal-back')
    }
    
    setShowListModal(false)
    setSelectedList(null)
    setListModalFrom(null)
    setPreviousUserId(null)
  }
  
  const closeProfileModal = () => {
    console.log('Closing profile modal')
    setShowProfileModal(false)
    setSelectedUserId(null)
    setProfileModalFrom(null)
  }


  
  const goBack = async () => {
    // History-driven where modal stack applies (list/user/hub). Pops the
    // current entry, then re-opens whatever was underneath it.
    const lastState = navigationHistory.pop();
    const currentState = navigationHistory.peek();
    console.log('Going back from:', lastState, 'to:', currentState);

    // Always close the current hub modal first if one is open — popping the
    // history entry alone leaves it on screen.
    if (lastState?.type === 'hub' && showHubModal) {
      setShowHubModal(false);
      setSelectedHub(null);
      setHubModalOptions(null);
      setHubModalFrom(null);
    }

    if (currentState) {
      if (currentState.type === 'list') {
        const list = await firebaseDataService.getList(currentState.id);
        if (list) openListModal(list, 'back');
        return;
      }
      if (currentState.type === 'user') {
        openProfileModal(currentState.id, 'back');
        return;
      }
      if (currentState.type === 'hub') {
        // Re-open the underlying hub from history.
        const place = await firebaseDataService.getPlace(currentState.id);
        if (place) {
          setSelectedHub(place as unknown as Hub);
          setShowHubModal(true);
        }
        return;
      }
    }
    // Empty stack — exit the modal flow entirely.
    if (showHubModal || showListModal || showProfileModal) {
      exitModalFlow();
      return;
    }
    try { navigate(-1) } catch { exitModalFlow() }
  };

  const openFullScreenHub = (hub: Hub) => {
    closeHubModal()
    navigate(`/place/${hub.id}`)
  }

  const openFullScreenList = (list: List) => {
    closeListModal()
    navigate(`/list/${list.id}`)
  }

  const openFullScreenUser = (userId: string) => {
    closeProfileModal()
    navigate(`/user/${userId}`)
  }

  const exitModalFlow = () => {
    setShowHubModal(false)
    setShowListModal(false)
    setShowProfileModal(false)
    setShowPostModal(false)
    // Clear the associated data too — otherwise the next time a modal is
    // opened via the same context, stale `selectedHub` / `selectedList` flash
    // before the new data resolves.
    setSelectedHub(null)
    setSelectedList(null)
    setSelectedUserId(null)
    setSelectedPostId(null)
    setHubModalOptions(null)
    setHubModalFrom(null)
    setListModalFrom(null)
    setProfileModalFrom(null)
    setPreviousList(null)
    setPreviousUserId(null)
    navigationHistory.clear()
  }

  const value: NavigationContextType = {
    showHubModal,
    showListModal,
    showProfileModal,
    selectedHub,
    selectedList,
    selectedUserId,
    selectedPostId,
    hubModalOptions,
    showPostOverlay,
    openHubModal,
    openListModal,
    openProfileModal,
    openPostOverlay,
    closePostOverlay,
    closeHubModal,
    closeListModal,
    closeProfileModal,
    goBack,
    exitModalFlow,
  }

  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  )
}
