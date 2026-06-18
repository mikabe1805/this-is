import { useEffect, useMemo, useState } from 'react'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { rankingService, BUCKET_LABEL, type Bucket, type RankingDoc } from '../services/rankingService'
import { haptics } from '../utils/haptics'
import EmptyState from '../components/ui/EmptyState'

/**
 * "Your ranked places" — the payoff for the Beli loop. Shows the user's ranked
 * lists per sentiment bucket (best → worst) with each place's 0–10 score.
 * Tapping a row opens that place. Pure read of `userRankings/{uid}`.
 */

const TABS: { key: Bucket; label: string }[] = [
  { key: 'liked', label: 'Loved' },
  { key: 'fine', label: 'Fine' },
  { key: 'disliked', label: 'Not for me' },
]

export default function Rankings() {
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const [doc, setDoc] = useState<RankingDoc | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Bucket>('liked')

  useEffect(() => {
    if (!currentUser) return
    let cancelled = false
    setLoading(true)
    rankingService.getRanking(currentUser.id)
      .then(r => { if (!cancelled) setDoc(r) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    const onRanked = () => {
      rankingService.invalidate(currentUser.id)
      rankingService.getRanking(currentUser.id).then(r => { if (!cancelled) setDoc(r) }).catch(() => {})
    }
    window.addEventListener('this-is:ranked', onRanked)
    return () => { cancelled = true; window.removeEventListener('this-is:ranked', onRanked) }
  }, [currentUser?.id])

  const counts = useMemo(() => ({
    liked: doc?.liked.length || 0,
    fine: doc?.fine.length || 0,
    disliked: doc?.disliked.length || 0,
  }), [doc])

  const rows = doc?.[tab] || []
  const total = counts.liked + counts.fine + counts.disliked

  return (
    <div className="relative min-h-full overflow-x-hidden">
      <header className="sticky top-0 z-30 bg-paper/90 backdrop-blur-md">
        <div className="px-5 safe-top pb-3 flex items-center gap-3">
          <button
            onClick={() => { if (window.history.length > 1) navigate(-1); else navigate('/profile') }}
            className="h-10 w-10 rounded-full hover:bg-paper-deep flex items-center justify-center"
            aria-label="Back"
          >
            <ArrowLeftIcon className="w-5 h-5 text-ink" />
          </button>
          <div className="flex-1">
            <h1 className="font-display text-[22px] leading-none text-ink">Your rankings</h1>
            {!loading && total > 0 && (
              <p className="font-mono text-[10px] tracking-[0.12em] uppercase text-ink-mute mt-1">
                {total} ranked {total === 1 ? 'place' : 'places'}
              </p>
            )}
          </div>
        </div>

        {(!loading && total > 0) && (
          <div className="px-5 pb-2 flex gap-1.5 overflow-x-auto no-scrollbar">
            {TABS.map(t => {
              const active = tab === t.key
              return (
                <button
                  key={t.key}
                  onClick={() => { if (t.key !== tab) haptics.tap(); setTab(t.key) }}
                  className={`shrink-0 inline-flex items-center min-h-[44px] h-11 px-3.5 rounded-full label-eyebrow transition-colors press ${
                    active ? 'bg-ink text-paper' : 'bg-transparent text-ink-soft hover:text-ink border border-edge'
                  }`}
                >
                  {t.label} · {counts[t.key]}
                </button>
              )
            })}
          </div>
        )}
        <div className="border-b border-edge mx-5" />
      </header>

      <div className="relative z-10 px-5 py-5 max-w-2xl mx-auto">
        {loading ? (
          <ul className="divide-y divide-edge border-y border-edge">
            {Array.from({ length: 6 }).map((_, i) => (
              <li key={i} className="py-4 flex items-center gap-3">
                <span className="skeleton w-9 h-9 rounded-full shrink-0" />
                <span className="skeleton block h-[16px] flex-1 rounded-md" />
              </li>
            ))}
          </ul>
        ) : total === 0 ? (
          <EmptyState
            title="No rankings yet."
            body="Save a place you've been and tap “Rank it” — we'll ask a quick “better or worse?” and give it a score out of 10."
            action={{ label: 'Discover places', href: '/explore' }}
            botanical="wildflower"
          />
        ) : rows.length === 0 ? (
          <EmptyState title={`No ${BUCKET_LABEL[tab]} places yet.`} body="Rank a few more saves to fill this out." botanical="fern" />
        ) : (
          <ol className="divide-y divide-edge border-y border-edge">
            {rows.map((it, i) => {
              const score = doc?.scores[it.id]
              return (
                <li key={it.id}>
                  <button
                    type="button"
                    onClick={() => { haptics.select(); navigate(`/place/${it.id}`, { viewTransition: true }) }}
                    className="w-full flex items-center gap-3.5 py-3.5 text-left hover:bg-paper-deep -mx-1 px-1 transition-colors press"
                  >
                    <span className="shrink-0 font-mono text-[12px] tracking-[0.08em] text-ink-mute w-6 text-right">{i + 1}</span>
                    <span className="flex-1 min-w-0 font-display text-[18px] leading-tight text-ink truncate">{it.name}</span>
                    {typeof score === 'number' && (
                      <span
                        className="shrink-0 inline-flex items-center justify-center h-8 min-w-8 px-2 rounded-full bg-accent-soft border border-accent/30 font-display text-[15px]"
                        style={{ color: 'var(--accent-deep)' }}
                      >
                        {score.toFixed(1)}
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ol>
        )}
      </div>
    </div>
  )
}
