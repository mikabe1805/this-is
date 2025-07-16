import { XMarkIcon, HeartIcon, PaperAirplaneIcon, UserIcon } from '@heroicons/react/24/outline'
import { HeartIcon as HeartIconSolid } from '@heroicons/react/24/solid'
import { useState, useRef, useEffect } from 'react'

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
  postId: string
  postTitle: string
  comments: Comment[]
  onAddComment: (text: string) => void
  onLikeComment: (commentId: string) => void
  onReplyToComment: (commentId: string, text: string) => void
  currentUserId: string
}

const CommentsModal = ({ 
  isOpen, 
  onClose, 
  postId, 
  postTitle, 
  comments, 
  onAddComment, 
  onLikeComment, 
  onReplyToComment,
  currentUserId 
}: CommentsModalProps) => {
  const [newComment, setNewComment] = useState('')
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [likedComments, setLikedComments] = useState<Set<string>>(new Set())
  const [isSubmitting, setIsSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const replyInputRef = useRef<HTMLInputElement>(null)

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
    if (!newComment.trim()) return

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
    if (!replyText.trim() || !replyingTo) return

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

  const handleClose = () => {
    setNewComment('')
    setReplyingTo(null)
    setReplyText('')
    setIsSubmitting(false)
    onClose()
  }

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (diffInSeconds < 60) return 'now'
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}d ago`
    return date.toLocaleDateString()
  }

  const renderComment = (comment: Comment, isReply = false) => (
    <div key={comment.id} className={`${isReply ? 'ml-8 border-l-2 border-linen-200 pl-4' : ''}`}>
      <div className="flex items-start gap-3 mb-3">
        <img 
          src={comment.userAvatar} 
          alt={comment.username}
          className="w-8 h-8 rounded-full object-cover border border-white shadow-soft flex-shrink-0"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-charcoal-700 text-sm">{comment.username}</span>
            <span className="text-xs text-charcoal-400">{formatTimeAgo(comment.createdAt)}</span>
          </div>
          <p className="text-charcoal-600 text-sm mb-2 leading-relaxed">{comment.text}</p>
          <div className="flex items-center gap-4">
            <button
              onClick={() => handleLikeComment(comment.id)}
              className={`flex items-center gap-1 text-xs transition ${
                likedComments.has(comment.id) 
                  ? 'text-gold-600' 
                  : 'text-charcoal-400 hover:text-charcoal-600'
              }`}
            >
              <HeartIcon className={`w-3 h-3 ${likedComments.has(comment.id) ? 'fill-current' : ''}`} />
              {comment.likes + (likedComments.has(comment.id) ? 1 : 0)}
            </button>
            {!isReply && (
              <button
                onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                className="text-xs text-charcoal-400 hover:text-charcoal-600 transition"
              >
                Reply
              </button>
            )}
          </div>
          
          {/* Reply input */}
          {replyingTo === comment.id && (
            <form onSubmit={handleSubmitReply} className="mt-3">
              <div className="flex gap-2">
                <input
                  ref={replyInputRef}
                  type="text"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder={`Reply to ${comment.username}...`}
                  className="flex-1 px-3 py-2 text-sm rounded-lg border border-linen-200 bg-white text-charcoal-700 placeholder-charcoal-400 focus:outline-none focus:ring-2 focus:ring-sage-200 focus:border-transparent"
                  disabled={isSubmitting}
                />
                <button
                  type="submit"
                  disabled={!replyText.trim() || isSubmitting}
                  className="px-3 py-2 bg-sage-500 text-white rounded-lg text-sm font-medium hover:bg-sage-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  <PaperAirplaneIcon className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
      
      {/* Render replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="space-y-3">
          {comment.replies.map(reply => renderComment(reply, true))}
        </div>
      )}
    </div>
  )

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-charcoal-900/50 backdrop-blur-sm"
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-botanical border border-linen-200 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-linen-200">
          <h2 className="text-lg font-serif font-semibold text-charcoal-800">Comments</h2>
          <button
            onClick={handleClose}
            className="p-2 rounded-xl text-charcoal-400 hover:text-charcoal-600 hover:bg-linen-100 transition"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Post Title */}
        <div className="px-4 py-3 bg-linen-50 border-b border-linen-200">
          <p className="text-sm text-charcoal-600 font-medium">{postTitle}</p>
        </div>

        {/* Comments List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {comments.length > 0 ? (
            comments.map(comment => renderComment(comment))
          ) : (
            <div className="text-center py-8">
              <UserIcon className="w-12 h-12 text-linen-300 mx-auto mb-3" />
              <p className="text-charcoal-500 text-sm">No comments yet</p>
              <p className="text-charcoal-400 text-xs mt-1">Be the first to share your thoughts!</p>
            </div>
          )}
        </div>

        {/* Add Comment Form */}
        <div className="p-4 border-t border-linen-200 bg-white">
          <form onSubmit={handleSubmitComment} className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment..."
              className="flex-1 px-4 py-3 rounded-xl border border-linen-200 bg-white text-charcoal-700 placeholder-charcoal-400 focus:outline-none focus:ring-2 focus:ring-sage-200 focus:border-transparent"
              disabled={isSubmitting}
            />
            <button
              type="submit"
              disabled={!newComment.trim() || isSubmitting}
              className="px-4 py-3 bg-gradient-to-r from-sage-500 to-gold-500 text-white rounded-xl font-medium hover:shadow-botanical disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              <PaperAirplaneIcon className="w-5 h-5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default CommentsModal 