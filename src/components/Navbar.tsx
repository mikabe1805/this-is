import { HomeIcon, UserIcon, MagnifyingGlassIcon, HeartIcon } from '@heroicons/react/24/outline'

interface NavbarProps {
  activeTab: string
  setActiveTab: (tab: string) => void
}

const Navbar = ({ activeTab, setActiveTab }: NavbarProps) => {
  const navItems = [
    { id: 'home', label: 'Home', icon: HomeIcon, path: '/' },
    { id: 'search', label: 'Search', icon: MagnifyingGlassIcon, path: '/search' },
    { id: 'saved', label: 'Saved', icon: HeartIcon, path: '/saved' },
    { id: 'profile', label: 'Profile', icon: UserIcon, path: '/profile' },
  ]

  return (
    <nav className="bg-white/80 backdrop-blur-md border-t border-cream-200">
      <div className="flex justify-around items-center h-16 px-4">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = activeTab === item.id
          
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center justify-center w-16 h-12 rounded-2xl transition-all duration-300 ${
                isActive
                  ? 'bg-gradient-to-br from-coral-100 to-coral-200 text-coral-700 shadow-liquid'
                  : 'text-sage-600 hover:text-coral-600 hover:bg-cream-50'
              }`}
            >
              <Icon className={`w-6 h-6 mb-1 transition-transform duration-300 ${
                isActive ? 'scale-110' : ''
              }`} />
              <span className={`text-xs font-medium transition-all duration-300 ${
                isActive ? 'opacity-100' : 'opacity-70'
              }`}>
                {item.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}

export default Navbar 