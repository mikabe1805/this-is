/**
 * Glass callout card for map markers
 */

import { MapPinIcon, BookmarkIcon, PlusIcon } from '@heroicons/react/24/outline';
import { CardShell } from './CardShell';

export interface MapCalloutCardProps {
  place: {
    id: string;
    name: string;
    address: string;
    distance?: string;
    mainImage?: string;
    tags?: string[];
  };
  onSave?: () => void;
  onAddPost?: () => void;
  onClose?: () => void;
}

export function MapCalloutCard({ place, onSave, onAddPost, onClose }: MapCalloutCardProps) {
  return (
    <div className="fixed bottom-20 left-4 right-4 z-30 max-w-screen-sm mx-auto">
      <CardShell variant="glass" className="overflow-hidden">
        <div className="flex gap-3">
          {/* Thumbnail */}
          {place.mainImage && (
            <img 
              src={place.mainImage} 
              alt={place.name}
              className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
            />
          )}
          
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
          
          {/* Actions */}
          <div className="flex flex-col gap-2">
            {onSave && (
              <button
                onClick={onSave}
                className="p-2 bg-bark-100 hover:bg-bark-200 rounded-lg transition-colors"
                aria-label="Save place"
              >
                <BookmarkIcon className="w-4 h-4 text-bark-700" />
              </button>
            )}
            {onAddPost && (
              <button
                onClick={onAddPost}
                className="p-2 bg-moss-100 hover:bg-moss-200 rounded-lg transition-colors"
                aria-label="Add post"
              >
                <PlusIcon className="w-4 h-4 text-moss-700" />
              </button>
            )}
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 bg-bark-100 hover:bg-bark-200 rounded-lg transition-colors"
                aria-label="Close"
              >
                <span className="text-bark-700 text-sm">×</span>
              </button>
            )}
          </div>
        </div>
      </CardShell>
    </div>
  );
}

