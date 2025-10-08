/**
 * Category poster system
 * Maps Google Places types to visual category posters (free, no API calls)
 */

export type PosterCategory =
  | 'coffee'
  | 'brunch'
  | 'restaurant'
  | 'dessert'
  | 'bar'
  | 'garden'
  | 'park'
  | 'museum'
  | 'book'
  | 'hiking'
  | 'music'
  | 'cinema'
  | 'nightlife'
  | 'default';

// Map Google Places types to our poster categories
const typeMap: Record<string, PosterCategory> = {
  // Coffee & Cafe
  cafe: 'coffee',
  coffee_shop: 'coffee',
  
  // Food
  brunch_restaurant: 'brunch',
  breakfast_restaurant: 'brunch',
  restaurant: 'restaurant',
  bakery: 'dessert',
  dessert_shop: 'dessert',
  ice_cream_shop: 'dessert',
  
  // Drinks
  bar: 'bar',
  night_club: 'nightlife',
  wine_bar: 'bar',
  cocktail_bar: 'bar',
  
  // Nature
  park: 'park',
  garden: 'garden',
  botanical_garden: 'garden',
  hiking_area: 'hiking',
  trail: 'hiking',
  natural_feature: 'hiking',
  
  // Culture
  museum: 'museum',
  art_gallery: 'museum',
  book_store: 'book',
  library: 'book',
  movie_theater: 'cinema',
  performing_arts_theater: 'music',
  music_venue: 'music',
  concert_hall: 'music',
};

export function categoryFromTypes(types: string[] = []): PosterCategory {
  for (const t of types) {
    if (typeMap[t]) return typeMap[t];
  }
  return 'default';
}

export function categoryColor(category: PosterCategory): string {
  const colors: Record<PosterCategory, string> = {
    coffee: '#A67C52',
    brunch: '#F4A460',
    restaurant: '#E07A5F',
    dessert: '#F2CC8F',
    bar: '#81B29A',
    garden: '#5BA679',
    park: '#6B9F82',
    museum: '#7D7ABC',
    book: '#9D8A7F',
    hiking: '#77A077',
    music: '#C49A5E',
    cinema: '#6A7FDB',
    nightlife: '#9B7EDE',
    default: '#A0A0A0',
  };
  return colors[category];
}

