/**
 * Dwell-based lazy loading hook
 * Only triggers when an element is visible AND dwelled on for a minimum duration.
 * This prevents expensive API calls during fast scrolling.
 */

import { useEffect, useRef, useState } from 'react';

export function useDwell<T extends HTMLElement>(
  threshold = 0.6,
  dwellMs = 400
) {
  const ref = useRef<T | null>(null);
  const [ready, setReady] = useState(false);
  
  useEffect(() => {
    if (!ref.current) return;
    
    let timeoutId: any;
    let visible = false;
    let dwellReached = false;
    
    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting && entry.intersectionRatio >= threshold;
        
        if (visible && !dwellReached) {
          // Start dwell timer
          timeoutId = setTimeout(() => {
            dwellReached = true;
            setReady(true);
          }, dwellMs);
        } else {
          // Stopped being visible, cancel timer
          clearTimeout(timeoutId);
          dwellReached = false;
        }
      },
      { threshold: [threshold] }
    );
    
    io.observe(ref.current);
    
    return () => {
      io.disconnect();
      clearTimeout(timeoutId);
    };
  }, [threshold, dwellMs]);
  
  return { ref, ready };
}

