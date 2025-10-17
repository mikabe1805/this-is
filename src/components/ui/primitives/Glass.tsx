import React from 'react';

export function GlassPanel({
  className = '',
  children,
  withSunlight = false,
  ...props
}: React.PropsWithChildren<{ className?: string; withSunlight?: boolean }>) {
  const sunlightClass = withSunlight ? 'sun-edge' : '';
  return (
    <div className={`relative glass-card ${sunlightClass} rounded-xl2 group hover-lift hover-lift-on animate-fade-in ${className}`} {...props}>
      {children}
    </div>
  );
}

export function PrimaryBtn({
  className = '',
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`pill pill--primary ${className}`}
    >
      {children}
    </button>
  );
}

export function GhostBtn({
  className = '',
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`pill pill--quiet ${className}`}
    >
      {children}
    </button>
  );
}

