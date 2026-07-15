import { Link, useLocation } from 'react-router-dom'

export default function LegacyPairLink() {
  const { pathname } = useLocation()
  const wasInvite = pathname.startsWith('/i/')

  return (
    <div className="page together-page">
      <header className="masthead">
        <p className="eyebrow">TOGETHER</p>
        <h1 className="wordmark">this.is</h1>
      </header>
      <section className="empty-state together-empty">
        <div className="overlap-orbit is-empty" aria-hidden><span>2</span><span>6</span></div>
        <h2 className="t-display">
          {wasInvite ? 'This pair invite has retired.' : 'Pairs now live in groups.'}
        </h2>
        <p className="t-body">
          {wasInvite
            ? 'Ask the sender for a new group invitation. Groups can stay at two people or grow to six.'
            : 'Open Together to move an existing pair into an ordinary two-person group. Its audience stays the same.'}
        </p>
        <div className="empty-state-actions">
          <Link to="/together" className="pill pill-primary press">Open Together</Link>
          <Link to="/groups/new" className="pill pill-ghost press">Create a group</Link>
        </div>
      </section>
    </div>
  )
}
