const OWNER_ROOTS = new Set(['userPreferences', 'userTaste', 'userRankings'])
const RELATION_SUBCOLLECTIONS = new Set(['friends', 'following', 'followers'])

function containsUid(value, uid) {
  if (value === uid) return true
  if (Array.isArray(value)) return value.some(item => containsUid(item, uid))
  if (value && typeof value === 'object') return Object.values(value).some(item => containsUid(item, uid))
  return false
}

function storageUrls(value, found = new Set()) {
  if (typeof value === 'string') {
    if (value.startsWith('gs://') || /firebasestorage\.googleapis\.com/i.test(value)) found.add(value)
  } else if (Array.isArray(value)) {
    value.forEach(item => storageUrls(item, found))
  } else if (value && typeof value === 'object') {
    Object.values(value).forEach(item => storageUrls(item, found))
  }
  return found
}

function action(kind, path, reason, patch) {
  return { kind, path, reason, ...(patch ? { patch } : {}) }
}

export function classifyLegacyRecord(uid, record) {
  const { path, data = {} } = record
  const parts = path.split('/').filter(Boolean)
  const [root] = parts

  if (path === `users/${uid}`) return action('delete_recursive', path, 'owner profile and every descendant')
  if (parts.length > 2 && root === 'users' && parts[1] === uid) {
    return action('covered_by_parent', path, 'descendant of the recursively deleted owner profile')
  }
  if (parts.length === 2 && OWNER_ROOTS.has(root) && parts[1] === uid) {
    return action('delete_document', path, 'owner-only legacy preference or derived taste state')
  }
  if (root === 'posts' && parts.length === 2 && data.userId === uid) {
    return action('delete_recursive', path, 'owner-authored post and comments')
  }
  if (root === 'lists' && parts.length === 2 && data.userId === uid) {
    return action('delete_recursive', path, 'owner-authored list and descendants')
  }
  if (root === 'threads' && parts.length === 2 && data.participants?.includes(uid)) {
    return action('delete_recursive', path, 'retired private conversation involving the owner')
  }
  if (root === 'saves' && parts.length === 2 && data.uid === uid) {
    return action('delete_document', path, 'owner-authored flat save signal')
  }
  if (root === 'analytics' && data.userId === uid) {
    return action('delete_document', path, 'identifiable owner analytics event')
  }
  if (root === 'hubs' && parts.length === 2 && (data.userId === uid || data.createdBy === uid)) {
    return action('delete_recursive', path, 'owner-authored legacy hub')
  }
  if (root === 'shares' && containsUid(data, uid)) {
    return action('delete_document', path, 'published snapshot still identifies the owner')
  }
  if (parts.at(-2) === 'comments' && data.userId === uid) {
    return action('delete_document', path, 'owner-authored comment')
  }
  if (parts.at(-2) === 'places' && parts[0] === 'lists' && data.addedBy === uid) {
    return action('delete_document', path, 'owner-authored place signal inside another legacy list')
  }
  if (parts.at(-2) === 'posts' && parts[0] === 'lists' && data.userId === uid) {
    return action('delete_document', path, 'owner-authored list-post membership')
  }
  if (root === 'places' && parts.length === 4 && parts[2] === 'saves' && parts[3] === uid) {
    return action('delete_document', path, 'owner save marker under a global place')
  }
  if (root === 'users' && parts.length === 4 && RELATION_SUBCOLLECTIONS.has(parts[2])
    && (parts[3] === uid || data.userId === uid)) {
    return action('delete_document', path, 'cross-user legacy relationship reference')
  }

  const arrayFields = ['likedBy', 'following', 'followers']
  const affected = arrayFields.filter(field => Array.isArray(data[field]) && data[field].includes(uid))
  if (affected.length) {
    return action('patch_document', path, 'remove owner identity from shared arrays', {
      removeUidFrom: affected,
      ...(affected.includes('likedBy') && typeof data.likes === 'number' ? { recomputeCount: 'likes' } : {}),
    })
  }
  if (root === 'places' && parts.length === 2 && Array.isArray(data.posts)
    && data.posts.some(post => post?.userId === uid)) {
    return action('patch_document', path, 'remove embedded copies of owner-authored posts', {
      removeEmbeddedPostsByUid: uid,
    })
  }
  if (containsUid(data, uid)) return action('manual_review', path, 'unclassified exact UID reference')
  return null
}

export function buildLegacyErasurePlan(uid, records) {
  if (!uid || typeof uid !== 'string') throw new Error('A Firebase UID is required.')
  const unique = new Map(records.map(record => [record.path, record]))
  const actions = []
  const storage = new Set()
  for (const record of [...unique.values()].sort((a, b) => a.path.localeCompare(b.path))) {
    const classified = classifyLegacyRecord(uid, record)
    if (!classified) continue
    actions.push(classified)
    if (['delete_recursive', 'delete_document'].includes(classified.kind)) {
      storageUrls(record.data, storage)
    }
  }
  const counts = actions.reduce((result, item) => {
    result[item.kind] = (result[item.kind] ?? 0) + 1
    return result
  }, {})
  return {
    schemaVersion: 1,
    uid,
    mode: 'read-only',
    policy: 'delete retired v1 owner data; delete retired private threads; scrub identity from shared facts',
    counts,
    actions,
    storageCandidates: [...storage].sort(),
  }
}

