import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNavigation } from '../contexts/NavigationContext.tsx'
import { useModal } from '../contexts/ModalContext.tsx'
import { useAuth } from '../contexts/AuthContext.tsx'
import { firebaseDataService } from '../services/firebaseDataService'
import { firebaseListService } from '../services/firebaseListService'
import { navigationHistory } from '../utils/navigationHistory.js'
// HubModal restored: only used for the in-modal stack flow (e.g. user clicks
// a place from inside ListModal). Direct /place/:id navigation still goes
// to the full PlaceHub route.
import HubModal from './HubModal'
import ListModal from './ListModal'
import ProfileModal from './ProfileModal'
import PostModal from './PostModal'
import EditListModal from './EditListModal'
import PrivacyModal from './PrivacyModal'
import ConfirmModal from './ConfirmModal'
import type { List } from '../types/index.js'
import { shareLink, placeShareUrl, listShareUrl, userShareUrl } from '../utils/share'

const NavigationModals = () => {
  const navigate = useNavigate()
  const { currentUser: authUser } = useAuth()
  const {
    showHubModal,
    showListModal,
    selectedHub,
    selectedList,
    closeHubModal,
    closeListModal,
    openHubModal,
    goBack,
    showProfileModal,
    selectedUserId,
    closeProfileModal,
    selectedPostId,
    hubModalOptions,
    openFullScreenUser,
    showPostOverlay,
    closePostOverlay,
    exitModalFlow,
  } = useNavigation()
  const { openSaveModal, openCreatePostModal } = useModal()

  // Edit / Privacy / Delete handlers — work from any page where ListModal
  // is open, not just /profile. Was previously only listened to on Profile.
  const [editTarget, setEditTarget] = useState<List | null>(null)
  const [privacyTarget, setPrivacyTarget] = useState<List | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<List | null>(null)

  useEffect(() => {
    const fetchAndSet = (id: string, set: (l: List) => void) => {
      firebaseDataService.getList(id).then(l => { if (l) set(l) }).catch(() => {})
    }
    const onEdit = (e: Event) => {
      const id = (e as CustomEvent).detail?.listId as string
      if (id) fetchAndSet(id, setEditTarget)
    }
    const onPrivacy = (e: Event) => {
      const id = (e as CustomEvent).detail?.listId as string
      if (id) fetchAndSet(id, setPrivacyTarget)
    }
    const onDelete = (e: Event) => {
      const id = (e as CustomEvent).detail?.listId as string
      if (id) fetchAndSet(id, setDeleteTarget)
    }
    window.addEventListener('openEditListFromModal', onEdit)
    window.addEventListener('openPrivacyFromModal', onPrivacy)
    window.addEventListener('openDeleteFromModal', onDelete)
    return () => {
      window.removeEventListener('openEditListFromModal', onEdit)
      window.removeEventListener('openPrivacyFromModal', onPrivacy)
      window.removeEventListener('openDeleteFromModal', onDelete)
    }
  }, [])

  const lastHistoryItem = navigationHistory.peek();

  return (
    <>
      {/* Post Overlay - standalone */}
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
            // "Save list" = nest this list inside one of the current user's
            // lists (folder-style). Open the dedicated picker mounted in App.
            window.dispatchEvent(new CustomEvent('openSaveListToFolder', { detail: { list } }))
            closeListModal()
          }}
          onShare={async () => {
            if (!selectedList?.id) return
            const status = await shareLink({
              title: selectedList.name,
              text: `${selectedList.name} on this·is`,
              url: listShareUrl(selectedList.id),
            })
            if (status === 'copied') {
              window.dispatchEvent(new CustomEvent('this-is:toast', { detail: { message: 'Link copied' } }))
            }
          }}
          onAddPost={(list) => {
            openCreatePostModal(undefined, list)
            closeListModal()
          }}
          onOpenFullScreen={(list) => {
            closeListModal()
            navigate(`/list/${list.id}`)
          }}
          onOpenHub={(place) => {
            openHubModal(place, 'list-modal')
          }}
          onEditList={(list) => {
            window.dispatchEvent(new CustomEvent('openEditListFromModal', { detail: { listId: list.id } }))
          }}
          onChangePrivacy={(list) => {
            window.dispatchEvent(new CustomEvent('openPrivacyFromModal', { detail: { listId: list.id } }))
          }}
          onDeleteList={(list) => {
            window.dispatchEvent(new CustomEvent('openDeleteFromModal', { detail: { listId: list.id } }))
          }}
        />
      )}

      {/* Hub Modal — only renders during in-modal-stack flow. Standalone
          /place/:id navigation still uses the full PlaceHub route. */}
      {selectedHub && showHubModal && (
        <HubModal
          isOpen={showHubModal}
          onClose={goBack}
          hub={selectedHub}
          showBackButton={navigationHistory.history.length > 1}
          onBack={goBack}
          onOpenFullScreen={() => {
            // Tear down the modal stack and route to the full page.
            exitModalFlow()
            navigate(`/place/${selectedHub.id}`)
          }}
          onSave={() => {
            // Forward the full hub metadata so ensureHubFromPlace can write
            // a complete place doc (photos / primaryType / types / coords).
            const h = selectedHub as unknown as {
              id: string; name: string; address?: string;
              location?: { address?: string; lat?: number; lng?: number };
              coordinates?: { lat?: number; lng?: number };
              tags?: string[];
              photos?: { name: string }[];
              primaryType?: string; types?: string[]; mainImage?: string;
            }
            const placeShape = {
              id: h.id,
              name: h.name,
              address: h.address || h.location?.address || '',
              location: h.location || { address: h.address || '' },
              coordinates: h.coordinates || (h.location?.lat && h.location?.lng ? { lat: h.location.lat, lng: h.location.lng } : undefined),
              tags: h.tags || [],
              photos: Array.isArray(h.photos) ? h.photos : [],
              primaryType: h.primaryType,
              types: h.types,
              mainImage: h.mainImage,
              posts: [],
            }
            try { openSaveModal(placeShape as never) } catch (e) { console.warn('[hub-modal] openSaveModal failed', e) }
          }}
          onShare={async () => {
            if (!selectedHub?.id) return
            const status = await shareLink({
              title: selectedHub.name,
              text: `${selectedHub.name} on this·is`,
              url: placeShareUrl(selectedHub.id),
            })
            if (status === 'copied') {
              window.dispatchEvent(new CustomEvent('this-is:toast', { detail: { message: 'Link copied' } }))
            }
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
          onFollow={async (userId) => {
            // Toggle: query whether currentUser already follows the target,
            // then call unfollow / follow accordingly. Was always calling
            // followUser, which made the "Following" button a no-op.
            try {
              if (!authUser?.id) return
              const following = await firebaseDataService.getUserFollowing(authUser.id);
              const already = following.some(u => u.id === userId);
              if (already) {
                await firebaseDataService.unfollowUser(authUser.id, userId);
              } else {
                await firebaseDataService.followUser(authUser.id, userId);
              }
            } catch (error) {
              console.error('Error toggling follow:', error);
            }
          }}
          onOpenFullScreen={() => selectedUserId && openFullScreenUser(selectedUserId)}
          onShare={async (user) => {
            if (!user?.id) return
            const status = await shareLink({
              title: user.name || user.username,
              text: `@${user.username} on this·is`,
              url: userShareUrl(user.id),
            })
            if (status === 'copied') {
              window.dispatchEvent(new CustomEvent('this-is:toast', { detail: { message: 'Link copied' } }))
            }
          }}
        />
      )}

      <EditListModal
        isOpen={!!editTarget}
        onClose={() => setEditTarget(null)}
        list={editTarget}
        onSave={(listData) => {
          if (editTarget) {
            firebaseListService.updateList(editTarget.id, listData)
            try {
              window.dispatchEvent(new CustomEvent('this-is:listUpdated', {
                detail: { listId: editTarget.id, fields: Object.keys(listData) }
              }))
            } catch (e) { console.warn('[nav-modals] list-updated dispatch failed', e) }
          }
        }}
      />

      <PrivacyModal
        isOpen={!!privacyTarget}
        onClose={() => setPrivacyTarget(null)}
        currentPrivacy={privacyTarget?.privacy || 'public'}
        onPrivacyChange={(p) => {
          if (privacyTarget) firebaseListService.updateList(privacyTarget.id, { privacy: p })
        }}
        listName={privacyTarget?.name || ''}
      />

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete list"
        message={deleteTarget ? `Delete "${deleteTarget.name}"? This can't be undone.` : ''}
        confirmText="Delete"
        type="danger"
        onConfirm={() => {
          if (deleteTarget) {
            firebaseListService.deleteList(deleteTarget.id)
            try {
              window.dispatchEvent(new CustomEvent('this-is:listDeleted', { detail: { listId: deleteTarget.id } }))
            } catch (e) { console.warn('[nav-modals] list-deleted dispatch failed', e) }
            closeListModal()
          }
        }}
      />
    </>
  )
}

export default NavigationModals
