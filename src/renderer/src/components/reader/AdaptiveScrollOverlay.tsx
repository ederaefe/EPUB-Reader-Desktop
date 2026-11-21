import React, { useEffect, useRef, useState } from 'react'
import {
  Play,
  Pause,
  Clock,
  Minus,
  Plus,
  Check
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

  const [metrics, setMetrics] = useState<PacingMetrics>(() => adaptiveScrollEngine.getMetrics())
  const [isModalOpen, setIsModalOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

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
  const minFloor = effectiveMode === 'countdown' ? 2 : 10

  const [inputValue, setInputValue] = useState<string>(() => String(currentDwellSec))
  const [isEditing, setIsEditing] = useState(false)

  useEffect(() => {
    return adaptiveScrollEngine.subscribe((m) => setMetrics(m))
  }, [])

  useEffect(() => {
    if (!isModalOpen) {
      setInputValue(String(currentDwellSec))
      setIsEditing(false)
    }
  }, [currentDwellSec, isModalOpen])

  // Focus and select input so the blinking cursor is immediately visible when the popover opens
  useEffect(() => {
    if (isModalOpen) {
      const timer = setTimeout(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [isModalOpen])

  // Suspend countdown cleanly while the Auto-Scroll modal is open
  useEffect(() => {
    adaptiveScrollEngine.setSuspension('modal', isModalOpen)
    return () => {
      adaptiveScrollEngine.setSuspension('modal', false)
    }
  }, [isModalOpen])

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

  const handleModeChange = (mode: AutoscrollMode) => {
    adaptiveScrollEngine.recordUserActivity()
    if (!isActive) {
      useAppStore.getState().setAutoscrollActive(true)
    }
    updateSettings({ autoscrollMode: mode, autoscrollAdaptive: mode === 'adaptive' })
    adaptiveScrollEngine.configure({ mode, rearm: true })
  }

  const handleCountdownChange = (nextSec: number) => {
    const clamped = Math.max(2, Math.min(600, Math.round(nextSec)))
    adaptiveScrollEngine.recordUserActivity()
    if (!isActive) {
      useAppStore.getState().setAutoscrollActive(true)
    }
    if (isPdf) {
      if (isPdfDual) {
        updateSettings({ pdfCountdownSecDual: clamped, autoscrollCountdownSec: clamped })
      } else {
        updateSettings({ pdfCountdownSecSingle: clamped, autoscrollCountdownSec: clamped })
      }
    } else {
      updateSettings({ autoscrollCountdownSec: clamped })
    }
    adaptiveScrollEngine.configure({ fixedCountdownSec: clamped, mode: 'countdown', rearm: true })
  }

  const handleAdaptiveSecChange = (nextSec: number) => {
    const clamped = Math.max(10, Math.min(600, Math.round(nextSec)))
    adaptiveScrollEngine.recordUserActivity()
    if (!isActive) {
      useAppStore.getState().setAutoscrollActive(true)
    }
    updateSettings({ autoscrollAdaptiveSec: clamped })
    adaptiveScrollEngine.configure({ adaptiveBaseSec: clamped, mode: 'adaptive', rearm: true })
  }

  const handleDwellNudge = (deltaSec: number) => {
    if (deltaSec < 0 && currentDwellSec <= minFloor) return
    const next = Math.max(minFloor, Math.min(600, currentDwellSec + deltaSec))
    setInputValue(String(next))
    setIsEditing(true)
    if (effectiveMode === 'countdown') {
      handleCountdownChange(next)
    } else {
      handleAdaptiveSecChange(next)
    }
  }

  const handleDirectInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, '')
    setInputValue(raw)
    setIsEditing(true)
  }

  const handleInputCommit = () => {
    const parsed = parseInt(inputValue, 10)
    if (isNaN(parsed) || parsed < minFloor) {
      const fallback = Math.max(minFloor, currentDwellSec)
      setInputValue(String(fallback))
      if (effectiveMode === 'countdown') {
        handleCountdownChange(fallback)
      } else {
        handleAdaptiveSecChange(fallback)
      }
      return
    }
    const clamped = Math.max(minFloor, Math.min(600, parsed))
    setInputValue(String(clamped))
    if (!isActive) {
      useAppStore.getState().setAutoscrollActive(true)
    }
    if (effectiveMode === 'countdown') {
      handleCountdownChange(clamped)
    } else {
      handleAdaptiveSecChange(clamped)
    }
  }

  const handleLockIn = () => {
    handleInputCommit()
    setIsEditing(false)
    setIsModalOpen(false)
  }

  const showConfirmTick = isEditing || inputValue !== String(currentDwellSec)

  const triggerTooltip = !isActive
    ? `Auto-Flip (${currentDwellSec}s) · Click to open controls (A)`
    : metrics.pauseReason === 'inactivity'
    ? `Auto-Flip paused while away (${metrics.remainingSec}s left) — Click to configure`
    : metrics.isUserPaused
    ? `Auto-Flip paused (${metrics.remainingSec}s left) — Click to configure`
    : effectiveMode === 'adaptive'
    ? `Smart Auto-Flip: ${metrics.remainingSec}s left — Click to configure`
    : `Fixed Auto-Flip: ${metrics.remainingSec}s left — Click to configure`

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
      ? 'w-9 h-9 rounded-full bg-black/[0.06] hover:bg-black/[0.12] active:scale-95 border border-black/[0.12] shadow-xs flex items-center justify-center text-[#0d1117] transition-all cursor-pointer disabled:opacity-25 disabled:pointer-events-none disabled:cursor-not-allowed'
      : currentTheme === 'light-sepia'
      ? 'w-9 h-9 rounded-full bg-[#5f4b32]/[0.10] hover:bg-[#5f4b32]/[0.18] active:scale-95 border border-[#5f4b32]/[0.20] shadow-xs flex items-center justify-center text-[#17110a] transition-all cursor-pointer disabled:opacity-25 disabled:pointer-events-none disabled:cursor-not-allowed'
      : currentTheme === 'dark-sepia'
      ? 'w-9 h-9 rounded-full bg-white/[0.12] hover:bg-white/[0.22] active:scale-95 border border-[#e6c8a5]/[0.18] shadow-xs flex items-center justify-center text-[#fffbf5] transition-all cursor-pointer disabled:opacity-25 disabled:pointer-events-none disabled:cursor-not-allowed'
      : 'w-9 h-9 rounded-full bg-white/[0.14] hover:bg-white/[0.24] active:scale-95 border border-white/[0.18] shadow-xs flex items-center justify-center text-white transition-all cursor-pointer disabled:opacity-25 disabled:pointer-events-none disabled:cursor-not-allowed'

  const centerPillClass =
    currentTheme === 'day'
      ? 'relative flex-1 h-9 px-3 rounded-full bg-black/[0.03] border border-black/[0.10] flex items-center justify-center focus-within:border-[var(--app-accent)] focus-within:bg-white focus-within:ring-1 focus-within:ring-[var(--app-accent)]/30 transition-all shadow-inner'
      : currentTheme === 'light-sepia'
      ? 'relative flex-1 h-9 px-3 rounded-full bg-[#5f4b32]/[0.05] border border-[#5f4b32]/[0.16] flex items-center justify-center focus-within:border-[var(--app-accent)] focus-within:bg-[#fbf4e4] focus-within:ring-1 focus-within:ring-[var(--app-accent)]/30 transition-all shadow-inner'
      : currentTheme === 'dark-sepia'
      ? 'relative flex-1 h-9 px-3 rounded-full bg-white/[0.05] border border-[#e6c8a5]/[0.12] flex items-center justify-center focus-within:border-[var(--app-accent)] focus-within:bg-white/[0.10] focus-within:ring-1 focus-within:ring-[var(--app-accent)]/30 transition-all shadow-inner'
      : 'relative flex-1 h-9 px-3 rounded-full bg-white/[0.06] border border-white/[0.10] flex items-center justify-center focus-within:border-[var(--app-accent)] focus-within:bg-white/[0.10] focus-within:ring-1 focus-within:ring-[var(--app-accent)]/30 transition-all shadow-inner'

  const confirmTickClass =
    currentTheme === 'day'
      ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_2px_8px_rgba(5,150,105,0.35)] border border-white/80'
      : currentTheme === 'light-sepia'
      ? 'bg-[#2d6a4f] hover:bg-[#1b4332] text-[#f7efe0] shadow-[0_2px_8px_rgba(45,106,79,0.35)] border border-[#f7efe0]/80'
      : currentTheme === 'dark-sepia'
      ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_2px_10px_rgba(5,150,105,0.45)] border border-[#1b1611]/80'
      : 'bg-emerald-500 hover:bg-emerald-400 text-[#0d1117] shadow-[0_2px_10px_rgba(16,185,129,0.45)] border border-[#12151b]/80'

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
          } right-5 z-50 w-[268px] font-sans select-none antialiased backdrop-blur-2xl rounded-2xl p-3.5 flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-2 duration-150 app-no-drag border ${containerThemeClasses}`}
        >
          {/* Zone 1: Independent Dual Speedometer Card (WPM + SPP) */}
          <div className={`grid grid-cols-2 py-2 px-3 rounded-xl text-center shadow-xs border ${speedometerBoxClass}`}>
            {/* Left: Reading Pace */}
            <div className={`flex flex-col items-center justify-center border-r pr-2 ${speedometerDividerClass}`}>
              <div className="flex items-baseline gap-1">
                <span className={`text-[18px] font-bold tracking-tight tabular-nums font-mono ${wpmColorClass}`}>
                  {metrics.readingPaceWpm || metrics.currentWpm || 250}
                </span>
                <span
                  className="font-sans text-[11px] font-medium text-[var(--app-text-muted)] opacity-70 cursor-help select-none"
                  title="Words Per Minute"
                >
                  WPM
                </span>
              </div>
            </div>

            {/* Right: Reading Speed */}
            <div className="flex flex-col items-center justify-center pl-2">
              <div className="flex items-baseline gap-1">
                <span className={`text-[18px] font-bold tracking-tight tabular-nums font-mono ${sppColorClass}`}>
                  {Math.max(minFloor, metrics.readingSpeedSpp || 10)}
                </span>
                <span
                  className="font-sans text-[11px] font-medium text-[var(--app-text-muted)] opacity-70 cursor-help select-none"
                  title="Seconds Per Page"
                >
                  SPP
                </span>
              </div>
            </div>
          </div>

          {/* Zone 2: Tactile Glass Segmented Mode Pill */}
          <div className="glass-pill-track grid grid-cols-2 p-1 gap-1">
            <button
              type="button"
              data-active={effectiveMode === 'countdown' ? 'true' : 'false'}
              onClick={() => handleModeChange('countdown')}
              className="glass-pill-btn flex-1 py-1 font-sans text-[12px] font-medium"
            >
              Fixed
            </button>
            <button
              type="button"
              data-active={effectiveMode === 'adaptive' ? 'true' : 'false'}
              onClick={() => handleModeChange('adaptive')}
              className="glass-pill-btn flex-1 py-1 font-sans text-[12px] font-medium"
            >
              Smart
            </button>
          </div>

          {/* Zone 3: Minimalist Stepper with Circular Buttons & Editable Center Pill */}
          <div className="flex items-center justify-between gap-3 pt-0.5">
            <button
              type="button"
              disabled={currentDwellSec <= minFloor}
              onClick={() => handleDwellNudge(-2)}
              className={stepperBtnClass}
              title={
                currentDwellSec <= minFloor
                  ? `Minimum dwell floor is ${minFloor}s`
                  : 'Decrease dwell by 2 seconds'
              }
              aria-label="Decrease dwell by 2 seconds"
            >
              <Minus className="w-4 h-4 stroke-[2.5]" />
            </button>

            {/* Editable Pill with Blinking Cursor in a distinct inner box */}
            <div
              onClick={() => inputRef.current?.focus()}
              className={`${centerPillClass} cursor-text`}
            >
              <div className="flex items-center justify-center gap-1.5 font-mono">
                {/* Distinct inner box with blinking cursor */}
                <div
                  className={`h-6 px-1.5 min-w-[36px] rounded border flex items-center justify-center transition-all ${
                    isLight
                      ? currentTheme === 'light-sepia'
                        ? 'bg-[#5f4b32]/[0.08] border-[#5f4b32]/[0.26] focus-within:border-[var(--app-accent)] focus-within:bg-[#fbf4e4] focus-within:ring-1 focus-within:ring-[var(--app-accent)]/30'
                        : 'bg-black/[0.05] border-black/[0.18] focus-within:border-[var(--app-accent)] focus-within:bg-white focus-within:ring-1 focus-within:ring-[var(--app-accent)]/30'
                      : currentTheme === 'dark-sepia'
                      ? 'bg-white/[0.08] border-[#e6c8a5]/[0.24] focus-within:border-[var(--app-accent)] focus-within:bg-[#1b1611] focus-within:ring-1 focus-within:ring-[var(--app-accent)]/30'
                      : 'bg-white/[0.08] border-white/[0.22] focus-within:border-[var(--app-accent)] focus-within:bg-black/40 focus-within:ring-1 focus-within:ring-[var(--app-accent)]/30'
                  }`}
                >
                  <input
                    ref={inputRef}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={inputValue}
                    onChange={handleDirectInputChange}
                    onFocus={(e) => {
                      setIsEditing(true)
                      e.target.select()
                    }}
                    onBlur={() => {
                      setTimeout(() => setIsEditing(false), 200)
                      handleInputCommit()
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleLockIn()
                      } else if (e.key === 'Escape') {
                        e.stopPropagation()
                        setInputValue(String(currentDwellSec))
                        setIsEditing(false)
                        ;(e.target as HTMLElement).blur()
                      }
                    }}
                    style={{ width: `${Math.max(2, inputValue.length)}ch` }}
                    className="text-center text-[14px] font-bold text-[var(--app-text-strong)] font-mono bg-transparent outline-none caret-[var(--app-accent)] tabular-nums"
                    aria-label="Dwell seconds"
                  />
                </div>
                <span className="text-[12px] text-[var(--app-text-muted)] font-mono font-medium select-none">
                  sec
                </span>
              </div>

              {/* Hovering Circular Confirmation Tick (Lock in value and close HUD) */}
              {showConfirmTick && (
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    handleLockIn()
                  }}
                  title="Lock in dwell and start (Enter)"
                  aria-label="Lock in dwell and start"
                  className={`absolute -top-3 -right-1.5 z-20 w-6 h-6 rounded-full flex items-center justify-center shadow-md cursor-pointer transition-all hover:scale-110 active:scale-95 animate-in zoom-in-75 fade-in duration-150 ${confirmTickClass}`}
                >
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </button>
              )}
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
        onClick={() => {
          if (!isActive) {
            useAppStore.getState().setAutoscrollActive(true)
          }
          setIsModalOpen((prev) => !prev)
        }}
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
        ) : !isActive ? (
          <Play className="w-2.5 h-2.5 fill-current text-[var(--app-text-muted)]" />
        ) : null}
        <span>{isActive ? metrics.remainingSec : currentDwellSec}s</span>
      </button>
    </>
  )
}
