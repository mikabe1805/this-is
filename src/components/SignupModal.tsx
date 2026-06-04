import React, { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { XMarkIcon, EyeIcon, EyeSlashIcon, ChevronLeftIcon, ChevronRightIcon, PhotoIcon } from '@heroicons/react/24/outline'
import { firebaseDataService } from '../services/firebaseDataService'
import { firebaseStorageService } from '../services/firebaseStorageService'
import GooglePlacesAutocomplete from './GooglePlacesAutocomplete'
import { useModalDismiss } from '../hooks/useModalDismiss'
import { authErrorMessage } from '../utils/authErrors'

interface SignupModalProps {
  isOpen: boolean
  onClose: () => void
  onSwitchToLogin: () => void
}

interface SignupData {
  displayName: string
  email: string
  password: string
  username: string
  location: string
  bio: string
  profilePicture?: File | null
  categories: string[]
  vibes: string[]
}

const CATEGORIES = [
  'Restaurants', 'Coffee', 'Bars', 'Museums', 'Nature',
  'Shopping', 'Live Music', 'Bookstores', 'Markets', 'Wellness',
  'Architecture', 'Hidden Gems',
]

// Aesthetic vibes (mood, not category). These seed the taste model's vibe
// vocabulary, which then grows from the places you actually engage with. Worded
// to read like a mood-board — the words map onto src/utils/placeTypes VIBES.
const VIBES = [
  'Slow mornings', 'Sun-drenched', 'Cottagecore', 'Dark academia', 'Moody',
  'Coastal', 'Old money', 'Clean girl', 'Outdoorsy', 'Hidden gems',
  'Golden hour', 'Matcha hour', 'Plant-filled', 'Buzzy', 'Low-key', 'Nostalgic',
]

export default function SignupModal({ isOpen, onClose, onSwitchToLogin }: SignupModalProps) {
  const [step, setStep] = useState(1)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [emailInUse, setEmailInUse] = useState(false)
  const [loading, setLoading] = useState(false)
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null)
  const [checkingUsername, setCheckingUsername] = useState(false)
  const [uploadingPicture, setUploadingPicture] = useState(false)
  const { signUp, refreshCurrentUser } = useAuth()

  const [data, setData] = useState<SignupData>({
    displayName: '',
    email: '',
    password: '',
    username: '',
    location: '',
    bio: '',
    profilePicture: null,
    categories: [],
    vibes: [],
  })

  const TOTAL_STEPS = 3

  const update = <K extends keyof SignupData>(field: K, value: SignupData[K]) => {
    setData(prev => ({ ...prev, [field]: value }))
  }

  const toggleArrayValue = (field: 'categories' | 'vibes', value: string, max?: number) => {
    setData(prev => {
      const has = prev[field].includes(value)
      if (!has && max && prev[field].length >= max) return prev
      return {
        ...prev,
        [field]: has ? prev[field].filter(v => v !== value) : [...prev[field], value],
      }
    })
  }

  const handleUsernameChange = (raw: string) => {
    const cleaned = raw.toLowerCase().replace(/[^a-z0-9_.]/g, '').slice(0, 24)
    update('username', cleaned)
    setUsernameAvailable(null)
    if (cleaned.length >= 3) {
      setCheckingUsername(true)
      firebaseDataService.checkUsernameAvailability(cleaned)
        .then(setUsernameAvailable)
        .catch(() => setUsernameAvailable(null))
        .finally(() => setCheckingUsername(false))
    }
  }

  const handleLocationSelect = (formatted: string) => update('location', formatted)

  const handleProfilePictureChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { setError('Photo must be under 5MB'); return }
    if (!['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) {
      setError('Use JPG, PNG, GIF, or WebP'); return
    }
    try {
      setUploadingPicture(true)
      setError('')
      const compressed = await firebaseStorageService.compressImage(file, 800, 0.8)
      update('profilePicture', compressed)
    } catch {
      setError('Could not process that image')
    } finally {
      setUploadingPicture(false)
    }
  }

  const validateStep = (n: number): boolean => {
    setError('')
    if (n === 1) {
      if (!data.displayName.trim()) return setError('Display name is required'), false
      if (!data.email.trim()) return setError('Email is required'), false
      if (data.password.length < 6) return setError('Password must be at least 6 characters'), false
      if (data.username.length < 3) return setError('Username must be at least 3 characters'), false
      if (usernameAvailable === false) return setError('Username is already taken'), false
      if (checkingUsername) return setError('Checking username…'), false
    }
    if (n === 2) {
      if (!data.location.trim()) return setError('Pick your city — we use it to surface places nearby'), false
    }
    if (n === 3) {
      if (data.categories.length < 3) return setError('Pick at least 3 things you love'), false
    }
    return true
  }

  const next = () => { if (validateStep(step)) setStep(s => Math.min(s + 1, TOTAL_STEPS)) }
  const back = () => { setError(''); setStep(s => Math.max(s - 1, 1)) }

  const handleSubmit = async () => {
    if (!validateStep(3)) return
    try {
      setLoading(true)
      setError('')
      setEmailInUse(false)
      const credential = await signUp(data.email, data.password, data.displayName)
      const userId = credential.user.uid

      let profilePictureUrl = ''
      if (data.profilePicture) {
        try {
          profilePictureUrl = await firebaseStorageService.uploadProfilePicture(userId, data.profilePicture)
        } catch (e) {
          console.warn('[signup] profile picture upload failed, continuing', e)
        }
      }

      await firebaseDataService.setupNewUser(userId, {
        displayName: data.displayName,
        email: data.email,
        location: data.location,
        bio: data.bio,
        favoriteCategories: data.categories,
        activityPreferences: [],
        budgetPreferences: [],
        socialPreferences: { exploreNew: 60, followFriends: 50, trendingContent: 40 },
        discoveryRadius: 25,
        username: data.username,
        userTags: data.vibes,
        profilePictureUrl,
      })

      // setupNewUser overwrote the user doc with the rich profile — pull fresh
      // into AuthContext so the auth gate flips to authenticated immediately.
      try { await refreshCurrentUser() } catch {}

      onClose()
      // Warm welcome that lands the new user in the discovery loop instead of a
      // blank-ish Home — the weakest possible first impression otherwise.
      const first = (data.displayName || '').trim().split(' ')[0]
      setTimeout(() => {
        try {
          window.dispatchEvent(new CustomEvent('this-is:toast', {
            detail: {
              message: first ? `Welcome, ${first} — here's what's nearby.` : "Welcome — here's what's nearby.",
              action: { label: 'Explore', href: '/explore' },
            },
          }))
        } catch { /* noop */ }
      }, 600)
    } catch (e: unknown) {
      const code = (e as { code?: string } | null)?.code || ''
      if (code === 'auth/email-already-in-use') {
        setEmailInUse(true)
        setError('An account with this email already exists.')
        setStep(1)
      } else {
        setError(authErrorMessage(e, 'Could not create account. Please try again.'))
      }
      console.error('[signup]', e)
    } finally {
      setLoading(false)
    }
  }

  const stepTitle = step === 1 ? 'Account' : step === 2 ? 'About you' : 'What you love'

  useModalDismiss(isOpen, onClose)
  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center sm:p-4 bg-[#1A1815]/55 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal={true}
        className="modal-paper relative w-full sm:max-w-md max-h-[92vh] rounded-t-3xl sm:rounded-3xl border border-edge overflow-hidden flex flex-col"
        style={{ boxShadow: '0 18px 60px rgba(46, 28, 13, 0.22)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div data-drag-handle className="sm:hidden flex justify-center py-3 shrink-0" aria-hidden>
          <span className="w-10 h-1 rounded-full bg-ink-faint" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-edge relative z-10">
          <div className="label-eyebrow text-ink-mute flex items-center gap-2">
            <span className="text-accent-deep">0{step}</span>
            <span className="text-ink-faint">/</span>
            <span>0{TOTAL_STEPS} · {stepTitle}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="h-9 w-9 rounded-full hover:bg-paper-deep flex items-center justify-center text-ink"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Progress */}
        <div className="px-5 pt-3 relative z-10">
          <div className="relative h-[3px] rounded-full bg-paper-deep overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 rounded-full transition-all duration-300"
              style={{
                width: `${(step / TOTAL_STEPS) * 100}%`,
                background: 'linear-gradient(90deg, var(--accent-bright) 0%, var(--accent) 60%, var(--accent-deep) 100%)',
              }}
            />
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto relative z-10 px-5 sm:px-6 py-5 space-y-5">
          {error && (
            <div className="rounded-xl px-3.5 py-2.5 border border-edge" style={{ background: 'rgba(220, 60, 60, 0.08)' }}>
              <p className="text-[13px] text-red-700 font-medium">{error}</p>
              {emailInUse && (
                <button
                  type="button"
                  onClick={onSwitchToLogin}
                  className="mt-2 inline-flex items-center gap-1 text-[13px] font-semibold text-ink underline-offset-4 hover:underline"
                >
                  Sign in instead →
                </button>
              )}
            </div>
          )}

          {step === 1 && (
            <>
              <div>
                <label htmlFor="su-name" className="label-eyebrow text-ink-mute mb-1.5 block">Display name</label>
                <input
                  id="su-name"
                  type="text"
                  value={data.displayName}
                  onChange={(e) => update('displayName', e.target.value)}
                  placeholder="What should we call you?"
                  autoComplete="name"
                  className="w-full h-11 px-4 rounded-full border border-edge bg-card text-[14px] text-ink placeholder:text-ink-mute outline-none focus:border-ink/40"
                />
              </div>

              <div>
                <label htmlFor="su-username" className="label-eyebrow text-ink-mute mb-1.5 block">Username</label>
                <div className="relative">
                  <input
                    id="su-username"
                    type="text"
                    value={data.username}
                    onChange={(e) => handleUsernameChange(e.target.value)}
                    placeholder="yourname"
                    autoComplete="username"
                    className="w-full h-11 px-4 rounded-full border border-edge bg-card text-[14px] text-ink placeholder:text-ink-mute outline-none focus:border-ink/40"
                  />
                  {checkingUsername && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 rounded-full border-2 border-ink-mute border-t-transparent animate-spin" />
                  )}
                </div>
                {data.username.length >= 3 && !checkingUsername && usernameAvailable !== null && (
                  <p className={`font-mono text-[10px] tracking-[0.10em] uppercase mt-1.5 ${usernameAvailable ? 'text-accent-deep' : 'text-red-700'}`}>
                    {usernameAvailable ? '✓ Available' : '✗ Already taken'}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="su-email" className="label-eyebrow text-ink-mute mb-1.5 block">Email</label>
                <input
                  id="su-email"
                  type="email"
                  value={data.email}
                  onChange={(e) => { update('email', e.target.value); if (emailInUse) { setEmailInUse(false); setError('') } }}
                  placeholder="you@example.com"
                  autoComplete="email"
                  className="w-full h-11 px-4 rounded-full border border-edge bg-card text-[14px] text-ink placeholder:text-ink-mute outline-none focus:border-ink/40"
                />
              </div>

              <div>
                <label htmlFor="su-password" className="label-eyebrow text-ink-mute mb-1.5 block">Password</label>
                <div className="relative">
                  <input
                    id="su-password"
                    type={showPassword ? 'text' : 'password'}
                    value={data.password}
                    onChange={(e) => update('password', e.target.value)}
                    placeholder="At least 6 characters"
                    autoComplete="new-password"
                    className="w-full h-11 pl-4 pr-11 rounded-full border border-edge bg-card text-[14px] text-ink placeholder:text-ink-mute outline-none focus:border-ink/40"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(s => !s)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 h-7 w-7 flex items-center justify-center text-ink-mute hover:text-ink rounded-full"
                  >
                    {showPassword ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <label htmlFor="su-location" className="label-eyebrow text-ink-mute mb-1.5 block">Your town or neighborhood</label>
                <GooglePlacesAutocomplete
                  onPlaceSelect={handleLocationSelect}
                  value={data.location}
                  placeholder="e.g. Piscataway, NJ or Williamsburg, Brooklyn"
                />
                <p className="text-[12px] text-ink-soft mt-1.5">Town or neighborhood — not your home address. Used only to surface nearby places, and never shared.</p>
              </div>

              <div>
                <label htmlFor="su-bio" className="label-eyebrow text-ink-mute mb-1.5 block">Short bio · optional</label>
                <textarea
                  id="su-bio"
                  value={data.bio}
                  onChange={(e) => update('bio', e.target.value)}
                  rows={3}
                  maxLength={240}
                  placeholder="Two sentences about what you love. We use this to tailor recommendations."
                  className="w-full px-3.5 py-3 rounded-xl border border-edge bg-card text-[14px] text-ink placeholder:text-ink-mute outline-none focus:border-ink/40 resize-none"
                />
                <div className="font-mono text-[10px] tracking-[0.10em] uppercase text-ink-mute mt-1 text-right">{data.bio.length}/240</div>
              </div>

              <div>
                <p className="label-eyebrow text-ink-mute mb-2.5">Profile photo · optional</p>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-paper-deep ring-1 ring-edge flex items-center justify-center overflow-hidden relative">
                    {data.profilePicture ? (
                      <img src={URL.createObjectURL(data.profilePicture)} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <PhotoIcon className="w-7 h-7 text-ink-mute" />
                    )}
                    {uploadingPicture && (
                      <div className="absolute inset-0 bg-[#1A1815]/40 flex items-center justify-center">
                        <div className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className={`btn-secondary h-9 px-4 inline-flex items-center justify-center text-[13px] cursor-pointer ${uploadingPicture ? 'opacity-50 cursor-not-allowed' : ''}`}>
                      {data.profilePicture ? 'Change photo' : 'Choose photo'}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/gif,image/webp"
                        onChange={handleProfilePictureChange}
                        className="hidden"
                        disabled={uploadingPicture}
                      />
                    </label>
                    {data.profilePicture && (
                      <button
                        type="button"
                        onClick={() => update('profilePicture', null)}
                        className="font-mono text-[10px] tracking-[0.10em] uppercase text-ink-mute hover:text-ink text-left"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div>
                <p className="label-eyebrow text-ink-mute mb-1">Pick at least 3 categories</p>
                <p className="text-[12px] text-ink-soft mb-3">We'll use these to seed your discovery feed.</p>
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORIES.map(c => {
                    const active = data.categories.includes(c)
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => toggleArrayValue('categories', c)}
                        aria-pressed={active}
                        className={`h-9 px-3.5 rounded-full text-[13px] font-medium border transition-colors ${
                          active ? 'bg-paper-deep border-ink text-ink' : 'bg-card border-edge text-ink-soft hover:border-ink/40'
                        }`}
                      >
                        {c}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <p className="label-eyebrow text-ink-mute mb-1">Pick a few vibes · optional</p>
                <p className="text-[12px] text-ink-soft mb-3">Up to 6. Helps shape recommendations and your profile.</p>
                <div className="flex flex-wrap gap-1.5">
                  {VIBES.map(v => {
                    const active = data.vibes.includes(v)
                    const disabled = !active && data.vibes.length >= 6
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => toggleArrayValue('vibes', v, 6)}
                        disabled={disabled}
                        aria-pressed={active}
                        className={`h-9 px-3.5 rounded-full text-[13px] font-medium border transition-colors ${
                          active
                            ? 'bg-paper-deep border-ink text-ink'
                            : disabled
                            ? 'bg-card border-edge text-ink-faint cursor-not-allowed'
                            : 'bg-card border-edge text-ink-soft hover:border-ink/40'
                        }`}
                      >
                        {v}
                      </button>
                    )
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-t border-edge relative z-10">
          {step > 1 ? (
            <button
              type="button"
              onClick={back}
              className="inline-flex items-center gap-1.5 h-10 px-3 text-[13px] font-medium text-ink-soft hover:text-ink rounded-full hover:bg-paper-deep transition-colors"
            >
              <ChevronLeftIcon className="w-4 h-4" />
              Back
            </button>
          ) : (
            <button
              type="button"
              onClick={onSwitchToLogin}
              className="text-[12px] text-ink-soft hover:text-ink"
            >
              Already have an account? <span className="font-medium text-ink">Sign in</span>
            </button>
          )}

          {step < TOTAL_STEPS ? (
            <button
              type="button"
              onClick={next}
              className="btn-cta h-11 px-5 inline-flex items-center gap-2 text-[14px] font-semibold"
            >
              Continue
              <ChevronRightIcon className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="btn-cta h-11 px-5 inline-flex items-center text-[14px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
