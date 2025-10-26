/**
 * Smart Suggestions Engine
 * Handles place suggestion rotation, novelty tracking, diversity, and progressive radius expansion
 *
 * Core Features:
 * - Single location-scoped memory store with per-key TTL (6h)
 * - Progressive radius expansion on each refresh
 * - Ring-based geographic diversity (distance bands)
 * - Neighborhood and type diversity caps
 * - Constraint relaxation as pool depletes
 */

import { stablePlaceKey } from '../utils/stablePlaceKey'
import { kmBetweenPoints, type LatLng } from '../utils/distance'
import { getChainPenalty } from '../utils/chainDetection'

// Version marker to verify code reload
console.log('[CODE VERSION] suggestionsEngine.ts loaded at 2025-10-26T03:15:00Z')

// ============================================================================
// Types
// ============================================================================

export interface Candidate {
  // From API
  placeId?: string | null
  place_id?: string | null
  id?: string | null
  name?: string | null
  address?: string | null
  coordinates?: { lat?: number; lng?: number } | null
  types?: string[] | null
  rating?: number | null
  userRatingsTotal?: number | null
  priceLevel?: number | null
  mainImage?: string | null
  photos?: any[] | null

  // Computed by engine (don't pass these in)
  __key?: string
  __km?: number
  __score?: number
}

export interface EngineOptions {
  /** Where the user is located */
  userLoc: LatLng

  /** User's preferred tags/interests (for scoring) */
  userInterests?: string[]

  /** Places that already exist in the system (to exclude) */
  knownKeys?: Set<string>

  /** User-suppressed suggestions (to exclude) */
  suppressedKeys?: Set<string>

  /** Keys currently visible in the rail (to avoid immediate duplicates) */
  recentRailKeys?: Set<string>

  /** Storage for persistence (usually sessionStorage) */
  storage: Storage

  /** History of radii used in this session (for expansion logic) */
  radiusHistory?: number[]

  /** How many suggestions to return */
  count?: number

  /** TTL for seen items in hours */
  ttlHours?: number

  /** Max items to remember */
  maxMemory?: number
}

export interface PickResult {
  /** Selected candidates with __key, __km, __score populated */
  picked: Candidate[]

  /** Next radius to use for expansion */
  nextRadius: number

  /** Whether to expand radius on next refresh */
  shouldExpand: boolean

  /** Current memory size */
  memorySize: number

  /** Debug info */
  debug: {
    candidatesTotal: number
    candidatesNovel: number
    candidatesFiltered: number
    round: number
  }
}

interface MemoryEntry {
  key: string
  timestamp: number
}

interface MemoryPayload {
  entries: MemoryEntry[]
  version: number
}

// ============================================================================
// Suggestions Engine Class
// ============================================================================

export class SuggestionsEngine {
  private userLoc: LatLng
  private userInterests: string[]
  private knownKeys: Set<string>
  private suppressedKeys: Set<string>
  private recentRailKeys: Set<string>
  private storage: Storage
  private radiusHistory: number[]
  private count: number
  private ttlMs: number
  private maxMemory: number
  private scopeKey: string
  private memory: Map<string, number> // key → timestamp

  constructor(options: EngineOptions) {
    this.userLoc = options.userLoc
    this.userInterests = (options.userInterests || []).map(s => s.toLowerCase())
    this.knownKeys = options.knownKeys || new Set()
    this.suppressedKeys = options.suppressedKeys || new Set()
    this.recentRailKeys = options.recentRailKeys || new Set()
    this.storage = options.storage
    this.radiusHistory = options.radiusHistory || []
    this.count = options.count || 12
    this.ttlMs = (options.ttlHours || 6) * 3600 * 1000
    this.maxMemory = options.maxMemory || 300

    // Ultra-stable scope key (location only, ~1km precision)
    const latBucket = this.userLoc.lat.toFixed(2)
    const lngBucket = this.userLoc.lng.toFixed(2)
    this.scopeKey = `suggested_seen_v3_${latBucket}_${lngBucket}`

    // Load memory from storage
    this.memory = this.hydrate()
  }

