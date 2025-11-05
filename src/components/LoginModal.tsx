import React, { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { XMarkIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline'

interface LoginModalProps {
  isOpen: boolean
  onClose: () => void
  onSwitchToSignup: () => void
}

export default function LoginModal({ isOpen, onClose, onSwitchToSignup }: LoginModalProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signIn } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email || !password) {
      setError('Please fill in all fields')
      return
    }

    try {
      setError('')
      setLoading(true)
      await signIn(email, password)
      onClose()
    } catch (error: any) {
      setError('Failed to sign in. Please check your credentials.')
      console.error('Login error:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/45 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="rounded-2xl shadow-xl max-w-md w-full p-8" style={{ background: 'linear-gradient(145deg, rgba(255,255,255,0.86), rgba(255,255,255,0.72))', backdropFilter: 'blur(18px) saturate(1.06)', border: '1px solid rgba(255,255,255,0.45)' }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-serif font-semibold text-title-glass tracking-wide">Welcome Back</h2>
          <button onClick={onClose} className="pill pill--quiet h-[36px] min-w-[36px] px-0">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
              <p className="text-red-600 text-sm font-medium">{error}</p>
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-bark-800 mb-2">
              Email
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-white/40 rounded-xl focus:ring-2 focus:ring-moss-500 focus:border-transparent transition-all bg-white/80 backdrop-blur-sm"
              placeholder="Enter your email"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-bark-800 mb-2">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 pr-12 border border-white/40 rounded-xl focus:ring-2 focus:ring-moss-500 focus:border-transparent transition-all bg-white/80 backdrop-blur-sm"
                placeholder="Enter your password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-brown-400 hover:text-brown-600"
              >
                {showPassword ? (
                  <EyeSlashIcon className="w-5 h-5" />
                ) : (
                  <EyeIcon className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          <button type="submit" disabled={loading} className="w-full pill pill--primary h-[44px] text-[15px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-brown-600 text-sm">
            Don't have an account?{' '}
            <button onClick={onSwitchToSignup} className="pill pill--quiet h-[32px] px-3 text-[13px]">Sign up</button>
          </p>
        </div>
      </div>
    </div>
  )
} 
