import { onDocumentCreated, onDocumentUpdated, onDocumentDeleted } from 'firebase-functions/v2/firestore'
import * as admin from 'firebase-admin'

const db = admin.firestore()

// Helper: pick representative image from a post
function pickImageFromPost(post: any): string | null {
  if (!post) return null
  if (post.thumbnail) return String(post.thumbnail)
  if (Array.isArray(post.images) && post.images.length > 0) return String(post.images[0])
  return null
}

async function recomputeHubSummary(hubId: string): Promise<void> {
  // Aggregate top tags and pick most-liked post image
  const postsSnap = await db.collection('posts').where('hubId', '==', hubId).get()
  if (postsSnap.empty) return

  const posts = postsSnap.docs.map(d => ({ id: d.id, ...d.data() }))

  // Most liked (tie-breaker: newer createdAt wins)
  posts.sort((a: any, b: any) => {
    const la = typeof a.likes === 'number' ? a.likes : 0
    const lb = typeof b.likes === 'number' ? b.likes : 0
    if (lb !== la) return lb - la
    const ta = a.createdAt && a.createdAt.toDate ? a.createdAt.toDate().getTime() : 0
    const tb = b.createdAt && b.createdAt.toDate ? b.createdAt.toDate().getTime() : 0
    return tb - ta
  })
  const topPost = posts[0]
  const chosenImage = pickImageFromPost(topPost)

  // Tag frequencies
  const tagCounts = new Map<string, number>()
  for (const p of posts) {
    const ptags = Array.isArray((p as any).tags) ? (p as any).tags as string[] : []
    for (const t of ptags) {
      const key = String(t).toLowerCase()
      tagCounts.set(key, (tagCounts.get(key) || 0) + 1)
    }
  }
  const tagsDerived = Array.from(tagCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([t]) => t)

  const placeRef = db.collection('places').doc(hubId)
  const placeSnap = await placeRef.get()
  if (!placeSnap.exists) return
  const place = placeSnap.data() || {}

  const update: any = { tagsDerived }
  if (chosenImage) {
    if (place.mainImage !== chosenImage) update.mainImage = chosenImage
  }
  if (!Array.isArray(place.tags) || place.tags.length === 0) {
    update.tags = tagsDerived
  }

  if (Object.keys(update).length > 0) {
    await placeRef.update(update)
  }
}

// When a post is created, recompute the hub summary
export const onPostCreatedUpdateHub = onDocumentCreated('posts/{postId}', async (event) => {
  const post = event.data?.data()
  if (!post || !post.hubId) return
  try {
    await recomputeHubSummary(String(post.hubId))
  } catch (e) {
    console.warn('onPostCreatedUpdateHub failed', e)
  }
})

// When post likes change, recompute hub image if needed
export const onPostUpdatedMaybeUpdateHub = onDocumentUpdated('posts/{postId}', async (event) => {
  const before = event.data?.before.data()
  const after = event.data?.after.data()
  if (!after || !after.hubId) return
  const likesBefore = before?.likes ?? 0
  const likesAfter = after?.likes ?? 0
  if (likesBefore === likesAfter) return
  try {
    await recomputeHubSummary(String(after.hubId))
  } catch (e) {
    console.warn('onPostUpdatedMaybeUpdateHub failed', e)
  }
})

// When a place is saved to a list, increment savedCount.
export const onListPlaceCreated = onDocumentCreated('lists/{listId}/places/{placeId}', async (event) => {
  const placeId = event.params.placeId
  try {
    await db.collection('places').doc(placeId).update({ savedCount: admin.firestore.FieldValue.increment(1) })
  } catch (e) {
    console.warn('onListPlaceCreated increment failed', e)
  }
})

// When a place is removed from a list, decrement savedCount.
export const onListPlaceDeleted = onDocumentDeleted('lists/{listId}/places/{placeId}', async (event) => {
  const placeId = event.params.placeId
  try {
    await db.collection('places').doc(placeId).update({ savedCount: admin.firestore.FieldValue.increment(-1) })
  } catch (e) {
    console.warn('onListPlaceDeleted decrement failed', e)
  }
})


