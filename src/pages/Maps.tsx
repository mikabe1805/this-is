import { ArrowLeftIcon, MapIcon } from '@heroicons/react/24/outline'
import { useNavigate } from 'react-router-dom'

/**
 * Placeholder for the global "all my places on one map" view. The real
 * implementation lives in a parallel feature branch — this stub exists so
 * the /maps route smoke test passes and so users who type or share a /maps
 * link land on a coherent page rather than the 404.
 */
const Maps = () => {
  const navigate = useNavigate()
  return (
    <div className="relative min-h-full bg-paper">
      <header className="sticky top-0 z-30 bg-paper/90 backdrop-blur-md">
        <div className="px-5 pt-5 pb-3 flex items-center gap-3">
          <button
            onClick={() => { if (window.history.length > 1) navigate(-1); else navigate('/') }}
            aria-label="Back"
            className="h-10 w-10 rounded-full hover:bg-paper-deep flex items-center justify-center"
          >
            <ArrowLeftIcon className="w-5 h-5 text-ink" />
          </button>
          <h1 className="font-display text-[22px] leading-none text-ink">Map</h1>
        </div>
        <div className="border-b border-edge mx-5" />
      </header>

      <div className="relative z-10 px-5 py-12 max-w-2xl mx-auto text-center">
        <div className="border border-edge rounded-[14px] px-5 py-12 bg-card">
          <MapIcon className="w-10 h-10 text-ink-mute mx-auto mb-3" />
          <p className="font-display text-[26px] text-ink leading-tight">All your places, on one map.</p>
          <p className="text-[13px] text-ink-soft mt-2 max-w-sm mx-auto">
            Coming soon — every place you've saved, plotted on a single map so you can spot the next walk, brunch, or detour.
          </p>
          <button
            onClick={() => navigate('/profile')}
            className="btn-cta h-11 px-5 mt-6 label-eyebrow"
          >
            See my saved places
          </button>
        </div>
      </div>
    </div>
  )
}

export default Maps
