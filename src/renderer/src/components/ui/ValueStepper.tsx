import React, { useEffect, useState } from 'react'
import { Minus, Plus } from 'lucide-react'

interface ValueStepperProps {
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  decimals?: number
  onChange: (nextVal: number) => void
  ariaLabel?: string
  compact?: boolean
}

export const ValueStepper: React.FC<ValueStepperProps> = ({
  value,
  min,
  max,
  step = 1,
  unit = '',
  decimals = 0,
  onChange,
  ariaLabel = 'Numeric input',
  compact = false
}) => {
  const [draft, setDraft] = useState<string>(
    decimals > 0 ? value.toFixed(decimals) : String(Math.round(value))
  )

  useEffect(() => {
    setDraft(decimals > 0 ? value.toFixed(decimals) : String(Math.round(value)))
  }, [value, decimals])

  const clamp = (n: number) => {
    const factor = Math.pow(10, decimals)
    const clamped = Math.max(min, Math.min(max, n))
    return Math.round(clamped * factor) / factor
  }

  const commitDraft = (raw: string) => {
    const parsed = parseFloat(raw.trim())
    if (Number.isNaN(parsed)) {
      setDraft(decimals > 0 ? value.toFixed(decimals) : String(Math.round(value)))
      return
    }
    const next = clamp(parsed)
    setDraft(decimals > 0 ? next.toFixed(decimals) : String(Math.round(next)))
    if (next !== value) {
      onChange(next)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cleaned = e.target.value.replace(/[^0-9.-]/g, '').slice(0, 7)
    setDraft(cleaned)
    if (cleaned.length > 0 && cleaned !== '-' && cleaned !== '.') {
      const parsed = parseFloat(cleaned)
      if (!Number.isNaN(parsed) && parsed >= min && parsed <= max && parsed !== value) {
        onChange(parsed)
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      commitDraft(draft)
      ;(e.target as HTMLInputElement).blur()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const delta = e.shiftKey ? step * 2 : step
      onChange(clamp(value + delta))
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      const delta = e.shiftKey ? step * 2 : step
      onChange(clamp(value - delta))
    }
  }

  const btnSize = compact ? 'w-7 h-7' : 'w-8 h-8'
  const inputHeight = compact ? 'h-7' : 'h-8'

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => onChange(clamp(value - step))}
        disabled={value <= min}
        aria-label={`Decrease ${ariaLabel}`}
        title={`-${step}${unit}`}
        className={`${btnSize} shrink-0 flex items-center justify-center rounded-md bg-[#161616] border border-white/[0.09] text-[#999999] hover:text-white hover:bg-[#1f1f1f] hover:border-white/20 disabled:opacity-35 disabled:cursor-not-allowed transition-colors cursor-pointer`}
      >
        <Minus className="w-3.5 h-3.5" />
      </button>

      <div className="relative flex-1 flex items-center">
        <input
          type="text"
          inputMode={decimals > 0 ? 'decimal' : 'numeric'}
          value={draft}
          onChange={handleInputChange}
          onBlur={() => commitDraft(draft)}
          onKeyDown={handleKeyDown}
          onFocus={(e) => e.target.select()}
          aria-label={ariaLabel}
          className={`ice-input w-full ${inputHeight} pl-3 ${
            unit ? 'pr-9' : 'pr-3'
          } text-center font-mono text-[12px] font-medium text-white tabular-nums select-text`}
        />
        {unit && (
          <span className="absolute right-2.5 text-[10px] font-mono text-[#6e7681] pointer-events-none select-none">
            {unit}
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={() => onChange(clamp(value + step))}
        disabled={value >= max}
        aria-label={`Increase ${ariaLabel}`}
        title={`+${step}${unit}`}
        className={`${btnSize} shrink-0 flex items-center justify-center rounded-md bg-[#161616] border border-white/[0.09] text-[#999999] hover:text-white hover:bg-[#1f1f1f] hover:border-white/20 disabled:opacity-35 disabled:cursor-not-allowed transition-colors cursor-pointer`}
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
