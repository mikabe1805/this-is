import { useState } from 'react'
import { XMarkIcon, MapIcon, CheckIcon } from '@heroicons/react/24/outline'
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

  const mockImportedPlaces: ImportedPlace[] = [
    { name: 'Blue Bottle Coffee', address: '300 Webster St, Oakland, CA 94607', googleMapsUrl: 'https://maps.google.com/...', status: 'undefined' },
    { name: 'Tartine Bakery', address: '600 Guerrero St, San Francisco, CA 94110', googleMapsUrl: 'https://maps.google.com/...', status: 'undefined' },
    { name: 'Philz Coffee', address: '1600 Shattuck Ave, Berkeley, CA 94709', googleMapsUrl: 'https://maps.google.com/...', status: 'undefined' },
    { name: 'Sightglass Coffee', address: '270 7th St, San Francisco, CA 94103', googleMapsUrl: 'https://maps.google.com/...', status: 'undefined' }
  ]

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!googleMapsUrl.trim()) return

    setIsLoading(true)
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

    for (let i = 0; i <= 100; i += 20) {
      setMatchingProgress(i)
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    const updatedPlaces = importedPlaces.map((place, index) => {
      if (index === 0) {
        return { ...place, matchedHub: { id: '1', name: 'Blue Bottle Coffee', address: '300 Webster St, Oakland, CA 94607' } }
      } else if (index === 1) {
        return { ...place, matchedHub: { id: '2', name: 'Tartine Bakery', address: '600 Guerrero St, San Francisco, CA 94110' } }
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
    const importData: ImportData = { listName, places: importedPlaces }
    if (onImport) onImport(importData)
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
    if (step === 'review') setStep('url')
    else if (step === 'matching') setStep('review')
  }

  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center sm:p-4 bg-[#1A1815]/55 backdrop-blur-sm" onClick={handleClose}>
      <div
        className="modal-paper relative w-full sm:max-w-2xl rounded-t-3xl sm:rounded-3xl border border-edge overflow-hidden max-h-[92vh] flex flex-col"
        style={{ boxShadow: '0 18px 60px rgba(46, 28, 13, 0.22)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div data-drag-handle className="sm:hidden flex justify-center py-3 shrink-0" aria-hidden>
          <span className="w-10 h-1 rounded-full bg-ink-faint" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-edge relative z-10">
          <div className="flex items-center gap-2 min-w-0">
            {step !== 'url' && (
              <button
                type="button"
                onClick={handleBack}
                aria-label="Back"
                className="h-9 w-9 rounded-full hover:bg-paper-deep flex items-center justify-center text-ink"
              >
                <XMarkIcon className="w-5 h-5 rotate-45" />
              </button>
            )}
            <div className="min-w-0">
              <p className="label-eyebrow text-ink-mute">
                {step === 'url' ? 'Import from Google Maps' :
                 step === 'review' ? 'Review places' : 'Matching hubs'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close"
            className="h-9 w-9 rounded-full hover:bg-paper-deep flex items-center justify-center text-ink"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto relative z-10">
          {step === 'url' && (
            <div className="px-5 sm:px-6 py-5 space-y-5">
              <div className="bg-card rounded-xl p-4 border border-edge">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-xl glass-honey flex items-center justify-center shrink-0">
                    <MapIcon className="w-6 h-6 text-ink" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display text-[17px] leading-tight text-ink mb-2">How to import from Google Maps</h3>
                    <ol className="text-[13px] text-ink-soft space-y-1.5 leading-relaxed">
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
                  <label htmlFor="gmaps-import-url" className="label-eyebrow text-ink-mute mb-1.5 block">
                    Google Maps List URL
                  </label>
                  <input
                    id="gmaps-import-url"
                    type="url"
                    value={googleMapsUrl}
                    onChange={(e) => setGoogleMapsUrl(e.target.value)}
                    placeholder="https://maps.google.com/..."
                    className="w-full h-11 px-4 rounded-full border border-edge bg-card text-[14px] text-ink placeholder:text-ink-mute outline-none focus:border-ink/40"
                    required
                    autoComplete="url"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!googleMapsUrl.trim() || isLoading}
                  className="btn-cta w-full h-12 font-semibold text-[15px] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Importing…' : 'Import list'}
                </button>
              </form>
            </div>
          )}

          {step === 'review' && (
            <div className="px-5 sm:px-6 py-5 space-y-5">
              <div>
                <label htmlFor="gmaps-import-list-name" className="label-eyebrow text-ink-mute mb-1.5 block">List name</label>
                <input
                  id="gmaps-import-list-name"
                  type="text"
                  value={listName}
                  onChange={(e) => setListName(e.target.value)}
                  className="w-full h-11 px-4 rounded-full border border-edge bg-card text-[14px] text-ink placeholder:text-ink-mute outline-none focus:border-ink/40"
                />
              </div>

              <div>
                <label className="label-eyebrow text-ink-mute mb-2.5 block">
                  Places · {importedPlaces.length}
                </label>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {importedPlaces.map((place, index) => (
                    <div key={index} className="bg-card rounded-xl p-3.5 border border-edge">
                      <div className="flex items-start justify-between mb-2.5 gap-2">
                        <div className="flex-1 min-w-0">
                          <h4 className="text-[14px] font-medium text-ink truncate">{place.name}</h4>
                          <p className="text-[12px] text-ink-soft truncate">{place.address}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-[10px] tracking-[0.10em] uppercase text-ink-mute mr-1">Status</span>
                        {(['undefined', 'want', 'tried', 'loved'] as const).map((status) => {
                          const active = place.status === status
                          return (
                            <button
                              key={status}
                              type="button"
                              onClick={() => handleStatusChange(index, status)}
                              aria-pressed={active}
                              className={`h-7 px-2.5 rounded-full text-[11px] font-medium border transition-colors ${
                                active
                                  ? 'bg-paper-deep border-ink text-ink'
                                  : 'bg-card border-edge text-ink-soft hover:border-ink/40'
                              }`}
                            >
                              {status === 'undefined' ? '?' : status}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleStartMatching}
                  className="btn-cta flex-1 h-12 font-semibold text-[15px]"
                >
                  Find matching hubs
                </button>
                <button
                  type="button"
                  onClick={handleImport}
                  className="btn-secondary flex-1 h-12 font-semibold text-[15px]"
                >
                  Import as-is
                </button>
              </div>
            </div>
          )}

          {step === 'matching' && (
            <div className="px-5 sm:px-6 py-5 space-y-5">
              <div className="text-center">
                <div className="w-14 h-14 rounded-2xl glass-honey flex items-center justify-center mx-auto mb-3">
                  <MapIcon className="w-7 h-7 text-ink" />
                </div>
                <h3 className="font-display text-[20px] leading-tight text-ink mb-1.5">
                  Finding matching hubs…
                </h3>
                <p className="text-[13px] text-ink-soft mb-4">
                  We're searching for existing hubs that match your places
                </p>

                <div className="w-full bg-paper-deep rounded-full h-1.5 mb-2 overflow-hidden ring-1 ring-edge">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${matchingProgress}%`, background: 'var(--accent-deep)' }}
                  />
                </div>
                <span className="font-mono text-[10px] tracking-[0.10em] uppercase text-ink-mute">{matchingProgress}% complete</span>
              </div>

              {!isMatching && (
                <div className="space-y-3">
                  <h4 className="label-eyebrow text-ink-mute">Matching results</h4>
                  <div className="space-y-2">
                    {importedPlaces.map((place, index) => (
                      <div key={index} className="bg-card rounded-xl p-3.5 border border-edge">
                        <div className="flex items-start justify-between mb-2 gap-2">
                          <div className="flex-1 min-w-0">
                            <h5 className="text-[14px] font-medium text-ink truncate">{place.name}</h5>
                            <p className="text-[12px] text-ink-soft truncate">{place.address}</p>
                          </div>
                          {place.matchedHub ? (
                            <div className="flex items-center gap-1.5 shrink-0">
                              <CheckIcon className="w-4 h-4 text-accent-deep" />
                              <span className="font-mono text-[10px] tracking-[0.10em] uppercase text-accent-deep">Matched</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 shrink-0">
                              <XMarkIcon className="w-4 h-4 text-ink-mute" />
                              <span className="font-mono text-[10px] tracking-[0.10em] uppercase text-ink-mute">No match</span>
                            </div>
                          )}
                        </div>

                        {place.matchedHub && (
                          <div className="rounded-lg p-2.5 bg-accent-soft border border-edge">
                            <p className="text-[12px] text-accent-deep">
                              <strong className="font-semibold">Matched to:</strong> {place.matchedHub.name}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={handleImport}
                    className="btn-cta w-full h-12 font-semibold text-[15px]"
                  >
                    Import list
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
