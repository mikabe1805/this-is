import { useState, useRef, useEffect } from 'react';
import { useModalDismiss } from '../hooks/useModalDismiss';
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
      // createHub returns { id, created } — taking the whole object as the
      // id was setting selectedHub.id to "[object Object]" and the post
      // would write to a non-existent hub.
      const result = await firebaseDataService.createHub(newHubData);
      const newHubId = result?.id
      if (!newHubId) {
        console.error('[create-post] failed to create hub — no id returned')
        return
      }
      const newHub: CreatePostHub = {
        id: newHubId,
        name: newHubName,
        address: newHubAddress,
        description: newHubDescription,
        lat: newHubCoordinates?.lat,
        lng: newHubCoordinates?.lng
      }

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
      // Notify subscribers (PlaceHub feed, etc.) so they can re-fetch posts.
      window.dispatchEvent(new CustomEvent('this-is:posted', {
        detail: { placeId: selectedHub.id, listIds: Array.from(selectedListIds) }
      }));
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

  // If the parent toggles isOpen=false without calling handleClose (e.g. on
  // a successful submit), still flush the form so the next open is clean.
  useEffect(() => {
    if (!isOpen) resetForm()
    // resetForm captures preSelected props; intentionally not in deps to avoid
    // resetting mid-edit when a parent re-renders with the same selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  // Step navigation
  const handleBack = () => {
    if (step === 'location') setStep('photo')
    else if (step === 'details') setStep('location')
    else handleClose()
  }

  useModalDismiss(isOpen, handleClose)

  if (!isOpen) return null

  const stepNumber = step === 'photo' ? 1 : step === 'location' ? 2 : 3
  const stepLabel = step === 'photo' ? 'Photos' : step === 'location' ? 'Place' : 'Details'

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-[#1A1815]/55 backdrop-blur-sm">
      <div className="relative w-full sm:max-w-md max-h-[92vh] bg-paper rounded-t-[24px] sm:rounded-[24px] overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-edge flex items-center justify-between">
          <button
            onClick={handleBack}
            className="h-9 w-9 rounded-full hover:bg-paper-deep flex items-center justify-center"
            aria-label="Back"
          >
            <ArrowLeftIcon className="w-5 h-5 text-ink" />
          </button>
          <div className="flex items-center gap-2 label-eyebrow text-ink-mute">
            <span style={{ color: 'var(--accent-deep)' }}>0{stepNumber}</span>
            <span className="text-ink-faint">/</span>
            <span>03 · {stepLabel}</span>
          </div>
          <button
            onClick={handleClose}
            className="h-9 w-9 rounded-full hover:bg-paper-deep flex items-center justify-center"
            aria-label="Close"
          >
            <XMarkIcon className="w-5 h-5 text-ink" />
          </button>
        </div>
        {/* Amber progress hairline */}
        <div className="px-5 pt-3">
          <div className="relative h-[3px] rounded-full bg-paper-deep overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 rounded-full transition-all duration-300"
              style={{
                width: `${(stepNumber / 3) * 100}%`,
                background: 'linear-gradient(90deg, var(--accent-bright) 0%, var(--accent) 60%, var(--accent-deep) 100%)',
                boxShadow: '0 0 8px var(--accent-glow)',
              }}
            />
          </div>
        </div>
        {/* Content */}
        <div className="p-6 space-y-6 max-h-[calc(92vh-12rem)] overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}>
          {/* Step 1: Photo */}
          {step === 'photo' && (
            <div className="space-y-6">
              <div>
                <p className="label-eyebrow text-ink-mute mb-2">Step one</p>
                <h3 className="font-display text-[26px] leading-tight text-ink">Add a photo<span style={{ color: 'var(--bloom)' }}>.</span></h3>
                <p className="text-[13px] text-ink-soft mt-2">A photo or two of where you were. They show up on the place hub.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleTakePhoto}
                  className="btn-secondary aspect-square flex flex-col items-center justify-center gap-2"
                  style={{ borderRadius: 18 }}
                >
                  <CameraIcon className="w-6 h-6 text-ink-soft" />
                  <span className="label-eyebrow text-ink-soft">Take photo</span>
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="btn-secondary aspect-square flex flex-col items-center justify-center gap-2"
                  style={{ borderRadius: 18 }}
                >
                  <PhotoIcon className="w-6 h-6 text-ink-soft" />
                  <span className="label-eyebrow text-ink-soft">Upload</span>
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
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="label-eyebrow text-ink-mute">Selected · {photos.length}</span>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="label-eyebrow text-ink-soft hover:text-ink"
                    >
                      Add more
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {photos.map((photo, index) => (
                      <div key={index} className="relative aspect-square group rounded-[10px] overflow-hidden">
                        <img
                          src={URL.createObjectURL(photo)}
                          alt={`Photo ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <button
                          onClick={() => handleRemovePhoto(index)}
                          className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center text-xs opacity-95 transition-opacity"
                          style={{ background: 'rgba(46,28,13,0.70)', color: '#FFF' }}
                          aria-label="Remove photo"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                  {extractedLocation && (
                    <div className="glass-honey rounded-[10px] px-3 py-2.5 flex items-center gap-2 text-[13px]">
                      <MapPinIcon className="w-4 h-4" />
                      <span>Location detected from photos</span>
                    </div>
                  )}
                  {isScreenshot && (
                    <div className="glass-honey rounded-[10px] px-3 py-2.5 flex items-center gap-2 text-[13px]">
                      <span>Screenshot detected — mark this as want, tried, or loved.</span>
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
                className="btn-cta w-full h-12 font-semibold text-[15px]"
              >
                {selectedHub ? 'Continue' : 'Pick a place →'}
              </button>
            </div>
          )}
          {/* Step 2: Location/Hub */}
          {step === 'location' && (
            <div className="space-y-5">
              {extractedLocation && !hubGuess && (
                <div className="glass-honey rounded-[10px] px-4 py-3 text-[13px]">
                  We found a location in your photo, but couldn't match it to a place. Search below to pin it.
                </div>
              )}
              {hubGuess && !hubConfirmed && (
                <div className="glass-honey rounded-[14px] p-4 flex flex-col gap-2">
                  <span className="label-eyebrow text-ink-mute">Looks like</span>
                  <div className="font-display text-[20px] leading-tight text-ink">{hubGuess.name}</div>
                  <div className="text-[12px] text-ink-soft">{hubGuess.address}</div>
                  <div className="flex gap-2 mt-2">
                    <button onClick={handleConfirmHub} className="btn-cta h-10 px-4 text-[13px] font-semibold flex-1">
                      Yes, that's right
                    </button>
                    <button onClick={handleRejectHub} className="btn-secondary h-10 px-4 text-[13px] font-medium flex-1">
                      Search again
                    </button>
                  </div>
                </div>
              )}
              {!hubGuess && !hubConfirmed && (
                <div>
                  <p className="label-eyebrow text-ink-mute mb-2">Step two</p>
                  <h3 className="font-display text-[26px] leading-tight text-ink">Where were you<span style={{ color: 'var(--bloom)' }}>?</span></h3>
                  <p className="text-[13px] text-ink-soft mt-2 mb-4">Search for the place, or add it if it's new.</p>
                  <div className="flex items-center gap-2 h-11 px-4 rounded-full bg-card border border-edge focus-within:border-ink/40 mb-4">
                    <MagnifyingGlassIcon className="w-[18px] h-[18px] text-ink-mute shrink-0" />
                    <input
                      type="text"
                      value={locationSearch}
                      onChange={(e) => handleLocationSearch(e.target.value)}
                      placeholder="Try a name or address"
                      className="flex-1 bg-transparent outline-none text-[14px] text-ink placeholder:text-ink-mute"
                    />
                  </div>
                  {isSearching && (
                    <p className="font-mono text-[10px] tracking-[0.12em] uppercase text-center text-ink-mute py-2">Searching…</p>
                  )}
                  {searchResults.length > 0 && (
                    <ul className="divide-y divide-edge border-y border-edge">
                      {searchResults.map((hub) => (
                        <li key={hub.id}>
                          <button
                            onClick={() => handleSelectHub(hub)}
                            className="w-full px-1 py-3.5 text-left hover:bg-paper-deep transition-colors"
                          >
                            <div className="font-display text-[18px] leading-tight text-ink truncate">{hub.name}</div>
                            <div className="font-mono text-[10px] tracking-[0.12em] uppercase text-ink-mute mt-1 truncate">{hub.address}</div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {!isSearching && searchResults.length === 0 && (
                    <div className="text-center py-6">
                      <p className="text-[13px] text-ink-soft mb-3">Can't find it?</p>
                      <button onClick={() => setIsCreatingNewHub(true)} className="btn-secondary h-10 px-5 text-[13px] font-medium">
                        Add a new place
                      </button>
                    </div>
                  )}
                </div>
              )}
              {isCreatingNewHub && (
                <div className="space-y-3 border-t border-edge pt-5">
                  <p className="label-eyebrow text-ink-mute">New place</p>
                  <input
                    type="text"
                    value={newHubName}
                    onChange={(e) => setNewHubName(e.target.value)}
                    placeholder="Name"
                    className="w-full h-11 px-4 rounded-full bg-card border border-edge text-[14px] text-ink placeholder:text-ink-mute outline-none focus:border-ink/40"
                  />
                  <AddressAutocomplete onPlaceSelect={handlePlaceSelect} placeholder="Address" value={newHubAddress} className="" />
                  <textarea
                    value={newHubDescription}
                    onChange={(e) => setNewHubDescription(e.target.value)}
                    placeholder="A short description (optional)"
                    rows={3}
                    className="w-full px-4 py-3 rounded-[18px] bg-card border border-edge text-[14px] text-ink placeholder:text-ink-mute outline-none focus:border-ink/40 resize-none"
                  />
                  <button
                    onClick={handleCreateNewHub}
                    disabled={!newHubName || !newHubAddress}
                    className="btn-cta w-full h-12 font-semibold text-[15px]"
                  >
                    Add & continue
                  </button>
                </div>
              )}
              <button onClick={() => setStep('photo')} className="btn-secondary w-full h-11 text-[13px] font-medium">
                Back
              </button>
            </div>
          )}
          {/* Step 3: Details */}
          {step === 'details' && selectedHub && (
            <div className="space-y-5">
              <div>
                <p className="label-eyebrow text-ink-mute mb-2">Step three</p>
                <h3 className="font-display text-[26px] leading-tight text-ink">Tell the story<span style={{ color: 'var(--bloom)' }}>.</span></h3>
                <p className="text-[13px] text-ink-soft mt-2">A line about how it was, and a tag or two if you want.</p>
              </div>
              {/* How was it? Want/Tried/Loved */}
              <div>
                <p className="label-eyebrow text-ink-mute mb-2.5">
                  {isScreenshot ? 'How do you feel about this?' : 'How was it?'}
                </p>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['want', 'tried', 'loved'] as const).map((type) => {
                    const active = howWasIt === type
                    const label = type === 'want' ? 'Want' : type === 'tried' ? 'Been' : 'Loved'
                    return (
                      <button
                        key={type}
                        onClick={() => setHowWasIt(type)}
                        className={`h-12 rounded-full text-[13px] font-medium border transition-colors flex items-center justify-center capitalize ${
                          active ? 'btn-cta border-transparent' : 'btn-secondary'
                        }`}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>
              {/* If tried, show feeling */}
              {howWasIt === 'tried' && (
                <div>
                  <p className="label-eyebrow text-ink-mute mb-2.5">How did it feel?</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['liked', 'neutral', 'disliked'] as const).map((feeling) => {
                      const active = triedFeeling === feeling
                      return (
                        <button
                          key={feeling}
                          onClick={() => setTriedFeeling(feeling)}
                          className={`h-10 rounded-full text-[13px] font-medium border transition-colors capitalize ${
                            active ? 'bg-ink text-paper border-ink' : 'btn-secondary'
                          }`}
                        >
                          {feeling}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
              {/* Description */}
              <div>
                <p className="label-eyebrow text-ink-mute mb-2">Description</p>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What did you think?"
                  rows={4}
                  className="w-full px-4 py-3 rounded-[18px] bg-card border border-edge text-[14px] text-ink placeholder:text-ink-mute outline-none focus:border-ink/40 resize-none"
                />
              </div>
              {/* Tags */}
              <div>
                <p className="label-eyebrow text-ink-mute mb-2">Tags</p>
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2.5">
                    {tags.map((tag) => (
                      <span
                        key={tag}
                        className="glass-honey px-3 h-7 rounded-full label-eyebrow flex items-center gap-1.5"
                      >
                        {tag}
                        <button onClick={() => handleRemoveTag(tag)} aria-label={`Remove ${tag}`}>×</button>
                      </span>
                    ))}
                  </div>
                )}
                <TagAutocomplete
                  value={newTag}
                  onChange={setNewTag}
                  onAdd={handleAddTag}
                  placeholder="Add a tag…"
                  maxTags={3}
                  currentTags={tags}
                  availableTags={availableTags}
                />
              </div>
              {/* List Selection */}
              <div>
                <p className="label-eyebrow text-ink-mute mb-2">Add to lists <span className="font-normal text-ink-faint">· optional</span></p>
                <div className="flex items-center gap-2 h-10 px-3.5 rounded-full bg-card border border-edge focus-within:border-ink/40 mb-2">
                  <MagnifyingGlassIcon className="w-4 h-4 text-ink-mute shrink-0" />
                  <input
                    type="text"
                    value={listSearchQuery}
                    onChange={(e) => setListSearchQuery(e.target.value)}
                    placeholder="Search lists"
                    className="flex-1 bg-transparent outline-none text-[13px] text-ink placeholder:text-ink-mute"
                  />
                </div>
                <div className="max-h-36 overflow-y-auto -mx-1">
                  {filteredLists.length > 0 ? (
                    <ul className="px-1">
                      {filteredLists.map((list) => {
                        const checked = selectedListIds.has(list.id)
                        return (
                          <li key={list.id}>
                            <label className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
                              checked ? 'bg-paper-deep' : 'hover:bg-paper-deep'
                            }`}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  const newSet = new Set(selectedListIds)
                                  if (e.target.checked) newSet.add(list.id); else newSet.delete(list.id)
                                  setSelectedListIds(newSet)
                                }}
                                className="w-4 h-4 rounded accent-walnut"
                                style={{ accentColor: 'var(--walnut)' }}
                              />
                              <span className="text-[14px] font-medium text-ink truncate flex-1">{list.name}</span>
                            </label>
                          </li>
                        )
                      })}
                    </ul>
                  ) : (
                    <p className="text-center py-3 text-[12px] text-ink-mute">
                      {listSearchQuery ? 'No matching lists' : 'No lists yet'}
                    </p>
                  )}
                </div>
              </div>
              {/* Privacy Settings */}
              <div>
                <p className="label-eyebrow text-ink-mute mb-2">Privacy</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { key: 'public', label: 'Public', icon: EyeIcon },
                    { key: 'friends', label: 'Friends', icon: UsersIcon },
                    { key: 'private', label: 'Private', icon: EyeSlashIcon },
                  ] as const).map(({ key, label, icon: Icon }) => {
                    const active = privacy === key
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setPrivacy(key)}
                        className={`h-11 rounded-full text-[13px] font-medium border transition-colors flex items-center justify-center gap-1.5 ${
                          active ? 'bg-ink text-paper border-ink' : 'btn-secondary'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setStep('location')}
                  className="btn-secondary h-12 px-5 font-medium text-[14px]"
                >
                  Back
                </button>
                <button
                  onClick={handleSubmit}
                  className="btn-cta flex-1 h-12 font-semibold text-[15px]"
                >
                  Post
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}

export default CreatePost