  /**
   * Pick the best candidates for display
   */
  pick(candidates: Candidate[]): PickResult {
    const round = this.radiusHistory.length
    const now = Date.now()

    console.log('[engine:pick] Starting', {
      inputCount: candidates.length,
      memorySize: this.memory.size,
      knownKeysSize: this.knownKeys.size,
      suppressedSize: this.suppressedKeys.size
    })

    // 1. Normalize and compute distance/key for all candidates
    const normalized = candidates
      .map(p => {
        const key = stablePlaceKey(p)
        if (!key) {
          console.warn('[engine:pick] No key for candidate', { name: p.name })
          return null
        }

        const lat = p.coordinates?.lat
        const lng = p.coordinates?.lng
        if (typeof lat !== 'number' || typeof lng !== 'number') {
          console.warn('[engine:pick] No coordinates for', { name: p.name, coords: p.coordinates })
          return null
        }

        const km = kmBetweenPoints(this.userLoc, { lat, lng })

        return {
          ...p,
          __key: key,
          __km: km,
        } as Candidate
      })
      .filter(Boolean) as Candidate[]

    const candidatesTotal = normalized.length

    console.log('[engine:pick] After normalize', {
      normalized: candidatesTotal,
      dropped: candidates.length - candidatesTotal,
      sample: normalized[0] ? {
        name: normalized[0].name,
        key: normalized[0].__key?.substring(0, 20),
        km: normalized[0].__km?.toFixed(1)
      } : null
    })

    // 2. Filter out known, suppressed, and expired items
    const filtered = normalized.filter(p => {
      // Exclude known and suppressed
      if (this.knownKeys.has(p.__key!)) return false
      if (this.suppressedKeys.has(p.__key!)) return false

      // Note: We don't filter out served items here - they just get lower scores
      return true
    })

    const candidatesFiltered = filtered.length

    console.log('[engine:pick] After filter', {
      filtered: candidatesFiltered,
      removedKnown: normalized.length - candidatesFiltered,
      sample: filtered[0] ? {
        name: filtered[0].name,
        key: filtered[0].__key?.substring(0, 20),
        km: filtered[0].__km?.toFixed(1)
      } : null
    })

    // 3. De-dupe by __key
    const seen = new Set<string>()
    const deduped = filtered.filter(p => {
      if (seen.has(p.__key!)) return false
      seen.add(p.__key!)
      return true
    })

    console.log('[engine:pick] After dedupe', {
      deduped: deduped.length,
      duplicatesRemoved: filtered.length - deduped.length
    })

    // 4. Score all candidates
    const scored = deduped.map(p => this.scoreCandidate(p, round))

    console.log('[engine:pick] After scoring', {
      scored: scored.length,
      topScores: scored.slice(0, 3).map(p => ({
        name: p.name,
        score: p.__score?.toFixed(2),
        km: p.__km?.toFixed(1)
      }))
    })

    // 5. Count novel vs served
    const novel = scored.filter(p => !this.isServed(p.__key!))
    const candidatesNovel = novel.length

    console.log('[engine:pick] Novel vs served', {
      novel: candidatesNovel,
      served: scored.length - candidatesNovel,
      memorySize: this.memory.size,
      memoryKeys: Array.from(this.memory.keys()).slice(0, 5).map(k => k.substring(0, 20)),
      memorySample: Array.from(this.memory.entries()).slice(0, 3).map(([k, ts]) => ({
        key: k.substring(0, 20),
        age: ((now - ts) / (1000 * 60 * 60)).toFixed(1) + 'h'
      }))
    })

    // 6. Apply diversity selection
    console.log('[engine:pick] Calling selectDiverse with', scored.length, 'candidates')
    const selected = this.selectDiverse(scored, round)
    console.log('[engine:pick] selectDiverse returned', selected.length, 'items')

    console.log('[engine:pick] After diversity selection', {
      selected: selected.length,
      selectedSample: selected.slice(0, 3).map(p => ({
        name: p.name,
        km: p.__km?.toFixed(1),
        score: p.__score?.toFixed(2),
        key: p.__key?.substring(0, 15)
      }))
    })

    // 7. Update memory with selected items
    for (const p of selected) {
      this.memory.set(p.__key!, now)
    }
    this.persist()

    console.log('[engine:pick] Memory updated', {
      memorySize: this.memory.size,
      newlyAdded: selected.length
    })

    // 8. Determine next radius
    const nextRadius = this.calculateNextRadius(candidatesNovel)
    const shouldExpand = candidatesNovel < 6

    const result = {
      picked: selected.slice(0, this.count),
      nextRadius,
      shouldExpand,
      memorySize: this.memory.size,
      debug: {
        candidatesTotal,
        candidatesNovel,
        candidatesFiltered,
        round,
      },
    }

    console.log('[engine:pick] Final result', {
      pickedCount: result.picked.length,
      nextRadius: result.nextRadius.toFixed(1),
      shouldExpand: result.shouldExpand,
      pickedSample: result.picked.slice(0, 2).map(p => ({
        name: p.name,
        km: p.__km?.toFixed(1),
        hasKey: !!p.__key,
        hasKm: typeof p.__km === 'number'
      }))
    })

    return result
  }

