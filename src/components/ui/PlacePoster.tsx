import {
  BuildingLibraryIcon,
  BuildingStorefrontIcon,
  CakeIcon,
  CameraIcon,
  MapPinIcon,
  MoonIcon,
  MusicalNoteIcon,
  SparklesIcon,
  SunIcon,
} from '@heroicons/react/24/outline'

import { resolvePosterCategory, type PosterCategory } from '../../utils/posterMapping'

type ExtendedCategory = PosterCategory | 'bar'

type Duotone = {
  ink: string       // foreground color (icon, text)
  paper: string     // background base
  accent: string    // small punch
  Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  label: string
}

// Risograph-style duotone palettes. Each is a single warm ink + a single
// cream paper + a small accent punch. Reads as printed, not stocky.
const PALETTE: Record<ExtendedCategory, Duotone> = {
  coffee:     { ink: '#5A2E0E', paper: '#F0E2C8', accent: '#C2410C', Icon: CakeIcon, label: 'Coffee' },
  park:       { ink: '#1F3A1F', paper: '#E2E9CE', accent: '#3F6B3D', Icon: SunIcon, label: 'Outdoors' },
  restaurant: { ink: '#4F1814', paper: '#F2DDCB', accent: '#B23A2A', Icon: BuildingStorefrontIcon, label: 'Eats' },
  museum:     { ink: '#1E1A4A', paper: '#E2DCED', accent: '#574EAB', Icon: CameraIcon, label: 'Culture' },
  library:    { ink: '#3F2E12', paper: '#EDDCB8', accent: '#8C6428', Icon: BuildingLibraryIcon, label: 'Books' },
  bar:        { ink: '#1F0E36', paper: '#E8D7E0', accent: '#732C6E', Icon: MoonIcon, label: 'After dark' },
  default:    { ink: '#2A2410', paper: '#E9E2D2', accent: '#7A5A2A', Icon: MapPinIcon, label: 'Place' },
}

const ICON_BY_TYPE: Record<string, Duotone['Icon']> = {
  music_venue: MusicalNoteIcon,
  performing_arts_theater: MusicalNoteIcon,
  movie_theater: SparklesIcon,
  ice_cream_shop: CakeIcon,
  bakery: CakeIcon,
  spa: SparklesIcon,
}

function pick(primaryType?: string | null, types: string[] = []): Duotone {
  const candidates = [primaryType, ...types].filter(Boolean) as string[]
  for (const t of candidates) {
    const lower = t.toLowerCase()
    if (lower === 'bar' || lower === 'wine_bar' || lower === 'pub' || lower === 'night_club') {
      return PALETTE.bar
    }
  }
  const cat = resolvePosterCategory(primaryType, types)
  const base = PALETTE[cat]
  for (const t of candidates) {
    const Icon = ICON_BY_TYPE[t.toLowerCase()]
    if (Icon) return { ...base, Icon }
  }
  return base
}

function hashAngle(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0
  return Math.abs(h) % 360
}

interface PlacePosterProps {
  primaryType?: string | null
  types?: string[]
  name?: string
  className?: string
  iconOnly?: boolean
}

export default function PlacePoster({
  primaryType,
  types = [],
  name,
  className = '',
  iconOnly = false,
}: PlacePosterProps) {
  const p = pick(primaryType, types)
  const Icon = p.Icon
  const angle = hashAngle(name || p.label)

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{ background: p.paper }}
      aria-hidden={!name}
    >
      {/* Risograph misregistration: a soft accent oval offset behind the icon */}
      <div
        className="absolute"
        style={{
          width: '70%',
          aspectRatio: '1 / 1',
          left: '50%',
          top: '50%',
          transform: `translate(-50%, -50%) rotate(${angle}deg)`,
          background: p.accent,
          borderRadius: '50%',
          opacity: 0.18,
          mixBlendMode: 'multiply',
        }}
      />
      <div
        className="absolute"
        style={{
          width: '70%',
          aspectRatio: '1 / 1',
          left: 'calc(50% + 6px)',
          top: 'calc(50% + 4px)',
          transform: `translate(-50%, -50%) rotate(${angle + 30}deg)`,
          background: p.ink,
          borderRadius: '50%',
          opacity: 0.07,
          mixBlendMode: 'multiply',
        }}
      />
      {/* Print grain */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 240 240' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.4' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E\")",
          opacity: 0.18,
          mixBlendMode: 'multiply',
        }}
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <Icon
          className="w-1/3 h-1/3 max-w-[88px] max-h-[88px]"
          style={{ color: p.ink, strokeWidth: 1.6 }}
        />
      </div>
      {!iconOnly && (
        <div
          className="absolute bottom-2 left-2.5 right-2.5 flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.18em]"
          style={{ color: p.ink, opacity: 0.7 }}
        >
          <span>{p.label}</span>
          <span>·</span>
        </div>
      )}
    </div>
  )
}
