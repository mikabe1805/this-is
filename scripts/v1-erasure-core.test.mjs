import assert from 'node:assert/strict'
import { buildLegacyErasurePlan } from './v1-erasure-core.mjs'

const uid = 'owner-123'
const records = [
  { path: `users/${uid}`, data: { displayName: 'Owner', avatar: 'https://firebasestorage.googleapis.com/profile.jpg' } },
  { path: `users/${uid}/savedPlaces/p1`, data: { placeId: 'p1' } },
  { path: 'users/other/followers/owner-123', data: { userId: uid } },
  { path: 'userPreferences/owner-123', data: { searchHistory: ['private query'] } },
  { path: 'posts/post-1', data: { userId: uid, images: ['gs://bucket/post.jpg'] } },
  { path: 'posts/other-post', data: { userId: 'other', likedBy: [uid, 'other'], likes: 2 } },
  { path: 'posts/other-post/comments/c1', data: { userId: uid, text: 'mine' } },
  { path: 'lists/list-1', data: { userId: uid } },
  { path: 'lists/other/places/p1', data: { addedBy: uid, note: 'mine' } },
  { path: 'threads/a__b', data: { participants: ['other', uid] } },
  { path: 'analytics/userInteractions/events/e1', data: { userId: uid } },
  { path: 'places/p1/saves/owner-123', data: { savedAt: 1 } },
  { path: 'places/p1', data: { posts: [{ userId: uid }, { userId: 'other' }] } },
  { path: 'mystery/x', data: { nested: { actor: uid } } },
]

const plan = buildLegacyErasurePlan(uid, records)
assert.equal(plan.mode, 'read-only')
assert.equal(plan.counts.delete_recursive, 4)
assert.equal(plan.counts.delete_document, 6)
assert.equal(plan.counts.patch_document, 2)
assert.equal(plan.counts.covered_by_parent, 1)
assert.equal(plan.counts.manual_review, 1)
assert.deepEqual(plan.storageCandidates, [
  'gs://bucket/post.jpg',
  'https://firebasestorage.googleapis.com/profile.jpg',
])
assert(plan.actions.some(item => item.path === 'threads/a__b' && item.kind === 'delete_recursive'))
assert(plan.actions.some(item => item.path === 'posts/other-post' && item.patch?.recomputeCount === 'likes'))
assert(plan.actions.some(item => item.path === 'mystery/x' && item.kind === 'manual_review'))

console.log('✓ v1 erasure plan covers owner, shared, derived, relationship, analytics, and Storage surfaces')
console.log('✓ unclassified UID references stop for manual review')
