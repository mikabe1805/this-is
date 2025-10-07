/**
 * SafeImage - Intercepts Google Places photo URLs when kill switch is active
 * Prevents direct browser requests to Google Photos API
 */

import { PLACES_PHOTOS_ENABLED, PLACEHOLDER_IMAGE } from '../../services/google/places';

interface SafeImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src?: string;
  alt: string;
}

/**
 * Utility to get safe image URL
 * Strips Google Places photo URLs when kill switch is active
 */
export function getSafeImageUrl(src?: string): string {
  // Always block Google Places photo URLs when photos disabled
  if (!PLACES_PHOTOS_ENABLED && src?.includes('maps.googleapis.com/maps/api/place/photo')) {
    return PLACEHOLDER_IMAGE;
  }
  
  // Also block if src is a google places photo reference (not full URL)
  if (!PLACES_PHOTOS_ENABLED && src?.includes('photo_reference=')) {
    return PLACEHOLDER_IMAGE;
  }
  
  return src || PLACEHOLDER_IMAGE;
}

export default function SafeImage({ src, alt, onError, ...props }: SafeImageProps) {
  const safeSrc = getSafeImageUrl(src);
  
  // Fallback onError handler
  const handleError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    (e.currentTarget as HTMLImageElement).src = PLACEHOLDER_IMAGE;
    onError?.(e);
  };

  return <img src={safeSrc} alt={alt} onError={handleError} {...props} />;
}

