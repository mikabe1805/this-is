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


  const openHubModal = (hub: Hub, from: string = 'unknown', options: { initialTab?: 'overview' | 'posts', postId?: string, showPostOverlay?: boolean } = {}) => {
    console.log('Opening hub modal from:', from, 'hub:', hub.name, 'options:', options)
    if (from !== 'back') {
      navigationHistory.push({ type: 'hub', id: hub.id, from })
    }
    
    if (showListModal) {
      setShowListModal(false)
    } else if (showProfileModal) {
      setShowProfileModal(false)
    }
    
    closePostOverlay();

    setSelectedHub(hub)
    setHubModalOptions(options)
    setShowHubModal(true)
    if (!from.endsWith('-back')) {
      setHubModalFrom(from)
    }
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
    const lastState = navigationHistory.pop();
    const currentState = navigationHistory.peek();
    console.log('Going back from:', lastState, 'to:', currentState);

    if (currentState) {
      if (currentState.type === 'hub') {
        const hub = await firebaseDataService.getPlace(currentState.id);
        if (hub) openHubModal(hub, 'back');
      } else if (currentState.type === 'list') {
        const list = await firebaseDataService.getList(currentState.id);
        if (list) openListModal(list, 'back');
      } else if (currentState.type === 'user') {
        openProfileModal(currentState.id, 'back');
      }
    } else {
      exitModalFlow();
    }
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
    navigationHistory.clear()
  }

  const value: NavigationContextType = {
    showHubModal,
    showListModal,
    showProfileModal,
    showPostModal,
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
    goBack,
    exitModalFlow,
  }

  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  )
}
