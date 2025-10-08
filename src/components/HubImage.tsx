import React, { useMemo, useState } from "react";
import { categoryFromTypes, type PosterCategory } from '../utils/posterMapping';
import type { Place } from "../types";

type PlaceLite = {
  photos?: { name: string }[];
  primaryType?: string | null;
  types?: string[];
};

// Sophisticated glass-style patterns for each category
const CATEGORY_STYLES: Record<PosterCategory, { bg: string; pattern: string; label: string }> = {
  coffee: {
    bg: 'linear-gradient(135deg, rgba(160, 130, 109, 0.85) 0%, rgba(139, 115, 85, 0.95) 100%)',
    pattern: 'radial-gradient(circle at 30% 30%, rgba(255, 235, 150, 0.2) 0%, transparent 50%)',
    label: 'Café'
  },
  restaurant: {
    bg: 'linear-gradient(135deg, rgba(212, 165, 116, 0.85) 0%, rgba(201, 149, 110, 0.95) 100%)',
    pattern: 'radial-gradient(circle at 30% 30%, rgba(255, 235, 150, 0.2) 0%, transparent 50%)',
    label: 'Restaurant'
  },
  park: {
    bg: 'linear-gradient(135deg, rgba(111, 138, 107, 0.85) 0%, rgba(94, 118, 92, 0.95) 100%)',
    pattern: 'radial-gradient(circle at 30% 30%, rgba(191, 202, 181, 0.3) 0%, transparent 50%)',
    label: 'Park'
  },
  museum: {
    bg: 'linear-gradient(135deg, rgba(139, 127, 115, 0.85) 0%, rgba(122, 111, 100, 0.95) 100%)',
    pattern: 'radial-gradient(circle at 30% 30%, rgba(240, 230, 206, 0.2) 0%, transparent 50%)',
    label: 'Culture'
  },
  library: {
    bg: 'linear-gradient(135deg, rgba(155, 139, 126, 0.85) 0%, rgba(136, 122, 109, 0.95) 100%)',
    pattern: 'radial-gradient(circle at 30% 30%, rgba(240, 230, 206, 0.2) 0%, transparent 50%)',
    label: 'Library'
  },
  default: {
    bg: 'linear-gradient(135deg, rgba(184, 175, 162, 0.85) 0%, rgba(163, 154, 141, 0.95) 100%)',
    pattern: 'radial-gradient(circle at 30% 30%, rgba(255, 235, 150, 0.15) 0%, transparent 50%)',
    label: 'Place'
  }
};

interface HubImageProps {
  place: Partial<Place> & { photos?: { name: string }[] };
  className?: string;
  maxWidthPx?: number;
  aspect?: string;
  loadStrategy?: 'fallback' | 'load';
}

export default function HubImage({
  place,
  className = "rounded-xl2 shadow-soft",
  maxWidthPx = 480,
  aspect = "aspect-[4/3]",
  loadStrategy = 'fallback',
}: HubImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const url = useMemo(() => {
    if (loadStrategy === 'fallback') {
      console.log('[HubImage] 💰 Using fallback image (zero cost) for suggested hub');
      return null;
    }

    const name = place?.photos?.[0]?.name;
    const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!name || !key) return null;
    
    return `https://places.googleapis.com/v1/${name}/media?key=${key}&maxWidthPx=${maxWidthPx}`;
  }, [place?.photos, maxWidthPx, loadStrategy]);

  // COST DISCIPLINE: Never load photos for suggested hubs - only use category-based visuals
  const category = useMemo(() => {
    return categoryFromTypes(place?.types || [place?.primaryType].filter(Boolean) as string[]);
  }, [place?.types, place?.primaryType]);

  const style = CATEGORY_STYLES[category];

  if (url && !failed) {
    return (
      <div className={`relative overflow-hidden ${aspect} ${className}`}>
        {/* Real image with skeleton loader */}
      </div>
    );
  }

  // Fallback Poster
  return (
    <div
      className={`relative overflow-hidden ${aspect} ${className} flex items-center justify-center`}
      style={{ background: style.bg }}
    >
      {/* Glass pattern overlay with sunshine */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: style.pattern,
          mixBlendMode: 'overlay'
        }}
      />

      {/* Clean category label - no emojis */}
      <div className="relative z-10 text-center text-white">
        <div className="text-sm font-semibold uppercase tracking-wide drop-shadow-md">
          {style.label}
        </div>
      </div>
    </div>
  );
}
