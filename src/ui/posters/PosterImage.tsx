/**
 * PosterImage component
 * Renders a category-specific poster as a placeholder when no user photos exist.
 * This is completely free - no API calls.
 */

import React from 'react';
import { PosterCategory, categoryColor } from './index';

interface PosterImageProps {
  category: PosterCategory;
  className?: string;
}

export default function PosterImage({ category, className = '' }: PosterImageProps) {
  const color = categoryColor(category);
  const iconSize = 80;
  
  return (
    <div
      className={`relative w-full h-full flex items-center justify-center overflow-hidden ${className}`}
      style={{
        background: `linear-gradient(135deg, ${color}22 0%, ${color}11 100%)`,
      }}
    >
      {/* Subtle texture overlay */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />
      
      {/* Category icon */}
      <CategoryIcon category={category} size={iconSize} color={color} />
      
      {/* Label */}
      <div
        className="absolute bottom-3 left-3 text-xs font-medium px-2 py-1 rounded-full"
        style={{
          backgroundColor: `${color}33`,
          color: color,
        }}
      >
        {category}
      </div>
    </div>
  );
}

function CategoryIcon({ category, size, color }: { category: PosterCategory; size: number; color: string }) {
  const iconProps = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: color,
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    opacity: 0.7,
  };
  
  switch (category) {
    case 'coffee':
      return (
        <svg {...iconProps}>
          <path d="M17 8h1a4 4 0 1 1 0 8h-1" />
          <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" />
          <line x1="6" x2="6" y1="2" y2="4" />
          <line x1="10" x2="10" y1="2" y2="4" />
          <line x1="14" x2="14" y1="2" y2="4" />
        </svg>
      );
    
    case 'brunch':
    case 'restaurant':
      return (
        <svg {...iconProps}>
          <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
          <path d="M7 2v20" />
          <path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
        </svg>
      );
    
    case 'dessert':
      return (
        <svg {...iconProps}>
          <path d="m7 11 4.08 10.35a1 1 0 0 0 1.84 0L17 11" />
          <path d="M17 7A5 5 0 0 0 7 7" />
          <path d="M17 7a2 2 0 0 1 0 4H7a2 2 0 0 1 0-4" />
        </svg>
      );
    
    case 'bar':
    case 'nightlife':
      return (
        <svg {...iconProps}>
          <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
          <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
        </svg>
      );
    
    case 'garden':
      return (
        <svg {...iconProps}>
          <path d="M12 22v-8" />
          <path d="M12 8c0-3.3 2.7-6 6-6s6 2.7 6 6-2.7 6-6 6-6-2.7-6-6z" />
          <path d="M6 14c0-3.3-2.7-6-6-6s-6 2.7-6 6 2.7 6 6 6 6-2.7 6-6z" transform="translate(6)" />
        </svg>
      );
    
    case 'park':
      return (
        <svg {...iconProps}>
          <path d="M12 22v-8" />
          <path d="m17 8-5-5L7 8h10Z" />
          <path d="M7 13 2 8h10l-5 5Z" />
          <path d="m17 13 5-5H12l5 5Z" />
        </svg>
      );
    
    case 'museum':
      return (
        <svg {...iconProps}>
          <path d="m2 12 10-9 10 9" />
          <rect x="4" y="12" width="16" height="10" />
          <path d="M9 22V12h6v10" />
        </svg>
      );
    
    case 'book':
      return (
        <svg {...iconProps}>
          <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
        </svg>
      );
    
    case 'hiking':
      return (
        <svg {...iconProps}>
          <path d="m18 16 4-4-4-4" />
          <path d="m6 8-4 4 4 4" />
          <path d="m14.5 4-5 16" />
        </svg>
      );
    
    case 'music':
      return (
        <svg {...iconProps}>
          <path d="M9 18V5l12-2v13" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="18" cy="16" r="3" />
        </svg>
      );
    
    case 'cinema':
      return (
        <svg {...iconProps}>
          <rect width="18" height="18" x="3" y="3" rx="2" />
          <path d="M7 3v18" />
          <path d="M3 7.5h4" />
          <path d="M3 12h18" />
          <path d="M3 16.5h4" />
          <path d="M17 3v18" />
          <path d="M17 7.5h4" />
          <path d="M17 16.5h4" />
        </svg>
      );
    
    default:
      return (
        <svg {...iconProps}>
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
      );
  }
}

