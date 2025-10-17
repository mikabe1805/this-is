import { GlassPanel } from '../ui/primitives/Glass';
import Button from '../ui/Button';
import HubImage from '../HubImage';
import { humanizeTag } from '../../utils/posterMapping';
import { useState, useEffect, useRef } from 'react';

interface SuggestedHubCardProps {
  id: string;
  photoUrl?: string;
  reason?: string;
  exists: boolean;
  onOpen: () => void;
  onCreate: () => void;
  onNotInterested: () => void;
  onViewDetails: () => void;
  place: { // Pass entire place object
    id: string;
    name: string;
    address: string;
    primaryType?: string;
    types?: string[];
    photos?: { name: string }[];
  };
  isFirstCard?: boolean; // For selective sunlight
}

export function SuggestedHubCard({
  id,
  photoUrl,
  reason,
  exists,
  onOpen,
  onCreate,
  onNotInterested,
  onViewDetails,
  place,
  isFirstCard = false
}: SuggestedHubCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const { name, address } = place;
  const displayReason = reason || place.reason;
  const createBtnRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (createBtnRef.current) {
      console.log('[UI] button:create-hub', createBtnRef.current.className)
    }
  }, [])

  // Calculate distance (placeholder - will need user location)
  // For now, show a simple distance indicator
  const distance = "0.5 mi away"; // TODO: Calculate actual distance

  return (
    <GlassPanel
      className="min-w-[290px] max-w-[290px] snap-start p-4"
      withSunlight={isFirstCard}
    >
      <button
        onClick={onViewDetails}
        className="grid grid-cols-[88px_1fr] gap-3 items-start text-left w-full mb-3"
      >
        <figure className="relative rounded-xl overflow-hidden aspect-[4/3] shadow-sm">
          <HubImage
            photos={place.photos}
            primaryType={place.primaryType}
            className="w-full h-full"
            aspect="aspect-[4/3]"
            load={false}
          />
          <div className="pointer-events-none absolute inset-0 mix-blend-multiply" style={{ background: 'linear-gradient(0deg, rgba(220,213,202,0.10), rgba(220,213,202,0.10))' }} />
        </figure>
        <div className="min-w-0">
          {/* Category tag - shows place type */}
          {place.primaryType && (
            <div className="mb-1">
              <span className="inline-flex items-center text-[11px] badge-moss">
                {humanizeTag(place.primaryType)}
              </span>
            </div>
          )}
          <div className="text-[15px] font-semibold line-clamp-1 mb-0.5" style={{color: 'rgba(61,54,48,0.92)'}}>
            {name}
          </div>
          <div className="text-[12px] flex items-center gap-1 mb-1" style={{color: 'rgba(74,66,60,0.85)'}}>
            <svg className="w-3 h-3 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>{distance}</span>
          </div>
          {displayReason && (
            <div className="text-[11px]" style={{color: 'rgba(74,66,60,0.75)'}}>
              <span className="accent-moss font-medium">#{humanizeTag(displayReason)}</span>
            </div>
          )}
        </div>
      </button>

      <div className="flex gap-2">
        {exists ? (
          <Button variant="primary" size="sm" className="flex-1" onClick={onOpen}>Open</Button>
        ) : (
          <Button ref={createBtnRef as any} variant="primary" size="sm" className="flex-1" onClick={onCreate}>Create</Button>
        )}
        <Button variant="ghost" size="sm" className="px-3" onClick={onNotInterested}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </Button>
      </div>

      {showMenu && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setShowMenu(false)}
          />
          <div className="absolute top-12 right-3 w-40 glass rounded-xl py-1 z-20">
            <button
              onClick={() => {
                setShowMenu(false);
                // TODO: Implement save
              }}
              className="w-full px-4 py-2 text-left text-sm text-bark-700 hover:bg-white/20 transition"
            >
              Save
            </button>
            <button
              onClick={() => {
                setShowMenu(false);
                // TODO: Implement share
              }}
              className="w-full px-4 py-2 text-left text-sm text-bark-700 hover:bg-white/20 transition"
            >
              Share
            </button>
            <button
              onClick={() => {
                setShowMenu(false);
                // TODO: Implement report
              }}
              className="w-full px-4 py-2 text-left text-sm text-bark-700 hover:bg-white/20 transition"
            >
              Report
            </button>
          </div>
        </>
      )}
    </GlassPanel>
  );
}
