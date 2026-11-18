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
        obsidian: {
          root: '#0a0a0a',
          sidebar: '#0d0d0d',
          elevated: '#111111',
          controls: '#161616',
          controlsHover: '#1f1f1f',
          controlsActive: '#121212',
          inputWell: '#0f0f0f',
          border: 'rgba(255, 255, 255, 0.10)',
          textPrimary: '#ededed',
          textSecondary: '#888888',
          textMuted: '#6e7681',
          accent: '#0070f3',
          cta: '#ededed'
        },
        themeDay: {
          bg: '#ffffff',
          text: '#121212'
        },
        themeNight: {
          bg: '#0c0c0d',
          text: '#f5f7fa'
        },
        themeLightSepia: {
          bg: '#f5ecd8',
          text: '#1f1810'
        },
        themeDarkSepia: {
          bg: '#1f1914',
          text: '#f5ede0'
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
