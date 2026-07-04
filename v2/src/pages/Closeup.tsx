/**
 * The spot page — a shared memory (v2/FRIENDS.md). The room's hero + vitals,
 * then FROM YOUR PEOPLE (who tagged it and their notes), then your own
 * Want / Tried / Loved control and the door out to Google Maps. Below the fold,
 * MORE ON THE LIST.
 *
 * Cost (docs/GOOGLE.md): a curated room already has its facts, so we enrich
 * with the FREE photo-ref mask; only an uncurated place needs full Details.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getDetails, getPhotoRef, mapsDeepLink, photoUrl, type PlaceDetails } from '../lib/places'
import { rawPid } from '../data/types'
import { typeLabel } from '../data/vibes'
import { walkChip } from '../lib/geo'
import { useCurated, usePlaceSaves, useSaveFlow } from '../data/queries'
import { setSaveNote } from '../data/saves'
import type { Tag } from '../data/social'
import { useSession } from '../state/session'
import { signIn } from '../lib/authWatch'
import { haptics } from '../lib/haptics'
import { PinVisual } from '../components/PinVisual'
import { FriendGraph } from '../components/FriendGraph'
import { DiscoverCard } from '../components/DiscoverCard'
import { Masonry } from '../components/Masonry'

const TAGS: Tag[] = ['want', 'tried', 'loved']

/**
 * Remount per place: keying on placeId gives each spot page its own component
 * instance, so the note refs below belong to exactly one room — navigating
 * /p/A → /p/B via "MORE ON THE LIST" can never flush A's note against B.
 */
export default function Closeup() {
  const { placeId } = useParams<{ placeId: string }>()
  return <CloseupView key={placeId ?? ''} />
}

