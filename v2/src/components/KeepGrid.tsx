import type { ReactNode } from 'react'

/** A row-major two-column grid, so visual and keyboard reading order agree. */
export function KeepGrid({ children }: { children: ReactNode }) {
  return <div className="keep-grid">{children}</div>
}
