import React, { useEffect, useState } from 'react'
import { Play, Pause, ChevronUp, ChevronDown, Zap, X } from 'lucide-react'
import { adaptiveScrollEngine, type PacingMetrics } from '../../services/adaptiveScrollService'

interface AdaptiveScrollOverlayProps {
  isActive: boolean
  onToggle: () => void
  onClose: () => void
}

export const AdaptiveScrollOverlay: React.FC<AdaptiveScrollOverlayProps> = ({
  isActive,
  onToggle,
  onClose
}) => {
  const [metrics, setMetrics] = useState<PacingMetrics>(adaptiveScrollEngine.getMetrics())

  useEffect(() => {
    return adaptiveScrollEngine.subscribe((m) => setMetrics(m))
  }, [])

  if (!isActive) return null

  return (
    <div className="absolute top-11 right-4 z-40 bg-[#171a21]/95 backdrop-blur-md border border-[#2d323f] rounded-[3px] shadow-2xl p-2.5 flex items-center gap-3 text-xs text-[#c9d1d9] select-none animate-in fade-in slide-in-from-top-2 duration-150">
      <div className="flex items-center gap-1.5 border-r border-[#232732] pr-3">
        <button
          onClick={onToggle}
          className={`h-7 px-2.5 flex items-center gap-1.5 rounded-[2px] transition-colors ${
            metrics.isPaused
              ? 'bg-[#282c37] text-[#8b949e] hover:text-white'
              : 'bg-[#2a69df] text-white font-medium'
          }`}
          title={metrics.isPaused ? 'Resume auto-scroll' : 'Pause auto-scroll'}
        >
          {metrics.isPaused ? (
            <Play className="w-3.5 h-3.5 fill-current" />
          ) : (
            <Pause className="w-3.5 h-3.5 fill-current" />
          )}
          <span>{metrics.isPaused ? 'Resume' : 'Scrolling'}</span>
        </button>
      </div>

      {/* Cadence Metrics */}
      <div className="flex flex-col">
        <div className="flex items-center gap-1.5 text-[11px] font-mono">
          <Zap className="w-3 h-3 text-[#f59e0b]" />
          <span className="font-semibold text-white">{metrics.currentWpm} WPM</span>
          <span className="text-[#8b949e] text-[10px]">(Target: {metrics.targetWpm})</span>
        </div>
        <div className="text-[10px] text-[#8b949e]">
          {metrics.isMicroPausing ? (
            <span className="text-[#f59e0b]">Cognitive break...</span>
          ) : (
            <span>Adaptive Word Density</span>
          )}
        </div>
      </div>

      {/* Speed Nudge Buttons */}
      <div className="flex items-center gap-0.5 border-l border-[#232732] pl-2">
        <button
          onClick={() => adaptiveScrollEngine.onBackScrollDetected()}
          className="w-6 h-6 flex items-center justify-center text-[#8b949e] hover:text-white hover:bg-[#282c37] rounded-[2px]"
          title="Slower (-15%)"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => adaptiveScrollEngine.onForwardNudgeDetected()}
          className="w-6 h-6 flex items-center justify-center text-[#8b949e] hover:text-white hover:bg-[#282c37] rounded-[2px]"
          title="Faster (+10%)"
        >
          <ChevronUp className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Close button */}
      <button
        onClick={onClose}
        className="w-6 h-6 flex items-center justify-center text-[#8b949e] hover:text-white hover:bg-[#282c37] rounded-[2px] ml-1"
        title="Stop Auto-Scroll"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
