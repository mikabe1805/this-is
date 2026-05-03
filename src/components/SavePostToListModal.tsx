import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { XMarkIcon, PlusIcon, LockClosedIcon, UserGroupIcon, GlobeAltIcon } from '@heroicons/react/24/outline';
import type { List, Post } from '../types/index.js';
import { firebaseDataService } from '../services/firebaseDataService.ts';
import { useAuth } from '../contexts/AuthContext.tsx';

interface SavePostToListModalProps {
  isOpen: boolean;
  onClose: () => void;
  post: Post;
  onSave: (listId: string) => void;
  onCreateList: (listData: { name: string; description: string; privacy: 'public' | 'private' | 'friends'; tags: string[] }) => void;
}

const SavePostToListModal: React.FC<SavePostToListModalProps> = ({
  isOpen,
  onClose,
  post,
  onSave,
  onCreateList
}) => {
  const { currentUser } = useAuth();
  const [userLists, setUserLists] = useState<List[]>([]);
  const [selectedListId, setSelectedListId] = useState<string>('');
  const [showCreateList, setShowCreateList] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [newListDescription, setNewListDescription] = useState('');
  const [newListPrivacy, setNewListPrivacy] = useState<'public' | 'private' | 'friends'>('public');

  useEffect(() => {
    const fetchLists = async () => {
      if (currentUser) {
        const lists = await firebaseDataService.getUserLists(currentUser.id);
        setUserLists(lists);
      }
    };
    if (isOpen) {
      fetchLists();
    }
  }, [isOpen, currentUser]);

  // Flush form state on close so the next open is clean. Without this, the
  // "Create new list" toggle and any half-typed name/description carry over
  // between save flows.
  useEffect(() => {
    if (!isOpen) {
      setSelectedListId('');
      setShowCreateList(false);
      setNewListName('');
      setNewListDescription('');
      setNewListPrivacy('public');
    }
  }, [isOpen]);

  const handleSave = () => {
    if (selectedListId) {
      onSave(selectedListId);
      onClose();
    }
  };

  const handleCreateList = async () => {
    if (newListName.trim() && currentUser) {
        const newListData = {
            name: newListName.trim(),
            description: newListDescription.trim(),
            privacy: newListPrivacy,
            tags: [],
            userId: currentUser.id,
        };
        const newListId = await firebaseDataService.createList(newListData);
        if (newListId) {
            onSave(newListId);
        }
        // Clear form before closing so reopen is fresh.
        setShowCreateList(false);
        setNewListName('');
        setNewListDescription('');
        setNewListPrivacy('public');
        onClose();
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center sm:p-4 bg-[#1A1815]/55 backdrop-blur-sm" onClick={onClose}>
      <div
        className="modal-paper w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border border-edge overflow-hidden"
        style={{ boxShadow: '0 18px 60px rgba(46, 28, 13, 0.22)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div data-drag-handle className="sm:hidden flex justify-center py-3 shrink-0" aria-hidden>
          <span className="w-10 h-1 rounded-full bg-ink-faint" />
        </div>
        <div className="flex items-center justify-between px-5 py-4 border-b border-edge relative z-10">
          <p className="label-eyebrow text-ink-mute">Save post to list</p>
          <button type="button" onClick={onClose} aria-label="Close" className="h-9 w-9 rounded-full hover:bg-paper-deep flex items-center justify-center text-ink">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
        <div className="px-5 py-5 relative z-10">
          {!showCreateList ? (
            <>
              <p className="label-eyebrow text-ink-mute mb-2.5">Choose a list</p>
              <div className="space-y-1.5 max-h-48 overflow-y-auto -mx-1 px-1 mb-4">
                {userLists.map(list => {
                  const checked = selectedListId === list.id
                  return (
                    <label
                      key={list.id}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${checked ? 'bg-paper-deep' : 'hover:bg-paper-deep'}`}
                    >
                      <input
                        type="radio"
                        name="selectedList"
                        value={list.id}
                        checked={checked}
                        onChange={(e) => setSelectedListId(e.target.value)}
                        className="w-4 h-4 accent-ink"
                      />
                      <div className="flex-1 min-w-0 flex items-center gap-1.5">
                        <span className="text-[14px] font-medium text-ink truncate">{list.name}</span>
                        {list.privacy === 'private' && <LockClosedIcon className="w-3.5 h-3.5 text-ink-mute shrink-0" />}
                      </div>
                    </label>
                  )
                })}
              </div>
              <button
                type="button"
                onClick={() => setShowCreateList(true)}
                className="w-full h-11 rounded-full border border-dashed border-edge text-ink-soft hover:border-ink/30 hover:text-ink transition-colors inline-flex items-center justify-center gap-2 mb-4 label-eyebrow"
              >
                <PlusIcon className="w-4 h-4" />
                New list
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!selectedListId}
                className="btn-cta w-full h-12 font-semibold text-[15px] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save to list
              </button>
            </>
          ) : (
            <div className="space-y-3">
              <div>
                <label htmlFor="post-to-list-name" className="label-eyebrow text-ink-mute mb-1.5 block">List name</label>
                <input
                  id="post-to-list-name"
                  type="text"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  placeholder="e.g., Coffee spots"
                  className="w-full h-11 px-4 rounded-full border border-edge bg-card text-[14px] text-ink placeholder:text-ink-mute outline-none focus:border-ink/40"
                />
              </div>
              <div>
                <label htmlFor="post-to-list-desc" className="label-eyebrow text-ink-mute mb-1.5 block">
                  Description <span className="text-ink-faint">· optional</span>
                </label>
                <textarea
                  id="post-to-list-desc"
                  value={newListDescription}
                  onChange={(e) => setNewListDescription(e.target.value)}
                  placeholder="What's this list about?"
                  rows={3}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-edge bg-card text-[14px] text-ink placeholder:text-ink-mute outline-none focus:border-ink/40 resize-none"
                />
              </div>
              <div>
                <label htmlFor="post-to-list-privacy" className="label-eyebrow text-ink-mute mb-1.5 block">Privacy</label>
                <select
                  id="post-to-list-privacy"
                  value={newListPrivacy}
                  onChange={(e) => setNewListPrivacy(e.target.value as 'public' | 'friends' | 'private')}
                  className="w-full h-11 px-4 rounded-full border border-edge bg-card text-[14px] text-ink outline-none focus:border-ink/40"
                >
                  <option value="public">Public</option>
                  <option value="friends">Friends only</option>
                  <option value="private">Private</option>
                </select>
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowCreateList(false)} className="btn-secondary flex-1 h-12 font-medium text-[15px]">
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleCreateList}
                  disabled={!newListName.trim()}
                  className="btn-cta flex-1 h-12 font-semibold text-[15px] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Create &amp; save
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default SavePostToListModal;
