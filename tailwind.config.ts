import type { Config } from 'tailwindcss'

export default {
  content: [
    './src/renderer/index.html',
    './src/renderer/src/**/*.{js,ts,jsx,tsx}'
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        icecream: {
          sidebar: '#171a21',
          canvas: '#171a21',
          topbar: '#282c37',
          dock: '#282c37',
          card: '#282c37',
          cardHover: '#3c404d',
          border: '#3c404d',
          divider: '#3c404d',
          btnDark: '#282c37',
          btnBorder: '#3c404d',
          btnHover: '#3c404d',
          blue: '#2a69df',
          blueHover: '#3b79ef',
          activeNav: '#282c37',
          textMuted: '#8b949e',
          textSubtle: '#6e7681'
        },
        themeDay: {
          bg: '#ffffff',
          text: '#202020'
        },
        themeNight: {
          bg: '#1c1f26',
          text: '#d8d8d8'
        },
        themeLightSepia: {
          bg: '#fbf0d9',
          text: '#5f4b32'
        },
        themeDarkSepia: {
          bg: '#2d261e',
          text: '#d5c7b3'
        }
      },
      fontFamily: {
        sans: ['"Libre Baskerville"', 'Baskerville', '"Baskerville Old Face"', 'Georgia', 'serif'],
        readingSerif: ['"Libre Baskerville"', 'Baskerville', 'Georgia', 'serif'],
        readingSans: ['"Segoe UI"', '-apple-system', 'BlinkMacSystemFont', 'sans-serif']
      },
      borderRadius: {
        sm: '2px',
        DEFAULT: '4px',
        md: '4px',
        lg: '6px'
      }
    }
  },
  plugins: []
} satisfies Config
