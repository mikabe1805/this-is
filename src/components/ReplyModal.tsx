import { XMarkIcon, PaperAirplaneIcon, PhotoIcon, MapPinIcon } from '@heroicons/react/24/outline'
import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'

interface ReplyModalProps {
  isOpen: boolean
  onClose: () => void
  postId: string
  postAuthor: string
  postContent: string
  postImage?: string
  onReply: (text: string, images?: string[]) => void
}

const ReplyModal = ({ 
  isOpen, 
  onClose, 
  postId, 
  postAuthor, 
  postContent, 
  postImage, 
  onReply 
}: ReplyModalProps) => {
  const [replyText, setReplyText] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!replyText.trim()) return

    setIsSubmitting(true)
    try {
      await onReply(replyText.trim(), images.length > 0 ? images : undefined)
      handleClose()
    } catch (error) {
      console.error('Error posting reply:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    setReplyText('')
    setImages([])
    setIsSubmitting(false)
    onClose()
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) {
      const newImages: string[] = []
      files.forEach(file => {
        const reader = new FileReader()
        reader.onload = (e) => {
          newImages.push(e.target?.result as string)
          if (newImages.length === files.length) {
            setImages(prev => [...prev, ...newImages])
          }
        }
        reader.readAsDataURL(file)
      })
    }
  }

  const handleRemoveImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index))
  }

  if (!isOpen) return null

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-charcoal-900/50 backdrop-blur-sm"
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-botanical border border-linen-200 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-linen-200">
          <h2 className="text-lg font-serif font-semibold text-charcoal-800">Reply</h2>
          <button
            onClick={handleClose}
            className="p-2 rounded-xl text-charcoal-400 hover:text-charcoal-600 hover:bg-linen-100 transition"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Original Post */}
        <div className="p-4 bg-linen-50 border-b border-linen-200">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-sage-100 flex items-center justify-center flex-shrink-0">
              <span className="text-sage-600 font-semibold text-sm">{postAuthor.charAt(0)}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-charcoal-700 text-sm">{postAuthor}</span>
                <span className="text-xs text-charcoal-400">• Original post</span>
              </div>
              <p className="text-charcoal-600 text-sm mb-2 leading-relaxed">{postContent}</p>
              {postImage && (
                <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-linen-100">
                  <img 
                    src={postImage} 
                    alt="Original post" 
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Reply Form */}
        <div className="flex-1 p-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-sage-500 to-gold-500 flex items-center justify-center flex-shrink-0">
                <span className="text-white font-semibold text-sm">M</span>
              </div>
              <div className="flex-1">
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder={`Reply to ${postAuthor}...`}
                  rows={4}
                  className="w-full px-4 py-3 rounded-xl border border-linen-200 bg-white text-charcoal-700 placeholder-charcoal-400 focus:outline-none focus:ring-2 focus:ring-sage-200 focus:border-transparent resize-none"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {/* Image Preview */}
            {images.length > 0 && (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  {images.map((image, index) => (
                    <div key={index} className="relative w-20 h-20 rounded-lg overflow-hidden bg-linen-100">
                      <img 
                        src={image} 
                        alt={`Upload ${index + 1}`} 
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(index)}
                        className="absolute top-1 right-1 w-6 h-6 bg-charcoal-900/70 text-white rounded-full flex items-center justify-center text-xs hover:bg-charcoal-900 transition"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 rounded-lg text-charcoal-400 hover:text-charcoal-600 hover:bg-linen-100 transition"
                  disabled={images.length >= 4}
                >
                  <PhotoIcon className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  className="p-2 rounded-lg text-charcoal-400 hover:text-charcoal-600 hover:bg-linen-100 transition"
                >
                  <MapPinIcon className="w-5 h-5" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </div>
              <button
                type="submit"
                disabled={!replyText.trim() || isSubmitting}
                className="px-6 py-2 bg-gradient-to-r from-sage-500 to-gold-500 text-white rounded-xl font-medium hover:shadow-botanical disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
              >
                <PaperAirplaneIcon className="w-4 h-4" />
                {isSubmitting ? 'Posting...' : 'Reply'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}

export default ReplyModal 