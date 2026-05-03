import { useState, useEffect } from 'react'
import { ArrowLeftIcon, BellIcon, EyeIcon, EyeSlashIcon, ShieldCheckIcon, GlobeAltIcon, UserIcon, Cog6ToothIcon, MoonIcon, SunIcon, DevicePhoneMobileIcon } from '@heroicons/react/24/outline'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.js'
import { firebaseDataService } from '../services/firebaseDataService.js'
import type { UserPreferences } from '../services/firebaseDataService.js'
import ConfirmModal from '../components/ConfirmModal.js'

interface SettingItem {
  id: string
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  type: 'toggle' | 'select' | 'button' | 'link'
  value?: boolean | string
  options?: { label: string; value: string }[]
  action?: () => void
}

const Settings = () => {
  const navigate = useNavigate()
  const { currentUser: authUser, logout } = useAuth()
  const [settings, setSettings] = useState<Partial<UserPreferences>>({})
  const [loading, setLoading] = useState(true)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [confirmModalConfig, setConfirmModalConfig] = useState({
    title: '',
    message: '',
    onConfirm: () => {}
  })

  useEffect(() => {
    const fetchSettings = async () => {
      if (authUser) {
        setLoading(true)
        const prefs = await firebaseDataService.getUserPreferences(authUser.id);
        setSettings(prefs);
        setLoading(false)
      }
    }
    fetchSettings()
  }, [authUser])

  const handleSettingChange = async (key: string, value: any) => {
    if (!authUser) return;

    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    
    // This assumes your UserPreferences type can be partially updated.
    // You might need a more specific update function in firebaseDataService
    // if you only want to update nested properties.
    await firebaseDataService.saveUserPreferences(authUser.id, newSettings as UserPreferences);
  }

  const handleToggle = (key: string) => {
    handleSettingChange(key, !settings[key as keyof typeof settings]);
  }

  const handleSelect = (key: string, value: string) => {
    handleSettingChange(key, value);
  }

  const handleDeleteAccount = () => {
    setConfirmModalConfig({
      title: 'Delete Account',
      message: 'Are you sure you want to delete your account? This action cannot be undone.',
      onConfirm: async () => {
        if (authUser) {
          await firebaseDataService.deleteUser(authUser.id);
          await logout();
          navigate('/');
        }
      }
    });
    setShowConfirmModal(true);
  }

  if (loading) {
    return <div>Loading...</div>
  }

  const notificationSettings: SettingItem[] = [
    {
      id: 'pushNotifications',
      title: 'Push Notifications',
      description: 'Receive notifications about new activity',
      icon: BellIcon,
      type: 'toggle',
      value: settings.notifications?.push
    },
    {
      id: 'emailUpdates',
      title: 'Email Updates',
      description: 'Get weekly summaries in your email',
      icon: BellIcon,
      type: 'toggle',
      value: settings.notifications?.email
    },
    {
      id: 'soundEffects',
      title: 'Sound Effects',
      description: 'Play sounds for interactions',
      icon: BellIcon,
      type: 'toggle',
      value: settings.app?.soundEffects
    },
    {
      id: 'hapticFeedback',
      title: 'Haptic Feedback',
      description: 'Vibrate on interactions',
      icon: BellIcon,
      type: 'toggle',
      value: settings.app?.hapticFeedback
    }
  ]

  const privacySettings: SettingItem[] = [
    {
      id: 'privacyLevel',
      title: 'Default Privacy',
      description: 'Who can see your posts and lists',
      icon: EyeIcon,
      type: 'select',
      value: settings.privacy?.defaultPrivacy,
      options: [
        { label: 'Public', value: 'public' },
        { label: 'Friends Only', value: 'friends' },
        { label: 'Private', value: 'private' }
      ]
    },
    {
      id: 'locationSharing',
      title: 'Location Sharing',
      description: 'Share your location with friends',
      icon: GlobeAltIcon,
      type: 'toggle',
      value: settings.privacy?.locationSharing
    },
    {
      id: 'autoSave',
      title: 'Auto-Save to Lists',
      description: 'Automatically save places to appropriate lists',
      icon: ShieldCheckIcon,
      type: 'toggle',
      value: settings.privacy?.autoSaveToLists
    }
  ]

  const appearanceSettings: SettingItem[] = [
    {
      id: 'darkMode',
      title: 'Dark Mode',
      description: 'Switch between light and dark themes',
      icon: MoonIcon,
      type: 'toggle',
      value: settings.darkMode
    }
  ]

  const accountSettings: SettingItem[] = [
    {
      id: 'editProfile',
      title: 'Edit Profile',
      description: 'Update your profile information',
      icon: UserIcon,
      type: 'button',
      action: () => navigate('/profile/edit')
    },
    {
      id: 'following',
      title: 'Following & Followers',
      description: 'Manage who you follow and your followers',
      icon: UserIcon,
      type: 'button',
      action: () => navigate('/profile/following')
    },
    {
      id: 'logout',
      title: 'Sign Out',
      description: 'Sign out of your account',
      icon: Cog6ToothIcon,
      type: 'button',
      action: async () => {
        await logout();
        navigate('/');
      }
    },
    {
      id: 'deleteAccount',
      title: 'Delete Account',
      description: 'Permanently delete your account and all of your data',
      icon: UserIcon,
      type: 'button',
      action: handleDeleteAccount
    }
  ]

  const renderSettingItem = (item: SettingItem) => (
    <li key={item.id} className="py-3.5">
      <div className="flex items-center gap-3.5">
        <span className="shrink-0 w-9 h-9 rounded-full glass-honey flex items-center justify-center">
          <item.icon className="w-4 h-4" />
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="text-[14px] font-medium text-ink leading-tight">{item.title}</h3>
          <p className="font-mono text-[10px] tracking-[0.10em] uppercase text-ink-mute mt-0.5 truncate">{item.description}</p>
        </div>
        <div className="shrink-0">
          {item.type === 'toggle' && (
            <button
              onClick={() => handleToggle(item.id)}
              className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
              style={{ background: item.value ? 'var(--accent)' : 'var(--card-edge)' }}
              aria-pressed={!!item.value}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-paper transition-transform ${
                  item.value ? 'translate-x-6' : 'translate-x-1'
                }`}
                style={{ boxShadow: '0 1px 2px rgba(46, 28, 13, 0.30)' }}
              />
            </button>
          )}
          {item.type === 'select' && item.options && (
            <select
              value={item.value as string}
              onChange={(e) => handleSelect(item.id, e.target.value)}
              className="h-9 px-3 rounded-full bg-card border border-edge text-[13px] text-ink focus:outline-none focus:border-ink/40"
            >
              {item.options.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          )}
          {item.type === 'button' && (
            <button
              onClick={item.action}
              className={`h-9 px-4 rounded-full label-eyebrow transition-colors ${
                item.id === 'deleteAccount'
                  ? 'bg-card border border-edge text-[#9C2A2A] hover:border-[#9C2A2A]/40'
                  : 'btn-secondary'
              }`}
            >
              {item.id === 'logout' ? 'Sign out' : item.id === 'deleteAccount' ? 'Delete' : 'Edit →'}
            </button>
          )}
        </div>
      </div>
    </li>
  )

  return (
    <>
      <div className="relative min-h-full overflow-x-hidden">
        <header className="sticky top-0 z-30 bg-paper/90 backdrop-blur-md">
          <div className="px-5 pt-5 pb-3 flex items-center justify-between">
            <button
              onClick={() => { if (window.history.length > 1) navigate(-1); else navigate('/profile') }}
              className="h-10 w-10 rounded-full hover:bg-paper-deep flex items-center justify-center"
              aria-label="Back"
            >
              <ArrowLeftIcon className="w-5 h-5 text-ink" />
            </button>
            <h1 className="font-display text-[22px] leading-none text-ink">Settings</h1>
            <span className="w-10" />
          </div>
          <div className="border-b border-edge mx-5" />
        </header>

        <div className="relative z-10 px-5 py-6 space-y-8 max-w-2xl mx-auto">
          <section>
            <p className="label-eyebrow flex items-center gap-1.5 mb-3" style={{ color: 'var(--accent-deep)' }}>
              <span className="accent-bead-sm accent-bead" /> Notifications
            </p>
            <ul className="divide-y divide-edge border-y border-edge">
              {notificationSettings.map(renderSettingItem)}
            </ul>
          </section>

          <section>
            <p className="label-eyebrow flex items-center gap-1.5 mb-3" style={{ color: 'var(--accent-deep)' }}>
              <span className="accent-bead-sm accent-bead" /> Privacy & security
            </p>
            <ul className="divide-y divide-edge border-y border-edge">
              {privacySettings.map(renderSettingItem)}
            </ul>
          </section>

          <section>
            <p className="label-eyebrow flex items-center gap-1.5 mb-3" style={{ color: 'var(--accent-deep)' }}>
              <span className="accent-bead-sm accent-bead" /> Appearance
            </p>
            <ul className="divide-y divide-edge border-y border-edge">
              {appearanceSettings.map(renderSettingItem)}
            </ul>
          </section>

          <section>
            <p className="label-eyebrow flex items-center gap-1.5 mb-3" style={{ color: 'var(--accent-deep)' }}>
              <span className="accent-bead-sm accent-bead" /> Account
            </p>
            <ul className="divide-y divide-edge border-y border-edge">
              {accountSettings.map(renderSettingItem)}
            </ul>
          </section>

          <div className="text-center pt-4">
            <p className="font-display-italic text-[18px] text-ink">this · is</p>
            <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-mute mt-1">Version 1.0.0</p>
            <div className="flex justify-center gap-4 mt-4 font-mono text-[10px] tracking-[0.10em] uppercase">
              <button className="text-ink-mute hover:text-ink transition-colors">Privacy</button>
              <span className="text-ink-faint">·</span>
              <button className="text-ink-mute hover:text-ink transition-colors">Terms</button>
              <span className="text-ink-faint">·</span>
              <button className="text-ink-mute hover:text-ink transition-colors">Help</button>
            </div>
          </div>
        </div>
      </div>
      <ConfirmModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={confirmModalConfig.onConfirm}
        title={confirmModalConfig.title}
        message={confirmModalConfig.message}
      />
    </>
  )
}

export default Settings 