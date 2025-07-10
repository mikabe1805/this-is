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
        ...defaultColors,
        testcoral: '#d97c5a',
        cream: {
          50: '#fdf8f3',
          100: '#f8f3ea',
          200: '#f3ede3',
          300: '#ede6da',
          400: '#e5dccb',
          500: '#d6c7b0',
          600: '#c3b29a',
          700: '#a99580',
          800: '#8f7a68',
          900: '#756050',
        },
        brown: {
          100: '#f5f0eb',
          200: '#e8ddd0',
          300: '#d4c0a8',
          400: '#b89a7a',
          500: '#6d4c2f',
          600: '#4e3521',
          700: '#3d2a1a',
          800: '#2f2014',
          900: '#23170e',
        },
        coral: {
          50: '#fef7f4',
          100: '#fbeee6',
          200: '#f7d9c8',
          300: '#f7cbbd',
          400: '#f0b09a',
          500: '#e7a07a',
          600: '#d97c5a',
          700: '#c46547',
          800: '#a85339',
          900: '#8c422d',
        },
        sage: {
          50: '#f7f9f7',
          100: '#e6ede7',
          200: '#d1ddd3',
          300: '#b7c8b5',
          400: '#9bb398',
          500: '#7a947a',
          600: '#5f7a5f',
          700: '#4a614a',
          800: '#394b39',
          900: '#2c392c',
        },
        gray: {
          100: '#f7f7f7',
          300: '#e0e0e0',
          500: '#b0b0b0',
          700: '#6b6b6b',
        },
      },
      fontFamily: {
        serif: ["'DM Serif Display'", 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 2px 8px 0 rgba(0,0,0,0.04)',
        card: '0 1.5px 8px 0 rgba(0,0,0,0.06)',
        xl: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        liquid: '0 4px 18px -4px rgba(0,0,0,0.08)',
      },
      borderRadius: {
        xl: '1.25rem',
        pill: '9999px',
      },
      borderWidth: {
        3: '3px',
      },
    },
  },
  safelist: [
    {
      pattern: /(from|to|via)-(coral|sage|cream|brown)-(50|100|200|300|400|500|600|700|800|900)/,
      variants: ['hover', 'focus'],
    },
    {
      pattern: /(bg|text|border|shadow)-(coral|sage|cream|brown)-(50|100|200|300|400|500|600|700|800|900)/,
      variants: ['hover', 'focus'],
    },
  ],
}; 