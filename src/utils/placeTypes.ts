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
