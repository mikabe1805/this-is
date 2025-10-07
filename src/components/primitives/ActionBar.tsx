import React from 'react'

interface ActionBarProps {
  primary: React.ReactNode
  secondary?: React.ReactNode[]
}

/**
 * ActionBar - Sticky bottom action bar
 * 
 * Fixed to bottom of viewport with primary CTA and optional secondary actions
 * Used for hub/list actions like Save, Add Post, Directions
 */
export function ActionBar({ primary, secondary = [] }: ActionBarProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-bark-50/90 backdrop-blur-md p-3 pt-2 border-t border-bark-200/50">
      <div className="max-w-screen-sm mx-auto flex gap-2">
        <div className="flex-1">
          {primary}
        </div>
        {secondary.map((action, index) => (
          <div key={index}>
            {action}
          </div>
        ))}
      </div>
    </div>
  )
}
