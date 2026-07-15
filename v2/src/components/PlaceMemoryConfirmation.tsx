import { useState, type ReactNode } from 'react'
import {
  USER_PLACE_CATEGORIES,
  buildDurablePlaceMemory,
  type DurablePlaceMemory,
  type UserPlaceCategory,
} from '../domain/placeMemory'
import type { Tag } from '../domain/signals'
import { haptics } from '../lib/haptics'

const CATEGORY_LABELS: Record<UserPlaceCategory, string> = {
  food: 'Food',
  drinks: 'Drinks',
  coffee: 'Coffee',
  activity: 'Activity',
  other: 'Other',
}

const SIGNAL_OPTIONS: Array<{ tag: Tag; label: string; detail: string }> = [
  { tag: 'want', label: 'Want', detail: 'I want to go' },
  { tag: 'tried', label: 'Tried', detail: 'I have been' },
  { tag: 'loved', label: 'Loved', detail: 'I would return' },
]

const SIGNAL_GUIDANCE: Record<Tag, string> = {
  want: 'Something you want to try. This supports choosing it.',
  tried: 'You have been, but this alone does not support choosing it.',
  loved: 'You would return or recommend it. This is the strongest support.',
}

interface PlaceMemoryConfirmationProps {
  placeId: string
  googleLabel?: string
  googleContext?: string
  initialLabel?: string
  initialCategory?: UserPlaceCategory
  initialArea?: string
  guidance?: string
  actionLabel: string
  signalTag?: Tag | null
  onSignalTagChange?(tag: Tag): void
  shareAudience?: string
  shareIntent?: 'share' | 'private' | 'pending'
  additionalReview?: ReactNode
  additionalReviewReady?: boolean
  busy?: boolean
  locked?: boolean
  onConfirm(memory: DurablePlaceMemory): void
  onCancel(): void
}

