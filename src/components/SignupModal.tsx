import React, { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { XMarkIcon, EyeIcon, EyeSlashIcon, ChevronLeftIcon, ChevronRightIcon, MapPinIcon, HeartIcon, CogIcon, UserIcon, PhotoIcon } from '@heroicons/react/24/outline'
import { firebaseDataService } from '../services/firebaseDataService'
import { firebaseStorageService } from '../services/firebaseStorageService'
import GooglePlacesAutocomplete from './GooglePlacesAutocomplete'

interface SignupModalProps {
  isOpen: boolean
  onClose: () => void
  onSwitchToLogin: () => void
  onStartTutorial?: () => void
}

interface SignupData {
  // Step 1: Basic Info
  displayName: string
  email: string
  password: string
  confirmPassword: string
  
  // Step 2: Personal Details
  location: string
  ageRange: string
  bio: string
  
  // Step 3: Interests
  favoriteCategories: string[]
  activityPreferences: string[]
  
  // Step 4: Preferences
  budgetPreferences: string[]
  socialPreferences: {
    exploreNew: number
    followFriends: number
    trendingContent: number
  }
  discoveryRadius: number
  
  // Step 5: Profile Setup
  username: string
  profilePicture?: File
  profileBio: string
  userTags: string[]
}

// Expanded and more diverse categories
const CATEGORIES = [
  'Restaurants', 'Coffee Shops', 'Bars & Nightlife', 'Museums', 'Art Galleries',
  'Parks & Nature', 'Shopping', 'Entertainment', 'Sports & Fitness', 'Spa & Wellness',
  'Markets', 'Live Music', 'Theater', 'Historic Sites', 'Street Food',
  'Bookstores', 'Libraries', 'Co-working Spaces', 'Beach & Waterfront', 'Hiking Trails',
  'Nightclubs', 'Wine Bars', 'Breweries', 'Rooftop Venues', 'Food Trucks',
  'Vintage Shops', 'Farmers Markets', 'Outdoor Activities', 'Adventure Sports', 'Yoga Studios',
  'Photography Spots', 'Architecture', 'Religious Sites', 'Science Centers', 'Zoos & Aquariums',
  'Gaming & Tech', 'Maker Spaces', 'Community Centers', 'Gardens & Arboretums', 'Scenic Drives'
]

const ACTIVITY_PREFERENCES = [
  'Indoor Activities', 'Outdoor Adventures', 'Social Experiences', 'Solo-Friendly',
  'Active & Energetic', 'Relaxed & Chill', 'Cultural & Educational', 'Trendy & Hip',
  'Family-Friendly', 'Romantic', 'Photography-Worthy', 'Local Favorites',
  'Hidden Gems', 'Tourist Attractions', 'Budget-Friendly', 'Luxury Experiences',
  'Seasonal Activities', 'Weekend Getaways', 'Date Night Ideas', 'Group Activities'
]

const BUDGET_OPTIONS = ['$', '$$', '$$$', '$$$$']
const AGE_RANGES = ['18-25', '26-35', '36-45', '46-55', '56+', 'Other', 'Prefer not to say']

const USER_TAGS = [
  // Lifestyle & Personality
  'Foodie', 'Adventurer', 'Culture Lover', 'Nature Enthusiast', 'Art Aficionado',
  'Music Lover', 'Fitness Enthusiast', 'Bookworm', 'Photography', 'Travel Blogger',
  'Local Explorer', 'Trendsetter', 'Budget Traveler', 'Luxury Seeker', 'Family Person',
  'Solo Traveler', 'Party Goer', 'Early Bird', 'Night Owl', 'Weekend Warrior',
  'Seasonal Explorer', 'Hidden Gem Hunter', 'Instagrammer', 'Minimalist', 'Maximalist',
  
  // Food & Dining
  'Coffee Enthusiast', 'Wine Connoisseur', 'Craft Beer Lover', 'Vegan', 'Vegetarian',
  'Dessert Lover', 'Street Food Fan', 'Fine Dining', 'Home Cooking', 'Baking',
  'Cocktail Enthusiast', 'Tea Lover', 'Foodie Tours', 'Farmers Markets', 'Food Trucks',
  
  // Activities & Hobbies
  'Hiking', 'Cycling', 'Running', 'Swimming', 'Yoga', 'Rock Climbing', 'Skiing',
  'Surfing', 'Camping', 'Gardening', 'Cooking', 'Gaming', 'Board Games', 'Dancing',
  'Singing', 'Painting', 'Drawing', 'Crafting', 'DIY Projects', 'Collecting',
  
  // Entertainment & Media
  'Movie Buff', 'TV Series Fan', 'Podcast Listener', 'Live Music', 'Theater',
  'Comedy Shows', 'Concerts', 'Festivals', 'Museums', 'Galleries', 'Libraries',
  'Cinema', 'Animation', 'Documentary Fan', 'Indie Films', 'Horror Movies',
  
  // Social & Networking
  'Social Butterfly', 'Introvert', 'Extrovert', 'Community Builder', 'Volunteer',
  'Mentor', 'Student', 'Teacher', 'Public Speaker', 'Networker', 'Team Player',
  'Leader', 'Collaborator', 'Host', 'Guest', 'Organizer',
  
  // Technology & Innovation
  'Tech Enthusiast', 'App Developer', 'Web Designer', 'AI Curious', 'Gamer',
  'Gadget Lover', 'Tech Reviewer', 'Programmer', 'Data Nerd', 'Crypto Curious',
  'Digital Nomad', 'Remote Worker', 'Startup Enthusiast', 'Innovation Seeker',
  
  // Arts & Creativity
  'Visual Artist', 'Musician', 'Writer', 'Poet', 'Designer', 'Sculptor',
  'Ceramicist', 'Jewelry Maker', 'Fashion Designer', 'Interior Designer',
  'Architect', 'Graphic Designer', 'Illustrator', 'Calligrapher', 'Street Artist',
  
  // Learning & Growth
  'Language Learner', 'History Buff', 'Science Enthusiast', 'Philosophy Lover',
  'Psychology Curious', 'Self-Improvement', 'Meditation', 'Mindfulness',
  'Spiritual Seeker', 'Religious', 'Agnostic', 'Atheist',
  
  // Sports & Recreation
  'Basketball', 'Football', 'Soccer', 'Tennis', 'Golf', 'Baseball', 'Hockey',
  'Volleyball', 'Badminton', 'Table Tennis', 'Boxing', 'Martial Arts',
  'Skateboarding', 'Snowboarding', 'Surfing', 'Sailing', 'Fishing',
  
  // Wellness & Health
  'Health Conscious', 'Organic Eater', 'Gym Goer', 'Personal Trainer',
  'Nutritionist', 'Mental Health Advocate', 'Therapist', 'Life Coach',
  'Wellness Blogger', 'Spa Lover', 'Massage Enthusiast', 'Aromatherapy',
  
  // Career & Professional
  'Entrepreneur', 'Freelancer', 'Corporate', 'Non-Profit', 'Healthcare Worker',
  'Teacher', 'Student', 'Researcher', 'Consultant', 'Sales Professional',
  'Marketing Expert', 'Finance Professional', 'Legal Professional', 'Engineer',
  
  // Travel & Adventure
  'Backpacker', 'Luxury Traveler', 'Road Tripper', 'International Traveler',
  'Domestic Explorer', 'Cultural Immersion', 'Adventure Seeker', 'Beach Lover',
  'Mountain Climber', 'City Explorer', 'Rural Enthusiast', 'Island Hopper',
  
  // Shopping & Fashion
  'Fashion Forward', 'Vintage Lover', 'Thrift Shopper', 'Designer Fan',
  'Sustainable Fashion', 'Beauty Enthusiast', 'Skincare Lover', 'Makeup Artist',
  'Personal Stylist', 'Shoe Collector', 'Accessory Lover', 'Minimalist Style',
  
  // Environment & Sustainability
  'Eco Warrior', 'Sustainability Advocate', 'Zero Waste', 'Recycling Champion',
  'Climate Action', 'Renewable Energy', 'Green Living', 'Organic Supporter',
  'Fair Trade', 'Local Supporter', 'Environmental Activist', 'Nature Protector'
]

export default function SignupModal({ isOpen, onClose, onSwitchToLogin, onStartTutorial }: SignupModalProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null)
  const [checkingUsername, setCheckingUsername] = useState(false)
  const [uploadingPicture, setUploadingPicture] = useState(false)
  const [tagSearch, setTagSearch] = useState('')
  const { signUp } = useAuth()

  const [signupData, setSignupData] = useState<SignupData>({
    displayName: '',
    email: '',
    password: '',
    confirmPassword: '',
    location: '',
    ageRange: '',
    bio: '',
    favoriteCategories: [],
    activityPreferences: [],
    budgetPreferences: [],
    socialPreferences: {
      exploreNew: 50,
      followFriends: 50,
      trendingContent: 50
    },
    discoveryRadius: 10,
    username: '',
    profileBio: '',
    userTags: []
  })

  // Filter tags based on search input
  const filteredTags = tagSearch.length > 0 
    ? USER_TAGS.filter(tag => 
        tag.toLowerCase().includes(tagSearch.toLowerCase())
      ).slice(0, 50) // Limit to 50 results for performance
    : USER_TAGS.slice(0, 50) // Show first 50 tags by default

  const updateSignupData = (field: string, value: any) => {
    setSignupData(prev => ({ ...prev, [field]: value }))
  }

  const toggleCategory = (category: string) => {
    setSignupData(prev => ({
      ...prev,
      favoriteCategories: prev.favoriteCategories.includes(category)
        ? prev.favoriteCategories.filter(c => c !== category)
        : [...prev.favoriteCategories, category]
    }))
  }

  const toggleActivityPreference = (preference: string) => {
    setSignupData(prev => ({
      ...prev,
      activityPreferences: prev.activityPreferences.includes(preference)
        ? prev.activityPreferences.filter(p => p !== preference)
        : [...prev.activityPreferences, preference]
    }))
  }

  const toggleBudgetPreference = (budget: string) => {
    setSignupData(prev => ({
      ...prev,
      budgetPreferences: prev.budgetPreferences.includes(budget)
        ? prev.budgetPreferences.filter(b => b !== budget)
        : [...prev.budgetPreferences, budget]
    }))
  }

  const toggleUserTag = (tag: string) => {
    updateSignupData('userTags', 
      signupData.userTags.includes(tag)
        ? signupData.userTags.filter(t => t !== tag)
        : [...signupData.userTags, tag]
    )
  }

  const updateSocialPreference = (type: keyof SignupData['socialPreferences'], value: number) => {
    setSignupData(prev => ({
      ...prev,
      socialPreferences: {
        ...prev.socialPreferences,
        [type]: value
      }
    }))
  }

  const handleLocationSelect = (location: string, details?: google.maps.places.PlaceResult) => {
    updateSignupData('location', location)
    
    // If we have place details, we could store additional location data
    if (details) {
      console.log('Selected place details:', details)
      // Could store coordinates, place_id, etc. for future use
    }
  }

  const checkUsernameAvailability = async (username: string) => {
    if (username.length < 3) {
      setUsernameAvailable(null)
      return
    }

    setCheckingUsername(true)
    try {
      const isAvailable = await firebaseDataService.checkUsernameAvailability(username);
      setUsernameAvailable(isAvailable);
    } catch (error) {
      console.error('Error checking username:', error)
      setUsernameAvailable(null)
    } finally {
      setCheckingUsername(false)
    }
  }

  const handleUsernameChange = (username: string) => {
    const cleanUsername = username.toLowerCase().replace(/[^a-z0-9_.]/g, '')
    updateSignupData('username', cleanUsername)
    
    if (cleanUsername !== signupData.username) {
      setUsernameAvailable(null)
      if (cleanUsername.length >= 3) {
        checkUsernameAvailability(cleanUsername)
      }
    }
  }

  const handleProfilePictureChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setUploadingPicture(true)
      
      // Validate file size and type
      if (file.size > 5 * 1024 * 1024) {
        setError('Profile picture must be smaller than 5MB')
      return
    }

      if (!['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) {
        setError('Please upload a valid image file (JPG, PNG, GIF, WebP)')
      return
    }

      // Compress image if needed
      const compressedFile = await firebaseStorageService.compressImage(file, 800, 0.8)
      updateSignupData('profilePicture', compressedFile)
      
      setError('') // Clear any previous errors
    } catch (error) {
      console.error('Error processing profile picture:', error)
      setError('Failed to process image. Please try again.')
    } finally {
      setUploadingPicture(false)
    }
  }

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        if (!signupData.displayName || !signupData.email || !signupData.password || !signupData.confirmPassword) {
          setError('Please fill in all required fields')
          return false
        }
        if (signupData.password !== signupData.confirmPassword) {
          setError('Passwords do not match')
          return false
        }
        if (signupData.password.length < 6) {
          setError('Password must be at least 6 characters')
          return false
        }
        break
      case 2:
        if (!signupData.location) {
          setError('Please select your location')
          return false
        }
        break
      case 3:
        if (signupData.favoriteCategories.length === 0) {
          setError('Please select at least one category you\'re interested in')
          return false
        }
        break
      case 4:
        if (signupData.budgetPreferences.length === 0) {
          setError('Please select your budget preferences')
          return false
        }
        break
      case 5:
        if (!signupData.username) {
          setError('Please choose a username')
          return false
        }
        if (signupData.username.length < 3) {
          setError('Username must be at least 3 characters')
          return false
        }
        if (usernameAvailable === false) {
          setError('Username is already taken')
          return false
        }
        if (!signupData.profileBio.trim()) {
          setError('Please write a short bio')
          return false
        }
        break
    }
    setError('')
    return true
  }

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, 5))
    }
  }

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1))
    setError('')
  }

  const handleSubmit = async () => {
    if (!validateStep(5)) return

    try {
      setError('')
      setLoading(true)
      
      // Create Firebase auth account
      const userCredential = await signUp(signupData.email, signupData.password, signupData.displayName)
      const userId = userCredential.user.uid
      
      // Wait a moment to ensure authentication state is fully set
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Upload profile picture if provided
      let profilePictureUrl = ''
      if (signupData.profilePicture) {
        try {
          console.log('📸 Uploading profile picture...', signupData.profilePicture.name)
          profilePictureUrl = await firebaseStorageService.uploadProfilePicture(userId, signupData.profilePicture)
          console.log('✅ Profile picture uploaded successfully:', profilePictureUrl)
        } catch (uploadError) {
          console.error('❌ Error uploading profile picture:', uploadError)
          // Continue with signup even if image upload fails
          setError('Profile picture upload failed, but account was created successfully.')
        }
      }
      
      // Create user profile and preferences in Firestore
      try {
        await firebaseDataService.setupNewUser(userId, {
          displayName: signupData.displayName,
          email: signupData.email,
          location: signupData.location,
          bio: signupData.profileBio,
          ageRange: signupData.ageRange,
          favoriteCategories: signupData.favoriteCategories,
          activityPreferences: signupData.activityPreferences,
          budgetPreferences: signupData.budgetPreferences,
          socialPreferences: signupData.socialPreferences,
          discoveryRadius: signupData.discoveryRadius,
          username: signupData.username,
          userTags: signupData.userTags,
          profilePictureUrl
        })
      } catch (profileError) {
        console.error('Error creating user profile:', profileError)
        setError('Account created but profile setup failed. Please try logging in and completing your profile.')
      }
      
      onClose()
      
      // Start onboarding tutorial for new users
      if (onStartTutorial) {
        setTimeout(() => {
          onStartTutorial()
        }, 1000) // Delay to allow navigation to complete
      }
      
    } catch (error: any) {
      setError('Failed to create account. Please try again.')
      console.error('Signup error:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStepIcon = (step: number) => {
    switch (step) {
      case 1: return <CogIcon className="w-5 h-5" />
      case 2: return <MapPinIcon className="w-5 h-5" />
      case 3: return <HeartIcon className="w-5 h-5" />
      case 4: return <CogIcon className="w-5 h-5" />
      case 5: return <UserIcon className="w-5 h-5" />
      default: return null
    }
  }

  const getStepTitle = (step: number) => {
    switch (step) {
      case 1: return 'Account Details'
      case 2: return 'About You'
      case 3: return 'Your Interests'
      case 4: return 'Preferences'
      case 5: return 'Profile Setup'
      default: return ''
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white/90 backdrop-blur-md rounded-2xl shadow-xl border border-warmGray-200 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-warmGray-200">
          <div className="flex items-center space-x-3">
            {getStepIcon(currentStep)}
            <div>
              <h2 className="text-2xl font-serif font-semibold text-brown-700 tracking-wide">Join This Is</h2>
              <p className="text-sm text-brown-500">{getStepTitle(currentStep)} ({currentStep}/5)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-warmGray-100 transition-colors"
          >
            <XMarkIcon className="w-6 h-6 text-brown-600" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="px-6 py-4">
          <div className="w-full bg-warmGray-200 rounded-full h-2">
            <div 
              className="bg-[#E17373] h-2 rounded-full transition-all duration-300"
              style={{ width: `${(currentStep / 5) * 100}%` }}
            />
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
              <p className="text-red-600 text-sm font-medium">{error}</p>
            </div>
          )}

          {/* Step 1: Basic Account Info */}
          {currentStep === 1 && (
            <div className="space-y-4">
          <div>
            <label htmlFor="displayName" className="block text-sm font-medium text-brown-700 mb-2">
                  Display Name *
            </label>
            <input
              type="text"
              id="displayName"
                  value={signupData.displayName}
                  onChange={(e) => updateSignupData('displayName', e.target.value)}
              className="w-full px-4 py-3 border border-warmGray-300 rounded-xl focus:ring-2 focus:ring-[#E17373] focus:border-transparent transition-all bg-white"
                  placeholder="What should we call you?"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-brown-700 mb-2">
                  Email *
            </label>
            <input
              type="email"
              id="email"
                  value={signupData.email}
                  onChange={(e) => updateSignupData('email', e.target.value)}
              className="w-full px-4 py-3 border border-warmGray-300 rounded-xl focus:ring-2 focus:ring-[#E17373] focus:border-transparent transition-all bg-white"
                  placeholder="your@email.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-brown-700 mb-2">
                  Password *
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                    value={signupData.password}
                    onChange={(e) => updateSignupData('password', e.target.value)}
                className="w-full px-4 py-3 pr-12 border border-warmGray-300 rounded-xl focus:ring-2 focus:ring-[#E17373] focus:border-transparent transition-all bg-white"
                    placeholder="Create a secure password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-brown-400 hover:text-brown-600"
              >
                    {showPassword ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-brown-700 mb-2">
                  Confirm Password *
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                id="confirmPassword"
                    value={signupData.confirmPassword}
                    onChange={(e) => updateSignupData('confirmPassword', e.target.value)}
                className="w-full px-4 py-3 pr-12 border border-warmGray-300 rounded-xl focus:ring-2 focus:ring-[#E17373] focus:border-transparent transition-all bg-white"
                placeholder="Confirm your password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-brown-400 hover:text-brown-600"
              >
                    {showConfirmPassword ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Personal Details */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div>
                <label htmlFor="location" className="block text-sm font-medium text-brown-700 mb-2">
                  Where are you located? *
                </label>
                <GooglePlacesAutocomplete
                  onPlaceSelect={handleLocationSelect}
                  value={signupData.location}
                  placeholder="Start typing your city or town..."
                />
                <p className="text-xs text-brown-500 mt-1">We'll use this to show you relevant local places and experiences</p>
              </div>

              <div>
                <label htmlFor="ageRange" className="block text-sm font-medium text-brown-700 mb-2">
                  Age Range (Optional)
                </label>
                <select
                  id="ageRange"
                  value={signupData.ageRange}
                  onChange={(e) => updateSignupData('ageRange', e.target.value)}
                  className="w-full px-4 py-3 border border-warmGray-300 rounded-xl focus:ring-2 focus:ring-[#E17373] focus:border-transparent transition-all bg-white"
                >
                  <option value="">Select your age range</option>
                  {AGE_RANGES.map(range => (
                    <option key={range} value={range}>{range}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="bio" className="block text-sm font-medium text-brown-700 mb-2">
                  Tell us about yourself (Optional)
                </label>
                <textarea
                  id="bio"
                  value={signupData.bio}
                  onChange={(e) => updateSignupData('bio', e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 border border-warmGray-300 rounded-xl focus:ring-2 focus:ring-[#E17373] focus:border-transparent transition-all bg-white resize-none"
                  placeholder="What makes you unique? What do you love to do?"
                />
              </div>
            </div>
          )}

          {/* Step 3: Interests */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-brown-700 mb-3">What are you interested in? *</h3>
                <p className="text-sm text-brown-500 mb-4">Select all that apply - this helps us recommend places you'll love</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-64 overflow-y-auto">
                  {CATEGORIES.map(category => (
                    <button
                      key={category}
                      type="button"
                      onClick={() => toggleCategory(category)}
                      className={`p-3 rounded-xl text-sm font-medium transition-all ${
                        signupData.favoriteCategories.includes(category)
                          ? 'bg-[#E17373] text-white shadow-md'
                          : 'bg-warmGray-100 text-brown-600 hover:bg-warmGray-200'
                      }`}
                    >
                      {category}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium text-brown-700 mb-3">What kind of experiences do you enjoy?</h3>
                <p className="text-sm text-brown-500 mb-4">Optional - select any that resonate with you</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                  {ACTIVITY_PREFERENCES.map(preference => (
                    <button
                      key={preference}
                      type="button"
                      onClick={() => toggleActivityPreference(preference)}
                      className={`p-3 rounded-xl text-sm font-medium transition-all ${
                        signupData.activityPreferences.includes(preference)
                          ? 'bg-[#E17373] text-white shadow-md'
                          : 'bg-warmGray-100 text-brown-600 hover:bg-warmGray-200'
                      }`}
                    >
                      {preference}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Preferences */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-brown-700 mb-3">Budget Preferences *</h3>
                <p className="text-sm text-brown-500 mb-4">What price ranges work for you?</p>
                <div className="flex gap-2">
                  {BUDGET_OPTIONS.map(budget => (
                    <button
                      key={budget}
                      type="button"
                      onClick={() => toggleBudgetPreference(budget)}
                      className={`px-6 py-3 rounded-xl font-medium transition-all ${
                        signupData.budgetPreferences.includes(budget)
                          ? 'bg-[#E17373] text-white shadow-md'
                          : 'bg-warmGray-100 text-brown-600 hover:bg-warmGray-200'
                      }`}
                    >
                      {budget}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium text-brown-700 mb-3">Discovery Preferences</h3>
                <p className="text-sm text-brown-500 mb-4">Help us understand how you like to discover new places</p>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-brown-600 mb-2">
                      How far are you willing to travel? ({signupData.discoveryRadius} miles)
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="50"
                      value={signupData.discoveryRadius}
                      onChange={(e) => updateSignupData('discoveryRadius', parseInt(e.target.value))}
                      className="w-full h-2 bg-warmGray-200 rounded-lg appearance-none cursor-pointer"
                      style={{background: `linear-gradient(to right, #E17373 0%, #E17373 ${(signupData.discoveryRadius / 50) * 100}%, #e5e7eb ${(signupData.discoveryRadius / 50) * 100}%, #e5e7eb 100%)`}}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-brown-600 mb-2">
                      Explore new places vs. Stick to favorites ({signupData.socialPreferences.exploreNew}% explore new)
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={signupData.socialPreferences.exploreNew}
                      onChange={(e) => updateSocialPreference('exploreNew', parseInt(e.target.value))}
                      className="w-full h-2 bg-warmGray-200 rounded-lg appearance-none cursor-pointer"
                      style={{background: `linear-gradient(to right, #E17373 0%, #E17373 ${signupData.socialPreferences.exploreNew}%, #e5e7eb ${signupData.socialPreferences.exploreNew}%, #e5e7eb 100%)`}}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-brown-600 mb-2">
                      Follow friends' recommendations ({signupData.socialPreferences.followFriends}% weight)
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={signupData.socialPreferences.followFriends}
                      onChange={(e) => updateSocialPreference('followFriends', parseInt(e.target.value))}
                      className="w-full h-2 bg-warmGray-200 rounded-lg appearance-none cursor-pointer"
                      style={{background: `linear-gradient(to right, #E17373 0%, #E17373 ${signupData.socialPreferences.followFriends}%, #e5e7eb ${signupData.socialPreferences.followFriends}%, #e5e7eb 100%)`}}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-brown-600 mb-2">
                      Show trending/popular places ({signupData.socialPreferences.trendingContent}% weight)
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={signupData.socialPreferences.trendingContent}
                      onChange={(e) => updateSocialPreference('trendingContent', parseInt(e.target.value))}
                      className="w-full h-2 bg-warmGray-200 rounded-lg appearance-none cursor-pointer"
                      style={{background: `linear-gradient(to right, #E17373 0%, #E17373 ${signupData.socialPreferences.trendingContent}%, #e5e7eb ${signupData.socialPreferences.trendingContent}%, #e5e7eb 100%)`}}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 5: Profile Setup */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-brown-700 mb-3">Set up your profile</h3>
                <p className="text-sm text-brown-500 mb-4">Almost done! Let's create your profile</p>
              </div>

              <div>
                <label htmlFor="username" className="block text-sm font-medium text-brown-700 mb-2">
                  Choose a username *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    id="username"
                    value={signupData.username}
                    onChange={(e) => handleUsernameChange(e.target.value)}
                    className="w-full px-4 py-3 border border-warmGray-300 rounded-xl focus:ring-2 focus:ring-[#E17373] focus:border-transparent transition-all bg-white"
                    placeholder="yourname123"
                  />
                  {checkingUsername && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <div className="animate-spin h-4 w-4 border-2 border-[#E17373] border-t-transparent rounded-full"></div>
                    </div>
                  )}
                </div>
                {signupData.username.length >= 3 && !checkingUsername && (
                  <p className={`text-xs mt-1 ${usernameAvailable === true ? 'text-green-600' : usernameAvailable === false ? 'text-red-600' : 'text-brown-500'}`}>
                    {usernameAvailable === true ? '✓ Username is available' : 
                     usernameAvailable === false ? '✗ Username is taken' : 
                     'Checking availability...'}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="profilePicture" className="block text-sm font-medium text-brown-700 mb-2">
                  Profile Picture (Optional)
                </label>
                <div className="flex items-center space-x-4">
                  <div className="w-16 h-16 bg-warmGray-100 rounded-full flex items-center justify-center relative">
                    {signupData.profilePicture ? (
                      <img
                        src={URL.createObjectURL(signupData.profilePicture)}
                        alt="Profile"
                        className="w-16 h-16 rounded-full object-cover"
                      />
                    ) : (
                      <PhotoIcon className="w-8 h-8 text-brown-400" />
                    )}
                    
                    {uploadingPicture && (
                      <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                        <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex flex-col space-y-2">
                    <label className={`cursor-pointer bg-warmGray-100 hover:bg-warmGray-200 text-brown-600 px-4 py-2 rounded-xl transition-colors text-center ${uploadingPicture ? 'opacity-50 cursor-not-allowed' : ''}`}>
                      {uploadingPicture ? 'Processing...' : signupData.profilePicture ? 'Change Photo' : 'Choose Photo'}
                      <input
                        type="file"
                        accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                        onChange={handleProfilePictureChange}
                        className="hidden"
                        disabled={uploadingPicture}
                      />
                    </label>
                    
                    {signupData.profilePicture && (
                      <button
                        type="button"
                        onClick={() => updateSignupData('profilePicture', null)}
                        className="text-xs text-red-600 hover:text-red-700 transition-colors"
                        disabled={uploadingPicture}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-xs text-brown-500 mt-2">
                  Upload JPG, PNG, GIF, or WebP. Max 5MB. Image will be compressed automatically.
                </p>
              </div>

              <div>
                <label htmlFor="profileBio" className="block text-sm font-medium text-brown-700 mb-2">
                  Profile Bio *
                </label>
                <textarea
                  id="profileBio"
                  value={signupData.profileBio}
                  onChange={(e) => updateSignupData('profileBio', e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 border border-warmGray-300 rounded-xl focus:ring-2 focus:ring-[#E17373] focus:border-transparent transition-all bg-white resize-none"
                  placeholder="Tell others about yourself and what you're passionate about..."
                />
              </div>

              <div>
                <h4 className="text-sm font-medium text-brown-700 mb-3">Choose your profile tags</h4>
                <p className="text-xs text-brown-500 mb-3">These help others understand your vibe</p>
                
                {/* Tag Search Input */}
                <div className="mb-4">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search for tags... (e.g., foodie, hiking, coffee)"
                      value={tagSearch}
                      onChange={(e) => setTagSearch(e.target.value)}
                      className="w-full px-4 py-3 border border-warmGray-300 rounded-xl focus:ring-2 focus:ring-[#E17373] focus:border-transparent transition-all bg-white"
                    />
                    <svg className="w-5 h-5 text-warmGray-400 absolute right-3 top-1/2 transform -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                </div>

                {/* Selected Tags */}
                {signupData.userTags.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs text-brown-600 mb-2">Selected tags ({signupData.userTags.length}/10):</p>
                    <div className="flex flex-wrap gap-2">
                      {signupData.userTags.map(tag => (
                        <span
                          key={tag}
                          className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-[#E17373] text-white"
                        >
                          {tag}
                          <button
                            type="button"
                            onClick={() => toggleUserTag(tag)}
                            className="ml-2 hover:bg-white/20 rounded-full p-0.5 transition-colors"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Filtered Tag Grid */}
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border border-warmGray-200 rounded-xl p-3">
                  {filteredTags.length > 0 ? (
                    filteredTags.map(tag => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleUserTag(tag)}
                        disabled={signupData.userTags.length >= 10 && !signupData.userTags.includes(tag)}
                        className={`px-3 py-2 rounded-lg text-xs font-medium transition-all text-left ${
                          signupData.userTags.includes(tag)
                            ? 'bg-[#E17373] text-white'
                            : signupData.userTags.length >= 10
                            ? 'bg-warmGray-100 text-warmGray-400 cursor-not-allowed'
                            : 'bg-warmGray-100 text-warmGray-700 hover:bg-[#E17373]/10 hover:text-[#E17373]'
                        }`}
                      >
                        {tag}
                      </button>
                    ))
                  ) : (
                    <div className="col-span-2 text-center py-8 text-warmGray-500">
                      <p className="text-sm">No tags found matching "{tagSearch}"</p>
                      <p className="text-xs mt-1">Try searching for interests like "food", "travel", or "music"</p>
                    </div>
                  )}
                </div>
                
                {signupData.userTags.length >= 10 && (
                  <p className="text-xs text-amber-600 mt-2">
                    Maximum 10 tags selected. Remove some to add others.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-warmGray-200">
          <div className="flex items-center space-x-3">
            {currentStep > 1 && (
              <button
                onClick={prevStep}
                className="flex items-center space-x-2 px-4 py-2 text-brown-600 hover:text-brown-700 font-medium transition-colors"
              >
                <ChevronLeftIcon className="w-4 h-4" />
                <span>Back</span>
              </button>
            )}
          </div>

          <div className="flex items-center space-x-3">
            {currentStep < 5 ? (
              <button
                onClick={nextStep}
                className="flex items-center space-x-2 bg-[#E17373] hover:bg-[#cd5c5c] text-white rounded-full px-6 py-3 font-medium shadow-sm transition-all hover:brightness-110"
              >
                <span>Continue</span>
                <ChevronRightIcon className="w-4 h-4" />
              </button>
            ) : (
          <button
                onClick={handleSubmit}
            disabled={loading}
                className="bg-[#E17373] hover:bg-[#cd5c5c] text-white rounded-full px-8 py-3 font-medium shadow-sm transition-all hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
            )}
          </div>
        </div>

        {/* Login link */}
        <div className="px-6 pb-6 text-center">
          <p className="text-brown-600 text-sm">
            Already have an account?{' '}
            <button
              onClick={onSwitchToLogin}
              className="text-[#E17373] hover:text-[#cd5c5c] font-medium transition-colors"
            >
              Sign in
            </button>
          </p>
        </div>
      </div>
    </div>
  )
} 