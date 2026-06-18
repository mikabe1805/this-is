import { useEffect, useState } from 'react'
import { firebaseDataService, type TasteProfile } from '../../services/firebaseDataService'
import { vibeLabel } from '../../utils/placeTypes'

/**
 * "Your taste" — the visible receipt of what the app has learned about you.
 * This is the surface that makes personalization *felt*: it names your top
 * interests, shows a "getting to know you" meter that fills as you interact,
 * and looks genuinely different from one user to the next. Self-loads the
 * profile (cached in the data layer), so it's cheap to drop on the profile.
 */
export default function TasteCard({ userId }: { userId: string }) {
  const [taste, setTaste] = useState<TasteProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    const load = () => firebaseDataService.buildTasteProfile(userId)
      .then(t => { if (!cancelled) setTaste(t) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    load()
    // Re-read after a save — the model just learned something.
    const onSaved = () => { firebaseDataService.invalidateTasteProfile(userId); load() }
    window.addEventListener('this-is:saved', onSaved)
    return () => { cancelled = true; window.removeEventListener('this-is:saved', onSaved) }
  }, [userId])

  if (loading) {
    return <div className="skeleton h-28 rounded-[14px]" />
  }

  const hasSignal = !!taste?.hasSignal
  const top = (taste?.interests || []).slice(0, 6)
  // Truly empty bar for a brand-new user (the 6% floor contradicted the
  // "we haven't started learning yet" copy); keep the 6% minimum once there's
  // any signal so a tiny sliver is visible.
  const progress = hasSignal ? Math.max(0.06, Math.min(1, (taste?.signalCount || 0) / 25)) : 0
  const eyebrow = taste?.confidence === 'known'
    ? 'We know your taste'
    : taste?.confidence === 'learning'
      ? 'Learning your taste'
      : 'Getting to know you'

  return (
    <div className="relative border border-edge rounded-[14px] bg-card overflow-hidden">
      <div className="px-5 py-4">
        <div className="flex items-center justify-between">
          <span className="label-eyebrow flex items-center gap-1.5" style={{ color: 'var(--accent-deep)' }}>
            <span className="accent-bead-sm accent-bead" /> {eyebrow}
          </span>
          {hasSignal && (
            <span className="font-mono text-[10px] tracking-[0.12em] uppercase text-ink-mute">
              {taste?.confidence === 'known' ? '' : `${taste?.signalCount || 0} signals`}
            </span>
          )}
        </div>

        <h3 className="font-display text-[22px] leading-tight text-ink mt-1.5">
          Your taste<span style={{ color: 'var(--bloom)' }}>.</span>
        </h3>

        {/* "Getting to know you" meter — fills as the user interacts. */}
        <div className="mt-3 h-1.5 rounded-full bg-paper-deep overflow-hidden">
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{ width: `${progress * 100}%`, background: 'linear-gradient(90deg, var(--accent), var(--accent-bright))' }}
          />
        </div>

        {hasSignal ? (
          <>
            <div className="flex flex-wrap gap-1.5 mt-4">
              {top.map(i => (
                <span key={i.key} className="px-3 h-7 rounded-full bg-paper-deep border border-edge label-eyebrow text-ink-soft inline-flex items-center capitalize">
                  {i.label}
                </span>
              ))}
            </div>
            {taste!.vibes.length > 0 && (
              <div className="mt-4 pt-3.5 border-t border-edge">
                <p className="label-eyebrow text-ink-mute mb-1.5">Your vibe</p>
                <p className="font-display-italic text-[17px] leading-relaxed text-ink">
                  {taste!.vibes.slice(0, 7).map(vibeLabel).join('  ·  ')}
                </p>
              </div>
            )}
          </>
        ) : (
          <p className="text-[13px] text-ink-soft mt-3 leading-relaxed">
            Save places you love and we'll start learning your taste — the more you save, search, and explore, the more your feed becomes yours.
          </p>
        )}
      </div>
    </div>
  )
}
