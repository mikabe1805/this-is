import { HomeIcon, MagnifyingGlassIcon, PhotoIcon, UserIcon } from '@heroicons/react/24/outline'
import { HomeIcon as HomeIconSolid, MagnifyingGlassIcon as MagnifyingGlassIconSolid, PhotoIcon as PhotoIconSolid, UserIcon as UserIconSolid } from '@heroicons/react/24/solid'
import PlusDropdown from './PlusDropdown'

interface NavbarProps {
  activeTab: string
  setActiveTab: (tab: string) => void
  onCreatePost: () => void
  onEmbedFrom?: () => void
}

const Navbar = ({ activeTab, setActiveTab, onCreatePost, onEmbedFrom }: NavbarProps) => {
  const tabs = [
    { id: 'home', label: 'Home', icon: HomeIcon, activeIcon: HomeIconSolid },
    { id: 'search', label: 'Search', icon: MagnifyingGlassIcon, activeIcon: MagnifyingGlassIconSolid },
    { id: 'favorites', label: 'Reels', icon: PhotoIcon, activeIcon: PhotoIconSolid },
    { id: 'profile', label: 'Profile', icon: UserIcon, activeIcon: UserIconSolid },
  ]

  const handleCreatePost = () => {
    onCreatePost()
  }

  return (
    <nav 
      className="fixed bottom-0 left-1/2 transform -translate-x-1/2 w-full max-w-md bg-white/90 backdrop-blur-glass border-t border-linen-200/50 shadow-crystal z-[1001]" 
      style={{ bottom: 'env(safe-area-inset-bottom, 0px)' }}
      onTouchMove={(e) => e.preventDefault()}
      onWheel={(e) => e.preventDefault()}
    >
      <div className="flex items-center py-1.5 px-4">
        {/* Left side tabs */}
        <div className="flex flex-1 justify-around">
          {tabs.slice(0, 2).map((tab) => {
            const Icon = activeTab === tab.id ? tab.activeIcon : tab.icon
            const isActive = activeTab === tab.id
            
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center py-2 px-3 rounded-xl transition-all duration-300 group relative ${
                  isActive 
                    ? 'text-sage-600 bg-gradient-to-br from-sage-50 to-linen-50 shadow-frosted border border-sage-200/30' 
                    : 'text-charcoal-400 hover:text-charcoal-600 hover:bg-linen-50/50'
                }`}
              >
                <Icon className={`w-6 h-6 mb-1 transition-all duration-300 ${
                  isActive ? 'scale-110 drop-shadow-sm' : 'group-hover:scale-105'
                }`} />
                <span className={`text-xs font-medium transition-all duration-300 ${
                  isActive ? 'text-sage-700 font-semibold' : 'text-charcoal-500 group-hover:text-charcoal-700'
                }`}>
                  {tab.label}
                </span>
                {isActive && (
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gradient-to-r from-sage-400 to-gold-400 rounded-full shadow-sm"></div>
                )}
              </button>
            )
          })}
        </div>

        {/* Center create post button */}
        <div className="flex justify-center mx-4">
          <div className="-mt-4">
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
                className={`flex flex-col items-center py-2 px-3 rounded-xl transition-all duration-300 group relative ${
                  isActive 
                    ? 'text-sage-600 bg-gradient-to-br from-sage-50 to-linen-50 shadow-frosted border border-sage-200/30' 
                    : 'text-charcoal-400 hover:text-charcoal-600 hover:bg-linen-50/50'
                }`}
              >
                <Icon className={`w-6 h-6 mb-1 transition-all duration-300 ${
                  isActive ? 'scale-110 drop-shadow-sm' : 'group-hover:scale-105'
                }`} />
                <span className={`text-xs font-medium transition-all duration-300 ${
                  isActive ? 'text-sage-700 font-semibold' : 'text-charcoal-500 group-hover:text-charcoal-700'
                }`}>
                  {tab.label}
                </span>
                {isActive && (
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gradient-to-r from-sage-400 to-gold-400 rounded-full shadow-sm"></div>
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