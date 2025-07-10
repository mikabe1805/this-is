import { MagnifyingGlassIcon, FunnelIcon } from '@heroicons/react/24/outline'

interface SearchBarProps {
  placeholder?: string
}

const SearchBar = ({ placeholder = 'Search...' }: SearchBarProps) => {
  return (
    <div className="flex items-center bg-white/90 shadow-soft border border-cream-200 rounded-pill px-3 py-2 gap-2">
      <MagnifyingGlassIcon className="w-5 h-5 text-brown-500/70" />
      <input
        type="text"
        placeholder={placeholder}
        className="flex-1 bg-transparent outline-none text-brown-600 placeholder-brown-500/50 text-sm"
      />
      <FunnelIcon className="w-5 h-5 text-brown-500/70" />
    </div>
  )
}

export default SearchBar 