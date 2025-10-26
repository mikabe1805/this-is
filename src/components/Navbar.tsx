import { HomeIcon, MagnifyingGlassIcon, UserIcon, GlobeAltIcon } from '@heroicons/react/24/outline'
import { HomeIcon as HomeIconSolid, MagnifyingGlassIcon as MagnifyingGlassIconSolid, UserIcon as UserIconSolid, GlobeAltIcon as GlobeAltIconSolid } from '@heroicons/react/24/solid'
import PlusDropdown from './PlusDropdown'
import { useEffect, useRef } from 'react'
import { featureFlags } from '../config/featureFlags'

interface NavbarProps {
  activeTab: string
  setActiveTab: (tab: string) => void
  onCreatePost: () => void
  onEmbedFrom?: () => void
}

const Navbar = ({ activeTab, setActiveTab, onCreatePost, onEmbedFrom }: NavbarProps) => {
  const navRef = useRef<HTMLElement>(null);
  
  // Build tabs array dynamically based on feature flags
  const tabs = [
    { id: 'home', label: 'Home', icon: HomeIcon, activeIcon: HomeIconSolid },
    { id: 'search', label: 'Search', icon: MagnifyingGlassIcon, activeIcon: MagnifyingGlassIconSolid },
    { id: 'explore', label: 'Explore', icon: GlobeAltIcon, activeIcon: GlobeAltIconSolid },
    { id: 'profile', label: 'Profile', icon: UserIcon, activeIcon: UserIconSolid },
  ]

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
    };

    nav.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      nav.removeEventListener('wheel', handleWheel);
    };
  }, []);

  return (
    <nav
      ref={navRef}
      className="fixed bottom-0 left-1/2 transform -translate-x-1/2 w-full max-w-md z-[1001] rounded-t-2xl overflow-hidden"
      style={{
        bottom: 'env(safe-area-inset-bottom, 0px)',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.65) 0%, rgba(255,255,255,0.75) 100%)',
        backdropFilter: 'blur(32px) saturate(1.1)',
        WebkitBackdropFilter: 'blur(32px) saturate(1.1)',
        boxShadow: `
          0 -8px 32px rgba(61,54,48,0.12),
          0 0 0 1px rgba(255,255,255,0.4),
          inset 0 1px 0 0 rgba(255,255,255,0.5)
        `,
        border: '1px solid rgba(255,255,255,0.35)',
        borderBottom: 'none',
      }}
    >
      <div className="flex items-center px-4" style={{ paddingTop: '12px', paddingBottom: '8px' }}>
        {/* Left side tabs */}
        <div className="flex flex-1 justify-around">
          {tabs.slice(0, 2).map((tab) => {
            const Icon = activeTab === tab.id ? tab.activeIcon : tab.icon
            const isActive = activeTab === tab.id

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center py-2.5 px-3 rounded-xl transition-all duration-200 group relative min-h-[56px] ${
                  isActive
                    ? 'text-bark-900 bg-white/20 border border-white/30 nav-active'
                    : 'text-bark-600/70 hover:text-bark-800 hover:bg-white/10'
                }`}
                style={isActive ? {
                  boxShadow: '0 0 8px rgba(255,240,200,0.4), 0 2px 6px rgba(0,0,0,0.06)'
                } : undefined}
                aria-label={tab.label}
              >
                <Icon className={`w-7 h-7 mb-1 transition-all duration-200 ${
                  isActive ? 'scale-105' : 'group-hover:scale-105'
                }`} />
                <span className={`text-[11px] font-medium transition-colors ${
                  isActive ? 'text-bark-900' : 'text-bark-700/70 group-hover:text-bark-900'
                }`}>
                  {tab.label}
                </span>
                {/* indicator handled via .nav-active pseudo */}
              </button>
            )
          })}
        </div>

        {/* Center create post button */}
        <div className="flex justify-center mx-2">
          <div className="-mt-6">
            <PlusDropdown
              onCreatePost={onCreatePost}
              onEmbedFrom={onEmbedFrom}
              variant="main"
            />
          </div>
        </div>

        {/* Right side tabs */}
        <div className="flex flex-1 justify-around">
          {tabs.slice(2).map((tab) => {
            const Icon = activeTab === tab.id ? tab.activeIcon : tab.icon
            const isActive = activeTab === tab.id

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center py-2.5 px-3 rounded-xl transition-all duration-200 group relative min-h-[56px] ${
                  isActive
                    ? 'text-bark-900 bg-white/20 border border-white/30 nav-active'
                    : 'text-bark-600/70 hover:text-bark-800 hover:bg-white/10'
                }`}
                style={isActive ? {
                  boxShadow: '0 0 8px rgba(255,240,200,0.4), 0 2px 6px rgba(0,0,0,0.06)'
                } : undefined}
                aria-label={tab.label}
              >
                <Icon className={`w-7 h-7 mb-1 transition-all duration-200 ${
                  isActive ? 'scale-105' : 'group-hover:scale-105'
                }`} />
                <span className={`text-[11px] font-medium transition-colors ${
                  isActive ? 'text-bark-900' : 'text-bark-700/70 group-hover:text-bark-900'
                }`}>
                  {tab.label}
                </span>
                {/* indicator handled via .nav-active pseudo */}
              </button>
            )
          })}
        </div>
      </div>
    </nav>
  )
}

export default Navbar
