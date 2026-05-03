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
          onShare={() => { /* surface handled by ListModal share button */ }}
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
            const placeShape = {
              id: selectedHub.id,
              name: selectedHub.name,
              location: { address: (selectedHub as any).address || '' },
              tags: (selectedHub as any).tags || [],
              posts: [],
            }
            try { openSaveModal(placeShape as any) } catch {}
          }}
          onShare={() => {}}
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
            try {
              const currentUser = await firebaseDataService.getCurrentUser(authUser?.id || '');
              if (currentUser) {
                await firebaseDataService.followUser(currentUser.id, userId);
                console.log(`Followed user ${userId}`);
                // The ProfileModal will refresh its state when it re-renders
              }
            } catch (error) {
              console.error('Error following user:', error);
            }
          }}
          onOpenFullScreen={() => selectedUserId && openFullScreenUser(selectedUserId)}
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
