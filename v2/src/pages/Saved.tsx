/**
 * SAVED — the taste portfolio and de-facto profile. Boards as a 2-col cover
 * grid, WANT/BEEN filters, and the honest metric: BEEN TO X OF Y.
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useSession } from '../state/session'
import { useBoards, usePins } from '../data/queries'
import { Masonry } from '../components/Masonry'
import { PinCard } from '../components/PinCard'
import { EmptyScene } from '../components/EmptyScene'
import type { Board, Pin } from '../data/types'

type Filter = 'boards' | 'want' | 'been'

export default function Saved() {
  const session = useSession()
  const { data: pins } = usePins()
  const { data: boards } = useBoards()
  const [filter, setFilter] = useState<Filter>('boards')

  const active = (pins ?? []).filter(p => p.status !== 'released')
  const been = active.filter(p => p.status === 'been').length

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">SAVED</p>
          {active.length > 0 && (
            <p className="eyebrow stat-line">BEEN TO {been} OF {active.length}</p>
          )}
        </div>
        <Link to="/settings" className="avatar-link press" aria-label="Settings">
          {session.status === 'signed-in' && session.user.photoURL ? (
            <img src={session.user.photoURL} alt="" className="avatar" referrerPolicy="no-referrer" />
          ) : (
            <span className="avatar avatar-empty" />
          )}
        </Link>
      </header>

      <div className="seg" role="tablist" aria-label="Saved filter">
        {(['boards', 'want', 'been'] as const).map(f => (
          <button
            key={f}
            role="tab"
            aria-selected={filter === f}
            className={`seg-tab press${filter === f ? ' is-active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f.toUpperCase()}
          </button>
        ))}
      </div>

      {filter === 'boards' && <BoardsGrid boards={boards ?? []} pins={active} />}
      {filter !== 'boards' && (
        <Masonry>
          {active.filter(p => p.status === filter).map(pin => (
            <PinCard key={pin.id} pin={pin} />
          ))}
        </Masonry>
      )}

      {filter === 'boards' && (boards ?? []).length === 0 && (
        <section className="empty-state">
          <EmptyScene />
          <h2 className="t-display">The lights are on. The walls are bare.</h2>
          <p className="t-body">Your first save starts your first board.</p>
          <Link to="/add" className="pill pill-primary press">Find your first</Link>
        </section>
      )}
    </div>
  )
}

function BoardsGrid({ boards, pins }: { boards: Board[]; pins: Pin[] }) {
  return (
    <div className="board-grid">
      {boards.map(b => (
        <BoardCover key={b.id} board={b} pins={pins.filter(p => p.boardIds.includes(b.id))} />
      ))}
    </div>
  )
}

function BoardCover({ board, pins }: { board: Board; pins: Pin[] }) {
  const hexes = pins.slice(0, 4).map(p => p.snapshot.hex)
  while (hexes.length < 4) hexes.push(board.coverHex)
  return (
    <Link to={`/board/${board.id}`} className="board-cover press">
      <div className="board-mosaic" aria-hidden>
        {hexes.map((h, i) => (
          <span key={i} style={{ '--dominant': h } as React.CSSProperties} />
        ))}
      </div>
      <div className="board-meta">
        <h3 className="t-title">{board.name}</h3>
        {/* The accession counter — a private collection's catalog (DESIGN.md). */}
        <p className="eyebrow">Nº {pins.length}</p>
      </div>
    </Link>
  )
}
