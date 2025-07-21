import React, { useState } from 'react'
import LoginModal from '../components/LoginModal'
import SignupModal from '../components/SignupModal'
import logo from '../assets/thisis_transparent.png'

// Botanical accent component
const BotanicalAccent = () => (
  <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="absolute -top-8 -left-8 opacity-20 select-none pointer-events-none">
    <path d="M20 100 Q60 20 100 100" stroke="#A3B3A3" strokeWidth="4" fill="none"/>
    <ellipse cx="36" cy="76" rx="8" ry="16" fill="#C7D0C7"/>
    <ellipse cx="60" cy="56" rx="8" ry="16" fill="#A3B3A3"/>
    <ellipse cx="84" cy="76" rx="8" ry="16" fill="#7A927A"/>
    <path d="M40 80 Q60 40 80 80" stroke="#9CAF88" strokeWidth="2" fill="none"/>
    <ellipse cx="50" cy="65" rx="4" ry="8" fill="#B8C5A8"/>
    <ellipse cx="70" cy="65" rx="4" ry="8" fill="#9CAF88"/>
  </svg>
)

// Small corner leaf accent
const CornerLeaf = () => (
  <svg width="40" height="40" viewBox="0 0 40 40" fill="none" className="absolute -bottom-2 -right-2 opacity-15 select-none pointer-events-none">
    <path d="M8 32 Q20 8 32 32" stroke="#9CAF88" strokeWidth="2" fill="none"/>
    <ellipse cx="16" cy="24" rx="2" ry="4" fill="#B8C5A8"/>
    <ellipse cx="24" cy="16" rx="2" ry="4" fill="#9CAF88"/>
  </svg>
)

export default function Auth() {
  const [showLogin, setShowLogin] = useState(false)
  const [showSignup, setShowSignup] = useState(false)

  return (
    <div className="min-h-screen overflow-y-auto bg-parchment">
      {/* Enhanced background with botanical elements */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-linen-texture opacity-40 mix-blend-multiply"></div>
        <div className="absolute inset-0 bg-gradient-to-br from-amber-50/30 via-warmGray-100/50 to-rose-50/40 opacity-90"></div>
        <div className="absolute inset-0 bg-gradient-radial from-transparent via-transparent to-brown-900/3"></div>
        
        {/* Floating botanical elements */}
        <div className="absolute top-20 left-10 opacity-15">
          <svg width="60" height="60" viewBox="0 0 60 60" fill="none">
            <path d="M10 50 Q30 10 50 50" stroke="#A3B3A3" strokeWidth="2" fill="none"/>
            <ellipse cx="20" cy="40" rx="3" ry="6" fill="#C7D0C7"/>
            <ellipse cx="30" cy="30" rx="3" ry="6" fill="#A3B3A3"/>
            <ellipse cx="40" cy="40" rx="3" ry="6" fill="#7A927A"/>
          </svg>
        </div>
        <div className="absolute bottom-20 right-10 opacity-15">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <path d="M5 35 Q20 5 35 35" stroke="#9CAF88" strokeWidth="2" fill="none"/>
            <ellipse cx="15" cy="28" rx="2" ry="4" fill="#B8C5A8"/>
            <ellipse cx="25" cy="20" rx="2" ry="4" fill="#9CAF88"/>
          </svg>
        </div>
      </div>

      <div className="relative z-10 flex items-center justify-center min-h-screen p-4">
        <div className="max-w-md w-full">
          {/* Main Content Card */}
          <div className="relative bg-white/80 backdrop-blur-md rounded-2xl shadow-xl border border-warmGray-200 p-8 text-center overflow-hidden">
            {/* Botanical accent */}
            <BotanicalAccent />
            <CornerLeaf />
            
            {/* Logo/Brand */}
            <div className="mb-8 relative z-10">
              <img src={logo} alt="This.Is logo" className="h-28 w-auto mx-auto mb-6" />
            </div>

            {/* Welcome Message */}
            <div className="mb-8 relative z-10">
              <h2 className="text-2xl font-serif font-semibold text-brown-700 mb-3 tracking-wide">Welcome to This.Is</h2>
              <p className="text-brown-600 text-base leading-relaxed">
                Your cozy corner of the world to save, share, and explore meaningful spots. Whether it's a tucked-away café, a breathtaking trail, or your favorite go-to, you'll never lose track of the places that matter.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="space-y-4 mb-8 relative z-10">
              <button
                onClick={() => setShowSignup(true)}
                className="w-full bg-[#E17373] text-white rounded-full py-3 px-6 hover:bg-[#cd5c5c] transition-all hover:brightness-110 font-medium shadow-sm"
              >
                Start Exploring
              </button>
              
              <button
                onClick={() => setShowLogin(true)}
                className="w-full bg-white border-2 border-warmGray-300 text-brown-700 rounded-full py-3 px-6 font-medium shadow-sm hover:bg-warmGray-50 hover:border-[#E17373] focus:ring-2 focus:ring-[#E17373] focus:ring-offset-2 transition-all hover:brightness-110"
              >
                Sign In
              </button>
            </div>

            {/* Features with botanical styling */}
            <div className="relative z-10">
              <div className="relative flex items-center justify-center mb-6">
                <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-amber-200 via-rose-200 to-amber-200 opacity-60" />
                <span className="relative z-10 px-6 py-2 bg-white text-sm font-semibold tracking-wider text-brown-600 uppercase shadow-soft rounded-full border border-warmGray-200">
                  What you can do
                </span>
              </div>
              
              <div className="grid grid-cols-1 gap-4 text-sm">
                <div className="flex items-start space-x-3 p-4 rounded-xl bg-warmGray-50 border border-warmGray-200 hover:bg-warmGray-100 transition-colors">
                  <div className="w-2 h-2 bg-[#E17373] rounded-full mt-2 flex-shrink-0"></div>
                  <div>
                    <div className="text-brown-700 font-medium mb-1">🧭 Find hidden gems</div>
                    <div className="text-brown-600 text-xs">Browse beloved spots and under-the-radar hangouts from locals and travelers like you.</div>
                  </div>
                </div>
                <div className="flex items-start space-x-3 p-4 rounded-xl bg-warmGray-50 border border-warmGray-200 hover:bg-warmGray-100 transition-colors">
                  <div className="w-2 h-2 bg-[#E17373] rounded-full mt-2 flex-shrink-0"></div>
                  <div>
                    <div className="text-brown-700 font-medium mb-1">📝 Build beautiful lists</div>
                    <div className="text-brown-600 text-xs">Organize your favorite cafés, shops, and sights into personal or shareable collections.</div>
                  </div>
                </div>
                <div className="flex items-start space-x-3 p-4 rounded-xl bg-warmGray-50 border border-warmGray-200 hover:bg-warmGray-100 transition-colors">
                  <div className="w-2 h-2 bg-[#E17373] rounded-full mt-2 flex-shrink-0"></div>
                  <div>
                    <div className="text-brown-700 font-medium mb-1">💌 Share the love</div>
                    <div className="text-brown-600 text-xs">Show friends where you've been, where you're going, and where they need to go.</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-6 text-center">
            <p className="text-brown-500 text-xs">
              By continuing, you agree to our Terms of Service and Privacy Policy
            </p>
          </div>
        </div>
      </div>

      {/* Modals */}
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