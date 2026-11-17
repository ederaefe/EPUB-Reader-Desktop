import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import type { Book } from '../../db'
import type { ReaderTheme } from '../ui/ThemePickerGrid'

interface FluidClimaxProgressBarProps {
  progressPercent: number
  currentPage?: number
  totalPages?: number
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
  const trackRef = useRef<HTMLDivElement>(null)

  // Seed palette calculation (cached per book)
  const { startHue, endHue } = useMemo(() => {
    const seed = getBookSeed(book)
    const sIdx = seed % PALETTE_START_HUES.length
    const eIdx = (Math.floor(seed / 13)) % PALETTE_END_HUES.length
    return {
      startHue: PALETTE_START_HUES[sIdx],
      endHue: PALETTE_END_HUES[eIdx]
    }
  }, [book?.id, book?.title, book?.author])

  // Normalized clamped reading percentage
  const currentPct = Math.max(0, Math.min(100, Math.round(progressPercent || 0)))
  const displayPct = hoverPercent !== null ? hoverPercent : currentPct

  // Narrative Climax Chromatic Calculation
  // Climax apex = 58% (standard narrative midpoint), spread sigma = 14%
  const { fluidColor, glowColor, climaxIntensity } = useMemo(() => {
    const p = currentPct
    const climaxApex = 58
    const sigma = 14
    // Gaussian intensity curve (0.0 to 1.0)
    const climaxWeight = Math.exp(-Math.pow(p - climaxApex, 2) / (2 * Math.pow(sigma, 2)))

    const CLIMAX_RED_HUE = 358 // Pure Crimson / Ruby Red
    let currentHue: number

    if (p <= climaxApex) {
      // Transition from startHue towards Climax Red
      const t = Math.min(1, Math.max(0, p / climaxApex))
      currentHue = interpolateHue(startHue, CLIMAX_RED_HUE, Math.max(t * 0.7, climaxWeight))
    } else {
      // Transition from Climax Red towards endHue
      const t = Math.min(1, Math.max(0, (p - climaxApex) / (100 - climaxApex)))
      currentHue = interpolateHue(CLIMAX_RED_HUE, endHue, (1 - climaxWeight) * t)
    }

    // Dynamic saturation and lightness based on climax intensity
    const saturation = Math.round(75 + climaxWeight * 22) // 75% to 97%
    const lightness = Math.round(48 + climaxWeight * 8)    // 48% to 56%

    const color = `hsl(${Math.round(currentHue)}, ${saturation}%, ${lightness}%)`
    const glow = `hsla(${Math.round(currentHue)}, ${saturation}%, ${lightness}%, ${Math.max(0.2, climaxWeight * 0.75).toFixed(2)})`

    return {
      fluidColor: color,
      glowColor: glow,
      climaxIntensity: climaxWeight
    }
  }, [currentPct, startHue, endHue])

  // Track scrubber calculation
  const calculatePercentFromEvent = useCallback((e: MouseEvent | React.MouseEvent) => {
    if (!trackRef.current) return 0
    const rect = trackRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const rawPct = (x / rect.width) * 100
    return Math.max(0, Math.min(100, Math.round(rawPct)))
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    const targetPct = calculatePercentFromEvent(e)
    setHoverPercent(targetPct)
    onSeek(targetPct)
  }, [calculatePercentFromEvent, onSeek])

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      const targetPct = calculatePercentFromEvent(e)
      setHoverPercent(targetPct)
      onSeek(targetPct)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      setHoverPercent(null)
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

  // Theme-aware glass capillary borders & ambient background
  const isLightMode = theme === 'day' || theme === 'light-sepia'
  const tubeBorderColor = isLightMode
    ? 'rgba(0, 0, 0, 0.12)'
    : 'rgba(255, 255, 255, 0.10)'
  const tubeTrackBg = isLightMode
    ? 'rgba(0, 0, 0, 0.05)'
    : 'rgba(255, 255, 255, 0.05)'

  return (
    <footer
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        if (!isDragging) {
          setIsHovered(false)
          setHoverPercent(null)
        }
      }}
      className={`w-full relative select-none transition-all duration-300 z-30 flex flex-col justify-end ${
        isImmersiveFullscreen ? 'h-6 pb-1' : 'h-8 pb-2'
      } px-6`}
    >
      {/* Delicate Glass Capillary Tube Container */}
      <div
        ref={trackRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleTrackMouseMove}
        className="w-full relative cursor-pointer py-1.5 flex items-center group"
      >
        {/* Outer Capillary Glass Tube */}
        <div
          className={`w-full rounded-full relative overflow-hidden transition-all duration-200 ${
            isHovered || isDragging ? 'h-2' : 'h-[4px]'
          }`}
          style={{
            backgroundColor: tubeTrackBg,
            boxShadow: isLightMode
              ? 'inset 0 1px 1px rgba(0,0,0,0.06), 0 0 0 0.5px rgba(0,0,0,0.08)'
              : 'inset 0 1px 1px rgba(255,255,255,0.12), inset 0 -1px 1px rgba(0,0,0,0.35), 0 0 0 0.5px rgba(255,255,255,0.08)',
            border: `0.5px solid ${tubeBorderColor}`
          }}
        >
          {/* Inner Fluid Column */}
          <div
            className="h-full rounded-full relative transition-[width] duration-150 ease-out"
            style={{
              width: `${currentPct}%`,
              backgroundColor: fluidColor,
              boxShadow: `0 0 ${Math.round(4 + climaxIntensity * 8)}px ${glowColor}`
            }}
          >
            {/* Top Cylindrical Liquid Specular Sheen (simulates water in a glass tube) */}
            <div
              className="absolute inset-x-0 top-0 h-[45%] rounded-t-full pointer-events-none opacity-60"
              style={{
                background: 'linear-gradient(to bottom, rgba(255,255,255,0.65) 0%, rgba(255,255,255,0.1) 100%)'
              }}
            />

            {/* Leading Liquid Meniscus Surface Tension Bulb */}
            {currentPct > 0 && (
              <div
                className="absolute right-0 top-1/2 -translate-y-1/2 rounded-full pointer-events-none transition-all duration-200"
                style={{
                  width: isHovered || isDragging ? '6px' : '4px',
                  height: isHovered || isDragging ? '6px' : '4px',
                  backgroundColor: '#ffffff',
                  boxShadow: `0 0 6px ${glowColor}, 0 0 2px #ffffff`,
                  opacity: 0.9
                }}
              />
            )}
          </div>

          {/* Ghost Scrubber on Hover */}
          {(isHovered || isDragging) && hoverPercent !== null && (
            <div
              className="absolute top-0 bottom-0 pointer-events-none w-0.5 bg-white/40 z-10"
              style={{ left: `${hoverPercent}%` }}
            />
          )}
        </div>

        {/* Minimal percentage indicator on hover/drag (subtle, text-free) */}
        {(isHovered || isDragging) && hoverPercent !== null && (
          <div
            className="absolute -top-7 -translate-x-1/2 pointer-events-none z-40 bg-[#16181f]/95 border border-white/10 text-white text-[11px] font-mono px-2 py-0.5 rounded shadow-lg backdrop-blur-md animate-in fade-in zoom-in-95 duration-100"
            style={{
              left: `${displayPct}%`
            }}
          >
            {displayPct}%
          </div>
        )}
      </div>
    </footer>
  )
}
