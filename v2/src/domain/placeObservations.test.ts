import {
  normalizePlaceObservations,
  observationsForGroup,
  practicalNeedObservationPatch,
  setPlaceObservation,
  type PlaceObservations,
} from './placeObservations.js'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

let observations: PlaceObservations = {}
observations = setPlaceObservation(observations, 'quiet', 'yes', 10)
observations = setPlaceObservation(observations, 'easy_parking', 'no', 11)
assert(normalizePlaceObservations(observations, 'private')?.quiet?.value === 'yes',
  'bounded private observations validate')
assert(normalizePlaceObservations(observations, 'group') === null,
  'private observations cannot masquerade as group-visible evidence')
const shared = observationsForGroup(observations)
assert(normalizePlaceObservations(shared, 'group')?.easy_parking?.value === 'no',
  'explicit sharing changes only the audience boundary')
assert(normalizePlaceObservations({ quiet: { ...observations.quiet, source: 'google' } }, 'private') === null,
  'provider-inferred observations fail closed')
assert(normalizePlaceObservations({ allergen_safe: observations.quiet }, 'private') === null,
  'unsupported safety claims fail closed')
observations = setPlaceObservation(observations, 'quiet', null)
assert(!observations.quiet, 'an observation can be explicitly cleared')
const needAnswer = practicalNeedObservationPatch('family_friendly', 'yes', 12)
assert(needAnswer?.key === 'family_friendly' && needAnswer.value === 'yes' && needAnswer.observedAt === 12,
  'an explicit Yes becomes one exact private observation patch')
assert(practicalNeedObservationPatch('family_friendly', 'not_sure', 13) === null,
  'Not sure creates no observation evidence')

console.log('✓ place observations stay bounded, user-authored, audience-explicit, and reversible')
