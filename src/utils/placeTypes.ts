/**
 * Place type mappings and categorization utilities
 * Single source of truth for interest → Google Places API type conversions
 */

/**
 * Maps user interests/tags to Google Places API types
 * Handles synonyms and variations
 */
export const TYPE_MAPPINGS: Record<string, string> = {
  // Coffee & Cafes
  coffee: 'cafe',
  coffee_shop: 'cafe',
  cafe: 'cafe',

  // Food & Dining
  restaurant: 'restaurant',
  food: 'restaurant',
  dining: 'restaurant',

  // Bars & Nightlife
  bar: 'bar',
  nightlife: 'night_club',
  night_club: 'night_club',

  // Arts & Culture
  museum: 'museum',
  art: 'art_gallery',
  art_gallery: 'art_gallery',

  // Nature & Outdoors
  park: 'park',
  nature: 'park',

  // Books & Learning
  library: 'library',
  bookstore: 'book_store',
  book_store: 'book_store',
}

/**
 * Maps primary place types to complementary types
 * Used for diversifying search results while maintaining relevance
 */
export const COMPLEMENTARY_TYPES: Record<string, string[]> = {
  restaurant: ['cafe', 'bakery', 'bar'],
  cafe: ['bakery', 'restaurant'],
  bar: ['restaurant', 'night_club'],
  art_gallery: ['museum'],
  museum: ['art_gallery'],
  park: ['tourist_attraction'],
  night_club: ['bar'],
  bakery: ['cafe', 'restaurant'],
}

/**
 * Convert user interests/tags to Google Places API types
 * @param interests Array of user interests, tags, or categories
 * @param includeComplementary Whether to include complementary types
 * @returns Array of Google Places API type strings
 */
export function mapInterestsToTypes(
  interests: string[],
  includeComplementary: boolean = false
): string[] {
  const normalized = interests.map(s => String(s || '').toLowerCase().trim())

  // Map to primary types
  const primaryTypesSet = new Set<string>()
  for (const interest of normalized) {
    const mapped = TYPE_MAPPINGS[interest]
    if (mapped) {
      primaryTypesSet.add(mapped)
    }
  }

  // Fallback if no matches
  if (primaryTypesSet.size === 0) {
    primaryTypesSet.add('restaurant')
  }

  const primaryTypes = Array.from(primaryTypesSet)

  if (!includeComplementary) {
    return primaryTypes
  }

  // Add complementary types
  const complementarySet = new Set<string>()
  for (const type of primaryTypes) {
    const complementary = COMPLEMENTARY_TYPES[type] || []
    complementary.forEach(ct => complementarySet.add(ct))
  }

  return [...primaryTypes, ...Array.from(complementarySet)]
}

/**
 * Get only complementary types for given primary types
 * @param primaryTypes Array of primary place types
 * @returns Array of complementary type strings
 */
export function getComplementaryTypes(primaryTypes: string[]): string[] {
  const complementarySet = new Set<string>()

  for (const type of primaryTypes) {
    const complementary = COMPLEMENTARY_TYPES[type] || []
    complementary.forEach(ct => complementarySet.add(ct))
  }

  return Array.from(complementarySet)
}

/**
 * Humanize a place type for display
 * Converts snake_case API types to readable labels
 */
