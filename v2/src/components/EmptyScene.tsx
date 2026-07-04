/**
 * The bare wall — the art-directed empty state: one picture light switched on
 * over a lone hook, a pool of warm light on nothing. Inline SVG (the generated
 * asset batch replaces this in W4+); emptiness should feel like anticipation,
 * not failure. Colors are theme tokens (see .empty-scene in components.css) so
 * the scene reads on both the oxblood night canvas and the rose-plaster day one
 * — in daylight the picture-light inverts to a madder pool of gravity.
 */
export function EmptyScene() {
  return (
    <svg
      className="empty-scene"
      viewBox="0 0 260 180"
      role="img"
      aria-label="An empty wall with a picture light waiting over a hook"
    >
      <defs>
        <radialGradient id="es-glow" cx="50%" cy="0%" r="95%">
          <stop className="es-glow-in" offset="0%" />
          <stop className="es-glow-mid" offset="55%" />
          <stop className="es-glow-out" offset="100%" />
        </radialGradient>
      </defs>
      {/* the cone of light */}
      <path className="es-cone" d="M130 30 L58 162 L202 162 Z" fill="url(#es-glow)" />
      {/* the picture light: stem + shade */}
      <line className="es-stem" x1="130" y1="10" x2="130" y2="20" />
      <rect className="es-shade" x="102" y="20" width="56" height="7" rx="3.5" />
      {/* the lone hook, lit */}
      <path className="es-hook" d="M130 88 v12 a7 7 0 1 1 -7 7" fill="none" strokeLinecap="round" />
      {/* floor shadow line */}
      <line className="es-floor" x1="40" y1="162" x2="220" y2="162" />
    </svg>
  )
}
