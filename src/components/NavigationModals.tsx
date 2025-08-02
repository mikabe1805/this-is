import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useNavigation } from '../contexts/NavigationContext.tsx'
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
    openFullScreenUser
  } = useNavigation()

  return (
    <>
      {/* Hub Modal */}
      {selectedHub && (
        <HubModal
          isOpen={showHubModal}
          onClose={closeHubModal}
          hub={selectedHub}
          initialTab={hubModalOptions?.initialTab}
          initialPostId={hubModalOptions?.postId}
          showPostOverlay={hubModalOptions?.showPostOverlay}
          showBackButton={!!hubModalFrom}
          onBack={goBack}
          onAddPost={(hub) => {
            closeHubModal()
          }}
          onSave={(hub) => {
            closeHubModal()
          }}
          onOpenFullScreen={(hub) => {
            closeHubModal()
            navigate(`/place/${hub.id}`)
          }}
        />
      )}

      {/* Conditionally render PostModal as an overlay for the HubModal */}
      {showHubModal && hubModalOptions?.showPostOverlay && hubModalOptions.postId && (
        <PostModal
          isOpen={true}
          onClose={closeHubModal} // Close the whole stack
          postId={hubModalOptions.postId}
          from="hub-modal-overlay"
          showBackButton={false}
          onBack={goBack}
        />
      )}
      
      {/* List Modal */}
      {selectedList && (
        <ListModal
          isOpen={showListModal}
          onClose={closeListModal}
          list={selectedList}
          showBackButton={!!listModalFrom}
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
            const mockHub = {
              id: place.id,
              name: place.name,
              description: `A wonderful place to visit and experience.`,
              tags: place.tags,
              images: [],
              location: {
                address: place.address,
                lat: 37.7749,
                lng: -122.4194,
              },
              googleMapsUrl: 'https://www.google.com/maps',
              mainImage: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=300&fit=crop',
              posts: [],
              lists: [],
            }
            openHubModal(mockHub, 'list-modal')
          }}
        />
      )}

      {/* Profile Modal */}
      {selectedUserId && (
        <ProfileModal
          isOpen={showProfileModal}
          onClose={closeProfileModal}
          userId={selectedUserId}
          showBackButton={!!profileModalFrom}
          onBack={goBack}
          onOpenFullScreen={() => selectedUserId && openFullScreenUser(selectedUserId)}
        />
      )}

      {/* Standalone Post Modal, rendered on top of other modals */}
      {selectedPostId && showPostModal && (
        <PostModal
          isOpen={showPostModal}
          onClose={closePostModal}
          postId={selectedPostId}
          from={postModalFrom || 'unknown'}
          showBackButton={!!postModalFrom}
          onBack={goBack}
        />
      )}
    </>
  )
}

export default NavigationModals
