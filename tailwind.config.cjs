/** @type {import('tailwindcss').Config} */
const defaultColors = require('tailwindcss/colors');

module.exports = {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        parchment: { 50:'#F7F5F2', 100:'#EEECE7', 200:'#E8E3DA', 300:'#DCD5CA' },
        bark:      { 700:'#5C534A', 900:'#3D3630' },
        moss:      { 300:'#BFCAB5', 500:'#8FA287', 600:'#6F8A6B', 700:'#5E765C' },
        aurum:     { 200:'#F0E6CE', 300:'#E8DBB5' },
        info:  '#6F8F8C',
        success: '#4C6E54',
        warn:   '#C9A56A',
        danger: '#B76B63',
      },
      fontFamily: {
        serif: ["'DM Serif Display'", 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ["'Playfair Display'", 'Georgia', 'serif'],
        handwriting: ["'Caveat'", 'cursive'],
      },
      boxShadow: {
        glass: '0 8px 24px rgba(61,54,48,0.10)',
        soft:  '0 2px 12px rgba(0,0,0,0.06)',
      },
      borderRadius: {
        xl2: '1.25rem'
      },
      backdropBlur: {
        'xs': '2px',
        'glass': '12px',
        'crystal': '16px',
        'frost': '8px',
      },
      backgroundImage: {
        'linen-texture': "url('https://www.transparenttextures.com/patterns/linen.png')",
        'botanical-overlay': "linear-gradient(120deg, rgba(246,247,246,0.95) 60%, rgba(167, 191, 167, 0.08) 100%)",
      },
      borderRadius: {
        lg: "12px",
        xl: "16px", 
        "2xl": "24px",
        pill: '9999px',
        'scrapbook': '1.5rem',
        'sticker': '2rem',
      },
      borderWidth: {
        3: '3px',
      },
      scale: {
        '102': '1.02',
        '101': '1.01',
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'bounce-gentle': 'bounce-gentle 2s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'rotate-slow': 'rotate-slow 20s linear infinite',
        'slide-up': 'slide-up 0.6s ease-out',
        'fade-in': 'fade-in 0.8s ease-out',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'bounce-gentle': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-5px)' },
        },
        glow: {
          '0%': { boxShadow: '0 0 20px rgba(240, 119, 92, 0.3)' },
          '100%': { boxShadow: '0 0 30px rgba(240, 119, 92, 0.5)' },
        },
        'rotate-slow': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0px)', opacity: '1' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  safelist: [
    // New color palette
    'bg-peach-50', 'bg-peach-100', 'bg-peach-200', 'bg-peach-300', 'bg-peach-400', 'bg-peach-500', 'bg-peach-600', 'bg-peach-700', 'bg-peach-800', 'bg-peach-900',
    'text-peach-50', 'text-peach-100', 'text-peach-200', 'text-peach-300', 'text-peach-400', 'text-peach-500', 'text-peach-600', 'text-peach-700', 'text-peach-800', 'text-peach-900',
    'bg-terracotta-50', 'bg-terracotta-100', 'bg-terracotta-200', 'bg-terracotta-300', 'bg-terracotta-400', 'bg-terracotta-500', 'bg-terracotta-600', 'bg-terracotta-700', 'bg-terracotta-800', 'bg-terracotta-900',
    'text-terracotta-50', 'text-terracotta-100', 'text-terracotta-200', 'text-terracotta-300', 'text-terracotta-400', 'text-terracotta-500', 'text-terracotta-600', 'text-terracotta-700', 'text-terracotta-800', 'text-terracotta-900',
    'bg-linen-50', 'bg-linen-100', 'bg-linen-200', 'bg-linen-300', 'bg-linen-400', 'bg-linen-500', 'bg-linen-600', 'bg-linen-700', 'bg-linen-800', 'bg-linen-900',
    'text-linen-50', 'text-linen-100', 'text-linen-200', 'text-linen-300', 'text-linen-400', 'text-linen-500', 'text-linen-600', 'text-linen-700', 'text-linen-800', 'text-linen-900',
    'bg-almond-50', 'bg-almond-100', 'bg-almond-200', 'bg-almond-300', 'bg-almond-400', 'bg-almond-500', 'bg-almond-600', 'bg-almond-700', 'bg-almond-800', 'bg-almond-900',
    'text-almond-50', 'text-almond-100', 'text-almond-200', 'text-almond-300', 'text-almond-400', 'text-almond-500', 'text-almond-600', 'text-almond-700', 'text-almond-800', 'text-almond-900',
    'bg-coral-50', 'bg-coral-100', 'bg-coral-200', 'bg-coral-300', 'bg-coral-400', 'bg-coral-500', 'bg-coral-600', 'bg-coral-700', 'bg-coral-800', 'bg-coral-900',
    'text-coral-50', 'text-coral-100', 'text-coral-200', 'text-coral-300', 'text-coral-400', 'text-coral-500', 'text-coral-600', 'text-coral-700', 'text-coral-800', 'text-coral-900',
    'bg-yellow-50', 'bg-yellow-100', 'bg-yellow-200', 'bg-yellow-300', 'bg-yellow-400', 'bg-yellow-500', 'bg-yellow-600', 'bg-yellow-700', 'bg-yellow-800', 'bg-yellow-900',
    'text-yellow-50', 'text-yellow-100', 'text-yellow-200', 'text-yellow-300', 'text-yellow-400', 'text-yellow-500', 'text-yellow-600', 'text-yellow-700', 'text-yellow-800', 'text-yellow-900',
    'bg-cherry-50', 'bg-cherry-100', 'bg-cherry-200', 'bg-cherry-300', 'bg-cherry-400', 'bg-cherry-500', 'bg-cherry-600', 'bg-cherry-700', 'bg-cherry-800', 'bg-cherry-900',
    'text-cherry-50', 'text-cherry-100', 'text-cherry-200', 'text-cherry-300', 'text-cherry-400', 'text-cherry-500', 'text-cherry-600', 'text-cherry-700', 'text-cherry-800', 'text-cherry-900',
    'bg-sage-50', 'bg-sage-100', 'bg-sage-200', 'bg-sage-300', 'bg-sage-400', 'bg-sage-500', 'bg-sage-600', 'bg-sage-700', 'bg-sage-800', 'bg-sage-900',
    'text-sage-50', 'text-sage-100', 'text-sage-200', 'text-sage-300', 'text-sage-400', 'text-sage-500', 'text-sage-600', 'text-sage-700', 'text-sage-800', 'text-sage-900',
    'bg-blue-50', 'bg-blue-100', 'bg-blue-200', 'bg-blue-300', 'bg-blue-400', 'bg-blue-500', 'bg-blue-600', 'bg-blue-700', 'bg-blue-800', 'bg-blue-900',
    'text-blue-50', 'text-blue-100', 'text-blue-200', 'text-blue-300', 'text-blue-400', 'text-blue-500', 'text-blue-600', 'text-blue-700', 'text-blue-800', 'text-blue-900',
    // Legacy colors for compatibility
    'bg-warm-500', 'bg-warm-600', 'bg-warm-700', 'text-warm-500', 'text-warm-600', 'text-warm-700',
    'bg-cream-500', 'bg-cream-600', 'bg-cream-700', 'text-cream-500', 'text-cream-600', 'text-cream-700',
    'bg-earth-500', 'bg-earth-600', 'bg-earth-700', 'text-earth-500', 'text-earth-600', 'text-earth-700',
    'bg-sage-500', 'bg-sage-600', 'bg-sage-700', 'text-sage-500', 'text-sage-600', 'text-sage-700',
    'bg-cream-50', 'bg-cream-100', 'bg-cream-200', 'bg-cream-300', 'bg-cream-400', 'bg-cream-500', 'bg-cream-600', 'bg-cream-700', 'bg-cream-800', 'bg-cream-900',
    'text-cream-50', 'text-cream-100', 'text-cream-200', 'text-cream-300', 'text-cream-400', 'text-cream-500', 'text-cream-600', 'text-cream-700', 'text-cream-800', 'text-cream-900',
    'bg-coral-50', 'bg-coral-100', 'bg-coral-200', 'bg-coral-300', 'bg-coral-400', 'bg-coral-500', 'bg-coral-600', 'bg-coral-700', 'bg-coral-800', 'bg-coral-900',
    'text-coral-50', 'text-coral-100', 'text-coral-200', 'text-coral-300', 'text-coral-400', 'text-coral-500', 'text-coral-600', 'text-coral-700', 'text-coral-800', 'text-coral-900',
    'bg-success-500', 'bg-success-600', 'bg-success-700', 'text-success-500', 'text-success-600', 'text-success-700',
    'bg-warning-500', 'bg-warning-600', 'bg-warning-700', 'text-warning-500', 'text-warning-600', 'text-warning-700',
  ],
  plugins: [],
}; 