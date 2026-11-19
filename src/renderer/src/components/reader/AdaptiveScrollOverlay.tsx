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
  Settings as SettingsIcon,
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

export const AdaptiveScrollOverlay: React.FC<AdaptiveScrollOverlayProps> = ({
  isActive,
  onClose
}) => {
  const { settings, updateSettings, isImmersiveFullscreen } = useAppStore()
  const [metrics, setMetrics] = useState<PacingMetrics>(adaptiveScrollEngine.getMetrics())
  const [isModalOpen, setIsModalOpen] = useState(false)

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
    updateSettings({ autoscrollCountdownSec: clamped })
    adaptiveScrollEngine.configure({ fixedCountdownSec: clamped })
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

  // Circular progress calculations for the quiet hairline SVG ring
  const circleRadius = 13
  const circumference = 2 * Math.PI * circleRadius
  const strokeDashoffset = circumference * (1 - Math.max(0, Math.min(1, metrics.progress)))

  const triggerTooltip =
    metrics.pauseReason === 'inactivity'
      ? `Auto-Scroll paused while away (${metrics.remainingSec}s left) - Click to resume`
      : metrics.isUserPaused
      ? `Auto-Scroll paused (${metrics.remainingSec}s left) - Click to resume`
      : effectiveMode === 'adaptive'
      ? `Smart Auto-Scroll: ${metrics.remainingSec}s left (${metrics.currentWpm} WPM) - Click to pause`
      : `Fixed Auto-Scroll: ${metrics.remainingSec}s left - Click to pause`

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
          } right-5 z-50 w-64 bg-[var(--app-surface)] text-[var(--app-text-strong)] border border-[var(--app-border)] rounded-lg shadow-2xl p-3 space-y-2.5 select-none animate-in fade-in slide-in-from-bottom-2 duration-120`}
        >
          {/* Row 1: Playback & Lifecycle Controls */}
          <div className="flex items-center justify-between pb-2 border-b border-[var(--app-border)]">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleTogglePause}
                aria-label={metrics.isUserPaused ? 'Resume Auto-Scroll' : 'Pause Auto-Scroll'}
                className={`h-7 px-2.5 flex items-center justify-center gap-1.5 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                  metrics.isUserPaused
                    ? 'bg-[var(--app-btn-primary-bg)] text-[var(--app-btn-primary-fg)] hover:opacity-90'
                    : 'bg-[var(--app-surface-2)] text-[var(--app-text-strong)] hover:bg-[var(--app-surface-hover)] border border-[var(--app-border)]'
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
                className="w-7 h-7 flex items-center justify-center rounded-md text-[var(--app-text-muted)] hover:text-[var(--app-text-strong)] hover:bg-[var(--app-surface-2)] transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={handleTurnOff}
                aria-label="Turn off Auto-Scroll"
                title="Turn off Auto-Scroll completely"
                className="w-7 h-7 flex items-center justify-center rounded-md text-[var(--app-text-muted)] hover:text-red-500 hover:bg-red-500/10 transition-colors"
              >
                <Power className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                aria-label="Close Auto-Scroll modal"
                title="Close panel and resume reading"
                className="w-7 h-7 flex items-center justify-center rounded-md text-[var(--app-text-muted)] hover:text-[var(--app-text-strong)] hover:bg-[var(--app-surface-2)] transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Row 2: Live Cadence Stat (Smart Mode) */}
          {effectiveMode === 'adaptive' && (
            <div className="flex items-center justify-between px-2 py-1.5 rounded-md bg-[var(--app-surface-2)] text-[11px]">
              <div className="flex items-center gap-1.5 text-[var(--app-text-muted)]">
                <Gauge className="w-3.5 h-3.5 text-[var(--app-accent)]" />
                <span>Reading Pace</span>
              </div>
              <div className="flex items-center gap-1.5">
                {metrics.isSkimming && (
                  <span className="text-[9px] px-1 py-0.5 rounded bg-amber-500/15 text-amber-500 font-medium">
                    Skim Guard
                  </span>
                )}
                <span className="font-mono font-semibold text-[var(--app-text-strong)]">
                  {metrics.currentWpm} WPM
                </span>
              </div>
            </div>
          )}

          {/* Row 3: Segmented Mode Selector (Fixed vs Smart) */}
          <div className="grid grid-cols-2 p-0.5 bg-[var(--app-surface-2)] rounded-md border border-[var(--app-border)]">
            <button
              type="button"
              onClick={() => handleModeChange('countdown')}
              className={`h-7 rounded-sm flex items-center justify-center gap-1.5 text-[11px] font-medium transition-all cursor-pointer ${
                effectiveMode === 'countdown'
                  ? 'bg-[var(--app-btn-primary-bg)] text-[var(--app-btn-primary-fg)] shadow-sm'
                  : 'text-[var(--app-text-muted)] hover:text-[var(--app-text-strong)]'
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
                  : 'text-[var(--app-text-muted)] hover:text-[var(--app-text-strong)]'
              }`}
            >
              <Zap className="w-3 h-3" />
              <span>Smart</span>
            </button>
          </div>

          {/* Row 4: Mode-Specific Manual Seconds Controls */}
          {effectiveMode === 'countdown' ? (
            <div className="flex items-center justify-between gap-2 pt-0.5">
              <div className="min-w-0">
                <span className="text-[11px] font-bold text-[var(--app-text-strong)] block">Seconds</span>
                <span className="font-mono text-[var(--app-text-muted)] text-[9.5px] font-normal">3-600s</span>
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
          ) : (
            <div className="space-y-2 pt-0.5">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-[11px] font-bold text-[var(--app-text-strong)] block">Base sec</span>
                  <span className="font-mono text-[var(--app-text-muted)] text-[9.5px] font-normal">Scales by words</span>
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

              <div className="flex items-center justify-between pt-1.5 border-t border-[var(--app-border)] px-0.5">
                <span className="text-[11px] font-bold text-[var(--app-text-strong)]">Pause at breaks</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={microPauseEnabled}
                  onClick={handleToggleMicroPause}
                  className={`w-7 h-4 rounded-full transition-colors p-0.5 flex items-center cursor-pointer ${
                    microPauseEnabled ? 'bg-[var(--app-accent)] justify-end' : 'bg-[var(--app-surface-2)] justify-start'
                  }`}
                >
                  <span className="w-3 h-3 bg-white rounded-full block shadow-sm" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Ghost-Sync Quiet Floating Indicator: Hairline SVG Progress Ring + Center Seconds */}
      <div
        className={`fixed ${
          isImmersiveFullscreen ? 'bottom-4' : 'bottom-11'
        } right-5 z-40 flex items-center gap-1 select-none`}
      >
        <button
          type="button"
          onClick={handleTogglePause}
          aria-label={triggerTooltip}
          title={triggerTooltip}
          className={`relative group h-8 min-w-[34px] px-1.5 flex items-center justify-center gap-1 rounded-full font-mono tabular-nums text-[12px] tracking-tight transition-all duration-150 cursor-pointer ${
            metrics.isUserPaused
              ? 'bg-[var(--app-surface)] text-[var(--app-text-muted)] border border-[var(--app-border)] shadow-md opacity-75 hover:opacity-100'
              : 'bg-[var(--app-surface)] text-[var(--app-text-strong)] border border-[var(--app-border)] shadow-md hover:border-[var(--app-accent)]'
          }`}
        >
          {/* Hairline SVG Circular Progress Ring */}
          <svg
            className="w-7 h-7 -rotate-90 pointer-events-none"
            viewBox="0 0 32 32"
          >
            {/* Background ring */}
            <circle
              cx="16"
              cy="16"
              r={circleRadius}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="text-[var(--app-border)] opacity-60"
            />
            {/* Progress ring with smooth 100ms transitions */}
            <circle
              cx="16"
              cy="16"
              r={circleRadius}
              fill="none"
              stroke="var(--app-accent)"
              strokeWidth="1.75"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-[stroke-dashoffset] duration-100 ease-linear"
            />
          </svg>

          {/* Centered Content */}
          <div className="absolute inset-0 flex items-center justify-center gap-0.5 pr-0.5">
            {metrics.pauseReason === 'inactivity' ? (
              <Clock className="w-3 h-3 text-amber-500" />
            ) : metrics.isUserPaused ? (
              <Play className="w-2.5 h-2.5 fill-current text-[var(--app-text-muted)] group-hover:text-[var(--app-text-strong)]" />
            ) : null}
            <span className="text-[11px] font-semibold leading-none">{metrics.remainingSec}</span>
          </div>
        </button>

        {/* Quiet Settings Cog Button */}
        <button
          type="button"
          onClick={() => setIsModalOpen((prev) => !prev)}
          aria-label="Auto-Scroll Settings"
          title="Auto-Scroll Settings"
          className={`w-6 h-6 flex items-center justify-center rounded-full text-[var(--app-text-muted)] hover:text-[var(--app-text-strong)] hover:bg-[var(--app-surface)] transition-colors cursor-pointer ${
            isModalOpen ? 'text-[var(--app-accent)] bg-[var(--app-surface)]' : ''
          }`}
        >
          <SettingsIcon className="w-3 h-3" />
        </button>
      </div>
    </>
  )
}
