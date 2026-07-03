/**
 * The save toast — confirms your Want/Tried/Loved and lets you change it or
 * undo, without a confirm dialog. Re-tagging is one tap right here.
 */
import { useNavigate } from 'react-router-dom'
import { dismissToast, useToast } from '../state/toast'
import { useSaveFlow } from '../data/queries'
import type { Tag } from '../data/social'
import { haptics } from '../lib/haptics'

const TAGS: Tag[] = ['want', 'tried', 'loved']

export default function SaveToastHost() {
  const toast = useToast()
  const { setTag, unsave } = useSaveFlow()
  const navigate = useNavigate()

  if (!toast) return null

  if (toast.kind === 'notice') {
    return (
      <div className="toast glass-chrome" role="status">
        <p className="toast-text">{toast.text}</p>
      </div>
    )
  }

  const onUndo = () => {
    haptics.select()
    if (toast.prev) setTag.mutate({ place: toast.place, tag: toast.prev, prev: toast.tag })
    else unsave.mutate(toast.placeId)
    dismissToast()
  }

  const retag = (tag: Tag) => {
    if (tag === toast.tag) return
    setTag.mutate({ place: toast.place, tag, prev: toast.tag })
  }

  return (
    <div className="toast glass-chrome" role="status">
      <div className="toast-row">
        <p className="toast-text">
          <span className={`fg-tag fg-${toast.tag}`}>{toast.tag}</span> · on your wall
        </p>
        <button className="toast-action press" onClick={onUndo}>Undo</button>
      </div>
      <div className="toast-row toast-row-secondary">
        <div className="toast-status" role="group" aria-label="Change tag">
          {TAGS.map(t => (
            <button
              key={t}
              className={`toast-status-opt press${toast.tag === t ? ' is-on' : ''}`}
              onClick={() => retag(t)}
            >
              {t}
            </button>
          ))}
        </div>
        <button
          className="toast-ghost press"
          onClick={() => { dismissToast(); navigate(`/p/${toast.placeId}?note=1`) }}
        >
          add a note
        </button>
      </div>
    </div>
  )
}
