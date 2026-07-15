/**
 * The save toast — confirms your Want/Tried/Loved and lets you change it or
 * undo, without a confirm dialog. Re-tagging is one tap right here.
 */
import { useLayoutEffect, useRef } from 'react'
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
  const recoveryButtonRef = useRef<HTMLButtonElement>(null)
  const tagRecovery = setTag.isError ? setTag.variables : undefined
  const removalRecovery = unsave.isError ? unsave.variables : undefined

  useLayoutEffect(() => {
    const pending = tagRecovery ? setTag.isPending : removalRecovery ? unsave.isPending : false
    if ((!tagRecovery && !removalRecovery) || pending) return
    const button = recoveryButtonRef.current
    if (button && !button.disabled) button.focus()
  }, [removalRecovery, setTag.isPending, tagRecovery, unsave.isPending])

  if (!toast) return null

  if (tagRecovery) {
    return (
      <div className="toast glass-chrome" role="alert" aria-label="Toast Keep change not confirmed">
        <p className="toast-text">We couldn’t confirm {tagRecovery.tag} for this place. Checking repeats only that exact Keep change.</p>
        <div className="toast-row">
          <button
            ref={recoveryButtonRef}
            className="pill pill-primary press"
            disabled={setTag.isPending}
            onClick={() => { dismissToast(); setTag.mutate(tagRecovery) }}
          >{setTag.isPending ? 'Checking…' : 'Check Keep'}</button>
          <button className="toast-ghost press" disabled={setTag.isPending} onClick={dismissToast}>Close for now</button>
        </div>
      </div>
    )
  }

  if (removalRecovery) {
    return (
      <div className="toast glass-chrome" role="alert" aria-label="Toast Keep removal not confirmed">
        <p className="toast-text">We couldn’t confirm removal. Checking repeats only removal of that exact place.</p>
        <div className="toast-row">
          <button
            ref={recoveryButtonRef}
            className="pill pill-primary press"
            disabled={unsave.isPending}
            onClick={() => { dismissToast(); unsave.mutate(removalRecovery) }}
          >{unsave.isPending ? 'Checking…' : 'Check removal'}</button>
          <button className="toast-ghost press" disabled={unsave.isPending} onClick={dismissToast}>Close for now</button>
        </div>
      </div>
    )
  }

  if (toast.kind === 'notice') {
    return (
      <div className="toast glass-chrome" role="status">
        <p className="toast-text">{toast.text}</p>
      </div>
    )
  }

  const onUndo = () => {
    haptics.select()
    if (toast.prev) setTag.mutate({
      place: toast.place,
      tag: toast.prev,
      prev: toast.tag,
      privateOnly: toast.privateCapture ? true : undefined,
      reviewSharing: Boolean((toast.privateCapture || toast.reviewSharing) && toast.prev !== 'tried'),
      privateCapture: toast.privateCapture,
    })
    else unsave.mutate(toast.placeId)
    dismissToast()
  }

  const retag = (tag: Tag) => {
    if (tag === toast.tag) return
    setTag.mutate({
      place: toast.place,
      tag,
      prev: toast.tag,
      privateOnly: toast.privateCapture ? true : undefined,
      reviewSharing: Boolean((toast.privateCapture || toast.reviewSharing) && tag !== 'tried'),
      privateCapture: toast.privateCapture,
    })
  }

  const reviewSharing = Boolean((toast.privateCapture || toast.reviewSharing) && toast.tag !== 'tried')

  return (
    <div className="toast glass-chrome" role="status">
      <div className="toast-row">
        <p className="toast-text">
          <span className={`fg-tag fg-${toast.tag}`}>{toast.tag}</span> · {toast.privateCapture ? 'saved privately to Keep' : 'saved to Keep'}
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
          onClick={() => {
            dismissToast()
            navigate(`/p/${toast.placeId}?${reviewSharing ? 'sharing' : 'note'}=1`)
          }}
        >
          {reviewSharing ? 'Review sharing' : 'add a note'}
        </button>
      </div>
    </div>
  )
}
