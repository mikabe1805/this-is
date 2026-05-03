/**
 * BotanicalMark — fine engraved-style botanical illustration.
 *
 * RULE OF USE: this is a *background watermark*, not a foreground accent. It
 * should be felt, not noticed. Default opacity is 0.08. Never place adjacent
 * to interactive elements or section titles — that reads as a logo. Use as
 * a single corner watermark per long-scroll page, or behind a hero.
 *
 * Variants are detailed enough to read as illustration, not icon: stems with
 * tapered nodes, pinnate ferns with vein detail, rose petals layered with
 * inner shading, lavender stalks with bracts. Stroke-only, walnut-ink.
 */

import type { CSSProperties } from 'react'

type Variant =
  | 'fern'           // pinnate fern frond
  | 'rose-stem'      // long-stemmed rose, single bloom
  | 'lavender'       // tall lavender stalk
  | 'wildflower'     // simple five-petal flower with leaves
  | 'cluster'        // herbarium cluster — multiple stems

interface BotanicalMarkProps {
  variant?: Variant
  size?: number
  opacity?: number
  className?: string
  color?: string
  flip?: boolean
  style?: CSSProperties
}

export default function BotanicalMark({
  variant = 'fern',
  size = 200,
  opacity = 0.08,
  className = '',
  color = '#5C3A1B',
  flip = false,
  style,
}: BotanicalMarkProps) {
  const transform = flip ? 'scale(-1, 1)' : undefined
  const stroke = color
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 200 200',
    fill: 'none' as const,
    stroke,
    strokeWidth: 0.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }

  if (variant === 'fern') {
    return (
      <svg {...common} className={className} style={{ opacity, transform, ...style }} aria-hidden>
        {/* Main rachis (central stem) — gently curved */}
        <path d="M 100 200 C 105 165, 95 130, 100 90 C 105 55, 95 25, 100 4" />
        {/* Pinnae — pairs of leaflets along the stem, getting smaller toward the tip */}
        {/* lower pair */}
        <path d="M 100 175 C 80 172, 60 160, 50 145 C 65 152, 85 162, 100 170" />
        <path d="M 100 175 C 120 172, 140 160, 150 145 C 135 152, 115 162, 100 170" />
        {/* second pair */}
        <path d="M 100 155 C 82 152, 64 142, 56 128 C 70 134, 86 144, 100 150" />
        <path d="M 100 155 C 118 152, 136 142, 144 128 C 130 134, 114 144, 100 150" />
        {/* third */}
        <path d="M 100 135 C 84 132, 70 124, 64 112 C 76 117, 88 124, 100 130" />
        <path d="M 100 135 C 116 132, 130 124, 136 112 C 124 117, 112 124, 100 130" />
        {/* fourth */}
        <path d="M 100 115 C 86 113, 76 106, 72 96 C 82 100, 92 106, 100 110" />
        <path d="M 100 115 C 114 113, 124 106, 128 96 C 118 100, 108 106, 100 110" />
        {/* fifth */}
        <path d="M 100 95 C 88 93, 80 88, 78 80 C 86 83, 94 87, 100 90" />
        <path d="M 100 95 C 112 93, 120 88, 122 80 C 114 83, 106 87, 100 90" />
        {/* sixth */}
        <path d="M 100 75 C 90 73, 84 69, 82 62 C 90 64, 96 67, 100 70" />
        <path d="M 100 75 C 110 73, 116 69, 118 62 C 110 64, 104 67, 100 70" />
        {/* seventh */}
        <path d="M 100 55 C 92 53, 88 49, 86 44 C 92 46, 98 49, 100 50" />
        <path d="M 100 55 C 108 53, 112 49, 114 44 C 108 46, 102 49, 100 50" />
        {/* tip cluster */}
        <path d="M 100 35 C 95 30, 92 24, 92 16 C 96 22, 99 28, 100 32" />
        <path d="M 100 35 C 105 30, 108 24, 108 16 C 104 22, 101 28, 100 32" />
        <path d="M 100 14 C 98 10, 99 6, 100 4 C 101 6, 102 10, 100 14" />
      </svg>
    )
  }

  if (variant === 'rose-stem') {
    return (
      <svg {...common} className={className} style={{ opacity, transform, ...style }} aria-hidden>
        {/* Stem with thorns and a bloom */}
        <path d="M 100 200 C 95 170, 105 140, 92 110 C 80 80, 95 55, 100 40" />
        {/* Tiny thorns */}
        <path d="M 96 180 L 92 178" /><path d="M 100 160 L 104 158" />
        <path d="M 99 140 L 95 138" /><path d="M 90 120 L 86 118" />
        <path d="M 88 100 L 84 98" /><path d="M 95 80 L 99 78" />
        {/* Two leaves along the stem */}
        <path d="M 92 110 C 76 105, 64 95, 56 82 C 70 92, 84 100, 92 108 Z" />
        <path d="M 92 108 C 76 105, 64 95, 56 82" />
        <path d="M 100 70 C 116 66, 128 56, 134 44 C 122 54, 110 62, 100 68 Z" />
        <path d="M 100 68 C 116 66, 128 56, 134 44" />
        {/* Rose bloom — outer petals */}
        <ellipse cx="100" cy="34" rx="22" ry="20" />
        <path d="M 78 34 C 80 22, 90 12, 100 14 C 110 12, 120 22, 122 34" />
        <path d="M 78 34 C 80 46, 90 56, 100 54 C 110 56, 120 46, 122 34" />
        {/* Inner whorl */}
        <path d="M 86 34 C 88 26, 94 20, 100 22 C 106 20, 112 26, 114 34" />
        <path d="M 86 34 C 88 42, 94 48, 100 46 C 106 48, 112 42, 114 34" />
        {/* Center curl */}
        <path d="M 95 34 C 96 30, 100 28, 104 30 C 106 32, 105 36, 102 36 C 99 35, 96 35, 95 34 Z" />
      </svg>
    )
  }

  if (variant === 'lavender') {
    return (
      <svg {...common} className={className} style={{ opacity, transform, ...style }} aria-hidden>
        {/* Tall lavender stalk with bracts */}
        <path d="M 100 200 C 102 170, 98 140, 100 110 C 102 80, 98 50, 100 18" />
        {/* Long thin leaves at base */}
        <path d="M 100 190 C 90 188, 84 180, 80 168 C 86 178, 94 186, 100 188" />
        <path d="M 100 190 C 110 188, 116 180, 120 168 C 114 178, 106 186, 100 188" />
        <path d="M 100 170 C 92 168, 88 162, 86 152 C 92 160, 96 165, 100 168" />
        <path d="M 100 170 C 108 168, 112 162, 114 152 C 108 160, 104 165, 100 168" />
        {/* Lavender flower spike — staggered tear-drop blossoms up the stalk */}
        {[
          [100, 100], [96, 92], [104, 92],
          [98, 84], [102, 84],
          [96, 76], [104, 76],
          [99, 68], [101, 68],
          [97, 60], [103, 60],
          [99, 52], [101, 52],
          [100, 44], [98, 36], [102, 36],
          [100, 28], [100, 20],
        ].map(([cx, cy], i) => (
          <ellipse key={i} cx={cx} cy={cy} rx="2.2" ry="3.2" />
        ))}
      </svg>
    )
  }

  if (variant === 'wildflower') {
    return (
      <svg {...common} className={className} style={{ opacity, transform, ...style }} aria-hidden>
        {/* Stem */}
        <path d="M 100 200 C 96 170, 104 140, 100 110 C 96 80, 104 60, 100 44" />
        {/* Pair of leaves */}
        <path d="M 100 150 C 84 148, 72 138, 66 124 C 78 134, 90 142, 100 146 Z" />
        <path d="M 100 150 C 84 148, 72 138, 66 124" />
        <path d="M 100 110 C 116 108, 128 100, 134 88 C 122 96, 110 104, 100 108 Z" />
        <path d="M 100 108 C 116 108, 128 100, 134 88" />
        {/* Five-petal flower */}
        <ellipse cx="100" cy="28" rx="6" ry="11" transform="rotate(0 100 28)" />
        <ellipse cx="100" cy="28" rx="6" ry="11" transform="rotate(72 100 28)" />
        <ellipse cx="100" cy="28" rx="6" ry="11" transform="rotate(144 100 28)" />
        <ellipse cx="100" cy="28" rx="6" ry="11" transform="rotate(216 100 28)" />
        <ellipse cx="100" cy="28" rx="6" ry="11" transform="rotate(288 100 28)" />
        {/* Center */}
        <circle cx="100" cy="28" r="3" />
        <circle cx="100" cy="28" r="1.2" fill={stroke} fillOpacity="0.4" />
        {/* Tiny stamens */}
        <path d="M 100 28 L 98 24" /><path d="M 100 28 L 102 24" />
        <path d="M 100 28 L 96 28" /><path d="M 100 28 L 104 28" />
      </svg>
    )
  }

  // cluster — three sprigs at different lengths and angles, like a pressed bouquet
  return (
    <svg {...common} className={className} style={{ opacity, transform, ...style }} aria-hidden>
      {/* Bound stems at base */}
      <path d="M 100 200 L 100 184" /><path d="M 96 188 L 104 188" />
      {/* Left sprig — long with small leaves */}
      <path d="M 100 185 C 92 170, 80 145, 70 120 C 64 100, 60 80, 62 60" />
      <path d="M 86 158 C 78 156, 72 152, 68 144" />
      <path d="M 78 138 C 70 136, 64 132, 60 124" />
      <path d="M 70 118 C 62 116, 56 112, 52 104" />
      <path d="M 64 92 C 56 90, 50 84, 48 76" />
      {/* Tiny bud at top */}
      <ellipse cx="62" cy="56" rx="2.5" ry="3.5" />
      {/* Middle sprig — straight, flower head */}
      <path d="M 100 185 C 100 160, 98 130, 100 100 C 100 70, 100 45, 100 28" />
      <path d="M 100 130 C 92 128, 86 122, 84 114" />
      <path d="M 100 130 C 108 128, 114 122, 116 114" />
      <path d="M 100 90 C 94 88, 90 84, 88 78" />
      <path d="M 100 90 C 106 88, 110 84, 112 78" />
      {/* Bloom at top — five small petals */}
      <ellipse cx="100" cy="20" rx="4" ry="7" transform="rotate(0 100 20)" />
      <ellipse cx="100" cy="20" rx="4" ry="7" transform="rotate(72 100 20)" />
      <ellipse cx="100" cy="20" rx="4" ry="7" transform="rotate(144 100 20)" />
      <ellipse cx="100" cy="20" rx="4" ry="7" transform="rotate(216 100 20)" />
      <ellipse cx="100" cy="20" rx="4" ry="7" transform="rotate(288 100 20)" />
      <circle cx="100" cy="20" r="1.8" />
      {/* Right sprig — shorter, lavender-style */}
      <path d="M 100 185 C 108 168, 122 144, 132 120 C 138 102, 140 84, 138 70" />
      <ellipse cx="138" cy="68" rx="1.8" ry="2.6" />
      <ellipse cx="136" cy="80" rx="1.8" ry="2.6" />
      <ellipse cx="134" cy="92" rx="1.8" ry="2.6" />
      <ellipse cx="130" cy="104" rx="1.8" ry="2.6" />
    </svg>
  )
}
