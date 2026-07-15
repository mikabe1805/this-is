import { useId, useLayoutEffect, useRef, type CSSProperties, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import type { GroupSummary } from '../domain/groups'

interface GroupAudienceConfirmationProps {
  group: GroupSummary
  sharingLabel: 'hint' | 'place'
  operation?: 'share' | 'update'
  includeCurrentNote?: boolean
  includeUsefulDetails?: boolean
  privateSaved?: boolean
  changed?: boolean
  onWait(): void
  onConfirm(): void
}

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export function GroupAudienceConfirmation({
  group,
  sharingLabel,
  operation = 'share',
  includeCurrentNote = false,
  includeUsefulDetails = false,
  privateSaved = false,
  changed = false,
  onWait,
  onConfirm,
}: GroupAudienceConfirmationProps) {
  const titleId = useId()
  const descriptionId = useId()
  const dialogRef = useRef<HTMLElement>(null)
  const safeActionRef = useRef<HTMLButtonElement>(null)
  const openerRef = useRef<HTMLElement | null>(null)
  const onWaitRef = useRef(onWait)
  const memberCount = group.members.length
  const invitationsOpen = !group.membershipLocked
  const updating = operation === 'update'
  const includedFields = [
    includeCurrentNote ? 'current note' : null,
    includeUsefulDetails ? 'useful details' : null,
  ].filter((value): value is string => Boolean(value))

  useLayoutEffect(() => {
    onWaitRef.current = onWait
  }, [onWait])

  useLayoutEffect(() => {
    const activeElement = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    if (!activeElement || !dialogRef.current?.contains(activeElement)) openerRef.current = activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    safeActionRef.current?.focus({ preventScroll: true })
    const captureKeyboard = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        onWaitRef.current()
        return
      }
      if (event.key === 'Tab' && !dialogRef.current?.contains(document.activeElement)) {
        event.preventDefault()
        safeActionRef.current?.focus({ preventScroll: true })
      }
    }
    document.addEventListener('keydown', captureKeyboard, true)
    return () => {
      document.removeEventListener('keydown', captureKeyboard, true)
      document.body.style.overflow = previousOverflow
      const opener = openerRef.current
      if (opener?.isConnected) opener.focus({ preventScroll: true })
    }
  }, [])

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onWaitRef.current()
      return
    }
    if (event.key !== 'Tab') return
    const focusable = [...(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? [])]
    if (focusable.length === 0) {
      event.preventDefault()
      return
    }
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return createPortal(
    <div className="group-audience-confirmation-backdrop">
      <aside
        ref={dialogRef}
        className="group-audience-confirmation"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onKeyDown={handleKeyDown}
      >
        <div className="group-audience-confirmation-glow" aria-hidden />
        <div className="group-audience-confirmation-copy">
          <p className="eyebrow">
            {changed
              ? 'SHARING CIRCLE CHANGED'
              : `${memberCount} PEOPLE · ${invitationsOpen ? 'INVITATIONS OPEN' : 'INVITATIONS CLOSED'}`}
          </p>
          <h2 id={titleId} className="t-title">Confirm sharing circle</h2>
          <p id={descriptionId} className="t-body">
            {changed
              ? updating
                ? `The people in ${group.name} changed before the included-detail update could be confirmed. Review the current circle before trying again. The place remains shared with its last confirmed details.${invitationsOpen ? '' : ' Invitations are already closed and will stay closed.'}`
                : privateSaved
                  ? `This place is already in your private Keep. The people in ${group.name} changed before group sharing could be confirmed. Review the current circle before trying again.${invitationsOpen ? '' : ' Invitations are already closed and will stay closed.'}`
                  : `The people in ${group.name} changed before this ${sharingLabel} could be confirmed. Review the current circle before trying again.${invitationsOpen ? '' : ' Invitations are already closed and will stay closed.'}`
              : `This is the first ${sharingLabel} shared with ${group.name}. Sharing closes invitations so it can never reach someone who joins later.`}
          </p>
        </div>

        <section className="group-audience-confirmation-members" aria-label={`${group.name} sharing circle, ${memberCount} people`}>
          <p className="eyebrow">EXACTLY THESE {memberCount}</p>
          <ul>
            {group.members.map(member => (
              <li key={member.uid}>
                <span className="group-audience-confirmation-avatar" style={{ '--member-color': member.avatarHex } as CSSProperties} aria-hidden>
                  {member.displayName.slice(0, 1).toUpperCase()}
                </span>
                <strong>{member.displayName}</strong>
              </li>
            ))}
          </ul>
        </section>

        <p className="t-small group-audience-confirmation-boundary">
          {includedFields.length > 0
            ? `This shares the reviewed ${sharingLabel} + ${includedFields.join(' + ')}. Everything else in your private Keep stays private.`
            : `Your private Keep stays private. Only this reviewed ${sharingLabel} is shared with the people above.`}
        </p>
        <div className="group-audience-confirmation-actions">
          <button ref={safeActionRef} className="pill pill-ghost press" onClick={onWait}>
            {updating ? 'Keep current sharing' : invitationsOpen ? 'Wait for everyone' : sharingLabel === 'place' ? 'Keep private' : 'Not now'}
          </button>
          <button className="pill pill-primary press" onClick={onConfirm}>
            {updating
              ? `Update included details for these ${memberCount}`
              : <>Share with these {memberCount}{invitationsOpen ? ' & close invitations' : ''}</>}
          </button>
        </div>
      </aside>
    </div>,
    document.body,
  )
}
