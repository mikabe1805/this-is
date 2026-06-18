import type { List } from '../types/index.js'
import { formatDateRange } from './dateUtils'

/**
 * Is this list one of the auto-maintained status collections (All Loved / Tried
 * / Want)? Those are system-managed and must never be turned into trips or shown
 * with a custom badge. Canonical check (matches Profile / SaveModal / the
 * service): the `autoStatus` field, the `#auto-generated` tag, or the name.
 */
export function isAutoStatusList(list: Pick<List, 'autoStatus' | 'tags' | 'name'> | null | undefined): boolean {
  if (!list) return false
  if (list.autoStatus) return true
  const tags = list.tags || []
  if (tags.includes('auto-generated') || tags.includes('#auto-generated')) return true
  const n = (list.name || '').trim().toLowerCase()
  return n === 'all loved' || n === 'all tried' || n === 'all want'
}

/**
 * The trip date-range label to show for a list, or '' when it shouldn't show one
 * (not a trip, no start date, or an auto status-list). One call site for every
 * display surface so a stray auto-list can never render a fake date.
 */
export function tripBadge(list: Pick<List, 'isTrip' | 'tripStart' | 'tripEnd' | 'autoStatus' | 'tags' | 'name'> | null | undefined): string {
  if (!list?.isTrip || !list.tripStart || isAutoStatusList(list)) return ''
  return formatDateRange(list.tripStart, list.tripEnd)
}
