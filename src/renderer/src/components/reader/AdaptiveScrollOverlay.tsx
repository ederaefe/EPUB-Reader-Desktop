import React, { useEffect, useState } from 'react'
import {
  Play,
  Pause,
  Timer,
  Zap,
  RotateCcw,
  Power,
  X,
  Clock,
  Gauge
} from 'lucide-react'
import { adaptiveScrollEngine, type PacingMetrics } from '../../services/adaptiveScrollService'
import { useAppStore } from '../../stores/useAppStore'
import type { AutoscrollMode } from '../../db'
import { SecondsNumberInput } from '../ui/SecondsNumberInput'

interface AdaptiveScrollOverlayProps {
  isActive: boolean
  onClose: () => void
}

const TIMER_PRESETS = [15, 25, 35, 50]

export const AdaptiveScrollOverlay: React.FC<AdaptiveScrollOverlayProps> = ({
  isActive,
  onClose
}) => {
  const { activeBook, settings, updateSettings, isImmersiveFullscreen } = useAppStore()
  const [metrics, setMetrics] = useState<PacingMetrics>(adaptiveScrollEngine.getMetrics())
  const [isModalOpen, setIsModalOpen] = useState(false)

  const isPdf = activeBook?.format === 'pdf'
  const isPdfDual = (settings.pageLayout ?? (settings.pageSpread === 'single' ? 'single' : 'dual')) === 'dual'
  const pdfDefaultDwell = isPdfDual ? 45 : 25

  useEffect(() => {
    return adaptiveScrollEngine.subscribe((m) => setMetrics(m))
  }, [])

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

  const effectiveMode: AutoscrollMode =
    settings.autoscrollMode ?? (settings.autoscrollAdaptive === false ? 'countdown' : 'adaptive')
  const countdownSec = settings.autoscrollCountdownSec ?? 20
  const adaptiveSec = settings.autoscrollAdaptiveSec ?? 25
  const microPauseEnabled = settings.autoscrollMicroPause ?? true

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
    const clamped = Math.max(3, Math.min(600, Math.round(nextSec)))
    adaptiveScrollEngine.recordUserActivity()
    updateSettings({ autoscrollAdaptiveSec: clamped })
    adaptiveScrollEngine.configure({ adaptiveBaseSec: clamped })
  }

  const handleToggleMicroPause = () => {
    const next = !microPauseEnabled
    adaptiveScrollEngine.recordUserActivity()
    updateSettings({ autoscrollMicroPause: next })
    adaptiveScrollEngine.configure({ microPauseEnabled: next })
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
      ? `Auto-Scroll paused while away (${metrics.remainingSec}s left) — Click to configure`
      : metrics.isUserPaused
      ? `Auto-Scroll paused (${metrics.remainingSec}s left) — Click to configure`
      : effectiveMode === 'adaptive'
      ? `Smart Auto-Scroll: ${metrics.remainingSec}s left — Click to configure`
      : `Fixed Auto-Scroll: ${metrics.remainingSec}s left — Click to configure`

  return (
    <>
      {/* Click-outside dismissal backdrop when popover is open */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-40 bg-transparent"
          onClick={() => setIsModalOpen(false)}
        />
      )}

      {/* Theme-Adaptive Compact Auto-Scroll Settings Popover */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-label="Auto-Scroll Settings"
          className={`fixed ${
            isImmersiveFullscreen ? 'bottom-14' : 'bottom-20'
          } right-5 z-50 w-[270px] bg-[rgba(18,20,24,0.92)] dark:bg-[rgba(14,16,20,0.94)] backdrop-blur-2xl border border-white/[0.10] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05),0_16px_48px_rgba(0,0,0,0.6)] rounded-xl p-3.5 space-y-2.5 select-none animate-in fade-in slide-in-from-bottom-2 duration-120 text-[var(--app-text-strong)]`}
        >
          {/* Row 1: Playback & Lifecycle Controls */}
          <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleTogglePause}
                aria-label={metrics.isUserPaused ? 'Resume Auto-Scroll' : 'Pause Auto-Scroll'}
                className={`h-7 px-2.5 flex items-center justify-center gap-1.5 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                  metrics.isUserPaused
                    ? 'bg-[var(--app-btn-primary-bg)] text-[var(--app-btn-primary-fg)] hover:opacity-90'
                    : 'bg-white/[0.06] text-neutral-200 hover:bg-white/[0.10] border border-white/[0.08]'
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
                aria-label="Reset Auto-Scroll parameters"
                title={
                  effectiveMode === 'countdown'
                    ? 'Reset fixed timer to 20s'
                    : 'Reset smart base timer to 25s (250 WPM)'
                }
                className="w-7 h-7 flex items-center justify-center rounded-md text-neutral-400 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={handleTurnOff}
                aria-label="Turn off Auto-Scroll"
                title="Turn off Auto-Scroll completely"
                className="w-7 h-7 flex items-center justify-center rounded-md text-neutral-400 hover:text-red-400 hover:bg-red-500/15 transition-colors cursor-pointer"
              >
                <Power className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                aria-label="Close Auto-Scroll modal"
                title="Close panel and resume reading"
                className="w-7 h-7 flex items-center justify-center rounded-md text-neutral-400 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Row 2: Live Cadence Stat (Smart Mode) */}
          {effectiveMode === 'adaptive' && (
            <div className="flex items-center justify-between px-2 py-1.5 rounded-md bg-white/[0.04] border border-white/[0.06] text-[11px]">
              <div className="flex items-center gap-1.5 text-neutral-400">
                <Gauge className="w-3.5 h-3.5 text-[var(--app-accent)]" />
                <span>Reading Pace</span>
              </div>
              <div className="flex items-center gap-1.5">
                {metrics.isSkimming && (
                  <span className="text-[9px] px-1 py-0.5 rounded bg-amber-500/15 text-amber-400 font-medium">
                    Skim Guard
                  </span>
                )}
                <span className="font-mono font-semibold text-neutral-200">
                  {metrics.currentWpm} WPM
                </span>
              </div>
            </div>
          )}

          {/* Row 3: Segmented Mode Selector (Fixed vs Smart) - EPUB only */}
          {!isPdf && (
            <div className="grid grid-cols-2 p-0.5 bg-white/[0.04] rounded-md border border-white/[0.08]">
              <button
                type="button"
                onClick={() => handleModeChange('countdown')}
                className={`h-7 rounded-sm flex items-center justify-center gap-1.5 text-[11px] font-medium transition-all cursor-pointer ${
                  effectiveMode === 'countdown'
                    ? 'bg-[var(--app-btn-primary-bg)] text-[var(--app-btn-primary-fg)] shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <Timer className="w-3 h-3" />
                <span>Fixed</span>
              </button>

              <button
                type="button"
                onClick={() => handleModeChange('adaptive')}
                className={`h-7 rounded-sm flex items-center justify-center gap-1.5 text-[11px] font-medium transition-all cursor-pointer ${
                  effectiveMode === 'adaptive'
                    ? 'bg-[var(--app-btn-primary-bg)] text-[var(--app-btn-primary-fg)] shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <Zap className="w-3 h-3" />
                <span>Smart</span>
              </button>
            </div>
          )}

          {/* Row 4: Mode-Specific Manual Seconds Controls with Presets */}
          {isPdf || effectiveMode === 'countdown' ? (
            <div className="space-y-2 pt-0.5">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-[11px] font-bold text-neutral-200 block">Seconds</span>
                  <span className="font-mono text-neutral-400 text-[9.5px] font-normal">3-600s</span>
                </div>
                <SecondsNumberInput
                  value={countdownSec}
                  min={3}
                  max={600}
                  step={5}
                  compact
                  onChange={handleCountdownChange}
                  ariaLabel="Fixed seconds per page"
                />
              </div>

              {/* Quick Presets (15s, 25s, 35s, 50s) */}
              <div className="grid grid-cols-4 gap-1.5 pt-0.5">
                {TIMER_PRESETS.map((sec) => {
                  const active = countdownSec === sec
                  return (
                    <button
                      key={sec}
                      type="button"
                      data-active={active ? 'true' : 'false'}
                      onClick={() => handleCountdownChange(sec)}
                      className={`h-6 rounded text-[11px] font-mono font-medium transition-colors cursor-pointer ${
                        active
                          ? 'bg-[var(--app-accent)] text-white shadow-xs font-semibold'
                          : 'bg-white/[0.06] text-neutral-300 hover:bg-white/[0.12] hover:text-white'
                      }`}
                    >
                      {sec}s
                    </button>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-2 pt-0.5">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-[11px] font-bold text-neutral-200 block">Base sec</span>
                  <span className="font-mono text-neutral-400 text-[9.5px] font-normal">Scales by words</span>
                </div>
                <SecondsNumberInput
                  value={adaptiveSec}
                  min={3}
                  max={600}
                  step={5}
                  compact
                  onChange={handleAdaptiveSecChange}
                  ariaLabel="Smart base seconds per page"
                />
              </div>

              {/* Quick Presets (15s, 25s, 35s, 50s) */}
              <div className="grid grid-cols-4 gap-1.5 pt-0.5">
                {TIMER_PRESETS.map((sec) => {
                  const active = adaptiveSec === sec
                  return (
                    <button
                      key={sec}
                      type="button"
                      data-active={active ? 'true' : 'false'}
                      onClick={() => handleAdaptiveSecChange(sec)}
                      className={`h-6 rounded text-[11px] font-mono font-medium transition-colors cursor-pointer ${
                        active
                          ? 'bg-[var(--app-accent)] text-white shadow-xs font-semibold'
                          : 'bg-white/[0.06] text-neutral-300 hover:bg-white/[0.12] hover:text-white'
                      }`}
                    >
                      {sec}s
                    </button>
                  )
                })}
              </div>

              <div className="flex items-center justify-between pt-1.5 border-t border-white/[0.08] px-0.5">
                <span className="text-[11px] font-bold text-neutral-200">Pause at breaks</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={microPauseEnabled}
                  onClick={handleToggleMicroPause}
                  className={`w-7 h-4 rounded-full transition-colors p-0.5 flex items-center cursor-pointer ${
                    microPauseEnabled ? 'bg-[var(--app-accent)] justify-end' : 'bg-white/[0.12] justify-start'
                  }`}
                >
                  <span className="w-3 h-3 bg-white rounded-full block shadow-sm" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Minimalist Muted Numeric Countdown Trigger — Bottom-Right (persists in Fullscreen) */}
      <button
        type="button"
        onClick={() => setIsModalOpen((prev) => !prev)}
        aria-label={triggerTooltip}
        title={triggerTooltip}
        className={`fixed ${
          isImmersiveFullscreen ? 'bottom-4' : 'bottom-11'
        } right-5 z-40 h-6 min-w-[24px] px-1.5 flex items-center justify-center gap-1 rounded font-mono tabular-nums text-[12px] tracking-tight transition-all duration-150 select-none cursor-pointer outline-none border-0 ${
          isModalOpen
            ? 'text-[var(--app-text-strong)] opacity-100 bg-white/[0.08]'
            : metrics.isUserPaused
            ? 'text-[var(--app-text-muted)] opacity-55 hover:opacity-100 hover:text-[var(--app-text-strong)] hover:bg-white/[0.04]'
            : 'text-[var(--app-text-muted)] opacity-60 hover:opacity-100 hover:text-[var(--app-text-strong)] hover:bg-white/[0.04]'
        }`}
      >
        {metrics.pauseReason === 'inactivity' ? (
          <Clock className="w-3 h-3 text-amber-500" />
        ) : metrics.isUserPaused ? (
          <Pause className="w-2.5 h-2.5 fill-current text-[var(--app-text-muted)]" />
        ) : null}
        <span>{metrics.remainingSec}</span>
      </button>
    </>
  )
}
