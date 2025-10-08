/**
 * Maps Google Place types to poster categories
 */

export type PosterCategory = 'coffee' | 'park' | 'restaurant' | 'museum' | 'library' | 'default'

const TYPE_TO_POSTER: Record<string, PosterCategory> = {
  // Coffee & Cafe
  'cafe': 'coffee',
  'coffee_shop': 'coffee',
  'coffee': 'coffee',
  'bakery': 'coffee',
  
  // Parks & Outdoors
  'park': 'park',
  'botanical_garden': 'park',
  'garden': 'park',
  'nature_preserve': 'park',
  'tourist_attraction': 'park',
  'hiking_area': 'park',
  'campground': 'park',
  
  // Restaurants & Food
  'restaurant': 'restaurant',
  'food': 'restaurant',
  'meal_delivery': 'restaurant',
  'meal_takeaway': 'restaurant',
  'brunch_restaurant': 'restaurant',
  'vegan_restaurant': 'restaurant',
  'vegetarian_restaurant': 'restaurant',
  'american_restaurant': 'restaurant',
  'italian_restaurant': 'restaurant',
  'chinese_restaurant': 'restaurant',
  'japanese_restaurant': 'restaurant',
  'mexican_restaurant': 'restaurant',
  'pizza_restaurant': 'restaurant',
  'bar': 'restaurant',
  'night_club': 'restaurant',
  
  // Museums & Culture
  'museum': 'museum',
  'art_gallery': 'museum',
  'cultural_center': 'museum',
  'historical_landmark': 'museum',
  'performing_arts_theater': 'museum',
  'movie_theater': 'museum',
  'zoo': 'museum',
  'aquarium': 'museum',
  
  // Libraries & Books
  'library': 'library',
  'book_store': 'library',
  'university': 'library',
  'school': 'library',
}

export function categoryFromTypes(types: string[] = []): PosterCategory {
  for (const type of types) {
    const category = TYPE_TO_POSTER[type.toLowerCase()]
    if (category) return category
  }
  return 'default'
}

export function getPosterPath(category: PosterCategory): string {
  return `/src/assets/posters/${category}.svg`
}

export function humanizeTag(tag: string): string {
  return tag
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

