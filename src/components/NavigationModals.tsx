import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useNavigation } from '../contexts/NavigationContext.tsx'
import { useModal } from '../contexts/ModalContext.tsx'
import { navigationHistory } from '../utils/navigationHistory.js'
import HubModal from './HubModal'
import ListModal from './ListModal'
import ProfileModal from './ProfileModal'
import PostModal from './PostModal'

const NavigationModals = () => {
  const navigate = useNavigate()
  const { 
    showHubModal, 
    showListModal, 
    selectedHub, 
    selectedList, 
    hubModalFrom,
    listModalFrom,
    profileModalFrom,
    closeHubModal, 
    closeListModal,
    openHubModal,
    goBack,
    showProfileModal,
    selectedUserId,
    closeProfileModal,
    showPostModal,
    selectedPostId,
    closePostModal,
    hubModalOptions,
    postModalFrom,
    openFullScreenUser,
    showPostOverlay,
    closePostOverlay,
    exitModalFlow
  } = useNavigation()
  const { openSaveModal, openCreatePostModal } = useModal()

  const lastHistoryItem = navigationHistory.peek();

  return (
    <>
      {/* Hub Modal */}
      {selectedHub && lastHistoryItem?.type === 'hub' && (
        <HubModal
          isOpen={showHubModal}
          onClose={exitModalFlow}
          hub={selectedHub}
          initialTab={hubModalOptions?.initialTab}
          initialPostId={hubModalOptions?.postId}
          showPostOverlay={hubModalOptions?.showPostOverlay}
          showBackButton={navigationHistory.history.length > 1}
          onBack={goBack}
          onSave={(hub) => openSaveModal(hub)}
          onAddPost={(hub) => openCreatePostModal(hub)}
          onOpenFullScreen={(hub) => {
            closeHubModal()
            navigate(`/place/${hub.id}`)
          }}
        />
      )}

      {/* Post Overlay - rendered on top of HubModal */}
      {showPostOverlay && selectedPostId && (
        <PostModal
          isOpen={true}
          onClose={closePostOverlay}
          postId={selectedPostId}
          from="hub-modal-overlay"
          showBackButton={false}
        />
      )}
      
      {/* List Modal */}
      {selectedList && !showPostOverlay && lastHistoryItem?.type === 'list' && (
        <ListModal
          isOpen={showListModal}
          onClose={exitModalFlow}
          list={selectedList}
          showBackButton={navigationHistory.history.length > 1}
          onBack={goBack}
          onSave={(list) => {
            closeListModal()
          }}
          onShare={(list) => {
          }}
          onAddPost={(list) => {
            closeListModal()
          }}
          onOpenFullScreen={(list) => {
            closeListModal()
            navigate(`/list/${list.id}`)
          }}
          onOpenHub={(place) => {
            openHubModal(place, 'list-modal')
          }}
        />
      )}

      {/* Profile Modal */}
      {selectedUserId && lastHistoryItem?.type === 'user' && (
        <ProfileModal
          isOpen={showProfileModal}
          onClose={exitModalFlow}
          userId={selectedUserId}
          showBackButton={navigationHistory.history.length > 1}
          onBack={goBack}
          onOpenFullScreen={() => selectedUserId && openFullScreenUser(selectedUserId)}
        />
      )}


    </>
  )
}

export default NavigationModals