  /**
   * Score a candidate place
   */
  private scoreCandidate(p: Candidate, round: number): Candidate {
    const types = (p.types || []).map(t => (t || '').toLowerCase())

    // Tag similarity (user interests match)
    const tagSim = this.calculateTagSimilarity(this.userInterests, types)

    // Distance score (closer is better, but gentle falloff)
    const distScore = 1 / (1 + ((p.__km || 0) / 8))

    // Rating score
    const rating = Math.max(0, Math.min(5, p.rating || 0))
    const reviews = Math.min(300, p.userRatingsTotal || 0) / 300
    const ratingScore = (rating / 5) * 0.7 + reviews * 0.3

    // Price level score (prefer moderate pricing)
    const priceLevel = p.priceLevel
    const priceScore =
      typeof priceLevel === 'number'
        ? (3 - Math.abs(2 - priceLevel)) / 3
        : 0.4

    // Novelty bonus (not in recent rail, not served yet)
    const isInRail = this.recentRailKeys.has(p.__key!)
    const isServed = this.isServed(p.__key!)
    const noveltyBonus = !isInRail && !isServed ? 0.5 : 0

    // Chain penalty
    const chainPenalty = getChainPenalty(p.name || '')

    // Served penalty (deprioritize but don't block)
    const servedPenalty = isServed ? 0.55 : 0

    // Progressive constraint relaxation
    // Round 1-2: Strict interest matching
    // Round 3+: More permissive
    const interestWeight = round <= 2 ? 1.2 : 0.8
    const noveltyWeight = round <= 2 ? 0.5 : 0.3

    const score =
      interestWeight * tagSim +
      0.8 * distScore +
      0.7 * ratingScore +
      0.3 * priceScore +
      noveltyWeight * noveltyBonus -
      chainPenalty -
      servedPenalty

    return { ...p, __score: score }
  }

  /**
   * Calculate tag similarity between user interests and place types
   */
  private calculateTagSimilarity(userTags: string[], placeTags: string[]): number {
    if (!userTags.length || !placeTags.length) return 0

    const userSet = new Set(userTags)
    let matches = 0

    for (const tag of placeTags) {
      if (userSet.has(tag)) matches++
    }

    // Conservative: require good match ratio
    return Math.min(1, matches / Math.max(3, placeTags.length))
  }

