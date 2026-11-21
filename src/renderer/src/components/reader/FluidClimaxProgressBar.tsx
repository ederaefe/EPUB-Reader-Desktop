import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import type { Book } from '../../db'
import type { ReaderTheme } from '../ui/ThemePickerGrid'

interface FluidClimaxProgressBarProps {
  progressPercent: number
  currentPage: number
  totalPages: number
  book?: Book | null
  onSeek: (targetPercent: number) => void
  onPageChange?: (targetPage: number) => void
  theme?: ReaderTheme
  isImmersiveFullscreen?: boolean
  /** This book's unique random climax apex (75..85); drives crimson peak. */
  climaxTarget?: number
  /** Active state for the one-time 3-pulse crimson lightsaber bar glow. */
  isSaberGlowing?: boolean
  onSaberGlowEnd?: () => void
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
  onPageChange,
  theme = 'night',
  isImmersiveFullscreen = false,
  climaxTarget,
  isSaberGlowing = false,
  onSaberGlowEnd
}) => {
  const [isHovered, setIsHovered] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [hoverPercent, setHoverPercent] = useState<number | null>(null)
  const [dragPercent, setDragPercent] = useState<number | null>(null)
  const [isEditingPage, setIsEditingPage] = useState(false)
  const [pageInputVal, setPageInputVal] = useState('')
  const pageInputRef = useRef<HTMLInputElement>(null)
  const dragPercentRef = useRef<number | null>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const cachedTrackRectRef = useRef<DOMRect | null>(null)
  const rafDragRef = useRef<number | null>(null)
  const rafHoverRef = useRef<number | null>(null)

  // Clear cached bounding rect on window resize
  useEffect(() => {
    const handleResize = () => {
      cachedTrackRectRef.current = null
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

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

  useEffect(() => {
    if (isEditingPage) {
      setPageInputVal(String(displayedEndPage))
      setTimeout(() => {
        if (pageInputRef.current) {
          pageInputRef.current.focus()
          pageInputRef.current.select()
        }
      }, 30)
    }
  }, [isEditingPage, displayedEndPage])

  const handlePageCommit = useCallback(() => {
    const parsed = parseInt(pageInputVal.trim(), 10)
    if (Number.isFinite(parsed) && parsed >= 1 && parsed <= safeTotal) {
      if (onPageChange) {
        onPageChange(parsed)
      } else {
        const pct = safeTotal > 1 ? ((parsed - 1) / (safeTotal - 1)) * 100 : 0
        onSeek(pct)
      }
    }
    setIsEditingPage(false)
  }, [pageInputVal, safeTotal, onPageChange, onSeek])

  const handlePageKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      e.stopPropagation()
      handlePageCommit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      setIsEditingPage(false)
    }
  }

  // Narrative Climax Chromatic Calculation
  // Centers crimson peak on this book's own random 75%–85% climax target
  const { fluidColor, glowColor, climaxIntensity } = useMemo(() => {
    const p = activeFluidPct
    const climaxApex =
      typeof climaxTarget === 'number' && climaxTarget >= 75 && climaxTarget <= 85
        ? climaxTarget
        : 80
    const sigma = 12
    const climaxWeight = Math.exp(-Math.pow(p - climaxApex, 2) / (2 * Math.pow(sigma, 2)))

    const CLIMAX_RED_HUE = 358 // Pure Crimson / Ruby Red
    let currentHue: number

    if (p <= climaxApex) {
      const t = Math.min(1, Math.max(0, p / climaxApex))
      currentHue = interpolateHue(startHue, CLIMAX_RED_HUE, Math.max(t * 0.65, climaxWeight))
    } else {
      const t = Math.min(1, Math.max(0, (p - climaxApex) / (100 - climaxApex)))
      currentHue = interpolateHue(CLIMAX_RED_HUE, endHue, Math.min(1, (1 - climaxWeight) * Math.min(1, t * 1.25)))
    }

    // Calmed, literary saturation & lightness to avoid visual distraction
    const saturation = Math.round(38 + climaxWeight * 16)
    const lightness = Math.round(42 + climaxWeight * 6)

    const color = `hsl(${Math.round(currentHue)}, ${saturation}%, ${lightness}%)`
    const glow = `hsla(${Math.round(currentHue)}, ${saturation}%, ${lightness}%, ${Math.max(0.08, climaxWeight * 0.28).toFixed(2)})`

    return {
      fluidColor: color,
      glowColor: glow,
      climaxIntensity: climaxWeight
    }
  }, [activeFluidPct, startHue, endHue, climaxTarget])

  // Track scrubber calculation with 0.1% precision and cached bounding box to prevent layout thrashing
  const getTrackRect = useCallback((): DOMRect | null => {
    if (!trackRef.current) return null
    if (!cachedTrackRectRef.current) {
      cachedTrackRectRef.current = trackRef.current.getBoundingClientRect()
    }
    return cachedTrackRectRef.current
  }, [])

  const calculatePercentFromClientX = useCallback(
    (clientX: number) => {
      const rect = getTrackRect()
      if (!rect || rect.width <= 0) return 0
      const x = clientX - rect.left
      const rawPct = (x / rect.width) * 100
      return Math.max(0, Math.min(100, Math.round(rawPct * 10) / 10))
    },
    [getTrackRect]
  )

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return
      e.preventDefault()
      // Refresh cached track rect at drag start
      cachedTrackRectRef.current = trackRef.current?.getBoundingClientRect() || null
      const targetPct = calculatePercentFromClientX(e.clientX)
      dragPercentRef.current = targetPct
      setIsDragging(true)
      setDragPercent(targetPct)
      setHoverPercent(targetPct)
    },
    [calculatePercentFromClientX]
  )

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      const targetPct = calculatePercentFromClientX(e.clientX)
      dragPercentRef.current = targetPct
      if (rafDragRef.current === null) {
        rafDragRef.current = requestAnimationFrame(() => {
          rafDragRef.current = null
          if (dragPercentRef.current !== null) {
            setDragPercent(dragPercentRef.current)
            setHoverPercent(dragPercentRef.current)
          }
        })
      }
    }

    const handleMouseUp = (e: MouseEvent) => {
      if (rafDragRef.current !== null) {
        cancelAnimationFrame(rafDragRef.current)
        rafDragRef.current = null
      }
      const finalPct = dragPercentRef.current ?? calculatePercentFromClientX(e.clientX)
      dragPercentRef.current = null
      cachedTrackRectRef.current = null
      setIsDragging(false)
      setDragPercent(null)
      setHoverPercent(null)
      onSeek(finalPct)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      if (rafDragRef.current !== null) {
        cancelAnimationFrame(rafDragRef.current)
        rafDragRef.current = null
      }
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, calculatePercentFromClientX, onSeek])

  const handleTrackMouseMove = (e: React.MouseEvent) => {
    if (isDragging) return
    const clientX = e.clientX
    if (rafHoverRef.current === null) {
      rafHoverRef.current = requestAnimationFrame(() => {
        rafHoverRef.current = null
        setHoverPercent(calculatePercentFromClientX(clientX))
      })
    }
  }

  // Theme-aware glass capillary borders & track
  const isLightMode = theme === 'day' || theme === 'light-sepia'
  const tubeBorderColor = isLightMode ? 'rgba(0, 0, 0, 0.14)' : 'rgba(255, 255, 255, 0.12)'
  const tubeTrackBg = isLightMode ? 'rgba(0, 0, 0, 0.07)' : 'rgba(255, 255, 255, 0.07)'
  const ghostLineClass = isLightMode ? 'bg-black/35' : 'bg-white/45'

  return (
    <footer
      onMouseEnter={() => {
        setIsHovered(true)
        cachedTrackRectRef.current = trackRef.current?.getBoundingClientRect() || null
      }}
      onMouseLeave={() => {
        if (rafHoverRef.current !== null) {
          cancelAnimationFrame(rafHoverRef.current)
          rafHoverRef.current = null
        }
        if (!isDragging) {
          setIsHovered(false)
          setHoverPercent(null)
          cachedTrackRectRef.current = null
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
        {/* Unclipped Wrapper hosting both the Capillary Tube and the Lightsaber Aura */}
        <div className="w-full relative flex items-center">
          {/* Unclipped 3-Pulse Crimson Lightsaber Bloom Layer (one-time Easter egg) */}
          {isSaberGlowing && activeFluidPct > 0 && (
            <div
              aria-hidden="true"
              data-preserve-theme="true"
              onAnimationEnd={() => onSaberGlowEnd?.()}
              className={`absolute left-0 inset-y-0 my-auto rounded-full pointer-events-none z-20 ${
                isHovered || isDragging ? 'h-2' : 'h-[6px]'
              } ${isLightMode ? 'climax-saber-aura-light' : 'climax-saber-aura'}`}
              style={{
                width: `${activeFluidPct}%`
              }}
            />
          )}

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
              data-preserve-theme={isSaberGlowing ? 'true' : undefined}
              className={`h-full rounded-full relative ${
                isDragging ? 'transition-none' : 'transition-[width] duration-150 ease-out'
              } ${isSaberGlowing ? 'climax-saber-core' : ''}`}
              style={{
                width: `${activeFluidPct}%`,
                backgroundColor: isSaberGlowing ? '#ff1e2d' : fluidColor,
                boxShadow: isSaberGlowing
                  ? 'inset 0 0 3px #ffffff, 0 0 14px rgba(255, 24, 42, 0.95)'
                  : `0 0 ${Math.round(2 + climaxIntensity * 3)}px ${glowColor}`
              }}
            >
              {/* Top Cylindrical Liquid Specular Sheen */}
              <div
                className="absolute inset-x-0 top-0 h-[45%] rounded-t-full pointer-events-none opacity-40"
                style={{
                  background: isSaberGlowing
                    ? 'linear-gradient(to bottom, rgba(255,255,255,0.95) 0%, rgba(255,210,218,0.45) 100%)'
                    : 'linear-gradient(to bottom, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.05) 100%)'
                }}
              />

              {/* Leading Liquid Meniscus Surface Tension Bulb */}
              {activeFluidPct > 0 && (
                <div
                  className="absolute right-0 top-1/2 -translate-y-1/2 rounded-full pointer-events-none transition-all duration-150"
                  style={{
                    width: isHovered || isDragging || isSaberGlowing ? '5px' : '3.5px',
                    height: isHovered || isDragging || isSaberGlowing ? '5px' : '3.5px',
                    backgroundColor: isSaberGlowing
                      ? '#ffffff'
                      : isLightMode
                        ? fluidColor
                        : 'rgba(255,255,255,0.85)',
                    boxShadow: isSaberGlowing
                      ? '0 0 8px #ffffff, 0 0 14px #ff1e2d'
                      : isLightMode
                        ? `0 0 0 1px rgba(255,255,255,0.65), 0 0 3px ${glowColor}`
                        : `0 0 3px ${glowColor}`,
                    opacity: 0.85
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

      {/* Crisp, Non-Muted, Theme-Adaptive Interactive Page Counter at End of Progress Bar */}
      <div
        className="shrink-0 text-[12px] font-mono font-semibold tabular-nums leading-none text-[var(--app-text-strong)] tracking-tight flex items-center gap-1"
        title={`Page ${displayedEndPage} of ${safeTotal} (${Math.round(activeFluidPct)}%)`}
      >
        {isEditingPage ? (
          <input
            ref={pageInputRef}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={pageInputVal}
            onChange={(e) => setPageInputVal(e.target.value.replace(/[^0-9]/g, ''))}
            onKeyDown={handlePageKeyDown}
            onBlur={handlePageCommit}
            className={`w-11 h-6 px-1 text-center text-[12px] font-mono font-bold rounded outline-none border transition-all ${
              isLightMode
                ? 'bg-neutral-900 text-white border-neutral-900 selection:bg-white selection:text-neutral-900 shadow-md'
                : 'bg-white text-black border-white selection:bg-black selection:text-white shadow-md'
            }`}
            aria-label="Go to page"
          />
        ) : (
          <button
            type="button"
            onClick={() => setIsEditingPage(true)}
            className="inline-flex items-center justify-center px-1.5 py-0.5 rounded border border-white/20 dark:border-white/20 hover:border-[var(--app-accent)] bg-black/10 dark:bg-white/10 hover:bg-black/20 dark:hover:bg-white/20 text-[var(--app-text-strong)] cursor-pointer transition-all duration-150 shadow-2xs font-mono font-semibold text-[12px]"
            title="Click to go to page"
            aria-label={`Current page ${displayedEndPage}. Click to jump to page`}
          >
            {displayedEndPage}
          </button>
        )}
        <span className="text-[var(--app-text-muted)] opacity-60">/</span>
        <span>{safeTotal}</span>
      </div>
    </footer>
  )
}
