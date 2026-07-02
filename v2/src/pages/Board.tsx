import { Link, useParams } from 'react-router-dom'
import { useBoard, usePins } from '../data/queries'
import { Masonry } from '../components/Masonry'
import { PinCard } from '../components/PinCard'

export default function BoardPage() {
  const { id } = useParams<{ id: string }>()
  const board = useBoard(id)
  const { data: pins } = usePins()
  const members = (pins ?? []).filter(
    p => p.status !== 'released' && id && p.boardIds.includes(id)
  )
  const been = members.filter(p => p.status === 'been').length

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <Link to="/saved" className="eyebrow back-link press">← SAVED</Link>
          <h1 className="t-display">{board?.name ?? 'Board'}</h1>
          {members.length > 0 && (
            <p className="eyebrow stat-line">BEEN TO {been} OF {members.length}</p>
          )}
        </div>
      </header>

      {members.length === 0 ? (
        <section className="empty-state">
          <p className="t-body">Nothing hangs here yet.</p>
          <Link to="/add" className="pill pill-primary press">Add a place</Link>
        </section>
      ) : (
        <Masonry>
          {members.map(pin => (
            <PinCard key={pin.id} pin={pin} />
          ))}
        </Masonry>
      )}
    </div>
  )
}
