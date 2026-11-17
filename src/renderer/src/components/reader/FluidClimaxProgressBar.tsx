import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import type { Book } from '../../db'
import type { ReaderTheme } from '../ui/ThemePickerGrid'

interface FluidClimaxProgressBarProps {
  progressPercent: number
  currentPage: number
  totalPages: number
  book?: Book | null
  onSeek: (targetPercent: number) => void
  theme?: ReaderTheme
  isImmersiveFullscreen?: boolean
}

// 8 distinct starting and ending harmonious hue palettes (excluding red ~345° to 15°)
const PALETTE_START_HUES = [
  210, // Azure Sapphire
  162, // Emerald Mint
  275, // Deep Amethyst
  188, // Electric Cyan
  38,  // Amber Ochre
  242, // Twilight Indigo
  170, // Seafoam
  295  // Soft Orchid
]

const PALETTE_END_HUES = [
  215, // Celestial Blue
  265, // Royal Violet
  152, // Jade
  44,  // Sunlit Gold
  198, // Ocean Cyan
  280, // Midnight Plum
  175, // Lagoon
  235  // Deep Cobalt
]

// 32-bit FNV-1a hash for deterministic book seeding
function getBookSeed(book?: Book | null): number {
  if (!book) return 42
  const str = `${book.id || ''}:${book.title || ''}:${book.author || ''}`
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

// Interpolate shortest path between two angles on 360-degree color wheel
function interpolateHue(from: number, to: number, t: number): number {
  let diff = (to - from) % 360
  if (diff > 180) diff -= 360
  if (diff < -180) diff += 360
  return (from + diff * t + 360) % 360
}

export const FluidClimaxProgressBar: React.FC<FluidClimaxProgressBarProps> = ({
  progressPercent,
  currentPage,
  totalPages,
  book,
  onSeek,
  theme = 'night',
  isImmersiveFullscreen = false
}) => {
  const [isHovered, setIsHovered] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [hoverPercent, setHoverPercent] = useState<number | null>(null)
  const [dragPercent, setDragPercent] = useState<number | null>(null)
  const dragPercentRef = useRef<number | null>(null)
  const trackRef = useRef<HTMLDivElement>(null)

  // Seed palette calculation (cached per book)
  const { startHue, endHue } = useMemo(() => {
    const seed = getBookSeed(book)
    const sIdx = seed % PALETTE_START_HUES.length
    const eIdx = Math.floor(seed / 13) % PALETTE_END_HUES.length
    return {
      startHue: PALETTE_START_HUES[sIdx],
      endHue: PALETTE_END_HUES[eIdx]
    }
  }, [book?.id, book?.title, book?.author])

  const safeTotal = Math.max(1, Math.round(totalPages || 1))
  const safeCurrentPage = Math.max(1, Math.min(safeTotal, Math.round(currentPage || 1)))

  // Fractional progress percentage so early pages visibly advance the fluid column
  const clampedPct = Math.max(0, Math.min(100, Number.isFinite(progressPercent) ? progressPercent : 0))
  const derivedPagePct = safeTotal > 1 ? ((safeCurrentPage - 1) / (safeTotal - 1)) * 100 : clampedPct
  const effectivePct = clampedPct > 0 ? clampedPct : safeCurrentPage > 1 ? Math.max(0.5, derivedPagePct) : 0

  // While actively dragging, mirror the pointer position immediately in the fluid column
  const activeFluidPct = isDragging && dragPercent !== null ? dragPercent : effectivePct
  const previewPct = isDragging && dragPercent !== null ? dragPercent : hoverPercent !== null ? hoverPercent : effectivePct

  const targetPageForPct = useCallback(
    (pct: number) => {
      if (safeTotal <= 1) return 1
      if (pct <= 0) return 1
      if (pct >= 100) return safeTotal
      return Math.max(1, Math.min(safeTotal, Math.round((pct / 100) * (safeTotal - 1)) + 1))
    },
    [safeTotal]
  )

  const displayedEndPage = isDragging && dragPercent !== null ? targetPageForPct(dragPercent) : safeCurrentPage
  const tooltipPage = targetPageForPct(previewPct)

  // Narrative Climax Chromatic Calculation
  // Climax apex = 58% (standard narrative midpoint), spread sigma = 14%
  const { fluidColor, glowColor, climaxIntensity } = useMemo(() => {
    const p = activeFluidPct
    const climaxApex = 58
    const sigma = 14
    const climaxWeight = Math.exp(-Math.pow(p - climaxApex, 2) / (2 * Math.pow(sigma, 2)))

    const CLIMAX_RED_HUE = 358 // Pure Crimson / Ruby Red
    let currentHue: number

    if (p <= climaxApex) {
      const t = Math.min(1, Math.max(0, p / climaxApex))
      currentHue = interpolateHue(startHue, CLIMAX_RED_HUE, Math.max(t * 0.7, climaxWeight))
    } else {
      const t = Math.min(1, Math.max(0, (p - climaxApex) / (100 - climaxApex)))
      currentHue = interpolateHue(CLIMAX_RED_HUE, endHue, (1 - climaxWeight) * t)
    }

    const saturation = Math.round(75 + climaxWeight * 22)
    const lightness = Math.round(48 + climaxWeight * 8)

    const color = `hsl(${Math.round(currentHue)}, ${saturation}%, ${lightness}%)`
    const glow = `hsla(${Math.round(currentHue)}, ${saturation}%, ${lightness}%, ${Math.max(0.2, climaxWeight * 0.75).toFixed(2)})`

    return {
      fluidColor: color,
      glowColor: glow,
      climaxIntensity: climaxWeight
    }
  }, [activeFluidPct, startHue, endHue])

  // Track scrubber calculation with 0.1% precision so large books seek accurately
  const calculatePercentFromEvent = useCallback((e: MouseEvent | React.MouseEvent) => {
    if (!trackRef.current) return 0
    const rect = trackRef.current.getBoundingClientRect()
    if (rect.width <= 0) return 0
    const x = e.clientX - rect.left
    const rawPct = (x / rect.width) * 100
    return Math.max(0, Math.min(100, Math.round(rawPct * 10) / 10))
  }, [])

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return
      e.preventDefault()
      const targetPct = calculatePercentFromEvent(e)
      dragPercentRef.current = targetPct
      setIsDragging(true)
      setDragPercent(targetPct)
      setHoverPercent(targetPct)
    },
    [calculatePercentFromEvent]
  )

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      const targetPct = calculatePercentFromEvent(e)
      dragPercentRef.current = targetPct
      setDragPercent(targetPct)
      setHoverPercent(targetPct)
    }

    const handleMouseUp = (e: MouseEvent) => {
      const finalPct = dragPercentRef.current ?? calculatePercentFromEvent(e)
      dragPercentRef.current = null
      setIsDragging(false)
      setDragPercent(null)
      setHoverPercent(null)
      onSeek(finalPct)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, calculatePercentFromEvent, onSeek])

  const handleTrackMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) {
      setHoverPercent(calculatePercentFromEvent(e))
    }
  }

  // Theme-aware glass capillary borders & track
  const isLightMode = theme === 'day' || theme === 'light-sepia'
  const tubeBorderColor = isLightMode ? 'rgba(0, 0, 0, 0.14)' : 'rgba(255, 255, 255, 0.12)'
  const tubeTrackBg = isLightMode ? 'rgba(0, 0, 0, 0.07)' : 'rgba(255, 255, 255, 0.07)'
  const ghostLineClass = isLightMode ? 'bg-black/35' : 'bg-white/45'

  return (
    <footer
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        if (!isDragging) {
          setIsHovered(false)
          setHoverPercent(null)
        }
      }}
      className={`w-full relative select-none transition-all duration-200 z-30 flex items-center gap-3.5 shrink-0 ${
        isImmersiveFullscreen ? 'h-7 pb-1' : 'h-9 pb-1.5'
      } px-6`}
    >
      {/* Delicate Glass Capillary Tube Container */}
      <div
        ref={trackRef}
        role="slider"
        aria-label="Reading progress"
        aria-valuemin={1}
        aria-valuemax={safeTotal}
        aria-valuenow={displayedEndPage}
        onMouseDown={handleMouseDown}
        onMouseMove={handleTrackMouseMove}
        className="flex-1 min-w-0 relative cursor-pointer py-2 flex items-center group"
      >
        {/* Outer Capillary Glass Tube */}
        <div
          className={`w-full rounded-full relative overflow-hidden transition-all duration-150 ${
            isHovered || isDragging ? 'h-2' : 'h-[5px]'
          }`}
          style={{
            backgroundColor: tubeTrackBg,
            boxShadow: isLightMode
              ? 'inset 0 1px 1px rgba(0,0,0,0.08), 0 0 0 0.5px rgba(0,0,0,0.08)'
              : 'inset 0 1px 1px rgba(255,255,255,0.12), inset 0 -1px 1px rgba(0,0,0,0.35), 0 0 0 0.5px rgba(255,255,255,0.08)',
            border: `0.5px solid ${tubeBorderColor}`
          }}
        >
          {/* Inner Fluid Column */}
          <div
            className={`h-full rounded-full relative ${
              isDragging ? 'transition-none' : 'transition-[width] duration-150 ease-out'
            }`}
            style={{
              width: `${activeFluidPct}%`,
              backgroundColor: fluidColor,
              boxShadow: `0 0 ${Math.round(4 + climaxIntensity * 8)}px ${glowColor}`
            }}
          >
            {/* Top Cylindrical Liquid Specular Sheen */}
            <div
              className="absolute inset-x-0 top-0 h-[45%] rounded-t-full pointer-events-none opacity-60"
              style={{
                background: 'linear-gradient(to bottom, rgba(255,255,255,0.65) 0%, rgba(255,255,255,0.1) 100%)'
              }}
            />

            {/* Leading Liquid Meniscus Surface Tension Bulb */}
            {activeFluidPct > 0 && (
              <div
                className="absolute right-0 top-1/2 -translate-y-1/2 rounded-full pointer-events-none transition-all duration-150"
                style={{
                  width: isHovered || isDragging ? '6px' : '4px',
                  height: isHovered || isDragging ? '6px' : '4px',
                  backgroundColor: isLightMode ? fluidColor : '#ffffff',
                  boxShadow: isLightMode
                    ? `0 0 0 1.5px rgba(255,255,255,0.85), 0 0 6px ${glowColor}`
                    : `0 0 6px ${glowColor}, 0 0 2px #ffffff`,
                  opacity: 0.95
                }}
              />
            )}
          </div>

          {/* Theme-Adaptive Ghost Scrubber Hairline on Hover */}
          {(isHovered || isDragging) && hoverPercent !== null && (
            <div
              className={`absolute top-0 bottom-0 pointer-events-none w-0.5 z-10 ${ghostLineClass}`}
              style={{ left: `${hoverPercent}%` }}
            />
          )}
        </div>

        {/* Theme-Adaptive Hover / Scrub Position Pill (clamped inside track bounds) */}
        {(isHovered || isDragging) && hoverPercent !== null && (
          <div
            className="absolute -top-7 -translate-x-1/2 pointer-events-none z-40 bg-[var(--app-surface)] border border-[var(--app-border-strong)] text-[var(--app-text-strong)] text-[11px] font-mono font-semibold tabular-nums whitespace-nowrap px-2 py-0.5 rounded-md shadow-lg backdrop-blur-md animate-in fade-in zoom-in-95 duration-100"
            style={{
              left: `clamp(44px, ${previewPct}%, calc(100% - 44px))`
            }}
          >
            {tooltipPage}/{safeTotal} · {Math.round(previewPct)}%
          </div>
        )}
      </div>

      {/* Crisp, Non-Muted, Theme-Adaptive Page Counter at End of Progress Bar */}
      <div
        className="shrink-0 text-[12px] font-mono font-semibold tabular-nums leading-none text-[var(--app-text-strong)] tracking-tight"
        title={`Page ${displayedEndPage} of ${safeTotal} (${Math.round(activeFluidPct)}%)`}
      >
        {displayedEndPage}/{safeTotal}
      </div>
    </footer>
  )
}
