/**
 * CardShell - Standardized container for cozy glass design system
 * 
 * Usage rules:
 * - Glass: hero toolbars, Explore cards (list + deck), map callouts, 
 *   search "Hub" cards, lightweight overlays
 * - Panel (solid): body sections, list content blocks, forms, settings,
 *   anything with paragraphs
 */

import React from 'react';

type Variant = 'glass' | 'panel';

interface CardShellProps {
  variant?: Variant;
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
  style?: React.CSSProperties;
}

export default function CardShell({ 
  variant = 'panel', 
  className = '', 
  children,
  onClick,
  style
}: CardShellProps) {
  const base = variant === 'glass' ? 'glass' : 'panel';
  const clickable = onClick ? 'cursor-pointer' : '';
  
  return (
    <div 
      className={`${base} ${clickable} ${className}`}
      onClick={onClick}
      style={style}
    >
      {children}
    </div>
  );
}

