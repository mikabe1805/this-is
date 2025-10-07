import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { SuggestedHubCard } from './SuggestedHubCard';
import { useEffect, useRef } from 'react';

interface SuggestedHub {
  id: string;
  name: string;
  address: string;
  photoUrl?: string;
  reason?: string;
  exists: boolean;
  placeId?: string;
}

interface SuggestedHubsRailProps {
  suggestions: SuggestedHub[];
  onRefresh: () => void;
  onOpen: (hub: SuggestedHub) => void;
  onCreate: (hub: SuggestedHub) => void;
  onNotInterested: (hubId: string) => void;
  isLoading?: boolean;
}

export function SuggestedHubsRail({
  suggestions,
  onRefresh,
  onOpen,
  onCreate,
  onNotInterested,
  isLoading = false
}: SuggestedHubsRailProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

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

  if (suggestions.length === 0 && !isLoading) {
    return null;
  }

  return (
    <section className="px-3 pt-2">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-semibold text-bark-900">Suggested Hubs</h3>
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="flex items-center gap-1 px-3 py-1.5 bg-bark-100 text-bark-700 rounded-full text-sm font-medium hover:bg-bark-200 transition-colors disabled:opacity-50"
          aria-label="Refresh suggestions"
        >
          <ArrowPathIcon className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
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
            <div
              key={`skeleton-${i}`}
              className="w-[300px] flex-shrink-0 snap-start"
            >
              <div className="glass p-3 rounded-xl animate-pulse">
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
          suggestions.map((hub) => (
            <SuggestedHubCard
              key={hub.id}
              id={hub.id}
              name={hub.name}
              address={hub.address}
              photoUrl={hub.photoUrl}
              reason={hub.reason}
              exists={hub.exists}
              onOpen={() => onOpen(hub)}
              onCreate={() => onCreate(hub)}
              onNotInterested={() => onNotInterested(hub.id)}
            />
          ))
        )}
      </div>
    </section>
  );
}
