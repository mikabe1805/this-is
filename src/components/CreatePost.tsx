import { useState, useRef, useEffect } from 'react';
import { XMarkIcon, CameraIcon, MapPinIcon, TagIcon, EyeIcon, EyeSlashIcon, UsersIcon, PhotoIcon, MagnifyingGlassIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import { createPortal } from 'react-dom';
import { firebaseDataService } from '../services/firebaseDataService';
import { firebasePostService } from '../services/firebasePostService';
import { useAuth } from '../contexts/AuthContext';
import type { List, User } from '../types';
import EXIF from 'exif-js';
import GooglePlacesAutocomplete from './GooglePlacesAutocomplete';
import AddressAutocomplete from './AddressAutocomplete';
import TagAutocomplete from './TagAutocomplete';

interface CreatePostProps {
  isOpen: boolean
  onClose: () => void
  preSelectedHub?: CreatePostHub
  preSelectedListIds?: string[]
}

interface CreatePostHub {
  id: string
  name: string
  address: string
  description?: string
  lat?: number
  lng?: number
}

const CreatePost = ({ isOpen, onClose, preSelectedHub, preSelectedListIds }: CreatePostProps) => {
  const { currentUser } = useAuth()
  const [step, setStep] = useState<'photo' | 'location' | 'details'>('photo')
  const [photos, setPhotos] = useState<File[]>([])
  const [extractedLocation, setExtractedLocation] = useState<{ lat: number, lng: number } | null>(null)
  const [hubGuess, setHubGuess] = useState<CreatePostHub | null>(null)
  const [hubConfirmed, setHubConfirmed] = useState(false)
  const [selectedHub, setSelectedHub] = useState<CreatePostHub | null>(preSelectedHub || null)
  const [isCreatingNewHub, setIsCreatingNewHub] = useState(false)
  const [newHubName, setNewHubName] = useState('')
  const [newHubAddress, setNewHubAddress] = useState('')
  const [newHubDescription, setNewHubDescription] = useState('')
  const [newHubCoordinates, setNewHubCoordinates] = useState<{ lat: number, lng: number } | null>(null)
  const [locationSearch, setLocationSearch] = useState('')
  const [searchResults, setSearchResults] = useState<CreatePostHub[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [howWasIt, setHowWasIt] = useState<'want' | 'tried' | 'loved'>('loved')
  const [triedFeeling, setTriedFeeling] = useState<'liked' | 'neutral' | 'disliked'>('liked')
  const [isScreenshot, setIsScreenshot] = useState(false)
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [newTag, setNewTag] = useState('')
  const [privacy, setPrivacy] = useState<'public' | 'friends' | 'private'>('public')
  const [selectedListIds, setSelectedListIds] = useState<Set<string>>(new Set(preSelectedListIds || []))
  const [listSearchQuery, setListSearchQuery] = useState('')
  const [userLists, setUserLists] = useState<List[]>([])
  const [availableTags, setAvailableTags] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)

  // Helper function to convert GPS coordinates from DMS to decimal degrees
  const convertDMSToDD = (dms: number[]): number => {
    const degrees = dms[0];
    const minutes = dms[1];
    const seconds = dms[2];
    return degrees + (minutes / 60) + (seconds / 3600);
  };

  // Filter lists based on search query
  const filteredLists = userLists.filter(list =>
    list.name.toLowerCase().includes(listSearchQuery.toLowerCase()) ||
    list.description.toLowerCase().includes(listSearchQuery.toLowerCase()) ||
    list.tags.some(tag => tag.toLowerCase().includes(listSearchQuery.toLowerCase()))
  )

  useEffect(() => {
    if (isOpen) {
      const fetchLists = async () => {
        if (currentUser) {
          const lists = await firebaseDataService.getUserLists(currentUser.id);
          setUserLists(lists);
        }
      };
      const fetchTags = async () => {
        try {
          const tags = await firebaseDataService.getAllTags();
          setAvailableTags(tags);
        } catch (error) {
          console.error('Error fetching tags:', error);
          // Fallback to default tags if Firebase fails
          setAvailableTags(['cozy', 'trendy', 'quiet', 'local', 'charming', 'authentic', 'chill', 'work-friendly', 'romantic', 'family-friendly']);
        }
      };
      
      fetchLists();
      fetchTags();
      setSelectedListIds(new Set(preSelectedListIds || []));
    }
  }, [isOpen, currentUser, preSelectedListIds]);

  // Step 1: Photo upload/take
  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 0) {
      setPhotos(prev => [...prev, ...files]);

      // Try to extract location from the first new photo with proper error handling
      const firstFile = files[0];
      try {
        // Use a more robust approach to EXIF extraction
        if (typeof EXIF !== 'undefined' && EXIF.getData) {
          // Create a new promise-based approach to avoid callback issues
          const extractLocation = (): Promise<{ lat: number, lng: number } | null> => {
            return new Promise((resolve) => {
              try {
                EXIF.getData(firstFile as any, function(this: any) {
                  try {
                    // Check if EXIF is properly loaded and has the required methods
                    if (typeof EXIF.getTag !== 'function') {
                      console.log('EXIF.getTag is not available');
                      resolve(null);
                      return;
                    }

                    const lat = EXIF.getTag(this, "GPSLatitude");
                    const lng = EXIF.getTag(this, "GPSLongitude");
                    
                    // Validate that we have valid GPS data
                    if (lat && lng && Array.isArray(lat) && Array.isArray(lng) && lat.length === 3 && lng.length === 3) {
                      // Convert GPS coordinates to decimal format
                      const latDecimal = convertDMSToDD(lat);
                      const lngDecimal = convertDMSToDD(lng);
                      
                      // Validate the converted coordinates
                      if (!isNaN(latDecimal) && !isNaN(lngDecimal) && 
                          latDecimal >= -90 && latDecimal <= 90 && 
                          lngDecimal >= -180 && lngDecimal <= 180) {
                        
                        resolve({ lat: latDecimal, lng: lngDecimal });
                      } else {
                        console.log('Invalid GPS coordinates extracted:', { latDecimal, lngDecimal });
                        resolve(null);
                      }
                    } else {
                      console.log('No valid GPS data found in image');
                      resolve(null);
                    }
                  } catch (error) {
                    console.log('Error extracting EXIF data:', error);
                    resolve(null);
                  }
                });
              } catch (error) {
                console.log('Error in EXIF.getData:', error);
                resolve(null);
              }
            });
          };

          // Extract location and handle the result
          const location = await extractLocation();
          if (location) {
            setExtractedLocation(location);
            // Find potential hubs near this location
            findPotentialHubs(location);
          }
        } else {
          console.log('EXIF library not properly loaded');
        }
      } catch (error) {
        console.log('Error processing EXIF data:', error);
        // Continue without location extraction
      }
    }
  };

  const findPotentialHubs = async (location: { lat: number, lng: number }) => {
    // Search for hubs within a certain radius of the photo's location
    const potentialHubs = await firebaseDataService.findHubsNear(location.lat, location.lng, 1000); // 1km radius
    if (potentialHubs.length > 0) {
      // For now, just guess the first one. A better implementation would let the user choose.
      const bestGuess = potentialHubs[0];
      setHubGuess({
        id: bestGuess.id,
        name: bestGuess.name,
        address: bestGuess.address,
        description: bestGuess.description,
        lat: bestGuess.location?.lat,
        lng: bestGuess.location?.lng,
      });
    }
  };
  const handleTakePhoto = () => {
    photoInputRef.current?.click()
  }
  const handleRemovePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index))
  }

  // Step 2: Location/hub selection
  const handleConfirmHub = () => {
    setSelectedHub(hubGuess)
    setHubConfirmed(true)
    setStep('details')
  }
  const handleRejectHub = () => {
    setHubGuess(null)
    setSelectedHub(null)
    setHubConfirmed(false)
  }
  const handleLocationSearch = async (query: string) => {
    setLocationSearch(query)
    // Always offer create-new option; search when query has 0+ chars
    if (query.length >= 0) {
      setIsSearching(true)
      
      const results = await firebaseDataService.searchHubs(query, 10);
      setSearchResults(results.map(p => ({
        id: p.id,
        name: p.name,
        address: p.location?.address || p.address || 'No address available',
        description: p.description,
        lat: p.location?.lat,
        lng: p.location?.lng,
      })));
      setIsSearching(false)
    }
  }
  const handleSelectHub = (hub: CreatePostHub) => {
    // Track the final selected hub
    if (currentUser) {
      firebaseDataService.trackUserInteraction(currentUser.id, 'search', { query: `hub: ${hub.name}` });
    }
    
    setSelectedHub(hub)
    setHubConfirmed(true)
    setStep('details')
  }
  const handleCreateNewHub = async () => {
    if (newHubName && newHubAddress) {
      const newHubData = {
        name: newHubName,
        address: newHubAddress,
        description: newHubDescription,
        coordinates: newHubCoordinates || undefined,
      };
      const newHubId = await firebaseDataService.createHub(newHubData);
      const newHub: CreatePostHub = {
        id: newHubId,
        name: newHubName,
        address: newHubAddress,
        description: newHubDescription,
        lat: newHubCoordinates?.lat,
        lng: newHubCoordinates?.lng
      }
      
      // Track the newly created hub
      if (currentUser) {
        firebaseDataService.trackUserInteraction(currentUser.id, 'search', { query: `hub: ${newHubName}` });
      }
      
      setSelectedHub(newHub)
      setHubConfirmed(true)
      setStep('details')
    }
  }

  // Step 3: Details
  const handleAddTag = async () => {
    if (newTag.trim() && !tags.includes(newTag.trim()) && tags.length < 3) {
      const tagToAdd = newTag.trim()
      setTags(prev => [...prev, tagToAdd])
      setNewTag('')
      
      // TagAutocomplete component will handle saving to Firebase
    }
  }
  const handleRemoveTag = (tagToRemove: string) => {
    setTags(prev => prev.filter(tag => tag !== tagToRemove))
  }
  
  const handlePlaceSelect = (place: string, details?: google.maps.places.PlaceResult) => {
    setNewHubAddress(place);
    if (details?.geometry?.location) {
      setNewHubCoordinates({
        lat: details.geometry.location.lat(),
        lng: details.geometry.location.lng()
      });
    }
  }
  const handleSubmit = async () => {
    if (!currentUser || !selectedHub) return;

    try {
      // 1. Create post data object
      const postData = {
        userId: currentUser.id,
        hubId: selectedHub.id,
        description,
        images: photos,
        tags,
        privacy,
        postType: howWasIt,
        triedRating: howWasIt === 'tried' ? triedFeeling : null,
        listIds: Array.from(selectedListIds),
        location: extractedLocation
      };
      
      // 2. Save post to Firestore
      await firebasePostService.createPost(postData);
      
      console.log('✅ Post created successfully:', postData);
      handleClose();
    } catch (error) {
      console.error('❌ Error creating post:', error);
      // Still close modal but show user an error
      handleClose();
    }
  }
  const resetForm = () => {
    setStep('photo')
    setPhotos([])
    setExtractedLocation(null)
    setHubGuess(null)
    setHubConfirmed(false)
    setSelectedHub(preSelectedHub || null)
    setIsCreatingNewHub(false)
    setNewHubName('')
    setNewHubAddress('')
    setNewHubDescription('')
    setNewHubCoordinates(null)
    setLocationSearch('')
    setSearchResults([])
    setHowWasIt('loved')
    setTriedFeeling('liked')
    setIsScreenshot(false)
    setDescription('')
    setTags([])
    setNewTag('')
    setPrivacy('public')
    setSelectedListIds(new Set(preSelectedListIds || []))
    setListSearchQuery('')
  }
  const handleClose = () => {
    resetForm()
    onClose()
  }

  // Step navigation
  const handleBack = () => {
    if (step === 'location') setStep('photo')
    else if (step === 'details') setStep('location')
    else handleClose()
  }

  if (!isOpen) return null

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl max-h-[92vh] bg-white rounded-3xl shadow-botanical border border-linen-200 overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-linen-200 bg-linen-50 flex items-center justify-between">
          <button
            onClick={handleBack}
            className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-soft hover:shadow-botanical transition-all duration-200"
            aria-label="Back"
          >
            <ArrowLeftIcon className="w-6 h-6 text-charcoal-600" />
          </button>
          <h2 className="text-xl font-serif font-semibold text-charcoal-700 flex-1 text-center">Create Post</h2>
          <button
            onClick={handleClose}
            className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-soft hover:shadow-botanical transition-all duration-200"
            aria-label="Close"
          >
            <XMarkIcon className="w-6 h-6 text-charcoal-600" />
          </button>
        </div>
        {/* Progress indicator */}
        <div className="flex items-center gap-2 mt-4 px-6">
          <div className={`w-3 h-3 rounded-full ${step === 'photo' ? 'bg-sage-500' : 'bg-sage-200'}`} />
          <div className={`w-3 h-3 rounded-full ${step === 'location' ? 'bg-sage-500' : 'bg-sage-200'}`} />
          <div className={`w-3 h-3 rounded-full ${step === 'details' ? 'bg-sage-500' : 'bg-sage-200'}`} />
        </div>
        {/* Content */}
        <div className="p-6 space-y-6 max-h-[calc(92vh-12rem)] overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}>
          {/* Step 1: Photo */}
          {step === 'photo' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-charcoal-700 mb-2">Add Photos</h3>
                <p className="text-charcoal-500 text-sm mb-4">Share your experience by uploading or taking photos. You can add multiple images.</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={handleTakePhoto}
                  className="aspect-square bg-linen-50 border-2 border-dashed border-linen-300 rounded-2xl flex flex-col items-center justify-center hover:bg-linen-100 transition"
                >
                  <CameraIcon className="w-8 h-8 text-charcoal-400 mb-2" />
                  <span className="text-sm text-charcoal-500">Take Photo</span>
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="aspect-square bg-linen-50 border-2 border-dashed border-linen-300 rounded-2xl flex flex-col items-center justify-center hover:bg-linen-100 transition"
                >
                  <PhotoIcon className="w-8 h-8 text-charcoal-400 mb-2" />
                  <span className="text-sm text-charcoal-500">Upload Photo(s)</span>
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
              />
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoUpload}
                className="hidden"
              />
              {photos.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-charcoal-700">Selected Photos ({photos.length})</h4>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="text-sage-600 hover:text-sage-700 text-sm font-medium"
                    >
                      Add More
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {photos.map((photo, index) => (
                      <div key={index} className="relative aspect-square group">
                        <img
                          src={URL.createObjectURL(photo)}
                          alt={`Photo ${index + 1}`}
                          className="w-full h-full object-cover rounded-xl"
                        />
                        <button
                          onClick={() => handleRemovePhoto(index)}
                          className="absolute top-2 right-2 w-6 h-6 bg-black/50 text-white rounded-full flex items-center justify-center text-xs opacity-80 group-hover:opacity-100 transition-opacity"
                          aria-label="Remove photo"
                        >
                          ×
                        </button>
                        <div className="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
                          {index + 1}
                        </div>
                      </div>
                    ))}
                  </div>
                  {extractedLocation && (
                    <div className="bg-sage-50 border border-sage-200 rounded-xl p-3">
                      <div className="flex items-center gap-2 text-sage-700 text-sm">
                        <MapPinIcon className="w-4 h-4" />
                        <span>Location detected from photos</span>
                      </div>
                    </div>
                  )}
                  {isScreenshot && (
                    <div className="bg-gold-50 border border-gold-200 rounded-xl p-3">
                      <div className="flex items-center gap-2 text-gold-700 text-sm">
                        <span className="text-lg">📱</span>
                        <span>Screenshot detected - you can mark this as want/tried/loved</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
              <button
                onClick={() => {
                  if (selectedHub) {
                    setStep('details')
                  } else {
                    setStep('location')
                  }
                }}
                disabled={photos.length === 0}
                className="w-full bg-sage-400 text-white py-3 rounded-xl font-medium hover:bg-sage-500 transition disabled:bg-charcoal-200 disabled:cursor-not-allowed"
              >
                {selectedHub ? 'Continue to Details' : 'Continue to Location'}
              </button>
            </div>
          )}
          {/* Step 2: Location/Hub */}
          {step === 'location' && (
            <div className="space-y-6">
              {extractedLocation && !hubGuess && (
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-xl text-yellow-800">
                  <span>We found a location in your photo, but couldn't match it to a hub. Please search for the place below.</span>
                </div>
              )}
              {hubGuess && !hubConfirmed && (
                <div className="bg-sage-50 border-l-4 border-sage-400 p-4 rounded-xl text-sage-800 flex flex-col gap-2">
                  <span>We think this photo was taken at:</span>
                  <div className="font-semibold">{hubGuess.name}</div>
                  <div className="text-sm text-sage-700">{hubGuess.address}</div>
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={handleConfirmHub}
                      className="bg-sage-400 text-white px-4 py-2 rounded-xl font-medium hover:bg-sage-500 transition"
                    >
                      Yes, that's correct
                    </button>
                    <button
                      onClick={handleRejectHub}
                      className="bg-linen-200 text-sage-700 px-4 py-2 rounded-xl font-medium hover:bg-linen-300 transition"
                    >
                      No, search for another
                    </button>
                  </div>
                </div>
              )}
              {!hubGuess && !hubConfirmed && (
                <div>
                  <h3 className="text-lg font-semibold text-charcoal-700 mb-2">Where are you?</h3>
                  <p className="text-charcoal-500 text-sm mb-4">Search for a place or create a new hub</p>
                  <div className="relative mb-4">
                    <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-charcoal-400" />
                    <input
                      type="text"
                      value={locationSearch}
                      onChange={(e) => handleLocationSearch(e.target.value)}
                      placeholder="Search for a place..."
                      className="w-full pl-10 pr-4 py-3 border border-linen-200 rounded-xl bg-linen-50 text-charcoal-600 focus:outline-none focus:ring-2 focus:ring-sage-200"
                    />
                  </div>
                  {isSearching && (
                    <div className="text-center py-4 text-charcoal-500">
                      Searching...
                    </div>
                  )}
                  {searchResults.length > 0 && (
                    <div className="space-y-2">
                      {searchResults.map((hub) => (
                        <button
                          key={hub.id}
                          onClick={() => handleSelectHub(hub)}
                          className="w-full p-3 text-left bg-white border border-linen-200 rounded-xl hover:bg-linen-50 transition"
                        >
                          <div className="font-medium text-charcoal-700">{hub.name}</div>
                          <div className="text-sm text-charcoal-500">{hub.address}</div>
                        </button>
                      ))}
                    </div>
                  )}
                  {!isSearching && (
                    <div className="text-center py-4">
                      <p className="text-charcoal-500 mb-4">Can't find what you're looking for?</p>
                      <button
                        onClick={() => setIsCreatingNewHub(true)}
                        className="bg-sage-400 text-white px-4 py-2 rounded-xl font-medium hover:bg-sage-500 transition"
                      >
                        Create New Hub
                      </button>
                    </div>
                  )}
                </div>
              )}
              {isCreatingNewHub && (
                <div className="bg-linen-50 rounded-2xl p-4 space-y-4">
                  <h4 className="font-semibold text-charcoal-700">Create New Hub</h4>
                  <input
                    type="text"
                    value={newHubName}
                    onChange={(e) => setNewHubName(e.target.value)}
                    placeholder="Place name"
                    className="w-full px-4 py-3 border border-linen-200 rounded-xl bg-white text-charcoal-600 focus:outline-none focus:ring-2 focus:ring-sage-200"
                  />
                  <AddressAutocomplete
                    onPlaceSelect={handlePlaceSelect}
                    placeholder="Enter address..."
                    value={newHubAddress}
                    className=""
                  />
                  <textarea
                    value={newHubDescription}
                    onChange={(e) => setNewHubDescription(e.target.value)}
                    placeholder="Short description (optional)"
                    rows={3}
                    className="w-full px-4 py-3 border border-linen-200 rounded-xl bg-white text-charcoal-600 focus:outline-none focus:ring-2 focus:ring-sage-200 resize-none"
                  />
                  <button
                    onClick={handleCreateNewHub}
                    disabled={!newHubName || !newHubAddress}
                    className="w-full bg-sage-400 text-white py-3 rounded-xl font-medium hover:bg-sage-500 transition disabled:bg-charcoal-200 disabled:cursor-not-allowed"
                  >
                    Create Hub & Continue
                  </button>
                </div>
              )}
              <button
                onClick={() => setStep('photo')}
                className="w-full bg-linen-200 text-sage-700 py-3 rounded-xl font-medium hover:bg-linen-300 transition"
              >
                Back
              </button>
            </div>
          )}
          {/* Step 3: Details */}
          {step === 'details' && selectedHub && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-charcoal-700 mb-2">Post Details</h3>
                <p className="text-charcoal-500 text-sm mb-4">Tell us about your experience</p>
              </div>
              {/* How was it? Want/Tried/Loved */}
              <div>
                <label className="block text-sm font-medium text-charcoal-700 mb-3">
                  {isScreenshot ? 'How do you feel about this?' : 'How was it?'}
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {(['want', 'tried', 'loved'] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setHowWasIt(type)}
                      className={`p-3 rounded-xl border-2 transition ${
                        howWasIt === type
                          ? 'border-sage-400 bg-sage-50 text-sage-700'
                          : 'border-linen-200 bg-white text-charcoal-600 hover:border-sage-200'
                      }`}
                    >
                      <div className="text-sm font-medium capitalize">{type}</div>
                    </button>
                  ))}
                </div>
              </div>
              {/* If tried, show feeling */}
              {howWasIt === 'tried' && (
                <div>
                  <label className="block text-sm font-medium text-charcoal-700 mb-3">How did you feel about it?</label>
                  <div className="grid grid-cols-3 gap-3">
                    {(['liked', 'neutral', 'disliked'] as const).map((feeling) => (
                      <button
                        key={feeling}
                        onClick={() => setTriedFeeling(feeling)}
                        className={`p-3 rounded-xl border-2 transition ${
                          triedFeeling === feeling
                            ? 'border-sage-400 bg-sage-50 text-sage-700'
                            : 'border-linen-200 bg-white text-charcoal-600 hover:border-sage-200'
                        }`}
                      >
                        <div className="text-sm font-medium capitalize">{feeling}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-charcoal-700 mb-2">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Share your experience..."
                  rows={4}
                  className="w-full px-4 py-3 border border-linen-200 rounded-xl bg-linen-50 text-charcoal-600 focus:outline-none focus:ring-2 focus:ring-sage-200 resize-none"
                />
              </div>
              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-charcoal-700 mb-2">Tags</label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-3 py-1 bg-sage-100 text-sage-700 rounded-full text-sm flex items-center gap-2"
                    >
                      #{tag}
                      <button
                        onClick={() => handleRemoveTag(tag)}
                        className="text-sage-500 hover:text-sage-700"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <TagAutocomplete
                  value={newTag}
                  onChange={setNewTag}
                  onAdd={handleAddTag}
                  placeholder="Add a tag..."
                  maxTags={3}
                  currentTags={tags}
                  availableTags={availableTags}
                />
              </div>
              {/* List Selection (exclude All Loved/All Tried) */}
              <div>
                <label className="block text-sm font-medium text-charcoal-700 mb-2">Save to Lists (optional)</label>
                
                {/* Search bar for lists */}
                <div className="relative mb-3">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-charcoal-400 pointer-events-none z-10" />
                  <input
                    type="text"
                    value={listSearchQuery}
                    onChange={(e) => setListSearchQuery(e.target.value)}
                    placeholder="Search your lists..."
                    className="w-full pl-10 pr-4 py-2 border border-linen-200 rounded-xl bg-linen-50 text-charcoal-600 focus:outline-none focus:ring-2 focus:ring-sage-200"
                  />
                </div>

                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {filteredLists.length > 0 ? (
                    filteredLists.map((list) => (
                      <label
                        key={list.id}
                        className={`flex items-center gap-3 p-3 border border-linen-200 rounded-xl cursor-pointer hover:bg-linen-50 transition ${
                          selectedListIds.has(list.id)
                            ? 'border-sage-300 bg-sage-50'
                            : 'border-linen-200'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedListIds.has(list.id)}
                          onChange={(e) => {
                            const newSet = new Set(selectedListIds)
                            if (e.target.checked) {
                              newSet.add(list.id)
                            } else {
                              newSet.delete(list.id)
                            }
                            setSelectedListIds(newSet)
                          }}
                          className="w-4 h-4 text-sage-500 focus:ring-sage-400"
                        />
                        <div className="flex-1">
                          <div className="font-medium text-charcoal-700">{list.name}</div>
                        </div>
                      </label>
                    ))
                  ) : (
                    <div className="text-center py-4 text-charcoal-500 text-sm">
                      {listSearchQuery ? 'No lists found matching your search' : 'No lists available'}
                    </div>
                  )}
                </div>
                
                {selectedListIds.size > 0 && (
                  <div className="mt-2 text-xs text-charcoal-500">
                    Selected {selectedListIds.size} list{selectedListIds.size !== 1 ? 's' : ''}
                  </div>
                )}
              </div>
              {/* Privacy Settings */}
              <div>
                <label className="block text-sm font-medium text-charcoal-700 mb-2">Privacy</label>
                <div className="space-y-2">
                  {([
                    { key: 'public', label: 'Public', icon: EyeIcon, desc: 'Anyone can see this post' },
                    { key: 'friends', label: 'Friends', icon: UsersIcon, desc: 'Only your friends can see this post' },
                    { key: 'private', label: 'Private', icon: EyeSlashIcon, desc: 'Only you can see this post' }
                  ] as const).map(({ key, label, icon: Icon, desc }) => (
                    <label
                      key={key}
                      className="flex items-center gap-3 p-3 border border-linen-200 rounded-xl cursor-pointer hover:bg-linen-50 transition"
                    >
                      <input
                        type="radio"
                        name="privacy"
                        value={key}
                        checked={privacy === key}
                        onChange={() => setPrivacy(key)}
                        className="w-4 h-4 text-sage-500 focus:ring-sage-400"
                      />
                      <Icon className="w-5 h-5 text-charcoal-400" />
                      <div>
                        <div className="font-medium text-charcoal-700">{label}</div>
                        <div className="text-sm text-charcoal-500">{desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              <button
                onClick={handleSubmit}
                className="w-full bg-sage-400 text-white py-3 rounded-xl font-medium hover:bg-sage-500 transition"
              >
                Create Post
              </button>
              <button
                onClick={() => setStep('location')}
                className="w-full bg-linen-200 text-sage-700 py-3 rounded-xl font-medium hover:bg-linen-300 transition"
              >
                Back
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}

export default CreatePost
