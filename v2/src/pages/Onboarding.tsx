/**
 * Onboarding — up to two quick steps that establish useful history:
 *   1. "Who are you?" — name + avatar color. This is how friends recognize you
 *      in Together, so it comes first.
 *   2. "Add a few places" — optional real Loves that give overlap evidence.
 * Finishing writes { onboardedAt } and drops you on Together. Invitation
 * onboarding stops after identity and returns to consent; contribution belongs
 * after explicit membership, inside that group's own welcome.
 *
 * Every step is skippable except a name; no dead ends and no abstract taste quiz.
 * confirm dialogs. Signed-out users get sent to sign-in first.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { completeOnboarding, updateProfile, avatarHexFor, AVATAR_PALETTE, type UserDoc } from '../data/user'
import { gid } from '../data/types'
import { useSaveFlow } from '../data/queries'
import { useSession } from '../state/session'
import {
  autocomplete,
  getCaptureDetails,
  newSessionToken,
  placesEnabled,
  type Suggestion,
} from '../lib/places'
import { signIn } from '../lib/authWatch'
import { haptics } from '../lib/haptics'
import { Avatar } from '../components/Avatar'
import { track } from '../data/analytics'
import { PlaceMemoryConfirmation } from '../components/PlaceMemoryConfirmation'
import type { DurablePlaceMemory } from '../domain/placeMemory'
import { prototypeFailure, prototypeKind } from '../lib/prototypeMode'
import { dismissToast } from '../state/toast'

type ReviewedIdentity = {
  displayName: string
  avatarHex: string
}

const prototypeOnboardingStorageKey = (uid: string) => `__this_is_onboarding:${uid}`
const UNSUPPORTED_PLACE_MESSAGE =
  'This Google result can\u2019t be kept safely in this version yet. Choose another result for the same place, or add a different place for now.'

export default function Onboarding() {
  const session = useSession()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const groupInviteToken = searchParams.get('groupInvite')
  const prototype = prototypeKind() === 'group'
  const qc = useQueryClient()
  const { setTag } = useSaveFlow()

  const [step, setStep] = useState<1 | 2>(1)
  const [identityBusy, setIdentityBusy] = useState(false)
  const [identityRecovery, setIdentityRecovery] = useState<ReviewedIdentity | null>(null)
  const [finishBusy, setFinishBusy] = useState(false)
  const [finishRecovery, setFinishRecovery] = useState<ReviewedIdentity | null>(null)

  // step 1 — identity
  const [name, setName] = useState('')
  const [avatarHex, setAvatarHex] = useState('')
  const touched = useRef(false)
  const identityResponseLost = useRef(false)
  const finishResponseLost = useRef(false)
  const identityRecoveryButtonRef = useRef<HTMLButtonElement>(null)
  const finishRecoveryButtonRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (session.status !== 'signed-in') return
    // `touched` guards only the NAME (don't clobber what they typed); the avatar
    // always prefills when still empty, so the preview, the selected swatch, and
    // the persisted color agree even if auth resolves after they start typing.
    if (!touched.current) setName(prev => prev || session.user.displayName || '')
    setAvatarHex(prev => prev || avatarHexFor(session.user.uid))
  }, [session])
  useLayoutEffect(() => {
    if (!identityRecovery || identityBusy) return
    const button = identityRecoveryButtonRef.current
    if (button && !button.disabled) button.focus()
  }, [identityBusy, identityRecovery])
  useLayoutEffect(() => {
    if (!finishRecovery || finishBusy) return
    const button = finishRecoveryButtonRef.current
    if (button && !button.disabled) button.focus()
  }, [finishBusy, finishRecovery])

  // step 2 — add real place history (session-tokened autocomplete, mirrors Add.tsx)
  const [saved, setSaved] = useState(0)
  const [text, setText] = useState('')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [searchMessage, setSearchMessage] = useState('')
  const [pendingMemory, setPendingMemory] = useState<{
    placeId: string
    googleLabel: string
    initialLabel: string
  } | null>(() => prototypeFailure('keep-tag-response')
    ? { placeId: 'g:prototype-onboarding', googleLabel: 'Juniper Cafe', initialLabel: 'coffee after practice' }
    : null)
  const [keepSaveFailure, setKeepSaveFailure] = useState<DurablePlaceMemory | null>(null)
  const keepSaveRecoveryButtonRef = useRef<HTMLButtonElement>(null)
  useLayoutEffect(() => {
    if (!keepSaveFailure || setTag.isPending) return
    const button = keepSaveRecoveryButtonRef.current
    if (button && !button.disabled) button.focus()
  }, [keepSaveFailure, setTag.isPending])
  const token = useRef<string | null>(null)
  const seq = useRef(0)

  useEffect(() => {
    const mySeq = ++seq.current
    const query = text.trim()
    setSearchMessage('')
    if (query.length < 3) {
      setSuggestions([])
      return
    }
    const t = setTimeout(async () => {
      try {
        token.current ??= newSessionToken()
        const results = await autocomplete(query, token.current)
        if (seq.current === mySeq) {
          setSuggestions(results)
          if (!results.length) setSearchMessage('No matches yet. Try the full place name or neighborhood.')
        }
      } catch {
        if (seq.current === mySeq) {
          setSuggestions([])
          setSearchMessage('Place search didn’t load. Check your connection and try again.')
        }
      }
    }, 350)
    return () => clearTimeout(t)
  }, [text])

  if (session.status === 'signed-out') {
    return (
      <div className="page">
        <section className="empty-state">
          <p className="eyebrow">WELCOME</p>
          <h1 className="t-display">First, it needs to be yours.</h1>
          <button className="pill pill-primary press" onClick={() => void signIn()}>
            Continue with Google
          </button>
        </section>
      </div>
    )
  }

  const commitPrototypeIdentity = (identity: ReviewedIdentity, finishSetup: boolean): number | undefined => {
    if (session.status !== 'signed-in') return undefined
    const key = prototypeOnboardingStorageKey(session.user.uid)
    const raw = window.sessionStorage.getItem(key)
    let stored: (ReviewedIdentity & { onboardedAt?: number; committedAt?: number }) | null = null
    try { stored = raw ? JSON.parse(raw) as ReviewedIdentity & { onboardedAt?: number; committedAt?: number } : null } catch { /* replace malformed fixture state */ }
    const onboardedAt = finishSetup ? stored?.onboardedAt ?? Date.now() : stored?.onboardedAt
    const exact = stored?.displayName === identity.displayName
      && stored.avatarHex === identity.avatarHex
      && (!finishSetup || typeof stored.onboardedAt === 'number')
    if (!exact) {
      window.sessionStorage.setItem(key, JSON.stringify({
        ...identity,
        ...(onboardedAt ? { onboardedAt } : {}),
        committedAt: stored?.committedAt ?? Date.now(),
      }))
    }
    qc.setQueryData<UserDoc>(['userDoc', session.user.uid], current => ({
      ...(current ?? {}),
      ...identity,
      ...(onboardedAt ? { onboardedAt } : {}),
    }))
    return onboardedAt
  }

  const withholdPrototypeResponse = (fixture: 'onboarding-identity-response' | 'onboarding-finish-response') => {
    if (!prototypeFailure(fixture)) return
    const lost = fixture === 'onboarding-identity-response' ? identityResponseLost : finishResponseLost
    if (lost.current) return
    lost.current = true
    throw new Error(`prototype ambiguous ${fixture}`)
  }

  const completeSetup = async (
    identity: ReviewedIdentity,
    responseFixture: 'onboarding-identity-response' | 'onboarding-finish-response',
  ) => {
    let onboardedAt: number | undefined
    if (prototype) {
      onboardedAt = commitPrototypeIdentity(identity, true)
    } else {
      await updateProfile(identity)
      onboardedAt = await completeOnboarding()
    }
    withholdPrototypeResponse(responseFixture)
    track('onboarding_completed', { signalCount: saved })
    // Seed the cache synchronously so OnboardingGate sees completion immediately.
    const uid = session.status === 'signed-in' ? session.user.uid : null
    if (uid) {
      qc.setQueryData<UserDoc>(['userDoc', uid], d => ({
        ...(d ?? {}),
        ...(onboardedAt ? { onboardedAt } : {}),
        ...identity,
      }))
    }
    if (!prototype) void qc.invalidateQueries({ queryKey: ['userDoc'] })
    haptics.success()
    const destination = groupInviteToken ? `/gi/${groupInviteToken}` : '/together'
    navigate(destination, { replace: true })
  }

  const saveIdentity = async (recovery?: ReviewedIdentity) => {
    const identity = recovery ?? { displayName: name.trim(), avatarHex }
    if (identityBusy || !identity.displayName) return
    haptics.select()
    setIdentityBusy(true)
    try {
      if (groupInviteToken) {
        await completeSetup(identity, 'onboarding-identity-response')
      } else {
        if (prototype) commitPrototypeIdentity(identity, false)
        else await updateProfile(identity)
        withholdPrototypeResponse('onboarding-identity-response')
        setIdentityRecovery(null)
        setStep(2)
      }
    } catch {
      haptics.warn()
      setIdentityRecovery(identity)
    } finally {
      setIdentityBusy(false)
    }
  }

  const finish = async (recovery?: ReviewedIdentity) => {
    if (finishBusy) return
    const identity = recovery ?? { displayName: name.trim(), avatarHex }
    setFinishBusy(true)
    try {
      await completeSetup(identity, 'onboarding-finish-response')
    } catch {
      haptics.warn()
      setFinishRecovery(identity)
    } finally {
      setFinishBusy(false)
    }
  }

  const pick = async (s: Suggestion) => {
    if (busyId) return
    if (s.support === 'unsupported') {
      haptics.warn()
      setSearchMessage(UNSUPPORTED_PLACE_MESSAGE)
      return
    }
    haptics.tap()
    setBusyId(s.placeId)
    const userQuery = text.trim()
    setSearchMessage('')
    seq.current++
    try {
      const details = token.current
        ? await getCaptureDetails(s.placeId, token.current, s.name)
        : null
      if (details) {
        token.current = null
        setPendingMemory({
          placeId: gid(details.id),
          googleLabel: details.name,
          initialLabel: userQuery,
        })
        setSuggestions([])
      } else {
        setSearchMessage('That place didn’t load. Choose it again or try another result.')
      }
    } catch {
      setSearchMessage('That place didn’t load. Check your connection and choose it again.')
    } finally {
      setBusyId(null)
    }
  }

  const confirmMemory = async (memory: DurablePlaceMemory) => {
    try {
      await setTag.mutateAsync({
        tag: 'loved',
        place: { id: memory.placeId, memory },
        privateOnly: true,
      })
      setKeepSaveFailure(null)
      setSaved(count => count + 1)
      setPendingMemory(null)
      setText('')
    } catch {
      dismissToast()
      setKeepSaveFailure(memory)
    }
  }

  const identityLocked = identityBusy || Boolean(identityRecovery)
  const finishLocked = finishBusy || Boolean(finishRecovery)

  return (
    <div className="page onboarding">
      {step === 1 && (
        <>
          <p className="eyebrow">WELCOME</p>
          <h1 className="t-display onboarding-q">Who are you?</h1>
          <p className="t-body onboarding-sub">This is how your people will recognize you.</p>
          {identityRecovery && (
            <section className="closeup-data-warning" role="alert" aria-label="Onboarding identity not confirmed">
              <span>
                <strong className="t-row-title">Identity setup not confirmed.</strong>
                <span className="t-small">
                  We couldn’t confirm setup with the reviewed name “{identityRecovery.displayName}” and selected avatar. Checking repeats only that exact identity{groupInviteToken ? ' and returns to this invitation' : ''}; it cannot join a group or share Keep.
                </span>
              </span>
            </section>
          )}
          <div className="identity-preview">
            <Avatar name={name || 'You'} hex={avatarHex || AVATAR_PALETTE[0]} size={72} />
          </div>
          <input
            className="add-input"
            placeholder="Your name"
            value={name}
            onChange={e => { touched.current = true; setName(e.target.value) }}
            autoComplete="off"
            maxLength={30}
            aria-label="Your name"
            disabled={identityLocked}
          />
          <div className="avatar-swatches" role="group" aria-label="Avatar color">
            {AVATAR_PALETTE.map(hex => (
              <button
                key={hex}
                className={`avatar-swatch press${avatarHex === hex ? ' is-on' : ''}`}
                style={{ background: hex }}
                aria-label={`Avatar color ${hex}`}
                aria-pressed={avatarHex === hex}
                disabled={identityLocked}
                onClick={() => { haptics.tap(); touched.current = true; setAvatarHex(hex) }}
              />
            ))}
          </div>
          <div className="onboarding-foot">
            <span />
            <button
              ref={identityRecovery ? identityRecoveryButtonRef : undefined}
              className="pill pill-primary press"
              disabled={identityBusy || (!identityRecovery && !name.trim())}
              onClick={() => void saveIdentity(identityRecovery ?? undefined)}
            >
              {identityBusy
                ? identityRecovery ? 'Checking…' : 'Saving…'
                : identityRecovery ? 'Check setup'
                : groupInviteToken ? 'Continue to invite' : 'Next'}
            </button>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <p className="eyebrow">GIVE IT SOMETHING TRUE</p>
          <h1 className="t-display onboarding-q">Keep one place you already love.</h1>
          <p className="t-body onboarding-sub">One or two is enough. You can skip and let Keep grow as you find places.</p>

          {finishRecovery && (
            <section className="closeup-data-warning" role="alert" aria-label="Onboarding completion not confirmed">
              <span>
                <strong className="t-row-title">Setup completion not confirmed.</strong>
                <span className="t-small">
                  We couldn’t confirm whether setup finished. Checking repeats only the confirmed identity and completion; it cannot add a place, join a group, or share Keep.
                </span>
              </span>
            </section>
          )}

          {pendingMemory ? (
            <>
            {keepSaveFailure && (
              <section className="closeup-data-warning" role="alert" aria-label="Onboarding Keep save not confirmed">
                <span>
                  <strong className="t-row-title">Keep save not confirmed.</strong>
                  <span className="t-small">We couldn’t confirm Loved with the reviewed label, kind, and area. Checking again repeats only that exact private Keep save; it does not share with a group.</span>
                </span>
                <button
                  ref={keepSaveRecoveryButtonRef}
                  className="pill pill-primary press"
                  disabled={setTag.isPending || Boolean(finishRecovery)}
                  onClick={() => void confirmMemory(keepSaveFailure)}
                >{setTag.isPending ? 'Checking…' : 'Check Keep'}</button>
              </section>
            )}
            <PlaceMemoryConfirmation
              placeId={pendingMemory.placeId}
              googleLabel={pendingMemory.googleLabel}
              initialLabel={pendingMemory.initialLabel}
              actionLabel="Keep as Loved"
              busy={setTag.isPending}
              locked={Boolean(keepSaveFailure) || Boolean(finishRecovery)}
              onConfirm={memory => void confirmMemory(memory)}
              onCancel={() => setPendingMemory(null)}
            />
            </>
          ) : placesEnabled ? (
            <>
              <p className="gmp-attribution" translate="no">Google Maps</p>
              <input
                className="add-input"
                placeholder="Name of a place…"
                value={text}
                onChange={e => setText(e.target.value)}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                disabled={finishLocked}
              />
              <ul className="add-suggestions">
                {suggestions.map((s, index) => (
                  <li key={s.support === 'supported' ? s.placeId : `unsupported-${index}`}>
                    <button
                      className={`add-suggestion press${s.support === 'supported' && busyId === s.placeId ? ' is-busy' : ''}`}
                      disabled={Boolean(busyId) || finishLocked}
                      onClick={() => void pick(s)}
                    >
                      <span className="add-suggestion-text">{s.text}</span>
                      <span className="eyebrow">
                        {s.support === 'unsupported'
                          ? 'WHY UNAVAILABLE'
                          : busyId === s.placeId ? 'OPENING…' : 'REVIEW'}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {text.trim().length === 0 && (
                <div className="onboarding-memory-prompt">
                  <p className="eyebrow">IF NOTHING COMES TO MIND</p>
                  <p className="t-small">
                    Think of somewhere you repeat, recommend, or would cross town for. Still blank?
                    Skip — later you can add a place from search, a recommendation, or your phone’s share sheet.
                  </p>
                </div>
              )}
              {searchMessage && <p className="t-small onboarding-error" role="status">{searchMessage}</p>}
            </>
          ) : (
            <p className="t-small">Place search is off in this build — you can add places later.</p>
          )}

          <div className="onboarding-foot">
            {saved > 0 ? <p className="t-small">{saved} saved</p> : <span aria-hidden />}
            <button
              ref={finishRecovery ? finishRecoveryButtonRef : undefined}
              className="pill pill-primary press"
              disabled={finishBusy || Boolean(keepSaveFailure)}
              onClick={() => void finish(finishRecovery ?? undefined)}
            >
              {finishBusy
                ? finishRecovery ? 'Checking…' : 'Finishing…'
                : finishRecovery ? 'Check setup'
                : saved > 0 ? 'Open Together' : 'Skip for now'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
