import React, { useEffect, useState } from 'react'
import {
  Play,
  Pause,
  Timer,
  Zap,
  Minus,
  Plus,
  RotateCcw,
  Power,
  X,
  Clock,
  Gauge,
  Pilcrow
} from 'lucide-react'
import { adaptiveScrollEngine, type PacingMetrics } from '../../services/adaptiveScrollService'
import { useAppStore } from '../../stores/useAppStore'
import type { AutoscrollMode } from '../../db'

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

  const effectiveMode: AutoscrollMode = settings.autoscrollMode ?? (settings.autoscrollAdaptive === false ? 'countdown' : 'adaptive')
  const countdownSec = settings.autoscrollCountdownSec ?? 20
  const targetWpm = settings.targetWpm ?? 250
  const microPauseEnabled = settings.autoscrollMicroPause ?? true

  const handleModeChange = (mode: AutoscrollMode) => {
    adaptiveScrollEngine.recordUserActivity()
    updateSettings({ autoscrollMode: mode, autoscrollAdaptive: mode === 'adaptive' })
    adaptiveScrollEngine.configure({ mode })
  }

  const handleCountdownChange = (nextSec: number) => {
    const clamped = Math.max(5, Math.min(120, Math.round(nextSec)))
    adaptiveScrollEngine.recordUserActivity()
    updateSettings({ autoscrollCountdownSec: clamped })
    adaptiveScrollEngine.configure({ fixedCountdownSec: clamped })
  }

  const handleWpmChange = (nextWpm: number) => {
    const clamped = Math.max(100, Math.min(800, Math.round(nextWpm)))
    adaptiveScrollEngine.recordUserActivity()
    updateSettings({ targetWpm: clamped })
    adaptiveScrollEngine.configure({ targetWpm: clamped })
  }

  const handleToggleMicroPause = () => {
    const next = !microPauseEnabled
    adaptiveScrollEngine.recordUserActivity()
    updateSettings({ autoscrollMicroPause: next })
    adaptiveScrollEngine.configure({ microPauseEnabled: next })
  }

  const handleReset = () => {
    adaptiveScrollEngine.recordUserActivity()
    if (effectiveMode === 'countdown') {
      handleCountdownChange(20)
    } else {
      updateSettings({ targetWpm: 250 })
      adaptiveScrollEngine.reset(250)
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
      ? `Auto-Scroll auto-paused after 5 min inactivity (${metrics.remainingSec}s left) — Click to resume or configure`
      : metrics.isUserPaused
      ? `Auto-Scroll paused (${metrics.remainingSec}s left) — Click to resume or configure`
      : effectiveMode === 'adaptive'
      ? `Adaptive Auto-Scroll: ${metrics.remainingSec}s left (${metrics.currentWpm} WPM) — Click to pause or configure`
      : `Auto-Scroll Countdown: ${metrics.remainingSec}s left (${countdownSec}s interval) — Click to pause or configure`

  return (
    <>
      {/* Click-outside dismissal backdrop when modal is open */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-40 bg-transparent"
          onClick={() => setIsModalOpen(false)}
        />
      )}

      {/* Tap-to-Open Compact Icon-Only Auto-Scroll Settings Modal */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-label="Auto-Scroll Settings"
          className={`fixed ${
            isImmersiveFullscreen ? 'bottom-14' : 'bottom-20'
          } right-5 z-50 w-56 bg-[#171a21]/95 backdrop-blur-md border border-[#2d323f] rounded-[2px] shadow-2xl p-2.5 space-y-2.5 select-none animate-in fade-in slide-in-from-bottom-2 duration-120`}
        >
          {/* Row 1: Playback & Lifecycle Controls (Icons Only) */}
          <div className="flex items-center justify-between pb-2 border-b border-[#232732]">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleTogglePause}
                aria-label={metrics.isUserPaused ? 'Resume Auto-Scroll' : 'Pause Auto-Scroll'}
                title={
                  metrics.pauseReason === 'inactivity'
                    ? 'Resume Auto-Scroll (was paused due to 5 min inactivity)'
                    : metrics.isUserPaused
                    ? 'Resume Auto-Scroll countdown'
                    : 'Pause Auto-Scroll countdown'
                }
                className={`w-7 h-7 flex items-center justify-center rounded-[2px] transition-colors ${
                  metrics.isUserPaused
                    ? 'bg-[#2a69df] text-white hover:bg-[#3574e8]'
                    : 'bg-[#282c37] text-white hover:bg-[#323745]'
                }`}
              >
                {metrics.isUserPaused ? (
                  <Play className="w-3.5 h-3.5 fill-current" />
                ) : (
                  <Pause className="w-3.5 h-3.5 fill-current" />
                )}
              </button>

              {metrics.pauseReason === 'inactivity' && (
                <span
                  className="w-6 h-6 flex items-center justify-center text-[#f59e0b]"
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
                    ? 'Reset fixed countdown interval to 20s'
                    : 'Reset adaptive reading pace to 250 WPM'
                }
                className="w-7 h-7 flex items-center justify-center rounded-[2px] text-[#8b949e] hover:text-white hover:bg-[#282c37] transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={handleTurnOff}
                aria-label="Turn off Auto-Scroll"
                title="Turn off Auto-Scroll completely"
                className="w-7 h-7 flex items-center justify-center rounded-[2px] text-[#8b949e] hover:text-[#f85149] hover:bg-[#332225] transition-colors"
              >
                <Power className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                aria-label="Close Auto-Scroll modal"
                title="Close panel and resume reading"
                className="w-7 h-7 flex items-center justify-center rounded-[2px] text-[#8b949e] hover:text-white hover:bg-[#282c37] transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Row 2: Sleek Segmented Mode Selector (Fixed vs Smart) */}
          <div className="grid grid-cols-2 p-0.5 bg-[#0d0f14] rounded-[3px] border border-[#1f232d]">
            <button
              type="button"
              onClick={() => handleModeChange('countdown')}
              className={`h-7 rounded-[2px] flex items-center justify-center gap-1.5 text-[11px] font-medium transition-all cursor-pointer ${
                effectiveMode === 'countdown'
                  ? 'bg-[#2a69df] text-white shadow-sm'
                  : 'text-[#8b949e] hover:text-white'
              }`}
            >
              <Timer className="w-3 h-3" />
              <span>Fixed</span>
            </button>

            <button
              type="button"
              onClick={() => handleModeChange('adaptive')}
              className={`h-7 rounded-[2px] flex items-center justify-center gap-1.5 text-[11px] font-medium transition-all cursor-pointer ${
                effectiveMode === 'adaptive'
                  ? 'bg-[#2a69df] text-white shadow-sm'
                  : 'text-[#8b949e] hover:text-white'
              }`}
            >
              <Zap className="w-3 h-3" />
              <span>Smart</span>
            </button>
          </div>

          {/* Row 3: Mode-Specific Speed / Parameter Controls */}
          {effectiveMode === 'countdown' ? (
            <div className="space-y-1.5 pt-0.5">
              <div className="flex items-center justify-between px-0.5 text-[11px]">
                <span className="text-[#8b949e]">Timer</span>
                <span className="font-mono text-white">{countdownSec}s</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleCountdownChange(countdownSec - 5)}
                  aria-label="Decrease countdown seconds"
                  title="-5s"
                  className="w-6 h-6 shrink-0 flex items-center justify-center rounded-[2px] bg-[#232732] text-[#8b949e] hover:text-white hover:bg-[#2d323f] cursor-pointer"
                >
                  <Minus className="w-3 h-3" />
                </button>

                <input
                  type="range"
                  min="5"
                  max="120"
                  step="5"
                  value={countdownSec}
                  onChange={(e) => handleCountdownChange(Number(e.target.value))}
                  aria-label="Fixed countdown seconds per page"
                  className="ice-slider flex-1"
                />

                <button
                  type="button"
                  onClick={() => handleCountdownChange(countdownSec + 5)}
                  aria-label="Increase countdown seconds"
                  title="+5s"
                  className="w-6 h-6 shrink-0 flex items-center justify-center rounded-[2px] bg-[#232732] text-[#8b949e] hover:text-white hover:bg-[#2d323f] cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2 pt-0.5">
              <div className="flex items-center justify-between px-0.5 text-[11px]">
                <span className="text-[#8b949e]">Pace</span>
                <span className="font-mono text-white">{metrics.currentWpm} WPM</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleWpmChange(targetWpm - 25)}
                  aria-label="Slower reading speed"
                  title="-25 WPM"
                  className="w-6 h-6 shrink-0 flex items-center justify-center rounded-[2px] bg-[#232732] text-[#8b949e] hover:text-white hover:bg-[#2d323f] cursor-pointer"
                >
                  <Minus className="w-3 h-3" />
                </button>

                <input
                  type="range"
                  min="100"
                  max="800"
                  step="25"
                  value={targetWpm}
                  onChange={(e) => handleWpmChange(Number(e.target.value))}
                  aria-label="Target adaptive reading speed"
                  className="ice-slider flex-1"
                />

                <button
                  type="button"
                  onClick={() => handleWpmChange(targetWpm + 25)}
                  aria-label="Faster reading speed"
                  title="+25 WPM"
                  className="w-6 h-6 shrink-0 flex items-center justify-center rounded-[2px] bg-[#232732] text-[#8b949e] hover:text-white hover:bg-[#2d323f] cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>

              <div className="flex items-center justify-between pt-1.5 border-t border-[#1e222c] px-0.5">
                <span className="text-[10px] text-[#8b949e]">Pause at breaks</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={microPauseEnabled}
                  onClick={handleToggleMicroPause}
                  className={`w-7 h-4 rounded-[2px] transition-colors p-0.5 flex items-center cursor-pointer ${
                    microPauseEnabled ? 'bg-[#2a69df] justify-end' : 'bg-[#282c37] justify-start'
                  }`}
                >
                  <span className="w-3 h-3 bg-white rounded-[1px] block" />
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
        } right-5 z-40 h-7 min-w-[28px] px-1.5 flex items-center justify-center gap-1 rounded-[2px] font-mono tabular-nums text-[13px] tracking-tight transition-all duration-150 select-none cursor-pointer ${
          isModalOpen
            ? 'bg-[#171a21]/95 border border-[#2a69df] text-white opacity-100 shadow-lg'
            : metrics.isUserPaused
            ? 'bg-transparent text-[#8b949e] opacity-40 hover:opacity-95 hover:bg-[#171a21]/75'
            : 'bg-transparent text-[#8b949e] opacity-45 hover:opacity-100 hover:bg-[#171a21]/75 hover:text-white'
        }`}
      >
        {metrics.pauseReason === 'inactivity' ? (
          <Clock className="w-3 h-3 text-[#f59e0b]" />
        ) : metrics.isUserPaused ? (
          <Pause className="w-2.5 h-2.5 fill-current" />
        ) : null}
        <span>{metrics.remainingSec}</span>
      </button>
    </>
  )
}
