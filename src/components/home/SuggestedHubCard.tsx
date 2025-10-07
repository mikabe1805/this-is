import { EllipsisHorizontalIcon } from '@heroicons/react/24/outline';
import { CardShell } from '../primitives/CardShell';
import { useState } from 'react';

interface SuggestedHubCardProps {
  id: string;
  name: string;
  address: string;
  photoUrl?: string;
  reason?: string;
  exists: boolean;
  onOpen: () => void;
  onCreate: () => void;
  onNotInterested: () => void;
}

export function SuggestedHubCard({
  id,
  name,
  address,
  photoUrl,
  reason,
  exists,
  onOpen,
  onCreate,
  onNotInterested
}: SuggestedHubCardProps) {
  const [imageError, setImageError] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  // Extract short address (city, state or first part)
  const shortAddress = address.split(',').slice(0, 2).join(',').trim();

  return (
    <CardShell variant="glass" className="p-3 w-[300px] flex-shrink-0 snap-start">
      <div className="flex gap-3">
        <img
          src={imageError ? '/assets/leaf.png' : (photoUrl || '/assets/leaf.png')}
          alt={name}
          className="w-24 h-24 rounded-xl object-cover bg-bark-50 flex-shrink-0"
          onError={() => setImageError(true)}
        />
        <div className="min-w-0 flex-1">
          <h4 className="text-bark-900 font-semibold leading-tight truncate mb-1">
            {name}
          </h4>
          <p className="text-bark-600 text-sm truncate">
            {shortAddress}
          </p>
          {reason && (
            <span className="text-xs text-bark-600 mt-1 block">
              Because you like <b>{reason}</b>
            </span>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        {exists ? (
          <button
            onClick={onOpen}
            className="px-4 py-2 bg-moss-500 text-white rounded-full text-sm font-medium hover:bg-moss-600 transition-colors"
            aria-label="Open hub"
          >
            Open
          </button>
        ) : (
          <button
            onClick={onCreate}
            className="px-4 py-2 bg-moss-500 text-white rounded-full text-sm font-medium hover:bg-moss-600 transition-colors"
            aria-label="Create hub"
          >
            Create Hub
          </button>
        )}
        <button
          onClick={onNotInterested}
          className="px-3 py-2 bg-bark-100 text-bark-700 rounded-full text-sm font-medium hover:bg-bark-200 transition-colors"
          aria-label="Not interested"
        >
          Not interested
        </button>
        <div className="relative ml-auto">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-2 hover:bg-bark-100 rounded-full transition-colors"
            aria-label="More actions"
          >
            <EllipsisHorizontalIcon className="w-5 h-5 text-bark-600" />
          </button>
          {showMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowMenu(false)}
              />
              <div className="absolute right-0 top-full mt-1 w-40 bg-white rounded-xl shadow-soft border border-bark-200 py-1 z-20">
                <button
                  onClick={() => {
                    setShowMenu(false);
                    // TODO: Implement save
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-bark-700 hover:bg-bark-50"
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setShowMenu(false);
                    // TODO: Implement share
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-bark-700 hover:bg-bark-50"
                >
                  Share
                </button>
                <button
                  onClick={() => {
                    setShowMenu(false);
                    // TODO: Implement report
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-bark-700 hover:bg-bark-50"
                >
                  Report
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </CardShell>
  );
}
