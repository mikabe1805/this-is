import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'

export type Filters = {
  origin: 'current' | 'profile' | 'custom'
  location?: { lat: number; lng: number; name?: string }
  distanceKm?: number
  unit?: 'mi' | 'km'
  priceLevels?: number[]
  openNow?: boolean
  tags?: string[]
}

type FiltersContextType = {
  filters: Filters
  setFilters: (f: Partial<Filters>) => void
  resetFilters: () => void
}

const defaultFilters: Filters = {
  origin: 'profile',
  unit: 'mi',
  distanceKm: 80,
  priceLevels: [],
  openNow: false,
  tags: []
}

// Routes where filter state should persist (Search → Search refresh, etc.).
// Anywhere else, switching routes wipes the filter state so e.g. tags chosen
// on Search don't silently apply to Explore or List view.
const FILTER_PERSIST_PREFIXES = ['/search', '/list/']

const FiltersContext = createContext<FiltersContextType | undefined>(undefined)

export const FiltersProvider = ({ children }: { children: React.ReactNode }) => {
  const [filters, setFiltersState] = useState<Filters>(defaultFilters)
  const location = useLocation()

  const setFilters = (f: Partial<Filters>) => {
    setFiltersState(prev => ({ ...prev, ...f }))
  }

  const resetFilters = () => setFiltersState(defaultFilters)

  // Reset whenever the user navigates to a route that doesn't own the filter
  // surface. This stops Search-set filters from leaking into Explore.
  useEffect(() => {
    const path = location.pathname
    const persists = FILTER_PERSIST_PREFIXES.some(p => path === p || path.startsWith(p))
    if (!persists) {
      // Cheap structural check — only reset if we've drifted from defaults,
      // so we don't fire pointless re-renders on every navigation.
      const same =
        (filters.tags?.length ?? 0) === 0 &&
        (filters.priceLevels?.length ?? 0) === 0 &&
        !filters.openNow &&
        filters.origin === defaultFilters.origin &&
        filters.distanceKm === defaultFilters.distanceKm &&
        filters.unit === defaultFilters.unit &&
        !filters.location
      if (!same) setFiltersState(defaultFilters)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])

  const value = useMemo(() => ({ filters, setFilters, resetFilters }), [filters])
  return <FiltersContext.Provider value={value}>{children}</FiltersContext.Provider>
}

export const useFilters = (): FiltersContextType => {
  const ctx = useContext(FiltersContext)
  if (!ctx) throw new Error('useFilters must be used within a FiltersProvider')
  return ctx
}




