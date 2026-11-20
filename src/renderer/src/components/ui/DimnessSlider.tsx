import React, { useRef, useCallback, useState } from 'react'
import { Moon } from 'lucide-react'

interface DimnessSliderProps {
  value: number // 0 to 70 (%)
  onChange: (nextValue: number) => void
  min?: number
  max?: number
  step?: number
}

export const DimnessSlider: React.FC<DimnessSliderProps> = ({
  value,
  onChange,
  min = 0,
  max = 70,
  step = 5
}) => {
  const trackRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  // Clamp helper
  const clamp = useCallback(
    (v: number) => Math.max(min, Math.min(max, Math.round(v / step) * step)),
    [min, max, step]
  )

  // Calculate percentage along the 0 - max track
  const range = max - min
  const pct = range > 0 ? Math.max(0, Math.min(100, ((value - min) / range) * 100)) : 0

  const updateFromPointer = useCallback(
    (clientX: number) => {
      const track = trackRef.current
      if (!track) return
      const rect = track.getBoundingClientRect()
      if (rect.width <= 0) return
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
      const nextRaw = min + ratio * (max - min)
      onChange(clamp(nextRaw))
    },
    [min, max, clamp, onChange]
  )

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    updateFromPointer(e.clientX)
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return
    updateFromPointer(e.clientX)
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      setIsDragging(false)
      try {
        ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
      } catch {}
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault()
      onChange(clamp(value + step))
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault()
      onChange(clamp(value - step))
    } else if (e.key === 'Home') {
      e.preventDefault()
      onChange(min)
    } else if (e.key === 'End') {
      e.preventDefault()
      onChange(max)
    }
  }

  const handleDecreaseClick = () => {
    onChange(clamp(value - step))
  }

  const handleIncreaseClick = () => {
    onChange(clamp(value + step))
  }

  return (
    <div className="space-y-1.5 select-none">
      {/* Header Row: Label & Percentage */}
      <div className="flex items-center justify-between text-[12px] font-semibold">
        <span className="text-[var(--app-text)]">Dimness</span>
        <span className="text-[11px] font-mono tabular-nums text-[var(--app-text-muted)]">
          {value}%
        </span>
      </div>

      {/* Slider Row: Small Moon + Slider Track + Bigger Moon */}
      <div className="flex items-center gap-2.5 pt-0.5">
        {/* Small Muted Moon (Decrease dimness) */}
        <button
          type="button"
          onClick={handleDecreaseClick}
          title="Decrease dimness"
          aria-label="Decrease dimness"
          className="text-[var(--app-text-muted)] hover:text-[var(--app-text-strong)] transition-opacity opacity-60 hover:opacity-100 flex items-center justify-center p-0.5 cursor-pointer"
        >
          <Moon className="w-3.5 h-3.5" />
        </button>

        {/* Interactive Slider Track */}
        <div
          ref={trackRef}
          role="slider"
          tabIndex={0}
          aria-label="Dimness"
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onKeyDown={handleKeyDown}
          className="relative flex-1 h-5 flex items-center cursor-pointer group outline-none"
        >
          {/* Base Unfilled Pill Track */}
          <div className="w-full h-1.5 rounded-full bg-[rgba(0,0,0,0.28)] dark:bg-[rgba(255,255,255,0.12)] border border-[rgba(255,255,255,0.06)] dark:border-[rgba(255,255,255,0.1)] overflow-hidden shadow-inner" />

          {/* Active Filled Pill Bar */}
          <div
            style={{ width: `${pct}%` }}
            className="absolute left-0 top-1/2 -translate-y-1/2 h-1.5 rounded-full bg-gradient-to-r from-[var(--app-accent)] to-[var(--app-accent-hover,var(--app-accent))] pointer-events-none transition-[width] duration-75"
          />

          {/* Donut Thumb Knob (Outer disc with solid white center dot) */}
          <div
            style={{ left: `${pct}%` }}
            className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-[var(--app-surface-3,#1e222d)] border border-white/30 shadow-[0_2px_8px_rgba(0,0,0,0.4)] flex items-center justify-center pointer-events-none transition-transform duration-100 ${
              isDragging ? 'scale-115 ring-2 ring-[var(--app-accent)]/50' : 'group-hover:scale-110'
            }`}
          >
            {/* Inner White Dot */}
            <div className="w-1.5 h-1.5 rounded-full bg-white shadow-sm" />
          </div>
        </div>

        {/* Bigger Muted Moon (Increase dimness) */}
        <button
          type="button"
          onClick={handleIncreaseClick}
          title="Increase dimness"
          aria-label="Increase dimness"
          className="text-[var(--app-text-muted)] hover:text-[var(--app-text-strong)] transition-opacity opacity-60 hover:opacity-100 flex items-center justify-center p-0.5 cursor-pointer"
        >
          <Moon className="w-4.5 h-4.5" />
        </button>
      </div>
    </div>
  )
}