export function PlaceMemoryConfirmation({
  placeId,
  googleLabel,
  googleContext,
  initialLabel = '',
  initialCategory,
  initialArea = '',
  guidance = 'Your own short label stays with your taste history. Google’s place facts do not.',
  actionLabel,
  signalTag,
  onSignalTagChange,
  shareAudience,
  shareIntent = 'share',
  additionalReview,
  additionalReviewReady = true,
  busy = false,
  locked = false,
  onConfirm,
  onCancel,
}: PlaceMemoryConfirmationProps) {
  const [label, setLabel] = useState(initialLabel)
  const [area, setArea] = useState(initialArea)
  const [category, setCategory] = useState<UserPlaceCategory | null>(initialCategory ?? null)
  const memory = category
    ? buildDurablePlaceMemory({ placeId, userLabel: label, category, userArea: area })
    : null
  const signalRequired = Boolean(onSignalTagChange)
  const confirmationReady = Boolean(memory)
    && (!signalRequired || Boolean(signalTag))
    && additionalReviewReady
  const areaField = signalRequired ? (
    <details className="place-memory-area place-memory-area-disclosure">
      <summary className="press">
        <span>
          <span className="eyebrow">OPTIONAL PLACE DETAIL</span>
          <strong>{area.trim() || 'Add an area'}</strong>
        </span>
        <span className="place-memory-area-marker" aria-hidden="true">+</span>
      </summary>
      <label>
        <span className="eyebrow">AREA</span>
        <input
          className="add-input"
          disabled={busy || locked}
          value={area}
          onChange={event => setArea(event.target.value)}
          placeholder="e.g. Cresskill, NJ"
          maxLength={80}
          autoComplete="off"
          aria-label="Area for this place"
        />
        <small className="t-small">Type a place area yourself. It never becomes your home or a location profile.</small>
      </label>
    </details>
  ) : (
    <label className="place-memory-area">
      <span className="eyebrow">AREA · OPTIONAL</span>
      <input
        className="add-input"
        disabled={busy || locked}
        value={area}
        onChange={event => setArea(event.target.value)}
        placeholder="e.g. Cresskill, NJ"
        maxLength={80}
        autoComplete="off"
        aria-label="Area for this place"
      />
      <small className="t-small">Type a place area yourself. It never becomes your home or a location profile.</small>
    </label>
  )

  return (
    <section className="place-memory-confirm" aria-labelledby="place-memory-title">
      <p className="eyebrow">MAKE IT YOURS</p>
      <h2 id="place-memory-title" className="t-display">What do you call this place?</h2>
      {googleLabel && (
        <p className="t-small place-memory-google">
          Google Maps place: <span translate="no">{googleLabel}</span>
          {googleContext && <small translate="no">{googleContext}</small>}
        </p>
      )}
      <p className="t-body">{guidance}</p>
      <input
        className="add-input"
        disabled={busy || locked}
        value={label}
        onChange={event => setLabel(event.target.value)}
        placeholder="e.g. the bakery by Sam"
        maxLength={120}
        autoComplete="off"
        aria-label="Your label for this place"
      />
      {!signalRequired && areaField}
      <fieldset className="place-memory-category">
        <legend className="eyebrow">PLACE KIND</legend>
        <p className="t-small">Choose one broad kind so it can fit a future plan.</p>
        <div className="place-memory-categories" role="group" aria-label="What kind of place is it?">
          {USER_PLACE_CATEGORIES.map(option => (
            <button
              key={option}
              className={`chip press${category === option ? ' is-on' : ''}`}
              aria-pressed={category === option}
              disabled={busy || locked}
              onClick={() => { haptics.tap(); setCategory(option) }}
            >
              {CATEGORY_LABELS[option]}
            </button>
          ))}
        </div>
      </fieldset>
      {onSignalTagChange && (
        <fieldset className="place-memory-signal">
          <legend className="eyebrow">YOUR EXPERIENCE</legend>
          <div className="place-memory-signal-options" role="group" aria-label="Keep this place as">
            {SIGNAL_OPTIONS.map(option => (
              <button
                key={option.tag}
                className={`place-memory-signal-option press${signalTag === option.tag ? ' is-on' : ''}`}
                aria-label={option.label}
                aria-pressed={signalTag === option.tag}
                disabled={busy || locked}
                onClick={() => { haptics.tap(); onSignalTagChange(option.tag) }}
              >
                <strong>{option.label}</strong>
                <span>{option.detail}</span>
              </button>
            ))}
          </div>
          <p className="t-small place-memory-signal-guidance" role="status">
            {signalTag
              ? SIGNAL_GUIDANCE[signalTag]
              : 'Choose the closest truth. Nothing is saved yet.'}
          </p>
        </fieldset>
      )}
      {shareAudience && (
        <section className="place-memory-audience" aria-label="Group sharing boundary">
          <p className="eyebrow">
            {shareIntent === 'share' ? 'SHARE WITH' : shareIntent === 'private' ? 'KEEP PRIVATE' : 'CHOOSE FIRST'}
          </p>
          <strong>
            {shareIntent === 'share'
              ? shareAudience
              : shareIntent === 'private'
                ? `Not shared with ${shareAudience}`
                : `Nothing shared with ${shareAudience} yet`}
          </strong>
          <p className="t-small">
            {shareIntent === 'share'
              ? 'Only this group receives the place. Your personal Keep remains yours.'
              : shareIntent === 'private'
                ? `Tried records that you’ve been, but it is not a reason to choose this place. Choose Want or Loved to introduce it to ${shareAudience}.`
                : `Want or Loved introduces it to ${shareAudience}. Tried keeps it private.`}
          </p>
        </section>
      )}
      {additionalReview}
      {signalRequired && areaField}
      <div className="place-memory-actions">
        <button
          className="pill pill-primary press"
          disabled={!confirmationReady || busy || locked}
          onClick={() => memory && onConfirm(memory)}
        >
          {busy ? 'Saving…' : actionLabel}
        </button>
        <button className="pill pill-ghost press" disabled={busy || locked} onClick={onCancel}>Cancel</button>
      </div>
    </section>
  )
}
