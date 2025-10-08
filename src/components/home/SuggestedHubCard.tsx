import { GlassPanel, PrimaryBtn, GhostBtn } from '../ui/primitives/Glass';
import HubImage from '../HubImage';
import { humanizeTag } from '../../utils/posterMapping';
import { useState } from 'react';

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
  }
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
  place
}: SuggestedHubCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const { name, address } = place;
  const displayReason = reason || place.reason;

  // Extract short address (city, state or first part)
  const shortAddress = address.split(',').slice(0, 2).join(',').trim();

  return (
    <GlassPanel className="min-w-[290px] max-w-[290px] snap-start p-4 md:p-5">
      <button 
        onClick={onViewDetails}
        className="grid grid-cols-[96px_1fr] gap-4 items-start text-left w-full"
      >
        <HubImage 
          place={place}
          className="rounded-xl shadow-soft" 
          aspect="aspect-[4/3]"
          loadStrategy="fallback" // Always use fallback in the rail
        />
        <div className="min-w-0">
          {/* Category tag - shows place type */}
          {place.primaryType && (
            <div className="mb-1.5">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-moss-300/40 text-bark-900 border border-moss-300/60">
                {humanizeTag(place.primaryType)}
              </span>
            </div>
          )}
          <div className="text-title line-clamp-1">
            {name}
          </div>
          <div className="text-body line-clamp-2">
            {shortAddress}
          </div>
          {displayReason && (
            <div className="mt-1.5 text-meta">
              Because you like <span className="font-semibold text-moss-600">#{humanizeTag(displayReason)}</span>
            </div>
          )}
        </div>
      </button>

      <div className="mt-3 flex gap-2.5">
        {exists ? (
          <button onClick={onOpen} className="pill pill--primary flex-1">
            Open Hub
          </button>
        ) : (
          <button onClick={onCreate} className="pill pill--primary flex-1">
            Create Hub
          </button>
        )}
        <button onClick={onNotInterested} className="pill pill--quiet flex-1">
          Not interested
        </button>
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
