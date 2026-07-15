/**
 * The shell. Laws enforced here:
 *  - Renders before auth: nothing in this tree waits on Firebase; the SDK
 *    loads via lazy chunks after first paint.
 *  - Every surface is a route (sheets included, via search params) so
 *    hardware back always works. Zero modal managers.
 *  - The dock lives OUTSIDE the error boundary and survives page crashes.
 */
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { Dock } from './components/Dock'
import { ErrorBoundary } from './components/ErrorBoundary'
import { NetworkStatus } from './components/NetworkStatus'
import { ReleaseChannelMark } from './components/ReleaseChannelMark'
import { prototypeKind } from './lib/prototypeMode'
import { queryClient } from './lib/queryClient'
import { familyAlphaGateState } from './domain/familyAlphaAccess'
import { shouldHideDock } from './domain/navigation'
import { useSession } from './state/session'
import { TransientGroupPlanProvider } from './state/TransientGroupPlanProvider'

const Together = lazy(() => import('./pages/Together'))
const Search = lazy(() => import('./pages/Search'))
const Saved = lazy(() => import('./pages/Saved'))
const People = lazy(() => import('./pages/People'))
const Closeup = lazy(() => import('./pages/Closeup'))
const Add = lazy(() => import('./pages/Add'))
const Onboarding = lazy(() => import('./pages/Onboarding'))
const Settings = lazy(() => import('./pages/Settings'))
const LegacyPairLink = lazy(() => import('./pages/LegacyPairLink'))
const Group = lazy(() => import('./pages/Group'))
const CreateGroup = lazy(() => import('./pages/CreateGroup'))
const GroupInvite = lazy(() => import('./pages/GroupInvite'))
const Terms = lazy(() => import('./pages/Terms'))
const Privacy = lazy(() => import('./pages/Privacy'))
const SaveToastHost = lazy(() => import('./components/SaveToastHost'))
const OnboardingGate = lazy(() => import('./components/OnboardingGate'))
const FamilyAlphaAccessGate = import.meta.env.VITE_RELEASE_CHANNEL === 'family-alpha'
  ? lazy(() => import('./components/FamilyAlphaAccessGate')
    .then(module => ({ default: module.FamilyAlphaAccessGate })))
  : null

function PageSkeleton() {
  return (
    <div className="page" aria-busy>
      <div className="masonry">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="pin-card skeleton" />
        ))}
      </div>
    </div>
  )
}

function Chrome() {
  const location = useLocation()
  const session = useSession()
  const hideDock = shouldHideDock(location.pathname, location.search)
  const alphaGate = familyAlphaGateState(import.meta.env.VITE_RELEASE_CHANNEL, session.status)
  const prototype = prototypeKind()
  const prototypeMode = import.meta.env.DEV && Boolean(prototype)
  const [prototypeReady, setPrototypeReady] = useState(() => !prototypeMode)
  const prototypeInstalledRef = useRef(false)

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [location.pathname])

  useEffect(() => {
    const kind = prototypeKind()
    if (import.meta.env.DEV && kind) {
      const initialInstall = !prototypeInstalledRef.current
      if (initialInstall) setPrototypeReady(false)
      const install = import('./dev/groupPrototype').then(module => {
        module.installGroupPrototype(queryClient)
        prototypeInstalledRef.current = true
      })
      if (initialInstall) void install.then(() => setPrototypeReady(true))
      return
    }
    setPrototypeReady(true)
    // Post-paint auth bootstrap. Device location is never requested.
    void import('./lib/authWatch').then(m => m.start())
  }, [location.search])

  if (prototypeMode && !prototypeReady) {
    return <div className="app"><main className="app-main"><PageSkeleton /></main></div>
  }

  if (alphaGate && FamilyAlphaAccessGate) {
    return (
      <div className="app">
        <NetworkStatus />
        <ReleaseChannelMark />
        <main className="app-main family-alpha-access-main">
          <Suspense fallback={<PageSkeleton />}>
            <FamilyAlphaAccessGate />
          </Suspense>
        </main>
      </div>
    )
  }

  return (
    <div className="app">
      <NetworkStatus />
      <ReleaseChannelMark />
      <Suspense fallback={null}>
        <OnboardingGate />
      </Suspense>
      <main className="app-main">
        <ErrorBoundary resetKey={location.pathname}>
          <Suspense fallback={<PageSkeleton />}>
            <Routes>
              <Route path="/" element={<Navigate to="/together" replace />} />
              <Route path="/home" element={<Navigate to="/together" replace />} />
              <Route path="/together" element={<Together />} />
              <Route path="/search" element={<Search />} />
              <Route path="/saved" element={<Saved />} />
              <Route path="/people" element={<People />} />
              <Route path="/p/:placeId" element={<Closeup />} />
              <Route path="/add" element={<Add />} />
              <Route path="/onboarding" element={<Onboarding />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/i/:token" element={<LegacyPairLink />} />
              <Route path="/with/:uid" element={<LegacyPairLink />} />
              <Route path="/with/:uid/plan" element={<LegacyPairLink />} />
              <Route path="/g/:groupId" element={<Group />} />
              <Route path="/groups/new" element={<CreateGroup />} />
              <Route path="/gi/:token" element={<GroupInvite />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="*" element={<Navigate to="/together" replace />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </main>
      <Suspense fallback={null}>
        <SaveToastHost />
      </Suspense>
      {!hideDock && <Dock />}
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <TransientGroupPlanProvider>
          <Chrome />
        </TransientGroupPlanProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
