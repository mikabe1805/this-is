import {
  personalDiscoveryContinuation,
  personalDiscoveryMapsUrl,
  personalDiscoveryPrompts,
  personalDiscoveryQuery,
} from './personalDiscovery.js'

function equal(actual: unknown, expected: unknown, message = 'values differ') {
  if (actual !== expected) throw new Error(`${message}: expected ${String(expected)}, received ${String(actual)}`)
}

function deepEqual(actual: unknown, expected: unknown, message = 'values differ') {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(message)
}

const prompts = personalDiscoveryPrompts([
  { tag: 'loved', memory: { category: 'activity' } },
  { tag: 'want', memory: { category: 'activity' } },
  { tag: 'loved', memory: { category: 'coffee' } },
  { tag: 'tried', memory: { category: 'food' } },
])

deepEqual(prompts.map(prompt => prompt.category), ['activity', 'coffee', 'food', 'drinks'])
equal(prompts[0].detail, '1 Loved in your Keep')
equal(prompts.find(prompt => prompt.category === 'food')?.evidenceCount, 0,
  'Tried remains neutral and cannot become taste evidence')

deepEqual(
  personalDiscoveryPrompts([]).map(prompt => prompt.category),
  ['coffee', 'food', 'activity', 'drinks'],
  'empty Keep still offers broad skippable directions',
)
equal(personalDiscoveryQuery('coffee', '  Cresskill,   NJ '), 'coffee shops in Cresskill, NJ')
equal(personalDiscoveryQuery('food', ''), null)
equal(personalDiscoveryQuery('activity', 'x'.repeat(81)), null)
deepEqual(
  personalDiscoveryContinuation('coffee', '  Cresskill,   NJ '),
  { category: 'coffee', area: 'Cresskill, NJ' },
  'continuation keeps only the explicit normalized category and temporary area',
)
equal(personalDiscoveryContinuation(null, 'Cresskill, NJ'), null)
equal(personalDiscoveryContinuation('coffee', ''), null)
equal(
  personalDiscoveryMapsUrl('  coffee shops in Cresskill,   NJ  '),
  'https://www.google.com/maps/search/?api=1&query=coffee+shops+in+Cresskill%2C+NJ',
  'zero-API discovery hands only the normalized explicit query to Google Maps',
)
equal(personalDiscoveryMapsUrl(''), null)
equal(personalDiscoveryMapsUrl('x'.repeat(121)), null)

console.log('✓ personal discovery is explicit-area, locally taste-ordered, Tried-neutral, and zero-API capable')
