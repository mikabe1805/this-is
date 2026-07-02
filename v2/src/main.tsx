import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles/tokens.css'
import './styles/base.css'
import './styles/components.css'

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
