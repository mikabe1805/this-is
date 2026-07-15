/**
 * KEEP — a flat, beautifully filtered memory of everywhere
 * you Want / Tried / Loved. No boards; the tag filter is the whole structure.
 */
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useSession } from '../state/session'
import { useMySaves } from '../data/queries'
import { KeepGrid } from '../components/KeepGrid'
import { PinVisual } from '../components/PinVisual'
import { EmptyScene } from '../components/EmptyScene'
import { typeLabel } from '../data/vibes'
import { signIn } from '../lib/authWatch'
import { prototypeFailure, prototypeKind } from '../lib/prototypeMode'
import type { FriendSave, Tag } from '../data/social'
import { categoryPrimaryType } from '../domain/placeMemory'
import { isPermissionDeniedError } from '../domain/dataState'

const FILTERS: Tag[] = ['want', 'tried', 'loved']
const EMPTY_SAVES: FriendSave[] = []

export default function Saved() {
  const session = useSession()
  const navigate = useNavigate()
  const savesQuery = useMySaves()
  const saves = savesQuery.data
  const [filter, setFilter] = useState<Tag>('want')
  const groupPrototype = prototypeKind() === 'group'
  const prototypeColdError = groupPrototype && prototypeFailure('keep-permission')
  const prototypeWarmError = groupPrototype && prototypeFailure('keep-refresh')
  const savesError = prototypeColdError ? { code: 'permission-denied' } : savesQuery.error
  const coldLoadFailed = session.status === 'signed-in'
    && Boolean(savesError)
    && (prototypeColdError || saves === undefined)
  const warmRefreshFailed = session.status === 'signed-in'
    && !coldLoadFailed
    && Boolean(prototypeWarmError || savesQuery.error)
  const savesReady = session.status === 'signed-in' && !coldLoadFailed && !savesQuery.isPending

  // Hooks must run on every render path — compute these above any early return
  // (the signed-out branch below) so the hook order never changes.
  const all = coldLoadFailed ? EMPTY_SAVES : saves ?? EMPTY_SAVES
  const resolved = useMemo(() => all.filter(save => save.memory), [all])
  const unresolved = useMemo(() => all.filter(save => !save.memory), [all])
  const counts = useMemo(() => ({
    want: resolved.filter(s => s.tag === 'want').length,
    tried: resolved.filter(s => s.tag === 'tried').length,
    loved: resolved.filter(s => s.tag === 'loved').length,
  }), [resolved])
  if (session.status === 'signed-out') {
    return (
      <div className="page">
        <header className="page-header"><h1 className="eyebrow">KEEP</h1></header>
        <section className="empty-state">
          <EmptyScene />
          <h2 className="t-display">The places you have an opinion about.</h2>
          <p className="t-body">Sign in and everything you Want, Tried, or Loved lives here.</p>
          <button className="pill pill-primary press" onClick={() => void signIn()}>
            Continue with Google
          </button>
        </section>
      </div>
    )
  }

  const shown = resolved.filter(s => s.tag === filter)
  const retrySaves = () => {
    if (prototypeColdError || prototypeWarmError) {
      const next = new URL(window.location.href)
      next.searchParams.delete('failure')
      window.location.assign(next.toString())
      return
    }
    void savesQuery.refetch()
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="eyebrow">KEEP</h1>
          {all.length > 0 && (
            <p className="eyebrow stat-line">{all.length} PLACE{all.length === 1 ? '' : 'S'}</p>
          )}
        </div>
        {!coldLoadFailed && (
          <div className="keep-header-actions">
            <Link to="/add?mode=discover" className="pill pill-primary press">Discover</Link>
            <Link to="/add" className="pill pill-ghost press">Add</Link>
          </div>
        )}
      </header>

      {coldLoadFailed && (
        <section className="empty-state" role="alert">
          <p className="eyebrow">PRIVATE KEEP</p>
          <h2 className="t-display">We couldn’t load your places.</h2>
          <p className="t-body">
            {isPermissionDeniedError(savesError)
              ? 'No place labels, notes, or sharing state were shown. Check your account access and try again.'
              : 'Your Keep may still be there. No place labels or notes were shown or changed.'}
          </p>
          <button className="pill pill-primary press" onClick={retrySaves}>Try again</button>
        </section>
      )}

      {!coldLoadFailed && savesQuery.isPending && (
        <div className="keep-skeleton skeleton" aria-hidden />
      )}

      {savesReady && (
        all.length === 0 ? (
          <section className="empty-state">
            <EmptyScene />
            <h2 className="t-display">Nothing kept yet.</h2>
            <p className="t-body">Discover with a temporary area, or add somewhere you already know. Every place waits for your Want, Tried, or Loved review.</p>
            <div className="empty-state-actions">
              <Link to="/add?mode=discover" className="pill pill-primary press">Discover places</Link>
              <Link to="/add" className="pill pill-ghost press">Add one I know</Link>
            </div>
          </section>
        ) : (
          <>
          {unresolved.length > 0 && (
            <section className="place-memory-recovery" aria-labelledby="place-memory-recovery-title">
              <p className="eyebrow">A QUICK CLEANUP</p>
              <h2 id="place-memory-recovery-title" className="t-row-title">
                {unresolved.length} saved {unresolved.length === 1 ? 'place needs' : 'places need'} your label
              </h2>
              <p className="t-small">Old provider names stay unconfirmed. Open each place and name it in your own words.</p>
              <div className="place-memory-recovery-actions">
                {unresolved.map((save, index) => (
                  <button
                    key={save.id}
                    className="pill pill-ghost press"
                    onClick={() => navigate(`/p/${save.placeId}`)}
                  >
                    Label saved place {index + 1}
                  </button>
                ))}
              </div>
            </section>
          )}
          <div className="seg" role="tablist" aria-label="Keep filter">
            {FILTERS.map(f => (
              <button
                key={f}
                role="tab"
                aria-selected={filter === f}
                className={`seg-tab press${filter === f ? ' is-active' : ''}`}
                onClick={() => setFilter(f)}
              >
                {f} {counts[f] > 0 ? counts[f] : ''}
              </button>
            ))}
          </div>
          {shown.length === 0 ? (
            <p className="t-small thin-feed">Nothing tagged {filter} yet.</p>
          ) : (
            <KeepGrid>
              {shown.map(s => (
                <KeepCard key={s.id} save={s} />
              ))}
            </KeepGrid>
          )}
          {warmRefreshFailed && (
            <section className="keep-data-warning" role="status">
              <span>
                <small className="eyebrow">LAST LOADED KEEP</small>
                <strong className="t-row-title">Keep updates couldn’t be checked.</strong>
                <span className="t-small">These places are from your last successful load. Nothing was changed.</span>
              </span>
              <button className="pill pill-ghost press" onClick={retrySaves}>Check Keep updates</button>
            </section>
          )}
          </>
        )
      )}
    </div>
  )
}

function KeepCard({ save }: { save: FriendSave }) {
  const memory = save.memory
  if (!memory) return null
  return (
    <Link
      to={`/p/${encodeURIComponent(save.placeId)}`}
      className={`pin-card press${save.tag === 'loved' ? ' is-been' : ''}`}
      aria-label={memory.label}
    >
      <PinVisual
        hex={memory.hex}
        alt={memory.label}
      />
      <div className="pin-scrim" aria-hidden />
      {/* Earned light: only Loved gets the picture-light plaque; Want/Tried get
          a quiet chip, so the strongest memories visibly glow warmer. */}
      {save.tag === 'loved' ? (
        <span className="been-mark eyebrow">loved</span>
      ) : (
        <span className={`wall-tag eyebrow fg-${save.tag}`}>{save.tag}</span>
      )}
      <div className="pin-caption">
        {save.note && <p className="pin-pov">“{save.note}”</p>}
        <h3 className="pin-title">{memory.label}</h3>
        <p className="pin-chip eyebrow">
          {[typeLabel(categoryPrimaryType(memory.category)), memory.area].filter(Boolean).join(' · ')}
        </p>
      </div>
    </Link>
  )
}
