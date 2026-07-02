import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { killLegacyServiceWorker } from './lib/killLegacySW'
import './styles/tokens.css'
import './styles/base.css'
import './styles/components.css'

// v1's leftover service worker will serve its stale bundle on any shared
// origin (localhost, and the prod domain at cutover) — tear it down first.
killLegacyServiceWorker()

// Theme before first paint — dark ("night") is the default; "day" is the
// brightness-bumped variant, never a white theme.
try {
  const theme = localStorage.getItem('this-is:v2:theme')
  if (theme === 'day') document.documentElement.dataset.theme = 'day'
} catch { /* ignore */ }

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
