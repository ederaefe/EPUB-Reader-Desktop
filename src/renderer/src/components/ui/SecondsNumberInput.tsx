import React, { useEffect, useState } from 'react'
import { Minus, Plus } from 'lucide-react'

interface SecondsNumberInputProps {
  value: number
  min?: number
  max?: number
  step?: number
  onChange: (nextSec: number) => void
  ariaLabel?: string
  compact?: boolean
}

export const SecondsNumberInput: React.FC<SecondsNumberInputProps> = ({
  value,
  min = 3,
  max = 600,
  step = 5,
  onChange,
  ariaLabel = 'Seconds per page',
  compact = false
}) => {
  const [draft, setDraft] = useState<string>(String(value))

  useEffect(() => {
    setDraft(String(value))
  }, [value])

  const clamp = (n: number) => Math.max(min, Math.min(max, Math.round(n)))

  const commitDraft = (raw: string) => {
    const parsed = parseInt(raw.trim(), 10)
    if (Number.isNaN(parsed)) {
      setDraft(String(value))
      return
    }
    const next = clamp(parsed)
    setDraft(String(next))
    if (next !== value) {
      onChange(next)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cleaned = e.target.value.replace(/[^\d]/g, '').slice(0, 4)
    setDraft(cleaned)
    if (cleaned.length > 0) {
      const parsed = parseInt(cleaned, 10)
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
      const delta = e.shiftKey ? step : 1
      onChange(clamp(value + delta))
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      const delta = e.shiftKey ? step : 1
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
        aria-label={`Decrease by ${step} seconds`}
        title={`-${step}s`}
        className={`${btnSize} shrink-0 flex items-center justify-center rounded-md bg-[#161616] border border-white/[0.09] text-[#999999] hover:text-white hover:bg-[#1f1f1f] hover:border-white/20 disabled:opacity-35 disabled:cursor-not-allowed transition-colors cursor-pointer`}
      >
        <Minus className="w-3.5 h-3.5" />
      </button>

      <div className="relative flex-1 flex items-center">
        <input
          type="text"
          inputMode="numeric"
          value={draft}
          onChange={handleInputChange}
          onBlur={() => commitDraft(draft)}
          onKeyDown={handleKeyDown}
          onFocus={(e) => e.target.select()}
          aria-label={ariaLabel}
          className={`ice-input w-full ${inputHeight} pl-3 pr-9 text-center font-mono text-[12px] font-medium text-white tabular-nums select-text`}
        />
        <span className="absolute right-2.5 text-[10px] font-mono text-[#6e7681] pointer-events-none">
          sec
        </span>
      </div>

      <button
        type="button"
        onClick={() => onChange(clamp(value + step))}
        disabled={value >= max}
        aria-label={`Increase by ${step} seconds`}
        title={`+${step}s`}
        className={`${btnSize} shrink-0 flex items-center justify-center rounded-md bg-[#161616] border border-white/[0.09] text-[#999999] hover:text-white hover:bg-[#1f1f1f] hover:border-white/20 disabled:opacity-35 disabled:cursor-not-allowed transition-colors cursor-pointer`}
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
