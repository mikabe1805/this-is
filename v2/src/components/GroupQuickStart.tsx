import { useLayoutEffect, useRef, useState } from 'react'
import {
  GROUP_QUICK_START_CATEGORIES,
  GROUP_QUICK_START_CONSTRAINTS,
  type GroupQuickStartCategory,
  type GroupQuickStartConstraint,
} from '../domain/groupQuickStart'
import { haptics } from '../lib/haptics'

const CATEGORY_LABELS: Record<GroupQuickStartCategory, string> = {
  food: 'Food', coffee: 'Coffee', activity: 'Things to do',
}
const CONSTRAINT_LABELS: Record<GroupQuickStartConstraint, string> = {
  quiet: 'Quiet', casual: 'Casual', outdoors: 'Outdoors',
  family_friendly: 'Family-friendly', special_occasion: 'Special occasion',
}

interface GroupQuickStartProps {
  groupName: string
  memberNames: string[]
  busy?: boolean
  uncertainAction?: 'save' | 'remove' | null
  initialCategoryHints?: GroupQuickStartCategory[]
  initialConstraintHints?: GroupQuickStartConstraint[]
  recovery?: {
    authorName: string
    placeLabel: string
    category: GroupQuickStartCategory
  }
  onSave(value: {
    categoryHints: GroupQuickStartCategory[]
    constraintHints: GroupQuickStartConstraint[]
  }): void
  onRetry?(): void
  onCancel(): void
  onRemove?: () => void
}

export function GroupQuickStart({
  groupName,
  memberNames,
  busy = false,
  uncertainAction = null,
  initialCategoryHints = [],
  initialConstraintHints = [],
  recovery,
  onSave,
  onRetry,
  onCancel,
  onRemove,
}: GroupQuickStartProps) {
  const [categories, setCategories] = useState<Set<GroupQuickStartCategory>>(() => new Set(initialCategoryHints))
  const [constraints, setConstraints] = useState<Set<GroupQuickStartConstraint>>(() => new Set(initialConstraintHints))
  const safeActionRef = useRef<HTMLButtonElement>(null)
  useLayoutEffect(() => {
    if (!uncertainAction) return
    safeActionRef.current?.focus()
  }, [uncertainAction])
  const toggle = <T extends string>(setter: (next: Set<T>) => void, current: Set<T>, value: T) => {
    const next = new Set(current)
    if (next.has(value)) next.delete(value)
    else next.add(value)
    haptics.tap()
    setter(next)
  }
  const canSave = categories.size + constraints.size > 0 && !busy && !uncertainAction

  return (
    <section className="group-quick-start" aria-labelledby="group-quick-start-title">
      <p className="eyebrow">QUICK START · OPTIONAL</p>
      <h2 id="group-quick-start-title" className="t-display">Give {groupName} one light hint.</h2>
      <p className="t-body">
        {recovery
          ? <>{recovery.authorName} shared {recovery.placeLabel} as a Want. Choose {CATEGORY_LABELS[recovery.category]} only if it generally sounds good to you; then this.is can show the place with both reasons named.</>
          : <>No place comes to mind? Choose Food, Coffee, or Things to do. A hint helps only when someone else shares a matching place; it is not a Want or Love.</>}
      </p>

      <fieldset className="group-quick-fieldset">
        <legend className="eyebrow">WHAT KIND USUALLY SOUNDS GOOD?</legend>
        <div className="group-quick-options">
          {GROUP_QUICK_START_CATEGORIES.map(option => (
            <button
              type="button"
              key={option}
              className={`chip press${categories.has(option) ? ' is-on' : ''}`}
              aria-pressed={categories.has(option)}
              disabled={busy || !!uncertainAction}
              onClick={() => toggle(setCategories, categories, option)}
            >
              {CATEGORY_LABELS[option]}
            </button>
          ))}
        </div>
      </fieldset>

      <details className="group-quick-later">
        <summary className="press" role="button" aria-label="Plan-fit hints for later">
          <span>
            <span className="eyebrow">PLAN-FIT HINTS · OPTIONAL FOR LATER</span>
            <span className="t-small">Quiet, casual, outdoors, and more</span>
          </span>
          <span className="group-quick-later-mark" aria-hidden>+</span>
        </summary>
        <div className="group-quick-later-body">
          <fieldset className="group-quick-fieldset">
            <legend className="eyebrow">WHAT HELPS A PLAN FIT?</legend>
            <div className="group-quick-options">
              {GROUP_QUICK_START_CONSTRAINTS.map(option => (
                <button
                  type="button"
                  key={option}
                  className={`chip press${constraints.has(option) ? ' is-on' : ''}`}
                  aria-pressed={constraints.has(option)}
                  disabled={busy || !!uncertainAction}
                  onClick={() => toggle(setConstraints, constraints, option)}
                >
                  {CONSTRAINT_LABELS[option]}
                </button>
              ))}
            </div>
          </fieldset>
          <p className="t-small">Saved with this group for later retrieval. These do not change current suggestions yet.</p>
        </div>
      </details>

      <p className="t-small group-quick-consent">
        Visible only to {memberNames.join(', ')}. Sharing this hint closes invitations for this group.
      </p>
      <div className="group-quick-actions">
        <button
          className="pill pill-primary press"
          disabled={uncertainAction ? busy || !onRetry : !canSave}
          onClick={() => uncertainAction
            ? onRetry?.()
            : onSave({ categoryHints: [...categories], constraintHints: [...constraints] })}
        >
          {busy
            ? uncertainAction === 'remove' ? 'Checking removal…' : 'Checking hint…'
            : uncertainAction === 'remove' ? 'Check removal' : uncertainAction === 'save' ? 'Check hint' : 'Share hint'}
        </button>
        <button
          ref={element => {
            safeActionRef.current = element
            if (element && uncertainAction && !busy) {
              window.requestAnimationFrame(() => window.requestAnimationFrame(() => element.focus()))
            }
          }}
          className="pill pill-ghost press"
          disabled={busy}
          onClick={onCancel}
        >{uncertainAction ? 'Close for now' : 'Back'}</button>
        {onRemove && !uncertainAction && (
          <button className="pill pill-ghost press" disabled={busy} onClick={onRemove}>Remove my hints</button>
        )}
      </div>
      {uncertainAction === 'save' && (
        <p className="t-small onboarding-error" role="alert">
          We couldn’t confirm whether your hint was shared. Checking again can only save these same choices; it cannot reopen invitations or share a place from Keep.
        </p>
      )}
      {uncertainAction === 'remove' && (
        <p className="t-small onboarding-error" role="alert">
          We couldn’t confirm whether your hints were removed. Checking again can only remove those same group hints; it cannot reopen invitations or remove anything from your personal Keep.
        </p>
      )}
    </section>
  )
}
