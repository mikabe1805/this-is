import React, { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { XMarkIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline'
import { useModalDismiss } from '../hooks/useModalDismiss'
import { authErrorMessage } from '../utils/authErrors'

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
    } catch (error: unknown) {
      setError(authErrorMessage(error, 'Failed to sign in. Please check your credentials.'))
      console.error('Login error:', error)
    } finally {
      setLoading(false)
    }
  }

  useModalDismiss(isOpen, onClose)

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(46, 28, 13, 0.55)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full sm:max-w-md rounded-t-[24px] sm:rounded-[24px] bg-paper overflow-hidden"
        style={{ boxShadow: '0 -8px 40px rgba(46, 28, 13, 0.25), 0 24px 60px rgba(46, 28, 13, 0.30)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-edge">
          <p className="label-eyebrow text-ink-mute">Sign in</p>
          <button onClick={onClose} className="h-9 w-9 rounded-full hover:bg-paper-deep flex items-center justify-center" aria-label="Close">
            <XMarkIcon className="w-5 h-5 text-ink" />
          </button>
        </div>
        <div className="px-5 pt-6 pb-5">
          <h2 className="font-display text-[30px] leading-tight text-ink">
            Welcome back<span style={{ color: 'var(--bloom)' }}>.</span>
          </h2>
          <p className="text-[13px] text-ink-soft mt-1.5">Pick up where you left off.</p>
        </div>
        <form onSubmit={handleSubmit} className="px-5 pb-5 space-y-3">
          {error && (
            <div className="glass-honey rounded-[10px] px-3 py-2.5 text-[13px]">
              {error}
            </div>
          )}
          <div>
            <label htmlFor="email" className="label-eyebrow text-ink-mute mb-1.5 block">Email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-11 px-4 rounded-full bg-card border border-edge text-[14px] text-ink placeholder:text-ink-mute outline-none focus:border-ink/40"
              placeholder="you@somewhere.com"
              required
              autoComplete="email"
            />
          </div>
          <div>
            <label htmlFor="password" className="label-eyebrow text-ink-mute mb-1.5 block">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-11 pl-4 pr-11 rounded-full bg-card border border-edge text-[14px] text-ink placeholder:text-ink-mute outline-none focus:border-ink/40"
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-mute hover:text-ink"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="btn-cta w-full h-12 mt-2 font-semibold text-[15px]"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <div className="px-5 pb-6 text-center border-t border-edge pt-4">
          <p className="text-[13px] text-ink-soft">
            Don't have an account?{' '}
            <button onClick={onSwitchToSignup} className="text-accent underline-offset-4 hover:underline font-medium" style={{ color: 'var(--accent-deep)' }}>
              Sign up
            </button>
          </p>
        </div>
      </div>
    </div>
  )
} 
