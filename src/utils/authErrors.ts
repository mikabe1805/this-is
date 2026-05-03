/**
 * Map Firebase auth error codes to user-friendly messages. Surfaces actionable
 * copy ("No account with that email") instead of leaking codes or showing a
 * generic "something went wrong" — both of which leave the user stuck.
 */
export function authErrorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const code = (err as { code?: string } | null)?.code || ''
  switch (code) {
    case 'auth/invalid-email':
      return 'That email address doesn\'t look right.'
    case 'auth/user-disabled':
      return 'This account has been disabled. Contact support if you think this is a mistake.'
    case 'auth/user-not-found':
      return 'No account found with that email.'
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Email or password is incorrect.'
    case 'auth/too-many-requests':
      return 'Too many attempts. Try again in a few minutes, or reset your password.'
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Try signing in instead.'
    case 'auth/weak-password':
      return 'Password should be at least 6 characters.'
    case 'auth/network-request-failed':
      return 'Network error. Check your connection and try again.'
    case 'auth/popup-closed-by-user':
      return 'Sign-in was cancelled.'
    case 'auth/requires-recent-login':
      return 'Please sign in again to continue.'
    default:
      return fallback
  }
}
