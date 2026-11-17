import React from 'react'
import type { ReaderTheme } from '../ui/ThemePickerGrid'

interface FullscreenClimaxWaveOverlayProps {
  active: boolean
  isImmersiveFullscreen: boolean
  theme: ReaderTheme
  onComplete: () => void
}

const WAVE_THEME_CLASS: Record<ReaderTheme, string> = {
  night: 'climax-wave-night',
  'dark-sepia': 'climax-wave-dark-sepia',
  'light-sepia': 'climax-wave-light-sepia',
  day: 'climax-wave-day'
}

const TOP_GLOW_THEME_CLASS: Record<ReaderTheme, string> = {
  night: 'climax-top-glow-night',
  'dark-sepia': 'climax-top-glow-dark-sepia',
  'light-sepia': 'climax-top-glow-light-sepia',
  day: 'climax-top-glow-day'
}

/**
 * Ultra-subtle, theme-adaptive crimson atmosphere that sweeps calmly from the
 * top of the viewport to the bottom 3 times when hitting a book's random climax
 * in Immersive Fullscreen. Stops and unmounts immediately if fullscreen is exited.
 */
export const FullscreenClimaxWaveOverlay: React.FC<FullscreenClimaxWaveOverlayProps> = ({
  active,
  isImmersiveFullscreen,
  theme,
  onComplete
}) => {
  if (!active || !isImmersiveFullscreen) return null

  return (
    <div
      aria-hidden="true"
      data-preserve-theme="true"
      className="fixed inset-0 z-[92] pointer-events-none overflow-hidden"
    >
      {/* Synchronized soft top-edge crimson launch bloom */}
      <div
        className={`absolute inset-x-0 top-0 h-[28vh] pointer-events-none ${
          TOP_GLOW_THEME_CLASS[theme] || TOP_GLOW_THEME_CLASS.night
        }`}
      />

      {/* Calm feathered atmospheric red wave sweeping top -> bottom 3 times */}
      <div
        onAnimationEnd={onComplete}
        className={`absolute inset-x-0 top-0 h-[58vh] pointer-events-none ${
          WAVE_THEME_CLASS[theme] || WAVE_THEME_CLASS.night
        }`}
      />
    </div>
  )
}
