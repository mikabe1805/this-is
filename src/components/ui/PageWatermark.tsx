/**
 * PageWatermark — watercolor botanical PNGs anchored to the viewport edges,
 * pinned to the same max-w-md center column as the app shell. Pinned with
 * `position: fixed` (not `absolute`) so they cannot extend the parent's
 * scroll height.
 *
 * The variants map to the assets in /public/assets:
 *   - corners: frame.png  (left+right corner sprigs at the top)
 *   - climbing: leaves2.png (tall left+right vines climbing the page)
 *   - bouquet: leaves.png  (a single clustered bouquet, anchorable)
 *   - branch:  branch.png  (sparse driftwood — minimalist accent)
 *   - leaf:    leaf.png    (single leaf accent)
 *
 * Use ONE per page, max — these are atmosphere, not decoration density.
 */

type Variant = 'corners' | 'climbing' | 'bouquet' | 'branch' | 'leaf'
type Anchor = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'top' | 'bottom'

interface PageWatermarkProps {
  variant?: Variant
  anchor?: Anchor
  size?: number
  opacity?: number
  flip?: boolean
  /** Pixels of bottom padding to reserve for the dock. Default 96. */
  dockOffset?: number
}

const VARIANT_SRC: Record<Variant, string> = {
  corners: '/assets/frame.png',
  climbing: '/assets/leaves2.png',
  bouquet: '/assets/leaves.png',
  branch: '/assets/branch.png',
  leaf: '/assets/leaf.png',
}

const ANCHOR_INNER_STYLES: Record<Anchor, React.CSSProperties> = {
  'bottom-right': { right: -12, bottom: 0 },
  'bottom-left':  { left: -12,  bottom: 0 },
  'top-right':    { right: -12, top: 0 },
  'top-left':     { left: -12,  top: 0 },
  'top':          { left: '50%', top: 0, transform: 'translateX(-50%)' },
  'bottom':       { left: '50%', bottom: 0, transform: 'translateX(-50%)' },
}

export default function PageWatermark({
  variant = 'climbing',
  anchor = 'top',
  size = 320,
  opacity = 0.22,
  flip = false,
  dockOffset = 96,
}: PageWatermarkProps) {
  const isBottom = anchor.includes('bottom')
  const transform = flip ? 'scale(-1, 1)' : undefined
  return (
    <div
      aria-hidden
      className="fixed inset-0 mx-auto max-w-md pointer-events-none select-none overflow-hidden"
      style={{
        zIndex: 0,
        paddingBottom: isBottom ? dockOffset : undefined,
      }}
    >
      <div className="relative w-full h-full">
        <img
          src={VARIANT_SRC[variant]}
          alt=""
          aria-hidden
          className="absolute"
          style={{
            ...ANCHOR_INNER_STYLES[anchor],
            width: size,
            opacity,
            transform: [ANCHOR_INNER_STYLES[anchor].transform, transform].filter(Boolean).join(' ') || undefined,
          }}
        />
      </div>
    </div>
  )
}
