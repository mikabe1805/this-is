/**
 * Chain restaurant/brand detection utilities
 * Helps filter out or penalize large chain establishments in favor of local businesses
 */

/**
 * Hard-banned chains - these are completely filtered out from suggestions
 * Major fast food chains that don't align with discovery platform values
 */
export const HARD_BANNED_CHAINS = [
  'mcdonald',
  'burger king',
  'taco bell',
  'kfc',
  'pizza hut',
  'domino',
  'papa john',
  'subway',
  'arby',
  'sonic',
  'jack in the box',
  'carl\'s jr',
  'hardee',
  'dairy queen',
  'white castle',
  'long john silver',
  'a&w',
].map(s => s.toLowerCase())

/**
 * Soft-penalized chains - allowed but deprioritized in ranking
 * Mid-tier chains that are less interesting but not completely filtered
 */
export const SOFT_PENALIZED_CHAINS = [
  'whole foods',
  'trader joe',
  'costco',
  'aldi',
  'cava',
  'sweetgreen',
  'insomnia cookies',
  'popeyes',
  'wendy',
  'little caesars',
  'shake shack',
  'starbucks',
  'dunkin',
  'chipotle',
  'panera',
  'five guys',
  'chick-fil-a',
  'chickfila',
].map(s => s.toLowerCase())

/**
 * Check if a place name matches a hard-banned chain
 * @param name Place name to check
 * @returns true if the place should be completely filtered out
 */
export function isHardBannedChain(name: string): boolean {
  if (!name) return false
  const normalized = name.toLowerCase().trim()
  return HARD_BANNED_CHAINS.some(chain => normalized.includes(chain))
}

/**
 * Check if a place name matches a soft-penalized chain
 * @param name Place name to check
 * @returns true if the place should be deprioritized in scoring
 */
export function isSoftPenalizedChain(name: string): boolean {
  if (!name) return false
  const normalized = name.toLowerCase().trim()
  return SOFT_PENALIZED_CHAINS.some(chain => normalized.includes(chain))
}

/**
 * Get the penalty score for a chain (for use in ranking algorithms)
 * @param name Place name to check
 * @returns Penalty value to subtract from score (0 = no penalty, >0 = penalize)
 */
export function getChainPenalty(name: string): number {
  const n = (name || '').toLowerCase().trim()

  // If the name is mostly non-Latin script, don't penalize it for language alone.
  // Only penalize when it explicitly matches a known chain token.
  try {
    const letters = n.match(/\p{L}/gu) || []
    const latin = n.match(/[a-z]/g) || []
    const latinRatio = letters.length > 0 ? latin.length / letters.length : 1
    const mostlyNonLatin = latinRatio < 0.3

    if (mostlyNonLatin) {
      if (isHardBannedChain(n)) return Infinity
      if (isSoftPenalizedChain(n)) return 0.35
      return 0
    }
  } catch {}

  if (isHardBannedChain(n)) {
    return Infinity // Should be filtered before scoring
  }
  if (isSoftPenalizedChain(n)) {
    return 0.35 // Soft penalty value
  }
  return 0
}
