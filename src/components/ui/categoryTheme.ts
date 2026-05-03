import { resolvePosterCategory, type PosterCategory } from '../../utils/posterMapping'

export type CategoryTheme = {
  key: PosterCategory | 'bar'
  label: string
  ink: string       // category ink color (only used as accent, never card background)
}

const THEMES: Record<CategoryTheme['key'], CategoryTheme> = {
  coffee:     { key: 'coffee',     label: 'Coffee',     ink: '#5A2E0E' },
  park:       { key: 'park',       label: 'Outdoors',   ink: '#1F3A1F' },
  restaurant: { key: 'restaurant', label: 'Eats',       ink: '#4F1814' },
  museum:     { key: 'museum',     label: 'Culture',    ink: '#1E1A4A' },
  library:    { key: 'library',    label: 'Books',      ink: '#3F2E12' },
  bar:        { key: 'bar',        label: 'After dark', ink: '#1F0E36' },
  default:    { key: 'default',    label: 'Place',      ink: '#2A2410' },
}

export function pickTheme(primaryType?: string | null, types: string[] = []): CategoryTheme {
  const candidates = [primaryType, ...types].filter(Boolean) as string[]
  for (const t of candidates) {
    const lower = t.toLowerCase()
    if (lower === 'bar' || lower === 'wine_bar' || lower === 'pub' || lower === 'night_club') {
      return THEMES.bar
    }
  }
  const cat = resolvePosterCategory(primaryType, types)
  return THEMES[cat]
}