  /**
   * Select diverse candidates using ring quotas and caps
   */
  private selectDiverse(scored: Candidate[], round: number): Candidate[] {
    // Distance rings (in km)
    const rings = [
      { min: 0, max: 2, quota: 2 },
      { min: 2, max: 5, quota: 3 },
      { min: 5, max: 10, quota: 3 },
      { min: 10, max: 25, quota: 3 },
      { min: 25, max: 999, quota: 3 },
    ]

    // Split novel vs served
    const novel = scored.filter(p => !this.isServed(p.__key!))
    const served = scored.filter(p => this.isServed(p.__key!))

    // If we have enough novel items, ONLY use novel items (force freshness)
    const useOnlyNovel = novel.length >= this.count

    console.log('[engine:selectDiverse] Strategy', {
      novel: novel.length,
      served: served.length,
      count: this.count,
      useOnlyNovel,
      novelSample: novel.slice(0, 3).map(p => ({ name: p.name, km: p.__km?.toFixed(1), score: p.__score?.toFixed(2) })),
      servedSample: served.slice(0, 3).map(p => ({ name: p.name, km: p.__km?.toFixed(1), score: p.__score?.toFixed(2) }))
    })
    // Mixed mode: prioritize novel items first, then backfill served
    if (!useOnlyNovel) {
      console.log('[engine:selectDiverse] Mixed mode: prioritize novel, backfill served')

      const novelSorted = [...novel].sort((a, b) => (b.__score || 0) - (a.__score || 0))
      const servedSorted = [...served].sort((a, b) => (b.__score || 0) - (a.__score || 0))

      const RELAXED_NB_CAP = 4
      const RELAXED_TYPE_CAP = 6
      const NB_CAP = 2
      const TYPE_CAP = 3

      const neighborhoodCount = new Map<string, number>()
      const typeCount = new Map<string, number>()
      const selected: Candidate[] = []

      // Phase 1: take as many novel items as possible (relaxed caps, ignore ring quotas)
      for (const p of novelSorted) {
        if (selected.length >= this.count) break
        const lat = p.coordinates?.lat
        const lng = p.coordinates?.lng
        const nb = this.neighborhoodBucket(lat, lng)
        const primaryType = String(p.types?.[0] || 'other').toLowerCase()

        const nbCount = neighborhoodCount.get(nb) || 0
        const tCount = typeCount.get(primaryType) || 0
        if (nbCount >= RELAXED_NB_CAP) continue
        if (tCount >= RELAXED_TYPE_CAP) continue

        neighborhoodCount.set(nb, nbCount + 1)
        typeCount.set(primaryType, tCount + 1)
        selected.push(p)
      }

      // Phase 2: backfill with served under normal caps
      if (selected.length < this.count) {
        for (const p of servedSorted) {
          if (selected.length >= this.count) break
          if (selected.find(s => s.__key === p.__key)) continue
          if (this.recentRailKeys.has(p.__key!)) continue

          const lat = p.coordinates?.lat
          const lng = p.coordinates?.lng
          const nb = this.neighborhoodBucket(lat, lng)
          const primaryType = String(p.types?.[0] || 'other').toLowerCase()

          const nbCount = neighborhoodCount.get(nb) || 0
          const tCount = typeCount.get(primaryType) || 0
          if (nbCount >= NB_CAP) continue
          if (tCount >= TYPE_CAP) continue

          neighborhoodCount.set(nb, nbCount + 1)
          typeCount.set(primaryType, tCount + 1)
          selected.push(p)
        }
      }

      const finalNovelCount = selected.filter(p => !this.isServed(p.__key!)).length
      console.log('[engine:selectDiverse] Final selection', {
        total: selected.length,
        novel: finalNovelCount,
        served: selected.length - finalNovelCount,
        items: selected.map(p => ({ name: p.name, km: p.__km?.toFixed(1), isNovel: !this.isServed(p.__key!) }))
      })
      return selected
    }

    // Sort each group by score
    const sorted = useOnlyNovel
      ? novel.sort((a, b) => (b.__score || 0) - (a.__score || 0))
      : [
          ...novel.sort((a, b) => (b.__score || 0) - (a.__score || 0)),
          ...served.sort((a, b) => (b.__score || 0) - (a.__score || 0)),
        ]

    console.log('[engine:selectDiverse] After sorting', {
      sortedCount: sorted.length,
      firstThree: sorted.slice(0, 3).map(p => ({
        name: p.name,
        km: p.__km?.toFixed(1),
        score: p.__score?.toFixed(2),
        isNovel: !this.isServed(p.__key!)
      }))
    })

    // Track diversity
    const neighborhoodCount = new Map<string, number>()
    const typeCount = new Map<string, number>()
    const perNeighborhoodCap = 2
    const perTypeCap = 3

    // Fill rings
    const ringBuckets = rings.map(r => ({ ...r, items: [] as Candidate[] }))

    for (const p of sorted) {
      const ring = ringBuckets.find(
        r => (p.__km || 999) >= r.min && (p.__km || 999) < r.max
      )
      if (!ring) continue

      const lat = p.coordinates?.lat
      const lng = p.coordinates?.lng
      const nb = this.neighborhoodBucket(lat, lng)
      const primaryType = String(p.types?.[0] || 'other').toLowerCase()

      const nbCount = neighborhoodCount.get(nb) || 0
      const tCount = typeCount.get(primaryType) || 0

      // Enforce caps
      if (nbCount >= perNeighborhoodCap) continue
      if (tCount >= perTypeCap) continue

      neighborhoodCount.set(nb, nbCount + 1)
      typeCount.set(primaryType, tCount + 1)
      ring.items.push(p)
    }

    // Collect from rings up to quota
    const selected: Candidate[] = []
    for (const ring of ringBuckets) {
      for (const p of ring.items) {
        if (selected.length >= this.count) break
        if (selected.length < ring.quota) {
          selected.push(p)
        }
      }
    }

    // Backfill if needed (respecting caps)
    if (selected.length < this.count) {
      for (const p of sorted) {
        if (selected.length >= this.count) break
        if (selected.find(s => s.__key === p.__key)) continue

        // Re-check caps for backfill
        const lat = p.coordinates?.lat
        const lng = p.coordinates?.lng
        const nb = this.neighborhoodBucket(lat, lng)
        const primaryType = String(p.types?.[0] || 'other').toLowerCase()

        const nbCount = neighborhoodCount.get(nb) || 0
        const tCount = typeCount.get(primaryType) || 0

        if (nbCount >= perNeighborhoodCap) continue
        if (tCount >= perTypeCap) continue

        neighborhoodCount.set(nb, nbCount + 1)
        typeCount.set(primaryType, tCount + 1)
        selected.push(p)
      }
    }

    // Final backfill for useOnlyNovel path: relax caps to allow clustered novel results to fill to count
    if (useOnlyNovel && selected.length < this.count) {
      const RELAXED_NB_CAP = 4
      const RELAXED_TYPE_CAP = 6
      const novelSorted = [...novel].sort((a, b) => (b.__score || 0) - (a.__score || 0))
      for (const p of novelSorted) {
        if (selected.length >= this.count) break
        if (selected.find(s => s.__key === p.__key)) continue

        const lat = p.coordinates?.lat
        const lng = p.coordinates?.lng
        const nb = this.neighborhoodBucket(lat, lng)
        const primaryType = String(p.types?.[0] || 'other').toLowerCase()

        const nbCount = neighborhoodCount.get(nb) || 0
        const tCount = typeCount.get(primaryType) || 0

        if (nbCount >= RELAXED_NB_CAP) continue
        if (tCount >= RELAXED_TYPE_CAP) continue

        neighborhoodCount.set(nb, nbCount + 1)
        typeCount.set(primaryType, tCount + 1)
        selected.push(p)
      }
    }

    const finalNovelCount = selected.filter(p => !this.isServed(p.__key!)).length
    console.log('[engine:selectDiverse] Final selection', {
      total: selected.length,
      novel: finalNovelCount,
      served: selected.length - finalNovelCount,
      items: selected.map(p => ({
        name: p.name,
        km: p.__km?.toFixed(1),
        isNovel: !this.isServed(p.__key!)
      }))
    })

    return selected
  }

