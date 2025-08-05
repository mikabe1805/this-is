import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { XMarkIcon, HeartIcon, EyeIcon, MapPinIcon, ChatBubbleLeftIcon } from '@heroicons/react/24/outline';
import { HeartIcon as SolidHeartIcon } from '@heroicons/react/20/solid';
import type { Post, Hub, User, List, PostComment } from '../types/index.js';
import { firebaseDataService } from '../services/firebaseDataService';
import { useNavigation } from '../contexts/NavigationContext.tsx';
import { useAuth } from '../contexts/AuthContext.tsx';
import { formatTimestamp } from '../utils/dateUtils.ts';
import SavePostToListModal from './SavePostToListModal.tsx';

interface PostModalProps {
  postId: string;
  from?: string;
  isOpen: boolean;
  onClose: () => void;
  showBackButton?: boolean;
  onBack?: () => void;
}

const PostModal = ({ postId, from, isOpen, onClose, showBackButton, onBack }: PostModalProps) => {
  const { currentUser } = useAuth();
  const [post, setPost] = useState<Post | null>(null);
  const [hub, setHub] = useState<Hub | null>(null);
  const [author, setAuthor] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const { openHubModal, openProfileModal } = useNavigation();
  const [isVisible, setIsVisible] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const [showSaveToListModal, setShowSaveToListModal] = useState(false);
  const [userLists, setUserLists] = useState<List[]>([]);

  const [comments, setComments] = useState<PostComment[]>([]);
  const [commentCount, setCommentCount] = useState(0);

  const [newComment, setNewComment] = useState('');

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => setIsVisible(true), 10);
    } else {
      setIsVisible(false);
    }
  }, [isOpen]);

  useEffect(() => {
    const fetchPostData = async () => {
      if (isOpen && postId) {
        setLoading(true);
        try {
          const fetchedPost = await firebaseDataService.getPost(postId);
          setPost(fetchedPost);

          if (fetchedPost) {
            const fetchedComments = await firebaseDataService.getCommentsForPost(fetchedPost.id);
            setComments(fetchedComments);
            setCommentCount(fetchedComments.length);

            if (fetchedPost.hubId) {
              const fetchedHub = await firebaseDataService.getPlace(fetchedPost.hubId);
              setHub(fetchedHub);
            }
            if (fetchedPost.userId) {
              const fetchedAuthor = await firebaseDataService.getCurrentUser(fetchedPost.userId);
              setAuthor(fetchedAuthor);
            }
          }
        } catch (error) {
          console.error("Error fetching post data:", error);
        } finally {
          setLoading(false);
        }
      }
    };

    const fetchUserLists = async () => {
      if (currentUser?.id) {
        const lists = await firebaseDataService.getUserLists(currentUser.id);
        setUserLists(lists);
      }
    };

    fetchPostData();
    fetchUserLists();
  }, [isOpen, postId, currentUser]);

  useEffect(() => {
    if (post && currentUser) {
      setIsLiked(post.likedBy?.includes(currentUser.id) || false);
      setLikeCount(post.likes || 0);
    }
  }, [post, currentUser]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  const handleLike = async () => {
    if (!currentUser || !post) return;

    const newLikedState = !isLiked;
    const newLikeCount = newLikedState ? likeCount + 1 : likeCount - 1;

    setIsLiked(newLikedState);
    setLikeCount(newLikeCount);

    await firebaseDataService.likePost(post.id, currentUser.id);
  };

  const handleHubClick = () => {
    if (hub && post) {
      openHubModal(hub, 'post-modal', { initialTab: 'posts', postId: post.id });
    }
  };

  const handleSaveToList = async (listId: string, note?: string) => {
    if (!post) return;
    await firebaseDataService.savePostToList(post.id, listId);
    setShowSaveToListModal(false);
  };

  const handleAuthorClick = () => {
    if (author) {
      openProfileModal(author.id, 'post-modal');
    }
  };

  const handlePostComment = async () => {
    if (!currentUser || !post || !newComment.trim()) return;

    const postedComment = await firebaseDataService.postComment(post.id, currentUser.id, newComment);
    if (postedComment) {
      setComments(prevComments => [postedComment, ...prevComments]);
      setCommentCount(prevCount => prevCount + 1);
      setNewComment('');
    }
  };

  const handleCreateList = async (listData: { name: string; description: string; privacy: 'public' | 'private' | 'friends'; tags: string[] }) => {
    if (!currentUser || !post) return;

    const newListData = { ...listData, userId: currentUser.id };
    const newListId = await firebaseDataService.createList(newListData);

    if (newListId) {
      await handleSaveToList(newListId);
      
      // Refresh user lists to include the new one
      const lists = await firebaseDataService.getUserLists(currentUser.id);
      setUserLists(lists);
    }
  };

  if (!isOpen) {
    return null;
  }

  const renderPostTypeIcon = () => {
    if (!post) return null;
    if (post.postType === 'loved') {
      return (
        <div className="flex items-center gap-1 bg-[#FF6B6B]/80 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-sm font-semibold border border-white/50">
          <HeartIcon className="w-4 h-4"/>
          <span>Loved</span>
        </div>
      );
    }
    if (post.postType === 'tried') {
      return (
        <div className="flex items-center gap-1 bg-[#4CAF50]/80 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-sm font-semibold border border-white/50">
          <EyeIcon className="w-4 h-4"/>
          <span>Tried</span>
        </div>
      );
    }
    return null;
  };

  const modalContent = (
    <>
      <div className={`fixed inset-0 z-[10000] flex items-center justify-center transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose}></div>
        <div
          ref={modalRef}
          className={`relative bg-gradient-to-br from-[#FDFBF7] to-[#F3EBE2] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl border border-white/20 transition-all duration-300 ${isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}
          style={{ fontFamily: "'Inter', sans-serif" }}
        >
          {/* Header */}
          <div className="p-4 flex items-center justify-between border-b border-[#E8D4C0]/50">
            <div className="w-10"></div>
            <h2 className="text-xl font-bold text-[#5D4A2E] font-serif truncate">{post?.description.substring(0, 30) || 'Post'}...</h2>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-[#E8D4C0]/30 transition-colors">
              <XMarkIcon className="w-6 h-6 text-[#7A5D3F]" />
            </button>
          </div>

          {/* Content */}
          <div className="overflow-y-auto flex-1">
            {loading ? (
              <div className="flex justify-center items-center h-full">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#9A7B5A]"></div>
              </div>
            ) : !post ? (
              <div className="text-center py-10 text-[#7A5D3F]">Post not found.</div>
            ) : (
              <div>
                {post.images && post.images.length > 0 && (
                  <img src={post.images[0]} alt="Post" className="w-full h-80 object-cover" />
                )}
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      {hub && (
                        <div onClick={handleHubClick} className="flex items-center gap-2 text-lg text-[#7A5D3F] mb-2 cursor-pointer group">
                          <MapPinIcon className="w-5 h-5 text-[#9A7B5A]"/>
                          <span className="font-semibold text-[#5D4A2E] group-hover:underline">{hub.name}</span>
                        </div>
                      )}
                       <p className="text-sm text-[#7A5D3F]">{formatTimestamp(post.createdAt)}</p>
                    </div>
                    {renderPostTypeIcon()}
                  </div>

                  <p className="text-[#5D4A2E] leading-relaxed font-sans text-base mb-6">{post.description}</p>

                  {post.tags && post.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-6">
                      {post.tags.map(tag => (
                        <span key={tag} className="px-3 py-1 bg-[#E8D4C0]/50 text-[#7A5D3F] text-sm font-medium rounded-full">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between mb-6 pb-6 border-b border-[#E8D4C0]/50">
                    <div className="flex items-center space-x-4 text-sm text-[#8B7355]">
                      <button onClick={handleLike} className="flex items-center active:scale-95 transition-transform duration-200">
                        {isLiked ? <SolidHeartIcon className="w-6 h-6 mr-2 text-[#FF6B6B]" /> : <HeartIcon className="w-6 h-6 mr-2 text-[#FF6B6B]" />}
                        <span className="font-semibold">{likeCount}</span>
                      </button>
                      <div className="flex items-center">
                        <ChatBubbleLeftIcon className="w-6 h-6 mr-2 text-[#7A5D3F]" />
                        <span className="font-semibold">{commentCount}</span>
                      </div>
                    </div>
                    <button onClick={() => setShowSaveToListModal(true)} className="text-[#A67C52] text-sm font-medium font-serif active:scale-95 transition-transform duration-200 bg-[#E8D4C0]/40 px-4 py-2 rounded-lg border border-transparent hover:border-[#A67C52]/50">
                      Save to List
                    </button>
                  </div>
                  
                  {/* Comments Section */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-bold text-[#5D4A2E]">Comments ({commentCount})</h3>
                    
                    {/* Comment Input Form */}
                    <div className="flex items-start gap-2 pb-4 border-b border-[#E8D4C0]/50">
                      <img src={currentUser?.avatar || '/assets/default-avatar.png'} alt="Your avatar" className="w-10 h-10 rounded-full border-2 border-white" />
                      <div className="flex-1">
                        <textarea
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          placeholder="Add a comment..."
                          className="w-full px-4 py-2 border border-linen-300 rounded-xl bg-linen-100 text-charcoal-700 focus:outline-none focus:ring-2 focus:ring-sage-300 transition"
                          rows={2}
                        />
                        <button onClick={handlePostComment} className="mt-2 px-4 py-2 bg-sage-500 text-white rounded-xl hover:bg-sage-600 transition-colors font-semibold disabled:bg-sage-300" disabled={!newComment.trim()}>
                          Post Comment
                        </button>
                      </div>
                    </div>

                    {/* Comments List */}
                    <div className="space-y-4 max-h-60 overflow-y-auto pr-2">
                      {comments.map(comment => (
                        <div key={comment.id} className="flex items-start gap-3">
                          <img src={comment.userAvatar || '/assets/default-avatar.png'} alt={comment.username} className="w-10 h-10 rounded-full border-2 border-white" />
                          <div>
                            <p className="font-semibold text-[#5D4A2E]">{comment.username}</p>
                            <p className="text-sm text-[#7A5D3F]">{comment.text}</p>
                            <p className="text-xs text-[#A67C52] mt-1">{formatTimestamp(comment.createdAt)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {author && (
                    <div onClick={handleAuthorClick} className="flex items-center gap-3 bg-white/50 backdrop-blur-sm rounded-xl p-3 shadow-md border border-white/30 mt-6 cursor-pointer">
                       <img src={author.avatar || '/assets/default-avatar.png'} alt={author.name} className="w-12 h-12 rounded-full border-2 border-white" />
                       <div>
                         <p className="font-semibold text-[#5D4A2E]">{author.name}</p>
                         <p className="text-sm text-[#7A5D3F]">@{author.username}</p>
                       </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {post && (
        <SavePostToListModal
          isOpen={showSaveToListModal}
          onClose={() => setShowSaveToListModal(false)}
          post={post}
          userLists={userLists}
          onSave={handleSaveToList}
          onCreateList={handleCreateList}
        />
      )}
    </>
  );

  return createPortal(
    modalContent,
    document.body
  );
};

export default PostModal;
