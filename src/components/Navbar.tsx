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
      className="fixed bottom-0 left-1/2 transform -translate-x-1/2 w-full max-w-md bg-white/80 backdrop-blur-md border-t border-linen-200 shadow-[0_-1px_8px_rgba(0,0,0,0.03)] z-[1001]" 
      style={{ bottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-center py-1 px-3">
        {/* Left side tabs */}
        <div className="flex flex-1 justify-around">
          {tabs.slice(0, 2).map((tab) => {
            const Icon = activeTab === tab.id ? tab.activeIcon : tab.icon
            const isActive = activeTab === tab.id
            
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center py-1.5 px-2 rounded-xl transition-all duration-200 group relative ${
                  isActive 
                    ? 'text-sage-700 bg-linen-50 border border-linen-200 shadow-sm' 
                    : 'text-charcoal-500 hover:text-charcoal-700'
                }`}
              >
                <Icon className={`w-6 h-6 mb-0.5 transition-all duration-200 ${
                  isActive ? 'scale-105' : 'group-hover:scale-105'
                }`} />
                <span className={`text-[10px] font-medium transition-colors ${
                  isActive ? 'text-sage-700' : 'text-charcoal-500 group-hover:text-charcoal-700'
                }`}>
                  {tab.label}
                </span>
                {isActive && (
                  <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-sage-500 rounded-full"></div>
                )}
              </button>
            )
          })}
        </div>

        {/* Center create post button */}
        <div className="flex justify-center mx-2">
          <div className="-mt-3">
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
                className={`flex flex-col items-center py-1.5 px-2 rounded-xl transition-all duration-200 group relative ${
                  isActive 
                    ? 'text-sage-700 bg-linen-50 border border-linen-200 shadow-sm' 
                    : 'text-charcoal-500 hover:text-charcoal-700'
                }`}
              >
                <Icon className={`w-6 h-6 mb-0.5 transition-all duration-200 ${
                  isActive ? 'scale-105' : 'group-hover:scale-105'
                }`} />
                <span className={`text-[10px] font-medium transition-colors ${
                  isActive ? 'text-sage-700' : 'text-charcoal-500 group-hover:text-charcoal-700'
                }`}>
                  {tab.label}
                </span>
                {isActive && (
                  <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-sage-500 rounded-full"></div>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </nav>
  )
}

export default Navbar
