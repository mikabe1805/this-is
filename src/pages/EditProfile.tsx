import { useState, useEffect } from 'react'
import { ArrowLeftIcon, CameraIcon, CalendarIcon, PencilIcon } from '@heroicons/react/24/outline'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.js'
import { formatTimestamp } from '../utils/dateUtils'
import { firebaseDataService } from '../services/firebaseDataService.js'
import type { User } from '../types/index.js'
import GooglePlacesAutocomplete from '../components/GooglePlacesAutocomplete'

// SVG botanical accent
const BotanicalAccent = () => (
  <svg width="60" height="60" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="absolute -top-6 -left-6 opacity-30 select-none pointer-events-none">
    <path d="M10 50 Q30 10 50 50" stroke="#A3B3A3" strokeWidth="3" fill="none"/>
    <ellipse cx="18" cy="38" rx="4" ry="8" fill="#C7D0C7"/>
    <ellipse cx="30" cy="28" rx="4" ry="8" fill="#A3B3A3"/>
    <ellipse cx="42" cy="38" rx="4" ry="8" fill="#7A927A"/>
  </svg>
)

const EditProfile = () => {
  const navigate = useNavigate()
  const { currentUser: authUser } = useAuth()
  const [formData, setFormData] = useState<Partial<User>>({})
  const [newTag, setNewTag] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchUserData = async () => {
      if (authUser) {
        const user = await firebaseDataService.getCurrentUser(authUser.id)
        if (user) {
          setFormData(user)
        }
      }
      setLoading(false)
    }
    fetchUserData()
  }, [authUser])

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleAddTag = () => {
    if (newTag.trim() && !(formData.tags || []).includes(newTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...(prev.tags || []), newTag.trim()]
      }))
      setNewTag('')
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }))
  }

  const handleSave = async () => {
    if (!authUser) return;
    setIsSaving(true)
    try {
      await firebaseDataService.updateUserProfile(authUser.id, formData);
      navigate('/profile')
    } catch (error) {
      console.error("Error updating profile: ", error);
      // Optionally, show an error message to the user
    } finally {
      setIsSaving(false)
    }
  }

  if (loading) {
    return <div>Loading...</div>; // Or a proper loading spinner
  }

  return (
    <div className="relative min-h-full overflow-x-hidden bg-linen-50">
      {/* Enhanced background */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-linen-texture opacity-80 mix-blend-multiply"></div>
        <div className="absolute inset-0 bg-gradient-to-br from-gold-50/60 via-linen-100/80 to-sage-100/70 opacity-80"></div>
        <div className="absolute inset-0 bg-gradient-radial from-transparent via-transparent to-charcoal-900/10"></div>
      </div>

      {/* Header */}
      <div className="relative z-10 p-4 border-b border-linen-200 bg-white/95 backdrop-blur-glass">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate('/profile')}
            className="p-2 rounded-xl bg-linen-100 text-charcoal-600 hover:bg-linen-200 transition-colors"
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-serif font-semibold text-charcoal-800">Edit Profile</h1>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className={`px-4 py-2 rounded-xl font-medium transition-colors ${
              isSaving 
                ? 'bg-sage-200 text-sage-400 cursor-not-allowed' 
                : 'bg-sage-500 text-white hover:bg-sage-600 shadow-soft'
            }`}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 p-4 space-y-6 max-w-2xl mx-auto">
        {/* Profile Photo Section */}
        <div className="relative rounded-3xl shadow-botanical border border-linen-200 bg-white/95 p-6">
          <BotanicalAccent />
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <img
                src={formData.avatar}
                alt="Profile"
                className="w-24 h-24 rounded-2xl border-4 border-linen-100 shadow-botanical object-cover bg-linen-200"
              />
              <button className="absolute -bottom-2 -right-2 p-2 bg-sage-500 text-white rounded-full shadow-soft hover:bg-sage-600 transition-colors">
                <CameraIcon className="w-4 h-4" />
              </button>
            </div>
            <div className="text-center">
              <h2 className="text-xl font-serif font-semibold text-charcoal-800 mb-1">Profile Photo</h2>
              <p className="text-sm text-charcoal-500">Tap to change your profile picture</p>
            </div>
          </div>
        </div>

        {/* Basic Information */}
        <div className="rounded-3xl shadow-botanical border border-linen-200 bg-white/95 p-6 space-y-4">
          <h3 className="text-lg font-serif font-semibold text-charcoal-800 mb-4">Basic Information</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-charcoal-700 mb-2">Full Name</label>
              <div className="relative">
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-linen-200 bg-linen-50 text-charcoal-700 focus:outline-none focus:ring-2 focus:ring-sage-200 focus:border-sage-300 transition-colors"
                  placeholder="Enter your full name"
                />
                <PencilIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-charcoal-400" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-charcoal-700 mb-2">Username</label>
              <div className="relative">
                <input
                  type="text"
                  value={formData.username || ''}
                  onChange={(e) => handleInputChange('username', e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-linen-200 bg-linen-50 text-charcoal-700 focus:outline-none focus:ring-2 focus:ring-sage-200 focus:border-sage-300 transition-colors"
                  placeholder="Enter your username"
                />
                <PencilIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-charcoal-400" />
              </div>
              <p className="text-xs text-charcoal-400 mt-1">This is how others will see you</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-charcoal-700 mb-2">Bio</label>
              <div className="relative">
                <textarea
                  value={formData.bio || ''}
                  onChange={(e) => handleInputChange('bio', e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border border-linen-200 bg-linen-50 text-charcoal-700 focus:outline-none focus:ring-2 focus:ring-sage-200 focus:border-sage-300 transition-colors resize-none"
                  placeholder="Tell us about yourself..."
                />
                <PencilIcon className="absolute right-3 top-3 w-4 h-4 text-charcoal-400" />
              </div>
              <p className="text-xs text-charcoal-400 mt-1">{(formData.bio || '').length}/150 characters</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-charcoal-700 mb-2">Location</label>
              <GooglePlacesAutocomplete
                value={formData.location || ''}
                placeholder="Start typing your city..."
                onPlaceSelect={(address) => {
                  if (address) {
                    handleInputChange('location', address)
                  }
                }}
              />
            </div>
          </div>
        </div>

        {/* Tags Section */}
        <div className="rounded-3xl shadow-botanical border border-linen-200 bg-white/95 p-6">
          <h3 className="text-lg font-serif font-semibold text-charcoal-800 mb-4">Your Interests</h3>
          <p className="text-sm text-charcoal-500 mb-4">Add tags that describe your interests and preferences</p>
          
          <div className="flex flex-wrap gap-2 mb-4">
            {(formData.tags || []).map(tag => (
              <span 
                key={tag} 
                className="px-4 py-2 rounded-full text-sm font-medium bg-sage-50 border border-sage-100 text-sage-700 shadow-soft flex items-center gap-2 group hover:bg-sage-100 transition-colors"
              >
                #{tag}
                <button
                  onClick={() => handleRemoveTag(tag)}
                  className="w-4 h-4 rounded-full bg-sage-200 text-sage-600 hover:bg-sage-300 transition-colors opacity-0 group-hover:opacity-100"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleAddTag()
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              placeholder="Add a new tag..."
              className="flex-1 px-4 py-3 rounded-xl border border-linen-200 bg-linen-50 text-charcoal-600 focus:outline-none focus:ring-2 focus:ring-sage-200 shadow-soft"
            />
            <button 
              type="submit"
              className="px-4 py-3 rounded-xl bg-sage-500 text-white shadow-soft hover:bg-sage-600 transition-colors"
            >
              Add
            </button>
          </form>
        </div>

        {/* Account Information */}
        <div className="rounded-3xl shadow-botanical border border-linen-200 bg-white/95 p-6">
          <h3 className="text-lg font-serif font-semibold text-charcoal-800 mb-4">Account Information</h3>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-xl bg-linen-50 border border-linen-200">
              <div className="flex items-center gap-3">
                <CalendarIcon className="w-5 h-5 text-gold-500" />
                <div>
                  <p className="font-medium text-charcoal-700">Member Since</p>
                  <p className="text-sm text-charcoal-500">{formData.createdAt ? formatTimestamp(formData.createdAt as any) : 'N/A'}</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center justify-between p-4 rounded-xl bg-linen-50 border border-linen-200">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-sage-500 flex items-center justify-center">
                  <span className="text-white text-xs font-bold">I</span>
                </div>
                <div>
                  <p className="font-medium text-charcoal-700">Influence Score</p>
                  <p className="text-sm text-charcoal-500">{formData.influences || 0} influences</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default EditProfile
