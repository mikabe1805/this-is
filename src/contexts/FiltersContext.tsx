import React, { createContext, useContext, useMemo, useState } from 'react'

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
  // Exempt noisy recommended defaults
  priceLevels: [],
  openNow: false,
  tags: []
}

const FiltersContext = createContext<FiltersContextType | undefined>(undefined)

export const FiltersProvider = ({ children }: { children: React.ReactNode }) => {
  const [filters, setFiltersState] = useState<Filters>(defaultFilters)

  const setFilters = (f: Partial<Filters>) => {
    setFiltersState(prev => ({ ...prev, ...f }))
  }

  const resetFilters = () => setFiltersState(defaultFilters)

  const value = useMemo(() => ({ filters, setFilters, resetFilters }), [filters])
  return <FiltersContext.Provider value={value}>{children}</FiltersContext.Provider>
}

export const useFilters = (): FiltersContextType => {
  const ctx = useContext(FiltersContext)
  if (!ctx) throw new Error('useFilters must be used within a FiltersProvider')
  return ctx
}




