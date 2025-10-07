import React, { useState, useEffect, useRef } from 'react';
import { StackCard } from './StackCard';

interface ExploreItem {
  id: string;
  type: 'place' | 'list' | 'user';
  title: string;
  description: string;
  image: string;
  location?: string;
  likes?: number;
  isLiked?: boolean;
  item: any;
}

interface StackDeckProps {
  items: ExploreItem[];
  onItemClick: (item: ExploreItem) => void;
  onLike: (item: ExploreItem) => void;
  onSave: (item: ExploreItem) => void;
  onShare: (item: ExploreItem) => void;
  onAddPost: (item: ExploreItem) => void;
  onQuickSave: (item: ExploreItem) => void;
}

export function StackDeck({
  items,
  onItemClick,
  onLike,
  onSave,
  onShare,
  onAddPost,
  onQuickSave
}: StackDeckProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [showHint, setShowHint] = useState(() => {
    // Show hint only if user hasn't seen it before
    return !localStorage.getItem('explore_deck_hint_seen');
  });
  const deckRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useRef(false);

  useEffect(() => {
    prefersReducedMotion.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    setDragStart({ x: touch.clientX, y: touch.clientY });
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!dragStart || !isDragging) return;
    
    const touch = e.touches[0];
    const deltaX = touch.clientX - dragStart.x;
    const deltaY = touch.clientY - dragStart.y;
    
    setDragOffset({ x: deltaX, y: deltaY });
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    
    const threshold = 50;
    const velocity = Math.abs(dragOffset.x) + Math.abs(dragOffset.y);
    
    if (Math.abs(dragOffset.x) > threshold || velocity > 100) {
      // Hide hint after first interaction
      if (showHint) {
        setShowHint(false);
        localStorage.setItem('explore_deck_hint_seen', 'true');
      }
      
      if (dragOffset.x > 0) {
        // Swipe right - go to previous
        setCurrentIndex(prev => Math.max(0, prev - 1));
      } else {
        // Swipe left - go to next
        setCurrentIndex(prev => Math.min(items.length - 1, prev + 1));
      }
    }
    
    if (Math.abs(dragOffset.y) > threshold && dragOffset.y < 0) {
      // Swipe up - quick save
      onQuickSave(items[currentIndex]);
      if (showHint) {
        setShowHint(false);
        localStorage.setItem('explore_deck_hint_seen', 'true');
      }
    }
    
    setDragStart(null);
    setDragOffset({ x: 0, y: 0 });
    setIsDragging(false);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setDragStart({ x: e.clientX, y: e.clientY });
    setIsDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragStart || !isDragging) return;
    
    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;
    
    setDragOffset({ x: deltaX, y: deltaY });
  };

  const handleMouseUp = () => {
    if (!isDragging) return;
    
    const threshold = 50;
    const velocity = Math.abs(dragOffset.x) + Math.abs(dragOffset.y);
    
    if (Math.abs(dragOffset.x) > threshold || velocity > 100) {
      // Hide hint after first interaction
      if (showHint) {
        setShowHint(false);
        localStorage.setItem('explore_deck_hint_seen', 'true');
      }
      
      if (dragOffset.x > 0) {
        // Drag right - go to previous
        setCurrentIndex(prev => Math.max(0, prev - 1));
      } else {
        // Drag left - go to next
        setCurrentIndex(prev => Math.min(items.length - 1, prev + 1));
      }
    }
    
    if (Math.abs(dragOffset.y) > threshold && dragOffset.y < 0) {
      // Drag up - quick save
      onQuickSave(items[currentIndex]);
      if (showHint) {
        setShowHint(false);
        localStorage.setItem('explore_deck_hint_seen', 'true');
      }
    }
    
    setDragStart(null);
    setDragOffset({ x: 0, y: 0 });
    setIsDragging(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Hide hint on any keyboard interaction
    if (showHint) {
      setShowHint(false);
      localStorage.setItem('explore_deck_hint_seen', 'true');
    }
    
    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        setCurrentIndex(prev => Math.max(0, prev - 1));
        break;
      case 'ArrowRight':
        e.preventDefault();
        setCurrentIndex(prev => Math.min(items.length - 1, prev + 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        onQuickSave(items[currentIndex]);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        onItemClick(items[currentIndex]);
        break;
    }
  };

  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-bark-600">No items to explore</p>
      </div>
    );
  }

  const currentItem = items[currentIndex];
  const nextItem = items[currentIndex + 1];

  return (
    <div
      ref={deckRef}
      className="relative h-96 w-full max-w-sm mx-auto"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="region"
      aria-label="Explore deck"
    >
      {/* Next card (behind current) */}
      {nextItem && (
        <StackCard
          item={nextItem}
          onItemClick={onItemClick}
          onLike={onLike}
          onSave={onSave}
          onShare={onShare}
          onAddPost={onAddPost}
          style={{
            transform: 'scale(0.95) translateY(8px)',
            zIndex: 1,
            opacity: 0.7
          }}
        />
      )}
      
      {/* Current card */}
      <StackCard
        item={currentItem}
        onItemClick={onItemClick}
        onLike={onLike}
        onSave={onSave}
        onShare={onShare}
        onAddPost={onAddPost}
        style={{
          transform: isDragging 
            ? `translate(${dragOffset.x}px, ${dragOffset.y}px) rotate(${dragOffset.x * 0.1}deg)`
            : 'translate(0, 0) rotate(0deg)',
          zIndex: 2,
          transition: isDragging ? 'none' : 'transform 0.3s ease-out'
        }}
      />
      
      {/* First-time user hint */}
      {showHint && currentIndex === 0 && (
        <div className="absolute top-6 left-1/2 transform -translate-x-1/2 z-30 pointer-events-none">
          <div className="bg-bark-900/60 backdrop-blur-sm text-white text-sm px-4 py-2 rounded-full flex items-center gap-2 animate-pulse">
            <span>Swipe to browse</span>
            <span className="text-lg">→</span>
          </div>
        </div>
      )}
      
      {/* Instructions */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-center">
        <div className="bg-black/60 backdrop-blur-sm text-white text-xs px-3 py-2 rounded-full">
          <div className="flex items-center gap-4">
            <span>← Previous</span>
            <span>↑ Save</span>
            <span>→ Next</span>
          </div>
        </div>
      </div>
      
      {/* Progress indicator */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2">
        <div className="bg-black/60 backdrop-blur-sm text-white text-xs px-3 py-1 rounded-full">
          {currentIndex + 1} of {items.length}
        </div>
      </div>
    </div>
  );
}
