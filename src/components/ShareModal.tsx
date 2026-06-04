import { XMarkIcon, LinkIcon, ShareIcon, ChatBubbleLeftIcon, EnvelopeIcon, DocumentDuplicateIcon, CheckIcon } from '@heroicons/react/24/outline'
import { useRef, useState } from 'react'
import { useModalDismiss } from '../hooks/useModalDismiss'
import { useSwipeToDismiss } from '../hooks/useSwipeToDismiss'
import { createPortal } from 'react-dom'

interface ShareModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  description: string
  url: string
  image?: string
  type: 'place' | 'list' | 'post'
}

const ShareModal = ({ isOpen, onClose, title, description, url, image, type }: ShareModalProps) => {
  const [copied, setCopied] = useState(false)
  const [selectedOption, setSelectedOption] = useState<string | null>(null)

  const shareOptions = [
    {
      id: 'copy-link',
      label: 'Copy Link',
      icon: LinkIcon,
      color: 'text-sage-600',
      bgColor: 'bg-sage-50',
      hoverColor: 'hover:bg-sage-100'
    },
    {
      id: 'native-share',
      label: 'Share',
      icon: ShareIcon,
      color: 'text-gold-600',
      bgColor: 'bg-gold-50',
      hoverColor: 'hover:bg-gold-100'
    },
    {
      id: 'message',
      label: 'Send to friend',
      icon: ChatBubbleLeftIcon,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      hoverColor: 'hover:bg-blue-100'
    },
    {
      id: 'email',
      label: 'Email',
      icon: EnvelopeIcon,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      hoverColor: 'hover:bg-purple-100'
    }
  ]

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setSelectedOption('copy-link')
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy link:', error)
    }
  }

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text: description,
          url
        })
        setSelectedOption('native-share')
      } catch (error) {
        console.error('Error sharing:', error)
      }
    } else {
      // Fallback to copy link
      handleCopyLink()
    }
  }

  const handleMessage = () => {
    // Open the in-app "send to a friend" picker (DMs the link). Replaces the
    // old console.log stub.
    setSelectedOption('message')
    window.dispatchEvent(new CustomEvent('this-is:send-to-friend', { detail: { title, url } }))
    handleClose()
  }

  const handleEmail = () => {
    const subject = encodeURIComponent(`Check out this ${type} on this.is`)
    const body = encodeURIComponent(`${title}\n\n${description}\n\n${url}`)
    window.open(`mailto:?subject=${subject}&body=${body}`)
    setSelectedOption('email')
  }

  const handleOptionClick = (optionId: string) => {
    switch (optionId) {
      case 'copy-link':
        handleCopyLink()
        break
      case 'native-share':
        handleNativeShare()
        break
      case 'message':
        handleMessage()
        break
      case 'email':
        handleEmail()
        break
    }
  }

  const handleClose = () => {
    setCopied(false)
    setSelectedOption(null)
    onClose()
  }

  const sheetRef = useRef<HTMLDivElement>(null)
  useModalDismiss(isOpen, handleClose)
  useSwipeToDismiss({ ref: sheetRef, onDismiss: handleClose, enabled: isOpen })

  if (!isOpen) return null

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(46, 28, 13, 0.55)', backdropFilter: 'blur(6px)' }}
        onClick={handleClose}
      />
      <div
        ref={sheetRef}
        className="modal-paper relative w-full sm:max-w-md max-h-[88vh] rounded-t-[24px] sm:rounded-[24px] overflow-hidden flex flex-col"
        style={{ boxShadow: '0 -8px 40px rgba(46, 28, 13, 0.25), 0 24px 60px rgba(46, 28, 13, 0.30)' }}
      >
        <div data-drag-handle className="sm:hidden flex justify-center py-3 shrink-0 touch-none" aria-hidden>
          <span className="w-10 h-1 rounded-full bg-ink-faint" />
        </div>
        <div data-drag-handle className="flex items-center justify-between px-5 py-4 border-b border-edge relative z-10">
          <p className="label-eyebrow text-ink-mute">Share</p>
          <button
            onClick={handleClose}
            className="h-9 w-9 rounded-full hover:bg-paper-deep flex items-center justify-center"
            aria-label="Close"
          >
            <XMarkIcon className="w-5 h-5 text-ink" />
          </button>
        </div>

        <div className="px-5 py-5 border-b border-edge flex items-center gap-3.5">
          {image && (
            <div className="w-14 h-14 rounded-[10px] overflow-hidden bg-paper-deep flex-shrink-0 ring-1 ring-edge">
              <img src={image} alt={title} className="w-full h-full object-cover" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-display text-[20px] leading-tight text-ink truncate">{title}</h3>
            {description && (
              <p className="text-[12px] text-ink-soft truncate mt-1">{description}</p>
            )}
          </div>
        </div>

        <div className="px-5 py-5">
          <div className="grid grid-cols-2 gap-2">
            {shareOptions.map((option) => {
              const Icon = option.icon
              const isCopied = copied && option.id === 'copy-link'
              return (
                <button
                  key={option.id}
                  onClick={() => handleOptionClick(option.id)}
                  className="btn-secondary px-4 py-3.5 flex flex-col items-start gap-2 text-left"
                  style={{ borderRadius: 14 }}
                >
                  <span className="w-8 h-8 rounded-full glass-honey flex items-center justify-center">
                    {isCopied ? <CheckIcon className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                  </span>
                  <span className="label-eyebrow">
                    {isCopied ? 'Copied' : option.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="px-5 py-4 border-t border-edge">
          <button
            onClick={handleCopyLink}
            className="btn-cta w-full h-12 font-semibold text-[15px] flex items-center justify-center gap-2"
          >
            <DocumentDuplicateIcon className="w-5 h-5" />
            {copied ? 'Link copied' : 'Copy link'}
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}

export default ShareModal 