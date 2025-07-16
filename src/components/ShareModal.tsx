import { XMarkIcon, LinkIcon, ShareIcon, ChatBubbleLeftIcon, EnvelopeIcon, DocumentDuplicateIcon, CheckIcon } from '@heroicons/react/24/outline'
import { useState } from 'react'

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
      label: 'Message',
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
    // In a real app, this would open the messaging app
    console.log('Opening message app...')
    setSelectedOption('message')
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

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-charcoal-900/50 backdrop-blur-sm"
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-botanical border border-linen-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-linen-200">
          <h2 className="text-lg font-serif font-semibold text-charcoal-800">Share</h2>
          <button
            onClick={handleClose}
            className="p-2 rounded-xl text-charcoal-400 hover:text-charcoal-600 hover:bg-linen-100 transition"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content Preview */}
        <div className="p-4 border-b border-linen-200">
          <div className="flex gap-3">
            {image && (
              <div className="w-16 h-16 rounded-xl overflow-hidden bg-linen-100 flex-shrink-0">
                <img 
                  src={image} 
                  alt={title}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-charcoal-800 mb-1 line-clamp-2">{title}</h3>
              <p className="text-sm text-charcoal-600 line-clamp-2">{description}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs px-2 py-1 rounded-full bg-sage-100 text-sage-700 font-medium">
                  {type}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Share Options */}
        <div className="p-4">
          <div className="grid grid-cols-2 gap-3">
            {shareOptions.map((option) => {
              const Icon = option.icon
              const isSelected = selectedOption === option.id
              const isCopied = copied && option.id === 'copy-link'
              
              return (
                <button
                  key={option.id}
                  onClick={() => handleOptionClick(option.id)}
                  className={`p-4 rounded-xl border border-linen-200 transition-all duration-200 flex flex-col items-center gap-2 ${
                    isSelected 
                      ? 'bg-sage-50 border-sage-200 shadow-soft' 
                      : `${option.bgColor} ${option.hoverColor} hover:shadow-soft`
                  }`}
                >
                  <div className={`p-2 rounded-full ${option.bgColor} ${option.color}`}>
                    {isCopied ? (
                      <CheckIcon className="w-5 h-5" />
                    ) : (
                      <Icon className="w-5 h-5" />
                    )}
                  </div>
                  <span className="text-sm font-medium text-charcoal-700">
                    {isCopied ? 'Copied!' : option.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="p-4 border-t border-linen-200">
          <div className="space-y-2">
            <button
              onClick={handleCopyLink}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-linen-200 bg-white text-charcoal-700 hover:bg-linen-50 transition"
            >
              <DocumentDuplicateIcon className="w-4 h-4" />
              Copy Link
            </button>
            {navigator.share && (
              <button
                onClick={handleNativeShare}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-sage-500 to-gold-500 text-white font-medium hover:shadow-botanical transition"
              >
                <ShareIcon className="w-4 h-4" />
                Share
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ShareModal 