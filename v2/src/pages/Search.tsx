/**
 * SEARCH v1 — instant, typo-tolerant recall with minisearch, entirely
 * in-browser (no search SaaS, no LLM). The blueprint's structural fix for the
 * dead v1 search: token scoring over your own corpus makes multi-word and
 * vibe-ish queries actually hit.
 *
 *  - Zero query → a visual browse grid + recents, never an empty box.
 *  - Typing → instant local results, each labeled "matched: …" (no black-box
 *    recall), above a clearly-separated "ADD A NEW PLACE" Google lane.
 *  - Post-query → slideable guided chips derived from the real result set.
 *
 * The index covers your pins now; city-pool candidates fold in automatically
 * once a pool exists (they resolve to the same closeup route).
 */
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import MiniSearch from 'minisearch'
import { usePins, useBoards, useCandidates } from '../data/queries'
import { BROWSE_VIBES, vibesFor, typeLabel } from '../data/vibes'
import { cachedCoords, walkMinutes } from '../lib/geo'
import { Masonry } from '../components/Masonry'
import { PinCard } from '../components/PinCard'
import { PinVisual } from '../components/PinVisual'
import type { Pin, PlaceDoc } from '../data/types'
import { haptics } from '../lib/haptics'

type Doc = {
  id: string
  name: string
  tags: string
  note: string
  neighborhood: string
  boards: string
  kind: 'pin' | 'candidate'
}

const MS_OPTIONS = {
  fields: ['name', 'tags', 'note', 'neighborhood', 'boards'],
  storeFields: ['id', 'kind'],
  searchOptions: { prefix: true, fuzzy: 0.2, boost: { name: 3, tags: 2 } },
}

export default function Search() {
  const { data: pins } = usePins()
  const { data: boards } = useBoards()
  const coords = cachedCoords()
  const { data: candidates } = useCandidates(coords)
  const navigate = useNavigate()

  const [query, setQuery] = useState('')
  const [nearMe, setNearMe] = useState(false)

  const boardName = useMemo(() => {
    const m = new Map<string, string>()
    for (const b of boards ?? []) m.set(b.id, b.name)
    return m
  }, [boards])

  const active = useMemo(
    () => (pins ?? []).filter(p => p.status !== 'released'),
    [pins]
  )
  const pinById = useMemo(() => {
    const m = new Map<string, Pin>()
    for (const p of active) m.set(p.id, p)
    return m
  }, [active])
  const candById = useMemo(() => {
    const m = new Map<string, PlaceDoc>()
    for (const c of candidates ?? []) if (!pinById.has(c.id)) m.set(c.id, c)
    return m
  }, [candidates, pinById])

  const index = useMemo(() => {
    const ms = new MiniSearch<Doc>(MS_OPTIONS)
    const docs: Doc[] = []
    for (const p of active) {
      docs.push({
        id: p.id,
        name: p.snapshot.name,
        tags: [...vibesFor(p.snapshot.primaryType), typeLabel(p.snapshot.primaryType) ?? ''].join(' '),
        note: p.note ?? '',
        neighborhood: p.snapshot.neighborhood ?? '',
        boards: p.boardIds.map(b => boardName.get(b) ?? '').join(' '),
        kind: 'pin',
      })
    }
    for (const c of candById.values()) {
      docs.push({
        id: c.id,
        name: c.name,
        tags: [...(c.vibeTags ?? []), typeLabel(c.primaryType) ?? ''].join(' '),
        note: '',
        neighborhood: c.neighborhood ?? '',
        boards: '',
        kind: 'candidate',
      })
    }
    ms.addAll(docs)
    return ms
  }, [active, candById, boardName])

  const q = query.trim()
  const rawResults = useMemo(() => (q ? index.search(q) : []), [index, q])

  // Guided refine chips: the most common result tags not already queried.
  const guided = useMemo(() => {
    if (!rawResults.length) return []
    const counts: Record<string, number> = {}
    const queried = new Set(q.toLowerCase().split(/\s+/))
    for (const r of rawResults) {
      const pin = pinById.get(r.id)
      const tags = pin ? vibesFor(pin.snapshot.primaryType) : candById.get(r.id)?.vibeTags ?? []
      for (const t of tags) if (!queried.has(t)) counts[t] = (counts[t] ?? 0) + 1
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([t]) => t)
  }, [rawResults, pinById, candById, q])

  // Ranked result rows, optionally proximity-sorted by the NEAR ME chip.
  const results = useMemo(() => {
    const rows = rawResults.map(r => ({
      id: r.id as string,
      terms: (r.terms as string[]) ?? [],
      pin: pinById.get(r.id),
      cand: candById.get(r.id),
      score: r.score as number,
    }))
    if (nearMe) {
      const walkOf = (row: (typeof rows)[number]) => {
        const lat = row.pin?.snapshot.lat ?? row.cand?.lat
        const lng = row.pin?.snapshot.lng ?? row.cand?.lng
        const w = walkMinutes(lat, lng, row.pin?.snapshot.coordsAt ?? row.cand?.coordsFetchedAt)
        return w ?? Infinity
      }
      rows.sort((a, b) => walkOf(a) - walkOf(b))
    }
    return rows
  }, [rawResults, pinById, candById, nearMe])

  const recents = useMemo(() => active.slice(0, 6), [active])

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
        placeholder="cozy coffee, date night, a name…"
        value={query}
        onChange={e => setQuery(e.target.value)}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        aria-label="Search your places"
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
          <Link to="/add" className="pill pill-primary press add-lane">+ Add a new place</Link>
          {recents.length > 0 && (
            <>
              <p className="eyebrow section-label">RECENTLY TOUCHED</p>
              <Masonry>
                {recents.map(pin => <PinCard key={pin.id} pin={pin} />)}
              </Masonry>
            </>
          )}
        </>
      )}

      {q && (
        <>
          <div className="tonight-moods" role="group" aria-label="Refine">
            <button
              className={`chip press${nearMe ? ' is-on' : ''}`}
              onClick={() => { haptics.tap(); setNearMe(v => !v) }}
            >
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
              <p className="t-body">Nothing in your places matches “{q}”.</p>
              <Link to="/add" className="pill pill-primary press">Add it as a new place</Link>
            </section>
          ) : (
            <Masonry>
              {results.map(row =>
                row.pin ? (
                  <PinCard key={row.id} pin={row.pin} reason={`matched: ${row.terms.join(' · ')}`} />
                ) : row.cand ? (
                  <button
                    key={row.id}
                    className="pin-card press"
                    onClick={() => navigate(`/p/${row.id}`)}
                  >
                    <PinVisual hex={row.cand.photoHex ?? '#3A2B31'} alt={row.cand.name} />
                    <div className="pin-scrim" aria-hidden />
                    <div className="pin-caption">
                      <p className="pin-reason">matched: {row.terms.join(' · ')}</p>
                      <h3 className="pin-title">{row.cand.name}</h3>
                      <p className="pin-chip eyebrow">
                        {[typeLabel(row.cand.primaryType), row.cand.neighborhood].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                  </button>
                ) : null
              )}
            </Masonry>
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
