import { parseGoogleMapsUrl, type MapsUrlResult } from '../domain/mapsUrl'
import { auth } from './firebaseImpl'

/** Resolve an opaque Google-owned short link through the authenticated,
 * allowlisted v2 endpoint, then parse the resulting long URL locally. */
export async function resolveGoogleMapsInput(input: string): Promise<MapsUrlResult> {
  const parsed = parseGoogleMapsUrl(input)
  if (parsed.kind !== 'short-link') return parsed
  const user = auth.currentUser
  if (!user) return { kind: 'invalid', reason: 'no-place-identity' }
  const token = await user.getIdToken()
  const response = await fetch('/resolveMapsUrl', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url: parsed.url }),
  })
  if (!response.ok) return { kind: 'invalid', reason: 'no-place-identity' }
  const payload = await response.json() as { finalUrl?: unknown }
  return typeof payload.finalUrl === 'string'
    ? parseGoogleMapsUrl(payload.finalUrl)
    : { kind: 'invalid', reason: 'no-place-identity' }
}
