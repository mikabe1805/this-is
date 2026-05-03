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
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center sm:p-4 bg-[#1A1815]/55 backdrop-blur-sm" onClick={handleClose}>
      <div
        className="modal-paper relative w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border border-edge max-h-[90vh] flex flex-col overflow-hidden"
        style={{ boxShadow: '0 18px 60px rgba(46, 28, 13, 0.22)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div data-drag-handle className="sm:hidden flex justify-center py-3 shrink-0" aria-hidden>
          <span className="w-10 h-1 rounded-full bg-ink-faint" />
        </div>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-edge relative z-10">
          <p className="label-eyebrow text-ink-mute">Reply</p>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close"
            className="h-9 w-9 rounded-full hover:bg-paper-deep flex items-center justify-center text-ink"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Original Post */}
        <div className="px-5 py-4 border-b border-edge relative z-10">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-paper-deep ring-1 ring-edge flex items-center justify-center flex-shrink-0">
              <span className="font-display text-[16px] text-ink-soft">{postAuthor.charAt(0).toUpperCase()}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[13px] font-medium text-ink truncate">{postAuthor}</span>
                <span className="font-mono text-[10px] tracking-[0.10em] uppercase text-ink-mute">· original</span>
              </div>
              <p className="text-[13px] text-ink-soft leading-relaxed mb-2 whitespace-pre-wrap">{postContent}</p>
              {postImage && (
                <div className="w-20 h-20 rounded-[10px] overflow-hidden bg-paper-deep ring-1 ring-edge">
                  <img src={postImage} alt="" className="w-full h-full object-cover" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Reply Form */}
        <div className="flex-1 px-5 py-4 overflow-y-auto relative z-10">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="reply-text" className="sr-only">Reply</label>
              <textarea
                id="reply-text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder={`Reply to ${postAuthor}…`}
                rows={4}
                className="w-full px-3.5 py-3 rounded-xl border border-edge bg-card text-[14px] text-ink placeholder:text-ink-mute outline-none focus:border-ink/40 resize-none"
                disabled={isSubmitting}
              />
            </div>

            {/* Image Preview */}
            {images.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {images.map((image, index) => (
                  <div key={index} className="relative w-20 h-20 rounded-[10px] overflow-hidden bg-paper-deep ring-1 ring-edge">
                    <img src={image} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(index)}
                      aria-label={`Remove image ${index + 1}`}
                      className="absolute top-1 right-1 w-6 h-6 bg-[#1A1815]/70 text-white rounded-full flex items-center justify-center text-xs hover:bg-[#1A1815] transition-colors"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Action Row */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-9 w-9 rounded-full hover:bg-paper-deep flex items-center justify-center text-ink-mute hover:text-ink transition-colors"
                  disabled={images.length >= 4}
                  aria-label="Add photo"
                >
                  <PhotoIcon className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  className="h-9 w-9 rounded-full hover:bg-paper-deep flex items-center justify-center text-ink-mute hover:text-ink transition-colors"
                  aria-label="Add location"
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
                className="btn-cta h-11 px-5 inline-flex items-center justify-center gap-2 text-[14px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <PaperAirplaneIcon className="w-4 h-4" />
                {isSubmitting ? 'Posting…' : 'Reply'}
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