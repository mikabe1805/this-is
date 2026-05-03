import { useState } from 'react'
import LoginModal from '../components/LoginModal'
import SignupModal from '../components/SignupModal'

export default function Auth() {
  const [showLogin, setShowLogin] = useState(false)
  const [showSignup, setShowSignup] = useState(false)

  return (
    <div
      data-scroll-root
      className="relative h-full overflow-y-auto overflow-x-hidden bg-paper text-ink"
    >
      <div className="fixed inset-0 pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "url('/assets/stoneLight.png')",
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(244,235,218,0.55) 0%, rgba(244,235,218,0.40) 50%, rgba(244,235,218,0.65) 100%)',
          }}
        />
        <div
          className="absolute inset-x-0 top-0 h-[55%]"
          style={{
            background:
              'radial-gradient(ellipse at 50% 0%, rgba(255, 226, 168, 0.45) 0%, rgba(244,235,218,0) 65%)',
          }}
        />
        <div
          className="absolute -bottom-16 -right-16 w-[55%] aspect-square"
          style={{
            backgroundImage: "url('/assets/leaves.png')",
            backgroundSize: 'contain',
            backgroundPosition: 'bottom right',
            backgroundRepeat: 'no-repeat',
            opacity: 0.16,
            mixBlendMode: 'multiply',
          }}
        />
      </div>

      <div className="relative flex flex-col min-h-full px-6 pt-12 pb-10 max-w-md mx-auto"
           style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 40px)' }}>
        <div className="flex items-center gap-1.5">
          <span className="font-display-italic text-[16px] text-ink">this</span>
          <span className="accent-bead" />
          <span className="font-display-italic text-[16px] text-ink">is</span>
        </div>

        <div className="flex-1 flex flex-col justify-end">
          <p className="label-eyebrow text-ink-mute mb-4">Issue №01</p>
          <h1 className="font-display text-[52px] leading-[0.95] text-ink">
            The places<br />
            you love<span style={{ color: 'var(--bloom)' }}>.</span>
          </h1>
          <p className="font-display-italic text-[18px] text-ink-soft mt-5 max-w-sm leading-snug">
            A field guide to the spots worth coming back to — yours, your friends', and the ones you haven't found yet.
          </p>
        </div>

        <div className="mt-12 space-y-3">
          <button
            onClick={() => setShowSignup(true)}
            className="btn-cta w-full h-13 py-4 font-semibold text-[15px] tracking-tight"
          >
            Get started
          </button>
          <button
            onClick={() => setShowLogin(true)}
            className="w-full h-13 py-4 rounded-full bg-card border border-edge text-ink font-medium text-[15px] active:scale-[0.99] transition-transform hover:border-ink/40"
          >
            I have an account
          </button>
          <p className="text-center font-mono text-[10px] tracking-[0.12em] uppercase text-ink-mute pt-3">
            Terms · Privacy
          </p>
        </div>
      </div>

      <LoginModal
        isOpen={showLogin}
        onClose={() => setShowLogin(false)}
        onSwitchToSignup={() => {
          setShowLogin(false)
          setShowSignup(true)
        }}
      />
      <SignupModal
        isOpen={showSignup}
        onClose={() => setShowSignup(false)}
        onSwitchToLogin={() => {
          setShowSignup(false)
          setShowLogin(true)
        }}
      />
    </div>
  )
}
