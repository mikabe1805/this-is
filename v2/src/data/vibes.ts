/**
 * Vibe tags + dominant-hex placeholders, derived from Google primary types.
 *
 * The hex is the card's loading block and the fallback visual when no photo
 * is allowed by the budget — the grid must never show a spinner or a white
 * box. Values are tuned to the design tokens (see styles/tokens.css); when
 * the palette shifts, shift these with it.
 *
 * Upgrade path (documented, not built): sample the real dominant color from
 * the closeup photo via canvas and write it back to the place doc.
 */

type VibeEntry = { tags: string[]; hex: string }

/* Hexes are the category's own hue, kept muted-dark; the CSS layer pulls each
   15% toward the oxblood canvas (color-mix, DESIGN.md law 6) so every
   placeholder already hangs in the same room. */
const FALLBACK: VibeEntry = { tags: ['somewhere-new'], hex: '#3A2B31' }

const BY_TYPE: Record<string, VibeEntry> = {
  cafe: { tags: ['coffee', 'cozy', 'work-friendly'], hex: '#4C3A34' },
  coffee_shop: { tags: ['coffee', 'cozy', 'work-friendly'], hex: '#4C3A34' },
  tea_house: { tags: ['coffee', 'cozy', 'quiet'], hex: '#42423A' },
  bakery: { tags: ['sweet', 'morning', 'quick-bite'], hex: '#4E4136' },
  restaurant: { tags: ['dinner', 'date-night'], hex: '#4A3038' },
  brunch_restaurant: { tags: ['brunch', 'morning'], hex: '#4C4338' },
  pizza_restaurant: { tags: ['quick-bite', 'casual'], hex: '#4C3530' },
  ramen_restaurant: { tags: ['dinner', 'casual', 'cozy'], hex: '#473139' },
  sushi_restaurant: { tags: ['dinner', 'date-night'], hex: '#353D45' },
  italian_restaurant: { tags: ['dinner', 'date-night'], hex: '#4A3038' },
  mexican_restaurant: { tags: ['dinner', 'casual'], hex: '#4C3530' },
  thai_restaurant: { tags: ['dinner', 'casual'], hex: '#463D31' },
  vegetarian_restaurant: { tags: ['dinner', 'healthy'], hex: '#3A4432' },
  bar: { tags: ['drinks', 'late-night'], hex: '#37333F' },
  wine_bar: { tags: ['drinks', 'date-night', 'cozy'], hex: '#4A2E3C' },
  pub: { tags: ['drinks', 'casual'], hex: '#403A31' },
  cocktail_bar: { tags: ['drinks', 'date-night', 'late-night'], hex: '#3D2F42' },
  night_club: { tags: ['late-night', 'dancing'], hex: '#332D40' },
  ice_cream_shop: { tags: ['sweet', 'quick-bite'], hex: '#453946' },
  dessert_shop: { tags: ['sweet'], hex: '#483642' },
  chocolate_shop: { tags: ['sweet', 'gifts'], hex: '#44342D' },
  museum: { tags: ['culture', 'slow-afternoon'], hex: '#363C44' },
  art_gallery: { tags: ['culture', 'browse'], hex: '#3D3444' },
  performing_arts_theater: { tags: ['culture', 'a-show'], hex: '#42303D' },
  movie_theater: { tags: ['a-show', 'date-night'], hex: '#32333B' },
  tourist_attraction: { tags: ['somewhere-new', 'culture'], hex: '#3C3A42' },
  park: { tags: ['outdoors', 'slow-afternoon'], hex: '#364232' },
  garden: { tags: ['outdoors', 'quiet'], hex: '#364232' },
  hiking_area: { tags: ['outdoors', 'active'], hex: '#324336' },
  beach: { tags: ['outdoors', 'slow-afternoon'], hex: '#34434D' },
  book_store: { tags: ['browse', 'quiet', 'cozy'], hex: '#423830' },
  clothing_store: { tags: ['browse', 'shopping'], hex: '#3E3540' },
  home_goods_store: { tags: ['browse', 'shopping'], hex: '#3E3540' },
  gift_shop: { tags: ['browse', 'gifts'], hex: '#443642' },
  shopping_mall: { tags: ['shopping'], hex: '#3A373F' },
  market: { tags: ['browse', 'morning'], hex: '#444231' },
  gym: { tags: ['active'], hex: '#323C43' },
  spa: { tags: ['quiet', 'treat-yourself'], hex: '#38403F' },
  hotel: { tags: ['stay'], hex: '#3E343D' },
  lodging: { tags: ['stay'], hex: '#3E343D' },
}

/** The 12 curated browse/onboarding vibes — one label per taste tag. Shared
 *  by Search's browse grid and the onboarding taste picker. */
export const BROWSE_VIBES: { tag: string; label: string }[] = [
  { tag: 'coffee', label: 'COFFEE' },
  { tag: 'cozy', label: 'COZY' },
  { tag: 'dinner', label: 'DINNER' },
  { tag: 'drinks', label: 'DRINKS' },
  { tag: 'date-night', label: 'DATE NIGHT' },
  { tag: 'late-night', label: 'LATE NIGHT' },
  { tag: 'outdoors', label: 'OUTDOORS' },
  { tag: 'culture', label: 'CULTURE' },
  { tag: 'sweet', label: 'SWEET' },
  { tag: 'quick-bite', label: 'QUICK BITE' },
  { tag: 'browse', label: 'BROWSE' },
  { tag: 'somewhere-new', label: 'SOMETHING NEW' },
]

export function vibesFor(primaryType?: string): string[] {
  return (primaryType && BY_TYPE[primaryType]?.tags) || FALLBACK.tags
}

export function hexFor(primaryType?: string): string {
  return (primaryType && BY_TYPE[primaryType]?.hex) || FALLBACK.hex
}

/** The mono chip label for a type: "wine_bar" → "WINE BAR". */
export function typeLabel(primaryType?: string): string | null {
  return primaryType ? primaryType.replace(/_/g, ' ').toUpperCase() : null
}

/**
 * Best-effort neighborhood from a formatted address: the component after the
 * street. Honest-absence rule applies — undefined beats a wrong guess for
 * short addresses.
 */
export function neighborhoodFrom(address?: string): string | undefined {
  if (!address) return undefined
  const parts = address.split(',').map(s => s.trim()).filter(Boolean)
  if (parts.length < 3) return undefined
  return parts[1]
}
