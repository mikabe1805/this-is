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
  
  // Navigation methods
  openHubModal: (hub: Hub, from?: string) => void
  openListModal: (list: List, from?: string) => void
  closeHubModal: () => void
  closeListModal: () => void
  navigateToHub: (hub: Hub, from?: string) => void
  navigateToList: (list: List, from?: string) => void
  goBack: () => void
  goBackFromHubModal: () => void
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
    setSelectedList(list)
    setShowListModal(true)
    navigationHistory.push({ from: from as any, listId: list.id })
  }

  const closeHubModal = () => {
    console.log('Closing hub modal')
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

  const closeListModal = () => {
    console.log('Closing list modal')
    setShowListModal(false)
    setSelectedList(null)
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
    const previousState = navigationHistory.peek()
    console.log('Going back, previous state:', previousState)
    
    if (previousState?.from === 'list-modal') {
      // Go back to list modal
      console.log('Going back to list modal')
      setShowHubModal(false)
      setShowListModal(true)
    } else if (previousState?.from === 'hub-modal') {
      // Go back to hub modal
      console.log('Going back to hub modal')
      setShowListModal(false)
      setShowHubModal(true)
    } else {
      // Default back navigation
      console.log('Going back in browser history')
      navigate(-1)
    }
  }

  const value: NavigationContextType = {
    showHubModal,
    showListModal,
    selectedHub,
    selectedList,
    hubModalFromList,
    openHubModal,
    openListModal,
    closeHubModal,
    closeListModal,
    navigateToHub,
    navigateToList,
    goBack,
    goBackFromHubModal
  }

  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  )
} 