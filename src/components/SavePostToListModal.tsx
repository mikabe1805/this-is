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
        const lists = await firebaseDataService.getUserLists(currentUser.uid);
        setUserLists(lists);
      }
    };
    if (isOpen) {
      fetchLists();
    }
  }, [isOpen, currentUser]);

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
            userId: currentUser.uid,
        };
        const newListId = await firebaseDataService.createList(newListData);
        if (newListId) {
            onSave(newListId);
        }
        setShowCreateList(false);
        onClose();
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl shadow-lg border border-gray-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Save Post to List</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4">
          {!showCreateList ? (
            <>
              <div className="mb-4">
                <label className="block font-medium text-sm mb-2">Choose a list</label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {userLists.map(list => (
                    <label key={list.id} className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer border ${selectedListId === list.id ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50'}`}>
                      <input type="radio" name="selectedList" value={list.id} checked={selectedListId === list.id} onChange={(e) => setSelectedListId(e.target.value)} className="w-4 h-4 text-blue-600 focus:ring-blue-500"/>
                      <div className="flex-1">
                        <span className="font-medium">{list.name}</span>
                        {list.privacy === 'private' && <LockClosedIcon className="w-4 h-4 inline-block ml-2 text-gray-400" />}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              <button onClick={() => setShowCreateList(true)} className="w-full p-2 rounded-lg border-2 border-dashed text-gray-500 hover:border-gray-400 hover:bg-gray-50 flex items-center justify-center gap-2 mb-4">
                <PlusIcon className="w-5 h-5" /> Create New List
              </button>
              <button onClick={handleSave} disabled={!selectedListId} className="w-full py-2 rounded-lg font-semibold bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50">
                Save to List
              </button>
            </>
          ) : (
            <div className="space-y-4">
              <input type="text" value={newListName} onChange={(e) => setNewListName(e.target.value)} placeholder="List name" className="w-full p-2 rounded-lg border" />
              <textarea value={newListDescription} onChange={(e) => setNewListDescription(e.target.value)} placeholder="Description" className="w-full p-2 rounded-lg border" rows={3} />
              <select value={newListPrivacy} onChange={(e) => setNewListPrivacy(e.target.value as any)} className="w-full p-2 rounded-lg border">
                <option value="public">Public</option>
                <option value="friends">Friends</option>
                <option value="private">Private</option>
              </select>
              <div className="flex gap-2">
                <button onClick={() => setShowCreateList(false)} className="flex-1 py-2 rounded-lg border">Cancel</button>
                <button onClick={handleCreateList} disabled={!newListName.trim()} className="flex-1 py-2 rounded-lg font-semibold bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50">
                  Create and Save
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
