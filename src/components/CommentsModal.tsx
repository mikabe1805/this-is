import { XMarkIcon, HeartIcon, PaperAirplaneIcon, UserIcon } from '@heroicons/react/24/outline'
import { HeartIcon as HeartIconSolid } from '@heroicons/react/24/solid'
import { useState, useRef, useEffect } from 'react'
import { useModalDismiss } from '../hooks/useModalDismiss'
import { useSwipeToDismiss } from '../hooks/useSwipeToDismiss'
import { createPortal } from 'react-dom'
import Button from './Button'

interface Comment {
  id: string
  userId: string
  username: string
  userAvatar: string
  text: string
  createdAt: string
  likes: number
  likedBy: string[]
  replies?: Comment[]
}

interface CommentsModalProps {
  isOpen: boolean
  onClose: () => void
  comments: Comment[]
  onAddComment: (text: string) => void
  onLikeComment: (commentId: string) => void
  onReplyToComment: (commentId: string, text: string) => void
}

const CommentsModal = ({ 
  isOpen, 
  onClose, 
  comments, 
  onAddComment, 
  onLikeComment, 
  onReplyToComment
}: CommentsModalProps) => {
  const [newComment, setNewComment] = useState('')
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [likedComments, setLikedComments] = useState<Set<string>>(new Set())
  const [isSubmitting, setIsSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const replyInputRef = useRef<HTMLInputElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)

  // Bottom-sheet swipe-down-to-dismiss. Only fires on touch devices and
  // only when the sheet isn't scrolled (so dragging within the comment
  // list doesn't accidentally close the modal).
  useSwipeToDismiss({ ref: sheetRef, onDismiss: onClose, enabled: isOpen })

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  useEffect(() => {
    if (replyingTo && replyInputRef.current) {
      setTimeout(() => replyInputRef.current?.focus(), 100)
    }
  }, [replyingTo])

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim() || isSubmitting) return

    setIsSubmitting(true)
    try {
      await onAddComment(newComment.trim())
      setNewComment('')
    } catch (error) {
      console.error('Error adding comment:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmitReply = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!replyText.trim() || !replyingTo || isSubmitting) return

    setIsSubmitting(true)
    try {
      await onReplyToComment(replyingTo, replyText.trim())
      setReplyText('')
      setReplyingTo(null)
    } catch (error) {
      console.error('Error adding reply:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleLikeComment = (commentId: string) => {
    setLikedComments(prev => {
      const newSet = new Set(prev)
      if (newSet.has(commentId)) {
        newSet.delete(commentId)
      } else {
        newSet.add(commentId)
      }
      return newSet
    })
    onLikeComment(commentId)
  }

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))
    
    if (diffInMinutes < 1) return 'now'
    if (diffInMinutes < 60) return `${diffInMinutes}m`
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h`
    return `${Math.floor(diffInMinutes / 1440)}d`
  }

  useModalDismiss(isOpen, onClose)

  if (!isOpen) return null

  return createPortal(
    <div 
      className="fixed inset-0 flex items-end sm:items-center justify-center z-[99999]"
      style={{ background: 'rgba(46, 28, 13, 0.55)', backdropFilter: 'blur(6px)', zIndex: 99999 }}
      onClick={onClose}
    >
      <div
        ref={sheetRef}
        className="relative modal-paper w-full sm:max-w-md max-h-[85vh] rounded-t-[24px] sm:rounded-[24px] overflow-hidden flex flex-col"
        style={{ boxShadow: '0 -8px 40px rgba(46, 28, 13, 0.25), 0 24px 60px rgba(46, 28, 13, 0.30)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle — only this area is wired for swipe-to-dismiss so
            scrolling within the comment list doesn't accidentally close. */}
        <div data-drag-handle className="sm:hidden flex justify-center py-3 shrink-0 cursor-grab touch-none" aria-hidden>
          <span className="w-10 h-1 rounded-full bg-ink-faint" />
        </div>
        <div data-drag-handle className="flex items-center justify-between px-5 py-4 border-b border-edge">
          <p className="label-eyebrow text-ink-mute">Comments {comments.length > 0 && <span className="text-ink-faint">· {comments.length}</span>}</p>
          <button
            onClick={onClose}
            className="h-9 w-9 rounded-full hover:bg-paper-deep flex items-center justify-center"
            aria-label="Close"
          >
            <XMarkIcon className="w-5 h-5 text-ink" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {comments.length === 0 ? (
            <div className="text-center py-10">
              <span className="inline-flex h-12 w-12 rounded-full glass-honey items-center justify-center">
                <HeartIcon className="w-5 h-5" />
              </span>
              <p className="font-display text-[22px] text-ink leading-tight mt-3">Quiet here.</p>
              <p className="text-[13px] text-ink-soft mt-1">Be the first to share your thoughts.</p>
            </div>
          ) : (
            <ul className="divide-y divide-edge -mx-1">
              {comments.map((comment) => (
                <li key={comment.id} className="px-1 py-4">
                  <div className="flex items-start gap-3">
                    <div className="shrink-0 w-9 h-9 rounded-full overflow-hidden bg-paper-deep ring-1 ring-edge flex items-center justify-center">
                      {comment.userAvatar ? (
                        <img src={comment.userAvatar} alt={comment.username} className="w-full h-full object-cover" />
                      ) : (
                        <UserIcon className="w-4 h-4 text-ink-mute" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="text-[14px] font-medium text-ink truncate">{comment.username}</span>
                        <span className="font-mono text-[10px] tracking-[0.10em] uppercase text-ink-mute">{formatTimeAgo(comment.createdAt)}</span>
                      </div>
                      <p className="text-[14px] text-ink-soft leading-relaxed mt-1 whitespace-pre-wrap">{comment.text}</p>
                      <div className="flex items-center gap-1 mt-2 -ml-2">
                        <button
                          onClick={() => handleLikeComment(comment.id)}
                          className={`h-8 px-2.5 rounded-full font-mono text-[11px] tracking-wide flex items-center gap-1.5 transition-colors ${
                            likedComments.has(comment.id) ? 'text-bloom-deep' : 'text-ink-mute hover:text-ink'
                          }`}
                        >
                          {likedComments.has(comment.id) ? <HeartIconSolid className="w-4 h-4" style={{ color: 'var(--bloom-deep)' }} /> : <HeartIcon className="w-4 h-4" />}
                          {comment.likes + (likedComments.has(comment.id) ? 1 : 0) || ''}
                        </button>
                        <button
                          onClick={() => setReplyingTo(comment.id)}
                          className="h-8 px-2.5 rounded-full font-mono text-[11px] tracking-wide text-ink-mute hover:text-ink"
                        >
                          Reply
                        </button>
                      </div>
                      {replyingTo === comment.id && (
                        <form onSubmit={handleSubmitReply} className="mt-3 flex gap-2">
                          <input
                            ref={replyInputRef}
                            type="text"
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            placeholder={`Reply to ${comment.username}…`}
                            className="flex-1 h-10 px-3.5 rounded-full bg-card border border-edge text-[13px] text-ink placeholder:text-ink-mute outline-none focus:border-ink/40"
                          />
                          <button type="submit" disabled={!replyText.trim() || isSubmitting} className="btn-cta h-10 px-4 text-[13px] font-semibold">
                            <PaperAirplaneIcon className="w-4 h-4" />
                          </button>
                        </form>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="px-5 py-4 border-t border-edge">
          <form onSubmit={handleSubmitComment} className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment…"
              className="flex-1 h-11 px-4 rounded-full bg-card border border-edge text-[14px] text-ink placeholder:text-ink-mute outline-none focus:border-ink/40"
            />
            <button type="submit" disabled={!newComment.trim() || isSubmitting} className="btn-cta h-11 px-5 font-semibold text-[14px] flex items-center justify-center">
              {isSubmitting ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <PaperAirplaneIcon className="w-5 h-5" />
              )}
            </button>
          </form>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default CommentsModal 