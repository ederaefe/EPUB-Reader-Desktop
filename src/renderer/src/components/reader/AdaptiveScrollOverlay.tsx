import React, { useEffect, useState } from 'react'
import {
  Play,
  Pause,
  Timer,
  Zap,
  RotateCcw,
  Power,
  X,
  Clock
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

  const effectiveMode: AutoscrollMode = settings.autoscrollMode ?? (settings.autoscrollAdaptive === false ? 'countdown' : 'adaptive')
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
    if (effectiveMode === 'countdown') {
      handleCountdownChange(20)
    } else {
      handleAdaptiveSecChange(25)
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
      ? `Auto-Scroll paused while away (${metrics.remainingSec}s left) — Click to resume or configure`
      : metrics.isUserPaused
      ? `Auto-Scroll paused (${metrics.remainingSec}s left) — Click to resume or configure`
      : effectiveMode === 'adaptive'
      ? `Smart Auto-Scroll: ${metrics.remainingSec}s left (${adaptiveSec}s base) — Click to pause or configure`
      : `Fixed Auto-Scroll: ${metrics.remainingSec}s left (${countdownSec}s interval) — Click to pause or configure`

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
          } right-5 z-50 w-60 bg-[#111111]/95 backdrop-blur-md border border-white/[0.1] rounded-lg shadow-[0_16px_48px_rgba(0,0,0,0.75)] p-3 space-y-2.5 select-none animate-in fade-in slide-in-from-bottom-2 duration-120`}
        >
          {/* Row 1: Playback & Lifecycle Controls */}
          <div className="flex items-center justify-between pb-2 border-b border-white/[0.07]">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleTogglePause}
                aria-label={metrics.isUserPaused ? 'Resume Auto-Scroll' : 'Pause Auto-Scroll'}
                className={`h-7 px-2.5 flex items-center justify-center gap-1.5 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                  metrics.isUserPaused
                    ? 'bg-white text-black hover:bg-[#ededed]'
                    : 'bg-[#1f1f1f] text-white hover:bg-[#2a2a2a]'
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
                    ? 'Reset fixed timer to 20s'
                    : 'Reset smart base timer to 25s'
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

          {/* Row 3: Mode-Specific Manual Seconds Controls */}
          {effectiveMode === 'countdown' ? (
            <div className="space-y-1.5 pt-0.5">
              <div className="flex items-center justify-between px-0.5 text-[11px]">
                <span className="text-[#8b949e]">Seconds per page</span>
                <span className="font-mono text-[#6e7681] text-[10px]">3–600s</span>
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
              <div className="flex items-center justify-between px-0.5 text-[11px]">
                <span className="text-[#8b949e]">Base seconds / page</span>
                <span className="font-mono text-[#6e7681] text-[10px]">Scales by words</span>
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
