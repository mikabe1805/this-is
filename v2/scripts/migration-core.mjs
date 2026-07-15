const TAGS = new Set(['want', 'tried', 'loved'])
const TIE_RANK = { want: 0, tried: 1, loved: 2 }

function millis(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    return Number.isNaN(parsed) ? 0 : parsed
  }
  if (value && typeof value.toMillis === 'function') return value.toMillis()
  if (value && typeof value.seconds === 'number') return value.seconds * 1000
  return 0
}

function tagFrom(value) {
  return typeof value === 'string' && TAGS.has(value.toLowerCase())
    ? value.toLowerCase()
    : null
}

function inferredListTag(list) {
  const explicit = tagFrom(list?.autoStatus)
  if (explicit) return explicit
  const normalized = String(list?.name ?? list?.listName ?? '').trim().toLowerCase()
  const match = normalized.match(/^all\s+(want|tried|loved)$/)
  return match ? match[1] : null
}

function googlePlaceId(legacyId, place) {
  const explicit = String(place?.googlePlaceId ?? '').trim()
  if (explicit) return explicit.startsWith('g:') ? explicit.slice(2) : explicit
  const id = String(legacyId ?? '').trim()
  if (id.startsWith('g:')) return id.slice(2)
  if (id.startsWith('ChIJ')) return id
  return null
}

const CATEGORY_HEX = {
  food: '#704739', drinks: '#633C48', coffee: '#5A463C', activity: '#46525A', other: '#4A3A43',
}

function confirmedMemory(placeId, value) {
  const label = typeof value?.label === 'string' ? value.label.trim().replace(/\s+/g, ' ') : ''
  const category = typeof value?.category === 'string' ? value.category : ''
  if (!label || label.length > 120 || !(category in CATEGORY_HEX)) return null
  return { placeId, label, category, hex: CATEGORY_HEX[category], provenance: 'user_confirmed' }
}

function betterSignal(a, b) {
  if (a.explicit !== b.explicit) return a.explicit ? a : b
  if (a.ts !== b.ts) return a.ts > b.ts ? a : b
  if (a.sourceRank !== b.sourceRank) return a.sourceRank > b.sourceRank ? a : b
  if (TIE_RANK[a.tag] !== TIE_RANK[b.tag]) return TIE_RANK[a.tag] > TIE_RANK[b.tag] ? a : b
  if (Boolean(a.note) !== Boolean(b.note)) return a.note ? a : b
  if (a.note !== b.note) return a.note.localeCompare(b.note) >= 0 ? a : b
  return a.sourceKey.localeCompare(b.sourceKey) >= 0 ? a : b
}

/** Pure, deterministic migration plan. Unknown sentiment and unresolved Google
 * identity are reported, never guessed. Existing v2 signals are immutable. */
export function planLegacyMigration({
  uid,
  savedMarkers = [],
  lists = [],
  listPlacesByList = {},
  placesById = {},
  existingSaveIds = [],
  confirmedMemoriesByPlaceId = {},
  targetVisibility = 'private',
}) {
  if (!uid) throw new Error('uid is required')
  if (!['private', 'circle'].includes(targetVisibility)) {
    throw new Error('targetVisibility must be private or circle')
  }
  const signals = new Map()

  for (const marker of savedMarkers) {
    const legacyId = String(marker.placeId ?? marker.id ?? '')
    const tag = tagFrom(marker.status)
    if (!legacyId || !tag) continue
    const candidate = {
      legacyId,
      tag,
      note: typeof marker.note === 'string' ? marker.note.trim() : '',
      ts: millis(marker.savedAt ?? marker.ts),
      explicit: true,
      sourceRank: 1,
      source: 'savedPlaces',
      sourceKey: `savedPlaces:${legacyId}`,
    }
    signals.set(legacyId, signals.has(legacyId) ? betterSignal(signals.get(legacyId), candidate) : candidate)
  }

  for (const list of lists) {
    const listId = String(list.id ?? '')
    const inferred = inferredListTag(list)
    for (const row of listPlacesByList[listId] ?? []) {
      const legacyId = String(row.placeId ?? row.id ?? '')
      const explicitTag = tagFrom(row.status)
      const tag = explicitTag ?? inferred
      if (!legacyId || !tag) continue
      const candidate = {
        legacyId,
        tag,
        note: typeof row.note === 'string' ? row.note.trim() : '',
        ts: millis(row.addedAt ?? row.updatedAt),
        explicit: Boolean(explicitTag),
        sourceRank: explicitTag ? 3 : 2,
        source: explicitTag ? 'listPlace' : 'autoStatusList',
        sourceKey: `${listId}:${String(row.id ?? legacyId)}`,
      }
      signals.set(legacyId, signals.has(legacyId) ? betterSignal(signals.get(legacyId), candidate) : candidate)
    }
  }

  const allLegacyIds = new Set([
    ...savedMarkers.map(marker => String(marker.placeId ?? marker.id ?? '')).filter(Boolean),
    ...Object.values(listPlacesByList).flat().map(row => String(row.placeId ?? row.id ?? '')).filter(Boolean),
  ])
  const existingSaves = new Set(existingSaveIds)
  const creates = []
  const skipped = []

  for (const legacyId of [...allLegacyIds].sort()) {
    const signal = signals.get(legacyId)
    if (!signal) {
      skipped.push({ legacyId, reason: 'unknown_status' })
      continue
    }
    const legacyPlace = placesById[legacyId]
    const pid = googlePlaceId(legacyId, legacyPlace)
    if (!pid) {
      skipped.push({ legacyId, reason: 'unresolved_google_place_id', tag: signal.tag })
      continue
    }
    const placeId = `g:${pid}`
    const saveId = `${uid}__${placeId}`
    if (existingSaves.has(saveId)) {
      skipped.push({ legacyId, placeId, saveId, reason: 'existing_v2_signal' })
      continue
    }
    const memory = confirmedMemory(
      placeId,
      confirmedMemoriesByPlaceId[placeId] ?? confirmedMemoriesByPlaceId[legacyId],
    )
    if (!memory) {
      skipped.push({ legacyId, placeId, reason: 'needs_user_confirmation', tag: signal.tag })
      continue
    }
    creates.push({
      legacyId,
      saveId,
      placeId,
      save: {
        uid,
        placeId,
        tag: signal.tag,
        visibility: targetVisibility,
        ts: signal.ts,
        ...(signal.note ? { note: signal.note } : {}),
        memory,
      },
      provenance: { source: signal.source, legacyId },
    })
  }

  return {
    schemaVersion: 2,
    uid,
    summary: {
      legacyPlaceCount: allLegacyIds.size,
      plannedSignalCreates: creates.length,
      plannedPlaceCreates: 0,
      preservedTargetPlaces: 0,
      skippedCount: skipped.length,
      skippedByReason: skipped.reduce((counts, item) => {
        counts[item.reason] = (counts[item.reason] ?? 0) + 1
        return counts
      }, {}),
    },
    creates,
    skipped,
    rollback: {
      deleteSaveIds: creates.map(item => item.saveId),
      deletePlaceIds: [],
    },
  }
}
