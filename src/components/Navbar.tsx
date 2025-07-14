import { HomeIcon, MagnifyingGlassIcon, HeartIcon, UserIcon, PlusIcon } from '@heroicons/react/24/outline'
import { HomeIcon as HomeIconSolid, MagnifyingGlassIcon as MagnifyingGlassIconSolid, HeartIcon as HeartIconSolid, UserIcon as UserIconSolid } from '@heroicons/react/24/solid'

interface NavbarProps {
  activeTab: string
  setActiveTab: (tab: string) => void
  onCreatePost: () => void
}

const Navbar = ({ activeTab, setActiveTab, onCreatePost }: NavbarProps) => {
  const tabs = [
    { id: 'home', label: 'Home', icon: HomeIcon, activeIcon: HomeIconSolid },
    { id: 'search', label: 'Search', icon: MagnifyingGlassIcon, activeIcon: MagnifyingGlassIconSolid },
    { id: 'favorites', label: 'Reels', icon: HeartIcon, activeIcon: HeartIconSolid },
    { id: 'profile', label: 'Profile', icon: UserIcon, activeIcon: UserIconSolid },
  ]

  const handleCreatePost = () => {
    onCreatePost()
  }

  return (
    <nav className="bg-white/90 backdrop-blur-glass border-t border-linen-200/50 shadow-crystal">
      <div className="flex items-center py-2 px-4">
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
          <button
            onClick={handleCreatePost}
            className="w-14 h-14 bg-gradient-to-r from-sage-500 to-gold-500 rounded-full flex items-center justify-center text-white shadow-soft hover:shadow-lg transition-all duration-300 transform hover:scale-105 -mt-4"
          >
            <PlusIcon className="w-7 h-7" />
          </button>
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