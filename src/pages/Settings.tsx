import { useState, useEffect } from 'react'
import { ArrowLeftIcon, BellIcon, EyeIcon, EyeSlashIcon, ShieldCheckIcon, GlobeAltIcon, UserIcon, Cog6ToothIcon, MoonIcon, SunIcon, DevicePhoneMobileIcon } from '@heroicons/react/24/outline'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.js'
import { firebaseDataService } from '../services/firebaseDataService.js'
import type { UserPreferences } from '../services/firebaseDataService.js'
import ConfirmModal from '../components/ConfirmModal.js'

// SVG botanical accent
const BotanicalAccent = () => (
  <svg width="60" height="60" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="absolute -top-6 -left-6 opacity-30 select-none pointer-events-none">
    <path d="M10 50 Q30 10 50 50" stroke="#A3B3A3" strokeWidth="3" fill="none"/>
    <ellipse cx="18" cy="38" rx="4" ry="8" fill="#C7D0C7"/>
    <ellipse cx="30" cy="28" rx="4" ry="8" fill="#A3B3A3"/>
    <ellipse cx="42" cy="38" rx="4" ry="8" fill="#7A927A"/>
  </svg>
)

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
          logout();
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
      action: () => {
        logout();
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
    <div
      key={item.id}
      className="relative rounded-2xl shadow-botanical border border-linen-200 bg-white/95 p-4 transition hover:shadow-cozy hover:-translate-y-1"
    >
      <BotanicalAccent />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 flex-1">
          <div className="w-10 h-10 rounded-xl bg-sage-100 flex items-center justify-center">
            <item.icon className="w-5 h-5 text-sage-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-serif font-semibold text-charcoal-800 mb-1">{item.title}</h3>
            <p className="text-sm text-charcoal-500">{item.description}</p>
          </div>
        </div>

        <div className="flex-shrink-0">
          {item.type === 'toggle' && (
            <button
              onClick={() => handleToggle(item.id)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                item.value ? 'bg-sage-500' : 'bg-linen-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  item.value ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          )}

          {item.type === 'select' && item.options && (
            <select
              value={item.value as string}
              onChange={(e) => handleSelect(item.id, e.target.value)}
              className="px-3 py-2 rounded-xl border border-linen-200 bg-linen-50 text-charcoal-700 focus:outline-none focus:ring-2 focus:ring-sage-200 text-sm"
            >
              {item.options.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          )}

          {item.type === 'button' && (
            <button
              onClick={item.action}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors shadow-soft ${
                item.id === 'deleteAccount'
                  ? 'bg-red-500 text-white hover:bg-red-600'
                  : 'bg-sage-500 text-white hover:bg-sage-600'
              }`}
            >
              {item.id === 'logout' ? 'Sign Out' : item.id === 'deleteAccount' ? 'Delete' : 'Edit'}
            </button>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <>
      <div className="relative min-h-full overflow-x-hidden bg-linen-50">
        {/* Enhanced background */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          <div className="absolute inset-0 bg-linen-texture opacity-80 mix-blend-multiply"></div>
          <div className="absolute inset-0 bg-gradient-to-br from-gold-50/60 via-linen-100/80 to-sage-100/70 opacity-80"></div>
          <div className="absolute inset-0 bg-gradient-radial from-transparent via-transparent to-charcoal-900/10"></div>
        </div>

        {/* Header */}
        <div className="relative z-10 p-4 border-b border-linen-200 bg-white/95 backdrop-blur-glass">
          <div className="flex items-center justify-between">
            <button
              onClick={() => { if (window.history.length > 1) navigate(-1); else navigate('/profile') }}
              className="p-2 rounded-xl bg-linen-100 text-charcoal-600 hover:bg-linen-200 transition-colors"
            >
              <ArrowLeftIcon className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-serif font-semibold text-charcoal-800">Settings</h1>
            <div className="w-10"></div> {/* Spacer for centering */}
          </div>
        </div>

        {/* Main Content */}
        <div className="relative z-10 p-4 space-y-6 max-w-2xl mx-auto">
          {/* Notifications Section */}
          <div>
            <h2 className="text-lg font-serif font-semibold text-charcoal-800 mb-4 flex items-center gap-2">
              <BellIcon className="w-5 h-5 text-sage-600" />
              Notifications
            </h2>
            <div className="space-y-3">
              {notificationSettings.map(renderSettingItem)}
            </div>
          </div>

          {/* Privacy Section */}
          <div>
            <h2 className="text-lg font-serif font-semibold text-charcoal-800 mb-4 flex items-center gap-2">
              <ShieldCheckIcon className="w-5 h-5 text-sage-600" />
              Privacy & Security
            </h2>
            <div className="space-y-3">
              {privacySettings.map(renderSettingItem)}
            </div>
          </div>

          {/* Appearance Section */}
          <div>
            <h2 className="text-lg font-serif font-semibold text-charcoal-800 mb-4 flex items-center gap-2">
              <DevicePhoneMobileIcon className="w-5 h-5 text-sage-600" />
              Appearance
            </h2>
            <div className="space-y-3">
              {appearanceSettings.map(renderSettingItem)}
            </div>
          </div>

          {/* Account Section */}
          <div>
            <h2 className="text-lg font-serif font-semibold text-charcoal-800 mb-4 flex items-center gap-2">
              <UserIcon className="w-5 h-5 text-sage-600" />
              Account
            </h2>
            <div className="space-y-3">
              {accountSettings.map(renderSettingItem)}
            </div>
          </div>

          {/* App Info */}
          <div className="rounded-3xl shadow-botanical border border-linen-200 bg-white/95 p-6 text-center">
            <h3 className="text-lg font-serif font-semibold text-charcoal-800 mb-2">this.is</h3>
            <p className="text-sm text-charcoal-500 mb-4">Version 1.0.0</p>
            <div className="flex justify-center gap-4 text-xs text-charcoal-400">
              <button className="hover:text-charcoal-600 transition-colors">Privacy Policy</button>
              <button className="hover:text-charcoal-600 transition-colors">Terms of Service</button>
              <button className="hover:text-charcoal-600 transition-colors">Help & Support</button>
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