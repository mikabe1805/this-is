import { useState, useEffect, useRef } from 'react'
import { ArrowLeftIcon, CameraIcon, CalendarIcon } from '@heroicons/react/24/outline'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.js'
import { formatTimestamp } from '../utils/dateUtils'
import { firebaseDataService } from '../services/firebaseDataService.js'
import { firebaseStorageService } from '../services/firebaseStorageService.js'
import type { User } from '../types/index.js'
import GooglePlacesAutocomplete from '../components/GooglePlacesAutocomplete'

const EditProfile = () => {
  const navigate = useNavigate()
  const { currentUser: authUser } = useAuth()
  const [formData, setFormData] = useState<Partial<User>>({})
  const [newTag, setNewTag] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const fetchUserData = async () => {
      if (authUser) {
        const user = await firebaseDataService.getCurrentUser(authUser.id)
        if (user) {
          setFormData(user)
        }
      }
      setLoading(false)
    }
    fetchUserData()
  }, [authUser])

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleAddTag = () => {
    if (newTag.trim() && !(formData.tags || []).includes(newTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...(prev.tags || []), newTag.trim()]
      }))
      setNewTag('')
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }))
  }

  const handleAvatarFileChosen = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !authUser) return
    setAvatarError(null)
    setIsUploadingAvatar(true)
    try {
      const url = await firebaseStorageService.uploadProfilePicture(authUser.id, file)
      setFormData(prev => ({ ...prev, avatar: url }))
      // Persist immediately so the change survives navigation even if the user
      // doesn't tap Save.
      await firebaseDataService.updateUserProfile(authUser.id, { avatar: url })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed. Try a different image.'
      setAvatarError(message)
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  const handleSave = async () => {
    if (!authUser) return;
    setIsSaving(true)
    try {
      await firebaseDataService.updateUserProfile(authUser.id, formData);
      navigate('/profile')
    } catch (error) {
      console.error("Error updating profile: ", error);
      // Optionally, show an error message to the user
    } finally {
      setIsSaving(false)
    }
  }

  if (loading) {
    return <div>Loading...</div>; // Or a proper loading spinner
  }

  return (
    <div className="relative min-h-full overflow-x-hidden">
      <header className="sticky top-0 z-30 bg-paper/90 backdrop-blur-md">
        <div className="px-5 pt-5 pb-3 flex items-center justify-between gap-3">
          <button
            onClick={() => { if (window.history.length > 1) navigate(-1); else navigate('/profile') }}
            className="h-10 w-10 rounded-full hover:bg-paper-deep flex items-center justify-center"
            aria-label="Back"
          >
            <ArrowLeftIcon className="w-5 h-5 text-ink" />
          </button>
          <h1 className="font-display text-[22px] leading-none text-ink">Edit profile</h1>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="btn-cta h-10 px-4 label-eyebrow"
          >
            {isSaving ? 'Saving…' : 'Save'}
          </button>
        </div>
        <div className="border-b border-edge mx-5" />
      </header>

      <div className="relative z-10 px-5 py-6 space-y-8 max-w-2xl mx-auto">
        <section className="text-center">
          <div className="relative inline-block">
            {formData.avatar ? (
              <img
                src={formData.avatar}
                alt="Profile"
                className="w-[88px] h-[88px] rounded-full object-cover bg-paper-deep ring-1 ring-edge"
              />
            ) : (
              <div
                aria-label="No profile photo"
                className="w-[88px] h-[88px] rounded-full bg-paper-deep ring-1 ring-edge flex items-center justify-center font-mono text-[18px] tracking-wider text-ink-soft"
              >
                {(formData.name || '?').slice(0, 2).toUpperCase()}
              </div>
            )}
            {isUploadingAvatar && (
              <div className="absolute inset-0 rounded-full bg-paper-deep/70 flex items-center justify-center">
                <span className="font-mono text-[10px] tracking-[0.12em] uppercase text-ink">Uploading…</span>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarFileChosen}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingAvatar}
              className="absolute -bottom-1 -right-1 h-9 w-9 rounded-full glass-honey flex items-center justify-center disabled:opacity-60"
              aria-label="Change photo"
            >
              <CameraIcon className="w-4 h-4" />
            </button>
          </div>
          <p className="font-mono text-[10px] tracking-[0.12em] uppercase text-ink-mute mt-3">Tap the camera to change</p>
          {avatarError && (
            <p className="text-[12px] text-red-700 mt-1.5">{avatarError}</p>
          )}
        </section>

        <section>
          <p className="label-eyebrow flex items-center gap-1.5 mb-3" style={{ color: 'var(--accent-deep)' }}>
            <span className="accent-bead-sm accent-bead" /> Basics
          </p>
          <div className="space-y-3">
            <div>
              <label htmlFor="profile-name" className="label-eyebrow text-ink-mute mb-1.5 block">Full name</label>
              <input
                id="profile-name"
                type="text"
                value={formData.name || ''}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className="w-full h-11 px-4 rounded-full bg-card border border-edge text-[14px] text-ink placeholder:text-ink-mute outline-none focus:border-ink/40"
                placeholder="What people call you"
                autoComplete="name"
              />
            </div>
            <div>
              <label htmlFor="profile-username" className="label-eyebrow text-ink-mute mb-1.5 block">Username</label>
              <input
                id="profile-username"
                type="text"
                value={formData.username || ''}
                onChange={(e) => handleInputChange('username', e.target.value)}
                className="w-full h-11 px-4 rounded-full bg-card border border-edge text-[14px] text-ink placeholder:text-ink-mute outline-none focus:border-ink/40"
                placeholder="@yourhandle"
                autoComplete="username"
              />
            </div>
            <div>
              <label htmlFor="profile-bio" className="label-eyebrow text-ink-mute mb-1.5 block">Bio</label>
              <textarea
                id="profile-bio"
                value={formData.bio || ''}
                onChange={(e) => handleInputChange('bio', e.target.value)}
                rows={3}
                className="w-full px-4 py-3 rounded-[18px] bg-card border border-edge text-[14px] text-ink placeholder:text-ink-mute outline-none focus:border-ink/40 resize-none"
                placeholder="A line about you"
                maxLength={150}
              />
              <p className="font-mono text-[10px] tracking-[0.10em] uppercase text-ink-mute mt-1">{(formData.bio || '').length} / 150</p>
            </div>
            <div>
              <label className="label-eyebrow text-ink-mute mb-1.5 block">Location</label>
              <GooglePlacesAutocomplete
                value={formData.location || ''}
                placeholder="Start typing your city…"
                onPlaceSelect={(address) => {
                  if (address) {
                    handleInputChange('location', address)
                  }
                }}
              />
            </div>
          </div>
        </section>

        <section>
          <p className="label-eyebrow flex items-center gap-1.5 mb-2" style={{ color: 'var(--accent-deep)' }}>
            <span className="accent-bead-sm accent-bead" /> Interests
          </p>
          <p className="text-[13px] text-ink-soft mb-3">Tags that describe what you're into.</p>
          {(formData.tags || []).length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {(formData.tags || []).map(tag => (
                <span
                  key={tag}
                  className="glass-honey px-3 h-7 rounded-full label-eyebrow flex items-center gap-1.5"
                >
                  {tag}
                  <button type="button" onClick={() => handleRemoveTag(tag)} aria-label={`Remove ${tag}`}>×</button>
                </span>
              ))}
            </div>
          )}
          <form
            onSubmit={(e) => { e.preventDefault(); handleAddTag() }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              placeholder="Add a tag…"
              className="flex-1 h-10 px-4 rounded-full bg-card border border-edge text-[13px] text-ink placeholder:text-ink-mute outline-none focus:border-ink/40"
            />
            <button type="submit" className="btn-secondary h-10 px-4 label-eyebrow">Add</button>
          </form>
        </section>

        <section>
          <p className="label-eyebrow flex items-center gap-1.5 mb-3" style={{ color: 'var(--accent-deep)' }}>
            <span className="accent-bead-sm accent-bead" /> Account
          </p>
          <ul className="divide-y divide-edge border-y border-edge">
            <li className="py-3.5 flex items-center gap-3.5">
              <span className="shrink-0 w-9 h-9 rounded-full glass-honey flex items-center justify-center">
                <CalendarIcon className="w-4 h-4" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-medium text-ink">Member since</p>
                <p className="font-mono text-[10px] tracking-[0.10em] uppercase text-ink-mute mt-0.5">
                  {formData.createdAt ? formatTimestamp(formData.createdAt as any) : 'N/A'}
                </p>
              </div>
            </li>
            <li className="py-3.5 flex items-center gap-3.5">
              <span className="shrink-0 w-9 h-9 rounded-full glass-honey flex items-center justify-center">
                <span className="font-mono text-[10px] font-semibold">I</span>
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-medium text-ink">Influence</p>
                <p className="font-mono text-[10px] tracking-[0.10em] uppercase text-ink-mute mt-0.5">
                  {formData.influences || 0} {(formData.influences || 0) === 1 ? 'influence' : 'influences'}
                </p>
              </div>
            </li>
          </ul>
        </section>
      </div>
    </div>
  )
}

export default EditProfile
