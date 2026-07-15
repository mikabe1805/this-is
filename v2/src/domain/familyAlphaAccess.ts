export type FamilyAlphaGateState = 'checking' | 'pending' | null

type GateableSessionStatus =
  | 'unknown'
  | 'access-checking'
  | 'access-pending'
  | 'signed-out'
  | 'signed-in'

export function isFamilyAlphaRelease(releaseChannel: string | undefined): boolean {
  return releaseChannel === 'family-alpha'
}

/** Only the exact reviewed boolean claim admits a family-alpha identity. */
export function hasFamilyAlphaAccess(
  claims: Readonly<Record<string, unknown>> | undefined,
): boolean {
  return Boolean(
    claims
      && Object.prototype.hasOwnProperty.call(claims, 'familyAlpha')
      && claims.familyAlpha === true,
  )
}

/**
 * The family build withholds every data-capable route until access resolves.
 * Canonical/emulator channels and signed-out sign-in surfaces are unchanged.
 */
export function familyAlphaGateState(
  releaseChannel: string | undefined,
  sessionStatus: GateableSessionStatus,
): FamilyAlphaGateState {
  if (!isFamilyAlphaRelease(releaseChannel)) return null
  if (sessionStatus === 'unknown' || sessionStatus === 'access-checking') return 'checking'
  if (sessionStatus === 'access-pending') return 'pending'
  return null
}
