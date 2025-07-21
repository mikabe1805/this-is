import React, { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'
import type { Hub, List } from '../types/index.js'

interface ModalContextType {
  // Save Modal
  showSaveModal: boolean
  setShowSaveModal: (show: boolean) => void
  saveModalData: { hub?: Hub; list?: List } | null
  setSaveModalData: (data: { hub?: Hub; list?: List } | null) => void
  
  // Create Post Modal
  showCreatePost: boolean
  setShowCreatePost: (show: boolean) => void
  createPostData: { hub?: Hub; list?: List } | null
  setCreatePostData: (data: { hub?: Hub; list?: List } | null) => void
  
  // Helper functions
  openSaveModal: (hub?: Hub, list?: List) => void
  openCreatePostModal: (hub?: Hub, list?: List) => void
  closeSaveModal: () => void
  closeCreatePostModal: () => void
}

const ModalContext = createContext<ModalContextType | undefined>(undefined)

export const useModal = () => {
  const context = useContext(ModalContext)
  if (!context) {
    throw new Error('useModal must be used within a ModalProvider')
  }
  return context
}

interface ModalProviderProps {
  children: ReactNode
}

export const ModalProvider = ({ children }: ModalProviderProps) => {
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [saveModalData, setSaveModalData] = useState<{ hub?: Hub; list?: List } | null>(null)
  const [showCreatePost, setShowCreatePost] = useState(false)
  const [createPostData, setCreatePostData] = useState<{ hub?: Hub; list?: List } | null>(null)

  const openSaveModal = (hub?: Hub, list?: List) => {
    setSaveModalData({ hub, list })
    setShowSaveModal(true)
  }

  const openCreatePostModal = (hub?: Hub, list?: List) => {
    setCreatePostData({ hub, list })
    setShowCreatePost(true)
  }

  const closeSaveModal = () => {
    setShowSaveModal(false)
    setSaveModalData(null)
  }

  const closeCreatePostModal = () => {
    setShowCreatePost(false)
    setCreatePostData(null)
  }

  const value: ModalContextType = {
    showSaveModal,
    setShowSaveModal,
    saveModalData,
    setSaveModalData,
    showCreatePost,
    setShowCreatePost,
    createPostData,
    setCreatePostData,
    openSaveModal,
    openCreatePostModal,
    closeSaveModal,
    closeCreatePostModal
  }

  return (
    <ModalContext.Provider value={value}>
      {children}
    </ModalContext.Provider>
  )
} 