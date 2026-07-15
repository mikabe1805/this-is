import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { prepareCanonicalServiceWorker } from './lib/killLegacySW'
import './styles/tokens.css'
import './styles/base.css'
import './styles/components.css'

// Retire v1's origin-wide worker, keep development cache-free, and install
// only the production v2 owned-asset shell. Personal/API responses are never cached.
void prepareCanonicalServiceWorker()

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
