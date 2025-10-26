import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { SuggestedHubCard } from './SuggestedHubCard';
import { useEffect, useRef, useMemo } from 'react';

interface SuggestedHub {
  id: string;
  name: string;
  address: string;
  photoUrl?: string;
  reason?: string;
  exists: boolean;
  placeId?: string;
  photos?: { name: string }[];
  primaryType?: string;
  types?: string[];
  distanceKm?: number;
}

interface SuggestedHubsRailProps {
  suggestions: SuggestedHub[];
  onRefresh: () => void;
  onOpen: (hub: SuggestedHub) => void;
  onCreate: (hub: SuggestedHub) => void;
  onNotInterested: (hubId: string) => void;
  onViewDetails: (placeId: string) => void;
  isLoading?: boolean;
}

export function SuggestedHubsRail({
  suggestions,
  onRefresh,
  onOpen,
  onCreate,
  onNotInterested,
  onViewDetails,
  isLoading = false
}: SuggestedHubsRailProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // De-duplicate suggestions by id (engine provides stable keys)
  const uniqueSuggestions = useMemo(() => {
    const seen = new Set<string>();
    const unique: SuggestedHub[] = [];
    for (const s of suggestions || []) {
      if (!s?.id) continue;
      if (seen.has(s.id)) continue;
      seen.add(s.id);
      unique.push(s);
    }
    return unique;
  }, [suggestions]);

  // Reset scroll position to start when suggestions change
  useEffect(() => {
    if (scrollRef.current && suggestions.length > 0) {
      scrollRef.current.scrollTo({ left: 0, behavior: 'smooth' });
    }
  }, [suggestions.length]);

  // Lazy load images using IntersectionObserver
  useEffect(() => {
    if (!scrollRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const img = entry.target as HTMLImageElement;
            const src = img.dataset.src;
            if (src) {
              img.src = src;
              img.removeAttribute('data-src');
              observer.unobserve(img);
            }
          }
        });
      },
      { rootMargin: '50px' }
    );

    const images = scrollRef.current.querySelectorAll('img[data-src]');
    images.forEach((img) => observer.observe(img));

    return () => observer.disconnect();
  }, [suggestions]);

  if (uniqueSuggestions.length === 0 && !isLoading) {
    return null;
  }

  return (
    <section className="px-3 pt-4 pb-2 radial-warm animate-slide-up">
      {/* Soft divider */}
      <hr className="my-6 border-white/20" />

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-[18px] font-semibold" style={{color: 'rgba(61,54,48,0.92)'}}>
            Google Hubs Suggestions
          </h3>
          <p className="text-[12px] mt-0.5" style={{color: 'rgba(74,66,60,0.75)'}}>
            Discover new places near you
          </p>
        </div>
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="badge inline-flex items-center h-9 text-[13px] gap-1.5 hover:brightness-105 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
          aria-label="Refresh suggestions"
        >
          <ArrowPathIcon className={`w-4 h-4 transition-transform duration-600 ease-out ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Horizontal Carousel */}
      <div
        ref={scrollRef}
        className="overflow-x-auto snap-x snap-mandatory flex gap-3 py-2 -mx-3 px-3 no-scrollbar"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch'
        }}
      >
        {isLoading ? (
          // Loading skeletons
          Array.from({ length: 3 }).map((_, i) => (
            <div key={`skeleton-${i}`} className="w-[300px] flex-shrink-0 snap-start">
              <div className="relative glass sun-edge rounded-xl2 p-3 animate-pulse">
                <div className="flex gap-3">
                  <div className="w-24 h-24 rounded-xl bg-bark-200" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-bark-200 rounded w-3/4" />
                    <div className="h-3 bg-bark-200 rounded w-1/2" />
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <div className="h-9 bg-bark-200 rounded-full flex-1" />
                  <div className="h-9 bg-bark-200 rounded-full w-24" />
                </div>
              </div>
            </div>
          ))
        ) : (
          uniqueSuggestions.map((hub, index) => (
            <div key={hub.id} className="animate-rise" style={{ animationDelay: `${index*40}ms` }}>
            <SuggestedHubCard
              id={hub.id}
              place={{
                id: hub.id,
                name: hub.name,
                address: hub.address,
                primaryType: hub.primaryType,
                types: hub.types,
                photos: hub.photos,
              }}
              exists={hub.exists}
              onOpen={() => onOpen(hub)}
              onCreate={() => onCreate(hub)}
              onNotInterested={() => onNotInterested(hub.id)}
              onViewDetails={() => onViewDetails(hub.placeId || hub.id)}
              distanceKm={hub.distanceKm}
            />
            </div>
          ))
        )}
      </div>
    </section>
  );
}
