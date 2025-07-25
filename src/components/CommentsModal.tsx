import { XMarkIcon, HeartIcon, PaperAirplaneIcon, UserIcon } from '@heroicons/react/24/outline'
import { HeartIcon as HeartIconSolid } from '@heroicons/react/24/solid'
import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

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

  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[1003] p-4">
      <div 
        className="bg-white/95 backdrop-blur-glass w-full max-w-md max-h-[80vh] rounded-3xl shadow-crystal border border-white/30 overflow-hidden animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-linen-200/50 bg-gradient-to-r from-sage-50/50 to-linen-50/50">
          <h2 className="text-lg font-semibold text-charcoal-800">Comments</h2>
          <button
            onClick={onClose}
            className="text-charcoal-500 hover:text-charcoal-700 transition-colors p-1 rounded-lg hover:bg-white/50"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Comments List */}
        <div className="flex-1 overflow-y-auto max-h-96 p-4 space-y-4">
          {comments.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-gradient-to-br from-sage-100 to-sage-200 rounded-full flex items-center justify-center mx-auto mb-3">
                <HeartIcon className="w-8 h-8 text-sage-600" />
              </div>
              <p className="text-charcoal-500 mb-2">No comments yet</p>
              <p className="text-sm text-charcoal-400">Be the first to share your thoughts!</p>
            </div>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 shadow-soft border border-cream-200/50">
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div className="flex-shrink-0">
                    {comment.userAvatar ? (
                      <div className="w-10 h-10 rounded-full border-2 border-white/80 bg-cream-50/80 backdrop-blur-sm relative overflow-hidden">
                        <img
                          src={comment.userAvatar}
                          alt={comment.username}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 border border-white/30 rounded-full"></div>
                      </div>
                    ) : (
                      <div className="w-10 h-10 bg-gradient-to-br from-sage-100 to-sage-200 rounded-full flex items-center justify-center border-2 border-white/80">
                        <UserIcon className="w-5 h-5 text-sage-600" />
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-charcoal-800 text-sm">{comment.username}</span>
                      <span className="text-xs text-charcoal-400">{formatTimeAgo(comment.createdAt)}</span>
                    </div>
                    
                    <p className="text-charcoal-700 text-sm leading-relaxed mb-2">{comment.text}</p>
                    
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => handleLikeComment(comment.id)}
                        className="flex items-center gap-1 text-xs text-charcoal-500 hover:text-coral-600 transition-colors"
                      >
                        {likedComments.has(comment.id) ? (
                          <HeartIconSolid className="w-4 h-4 text-coral-600" />
                        ) : (
                          <HeartIcon className="w-4 h-4" />
                        )}
                        <span>{comment.likes + (likedComments.has(comment.id) ? 1 : 0)}</span>
                      </button>
                      
                      <button
                        onClick={() => setReplyingTo(comment.id)}
                        className="text-xs text-charcoal-500 hover:text-sage-600 transition-colors font-medium"
                      >
                        Reply
                      </button>
                    </div>

                    {/* Reply Input */}
                    {replyingTo === comment.id && (
                      <form onSubmit={handleSubmitReply} className="mt-3">
                        <div className="flex gap-2">
                          <input
                            ref={replyInputRef}
                            type="text"
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            placeholder={`Reply to ${comment.username}...`}
                            className="flex-1 px-3 py-2 bg-white/80 backdrop-blur-sm border border-linen-200/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sage-300/50 focus:border-transparent transition-all"
                          />
                          <button
                            type="submit"
                            disabled={!replyText.trim() || isSubmitting}
                            className="px-3 py-2 bg-gradient-to-r from-sage-600 to-sage-700 text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:from-sage-700 hover:to-sage-800 transition-all"
                          >
                            <PaperAirplaneIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Comment Input */}
        <div className="border-t border-linen-200/50 p-4 bg-gradient-to-r from-sage-50/30 to-linen-50/30">
          <form onSubmit={handleSubmitComment} className="flex gap-3">
            <input
              ref={inputRef}
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment..."
              className="flex-1 px-4 py-3 bg-white/80 backdrop-blur-sm border border-linen-200/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-sage-300/50 focus:border-transparent transition-all"
            />
            <button
              type="submit"
              disabled={!newComment.trim() || isSubmitting}
              className="px-4 py-3 bg-gradient-to-r from-sage-600 to-sage-700 text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:from-sage-700 hover:to-sage-800 transition-all shadow-soft hover:shadow-liquid"
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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