  /**
   * Create neighborhood bucket for diversity
   * 0.02 degree precision ≈ 2.2 km
   */
  private neighborhoodBucket(lat?: number, lng?: number): string {
    if (typeof lat !== 'number' || typeof lng !== 'number') return 'unknown'
    return `${lat.toFixed(2)},${lng.toFixed(2)}`
  }

  /**
   * Check if a key has been served and is still within TTL
   */
  private isServed(key: string): boolean {
    const timestamp = this.memory.get(key)
    if (!timestamp) return false

    const age = Date.now() - timestamp
    return age < this.ttlMs
  }

  /**
   * Calculate next radius for progressive expansion
   */
  private calculateNextRadius(novelCount: number): number {
    const round = this.radiusHistory.length
    const baseRadius = this.radiusHistory[0] || 40

    // If we have plenty of novel items, don't expand
    if (novelCount >= 8) {
      return baseRadius
    }

    // Progressive expansion: 1.0x → 1.3x → 1.6x → 2.0x → 2.5x
    const expansionFactors = [1.0, 1.3, 1.6, 2.0, 2.5]
    const factor = expansionFactors[Math.min(round, expansionFactors.length - 1)]

    return Math.min(baseRadius * factor, 150) // Cap at 150km
  }

  /**
   * Load memory from storage
   */
  private hydrate(): Map<string, number> {
    try {
      const raw = this.storage.getItem(this.scopeKey)
      if (!raw) return new Map()

      const payload = JSON.parse(raw) as MemoryPayload
      if (!payload || payload.version !== 3) return new Map()

      const map = new Map<string, number>()
      const now = Date.now()

      for (const entry of payload.entries) {
        const age = now - entry.timestamp
        // Only restore items within TTL
        if (age < this.ttlMs) {
          map.set(entry.key, entry.timestamp)
        }
      }

      console.log(`[suggestionsEngine:hydrate] Loaded ${map.size} items from ${this.scopeKey}`)
      return map
    } catch (error) {
      console.warn('[suggestionsEngine:hydrate] Failed to load memory', error)
      return new Map()
    }
  }

