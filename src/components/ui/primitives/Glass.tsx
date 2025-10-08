import React from 'react';

export function GlassPanel({
  className = '',
  children,
  ...props
}: React.PropsWithChildren<{ className?: string }>) {
  return (
    <div className={`relative glass sun-edge rounded-xl2 ${className}`} {...props}>
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

