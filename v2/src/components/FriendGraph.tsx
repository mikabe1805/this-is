/**
 * The friend graph — the "shared memory" heart of the spot page. Not a review
 * section: who of your people has been here, what they tagged it, and their
 * note read like a 1 AM text. Loved first. This is the moment discovery stops
 * being a utility and becomes uncovering a piece of a friend's life.
 */
import { Link } from 'react-router-dom'
import type { FriendSave } from '../data/social'
import { Avatar } from './Avatar'

export function FriendGraph({ saves }: { saves: FriendSave[] }) {
  if (!saves.length) return null
  return (
    <section className="friendgraph">
      <p className="eyebrow section-label">FROM YOUR PEOPLE</p>
      <div className="fg-list">
        {saves.map(s => (
          <div key={s.id} className="fg-row">
            {/* Tap a friend → the two of you: what you both love, where they can
                take you (/with/:uid). */}
            <Link className="fg-who press" to={`/with/${s.uid}`}>
              <Avatar name={s.user?.displayName ?? '?'} hex={s.user?.avatarHex ?? '#5A6B8E'} />
              <p className="fg-head">
                <span className="fg-name">{s.user?.displayName ?? 'Someone'}</span>{' '}
                <span className={`fg-tag fg-${s.tag}`}>{s.tag}</span>
              </p>
            </Link>
            {s.note && <p className="fg-note fg-note-indent">“{s.note}”</p>}
          </div>
        ))}
      </div>
    </section>
  )
}
