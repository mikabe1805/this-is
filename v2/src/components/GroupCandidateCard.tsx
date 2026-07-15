import { buildCandidateCardPresentation } from '../domain/candidateCard'
import type { GroupRecommendation } from '../domain/groupRecommendation'
import type { PlanContext } from '../domain/recommendation'
import { PinVisual } from './PinVisual'
import { useGroupPlacePhoto } from '../lib/useGroupPlacePhoto'
import { useEffect, useRef, useState } from 'react'

interface GroupCandidateCardProps {
  groupId: string
  candidate: GroupRecommendation
  context: PlanContext
  selected: boolean
  disabled?: boolean
  onSelect(): void
  onRequestPass(): void
}

export function GroupCandidateCard({
  groupId,
  candidate,
  context,
  selected,
  disabled = false,
  onSelect,
  onRequestPass,
}: GroupCandidateCardProps) {
  const memory = candidate.save.memory
  const cardRef = useRef<HTMLElement>(null)
  const [photoVisible, setPhotoVisible] = useState(false)
  useEffect(() => {
    const element = cardRef.current
    if (!element || photoVisible) return
    if (!('IntersectionObserver' in window)) {
      setPhotoVisible(true)
      return
    }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        setPhotoVisible(true)
        observer.disconnect()
      }
    }, { rootMargin: '80px 0px' })
    observer.observe(element)
    return () => observer.disconnect()
  }, [photoVisible])
  const photo = useGroupPlacePhoto(groupId, candidate.save.placeId, photoVisible)
  if (!memory) return null
  const card = buildCandidateCardPresentation({
    reasonCode: candidate.reasonCode,
    category: memory.category,
    context,
    supportCount: candidate.supportCount,
    totalMembers: candidate.totalMembers,
    area: memory.area,
  })
  const observationPhrase = (names: string[], value: 'yes' | 'no') => {
    if (names.length === 0) return null
    const people = names.length <= 2 ? names.join(' + ') : `${names[0]} + ${names.length - 1}`
    return `${people}: ${value}`
  }

  return (
    <article ref={cardRef} className={`group-candidate-card is-${card.kind}${selected ? ' is-selected' : ''}`}>
      <div className="group-candidate-main">
        <span className={`group-candidate-visual material-${card.fallbackMaterial}`}>
          <PinVisual
            hex={memory.hex}
            alt={memory.label}
            photoSrc={photo.src}
            attribution={photo.attribution}
            attributionUri={photo.sourceUri}
          />
          {!photo.src && <span className="candidate-fallback-label">NO PHOTO · PLACE MARK</span>}
        </span>
        <button
          className="group-candidate-choice press"
          data-select-place-id={candidate.save.placeId}
          aria-label={selected ? `${memory.label} selected for this plan` : `Choose ${memory.label} for this plan`}
          aria-pressed={selected}
          disabled={disabled}
          onClick={onSelect}
        >
          <span className="group-candidate-copy">
            <span className="group-evidence-label">{card.evidenceLabel}</span>
            <strong className="t-row-title">{memory.label}</strong>
            <span className="candidate-fact-line">
              <span className="candidate-category">{card.categoryLabel}</span>
              {card.areaLabel && <span className="candidate-area">{card.areaLabel}</span>}
              {card.contextLabel && <span className="candidate-verified">{card.contextLabel}</span>}
            </span>
            <span className="candidate-summary">{card.summary}</span>
            <span className="group-reason"><b>Why for us:</b> {candidate.reason}</span>
            {candidate.sharedNote && (
              <span className="candidate-member-note">
                <span>“{candidate.sharedNote.text}”</span>
                <small>— {candidate.sharedNote.authorName}</small>
              </span>
            )}
            {candidate.sharedObservations && candidate.sharedObservations.length > 0 && (
              <span className="candidate-observations" aria-label="Group-shared useful details">
                {candidate.sharedObservations.map(observation => (
                  <span key={observation.key}>
                    <b>{observation.label}</b>
                    <small>
                      {[observationPhrase(observation.yesNames, 'yes'), observationPhrase(observation.noNames, 'no')]
                        .filter(Boolean).join(' · ')}
                    </small>
                  </span>
                ))}
              </span>
            )}
            <span className="candidate-unknown">{card.verificationNote}</span>
          </span>
          <span className="group-select-mark" aria-hidden>{selected ? 'Chosen ✓' : 'Choose →'}</span>
        </button>
      </div>
      <footer className="candidate-card-footer">
        <details className="candidate-sources">
          <summary
            className="press"
            role="button"
            aria-label={`How this card knows: ${memory.label}`}
          >
            How this card knows
          </summary>
          <div className="candidate-source-list" aria-label="Card sources">
            {card.sources.map(source => (
              <span key={source.label}><b>{source.label}</b> · {source.value}</span>
            ))}
            {candidate.sharedObservations && candidate.sharedObservations.length > 0 && (
              <span><b>Details</b> · Attributed member observations</span>
            )}
          </div>
        </details>
        <button
          className="candidate-pass press"
          data-pass-place-id={candidate.save.placeId}
          aria-label={`Not for us: ${memory.label}`}
          disabled={disabled}
          onClick={onRequestPass}
        >
          Not for us
        </button>
      </footer>
    </article>
  )
}
