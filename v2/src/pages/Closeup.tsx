/**
 * The place closeup (/p/:placeId) — never a dead end. Paints instantly from
 * the pin snapshot (zero joins), then enriches with one getDetails call —
 * allowed because arriving here IS the explicit user action. Below the fold:
 * MORE LIKE THIS, computed from your own pins, zero API calls.
 */
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getDetails, getPhotoRef, mapsDeepLink, photoUrl } from '../lib/places'
import { rawPid } from '../data/types'
import { typeLabel, vibesFor } from '../data/vibes'
import { walkChip } from '../lib/geo'
import { usePin, usePins, useSaveFlow } from '../data/queries'
import { refreshPinSnapshot, setPinNote } from '../data/pins'
import type { PlaceDetails } from '../lib/places'
import { uploadPinPhoto } from '../data/photos'
import { useSession } from '../state/session'
import { showToast } from '../state/toast'
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

  // THE MASK SPLIT (docs/GOOGLE.md #2): a saved pin already carries
  // name/type/coords in its snapshot, so enrich with the FREE photo-ref mask;
  // full (Pro-tier) details run only for unsaved deep-links, or as the 90-day
  // snapshot refresh that keeps the cache honest.
  const SNAPSHOT_FRESH_MS = 90 * 24 * 60 * 60 * 1000
  const snapshotFresh = Boolean(
    pin?.snapshot.coordsAt && Date.now() - pin.snapshot.coordsAt < SNAPSHOT_FRESH_MS
  )
  const pinsReady = pins !== undefined || session.status !== 'signed-in'
  const { data: details } = useQuery({
    queryKey: ['placeDetails', id, pin && snapshotFresh ? 'photoRef' : 'full'],
    queryFn: async (): Promise<Partial<PlaceDetails> | null> => {
      if (pin && snapshotFresh) return getPhotoRef(rawPid(id))
      const full = await getDetails(rawPid(id))
      if (pin && full) {
        // Refreshable-cache law: fold the fresh data back into the snapshot.
        void refreshPinSnapshot(pin.id, full).then(invalidate)
      }
      return full
    },
    staleTime: Infinity,
    enabled: Boolean(id) && pinsReady,
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
  // Your own photo is the cover; Google's (fresh, attributed) fills in behind it.
  const googlePhoto = details?.photoResourceName
    ? photoUrl(details.photoResourceName, 800)
    : undefined
  const photo = pin?.userPhotoPath ?? googlePhoto

  // ── your photo becomes the cover ──
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const onPhotoPicked = async (file: File | undefined) => {
    if (!file || !pin || uploading) return
    setUploading(true)
    try {
      await uploadPinPhoto(pin.id, file)
      haptics.success()
      invalidate()
      showToast({ kind: 'notice', text: 'Your photo is the cover now' })
    } catch {
      haptics.warn()
      showToast({ kind: 'notice', text: "Couldn't upload that — try again" })
    } finally {
      setUploading(false)
    }
  }

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
        attribution={photo === googlePhoto ? details?.photoAttribution : undefined}
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

          <div className="closeup-photo-row">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={e => {
                void onPhotoPicked(e.target.files?.[0])
                e.target.value = ''
              }}
            />
            <button
              className="toast-ghost press"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              {uploading
                ? 'uploading…'
                : pin.userPhotoPath
                  ? 'change your photo'
                  : 'add your photo — it becomes the cover'}
            </button>
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
        details?.id &&
        details.name && (
          <div className="closeup-actions">
            <button
              className="pill pill-primary press"
              disabled={save.isPending}
              onClick={() =>
                save.mutate({
                  place: {
                    id: details.id!,
                    name: details.name!,
                    address: details.address,
                    primaryType: details.primaryType,
                    lat: details.lat,
                    lng: details.lng,
                  },
                })
              }
            >
              Save this place
            </button>
          </div>
        )
      )}

      {/* Required attribution: Google-sourced place data, shown mapless
          (docs/GOOGLE.md, decision 3). */}
      <p className="t-small closeup-attcol">
        Place data: <span className="google-mark">Google Maps</span>
      </p>

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