  /**
   * Persist memory to storage
   */
  private persist(): void {
    try {
      // Convert to array and sort by timestamp (oldest first)
      const entries: MemoryEntry[] = Array.from(this.memory.entries())
        .map(([key, timestamp]) => ({ key, timestamp }))
        .sort((a, b) => a.timestamp - b.timestamp)

      // Keep only the most recent maxMemory items
      const trimmed = entries.slice(-this.maxMemory)

      const payload: MemoryPayload = {
        entries: trimmed,
        version: 3,
      }

      this.storage.setItem(this.scopeKey, JSON.stringify(payload))

      // Update in-memory map
      this.memory = new Map(trimmed.map(e => [e.key, e.timestamp]))

      console.log(`[suggestionsEngine:persist] Saved ${trimmed.length} items to ${this.scopeKey}`)
    } catch (error) {
      console.warn('[suggestionsEngine:persist] Failed to save memory', error)
    }
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate base radius from user preferences and filters
 */
export function calculateBaseRadius(
  userPreferences: any,
  filters: any
): number {
  // Check for explicit filter
  if (typeof filters.distanceKm === 'number') {
    return filters.distanceKm
  }

  // Check user's profile preference (miles → km)
  const milesPreferred = userPreferences?.locationPreferences?.nearbyRadius
  if (typeof milesPreferred === 'number' && milesPreferred > 0) {
    return milesPreferred * 1.60934
  }

  // Default: 80km (~50 miles)
  return 80
}

/**
 * Build a ring filter for requesting only new geographic areas
 * Returns { minKm, maxKm } for the NEW ring to search
 */
export function calculateRingFilter(radiusHistory: number[]): {
  minKm: number
  maxKm: number
} | null {
  if (radiusHistory.length < 2) return null

  const previousRadius = radiusHistory[radiusHistory.length - 2]
  const currentRadius = radiusHistory[radiusHistory.length - 1]

  return {
    minKm: previousRadius,
    maxKm: currentRadius,
  }
}
