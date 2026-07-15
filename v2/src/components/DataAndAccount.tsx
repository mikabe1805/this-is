import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  AccountRequestError,
  accountDeletionOperationKey,
  clearAccountDeletionOperation,
  deletionCompletionStillBelongsTo,
  deleteMyAccount,
  exportMyData,
} from '../data/account'
import { reauthenticateUser, signOutUser } from '../lib/authWatch'
import { haptics } from '../lib/haptics'
import { showToast } from '../state/toast'
import { getSession } from '../state/session'
import { prototypeFailure, prototypeKind } from '../lib/prototypeMode'

export function DataAndAccount({ uid }: { uid: string }) {
  const queryClient = useQueryClient()
  const [exporting, setExporting] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [confirmation, setConfirmation] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleteUnknown, setDeleteUnknown] = useState(false)
  const [needsRecentLogin, setNeedsRecentLogin] = useState(false)
  const deleteTriggerRef = useRef<HTMLButtonElement>(null)
  const keepAccountRef = useRef<HTMLButtonElement>(null)
  const checkDeletionRef = useRef<HTMLButtonElement>(null)
  const prototypeResponseLost = useRef(false)
  const deletionOperationRef = useRef<string | null>(null)
  const prototype = prototypeKind() === 'group'

  const closeConfirmation = () => {
    if (deleting || deleteUnknown) return
    setConfirming(false)
    setConfirmation('')
    setDeleteError(null)
    setNeedsRecentLogin(false)
    window.requestAnimationFrame(() => deleteTriggerRef.current?.focus())
  }

  useEffect(() => {
    if (!confirming || deleting) return
    const button = deleteUnknown ? checkDeletionRef.current : keepAccountRef.current
    if (button && !button.disabled) button.focus()
  }, [confirming, deleteUnknown, deleting])

  const download = async () => {
    if (exporting) return
    setExporting(true)
    try {
      const data = await exportMyData()
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
      }))
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `this-is-export-${new Date().toISOString().slice(0, 10)}.json`
      document.body.append(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 0)
      haptics.tap()
      showToast({ kind: 'notice', text: 'Your private export is ready' })
    } catch {
      haptics.warn()
      showToast({ kind: 'notice', text: "Couldn't create your export — try again" })
    } finally {
      setExporting(false)
    }
  }

  const reauthenticate = async () => {
    try {
      await reauthenticateUser()
      setNeedsRecentLogin(false)
      setDeleteError('Identity confirmed. You can delete now.')
    } catch {
      setDeleteError('Sign out and back in, then return here to delete the account.')
    }
  }

  const remove = async () => {
    if (deleting || confirmation !== 'DELETE') return
    setDeleting(true)
    setDeleteError(null)
    try {
      if (prototype) {
        const key = '__this_is_account_deletion'
        if (!window.sessionStorage.getItem(key)) {
          window.sessionStorage.setItem(key, JSON.stringify({ confirmation: 'DELETE', startedAt: Date.now() }))
        }
        if (prototypeFailure('account-delete-response') && !prototypeResponseLost.current) {
          prototypeResponseLost.current = true
          throw new Error('prototype ambiguous account-deletion response')
        }
        setDeleteUnknown(false)
        setConfirmation('')
        setDeleteError('Deletion confirmed in this development fixture.')
        return
      }
      deletionOperationRef.current ??= accountDeletionOperationKey(uid)
      const completedOperationKey = deletionOperationRef.current
      await deleteMyAccount(completedOperationKey, uid)
      clearAccountDeletionOperation(uid, completedOperationKey)
      deletionOperationRef.current = null
      const currentSession = getSession()
      if (!deletionCompletionStillBelongsTo(uid)) return
      if (currentSession.status === 'signed-in' && currentSession.user.uid !== uid) return
      queryClient.clear()
      const signOut = signOutUser()
      await signOut.catch(() => {})
      window.location.assign('/together')
    } catch (error) {
      haptics.warn()
      if (error instanceof AccountRequestError && error.code === 'recent-login-required') {
        setDeleteUnknown(false)
        setNeedsRecentLogin(true)
        setDeleteError('For safety, confirm your identity again before deleting.')
      } else if (error instanceof AccountRequestError && error.code === 'account-changed') {
        setDeleteUnknown(false)
        setConfirmation('')
        setDeleteError('The signed-in account changed. Nothing was sent. Reopen account deletion for the current account.')
      } else {
        setDeleteUnknown(true)
      }
    } finally {
      setDeleting(false)
    }
  }

  return (
    <section className="data-account" aria-labelledby="data-account-title">
      <p id="data-account-title" className="eyebrow section-label">PRIVACY &amp; DATA</p>
      <p className="t-small data-account-copy">
        Download a private JSON copy of your profile, Keep history, notes and useful details, group
        memberships and contributions, invitations, Picks, current receipt records, and account activity.
      </p>

      {!confirming ? (
        <div className="data-account-actions">
          <button className="pill pill-ghost press" disabled={exporting} onClick={() => void download()}>
            {exporting ? 'Preparing…' : 'Export my data'}
          </button>
          <button
            ref={deleteTriggerRef}
            className="toast-ghost press data-delete-open"
            onClick={() => setConfirming(true)}
          >
            Delete this account
          </button>
        </div>
      ) : (
        <div
          className="data-delete-confirm"
          role="alertdialog"
          aria-labelledby="data-delete-title"
          aria-describedby="data-delete-consequence data-delete-legacy"
          onKeyDown={event => {
            if (event.key !== 'Escape' || deleting || deleteUnknown) return
            event.preventDefault()
            closeConfirmation()
          }}
        >
          <h2 id="data-delete-title" className="t-title">Delete this account?</h2>
          <p id="data-delete-consequence" className="t-body">
            This permanently removes the account data used by the current this.is app: your profile,
            Keep history, notes and useful details, group memberships and contributions, invitations,
            Picks and receipt records, account activity, and sign-in account.
          </p>
          <p id="data-delete-legacy" className="t-small data-delete-boundary">
            The frozen legacy production system has a separate owner-reviewed cleanup. This control
            does not claim to erase that data yet.
          </p>
          <p className="t-small">Type <strong>DELETE</strong> to continue. This cannot be undone.</p>
          <input
            className="add-input"
            value={confirmation}
            onChange={event => setConfirmation(event.target.value)}
            aria-label="Type DELETE to confirm account deletion"
            autoComplete="off"
            disabled={deleting || deleteUnknown}
          />
          {deleteUnknown && (
            <div className="closeup-data-warning" role="alert" aria-label="Account deletion not confirmed">
              <span>
                <strong className="t-row-title">Account deletion not confirmed.</strong>
                <span className="t-small">
                  Your account is locked against new writes and may already be gone. Checking repeats only this exact account deletion; it cannot restore data or affect another account.
                </span>
              </span>
            </div>
          )}
          {deleteError && <p className="t-small data-delete-error" role="status">{deleteError}</p>}
          {needsRecentLogin && (
            <button className="pill pill-ghost press" onClick={() => void reauthenticate()}>
              Confirm identity with Google
            </button>
          )}
          <div className="data-delete-actions">
            <button
              ref={keepAccountRef}
              className="pill pill-primary press"
              disabled={deleting || deleteUnknown}
              onClick={closeConfirmation}
            >
              {deleteUnknown ? 'Deletion started' : 'Keep my account'}
            </button>
            <button
              ref={checkDeletionRef}
              className={`pill press${deleteUnknown ? ' pill-primary' : ' pill-ghost data-delete-danger'}`}
              disabled={(!deleteUnknown && confirmation !== 'DELETE') || deleting || needsRecentLogin}
              onClick={() => void remove()}
              aria-label={deleteUnknown ? 'Check account deletion' : 'Permanently delete current account data'}
            >
              {deleting
                ? deleteUnknown ? 'Checking…' : 'Deleting…'
                : deleteUnknown ? 'Check deletion' : 'Permanently delete'}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
