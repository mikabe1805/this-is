/**
 * The save toast — the trust surface of the one action that isn't discovery.
 * "Saved to your list — Undo", a WANT/BEEN toggle, a ghost note link. One flat
 * list now (DIRECTION.md: boards gone), so there's no "Change board".
 */
import { useNavigate } from 'react-router-dom'
import { dismissToast, useToast } from '../state/toast'
import { useSaveFlow } from '../data/queries'
import { haptics } from '../lib/haptics'

export default function SaveToastHost() {
  const toast = useToast()
  const { undo, setStatus } = useSaveFlow()
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
    undo.mutate(toast.receipt)
    dismissToast()
  }

  const toggleBeen = () => {
    const next = toast.status === 'been' ? 'want' : 'been'
    setStatus.mutate({ pinId: toast.pinId, status: next })
  }

  const addNote = () => {
    dismissToast()
    navigate(`/p/${toast.pinId}?note=1`)
  }

  return (
    <div className="toast glass-chrome" role="status">
      <div className="toast-row">
        <p className="toast-text">Saved to your list</p>
        <button className="toast-action press" onClick={onUndo}>Undo</button>
      </div>
      <div className="toast-row toast-row-secondary">
        <div className="toast-status" role="group" aria-label="Save as">
          <button
            className={`toast-status-opt press${toast.status === 'want' ? ' is-on' : ''}`}
            onClick={toast.status === 'want' ? undefined : toggleBeen}
          >
            WANT
          </button>
          <button
            className={`toast-status-opt press${toast.status === 'been' ? ' is-on' : ''}`}
            onClick={toast.status === 'been' ? undefined : toggleBeen}
          >
            BEEN
          </button>
        </div>
        <button className="toast-ghost press" onClick={addNote}>add a note</button>
      </div>
    </div>
  )
}
