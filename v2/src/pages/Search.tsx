/**
 * SEARCH — instant, typo-tolerant recall with minisearch, entirely in-browser.
 * Indexes the discoverable rooms (curated + the city scaffold); zero query is a
 * browse grid, never an empty box; results are labeled "matched: …" (no
 * black-box recall) above a clearly-separated Google "add a place" lane.
 */
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import MiniSearch from 'minisearch'
import { useCandidates, useCurated } from '../data/queries'
import { BROWSE_VIBES, typeLabel } from '../data/vibes'
import { cachedCoords, walkMinutes } from '../lib/geo'
import { Masonry } from '../components/Masonry'
import { DiscoverCard } from '../components/DiscoverCard'
import type { PlaceDoc } from '../data/types'
import { haptics } from '../lib/haptics'

type Doc = { id: string; name: string; tags: string; note: string; neighborhood: string }

const MS_OPTIONS = {
  fields: ['name', 'tags', 'neighborhood'],
  storeFields: ['id'],
  searchOptions: { prefix: true, fuzzy: 0.2, boost: { name: 3, tags: 2 } },
}

export default function Search() {
  const coords = cachedCoords()
  const { data: curated } = useCurated()
  const { data: candidates } = useCandidates(coords)

  const [query, setQuery] = useState('')
  const [nearMe, setNearMe] = useState(false)

  // Curated first; scaffold fills in what curation hasn't reached.
  const placeById = useMemo(() => {
    const m = new Map<string, PlaceDoc>()
    for (const c of candidates ?? []) m.set(c.id, c)
    for (const c of curated ?? []) m.set(c.id, c) // curated wins on dupes
    return m
  }, [curated, candidates])

  const index = useMemo(() => {
    const ms = new MiniSearch<Doc>(MS_OPTIONS)
    ms.addAll(
      [...placeById.values()].map(c => ({
        id: c.id,
        name: c.name,
        tags: [...(c.vibeTags ?? []), typeLabel(c.primaryType) ?? '', c.curatorPOV ?? ''].join(' '),
        note: '',
        neighborhood: c.neighborhood ?? '',
      }))
    )
    return ms
  }, [placeById])

  const q = query.trim()
  const rawResults = useMemo(() => (q ? index.search(q) : []), [index, q])

  const guided = useMemo(() => {
    if (!rawResults.length) return []
    const counts: Record<string, number> = {}
    const queried = new Set(q.toLowerCase().split(/\s+/))
    for (const r of rawResults) {
      for (const t of placeById.get(r.id as string)?.vibeTags ?? []) {
        if (!queried.has(t)) counts[t] = (counts[t] ?? 0) + 1
      }
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([t]) => t)
  }, [rawResults, placeById, q])

  const results = useMemo(() => {
    const rows = rawResults
      .map(r => placeById.get(r.id as string))
      .filter((p): p is PlaceDoc => Boolean(p))
    if (nearMe) {
      rows.sort((a, b) => {
        const wa = walkMinutes(a.lat, a.lng, a.coordsFetchedAt) ?? Infinity
        const wb = walkMinutes(b.lat, b.lng, b.coordsFetchedAt) ?? Infinity
        return wa - wb
      })
    }
    return rows
  }, [rawResults, placeById, nearMe])

  const recents = useMemo(() => (curated ?? []).slice(0, 6), [curated])

  const runVibe = (tag: string) => {
    haptics.tap()
    setQuery(q ? `${q} ${tag}` : tag)
  }

  return (
    <div className="page">
      <header className="page-header">
        <p className="eyebrow">SEARCH</p>
      </header>

      <input
        className="add-input search-input"
        placeholder="cozy wine, listening bar, a name…"
        value={query}
        onChange={e => setQuery(e.target.value)}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        aria-label="Search rooms"
      />

      {!q && (
        <>
          <p className="eyebrow section-label">BROWSE BY VIBE</p>
          <div className="vibe-grid">
            {BROWSE_VIBES.map(v => (
              <button key={v.tag} className="vibe-tile eyebrow press" onClick={() => runVibe(v.tag)}>
                {v.label}
              </button>
            ))}
          </div>
          <Link to="/add" className="pill pill-primary press add-lane">+ Add a place</Link>
          {recents.length > 0 && (
            <>
              <p className="eyebrow section-label">ON THE LIST</p>
              <Masonry>{recents.map(c => <DiscoverCard key={c.id} place={c} />)}</Masonry>
            </>
          )}
        </>
      )}

      {q && (
        <>
          <div className="tonight-moods" role="group" aria-label="Refine">
            <button className={`chip press${nearMe ? ' is-on' : ''}`} onClick={() => { haptics.tap(); setNearMe(v => !v) }}>
              NEAR ME
            </button>
            {guided.map(tag => (
              <button key={tag} className="chip press" onClick={() => runVibe(tag)}>
                {tag.replace('-', ' ').toUpperCase()}
              </button>
            ))}
          </div>

          {results.length === 0 ? (
            <section className="search-empty">
              <p className="t-body">Nothing on the list matches “{q}”.</p>
              <Link to="/add" className="pill pill-primary press">Add it as a new place</Link>
            </section>
          ) : (
            <Masonry>{results.map(place => <DiscoverCard key={place.id} place={place} />)}</Masonry>
          )}

          <div className="add-lane-block">
            <p className="eyebrow section-label">NOT HERE?</p>
            <Link to="/add" className="pill pill-ghost press">ADD A NEW PLACE — via Google</Link>
          </div>
        </>
      )}
    </div>
  )
}
