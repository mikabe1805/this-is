import { auth } from '../lib/firebaseImpl'

export interface BudgetedPhoto {
  blob: Blob
  attribution?: string
  sourceUri: string
}

/** One dark-by-default switch for every server-budgeted photo surface. The
 * historical env name is retained so existing reviewed configuration does not
 * silently change meaning. */
export const budgetedPhotosEnabled = import.meta.env.VITE_GROUP_PHOTOS_ENABLED === 'true'
export const groupPhotosEnabled = budgetedPhotosEnabled

function decodedHeader(response: Response, name: string): string | undefined {
  const value = response.headers.get(name)
  if (!value) return undefined
  try { return decodeURIComponent(value) } catch { return undefined }
}

function safeGoogleSource(value: string | undefined): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    const host = url.hostname.toLowerCase()
    return url.protocol === 'https:' && (host === 'google.com' || host.endsWith('.google.com'))
      ? url.toString()
      : null
  } catch {
    return null
  }
}

async function fetchBudgetedPhoto(
  body: { groupId?: string; placeId: string },
  signal?: AbortSignal,
): Promise<BudgetedPhoto | null> {
  const user = auth.currentUser
  if (!budgetedPhotosEnabled || !user) return null
  const response = await fetch('/placePhoto', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${await user.getIdToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal,
  })
  if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) return null
  const sourceUri = safeGoogleSource(decodedHeader(response, 'X-Photo-Source'))
  if (!sourceUri) return null
  return {
    blob: await response.blob(),
    attribution: decodedHeader(response, 'X-Photo-Attribution'),
    sourceUri,
  }
}

export function fetchGroupPhoto(groupId: string, placeId: string, signal?: AbortSignal) {
  return fetchBudgetedPhoto({ groupId, placeId }, signal)
}

export function fetchSavedPlacePhoto(placeId: string, signal?: AbortSignal) {
  return fetchBudgetedPhoto({ placeId }, signal)
}
