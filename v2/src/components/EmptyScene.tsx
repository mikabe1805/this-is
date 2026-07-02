/**
 * The bare wall — the art-directed empty state: one picture light switched on
 * over a lone hook, pool of warm light on nothing. Inline SVG (the generated
 * asset batch replaces this in W4+); emptiness should feel like anticipation,
 * not failure.
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
          <stop offset="0%" stopColor="#FBEFE9" stopOpacity="0.42" />
          <stop offset="55%" stopColor="#FBEFE9" stopOpacity="0.07" />
          <stop offset="100%" stopColor="#FBEFE9" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="es-lamp" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#B9A5AB" />
          <stop offset="100%" stopColor="#6E5B61" />
        </linearGradient>
      </defs>
      {/* the cone of light */}
      <path d="M130 30 L58 162 L202 162 Z" fill="url(#es-glow)" />
      {/* the picture light: stem + shade */}
      <line x1="130" y1="10" x2="130" y2="20" stroke="#6E5B61" strokeWidth="2" />
      <rect x="102" y="20" width="56" height="7" rx="3.5" fill="url(#es-lamp)" />
      {/* the lone hook, lit */}
      <path
        d="M130 88 v12 a7 7 0 1 1 -7 7"
        stroke="#C9B2B8"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />
      {/* floor shadow line */}
      <line x1="40" y1="162" x2="220" y2="162" stroke="#F2ECEB" strokeOpacity="0.1" />
    </svg>
  )
}
