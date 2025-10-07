import React from 'react'

interface PageHeaderProps {
  coverUrl?: string
  title: string
  subtitle?: React.ReactNode
  rightActions?: React.ReactNode
}

/**
 * PageHeader - Hero header with optional cover image
 * 
 * Displays a cover image with scrim overlay and glass toolbar
 * For pages like PlaceHub and ListView
 */
export function PageHeader({ 
  coverUrl, 
  title, 
  subtitle, 
  rightActions 
}: PageHeaderProps) {
  if (!coverUrl) {
    // Simple header without cover image
    return (
      <header className="w-full px-4 py-3 bg-bark-50">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-bark-900">{title}</h1>
            {subtitle && <div className="text-bark-700 text-sm mt-1">{subtitle}</div>}
          </div>
          {rightActions && <div className="flex gap-2">{rightActions}</div>}
        </div>
      </header>
    )
  }

  return (
    <header className="relative w-full">
      <div className="relative h-44 w-full overflow-hidden rounded-b-2xl">
        <img 
          src={coverUrl} 
          alt="" 
          className="h-full w-full object-cover"
        />
        <div className="scrim absolute inset-0" />
        
        <div className="absolute bottom-3 left-3 right-3 glass p-3 flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-white truncate">{title}</h1>
            {subtitle && (
              <div className="text-white/90 text-sm mt-0.5">
                {subtitle}
              </div>
            )}
          </div>
          {rightActions && (
            <div className="flex gap-2 ml-3 flex-shrink-0">
              {rightActions}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
