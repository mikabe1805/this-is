import {
  PLACE_OBSERVATION_KEYS,
  PLACE_OBSERVATION_LABELS,
  setPlaceObservation,
  type PlaceObservations,
} from '../domain/placeObservations'

export function PlaceObservationsEditor({
  observations,
  busy,
  locked = false,
  onChange,
}: {
  observations: PlaceObservations
  busy: boolean
  locked?: boolean
  onChange(next: PlaceObservations): void
}) {
  return (
    <details className="place-observations">
      <summary className="press">
        <span>
          <span className="eyebrow">USEFUL DETAILS</span>
          <strong className="t-row-title">What would help your people choose?</strong>
        </span>
        <span aria-hidden>+</span>
      </summary>
      <div className="place-observations-body">
        <p className="t-small">Optional and private. If you later include these with a group, your yes or no stays attributed instead of becoming a rating.</p>
        <div className="place-observation-list">
        {PLACE_OBSERVATION_KEYS.map(key => {
          const current = observations[key]?.value
          return (
            <div className="place-observation-row" key={key}>
              <span>{PLACE_OBSERVATION_LABELS[key]}</span>
              <span className="place-observation-choice" role="group" aria-label={PLACE_OBSERVATION_LABELS[key]}>
                {(['yes', 'no'] as const).map(value => (
                  <button
                    key={value}
                    className={`press${current === value ? ' is-selected' : ''}`}
                    aria-pressed={current === value}
                    disabled={busy || locked}
                    onClick={() => onChange(setPlaceObservation(
                      observations,
                      key,
                      current === value ? null : value,
                    ))}
                  >
                    {value === 'yes' ? 'Yes' : 'No'}
                  </button>
                ))}
              </span>
            </div>
          )
        })}
        </div>
        {busy && <p className="t-small" role="status">Saving detail…</p>}
      </div>
    </details>
  )
}
