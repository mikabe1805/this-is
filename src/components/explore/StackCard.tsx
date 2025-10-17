import React from 'react';
import { HeartIcon, BookmarkIcon, ShareIcon, PlusIcon } from '@heroicons/react/24/outline';
import { HeartIcon as HeartIconSolid } from '@heroicons/react/24/solid';
import CardShell from '../ui/CardShell';
import PlaceVisual from '../ui/PlaceVisual';

interface StackCardProps {
  item: {
    id: string;
    type: 'place' | 'list' | 'user';
    title: string;
    description: string;
    image?: string; // Legacy, fallback only
    location?: string;
    likes?: number;
    isLiked?: boolean;
    distanceKm?: number;
    // New Places API (New) fields
    types?: string[];
    photoResourceName?: string;
    userPhotos?: string[];
  };
  onItemClick: (item: any) => void;
  onLike: (item: any) => void;
  onSave: (item: any) => void;
  onShare: (item: any) => void;
  onAddPost: (item: any) => void;
  style?: React.CSSProperties;
  className?: string;
}

export function StackCard({
  item,
  onItemClick,
  onLike,
  onSave,
  onShare,
  onAddPost,
  style,
  className = ""
}: StackCardProps) {
  return (
    <div
      className={`absolute inset-0 ${className}`}
      style={style}
    >
      <CardShell
        variant="glass"
        onClick={() => onItemClick(item)}
        className="h-full w-full cursor-pointer hover:shadow-soft transition-all duration-200"
      >
        <div className="flex flex-col h-full">
          {/* Visual - Poster â†’ User Photos â†’ Budgeted Google Thumb */}
          <div className="relative h-48 w-full overflow-hidden rounded-t-xl">
            {item.type === 'place' ? (
              <PlaceVisual
                types={item.types}
                photoResourceName={item.photoResourceName}
                userPhotos={item.userPhotos}
                alt={item.title}
                className="h-full w-full"
              />
            ) : (
              <img
                src={item.image || '/assets/leaf.png'}
                alt={item.title}
                className="h-full w-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = '/assets/leaf.png';
                }}
              />
            )}
            <div className="scrim absolute inset-0" style={{background: 'linear-gradient(to bottom, rgba(0,0,0,0.35), rgba(0,0,0,0.08))'}} />
            
            {/* Badge */}
            {item.type === 'place' && Math.random() > 0.7 && (
              <div className="absolute top-3 left-3 bg-white/80 text-bark-900 text-xs px-2 py-1 rounded-full font-medium backdrop-blur-sm border border-white/40">
                Verified
              </div>
            )}
            
            {/* Bookmark */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSave(item);
              }}
              className="absolute top-3 right-3 p-2 icon-btn"
              aria-label="Save"
            >
              <BookmarkIcon className="w-4 h-4 text-white" />
            </button>
          </div>
          {/* Distance chip */}
          {typeof item.distanceKm === 'number' && (
            <div className="absolute top-3 left-3 bg-black/60 text-white text-xs px-2 py-1 rounded-full backdrop-blur-sm border border-white/30">
              {((item.distanceKm || 0) * 0.621371).toFixed(1)} mi
            </div>
          )}
          
          {/* Content */}
          <div className="flex-1 p-4 flex flex-col">
            <h3 className="font-semibold text-title line-clamp-2 mb-2">
              {item.title}
            </h3>
            <p className="text-body text-sm line-clamp-2 mb-3 flex-1">
              {item.description}
            </p>
            {(item.location || typeof item.distanceKm === 'number') && (
              <p className="text-meta text-xs mb-3">
                {typeof item.distanceKm === 'number' && (
                  <>
                    {((item.distanceKm || 0) * 0.621371).toFixed(1)} mi{item.location ? ' • ' : ''}
                  </>
                )}
                {item.location}
              </p>
            )}
            
            {/* Action buttons */}
            <div className="flex items-center gap-2 mt-auto">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onLike(item);
                }}
                className="pill pill--quiet flex items-center gap-1"
                aria-label={item.isLiked ? 'Unlike' : 'Like'}
              >
                {item.isLiked ? (
                  <HeartIconSolid className="w-4 h-4 text-red-500" />
                ) : (
                  <HeartIcon className="w-4 h-4" />
                )}
                <span className="text-xs font-medium">{item.likes || 0}</span>
              </button>
              
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onShare(item);
                }}
                className="pill pill--quiet"
                aria-label="Share"
              >
                <ShareIcon className="w-4 h-4" />
              </button>
              
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onAddPost(item);
                }}
                className="pill pill--quiet"
                aria-label="Add Post"
              >
                <PlusIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </CardShell>
    </div>
  );
}

