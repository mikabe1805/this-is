/** Durable provider-derived place catalogs are retired. */
import type { PlaceDoc } from './types'

/** Reserved for a future reviewed owned/open catalog with explicit provenance. */
export async function fetchCatalog(): Promise<PlaceDoc[]> {
  return []
}
