import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { XMarkIcon, HeartIcon, MapPinIcon, ChatBubbleLeftIcon, CheckCircleIcon, BookmarkIcon } from '@heroicons/react/24/outline';
import { HeartIcon as SolidHeartIcon } from '@heroicons/react/20/solid';
import type { Post, Hub, User, List, PostComment } from '../types/index.js';
import { firebaseDataService } from '../services/firebaseDataService';
import { useNavigation } from '../contexts/NavigationContext.tsx';
import { useAuth } from '../contexts/AuthContext.tsx';
import { useModal } from '../contexts/ModalContext.tsx';
import { formatTimestamp } from '../utils/dateUtils.ts';
import { useSwipeToDismiss } from '../hooks/useSwipeToDismiss';
import TagPill from './TagPill'

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
  const { openSaveModal } = useModal();
  const [post, setPost] = useState<Post | null>(null);
  const [hub, setHub] = useState<Hub | null>(null);
  const [author, setAuthor] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const { openHubModal, openProfileModal } = useNavigation();
  const [isVisible, setIsVisible] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  useSwipeToDismiss({ ref: modalRef, onDismiss: onClose, enabled: isOpen });

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
          console.log('PostModal: Fetching post data for postId:', postId);
          const fetchedPost = await firebaseDataService.getPost(postId);
          setPost(fetchedPost);

          if (fetchedPost) {
            console.log('PostModal: Post fetched successfully, fetching comments...');
            const fetchedComments = await firebaseDataService.getCommentsForPost(fetchedPost.id);
            console.log('PostModal: Comments fetched:', fetchedComments.length, 'comments');
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
          } else {
            console.error('PostModal: Post not found for postId:', postId);
          }
        } catch (error) {
          console.error("PostModal: Error fetching post data:", error);
        } finally {
          setLoading(false);
        }
      }
    };

    fetchPostData();
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

  const handleSaveHub = () => {
    if (hub) {
      openSaveModal(hub);
    }
  };

  const handleAuthorClick = () => {
    if (author) {
      openProfileModal(author.id, 'post-modal');
    }
  };

  const handlePostComment = async () => {
    if (!currentUser || !post || !newComment.trim()) return;

    // Hold on to the draft so we can restore it on failure — clearing the
    // input optimistically before the write returned would lose the user's
    // text if the call failed. Surface failures via the global toast.
    const draft = newComment;
    setNewComment('');
    try {
      const postedComment = await firebaseDataService.postComment(post.id, currentUser.id, draft);
      if (postedComment) {
        setComments(prevComments => [postedComment, ...prevComments]);
        setCommentCount(prevCount => prevCount + 1);
      } else {
        setNewComment(draft);
        window.dispatchEvent(new CustomEvent('this-is:toast', { detail: { message: "Couldn't post comment. Try again.", tone: 'error' } }));
      }
    } catch (e) {
      console.error('PostModal: Failed to post comment', e);
      setNewComment(draft);
      window.dispatchEvent(new CustomEvent('this-is:toast', { detail: { message: "Couldn't post comment. Try again.", tone: 'error' } }));
    }
  };

  if (!isOpen) {
    return null;
  }

  const renderPostTypeIcon = () => {
    if (!post) return null;
    const base = 'inline-flex items-center gap-1 h-7 px-2.5 rounded-full font-mono text-[10px] tracking-[0.10em] uppercase border'
    if (post.postType === 'loved') {
      return (
        <span className={base} style={{ background: 'rgba(168, 95, 42, 0.12)', color: 'var(--accent-deep)', borderColor: 'rgba(168, 95, 42, 0.25)' }}>
          <SolidHeartIcon className="w-3 h-3" />
          Loved
        </span>
      );
    }
    if (post.postType === 'tried') {
      return (
        <span className={`${base} bg-paper-deep text-ink border-edge`}>
          <CheckCircleIcon className="w-3 h-3" />
          Tried
        </span>
      );
    }
    if (post.postType === 'want') {
      return (
        <span className={`${base} bg-card text-ink-soft border-edge`}>
          <BookmarkIcon className="w-3 h-3" />
          Want
        </span>
      );
    }
    return null;
  };

  const modalContent = (
    <>
      <div className={`fixed inset-0 z-[10000] flex items-end sm:items-center justify-center transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
        <div className="absolute inset-0 bg-[#1A1815]/55 backdrop-blur-sm" onClick={onClose}></div>
        <div
          ref={modalRef}
          className={`relative modal-paper rounded-t-3xl sm:rounded-3xl border border-edge w-full sm:max-w-2xl max-h-[90vh] flex flex-col overflow-hidden transition-all duration-300 ${isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}
          style={{ boxShadow: '0 18px 60px rgba(46, 28, 13, 0.22), 0 4px 14px rgba(46, 28, 13, 0.08)' }}
        >
          {/* Drag handle (mobile) */}
          <div data-drag-handle className="sm:hidden flex justify-center py-3 shrink-0 touch-none" aria-hidden>
            <span className="w-10 h-1 rounded-full bg-ink-faint" />
          </div>
          {/* Header */}
          <div data-drag-handle className="px-5 py-4 flex items-center justify-between border-b border-edge">
            <div className="w-10"></div>
            <p className="label-eyebrow text-ink-mute">Post</p>
            <button onClick={onClose} className="h-9 w-9 rounded-full hover:bg-paper-deep flex items-center justify-center" aria-label="Close">
              <XMarkIcon className="w-5 h-5 text-ink" />
            </button>
          </div>

          {/* Content */}
          <div className="overflow-y-auto flex-1 relative z-10">
            {loading ? (
              <div className="flex justify-center items-center h-full py-16">
                <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-ink-mute">Loading…</span>
              </div>
            ) : !post ? (
              <div className="text-center py-10 text-ink-soft">Post not found.</div>
            ) : (
              <div>
                {post.images && post.images.length > 0 && (
                  <img src={post.images[0]} alt="" className="w-full h-72 object-cover" />
                )}
                <div className="px-5 pt-5 pb-4">
                  <div className="flex justify-between items-start mb-3">
                    <div className="min-w-0">
                      {hub && (
                        <button
                          type="button"
                          onClick={handleHubClick}
                          className="inline-flex items-center gap-1.5 text-ink-soft hover:text-ink transition-colors group"
                        >
                          <MapPinIcon className="w-4 h-4 text-accent-deep" />
                          <span className="font-display text-[18px] leading-tight text-ink group-hover:underline truncate">{hub.name}</span>
                        </button>
                      )}
                      <p className="font-mono text-[10px] tracking-[0.12em] uppercase text-ink-mute mt-1">{formatTimestamp(post.createdAt)}</p>
                    </div>
                    {renderPostTypeIcon()}
                  </div>

                  <p className="text-[14px] text-ink-soft leading-relaxed mb-5 whitespace-pre-wrap">{post.description}</p>

                  {post.tags && post.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-5">
                      {post.tags.map(tag => (
                        <TagPill key={tag} label={tag} size="sm" />
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between mb-5 pb-4 border-b border-edge">
                    <div className="flex items-center gap-4">
                      <button
                        type="button"
                        onClick={handleLike}
                        aria-label={isLiked ? 'Unlike post' : 'Like post'}
                        aria-pressed={isLiked}
                        className="inline-flex items-center gap-1.5 text-ink-mute hover:text-ink transition-colors"
                      >
                        {isLiked
                          ? <SolidHeartIcon className="w-5 h-5" style={{ color: 'var(--bloom-deep)' }} />
                          : <HeartIcon className="w-5 h-5" />
                        }
                        <span className="font-mono text-[12px] tracking-wide">{likeCount}</span>
                      </button>
                      <div className="inline-flex items-center gap-1.5 text-ink-mute">
                        <ChatBubbleLeftIcon className="w-5 h-5" />
                        <span className="font-mono text-[12px] tracking-wide">{commentCount}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleSaveHub}
                      className="btn-secondary h-9 px-4 label-eyebrow"
                    >
                      Save to list
                    </button>
                  </div>

                  {/* Comments Section */}
                  <div className="space-y-4">
                    <p className="label-eyebrow text-ink-mute">Comments · {commentCount}</p>

                    {/* Comment Input */}
                    <div className="flex items-start gap-2 pb-4 border-b border-edge">
                      <img src={currentUser?.avatar || '/assets/default-avatar.svg'} alt="" className="w-9 h-9 rounded-full ring-1 ring-edge object-cover" />
                      <div className="flex-1">
                        <textarea
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          placeholder="Add a comment…"
                          className="w-full px-3.5 py-2.5 border border-edge rounded-xl bg-card text-[14px] text-ink placeholder:text-ink-mute outline-none focus:border-ink/40 resize-none"
                          rows={2}
                        />
                        <button
                          type="button"
                          onClick={handlePostComment}
                          className="btn-cta mt-2 h-10 px-4 label-eyebrow disabled:opacity-50"
                          disabled={!newComment.trim()}
                        >
                          Post comment
                        </button>
                      </div>
                    </div>

                    {/* Comments List */}
                    <ul className="divide-y divide-edge">
                      {comments.map(comment => (
                        <li key={comment.id} className="flex items-start gap-3 py-3">
                          <img src={comment.userAvatar || '/assets/default-avatar.svg'} alt="" className="w-9 h-9 rounded-full ring-1 ring-edge object-cover shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2">
                              <span className="text-[14px] font-medium text-ink truncate">{comment.username}</span>
                              <span className="font-mono text-[10px] tracking-[0.10em] uppercase text-ink-mute">{formatTimestamp(comment.createdAt)}</span>
                            </div>
                            <p className="text-[14px] text-ink-soft leading-relaxed mt-1 whitespace-pre-wrap">{comment.text}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {author && (
                    <button
                      type="button"
                      onClick={handleAuthorClick}
                      className="w-full flex items-center gap-3 bg-card border border-edge rounded-2xl p-3 mt-5 hover:border-ink/30 transition-colors text-left"
                    >
                      <img src={author.avatar || '/assets/default-avatar.svg'} alt="" className="w-11 h-11 rounded-full ring-1 ring-edge object-cover" />
                      <div className="min-w-0">
                        <p className="font-display text-[16px] leading-tight text-ink truncate">{author.name}</p>
                        <p className="font-mono text-[10px] tracking-[0.10em] uppercase text-ink-mute mt-0.5 truncate">@{author.username}</p>
                      </div>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );

  return createPortal(
    modalContent,
    document.body
  );
};

export default PostModal;