export function humanizePlaceType(type: string): string {
  const displayMap: Record<string, string> = {
    cafe: 'Cafe',
    restaurant: 'Restaurant',
    bar: 'Bar',
    night_club: 'Night Club',
    art_gallery: 'Art Gallery',
    museum: 'Museum',
    park: 'Park',
    tourist_attraction: 'Tourist Attraction',
    library: 'Library',
    book_store: 'Bookstore',
    bakery: 'Bakery',
  }

  return displayMap[type] || type
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

// ============================================================================
// INTEREST LEXICON — the taste vocabulary
// ----------------------------------------------------------------------------
// The recommendation engine builds a "taste profile" by mapping a user's
// signals (saved-place types, signup vibes, bio keywords) onto these canonical
// interests. Each interest carries:
//   - query:  a vibe-rich Google `searchText` phrase ("scenic beach") — this is
//             what makes recommendations feel fun & specific rather than a
//             generic "places nearby" type query.
//   - types:  Google place types that count as a match when RANKING candidates.
//   - match:  keywords found in tags/bio/categories/place-types that signal it.
//   - label:  human label for the "Because you love …" reason on cards.
// ============================================================================

export interface Interest {
  key: string
  label: string
  query: string
  types: string[]
  match: string[]
}

export const INTERESTS: Interest[] = [
  { key: 'coffee',     label: 'coffee',          query: 'specialty coffee shop',      types: ['cafe'],                         match: ['coffee', 'cafe', 'café', 'espresso', 'latte', 'caffeine', 'cappuccino'] },
  { key: 'tea',        label: 'tea & matcha',    query: 'cozy tea house',             types: ['cafe'],                         match: ['tea', 'matcha', 'boba', 'bubble tea', 'chai'] },
  { key: 'brunch',     label: 'brunch',          query: 'brunch breakfast spot',      types: ['restaurant', 'cafe'],           match: ['brunch', 'breakfast', 'pancakes', 'breakfast'] },
  { key: 'bakery',     label: 'bakeries',        query: 'bakery fresh pastries',      types: ['bakery'],                       match: ['bakery', 'pastry', 'pastries', 'croissant', 'bread', 'patisserie'] },
  { key: 'dessert',    label: 'dessert',         query: 'dessert ice cream shop',     types: ['bakery'],                       match: ['dessert', 'ice cream', 'gelato', 'sweets', 'donut', 'cake'] },
  { key: 'restaurant', label: 'good food',       query: 'highly rated restaurant',    types: ['restaurant'],                   match: ['restaurant', 'food', 'dining', 'dinner', 'eats', 'foodie', 'cuisine'] },
  { key: 'ramen',      label: 'ramen & noodles', query: 'ramen noodle bar',           types: ['restaurant'],                   match: ['ramen', 'noodles', 'pho', 'udon'] },
  { key: 'sushi',      label: 'sushi',           query: 'sushi restaurant',           types: ['restaurant'],                   match: ['sushi', 'japanese', 'omakase', 'sashimi'] },
  { key: 'tacos',      label: 'tacos',           query: 'taco spot',                  types: ['restaurant'],                   match: ['taco', 'tacos', 'mexican', 'burrito'] },
  { key: 'pizza',      label: 'pizza',           query: 'pizza place',                types: ['restaurant'],                   match: ['pizza', 'italian', 'pasta'] },
  { key: 'vegan',      label: 'plant-based eats',query: 'vegan vegetarian restaurant',types: ['restaurant'],                   match: ['vegan', 'vegetarian', 'plant based', 'plant-based'] },
  { key: 'bar',        label: 'cocktail bars',   query: 'cocktail bar',               types: ['bar'],                          match: ['bar', 'cocktail', 'cocktails', 'drinks', 'mixology'] },
  { key: 'wine_bar',   label: 'wine bars',       query: 'wine bar',                   types: ['bar'],                          match: ['wine', 'natural wine', 'vineyard'] },
  { key: 'rooftop',    label: 'rooftop spots',   query: 'rooftop bar with a view',    types: ['bar'],                          match: ['rooftop', 'roof top'] },
  { key: 'nightlife',  label: 'nightlife',       query: 'fun night club',             types: ['night_club'],                   match: ['nightlife', 'club', 'clubbing', 'dancing', 'party', 'dj'] },
  { key: 'beach',      label: 'beaches',         query: 'scenic beach',               types: [],                               match: ['beach', 'beaches', 'ocean', 'coast', 'seaside', 'surf', 'shore'] },
  { key: 'hiking',     label: 'hikes',           query: 'scenic hiking trail',        types: [],                               match: ['hiking', 'hike', 'trail', 'trails', 'trek', 'backpacking'] },
  { key: 'nature',     label: 'nature & parks',  query: 'beautiful park or garden',   types: ['park'],                         match: ['nature', 'outdoors', 'park', 'parks', 'garden', 'botanical', 'lake'] },
  { key: 'viewpoint',  label: 'scenic views',    query: 'scenic viewpoint or lookout',types: ['tourist_attraction'],           match: ['view', 'views', 'viewpoint', 'scenic', 'lookout', 'sunset', 'overlook'] },
  { key: 'museum',     label: 'museums',         query: 'museum',                     types: ['museum'],                       match: ['museum', 'museums', 'history', 'exhibit', 'science'] },
  { key: 'art',        label: 'art',             query: 'art gallery',                types: ['art_gallery'],                  match: ['art', 'gallery', 'galleries', 'creative', 'painting', 'sculpture'] },
  { key: 'bookstore',  label: 'bookstores',      query: 'independent bookstore',      types: ['book_store'],                   match: ['book', 'books', 'bookstore', 'reading', 'library', 'literary'] },
  { key: 'live_music', label: 'live music',      query: 'live music venue',           types: ['night_club', 'bar'],            match: ['live music', 'concert', 'band', 'music', 'jazz', 'gig', 'vinyl'] },
  { key: 'shopping',   label: 'boutiques',       query: 'boutique shopping',          types: ['clothing_store'],               match: ['shopping', 'boutique', 'boutiques', 'fashion', 'market'] },
  { key: 'vintage',    label: 'vintage finds',   query: 'vintage thrift store',       types: ['clothing_store'],               match: ['vintage', 'thrift', 'thrifting', 'secondhand', 'antique'] },
  { key: 'yoga',       label: 'yoga & wellness', query: 'yoga studio',                types: ['gym'],                          match: ['yoga', 'pilates', 'meditation', 'wellness'] },
  { key: 'gym',        label: 'fitness',         query: 'gym or climbing',            types: ['gym'],                          match: ['gym', 'fitness', 'workout', 'climbing', 'bouldering', 'crossfit'] },
  { key: 'spa',        label: 'spas',            query: 'spa and massage',            types: ['spa'],                          match: ['spa', 'massage', 'sauna', 'onsen', 'bathhouse'] },
]

const INTEREST_BY_KEY: Record<string, Interest> = Object.fromEntries(INTERESTS.map(i => [i.key, i]))

// ============================================================================
// VIBE LEXICON — the aesthetic vocabulary
// ----------------------------------------------------------------------------
// A vibe is the *mood/aesthetic* of the places you're drawn to (distinct from
// the category). We accumulate these over time from the places you save/open
// so "Your vibe" reads like a Pinterest mood-board caption that grows and gets
// more specific the more you use the app — sun-drenched · matcha · slow
// mornings · tucked-away. Keys are path-safe slugs (used as Firestore map keys
// via dotted paths); `label` is the display string. `match` are keywords found
// in a place's type/tags/name (or the user's bio/vibes) that imply the vibe.
// ============================================================================
export interface Vibe { key: string; label: string; match: string[] }

export const VIBES: Vibe[] = [
  { key: 'sun_drenched',     label: 'sun-drenched',     match: ['beach', 'rooftop', 'patio', 'terrace', 'outdoor', 'sunset', 'golden', 'seaside', 'poolside'] },
  { key: 'coastal',          label: 'coastal',          match: ['beach', 'ocean', 'coast', 'seaside', 'surf', 'pier', 'harbor', 'bay', 'shore'] },
  { key: 'matcha',           label: 'matcha hour',      match: ['matcha', 'tea', 'boba', 'bubble tea', 'chai', 'latte'] },
  { key: 'slow_mornings',    label: 'slow mornings',    match: ['cafe', 'coffee', 'café', 'brunch', 'breakfast', 'bakery', 'espresso', 'pastry'] },
  { key: 'candlelit',        label: 'candlelit',        match: ['wine', 'cocktail', 'speakeasy', 'date', 'intimate', 'romantic', 'dim', 'dinner'] },
  { key: 'moody',            label: 'moody',            match: ['speakeasy', 'jazz', 'vinyl', 'lounge', 'dive bar', 'whiskey', 'noir', 'dark'] },
  { key: 'dark_academia',    label: 'dark academia',    match: ['bookstore', 'library', 'museum', 'literary', 'history', 'university', 'archive', 'gothic'] },
  { key: 'cottagecore',      label: 'cottagecore',      match: ['garden', 'botanical', 'cottage', 'farm', 'floral', 'orchard', 'meadow', 'farmers market'] },
  { key: 'plant_filled',     label: 'plant-filled',     match: ['plant', 'greenhouse', 'botanical', 'conservatory', 'jungle', 'garden'] },
  { key: 'hidden_gem',       label: 'hidden gem',       match: ['hidden', 'speakeasy', 'tucked', 'secret', 'local', 'neighborhood', 'under the radar'] },
  { key: 'hole_in_the_wall', label: 'hole-in-the-wall', match: ['hole', 'dive', 'tiny', 'no-frills', 'counter', 'stall', 'street food', 'taqueria'] },
  { key: 'third_place',      label: 'third place',      match: ['cafe', 'coffee', 'coworking', 'community', 'hangout', 'lounge'] },
  { key: 'old_money',        label: 'old money',        match: ['fine dining', 'upscale', 'classic', 'elegant', 'members', 'country club', 'steakhouse', 'luxury'] },
  { key: 'clean_girl',       label: 'clean girl',       match: ['smoothie', 'salad', 'wellness', 'pilates', 'juice', 'minimalist', 'spa', 'acai'] },
  { key: 'gorpcore',         label: 'gorpcore',         match: ['hiking', 'trail', 'climbing', 'mountain', 'trek', 'camp', 'gear', 'outdoor'] },
  { key: 'y2k',              label: 'y2k', match: ['arcade', 'neon', 'bowling', 'diner', 'retro', 'roller', 'mall'] },
  { key: 'indie_sleaze',     label: 'indie sleaze',     match: ['dive bar', 'live music', 'basement', 'underground', 'grunge', 'warehouse', 'punk'] },
  { key: 'golden_hour',      label: 'golden hour',      match: ['rooftop', 'sunset', 'view', 'scenic', 'terrace', 'overlook', 'lookout'] },
  { key: 'buzzy',            label: 'buzzy',            match: ['trendy', 'popular', 'lively', 'hotspot', 'busy', 'bustling', 'hyped'] },
  { key: 'low_key',          label: 'low-key',          match: ['chill', 'casual', 'quiet', 'relaxed', 'mellow', 'laid-back', 'cozy'] },
  { key: 'nostalgic',        label: 'nostalgic',        match: ['retro', 'vintage', 'classic', 'old-school', 'diner', 'throwback'] },
  { key: 'elevated',         label: 'elevated',         match: ['tasting menu', 'chef', 'fine', 'refined', 'michelin', 'upscale'] },
  { key: 'unpretentious',    label: 'unpretentious',    match: ['no-frills', 'authentic', 'honest', 'neighborhood', 'dive', 'local'] },
  { key: 'art_house',        label: 'art-house',        match: ['gallery', 'art', 'indie cinema', 'museum', 'exhibit', 'film', 'theater'] },
  { key: 'literary',         label: 'literary',         match: ['bookstore', 'library', 'poetry', 'reading', 'books', 'zine'] },
  { key: 'outdoorsy',        label: 'outdoorsy',        match: ['hiking', 'park', 'nature', 'trail', 'beach', 'camp', 'kayak', 'bike'] },
  { key: 'curated',          label: 'curated', match: ['minimalist', 'design', 'aesthetic', 'boutique', 'concept', 'artisan'] },
]

const VIBE_BY_KEY: Record<string, Vibe> = Object.fromEntries(VIBES.map(v => [v.key, v]))

function norm(s: unknown): string {
  return String(s || '').toLowerCase().replace(/_/g, ' ').trim()
}

/**
 * Map arbitrary signal strings (tags, categories, bio words, Google place
 * types) onto canonical interest keys, returning hit counts. The core of
 * "learning who you are" — feed it your saved-place types + vibes + bio.
 */
export function detectInterests(signals: Array<string | undefined | null>): Map<string, number> {
  const hits = new Map<string, number>()
  const normed = signals.map(norm).filter(Boolean)
  for (const sig of normed) {
    for (const interest of INTERESTS) {
      // a signal matches an interest if any match-keyword appears in it (or it
      // appears in a keyword) — handles both "coffee" and "coffee shop".
      const matched = interest.match.some(k => sig.includes(k) || k.includes(sig))
      if (matched) hits.set(interest.key, (hits.get(interest.key) || 0) + 1)
    }
  }
  return hits
}

/** The interest keys a place embodies, from its types / category / tags. */
export function placeInterestKeys(place: {
  primaryType?: string | null
  types?: string[]
  category?: string
  tags?: string[]
  name?: string
}): Set<string> {
  const signals: Array<string | undefined> = [
    place.primaryType || undefined,
    place.category,
    place.name,
    ...(place.types || []),
    ...(place.tags || []),
  ]
  return new Set(detectInterests(signals).keys())
}

/** Detect aesthetic vibe KEYS implied by a set of signals (place types/tags/
 *  name, or the user's bio/vibes). Returns slug keys; map to display strings
 *  with vibeLabel(). The taste model accumulates these over time. */
export function detectVibes(signals: Array<string | undefined | null>): string[] {
  const normed = signals.map(norm).filter(Boolean)
  const out: string[] = []
  for (const vibe of VIBES) {
    // Match the vibe's own label/key too, so a signup chip like "cottagecore"
    // or "dark academia" maps directly (not just its trigger keywords).
    const terms = [vibe.label, vibe.key.replace(/_/g, ' '), ...vibe.match]
    if (terms.some(k => normed.some(s => s.includes(k) || k.includes(s)))) out.push(vibe.key)
  }
  return out
}

export function vibeLabel(key: string): string {
  return VIBE_BY_KEY[key]?.label || key.replace(/_/g, ' ')
}

export function interestLabel(key: string): string {
  return INTEREST_BY_KEY[key]?.label || key.replace(/_/g, ' ')
}

export function interestQuery(key: string): string | null {
  return INTEREST_BY_KEY[key]?.query || null
}

export function interestTypes(key: string): string[] {
  return INTEREST_BY_KEY[key]?.types || []
}
