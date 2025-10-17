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
  withSunlight?: boolean;
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
  style?: React.CSSProperties;
}

export default function CardShell({
  variant = 'panel',
  withSunlight = false,
  className = '',
  children,
  onClick,
  style
}: CardShellProps) {
  const sunClass = withSunlight && variant === 'glass' ? 'sun-edge' : '';
  const base = variant === 'glass'
    ? `relative glass-card ${sunClass} rounded-2xl p-4 md:p-5 interactive-glass`
    : 'panel rounded-2xl p-4 md:p-5';
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

