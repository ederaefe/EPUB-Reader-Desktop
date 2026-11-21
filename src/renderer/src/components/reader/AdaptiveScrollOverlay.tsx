import React, { useEffect, useState } from 'react'
import {
  Play,
  Pause,
  RotateCcw,
  Power,
  X,
  Clock,
  Minus,
  Plus
} from 'lucide-react'
import { adaptiveScrollEngine, type PacingMetrics } from '../../services/adaptiveScrollService'
import { useAppStore } from '../../stores/useAppStore'
import { useShallow } from 'zustand/react/shallow'
import type { AutoscrollMode } from '../../db'

interface AdaptiveScrollOverlayProps {
  isActive: boolean
  onClose: () => void
}

export const AdaptiveScrollOverlay: React.FC<AdaptiveScrollOverlayProps> = ({
  isActive,
  onClose
}) => {
  const activeBookFormat = useAppStore((s) => s.activeBook?.format)
  const isImmersiveFullscreen = useAppStore((s) => s.isImmersiveFullscreen)
  const updateSettings = useAppStore((s) => s.updateSettings)

  const {
    theme,
    pageLayout,
    pageSpread,
    autoscrollMode,
    autoscrollAdaptive,
    autoscrollCountdownSec,
    autoscrollAdaptiveSec,
    pdfCountdownSecDual,
    pdfCountdownSecSingle
  } = useAppStore(
    useShallow((s) => ({
      theme: s.settings.theme,
      pageLayout: s.settings.pageLayout,
      pageSpread: s.settings.pageSpread,
      autoscrollMode: s.settings.autoscrollMode,
      autoscrollAdaptive: s.settings.autoscrollAdaptive,
      autoscrollCountdownSec: s.settings.autoscrollCountdownSec,
      autoscrollAdaptiveSec: s.settings.autoscrollAdaptiveSec,
      pdfCountdownSecDual: s.settings.pdfCountdownSecDual,
      pdfCountdownSecSingle: s.settings.pdfCountdownSecSingle
    }))
  )

  const [metrics, setMetrics] = useState<PacingMetrics>(adaptiveScrollEngine.getMetrics())
  const [isModalOpen, setIsModalOpen] = useState(false)

  const isPdf = activeBookFormat === 'pdf'
  const isPdfDual = (pageLayout ?? (pageSpread === 'single' ? 'single' : 'dual')) === 'dual'
  const pdfDefaultDwell = isPdfDual ? 45 : 25
  const pdfDwellSec = isPdfDual
    ? (pdfCountdownSecDual ?? 45)
    : (pdfCountdownSecSingle ?? 25)

  const effectiveMode: AutoscrollMode =
    autoscrollMode ?? (autoscrollAdaptive === false ? 'countdown' : 'adaptive')
  const countdownSec = isPdf ? pdfDwellSec : (autoscrollCountdownSec ?? 20)
  const adaptiveSec = autoscrollAdaptiveSec ?? 25
  const currentDwellSec = effectiveMode === 'countdown' ? countdownSec : adaptiveSec
  const minFloor = effectiveMode === 'countdown' ? 3 : 10

  const [inputValue, setInputValue] = useState<string>(String(currentDwellSec))

  useEffect(() => {
    return adaptiveScrollEngine.subscribe((m) => setMetrics(m))
  }, [])

  useEffect(() => {
    setInputValue(String(currentDwellSec))
  }, [currentDwellSec])

  // Suspend countdown cleanly while the Auto-Scroll modal is open
  useEffect(() => {
    adaptiveScrollEngine.setSuspension('modal', isModalOpen)
    return () => {
      adaptiveScrollEngine.setSuspension('modal', false)
    }
  }, [isModalOpen])

  // Close modal if Auto-Scroll is turned off externally
  useEffect(() => {
    if (!isActive && isModalOpen) {
      setIsModalOpen(false)
    }
  }, [isActive, isModalOpen])

  // Allow Escape to dismiss just this modal without stopping Auto-Scroll
  useEffect(() => {
    if (!isModalOpen) return
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setIsModalOpen(false)
      }
    }
    window.addEventListener('keydown', handleEsc, true)
    return () => window.removeEventListener('keydown', handleEsc, true)
  }, [isModalOpen])

  if (!isActive) return null

  const handleModeChange = (mode: AutoscrollMode) => {
    adaptiveScrollEngine.recordUserActivity()
    updateSettings({ autoscrollMode: mode, autoscrollAdaptive: mode === 'adaptive' })
    adaptiveScrollEngine.configure({ mode })
  }

  const handleCountdownChange = (nextSec: number) => {
    const clamped = Math.max(3, Math.min(600, Math.round(nextSec)))
    adaptiveScrollEngine.recordUserActivity()
    if (isPdf) {
      if (isPdfDual) {
        updateSettings({ pdfCountdownSecDual: clamped, autoscrollCountdownSec: clamped })
      } else {
        updateSettings({ pdfCountdownSecSingle: clamped, autoscrollCountdownSec: clamped })
      }
    } else {
      updateSettings({ autoscrollCountdownSec: clamped })
    }
    adaptiveScrollEngine.configure({ fixedCountdownSec: clamped, mode: 'countdown' })
  }

  const handleAdaptiveSecChange = (nextSec: number) => {
    const clamped = Math.max(10, Math.min(600, Math.round(nextSec)))
    adaptiveScrollEngine.recordUserActivity()
    updateSettings({ autoscrollAdaptiveSec: clamped })
    adaptiveScrollEngine.configure({ adaptiveBaseSec: clamped })
  }

  const handleDwellNudge = (deltaSec: number) => {
    const next = Math.max(minFloor, Math.min(600, currentDwellSec + deltaSec))
    if (effectiveMode === 'countdown') {
      handleCountdownChange(next)
    } else {
      handleAdaptiveSecChange(next)
    }
  }

  const handleDirectInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value)
  }

  const handleInputCommit = () => {
    const parsed = parseInt(inputValue, 10)
    if (isNaN(parsed)) {
      setInputValue(String(currentDwellSec))
      return
    }
    const clamped = Math.max(minFloor, Math.min(600, parsed))
    setInputValue(String(clamped))
    if (effectiveMode === 'countdown') {
      handleCountdownChange(clamped)
    } else {
      handleAdaptiveSecChange(clamped)
    }
  }

  const handleReset = () => {
    adaptiveScrollEngine.recordUserActivity()
    if (isPdf) {
      handleCountdownChange(pdfDefaultDwell)
      return
    }
    adaptiveScrollEngine.reset()
    if (effectiveMode === 'countdown') {
      updateSettings({ autoscrollCountdownSec: 20 })
    } else {
      updateSettings({ autoscrollAdaptiveSec: 25, targetWpm: 250 })
    }
  }

  const handleTogglePause = () => {
    adaptiveScrollEngine.setUserPaused(!metrics.isUserPaused)
  }

  const handleTurnOff = () => {
    setIsModalOpen(false)
    adaptiveScrollEngine.stop()
    onClose()
  }

  const triggerTooltip =
    metrics.pauseReason === 'inactivity'
      ? `Auto-Flip paused while away ({${metrics.remainingSec}s} left) — Click to configure`
      : metrics.isUserPaused
      ? `Auto-Flip paused ({${metrics.remainingSec}s} left) — Click to configure`
      : effectiveMode === 'adaptive'
      ? `Smart Auto-Flip: {${metrics.remainingSec}s} left — Click to configure`
      : `Fixed Auto-Flip: {${metrics.remainingSec}s} left — Click to configure`

  const currentTheme = theme || 'night'
  const isLight = currentTheme === 'day' || currentTheme === 'light-sepia'

  const containerThemeClasses =
    currentTheme === 'day'
      ? 'bg-white/95 border-black/[0.12] text-[#0d1117] shadow-[0_16px_48px_rgba(0,0,0,0.14),inset_0_1px_0_rgba(255,255,255,0.95)]'
      : currentTheme === 'light-sepia'
      ? 'bg-[#f7efe0]/96 border-[#5f4b32]/[0.22] text-[#17110a] shadow-[0_16px_48px_rgba(60,44,24,0.18),inset_0_1px_0_rgba(255,255,255,0.85)]'
      : currentTheme === 'dark-sepia'
      ? 'bg-[#1b1611]/96 border-[#e6c8a5]/[0.15] text-[#fffbf5] shadow-[0_16px_48px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(230,200,165,0.08)]'
      : 'bg-[#12151b]/96 border-white/[0.12] text-[#f1f3f7] shadow-[0_16px_48px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.08)]'

  const headerBorderClass = isLight
    ? currentTheme === 'light-sepia'
      ? 'border-[#5f4b32]/[0.14]'
      : 'border-black/[0.08]'
    : 'border-white/[0.08]'

  const speedometerBoxClass =
    currentTheme === 'day'
      ? 'bg-black/[0.03] border-black/[0.08]'
      : currentTheme === 'light-sepia'
      ? 'bg-[#5f4b32]/[0.06] border-[#5f4b32]/[0.14]'
      : currentTheme === 'dark-sepia'
      ? 'bg-white/[0.04] border-[#e6c8a5]/[0.10]'
      : 'bg-white/[0.04] border-white/[0.08]'

  const speedometerDividerClass =
    currentTheme === 'day'
      ? 'border-black/[0.08]'
      : currentTheme === 'light-sepia'
      ? 'border-[#5f4b32]/[0.14]'
      : currentTheme === 'dark-sepia'
      ? 'border-[#e6c8a5]/[0.10]'
      : 'border-white/[0.08]'

  const wpmColorClass =
    currentTheme === 'day'
      ? 'text-[#0284c7]'
      : currentTheme === 'light-sepia'
      ? 'text-[#087ea4]'
      : currentTheme === 'dark-sepia'
      ? 'text-[#38bdf8]'
      : 'text-cyan-400'

  const sppColorClass =
    currentTheme === 'day'
      ? 'text-[#059669]'
      : currentTheme === 'light-sepia'
      ? 'text-[#15803d]'
      : currentTheme === 'dark-sepia'
      ? 'text-[#34d399]'
      : 'text-emerald-400'

  const stepperBtnClass =
    currentTheme === 'day'
      ? 'w-9 h-9 rounded-full bg-black/[0.06] hover:bg-black/[0.12] active:scale-95 border border-black/[0.12] shadow-xs flex items-center justify-center text-[#0d1117] transition-all cursor-pointer'
      : currentTheme === 'light-sepia'
      ? 'w-9 h-9 rounded-full bg-[#5f4b32]/[0.10] hover:bg-[#5f4b32]/[0.18] active:scale-95 border border-[#5f4b32]/[0.20] shadow-xs flex items-center justify-center text-[#17110a] transition-all cursor-pointer'
      : currentTheme === 'dark-sepia'
      ? 'w-9 h-9 rounded-full bg-white/[0.12] hover:bg-white/[0.22] active:scale-95 border border-[#e6c8a5]/[0.18] shadow-xs flex items-center justify-center text-[#fffbf5] transition-all cursor-pointer'
      : 'w-9 h-9 rounded-full bg-white/[0.14] hover:bg-white/[0.24] active:scale-95 border border-white/[0.18] shadow-xs flex items-center justify-center text-white transition-all cursor-pointer'

  const centerPillClass =
    currentTheme === 'day'
      ? 'flex-1 h-9 px-3 rounded-full bg-black/[0.03] border border-black/[0.10] flex items-center justify-center focus-within:border-[var(--app-accent)] focus-within:bg-white focus-within:ring-1 focus-within:ring-[var(--app-accent)]/30 transition-all shadow-inner'
      : currentTheme === 'light-sepia'
      ? 'flex-1 h-9 px-3 rounded-full bg-[#5f4b32]/[0.05] border border-[#5f4b32]/[0.16] flex items-center justify-center focus-within:border-[var(--app-accent)] focus-within:bg-[#fbf4e4] focus-within:ring-1 focus-within:ring-[var(--app-accent)]/30 transition-all shadow-inner'
      : currentTheme === 'dark-sepia'
      ? 'flex-1 h-9 px-3 rounded-full bg-white/[0.05] border border-[#e6c8a5]/[0.12] flex items-center justify-center focus-within:border-[var(--app-accent)] focus-within:bg-white/[0.10] focus-within:ring-1 focus-within:ring-[var(--app-accent)]/30 transition-all shadow-inner'
      : 'flex-1 h-9 px-3 rounded-full bg-white/[0.06] border border-white/[0.10] flex items-center justify-center focus-within:border-[var(--app-accent)] focus-within:bg-white/[0.10] focus-within:ring-1 focus-within:ring-[var(--app-accent)]/30 transition-all shadow-inner'

  const skimGuardClass =
    currentTheme === 'day'
      ? 'bg-amber-500/15 border border-amber-600/30 text-amber-800'
      : currentTheme === 'light-sepia'
      ? 'bg-amber-700/15 border border-amber-700/30 text-amber-900'
      : 'bg-amber-500/15 border border-amber-500/25 text-amber-300'

  return (
    <>
      {/* Click-outside dismissal backdrop when popover is open */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-40 bg-transparent"
          onClick={() => setIsModalOpen(false)}
        />
      )}

      {/* Ultra-Streamlined Curved-Edge Glass HUD Popover */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-label="Auto-Flip Settings"
          className={`fixed ${
            isImmersiveFullscreen ? 'bottom-14' : 'bottom-20'
          } right-5 z-50 w-[280px] backdrop-blur-2xl rounded-2xl p-4 flex flex-col gap-3.5 select-none animate-in fade-in slide-in-from-bottom-2 duration-150 app-no-drag border ${containerThemeClasses}`}
        >
          {/* Header Row: Minimalist Playback & Lifecycle Actions */}
          <div className={`flex items-center justify-between pb-1 border-b ${headerBorderClass}`}>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleTogglePause}
                aria-label={metrics.isUserPaused ? 'Resume Auto-Flip' : 'Pause Auto-Flip'}
                className={`h-7 px-3 flex items-center justify-center gap-1.5 rounded-full text-[11.5px] font-medium transition-all cursor-pointer ${
                  metrics.isUserPaused
                    ? 'bg-[var(--app-btn-primary-bg)] text-[var(--app-btn-primary-fg)] shadow-xs hover:opacity-90'
                    : isLight
                    ? 'bg-black/[0.06] text-[var(--app-text-strong)] hover:bg-black/[0.10] border border-black/[0.08]'
                    : 'bg-white/[0.08] text-[var(--app-text-strong)] hover:bg-white/[0.14] border border-white/[0.10]'
                }`}
              >
                {metrics.isUserPaused ? (
                  <>
                    <Play className="w-3 h-3 fill-current" />
                    <span>Resume</span>
                  </>
                ) : (
                  <>
                    <Pause className="w-3 h-3 fill-current" />
                    <span>Pause</span>
                  </>
                )}
              </button>

              {metrics.pauseReason === 'inactivity' && (
                <span
                  className="w-6 h-6 flex items-center justify-center text-amber-500"
                  title="Auto-paused after 5 minutes of reader inactivity"
                >
                  <Clock className="w-3.5 h-3.5" />
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleReset}
                aria-label="Reset Auto-Flip parameters"
                title={
                  effectiveMode === 'countdown'
                    ? 'Reset fixed timer to 20s'
                    : 'Reset smart base timer to 25s (250 WPM)'
                }
                className={`w-7 h-7 flex items-center justify-center rounded-full text-[var(--app-text-muted)] hover:text-[var(--app-text-strong)] transition-colors cursor-pointer ${
                  isLight ? 'hover:bg-black/[0.06]' : 'hover:bg-white/[0.08]'
                }`}
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={handleTurnOff}
                aria-label="Turn off Auto-Flip"
                title="Turn off Auto-Flip completely"
                className="w-7 h-7 flex items-center justify-center rounded-full text-[var(--app-text-muted)] hover:text-red-400 hover:bg-red-500/15 transition-colors cursor-pointer"
              >
                <Power className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                aria-label="Close Auto-Flip modal"
                title="Close panel and resume reading"
                className={`w-7 h-7 flex items-center justify-center rounded-full text-[var(--app-text-muted)] hover:text-[var(--app-text-strong)] transition-colors cursor-pointer ${
                  isLight ? 'hover:bg-black/[0.06]' : 'hover:bg-white/[0.08]'
                }`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Zone 1: Independent Dual Speedometer Card (WPM + SPP) */}
          <div className={`grid grid-cols-2 py-2 px-3 rounded-xl text-center shadow-xs border ${speedometerBoxClass}`}>
            {/* Left: Reading Pace */}
            <div className={`flex flex-col items-center justify-center border-r pr-2 ${speedometerDividerClass}`}>
              <div className="flex items-baseline gap-1">
                <span className={`text-[18px] font-bold tracking-tight tabular-nums font-mono ${wpmColorClass}`}>
                  {metrics.readingPaceWpm || metrics.currentWpm || 250}
                </span>
                <span
                  className="text-[11px] font-medium text-[var(--app-text-muted)] opacity-70 cursor-help select-none"
                  title="Words Per Minute"
                >
                  WPM
                </span>
              </div>
              <span className="text-[10px] uppercase tracking-wider text-[var(--app-text-muted)] opacity-60 font-medium mt-0.5 select-none">
                reading pace
              </span>
            </div>

            {/* Right: Reading Speed */}
            <div className="flex flex-col items-center justify-center pl-2">
              <div className="flex items-baseline gap-1">
                <span className={`text-[18px] font-bold tracking-tight tabular-nums font-mono ${sppColorClass}`}>
                  {metrics.readingSpeedSpp || 24}s
                </span>
                <span
                  className="text-[11px] font-medium text-[var(--app-text-muted)] opacity-70 cursor-help select-none"
                  title="Seconds Per Page"
                >
                  SPP
                </span>
              </div>
              <span className="text-[10px] uppercase tracking-wider text-[var(--app-text-muted)] opacity-60 font-medium mt-0.5 select-none">
                reading speed
              </span>
            </div>
          </div>

          {/* Optional Skim Guard Pill Indicator */}
          {metrics.isSkimming && (
            <div className={`flex items-center justify-center py-0.5 px-2 rounded-full text-[10.5px] font-medium select-none border ${skimGuardClass}`}>
              <span>Skim Guard Active</span>
            </div>
          )}

          {/* Zone 2: Tactile Glass Segmented Mode Pill */}
          <div className="glass-pill-track grid grid-cols-2 p-1 gap-1">
            <button
              type="button"
              data-active={effectiveMode === 'countdown' ? 'true' : 'false'}
              onClick={() => handleModeChange('countdown')}
              className="glass-pill-btn flex-1 py-1 text-[12px] font-medium"
            >
              Fixed
            </button>
            <button
              type="button"
              data-active={effectiveMode === 'adaptive' ? 'true' : 'false'}
              onClick={() => handleModeChange('adaptive')}
              className="glass-pill-btn flex-1 py-1 text-[12px] font-medium"
            >
              Smart
            </button>
          </div>

          {/* Zone 3: Minimalist Stepper with Circular Buttons & Editable Center Pill */}
          <div className="flex items-center justify-between gap-3 pt-0.5">
            <button
              type="button"
              onClick={() => handleDwellNudge(-2)}
              className={stepperBtnClass}
              title="Decrease dwell by 2 seconds"
              aria-label="Decrease dwell by 2 seconds"
            >
              <Minus className="w-4 h-4 stroke-[2.5]" />
            </button>

            {/* Editable Pill with Blinking Cursor */}
            <div className={centerPillClass}>
              <input
                type="number"
                min={minFloor}
                max={600}
                value={inputValue}
                onChange={handleDirectInputChange}
                onBlur={handleInputCommit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    ;(e.target as HTMLElement).blur()
                  } else if (e.key === 'Escape') {
                    setInputValue(String(currentDwellSec))
                    ;(e.target as HTMLElement).blur()
                  }
                }}
                className="w-12 text-center text-[15px] font-semibold text-[var(--app-text-strong)] font-mono bg-transparent outline-none caret-[var(--app-accent)] tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                aria-label="Dwell seconds"
              />
              <span className="text-[12px] text-[var(--app-text-muted)] font-mono select-none">sec</span>
            </div>

            <button
              type="button"
              onClick={() => handleDwellNudge(2)}
              className={stepperBtnClass}
              title="Increase dwell by 2 seconds"
              aria-label="Increase dwell by 2 seconds"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>
        </div>
      )}

      {/* Minimalist Numeric Countdown Trigger Badge — Bottom-Right (persists in Fullscreen) */}
      <button
        type="button"
        onClick={() => setIsModalOpen((prev) => !prev)}
        aria-label={triggerTooltip}
        title={triggerTooltip}
        className={`fixed ${
          isImmersiveFullscreen ? 'bottom-4' : 'bottom-11'
        } right-5 z-40 h-6 min-w-[32px] px-1.5 flex items-center justify-center gap-1 rounded font-mono tabular-nums text-[12px] tracking-tight transition-all duration-150 select-none cursor-pointer outline-none border ${
          isLight
            ? currentTheme === 'light-sepia'
              ? isModalOpen
                ? 'text-[var(--app-text-strong)] bg-[#5f4b32]/[0.12] border-[#5f4b32]/[0.22] shadow-xs'
                : 'text-[var(--app-text-muted)] border-[#5f4b32]/[0.14] hover:bg-[#5f4b32]/[0.08] hover:text-[var(--app-text-strong)]'
              : isModalOpen
              ? 'text-[var(--app-text-strong)] bg-black/[0.08] border-black/[0.14] shadow-xs'
              : 'text-[var(--app-text-muted)] border-black/[0.08] hover:bg-black/[0.05] hover:text-[var(--app-text-strong)]'
            : isModalOpen
            ? 'text-[var(--app-text-strong)] bg-white/[0.12] border-white/[0.16] shadow-xs'
            : 'text-[var(--app-text-muted)] border-white/[0.08] hover:bg-white/[0.06] hover:text-[var(--app-text-strong)]'
        }`}
      >
        {metrics.pauseReason === 'inactivity' ? (
          <Clock className="w-3 h-3 text-amber-500" />
        ) : metrics.isUserPaused ? (
          <Pause className="w-2.5 h-2.5 fill-current text-[var(--app-text-muted)]" />
        ) : null}
        <span>&#123;{metrics.remainingSec}s&#125;</span>
      </button>
    </>
  )
}
