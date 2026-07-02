/**
 * The three-tab dock — the app's only persistent chrome. Glass recipe lives
 * on `.dock` (chrome-only glass law).
 */
import { NavLink } from 'react-router-dom'
import { haptics } from '../lib/haptics'

const TABS = [
  { to: '/home', label: 'HOME', icon: HomeIcon },
  { to: '/search', label: 'SEARCH', icon: SearchIcon },
  { to: '/saved', label: 'SAVED', icon: SavedIcon },
] as const

export function Dock() {
  return (
    <nav className="dock glass-chrome" aria-label="Primary">
      {TABS.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          onClick={() => haptics.tap()}
          className={({ isActive }) => `dock-tab press${isActive ? ' is-active' : ''}`}
        >
          <Icon />
          <span className="dock-label">{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}

function HomeIcon() {
  return (
    <svg className="dock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1v-9.5Z" strokeLinejoin="round" />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg className="dock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" strokeLinecap="round" />
    </svg>
  )
}

function SavedIcon() {
  return (
    <svg className="dock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M7 3.5h10a1 1 0 0 1 1 1V21l-6-4-6 4V4.5a1 1 0 0 1 1-1Z" strokeLinejoin="round" />
    </svg>
  )
}
