import { HomeIcon, MagnifyingGlassIcon, UserIcon, GlobeAltIcon } from '@heroicons/react/24/outline'
import {
  HomeIcon as HomeIconSolid,
  MagnifyingGlassIcon as MagnifyingGlassIconSolid,
  UserIcon as UserIconSolid,
  GlobeAltIcon as GlobeAltIconSolid,
} from '@heroicons/react/24/solid'
import PlusDropdown from './PlusDropdown'
import { haptics } from '../utils/haptics'

interface NavbarProps {
  activeTab: string
  setActiveTab: (tab: string) => void
  onCreatePost: () => void
  onEmbedFrom?: () => void
}

const TABS = [
  { id: 'home', label: 'Home', icon: HomeIcon, activeIcon: HomeIconSolid },
  { id: 'explore', label: 'Discover', icon: GlobeAltIcon, activeIcon: GlobeAltIconSolid },
  { id: 'search', label: 'Search', icon: MagnifyingGlassIcon, activeIcon: MagnifyingGlassIconSolid },
  { id: 'profile', label: 'You', icon: UserIcon, activeIcon: UserIconSolid },
] as const

const Navbar = ({ activeTab, setActiveTab, onCreatePost, onEmbedFrom }: NavbarProps) => {
  // Light tick on a real tab change — re-tapping the current tab stays silent
  // so it doesn't feel like a misfire.
  const selectTab = (id: string) => {
    if (id !== activeTab) haptics.tap()
    setActiveTab(id)
  }
  return (
    <nav
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-[1001]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {/* Soft fade above the bar so feed content doesn't slam into it */}
      <div
        className="absolute -top-8 left-0 right-0 h-8 pointer-events-none"
        style={{ background: 'linear-gradient(to top, rgba(244,241,235,0.85), rgba(244,241,235,0))' }}
      />

      {/* Dock — translucent cream pill with backdrop-blur. The page content
          actually liquifies through it (real CSS glass, not a PNG). Clean
          neutral surface, readability first. */}
      <div className="dock-glass mx-3 mb-3 relative">
        <div className="grid grid-cols-5 items-center px-1.5 py-1.5 relative z-[1]">
          {TABS.slice(0, 2).map(tab => (
            <NavTab key={tab.id} tab={tab} active={activeTab === tab.id} onClick={() => selectTab(tab.id)} />
          ))}

          <div className="flex items-center justify-center">
            <PlusDropdown onCreatePost={onCreatePost} onEmbedFrom={onEmbedFrom} variant="main" />
          </div>

          {TABS.slice(2).map(tab => (
            <NavTab key={tab.id} tab={tab} active={activeTab === tab.id} onClick={() => selectTab(tab.id)} />
          ))}
        </div>
      </div>
    </nav>
  )
}

const NavTab = ({
  tab,
  active,
  onClick,
}: {
  tab: (typeof TABS)[number]
  active: boolean
  onClick: () => void
}) => {
  const Icon = active ? tab.activeIcon : tab.icon
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={tab.label}
      aria-current={active ? 'page' : undefined}
      className={`relative flex flex-col items-center justify-center gap-0.5 py-2 min-h-[44px] rounded-2xl transition-colors press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60 ${
        active ? 'text-ink' : 'text-ink-mute hover:text-ink-soft'
      }`}
    >
      <Icon className="w-[22px] h-[22px]" />
      <span className="font-mono text-[9px] tracking-[0.14em] uppercase mt-0.5">{tab.label}</span>
      {active && (
        <span
          className="accent-bead-sm accent-bead absolute -bottom-0 left-1/2 -translate-x-1/2"
          aria-hidden="true"
        />
      )}
    </button>
  )
}

export default Navbar
