/**
 * Glass callout card for map markers
 * Uses PlaceVisual for cost-optimized imagery (posters → user photos → budgeted Google thumb)
 */

import { MapPinIcon, BookmarkIcon, PlusIcon } from '@heroicons/react/24/outline';
import { CardShell } from './CardShell';
import PlaceVisual from '../ui/PlaceVisual';

export interface MapCalloutCardProps {
  place: {
    id: string;
    name: string;
    address: string;
    distance?: string;
    mainImage?: string; // Legacy, fallback only
    tags?: string[];
    // New Places API (New) fields
    types?: string[];
    photoResourceName?: string;
    userPhotos?: string[];
  };
  onSave?: () => void;
  onAddPost?: () => void;
  onClose?: () => void;
  /** If true, positions absolutely within map container. Default: fixed to viewport */
  anchoredToMap?: boolean;
}

export function MapCalloutCard({ place, onSave, onAddPost, onClose, anchoredToMap = false }: MapCalloutCardProps) {
  const positionClass = anchoredToMap 
    ? "absolute left-3 right-3 bottom-3 z-10" 
    : "fixed bottom-20 left-4 right-4 z-30 max-w-screen-sm mx-auto";
  
  return (
    <div className={positionClass}>
      <CardShell variant="glass" className="overflow-hidden">
        <div className="flex gap-3">
          {/* Thumbnail - PlaceVisual for cost optimization */}
          <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0">
            <PlaceVisual
              types={place.types}
              photoResourceName={place.photoResourceName}
              userPhotos={place.userPhotos}
              alt={place.name}
              size={56}
              className="w-full h-full"
            />
          </div>
          
          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-bark-900 text-sm mb-1 truncate">{place.name}</h3>
            <div className="flex items-center text-bark-600 text-xs mb-2">
              <MapPinIcon className="w-3 h-3 mr-1 flex-shrink-0" />
              <span className="truncate">{place.address}</span>
            </div>
            {place.distance && (
              <div className="text-moss-600 text-xs font-medium">{place.distance}</div>
            )}
            
            {/* Tags */}
            {place.tags && place.tags.length > 0 && (
              <div className="flex gap-1 mt-2 flex-wrap">
                {place.tags.slice(0, 2).map(tag => (
                  <span key={tag} className="px-2 py-0.5 bg-moss-100/50 text-moss-700 text-xs rounded-full">
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>
          
          {/* Actions - Use pill buttons for consistency */}
          <div className="flex gap-2 ml-auto">
            {onSave && (
              <button
                onClick={onSave}
                className="pill pill--quiet min-h-[44px] min-w-[44px]"
                aria-label="Save place"
              >
                <BookmarkIcon className="w-4 h-4" />
              </button>
            )}
            {onAddPost && (
              <button
                onClick={onAddPost}
                className="pill pill--primary min-h-[44px] min-w-[44px]"
                aria-label="Add post"
              >
                <PlusIcon className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </CardShell>
    </div>
  );
}

