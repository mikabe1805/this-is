/**
 * First-run gate: a signed-in user who has never picked their vibes gets sent
 * to onboarding once, and only from the home landing — never hijacking a deep
 * link (a shared spot page, an /i/ invite) mid-flight. Onboarding writes
 * `onboardedAt`, so this fires exactly once per account.
 *
 * Lives in its own lazily-imported module: it needs `useUserDoc` (→ Firestore),
 * so keeping it out of the entry chunk is what preserves the <150kB entry gate.
 */
import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useSession } from '../state/session'
import { useUserDoc } from '../data/queries'

export default function OnboardingGate() {
  const session = useSession()
  const { data: userDoc, isLoading, isFetching } = useUserDoc()
  const location = useLocation()
  const navigate = useNavigate()
  // One-shot per session: even if a refetch briefly holds a stale (pre-
  // onboardedAt) doc, we never bounce the user to onboarding more than once.
  const redirected = useRef(false)

  useEffect(() => {
    if (redirected.current) return
    if (session.status !== 'signed-in' || isLoading || isFetching) return
    if (userDoc?.onboardedAt) return
    if (location.pathname === '/home' || location.pathname === '/') {
      redirected.current = true
      navigate('/onboarding', { replace: true })
    }
  }, [session.status, isLoading, isFetching, userDoc?.onboardedAt, location.pathname, navigate])

  return null
}
