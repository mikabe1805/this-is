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
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        background: 'rgba(61, 54, 48, 0.40)',
        backdropFilter: 'blur(8px)'
      }}
      onClick={onClose}
    >
      <div 
        className="glass rounded-xl2 w-full max-w-md p-6 relative"
        onClick={e => e.stopPropagation()}
      >
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/20 backdrop-blur-sm rounded-xl2">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white/60" />
          </div>
        )}
        
        {place && !isLoading && (
          <>
            <div className="w-full aspect-[4/3] rounded-xl overflow-hidden mb-4">
              <HubImage place={place} aspect="aspect-[4/3]" loadStrategy="load" />
            </div>
            <h2 className="text-title mb-2">{place.name}</h2>
            
            {/* Distance indicator (placeholder) */}
            <div className="text-meta flex items-center gap-1.5 mb-4">
              <svg className="w-3.5 h-3.5 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              0.5 mi away
            </div>
            
            <div className="flex gap-3">
              <button
                className="pill pill--primary flex-1"
                onClick={() => onCreateHub(place)}
              >
                Create Hub
              </button>
              <button
                className="pill pill--quiet flex-1"
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
