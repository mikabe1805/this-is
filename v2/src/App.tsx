/**
 * The shell. Laws enforced here:
 *  - Renders before auth: nothing in this tree waits on Firebase; the SDK
 *    loads via lazy chunks after first paint.
 *  - Every surface is a route (sheets included, via search params) so
 *    hardware back always works. Zero modal managers.
 *  - The dock lives OUTSIDE the error boundary and survives page crashes.
 */
import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Dock } from './components/Dock'
import { ErrorBoundary } from './components/ErrorBoundary'
import { refreshCoords } from './lib/geo'

const Home = lazy(() => import('./pages/Home'))
const Search = lazy(() => import('./pages/Search'))
const Saved = lazy(() => import('./pages/Saved'))
const Closeup = lazy(() => import('./pages/Closeup'))
const Add = lazy(() => import('./pages/Add'))
const Onboarding = lazy(() => import('./pages/Onboarding'))
const Settings = lazy(() => import('./pages/Settings'))
const Share = lazy(() => import('./pages/Share'))
const SaveToastHost = lazy(() => import('./components/SaveToastHost'))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 24 * 60 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

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

  useEffect(() => {
    // Post-paint bootstraps: auth listener + a background coords refresh.
    void import('./lib/authWatch').then(m => m.start())
    refreshCoords()
  }, [])

  return (
    <div className="app">
      <main className="app-main">
        <ErrorBoundary resetKey={location.pathname}>
          <Suspense fallback={<PageSkeleton />}>
            <Routes>
              <Route path="/" element={<Navigate to="/home" replace />} />
              <Route path="/home" element={<Home />} />
              <Route path="/search" element={<Search />} />
              <Route path="/saved" element={<Saved />} />
              <Route path="/p/:placeId" element={<Closeup />} />
              <Route path="/add" element={<Add />} />
              <Route path="/onboarding" element={<Onboarding />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/s/:token" element={<Share />} />
              <Route path="*" element={<Navigate to="/home" replace />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </main>
      <Suspense fallback={null}>
        <SaveToastHost />
      </Suspense>
      <Dock />
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Chrome />
      </BrowserRouter>
    </QueryClientProvider>
  )
}