function CloseupView() {
  const { placeId } = useParams<{ placeId: string }>()
  const id = placeId ?? ''
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const session = useSession()
  const myUid = session.status === 'signed-in' ? session.user.uid : null

  const { data: curated } = useCurated()
  const { data: saves, isLoading: savesLoading } = usePlaceSaves(id)
  const { setTag, unsave, invalidate } = useSaveFlow()

  const curatedThis = curated?.find(c => c.id === id)

  // Curated → free photo-ref mask; uncurated → full Details (has name/type).
  const { data: details } = useQuery({
    queryKey: ['placeDetails', id, curatedThis ? 'ref' : 'full'],
    queryFn: async (): Promise<Partial<PlaceDetails> | null> =>
      curatedThis ? getPhotoRef(rawPid(id)) : getDetails(rawPid(id)),
    staleTime: Infinity,
    enabled: Boolean(id) && curated !== undefined,
  })

  const name = curatedThis?.name ?? details?.name ?? '…'
  const hex = curatedThis?.photoHex ?? '#3A2B31'
  const primaryType = curatedThis?.primaryType ?? details?.primaryType
  const neighborhood = curatedThis?.neighborhood
  const lat = curatedThis?.lat ?? details?.lat
  const lng = curatedThis?.lng ?? details?.lng
  const vibeTags = curatedThis?.vibeTags ?? []
  const chip = [walkChip(lat, lng, curatedThis?.coordsFetchedAt), typeLabel(primaryType), neighborhood]
    .filter(Boolean)
    .join(' · ')
  const photo = details?.photoResourceName ? photoUrl(details.photoResourceName, 800) : undefined

  const mySave = saves?.find(s => s.uid === myUid)
  const friends = useMemo(() => (saves ?? []).filter(s => s.uid !== myUid), [saves, myUid])
  const myTag = mySave?.tag

  // The acquisition: tapping Loved sweeps the picture-light across the hero
  // once (the celebrate haptic rides along via useSaveFlow).
  const [sweeping, setSweeping] = useState(false)

  const saveable = { id, name, primaryType, neighborhood, hex, lat, lng }
  const onTag = (tag: Tag) => {
    if (session.status !== 'signed-in') { haptics.tap(); void signIn(); return }
    if (myTag === tag) return
    if (tag === 'loved') {
      setSweeping(true)
      window.setTimeout(() => setSweeping(false), 380)
    }
    setTag.mutate({ place: saveable, tag, prev: myTag ?? null })
  }
  const onRemove = () => { if (mySave) unsave.mutate(id) }

  // ── your note on this room (dirty-guarded so refetches never clobber typing) ──
  const [note, setNote] = useState(mySave?.note ?? '')
  const noteDirty = useRef(false)
  const noteRef = useRef<HTMLTextAreaElement>(null)
  const savedNote = mySave?.note ?? ''
  useEffect(() => { if (!noteDirty.current) setNote(savedNote) }, [savedNote])
  useEffect(() => { if (params.get('note') === '1') noteRef.current?.focus() }, [params])
  const commitNote = () => {
    if (!mySave || !noteDirty.current) return
    // Nothing actually changed — clear the dirty flag so teardown doesn't write
    // a redundant no-op (and the old text can't bleed into a reused instance).
    if (note.trim() === (mySave.note ?? '')) { noteDirty.current = false; return }
    noteDirty.current = false
    void setSaveNote(id, note).then(invalidate)
  }
  const latest = useRef({ has: Boolean(mySave), note })
  latest.current = { has: Boolean(mySave), note }
  useEffect(() => () => {
    const { has, note: n } = latest.current
    if (has && noteDirty.current) void setSaveNote(id, n)
  }, [id])

  // MORE ON THE LIST — other curated rooms sharing a vibe / neighborhood.
  const related = useMemo(() => {
    const vibes = curatedThis?.vibeTags ?? []
    return (curated ?? [])
      .filter(c => c.id !== id)
      .filter(c => (c.vibeTags ?? []).some(t => vibes.includes(t)) || (neighborhood && c.neighborhood === neighborhood))
      .slice(0, 6)
  }, [curated, id, curatedThis, neighborhood])

  return (
    <div className={`page closeup${myTag === 'loved' ? ' is-loved' : ''}`}>
      <button className="eyebrow back-link press" onClick={() => navigate(-1)}>← BACK</button>

      <PinVisual hex={hex} photoSrc={photo} attribution={details?.photoAttribution} alt={name} className={`closeup-visual${sweeping ? ' is-sweeping' : ''}`} />

      <header className="closeup-head">
        {curatedThis && <p className="eyebrow closeup-onlist">ON THE LOW-LIT LIST</p>}
        <h1 className="t-display">{name}</h1>
        {chip && <p className="eyebrow">{chip}</p>}
        {curatedThis?.curatorPOV && <p className="closeup-pov">{curatedThis.curatorPOV}</p>}
        {vibeTags.length > 0 && (
          <div className="closeup-vibes">
            {vibeTags.map(t => <span key={t} className="chip closeup-vibe">{t.replace('-', ' ').toUpperCase()}</span>)}
          </div>
        )}
        {details?.address && <p className="t-small closeup-address">{details.address}</p>}
      </header>

      {/* The shared memory — who of your people has been here. */}
      {!savesLoading && <FriendGraph saves={friends} />}

      {/* Your Want / Tried / Loved + the door out. */}
      <div className="closeup-actions">
        <div className="seg" role="group" aria-label="Save as">
          {TAGS.map(t => (
            <button
              key={t}
              className={`seg-tab press${myTag === t ? ' is-active' : ''}`}
              aria-pressed={myTag === t}
              onClick={() => onTag(t)}
            >
              {t}
            </button>
          ))}
        </div>
        <a
          className="pill pill-primary press"
          href={mapsDeepLink(name, rawPid(id))}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => haptics.tap()}
        >
          Directions ↗
        </a>
      </div>

      {mySave && (
        <>
          <textarea
            ref={noteRef}
            className="closeup-note"
            aria-label="A note for your people"
            placeholder="a note for your people…"
            value={note}
            onChange={e => { noteDirty.current = true; setNote(e.target.value) }}
            onBlur={commitNote}
            rows={2}
          />
          <button className="toast-ghost press closeup-remove" onClick={onRemove}>
            remove from your wall
          </button>
        </>
      )}

      <p className="t-small closeup-attcol">
        Place data: <span className="google-mark">Google Maps</span>
        {details?.photoAttribution ? ` · photo ${details.photoAttribution}` : ''}
      </p>

      {related.length > 0 && (
        <section className="closeup-related">
          <p className="eyebrow section-label">MORE ON THE LIST</p>
          <Masonry>
            {related.map(c => <DiscoverCard key={c.id} place={c} />)}
          </Masonry>
        </section>
      )}
    </div>
  )
}
