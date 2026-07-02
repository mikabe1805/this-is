import type { ReactNode } from 'react'

/** The two-column masonry. CSS columns; cards keep their own aspect. */
export function Masonry({ children }: { children: ReactNode }) {
  return <div className="masonry">{children}</div>
}
