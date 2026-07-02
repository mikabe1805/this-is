/**
 * The place closeup (/p/:placeId) — never a dead end. Paints instantly from
 * the pin snapshot (zero joins), then enriches with one getDetails call —
 * allowed because arriving here IS the explicit user action. Below the fold:
 * MORE LIKE THIS, computed from your own pins, zero API calls.
 */
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getDetails, mapsDeepLink, photoUrl } from '../lib/places'
import { rawPid } from '../data/types'
import { typeLabel, vibesFor } from '../data/vibes'
import { walkChip } from '../lib/geo'
import { usePin, usePins, useSaveFlow } from '../data/queries'
import { setPinNote } from '../data/pins'
import { useSession } from '../state/session'
import { recordGo } from '../lib/goEvents'
import { haptics } from '../lib/haptics'
import { PinVisual } from '../components/PinVisual'
import { Masonry } from '../components/Masonry'
import { PinCard } from '../components/PinCard'

export default function Closeup() {
  const { placeId } = useParams<{ placeId: string }>()
  const id = placeId ?? ''
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const session = useSession()
  const pin = usePin(id)
  const { data: pins } = usePins()
  const { save, setStatus, invalidate } = useSaveFlow()

  const { data: details } = useQuery({
    queryKey: ['placeDetails', id],
    queryFn: () => getDetails(rawPid(id)),
    staleTime: Infinity,
    enabled: Boolean(id),
  })

  const name = pin?.snapshot.name ?? details?.name ?? '…'
  const hex = pin?.snapshot.hex ?? '#3A2B31'
  const primaryType = pin?.snapshot.primaryType ?? details?.primaryType
  const neighborhood = pin?.snapshot.neighborhood
  const lat = pin?.snapshot.lat ?? details?.lat
  const lng = pin?.snapshot.lng ?? details?.lng
  const chip = [
    walkChip(lat, lng, pin?.snapshot.coordsAt),
    typeLabel(primaryType),
    neighborhood,
  ]
    .filter(Boolean)
    .join(' · ')
  const photo = details?.photoResourceName ? photoUrl(details.photoResourceName, 800) : undefined

  // ── note editing ──
  // Dirty-guarded: background refetches never clobber in-progress typing, and
  // leaving the page (hardware back included) commits instead of losing it.
  const [note, setNote] = useState(pin?.note ?? '')
  const noteDirty = useRef(false)
  const noteRef = useRef<HTMLTextAreaElement>(null)
  const pinNote = pin?.note ?? ''
  useEffect(() => {
    if (!noteDirty.current) setNote(pinNote)
  }, [pinNote])
  useEffect(() => {
    if (params.get('note') === '1') noteRef.current?.focus()
  }, [params])
  const commitNote = () => {
    if (!pin || !noteDirty.current || note.trim() === (pin.note ?? '')) return
    noteDirty.current = false
    void setPinNote(pin.id, note).then(invalidate)
  }
  const latest = useRef({ pin, note })
  latest.current = { pin, note }
  useEffect(
    () => () => {
      const { pin: p, note: n } = latest.current
      if (p && noteDirty.current && n.trim() !== (p.note ?? '')) {
        void setPinNote(p.id, n)
      }
    },
    []
  )

  // ── related: shared vibe or same neighborhood, from your own pins ──
  const vibes = vibesFor(primaryType)
  const related = (pins ?? [])
    .filter(p => p.id !== id && p.status !== 'released')
    .filter(p => {
      const pv = vibesFor(p.snapshot.primaryType)
      return (
        pv.some(t => vibes.includes(t)) ||
        (neighborhood && p.snapshot.neighborhood === neighborhood)
      )
    })
    .slice(0, 8)

  const toggleStatus = (status: 'want' | 'been') => {
    if (!pin || pin.status === status) return
    setStatus.mutate({ pinId: pin.id, status })
  }

  return (
    <div className={`page closeup${pin?.status === 'been' ? ' is-been' : ''}`}>
      <button className="eyebrow back-link press" onClick={() => navigate(-1)}>← BACK</button>

      <PinVisual
        hex={hex}
        photoSrc={photo}
        attribution={details?.photoAttribution}
        alt={name}
        className="closeup-visual"
      />

      <header className="closeup-head">
        <h1 className="t-display">{name}</h1>
        {chip && <p className="eyebrow">{chip}</p>}
        {details?.address && <p className="t-small closeup-address">{details.address}</p>}
      </header>

      {pin ? (
        <>
          <div className="closeup-actions">
            <div className="seg" role="group" aria-label="Status">
              <button
                className={`seg-tab press${pin.status === 'want' ? ' is-active' : ''}`}
                onClick={() => toggleStatus('want')}
              >
                WANT
              </button>
              <button
                className={`seg-tab press${pin.status === 'been' ? ' is-active' : ''}`}
                onClick={() => toggleStatus('been')}
              >
                BEEN
              </button>
            </div>
            <a
              className="pill pill-primary press"
              href={mapsDeepLink(name, rawPid(id))}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => { haptics.tap(); recordGo(id, name) }}
            >
              Open in Google Maps ↗
            </a>
          </div>

          <textarea
            ref={noteRef}
            className="closeup-note"
            placeholder="a note to yourself…"
            value={note}
            onChange={e => {
              noteDirty.current = true
              setNote(e.target.value)
            }}
            onBlur={commitNote}
            rows={2}
          />
        </>
      ) : (
        session.status === 'signed-in' &&
        details && (
          <div className="closeup-actions">
            <button
              className="pill pill-primary press"
              disabled={save.isPending}
              onClick={() => save.mutate({ place: details })}
            >
              Save this place
            </button>
          </div>
        )
      )}

      {related.length > 0 && (
        <section className="closeup-related">
          <p className="eyebrow section-label">MORE LIKE THIS, FROM YOUR BOARDS</p>
          <Masonry>
            {related.map(p => (
              <PinCard key={p.id} pin={p} />
            ))}
          </Masonry>
        </section>
      )}
    </div>
  )
}
