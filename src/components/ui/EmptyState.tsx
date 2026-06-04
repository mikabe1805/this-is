import { useNavigate } from 'react-router-dom'
import BotanicalMark from './BotanicalMark'

/**
 * Reusable empty state. A new user's first impression is mostly empty states —
 * each should teach what the surface is for and route into the core loop, not
 * just announce emptiness. Botanical mark + one value sentence + one primary
 * action, in the app's editorial voice.
 */
interface EmptyStateProps {
  /** Big serif headline, e.g. "Nothing saved yet." */
  title: string
  /** One supporting sentence. */
  body?: string
  /** Primary CTA. `href` navigates; `onClick` runs a handler. */
  action?: { label: string; href?: string; onClick?: () => void }
  botanical?: 'fern' | 'rose-stem' | 'lavender' | 'wildflower' | 'cluster'
  className?: string
}

export default function EmptyState({ title, body, action, botanical = 'cluster', className = '' }: EmptyStateProps) {
  const navigate = useNavigate()
  const onAction = () => {
    if (!action) return
    if (action.href) navigate(action.href)
    else action.onClick?.()
  }
  return (
    <div className={`relative border border-edge rounded-[14px] bg-card overflow-hidden ${className}`}>
      <BotanicalMark
        variant={botanical}
        size={150}
        opacity={0.07}
        className="absolute -right-4 -bottom-6 pointer-events-none"
      />
      <div className="relative px-6 py-12 text-center">
        <p className="font-display text-[24px] leading-tight text-ink">{title}</p>
        {body && <p className="text-[13px] text-ink-soft mt-2 max-w-xs mx-auto leading-relaxed">{body}</p>}
        {action && (
          <button
            type="button"
            onClick={onAction}
            className="btn-cta press h-11 px-5 mt-5 label-eyebrow inline-flex items-center"
          >
            {action.label}
          </button>
        )}
      </div>
    </div>
  )
}
