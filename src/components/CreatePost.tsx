import { useState, useRef } from 'react'
import { 
  CameraIcon, 
  PhotoIcon, 
  VideoCameraIcon, 
  XMarkIcon,
  MapPinIcon,
  HashtagIcon,
  PaperAirplaneIcon
} from '@heroicons/react/24/outline'

interface CreatePostProps {
  onClose: () => void
}

const CreatePost = ({ onClose }: CreatePostProps) => {
  const [step, setStep] = useState<'media' | 'details'>('media')
  const [mediaType, setMediaType] = useState<'camera' | 'upload' | null>(null)
  const [mediaFile, setMediaFile] = useState<File | null>(null)
  const [mediaPreview, setMediaPreview] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    title: '',
    locationName: '',
    address: '',
    description: '',
    hashtags: ''
  })
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const handleMediaTypeSelect = (type: 'camera' | 'upload') => {
    setMediaType(type)
    if (type === 'upload') {
      fileInputRef.current?.click()
    }
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setMediaFile(file)
      const reader = new FileReader()
      reader.onload = (e) => {
        setMediaPreview(e.target?.result as string)
        setStep('details')
      }
      reader.readAsDataURL(file)
    }
  }

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' }, 
        audio: false 
      })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
    } catch (error) {
      console.error('Error accessing camera:', error)
      alert('Unable to access camera. Please check permissions.')
    }
  }

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d')
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth
        canvasRef.current.height = videoRef.current.videoHeight
        context.drawImage(videoRef.current, 0, 0)
        
        canvasRef.current.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], 'captured-photo.jpg', { type: 'image/jpeg' })
            setMediaFile(file)
            setMediaPreview(URL.createObjectURL(blob))
            setStep('details')
            
            // Stop camera stream
            const stream = videoRef.current?.srcObject as MediaStream
            stream?.getTracks().forEach(track => track.stop())
          }
        }, 'image/jpeg')
      }
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleSubmit = () => {
    // Handle post creation
    console.log('Creating post:', { mediaFile, formData })
    // Here you would typically upload the media and post data to your backend
    alert('Post created successfully!')
    onClose()
  }

  const handleBack = () => {
    if (step === 'details') {
      setStep('media')
      setMediaFile(null)
      setMediaPreview(null)
      setMediaType(null)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
          <button
            onClick={handleBack}
            className="text-gray-600 hover:text-gray-800 transition-colors"
          >
            {step === 'details' ? 'Back' : <XMarkIcon className="w-6 h-6" onClick={onClose} />}
          </button>
          <h2 className="text-lg font-semibold text-gray-800">
            {step === 'media' ? 'Add Media' : 'Post Details'}
          </h2>
          <div className="w-6"></div>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-4">
          {step === 'media' && (
            <div className="space-y-4">
              <div className="text-center">
                <h3 className="text-xl font-medium text-gray-800 mb-2">Share a moment</h3>
                <p className="text-gray-600 text-sm">Take a photo or upload from your gallery</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => handleMediaTypeSelect('camera')}
                  className="flex flex-col items-center p-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border-2 border-blue-200 hover:border-blue-300 transition-all duration-300"
                >
                  <CameraIcon className="w-12 h-12 text-blue-600 mb-3" />
                  <span className="font-medium text-blue-800">Camera</span>
                </button>

                <button
                  onClick={() => handleMediaTypeSelect('upload')}
                  className="flex flex-col items-center p-6 bg-gradient-to-br from-green-50 to-green-100 rounded-xl border-2 border-green-200 hover:border-green-300 transition-all duration-300"
                >
                  <PhotoIcon className="w-12 h-12 text-green-600 mb-3" />
                  <span className="font-medium text-green-800">Upload</span>
                </button>
              </div>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                onChange={handleFileUpload}
                className="hidden"
              />

              {/* Camera view */}
              {mediaType === 'camera' && (
                <div className="space-y-4">
                  <div className="relative bg-black rounded-xl overflow-hidden">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      className="w-full h-64 object-cover"
                      onLoadedMetadata={startCamera}
                    />
                    <canvas ref={canvasRef} className="hidden" />
                  </div>
                  <button
                    onClick={capturePhoto}
                    className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
                  >
                    Take Photo
                  </button>
                </div>
              )}
            </div>
          )}

          {step === 'details' && (
            <div className="space-y-4">
              {/* Media preview */}
              {mediaPreview && (
                <div className="relative bg-gray-100 rounded-xl overflow-hidden">
                  <img
                    src={mediaPreview}
                    alt="Preview"
                    className="w-full h-48 object-cover"
                  />
                </div>
              )}

              {/* Form fields */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Title
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    placeholder="Give your post a title..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <MapPinIcon className="w-4 h-4 inline mr-1" />
                    Location Name
                  </label>
                  <input
                    type="text"
                    value={formData.locationName}
                    onChange={(e) => handleInputChange('locationName', e.target.value)}
                    placeholder="e.g., Blue Bottle Coffee"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Address
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => handleInputChange('address', e.target.value)}
                    placeholder="e.g., 300 Webster St, Oakland, CA"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    placeholder="Tell us about this place..."
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <HashtagIcon className="w-4 h-4 inline mr-1" />
                    Hashtags
                  </label>
                  <input
                    type="text"
                    value={formData.hashtags}
                    onChange={(e) => handleInputChange('hashtags', e.target.value)}
                    placeholder="e.g., #coffee #cozy #oakland"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer with Submit Button - Fixed at bottom */}
        {step === 'details' && (
          <div className="p-4 border-t border-gray-200 flex-shrink-0">
            <button
              onClick={handleSubmit}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-medium hover:from-blue-700 hover:to-blue-800 transition-all duration-300 flex items-center justify-center gap-2"
            >
              <PaperAirplaneIcon className="w-5 h-5" />
              Create Post
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default CreatePost 