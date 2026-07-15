import type { GroupMemberTaste } from './groupRecommendation.js'
import {
  resolveKnownOpenPlaceIds,
  type OwnedOpenPlace,
  type PlaceAlias,
} from './openCatalog.js'
import type { UserPlaceCategory } from './placeMemory.js'

export interface ExplicitPlanArea {
  label: string
  lat: number
  lng: number
  radiusKm: number
  provenance: 'explicit_plan'
}

export interface OpenDiscoveryCandidate {
  place: OwnedOpenPlace
  category: Extract<UserPlaceCategory, 'food' | 'drinks' | 'coffee' | 'activity'>
  distanceKm: number
  historyFitCount: number
  hintFitCount: number
  totalMembers: number
  reason: string
  sources: readonly ['Overture open catalog', 'Current group category evidence', 'Explicit plan area']
}

const COFFEE = new Set(['coffee_shop', 'cafe', 'tea_room', 'bakery'])
const DRINKS = new Set(['bar', 'wine_bar', 'cocktail_bar', 'brewery', 'beer_garden', 'pub'])
const ACTIVITY = new Set([
  'arts_and_entertainment', 'attractions_and_activities', 'active_life', 'museum', 'art_gallery',
  'gallery', 'movie_theater', 'theater', 'park', 'amusement_park', 'bowling_alley', 'escape_room',
])

function tokens(place: OwnedOpenPlace): Set<string> {
  return new Set([
    place.basicCategory,
    place.taxonomy?.primary,
    ...(place.taxonomy?.alternates ?? []),
    ...(place.taxonomy?.hierarchy ?? []),
  ].filter((value): value is string => Boolean(value)).map(value => value.toLowerCase()))
}

export function openPlaceCategory(place: OwnedOpenPlace): OpenDiscoveryCandidate['category'] | null {
  const values = tokens(place)
  if ([...values].some(value => COFFEE.has(value) || /coffee|cafe|tea_room/.test(value))) return 'coffee'
  if ([...values].some(value => DRINKS.has(value) || /(?:^|_)bar$|brewery|cocktail|wine_bar/.test(value))) return 'drinks'
  if (values.has('food_and_drink') || values.has('restaurant')
    || [...values].some(value => /restaurant|eatery|food_court/.test(value))) return 'food'
  if ([...values].some(value => ACTIVITY.has(value))) return 'activity'
  return null
}

function validArea(area: ExplicitPlanArea): boolean {
  return area.provenance === 'explicit_plan'
    && typeof area.label === 'string' && area.label.trim().length >= 2 && area.label.trim().length <= 120
    && Number.isFinite(area.lat) && area.lat >= -90 && area.lat <= 90
    && Number.isFinite(area.lng) && area.lng >= -180 && area.lng <= 180
    && Number.isFinite(area.radiusKm) && area.radiusKm >= 0.2 && area.radiusKm <= 50
}

function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const radians = (value: number) => value * Math.PI / 180
  const latDelta = radians(bLat - aLat)
  const lngDelta = radians(bLng - aLng)
  const x = Math.sin(latDelta / 2) ** 2
    + Math.cos(radians(aLat)) * Math.cos(radians(bLat)) * Math.sin(lngDelta / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

function memberCategoryHistory(member: GroupMemberTaste): Set<UserPlaceCategory> {
  return new Set(member.saves.flatMap(save =>
    save.visibility === 'circle' && save.memory && ['want', 'loved'].includes(save.tag)
      ? [save.memory.category]
      : []))
}

function categoryReason(category: OpenDiscoveryCandidate['category'], history: number, hints: number, total: number): string {
  if (history >= 2) return `New to this group · matches ${category} history from ${history} of ${total}.`
  return `New to this group · matches one member's ${category} history and ${hints === 1 ? "another's" : `${hints} others'`} ${category} hint${hints === 1 ? '' : 's'}.`
}

/**
 * Deterministic open-catalog retrieval for one explicitly chosen plan area.
 * Geography is a request input, never a user attribute or ranking fingerprint.
 * A hint alone cannot create a candidate; at least one current group-visible
 * Want/Love in the same broad category is required.
 */
export function buildOpenDiscoveryShortlist(input: {
  members: GroupMemberTaste[]
  places: OwnedOpenPlace[]
  area: ExplicitPlanArea
  knownPlaceIds?: ReadonlySet<string>
  placeAliases?: readonly PlaceAlias[]
  groupSensitiveCategoryOptIns?: ReadonlySet<'drinks'>
  limit?: number
}): OpenDiscoveryCandidate[] {
  if (input.members.length < 2 || input.members.length > 6) {
    throw new Error('Open discovery supports 2–6 current group members.')
  }
  if (!validArea(input.area)) throw new Error('Open discovery requires one explicit bounded plan area.')
  const limit = Math.max(0, Math.min(input.limit ?? 3, 3))
  const histories = new Map(input.members.map(member => [member.uid, memberCategoryHistory(member)]))
  const groupVisibleKnown = new Set(input.knownPlaceIds ?? [])
  input.members.forEach(member => member.saves.forEach(save => {
    if (save.visibility === 'circle') groupVisibleKnown.add(save.placeId)
  }))
  const known = resolveKnownOpenPlaceIds({
    knownPlaceIds: groupVisibleKnown,
    aliases: input.placeAliases,
  }).excludeOpenPlaceIds

  return input.places.flatMap(place => {
    if (known.has(place.id)) return []
    if (place.operatingStatus !== 'open') return []
    const category = openPlaceCategory(place)
    if (!category) return []
    if (category === 'drinks' && !input.groupSensitiveCategoryOptIns?.has('drinks')) return []
    const distance = distanceKm(input.area.lat, input.area.lng, place.lat, place.lng)
    if (distance > input.area.radiusKm) return []
    const historyFitCount = input.members.filter(member => histories.get(member.uid)?.has(category)).length
    const hintFitCount = input.members.filter(member =>
      !histories.get(member.uid)?.has(category)
      && member.quickStart?.categoryHints.includes(category as 'food' | 'coffee' | 'activity')).length
    if (historyFitCount < 1 || historyFitCount + hintFitCount < 2) return []
    return [{
      place,
      category,
      distanceKm: Math.round(distance * 10) / 10,
      historyFitCount,
      hintFitCount,
      totalMembers: input.members.length,
      reason: categoryReason(category, historyFitCount, hintFitCount, input.members.length),
      sources: ['Overture open catalog', 'Current group category evidence', 'Explicit plan area'] as const,
    }]
  }).sort((a, b) => {
    const totalFit = (b.historyFitCount + b.hintFitCount) - (a.historyFitCount + a.hintFitCount)
    if (totalFit) return totalFit
    const historyFit = b.historyFitCount - a.historyFitCount
    if (historyFit) return historyFit
    const distance = a.distanceKm - b.distanceKm
    if (distance) return distance
    const confidence = (b.place.confidence ?? 0) - (a.place.confidence ?? 0)
    return confidence || a.place.id.localeCompare(b.place.id)
  }).slice(0, limit)
}
