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

  const heightClass = compact ? 'h-[26px]' : 'h-7'
  const btnWidth = compact ? 'w-6' : 'w-7'
  const centerWidth = unit ? (unit.length > 2 ? 'w-[72px]' : 'w-[64px]') : 'w-[52px]'

  return (
    <div
      className={`inline-flex items-center ${heightClass} rounded-md border border-[var(--app-border-strong)] bg-[var(--app-input-bg)] overflow-hidden shrink-0 focus-within:border-[var(--app-accent)] focus-within:ring-2 focus-within:ring-[var(--app-accent-soft)] transition-colors`}
    >
      <button
        type="button"
        onClick={() => onChange(clamp(value - step))}
        disabled={value <= min}
        aria-label={`Decrease ${ariaLabel}`}
        title={`-${step}${unit}`}
        className={`${btnWidth} h-full shrink-0 flex items-center justify-center border-r border-[var(--app-border)] bg-[var(--app-surface-2)] text-[var(--app-text-muted)] hover:bg-[var(--app-accent)] hover:text-white active:scale-95 disabled:opacity-35 disabled:cursor-not-allowed transition-colors cursor-pointer`}
      >
        <Minus className="w-3 h-3" />
      </button>

      <div className={`${centerWidth} h-full flex items-center justify-center px-1.5 gap-0.5`}>
        <input
          type="text"
          inputMode={decimals > 0 ? 'decimal' : 'numeric'}
          value={draft}
          onChange={handleInputChange}
          onBlur={() => commitDraft(draft)}
          onKeyDown={handleKeyDown}
          onFocus={(e) => e.target.select()}
          aria-label={ariaLabel}
          className={`bg-transparent border-0 outline-none p-0 min-w-0 ${
            unit ? 'w-[36px] text-right' : 'w-full text-center'
          } font-mono text-[12px] font-bold text-[var(--app-text-strong)] tabular-nums select-text`}
        />
        {unit && (
          <span className="text-[10.5px] font-mono font-semibold text-[var(--app-text-muted)] pointer-events-none select-none shrink-0">
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
        className={`${btnWidth} h-full shrink-0 flex items-center justify-center border-l border-[var(--app-border)] bg-[var(--app-surface-2)] text-[var(--app-text-muted)] hover:bg-[var(--app-accent)] hover:text-white active:scale-95 disabled:opacity-35 disabled:cursor-not-allowed transition-colors cursor-pointer`}
      >
        <Plus className="w-3 h-3" />
      </button>
    </div>
  )
}

