import React, { useEffect, useState } from 'react';
import type { PlaceDetail } from '../../lib/placesNew';
import { getDetails } from '../../lib/placesNew';
import HubImage from '../HubImage';

interface SuggestedHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  placeId: string | null;
  onCreateHub: (placeData: PlaceDetail) => void;
}

export default function SuggestedHubModal({ isOpen, onClose, placeId, onCreateHub }: SuggestedHubModalProps) {
  const [place, setPlace] = useState<PlaceDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && placeId) {
      setIsLoading(true);
      setPlace(null);
      getDetails(placeId)
        .then(details => {
          setPlace(details);
        })
        .catch(console.error)
        .finally(() => setIsLoading(false));
    }
  }, [isOpen, placeId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-bark-900/50 backdrop-blur-sm z-50 flex items-center justify-center" onClick={onClose}>
      <div className="glass sun-edge rounded-xl2 w-[90vw] max-w-md p-6 relative" onClick={e => e.stopPropagation()}>
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-moss-500" />
          </div>
        )}
        
        {place && (
          <>
            <div className="w-full aspect-[4/3] rounded-xl overflow-hidden mb-4">
              <HubImage place={place} aspect="aspect-[4/3]" loadStrategy="load" />
            </div>
            <h2 className="text-xl font-bold text-bark-900">{place.name}</h2>
            <p className="text-bark-700 mt-1">{place.address}</p>
            
            <div className="flex gap-4 mt-6">
              <button
                className="pill pill--primary flex-1"
                onClick={() => onCreateHub(place)}
              >
                Create Hub
              </button>
              <button
                className="pill pill--quiet"
                onClick={onClose}
              >
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
