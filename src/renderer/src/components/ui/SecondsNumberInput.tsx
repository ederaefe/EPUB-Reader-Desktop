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

  const heightClass = compact ? 'h-[26px]' : 'h-7'
  const btnWidth = compact ? 'w-6' : 'w-7'

  return (
    <div
      className={`inline-flex items-center ${heightClass} rounded-md border border-[var(--app-border-strong)] bg-[var(--app-input-bg)] overflow-hidden shrink-0 focus-within:border-[var(--app-accent)] focus-within:ring-2 focus-within:ring-[var(--app-accent-soft)] transition-colors`}
    >
      <button
        type="button"
        onClick={() => onChange(clamp(value - step))}
        disabled={value <= min}
        aria-label={`Decrease by ${step} seconds`}
        title={`-${step}s`}
        className={`${btnWidth} h-full shrink-0 flex items-center justify-center border-r border-[var(--app-border)] bg-[var(--app-surface-2)] text-[var(--app-text-muted)] hover:bg-[var(--app-accent)] hover:text-white active:scale-95 disabled:opacity-35 disabled:cursor-not-allowed transition-colors cursor-pointer`}
      >
        <Minus className="w-3 h-3" />
      </button>

      <div className="w-[66px] h-full flex items-center justify-center px-1.5 gap-0.5">
        <input
          type="text"
          inputMode="numeric"
          value={draft}
          onChange={handleInputChange}
          onBlur={() => commitDraft(draft)}
          onKeyDown={handleKeyDown}
          onFocus={(e) => e.target.select()}
          aria-label={ariaLabel}
          className="bg-transparent border-0 outline-none p-0 min-w-0 w-[34px] text-right font-mono text-[12px] font-bold text-[var(--app-text-strong)] tabular-nums select-text"
        />
        <span className="text-[10.5px] font-mono font-semibold text-[var(--app-text-muted)] pointer-events-none select-none shrink-0">
          sec
        </span>
      </div>

      <button
        type="button"
        onClick={() => onChange(clamp(value + step))}
        disabled={value >= max}
        aria-label={`Increase by ${step} seconds`}
        title={`+${step}s`}
        className={`${btnWidth} h-full shrink-0 flex items-center justify-center border-l border-[var(--app-border)] bg-[var(--app-surface-2)] text-[var(--app-text-muted)] hover:bg-[var(--app-accent)] hover:text-white active:scale-95 disabled:opacity-35 disabled:cursor-not-allowed transition-colors cursor-pointer`}
      >
        <Plus className="w-3 h-3" />
      </button>
    </div>
  )
}
