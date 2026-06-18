import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { rankingService, BUCKET_LABEL, type Bucket, type RankedItem } from '../services/rankingService'
import { useSwipeToDismiss } from '../hooks/useSwipeToDismiss'
import { haptics } from '../utils/haptics'

/**
 * The "Beli loop" pairwise-ranking sheet. Opened by a `this-is:rank-place`
 * event ({ placeId, name, bucket }) — usually from the "Rank it" action on the
 * post-save toast. Runs a binary-insertion comparison ("which did you prefer?")
 * to slot the new place into the user's ranked list for that sentiment bucket,
 * then reveals its 0–10 score. Fully skippable. Pure Firestore, no Places cost.
 */

const MAX_COMPARISONS = 5

type Phase = 'compare' | 'result'

interface Active {
  item: RankedItem
  bucket: Bucket
  list: RankedItem[] // existing ranked items in the bucket (best → worst)
  lo: number
  hi: number
  comparisons: number
}

export default function RankFlowModal() {
  const { currentUser } = useAuth()
  const [active, setActive] = useState<Active | null>(null)
  const [phase, setPhase] = useState<Phase>('compare')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ score: number; rank: number; total: number; name: string; bucket: Bucket } | null>(null)
  const sheetRef = useRef<HTMLDivElement>(null)

  const close = useCallback(() => {
    setActive(null)
    setResult(null)
    setBusy(false)
  }, [])

  useSwipeToDismiss({ ref: sheetRef, onDismiss: close, enabled: !!active })

  const commit = useCallback(async (a: Active, position: number) => {
    if (!currentUser) return
    setBusy(true)
    const res = await rankingService.commitRanking(currentUser.id, a.bucket, a.item, position)
    haptics.success()
    window.dispatchEvent(new CustomEvent('this-is:ranked', { detail: { placeId: a.item.id, score: res.score } }))
    setResult({ ...res, name: a.item.name, bucket: a.bucket })
    setPhase('result')
    setBusy(false)
  }, [currentUser])

  // Listen for rank requests.
  useEffect(() => {
    const onRank = async (e: Event) => {
      const d = (e as CustomEvent).detail as { placeId?: string; name?: string; bucket?: Bucket } | undefined
      if (!currentUser || !d?.placeId || !d?.bucket) return
      const ranking = await rankingService.getRanking(currentUser.id)
      const list = (ranking[d.bucket] || []).filter(x => x.id !== d.placeId)
      const item: RankedItem = { id: d.placeId, name: d.name || 'this place' }
      const a: Active = { item, bucket: d.bucket, list, lo: 0, hi: list.length, comparisons: 0 }
      setPhase('compare')
      setResult(null)
      if (list.length === 0) {
        // Nothing to compare against — it's the first in this bucket.
        setActive(a)
        void commit(a, 0)
      } else {
        setActive(a)
      }
    }
    window.addEventListener('this-is:rank-place', onRank as EventListener)
    return () => window.removeEventListener('this-is:rank-place', onRank as EventListener)
  }, [currentUser, commit])

  if (!active) return null

  const pivotIndex = Math.floor((active.lo + active.hi) / 2)
  const pivot = active.list[pivotIndex]

  const choose = (preferNew: boolean) => {
    haptics.select()
    let lo = active.lo
    let hi = active.hi
    if (preferNew) hi = pivotIndex // new ranks above the pivot
    else lo = pivotIndex + 1 // new ranks below the pivot
    const comparisons = active.comparisons + 1
    if (lo >= hi || comparisons >= MAX_COMPARISONS) {
      void commit(active, lo)
    } else {
      setActive({ ...active, lo, hi, comparisons })
    }
  }

  // "Skip" still places it — at the current best estimate — so a partial
  // comparison still yields a score (never a dead end).
  const skip = () => {
    haptics.tap()
    void commit(active, Math.floor((active.lo + active.hi) / 2))
  }

  return (
    <div className="fixed inset-0 z-[9998] flex items-end justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-walnut-deep/40 backdrop-blur-[2px]" onClick={close} />
      <div
        ref={sheetRef}
        className="modal-paper relative w-full max-w-md bg-paper rounded-t-[24px] border-t border-x border-edge shadow-cozy overflow-hidden"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 1rem)' }}
      >
        {/* Drag handle */}
        <div data-drag-handle className="pt-3 pb-1 flex justify-center cursor-grab active:cursor-grabbing">
          <span className="w-10 h-1 rounded-full bg-edge" />
        </div>

        {phase === 'result' && result ? (
          <div key="result" className="px-6 pt-3 pb-7 text-center">
            <p className="label-eyebrow text-ink-mute">Your score</p>
            <p className="font-display text-[64px] leading-none text-ink mt-2" style={{ color: 'var(--accent-deep)' }}>
              {result.score.toFixed(1)}
            </p>
            <p className="font-display-italic text-[16px] text-ink-soft mt-3 leading-snug">
              {result.total <= 1
                ? `Your first ${BUCKET_LABEL[result.bucket]} spot.`
                : `Ranked #${result.rank} of ${result.total} of your ${BUCKET_LABEL[result.bucket]} places.`}
            </p>
            <button
              type="button"
              onClick={() => { haptics.tap(); close() }}
              className="btn-cta press h-11 px-6 mt-6 label-eyebrow inline-flex items-center"
            >
              Done
            </button>
          </div>
        ) : !pivot ? (
          <div className="px-6 py-12 text-center">
            <p className="label-eyebrow text-ink-mute">Ranking…</p>
          </div>
        ) : (
          <div className="px-6 pt-2 pb-6">
            <p className="label-eyebrow text-ink-mute text-center">Which did you prefer?</p>
            <div className="mt-4 grid grid-cols-2 gap-3 items-stretch">
              <ChoiceCard label={active.item.name} sub="New" onClick={() => choose(true)} disabled={busy} />
              <ChoiceCard label={pivot?.name || ''} sub="Already ranked" onClick={() => choose(false)} disabled={busy} />
            </div>
            <div className="mt-5 flex items-center justify-center gap-1.5">
              {Array.from({ length: Math.min(MAX_COMPARISONS, Math.max(1, Math.ceil(Math.log2((active.list.length || 1) + 1)))) }).map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${i <= active.comparisons ? 'w-5 bg-[var(--accent)]' : 'w-1.5 bg-edge'}`}
                  aria-hidden="true"
                />
              ))}
            </div>
            <button
              type="button"
              onClick={skip}
              disabled={busy}
              className="block mx-auto mt-4 label-eyebrow text-ink-mute hover:text-ink press min-h-[44px] px-3 disabled:opacity-50"
            >
              Skip
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function ChoiceCard({ label, sub, onClick, disabled }: { label: string; sub: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="press relative min-h-[120px] rounded-[16px] border border-edge bg-card hover:border-ink/30 transition-colors px-4 py-4 flex flex-col justify-between text-left disabled:opacity-60"
    >
      <span className="font-mono text-[9px] tracking-[0.16em] uppercase text-ink-mute">{sub}</span>
      <span className="font-display text-[19px] leading-tight text-ink line-clamp-3">{label}</span>
    </button>
  )
}
