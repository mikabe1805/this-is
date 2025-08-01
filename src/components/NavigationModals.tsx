import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useNavigation } from '../contexts/NavigationContext.tsx'
import HubModal from './HubModal'
import ListModal from './ListModal'
import ProfileModal from './ProfileModal'

const NavigationModals = () => {
  const navigate = useNavigate()
  const { 
    showHubModal, 
    showListModal, 
    selectedHub, 
    selectedList, 
    hubModalFromList,
    closeHubModal, 
    closeListModal,
    openHubModal,
    goBackFromHubModal,
    showProfileModal,
    selectedUserId,
    closeProfileModal
  } = useNavigation()

  const handleHubModalBack = () => {
    goBackFromHubModal()
  }

  const handleListModalBack = () => {
    closeListModal()
  }



  return (
    <>
      {/* Hub Modal */}
      {selectedHub && (
        <HubModal
          isOpen={showHubModal}
          onClose={closeHubModal}
          hub={selectedHub}
          showBackButton={hubModalFromList}
          onBack={handleHubModalBack}
          onAddPost={(hub) => {
            // Convert hub to the format expected by CreatePost
            const createPostHub = {
              id: hub.id,
              name: hub.name,
              address: hub.location.address,
              description: hub.description,
              lat: hub.location.lat,
              lng: hub.location.lng,
            }
            // TODO: Open create post modal
            closeHubModal()
          }}
          onSave={(hub) => {
            // TODO: Open save modal
            closeHubModal()
          }}
          onOpenFullScreen={(hub) => {
            console.log('Opening hub full screen:', hub.name)
            closeHubModal()
            // Navigate to the full hub page using React Router
            navigate(`/place/${hub.id}`)
          }}
        />
      )}

      {/* List Modal */}
      {selectedList && (
        <ListModal
          isOpen={showListModal}
          onClose={closeListModal}
          list={selectedList}
          showBackButton={false}
          onBack={handleListModalBack}
          onSave={(list) => {
            console.log('Saving list:', list.name)
            closeListModal()
          }}
          onShare={(list) => {
            console.log('Sharing list:', list.name)
            // TODO: Open share modal
          }}
          onAddPost={(list) => {
            console.log('Adding post to list:', list.name)
            closeListModal()
            // TODO: Open create post modal
          }}
          onOpenFullScreen={(list) => {
            console.log('Opening list full screen:', list.name)
            closeListModal()
            // Navigate to the full list page using React Router
            navigate(`/list/${list.id}`)
          }}
          onOpenHub={(place) => {
            console.log('Opening hub from list:', place.name)
            // Create a mock hub for the place
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
            // Open the hub modal using the navigation context
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
        />
      )}
    </>
  )
}

export default NavigationModals 