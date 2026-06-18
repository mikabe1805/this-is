import { ArrowPathIcon } from '@heroicons/react/24/outline'

/**
 * The pull-to-refresh indicator — a small spinner that floats in from the top
 * as the user pulls, then spins while refreshing. Driven by `usePullToRefresh`'s
 * `{ pull, refreshing }`. Sits clear of the notch via safe-area inset.
 */
export default function PullSpinner({ pull, refreshing }: { pull: number; refreshing: boolean }) {
  if (pull <= 0 && !refreshing) return null
  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 z-[60] pointer-events-none"
      style={{
        top: `calc(env(safe-area-inset-top, 0px) + ${Math.min(pull, 70) * 0.5}px)`,
        opacity: refreshing ? 1 : Math.min(1, pull / 50),
      }}
    >
      <div className="w-9 h-9 rounded-full bg-card border border-edge shadow-cozy flex items-center justify-center">
        <ArrowPathIcon
          className={`w-[18px] h-[18px] text-ink-soft ${refreshing ? 'animate-spin' : ''}`}
          style={refreshing ? undefined : { transform: `rotate(${pull * 2.6}deg)` }}
        />
      </div>
    </div>
  )
}
