import { useState, useRef } from 'react'
import { XMarkIcon, MapIcon, MagnifyingGlassIcon, CheckIcon, XMarkIcon as XMarkIconSolid } from '@heroicons/react/24/outline'
import { createPortal } from 'react-dom'

interface GoogleMapsImportModalProps {
  isOpen: boolean
  onClose: () => void
  onImport?: (importData: ImportData) => void
}

interface ImportData {
  listName: string
  places: ImportedPlace[]
}

interface ImportedPlace {
  name: string
  address: string
  googleMapsUrl: string
  status: 'undefined' | 'want' | 'tried' | 'loved'
  hubId?: string
  matchedHub?: {
    id: string
    name: string
    address: string
  }
}

const GoogleMapsImportModal = ({ isOpen, onClose, onImport }: GoogleMapsImportModalProps) => {
  const [step, setStep] = useState<'url' | 'review' | 'matching'>('url')
  const [googleMapsUrl, setGoogleMapsUrl] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [listName, setListName] = useState('')
  const [importedPlaces, setImportedPlaces] = useState<ImportedPlace[]>([])
  const [matchingProgress, setMatchingProgress] = useState(0)
  const [isMatching, setIsMatching] = useState(false)

  // Mock data for demonstration
  const mockImportedPlaces: ImportedPlace[] = [
    {
      name: 'Blue Bottle Coffee',
      address: '300 Webster St, Oakland, CA 94607',
      googleMapsUrl: 'https://maps.google.com/...',
      status: 'undefined'
    },
    {
      name: 'Tartine Bakery',
      address: '600 Guerrero St, San Francisco, CA 94110',
      googleMapsUrl: 'https://maps.google.com/...',
      status: 'undefined'
    },
    {
      name: 'Philz Coffee',
      address: '1600 Shattuck Ave, Berkeley, CA 94709',
      googleMapsUrl: 'https://maps.google.com/...',
      status: 'undefined'
    },
    {
      name: 'Sightglass Coffee',
      address: '270 7th St, San Francisco, CA 94103',
      googleMapsUrl: 'https://maps.google.com/...',
      status: 'undefined'
    }
  ]

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!googleMapsUrl.trim()) return

    setIsLoading(true)
    
    // Simulate API call to fetch Google Maps list
    setTimeout(() => {
      setListName('My Coffee Tour')
      setImportedPlaces(mockImportedPlaces)
      setIsLoading(false)
      setStep('review')
    }, 2000)
  }

  const handleStartMatching = async () => {
    setIsMatching(true)
    setStep('matching')
    
    // Simulate hub matching process
    for (let i = 0; i <= 100; i += 20) {
      setMatchingProgress(i)
      await new Promise(resolve => setTimeout(resolve, 500))
    }
    
    // Update places with matched hubs
    const updatedPlaces = importedPlaces.map((place, index) => {
      if (index === 0) {
        return {
          ...place,
          matchedHub: {
            id: '1',
            name: 'Blue Bottle Coffee',
            address: '300 Webster St, Oakland, CA 94607'
          }
        }
      } else if (index === 1) {
        return {
          ...place,
          matchedHub: {
            id: '2',
            name: 'Tartine Bakery',
            address: '600 Guerrero St, San Francisco, CA 94110'
          }
        }
      }
      return place
    })
    
    setImportedPlaces(updatedPlaces)
    setIsMatching(false)
  }

  const handleStatusChange = (placeIndex: number, status: 'undefined' | 'want' | 'tried' | 'loved') => {
    setImportedPlaces(prev => prev.map((place, index) => 
      index === placeIndex ? { ...place, status } : place
    ))
  }

  const handleImport = () => {
    const importData: ImportData = {
      listName,
      places: importedPlaces
    }
    
    if (onImport) {
      onImport(importData)
    }
    onClose()
  }

  const handleClose = () => {
    setStep('url')
    setGoogleMapsUrl('')
    setIsLoading(false)
    setListName('')
    setImportedPlaces([])
    setMatchingProgress(0)
    setIsMatching(false)
    onClose()
  }

  const handleBack = () => {
    if (step === 'review') {
      setStep('url')
    } else if (step === 'matching') {
      setStep('review')
    }
  }

  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/20 backdrop-blur-md">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-linen-200 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-linen-200">
          <div className="flex items-center gap-3">
            {step !== 'url' && (
              <button
                onClick={handleBack}
                className="p-2 rounded-full hover:bg-linen-100 transition-colors"
              >
                <XMarkIcon className="w-5 h-5 text-charcoal-600 rotate-45" />
              </button>
            )}
            <div>
              <h2 className="text-xl font-serif font-semibold text-charcoal-700">
                {step === 'url' ? 'Import from Google Maps' :
                 step === 'review' ? 'Review Places' : 'Matching Hubs'}
              </h2>
              <p className="text-sm text-charcoal-500">
                {step === 'url' ? 'Paste your Google Maps list URL' :
                 step === 'review' ? 'Review and edit the places' : 'Finding matching hubs...'}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-full hover:bg-linen-100 transition-colors"
          >
            <XMarkIcon className="w-6 h-6 text-charcoal-600" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {step === 'url' && (
            <div className="p-6 space-y-6">
              <div className="bg-linen-50 rounded-xl p-4 border border-linen-200">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 bg-sage-100 rounded-full flex items-center justify-center">
                    <MapIcon className="w-6 h-6 text-sage-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-charcoal-700 mb-2">How to import from Google Maps</h3>
                    <ol className="text-sm text-charcoal-600 space-y-2">
                      <li>1. Open your Google Maps list</li>
                      <li>2. Click "Share" and copy the link</li>
                      <li>3. Paste the link below</li>
                      <li>4. We'll import all places and match them to existing hubs</li>
                    </ol>
                  </div>
                </div>
              </div>

              <form onSubmit={handleUrlSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-charcoal-700 mb-2">
                    Google Maps List URL
                  </label>
                  <input
                    type="url"
                    value={googleMapsUrl}
                    onChange={(e) => setGoogleMapsUrl(e.target.value)}
                    placeholder="https://maps.google.com/..."
                    className="w-full px-4 py-3 border border-linen-200 rounded-xl text-charcoal-600 placeholder-charcoal-400 focus:outline-none focus:ring-2 focus:ring-sage-200 focus:border-sage-300"
                    required
                  />
                </div>
                
                <button
                  type="submit"
                  disabled={!googleMapsUrl.trim() || isLoading}
                  className="w-full py-3 bg-sage-500 text-white rounded-xl font-semibold hover:bg-sage-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isLoading ? 'Importing...' : 'Import List'}
                </button>
              </form>
            </div>
          )}

          {step === 'review' && (
            <div className="p-6 space-y-6">
              {/* List Name */}
              <div>
                <label className="block text-sm font-medium text-charcoal-700 mb-2">List Name</label>
                <input
                  type="text"
                  value={listName}
                  onChange={(e) => setListName(e.target.value)}
                  className="w-full px-4 py-3 border border-linen-200 rounded-xl text-charcoal-600 focus:outline-none focus:ring-2 focus:ring-sage-200 focus:border-sage-300"
                />
              </div>

              {/* Places List */}
              <div>
                <label className="block text-sm font-medium text-charcoal-700 mb-3">
                  Places ({importedPlaces.length})
                </label>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {importedPlaces.map((place, index) => (
                    <div key={index} className="bg-linen-50 rounded-xl p-4 border border-linen-200">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h4 className="font-medium text-charcoal-700">{place.name}</h4>
                          <p className="text-sm text-charcoal-500">{place.address}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs px-2 py-1 bg-charcoal-100 text-charcoal-600 rounded-full">
                            {place.status === 'undefined' ? 'Undefined' : place.status}
                          </span>
                        </div>
                      </div>
                      
                      {/* Status Selection */}
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-charcoal-600">Status:</span>
                        {(['undefined', 'want', 'tried', 'loved'] as const).map((status) => (
                          <button
                            key={status}
                            onClick={() => handleStatusChange(index, status)}
                            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                              place.status === status
                                ? 'bg-sage-500 text-white'
                                : 'bg-white text-charcoal-600 border border-linen-200 hover:bg-sage-50'
                            }`}
                          >
                            {status === 'undefined' ? '?' : status}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleStartMatching}
                  className="flex-1 py-3 bg-sage-500 text-white rounded-xl font-semibold hover:bg-sage-600 transition-colors"
                >
                  Find Matching Hubs
                </button>
                <button
                  onClick={handleImport}
                  className="flex-1 py-3 bg-charcoal-500 text-white rounded-xl font-semibold hover:bg-charcoal-600 transition-colors"
                >
                  Import as-is
                </button>
              </div>
            </div>
          )}

          {step === 'matching' && (
            <div className="p-6 space-y-6">
              {/* Progress */}
              <div className="text-center">
                <div className="w-16 h-16 bg-sage-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <MapIcon className="w-8 h-8 text-sage-600" />
                </div>
                <h3 className="text-lg font-semibold text-charcoal-700 mb-2">
                  Finding matching hubs...
                </h3>
                <p className="text-charcoal-500 mb-4">
                  We're searching for existing hubs that match your places
                </p>
                
                {/* Progress bar */}
                <div className="w-full bg-linen-200 rounded-full h-2 mb-4">
                  <div 
                    className="bg-sage-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${matchingProgress}%` }}
                  />
                </div>
                <span className="text-sm text-charcoal-500">{matchingProgress}% complete</span>
              </div>

              {/* Results */}
              {!isMatching && (
                <div className="space-y-4">
                  <h4 className="font-medium text-charcoal-700">Matching Results</h4>
                  <div className="space-y-3">
                    {importedPlaces.map((place, index) => (
                      <div key={index} className="bg-linen-50 rounded-xl p-4 border border-linen-200">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <h5 className="font-medium text-charcoal-700">{place.name}</h5>
                            <p className="text-sm text-charcoal-500">{place.address}</p>
                          </div>
                          {place.matchedHub ? (
                            <div className="flex items-center gap-2">
                              <CheckIcon className="w-4 h-4 text-sage-600" />
                              <span className="text-xs text-sage-600">Matched</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <XMarkIconSolid className="w-4 h-4 text-charcoal-400" />
                              <span className="text-xs text-charcoal-400">No match</span>
                            </div>
                          )}
                        </div>
                        
                        {place.matchedHub && (
                          <div className="bg-sage-50 rounded-lg p-3 border border-sage-200">
                            <p className="text-sm text-sage-700">
                              <strong>Matched to:</strong> {place.matchedHub.name}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  
                  <button
                    onClick={handleImport}
                    className="w-full py-3 bg-sage-500 text-white rounded-xl font-semibold hover:bg-sage-600 transition-colors"
                  >
                    Import List
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

export default GoogleMapsImportModal 