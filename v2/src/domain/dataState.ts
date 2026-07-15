/** Stable interpretation of backend failures at the product boundary. */
export function isPermissionDeniedError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const code = 'code' in error ? String(error.code).toLowerCase() : ''
  return code === 'permission-denied' || code.endsWith('/permission-denied')
}
