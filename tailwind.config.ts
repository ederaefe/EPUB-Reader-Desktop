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
        mesh: {
          base: '#0b0e14',
          blob1: '#1a2d52',
          blob2: '#271d47',
          blob3: '#123328'
        },
        glass: {
          surface: 'rgba(18, 24, 40, 0.65)',
          raised: 'rgba(26, 36, 60, 0.75)',
          overlay: 'rgba(14, 20, 34, 0.85)',
          border: 'rgba(255, 255, 255, 0.08)',
          shine: 'rgba(255, 255, 255, 0.14)'
        },
        accent: {
          DEFAULT: '#3b82f6',
          hover: '#2563eb',
          glow: '#1d4ed8'
        }
      },
      borderRadius: {
        card: '16px',
        drawer: '24px',
        pill: '9999px'
      },
      boxShadow: {
        glass: '0 8px 32px 0 rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.12)',
        panel: '0 16px 40px 0 rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.14)'
      }
    }
  },
  plugins: []
} satisfies Config
