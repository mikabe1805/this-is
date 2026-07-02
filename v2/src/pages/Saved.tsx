/**
 * SAVED — a single flat "want to go" list (DIRECTION.md: boards demoted).
 * The places you kept from the discovery feed, most-recent first, with a
 * WANT / BEEN filter. No boards, no board picker — organizing saves is a
 * save-manager, and this is a discovery product.
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useSession } from '../state/session'
import { usePins } from '../data/queries'
import { Masonry } from '../components/Masonry'
import { PinCard } from '../components/PinCard'
import { EmptyScene } from '../components/EmptyScene'
import { signIn } from '../lib/authWatch'

type Filter = 'want' | 'been'

export default function Saved() {
  const session = useSession()
  const { data: pins } = usePins()
  const [filter, setFilter] = useState<Filter>('want')

  if (session.status === 'signed-out') {
    return (
      <div className="page">
        <header className="page-header">
          <p className="eyebrow">SAVED</p>
        </header>
        <section className="empty-state">
          <EmptyScene />
          <h2 className="t-display">The rooms you’re keeping.</h2>
          <p className="t-body">Sign in and everything you save from the list lives here.</p>
          <button className="pill pill-primary press" onClick={() => void signIn()}>
            Continue with Google
          </button>
        </section>
      </div>
    )
  }

  const active = (pins ?? []).filter(p => p.status !== 'released')
  const been = active.filter(p => p.status === 'been').length
  const shown = active.filter(p => p.status === filter)

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">SAVED</p>
          {active.length > 0 && (
            <p className="eyebrow stat-line">
              {active.length} KEPT{been > 0 ? ` · BEEN TO ${been}` : ''}
            </p>
          )}
        </div>
      </header>

      {active.length === 0 ? (
        <section className="empty-state">
          <EmptyScene />
          <h2 className="t-display">Nothing kept yet.</h2>
          <p className="t-body">Save a room from the list and it waits for you here.</p>
          <Link to="/home" className="pill pill-primary press">Back to the list</Link>
        </section>
      ) : (
        <>
          <div className="seg" role="tablist" aria-label="Saved filter">
            {(['want', 'been'] as const).map(f => (
              <button
                key={f}
                role="tab"
                aria-selected={filter === f}
                className={`seg-tab press${filter === f ? ' is-active' : ''}`}
                onClick={() => setFilter(f)}
              >
                {f === 'want' ? 'WANT TO GO' : 'BEEN'}
              </button>
            ))}
          </div>
          {shown.length === 0 ? (
            <p className="t-small thin-feed">
              {filter === 'want' ? 'Nothing on the want list right now.' : 'Mark a place Been from its page.'}
            </p>
          ) : (
            <Masonry>
              {shown.map(pin => <PinCard key={pin.id} pin={pin} />)}
            </Masonry>
          )}
        </>
      )}
    </div>
  )
}
