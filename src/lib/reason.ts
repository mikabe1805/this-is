/**
 * "Why this?" reasoning engine
 * Provides intelligent, truthful explanations for why a place is suggested.
 * Never invents fake reasons - only shows real tag overlaps or contextual info.
 */

export interface ReasonContext {
  userTags: Set<string>;
  friendTags: Set<string>;
  nearby: boolean;
}

export function reasonFor(
  place: { types?: string[]; primaryType?: string },
  ctx: ReasonContext
): string | null {
  const placeTypes = place.types || [];
  
  // Check for direct tag overlap (strongest signal)
  const matchingTags = placeTypes.filter(t => ctx.userTags.has(t));
  
  if (matchingTags.length >= 2) {
    return `Because you like #${formatType(matchingTags[0])} • #${formatType(matchingTags[1])}`;
  }
  
  if (matchingTags.length === 1) {
    return `Because you like #${formatType(matchingTags[0])}`;
  }
  
  // Check for friend popularity
  const friendMatches = placeTypes.filter(t => ctx.friendTags.has(t));
  if (friendMatches.length > 0 && ctx.friendTags.size >= 3) {
    return `Popular with friends`;
  }
  
  // Location-based
  if (ctx.nearby) {
    return `Nearby`;
  }
  
  // No strong reason - return null and let UI decide whether to show generic "For you" or nothing
  return null;
}

function formatType(type: string): string {
  // Convert snake_case API types to readable tags
  return type
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

