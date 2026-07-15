import type { PlaceObservationKey } from '../domain/placeObservations'
import { PLACE_OBSERVATION_LABELS } from '../domain/placeObservations'
import type { PlanContext } from '../domain/recommendation'

interface PickContextChipsProps {
  context: PlanContext
  planArea?: string
  requiredObservation?: PlaceObservationKey | null
  label: string
}

export function PickContextChips({
  context,
  planArea,
  requiredObservation,
  label,
}: PickContextChipsProps) {
  if (context === 'Anything' && !planArea && !requiredObservation) return null
  return (
    <div className="pick-context-chips" aria-label={label}>
      {context !== 'Anything' && <span>{context}</span>}
      {planArea && <span>{planArea}</span>}
      {requiredObservation && <span>{PLACE_OBSERVATION_LABELS[requiredObservation]}</span>}
    </div>
  )
}
