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
  showPostModal: boolean
  selectedHub: Hub | null
  selectedList: List | null
  selectedUserId: string | null
  selectedPostId: string | null
  hubModalOptions: { initialTab?: 'overview' | 'posts', postId?: string, showPostOverlay?: boolean } | null
  
  // Back navigation tracking
  hubModalFrom: string | null
  listModalFrom: string | null
  profileModalFrom: string | null
  previousList: List | null
  previousUserId: string | null,
  postModalFrom: string | null

  // Navigation methods
  openHubModal: (hub: Hub, from?: string, options?: { initialTab?: 'overview' | 'posts', postId?: string, showPostOverlay?: boolean }) => void
  openListModal: (list: List, from?: string) => void
  openProfileModal: (userId: string, from?: string) => void
  openPostModal: (postId: string, from?: string) => void
  closeHubModal: () => void
  closeListModal: () => void
  closeProfileModal: () => void
  closePostModal: () => void
  goBack: () => void
  openFullScreenHub: (hub: Hub) => void
  openFullScreenList: (list: List) => void
  openFullScreenUser: (userId: string) => void
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
  const [hubModalOptions, setHubModalOptions] = useState<{ initialTab?: 'overview' | 'posts', postId?: string, showPostOverlay?: boolean } | null>(null)

  const openHubModal = (hub: Hub, from: string = 'unknown', options: { initialTab?: 'overview' | 'posts', postId?: string, showPostOverlay?: boolean } = {}) => {
    console.log('Opening hub modal from:', from, 'hub:', hub.name, 'options:', options)
    navigationHistory.push({ type: 'hub', id: hub.id, from })
    
    if (showListModal) {
      setPreviousList(selectedList)
      setShowListModal(false)
    } else if (showProfileModal) {
      setPreviousUserId(selectedUserId)
      setShowProfileModal(false)
    } else if (showPostModal) {
      // Keep previous user id if we came from a post modal that was opened from a profile
      if (postModalFrom === 'profile-modal') {
        // Don't reset previousUserId
      }
      setShowPostModal(false)
    }

    setSelectedHub(hub)
    setHubModalOptions(options)
    setShowHubModal(true)
    if (!from.endsWith('-back')) {
      setHubModalFrom(from)
    }
  }

  const openListModal = (list: List, from: string = 'unknown') => {
    console.log('Opening list modal from:', from, 'list:', list.name)
    navigationHistory.push({ type: 'list', id: list.id, from })

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
    navigationHistory.push({ type: 'user', id: userId, from })

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

  const openPostModal = async (postId: string, from: string = 'unknown') => {
    console.log('Opening post modal from:', from, 'postId:', postId);
    navigationHistory.push({ type: 'post', id: postId, from });

    setSelectedPostId(postId);
    setPostModalFrom(from);
    setShowPostModal(true);
  };

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

  const closePostModal = () => {
    console.log('Closing post modal, from was:', postModalFrom)
    if (postModalFrom === 'profile-modal' && previousUserId) {
      openProfileModal(previousUserId, 'post-modal-back')
    }

    setShowPostModal(false)
    setSelectedPostId(null)
    setPostModalFrom(null)
  }
  
  const goBack = () => {
    navigationHistory.pop() // Pop the current state
    const lastState = navigationHistory.peek() // Peek at the new last state
    console.log('Going back, last state is now:', lastState)

    if (showHubModal) {
      // Special case: Hub -> Post -> Profile
      if (hubModalFrom === 'post-modal' && postModalFrom === 'profile-modal' && previousUserId) {
        setShowHubModal(false)
        setSelectedHub(null)
        openProfileModal(previousUserId, 'hub-modal-back')
        return
      }
      closeHubModal()
    }
    else if (showListModal) closeListModal()
    else if (showPostModal) closePostModal()
    else if (showProfileModal) closeProfileModal()
    else navigate(-1)
  }

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

  const value: NavigationContextType = {
    showHubModal,
    showListModal,
    showProfileModal,
    showPostModal,
    selectedHub,
    selectedList,
    selectedUserId,
    selectedPostId,
    hubModalFrom,
    listModalFrom,
    profileModalFrom,
    postModalFrom,
    hubModalOptions,
    previousList,
    previousUserId,
    openHubModal,
    openListModal,
    openProfileModal,
    openPostModal,
    closeHubModal,
    closeListModal,
    closeProfileModal,
    closePostModal,
    goBack,
    openFullScreenHub,
    openFullScreenList,
    openFullScreenUser,
  }

  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  )
}
