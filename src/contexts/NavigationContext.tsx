import React, { createContext, useContext, useState, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { navigationHistory } from '../utils/navigationHistory.js'
import type { Hub, List, Place } from '../types/index.js'

interface NavigationContextType {
  // Modal states
  showHubModal: boolean
  showListModal: boolean
  selectedHub: Hub | null
  selectedList: List | null
  hubModalFromList: boolean // Track if hub modal was opened from list modal
  listModalFromList: boolean // Track if list modal was opened from another list modal
  previousListModal: List | null // Store previous list when opening from list
  
  // Navigation methods
  openHubModal: (hub: Hub, from?: string) => void
  openListModal: (list: List, from?: string) => void
  closeHubModal: () => void
  closeListModal: () => void
  navigateToHub: (hub: Hub, from?: string) => void
  navigateToList: (list: List, from?: string) => void
  goBack: () => void
  goBackFromHubModal: () => void
  goBackFromListModal: () => void
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
  const [selectedHub, setSelectedHub] = useState<Hub | null>(null)
  const [selectedList, setSelectedList] = useState<List | null>(null)
  const [hubModalFromList, setHubModalFromList] = useState(false)
  const [listModalFromList, setListModalFromList] = useState(false)
  const [previousListModal, setPreviousListModal] = useState<List | null>(null)

  const openHubModal = (hub: Hub, from: string = 'unknown') => {
    console.log('Opening hub modal from:', from, 'hub:', hub.name)
    setSelectedHub(hub)
    setShowHubModal(true)
    setHubModalFromList(from === 'list-modal')
    
    if (from === 'list-modal') {
      // Store the current list modal state and close it
      setPreviousListModal(selectedList)
      setShowListModal(false)
      setSelectedList(null)
    } else {
      // Close list modal if it's open
      setShowListModal(false)
    }
    
    navigationHistory.push({ from: from as any, hubId: hub.id })
  }

  const openListModal = (list: List, from: string = 'unknown') => {
    console.log('Opening list modal from:', from, 'list:', list.name)
    
    if (from === 'list-modal' && selectedList) {
      // If opening from another list modal, store the current one
      setListModalFromList(true)
      setPreviousListModal(selectedList)
    } else {
      setListModalFromList(false)
      setPreviousListModal(null)
    }
    
    setSelectedList(list)
    setShowListModal(true)
    navigationHistory.push({ from: from as any, listId: list.id })
  }

  const closeHubModal = () => {
    console.log('NavigationContext: closeHubModal called')
    setShowHubModal(false)
    setSelectedHub(null)
    setHubModalFromList(false)
  }

  const goBackFromHubModal = () => {
    console.log('Going back from hub modal, hubModalFromList:', hubModalFromList)
    if (hubModalFromList && previousListModal) {
      // If hub modal was opened from list modal, reopen the list modal
      setShowHubModal(false)
      setSelectedHub(null)
      setHubModalFromList(false)
      setSelectedList(previousListModal)
      setShowListModal(true)
      setPreviousListModal(null)
    } else {
      // Default back navigation
      navigate(-1)
    }
  }

  const goBackFromListModal = () => {
    console.log('Going back from list modal, listModalFromList:', listModalFromList)
    if (listModalFromList && previousListModal) {
      // If list modal was opened from another list modal, go back to the previous list
      setSelectedList(previousListModal)
      setListModalFromList(false)
      setPreviousListModal(null)
    } else {
      // Close the modal and go back
      closeListModal()
      navigate(-1)
    }
  }

  const closeListModal = () => {
    console.log('Closing list modal')
    setShowListModal(false)
    setSelectedList(null)
    setListModalFromList(false)
    setPreviousListModal(null)
  }

  const navigateToHub = (hub: Hub, from: string = 'unknown') => {
    navigationHistory.push({ from: from as any, hubId: hub.id })
    navigate(`/place/${hub.id}`)
  }

  const navigateToList = (list: List, from: string = 'unknown') => {
    navigationHistory.push({ from: from as any, listId: list.id })
    navigate(`/list/${list.id}`)
  }

  const goBack = () => {
    console.log('Going back in browser history')
    navigate(-1)
  }

  const openFullScreenHub = (hub: Hub) => {
    console.log('Opening full screen hub:', hub.name)
    // Close the modal first, then navigate
    setShowHubModal(false)
    setSelectedHub(null)
    setHubModalFromList(false)
    navigate(`/place/${hub.id}`)
  }

  const openFullScreenList = (list: List) => {
    console.log('Opening full screen list:', list.name)
    // Close the modal first, then navigate
    setShowListModal(false)
    setSelectedList(null)
    setListModalFromList(false)
    setPreviousListModal(null)
    navigate(`/list/${list.id}`)
  }

  const openFullScreenUser = (userId: string) => {
    console.log('Opening full screen user profile:', userId)
    navigate(`/user/${userId}`)
  }

  const value: NavigationContextType = {
    showHubModal,
    showListModal,
    selectedHub,
    selectedList,
    hubModalFromList,
    listModalFromList,
    previousListModal,
    openHubModal,
    openListModal,
    closeHubModal,
    closeListModal,
    navigateToHub,
    navigateToList,
    goBack,
    goBackFromHubModal,
    goBackFromListModal,
    openFullScreenHub,
    openFullScreenList,
    openFullScreenUser
  }

  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  )
} 