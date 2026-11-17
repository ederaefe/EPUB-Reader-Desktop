import React, { useState, useEffect, useRef, useMemo } from 'react'
import { Play, Pause, RotateCcw, ChevronLeft, ChevronRight, X, Gauge } from 'lucide-react'
import { useAppStore } from '../../stores/useAppStore'

interface RSVPSpeedReaderModalProps {
  isOpen: boolean
  onClose: () => void
  initialText: string
  title?: string
}

function getOrpIndex(word: string): number {
  const len = word.length
  if (len <= 1) return 0
  if (len <= 5) return 1
  if (len <= 9) return 2
  if (len <= 13) return 3
  return 4
}

export const RSVPSpeedReaderModal: React.FC<RSVPSpeedReaderModalProps> = ({
  isOpen,
  onClose,
  initialText,
  title = 'Speed Reading Mode'
}) => {
  const { settings, updateSettings } = useAppStore()

  const words = useMemo(() => {
    return initialText
      .replace(/[\r\n\t]+/g, ' ')
      .split(/\s+/)
      .map((w) => w.trim())
      .filter((w) => w.length > 0)
  }, [initialText])

  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [wpm, setWpm] = useState(settings.rsvpWpm || 350)
  const timerRef = useRef<number | null>(null)

  // Reset index when changing chapters or text
  useEffect(() => {
    setCurrentIndex(0)
    setIsPlaying(false)
  }, [initialText])

  const currentWord = words[currentIndex] || ''

  // Optimal Recognition Point breakdown
  const orpIndex = getOrpIndex(currentWord)
  const prefix = currentWord.slice(0, orpIndex)
  const orpChar = currentWord[orpIndex] || ''
  const suffix = currentWord.slice(orpIndex + 1)

  // Interval timer for playback
  useEffect(() => {
    if (!isPlaying || words.length === 0) {
      if (timerRef.current) clearInterval(timerRef.current)
      return
    }

    const intervalMs = Math.round((60 / wpm) * 1000)

    timerRef.current = window.setInterval(() => {
      setCurrentIndex((prev) => {
        if (prev >= words.length - 1) {
          setIsPlaying(false)
          return prev
        }
        return prev + 1
      })
    }, intervalMs)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isPlaying, wpm, words.length])

  // Keyboard navigation: Space = Play/Pause, Left = -10, Right = +10, Esc = Close
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault()
        setIsPlaying((p) => !p)
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setCurrentIndex((i) => Math.max(0, i - 10))
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        setCurrentIndex((i) => Math.min(words.length - 1, i + 10))
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, words.length, onClose])

  if (!isOpen) return null

  const progressPercent = words.length > 0 ? Math.round(((currentIndex + 1) / words.length) * 100) : 0

  const handleWpmChange = (newWpm: number) => {
    setWpm(newWpm)
    updateSettings({ rsvpWpm: newWpm })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md select-none p-4">
      <div className="w-[680px] bg-[#171a21] border border-[#2d323f] rounded-[3px] shadow-2xl overflow-hidden flex flex-col text-[#c9d1d9] animate-in fade-in zoom-in-95 duration-150">
        {/* Top Header */}
        <div className="h-10 bg-[#14161c] border-b border-[#232732] px-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gauge className="w-4 h-4 text-[#2a69df]" />
            <span className="text-[13px] font-semibold text-white">RSVP Speed Reader</span>
            <span className="text-[11px] text-[#8b949e]">({title})</span>
          </div>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center text-[#8b949e] hover:text-white hover:bg-[#282c37] rounded-[2px]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Center RSVP Display with Optical Guides */}
        <div className="h-56 bg-[#111318] flex flex-col items-center justify-center relative px-8">
          {/* Vertical Optical Guide Markers */}
          <div className="absolute top-4 bottom-4 w-px bg-[#2a69df]/20 pointer-events-none" />
          <div className="absolute top-2 w-2 h-1 bg-[#2a69df] rounded-b pointer-events-none" />
          <div className="absolute bottom-2 w-2 h-1 bg-[#2a69df] rounded-t pointer-events-none" />

          {/* Focal Word Anchor */}
          <div className="flex items-baseline font-mono text-3xl font-bold tracking-tight">
            {/* Prefix: right aligned */}
            <span className="text-right w-44 text-[#e6edf3] select-none truncate">
              {prefix}
            </span>
            {/* Focal ORP Character: Centered and Vivid Crimson/Amber */}
            <span className="w-7 text-center text-[#ff4d4f] font-black underline decoration-2 decoration-[#ff4d4f]/40 underline-offset-4">
              {orpChar || '-'}
            </span>
            {/* Suffix: left aligned */}
            <span className="text-left w-44 text-[#e6edf3] select-none truncate">
              {suffix}
            </span>
          </div>

          {/* Word metric */}
          <div className="mt-8 text-[11px] font-mono text-[#8b949e] flex items-center gap-3">
            <span>Word {currentIndex + 1} of {words.length || 1}</span>
            <span>|</span>
            <span>{progressPercent}% Complete</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-[#1e222b] h-1.5 relative">
          <div
            className="h-full bg-[#2a69df] transition-all duration-100"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Bottom Control Strip */}
        <div className="p-4 bg-[#14161c] border-t border-[#232732] flex flex-col gap-3">
          <div className="flex items-center justify-between">
            {/* Playback Controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentIndex((i) => Math.max(0, i - 10))}
                className="ice-btn-dark px-2.5 h-8 flex items-center gap-1 rounded-[2px]"
                title="Rewind 10 words (Left Arrow)"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>-10</span>
              </button>

              <button
                onClick={() => setIsPlaying((p) => !p)}
                className={`px-4 h-8 flex items-center gap-1.5 rounded-[2px] font-medium transition-colors ${
                  isPlaying ? 'bg-[#2a69df] text-white' : 'ice-btn-blue'
                }`}
                title="Play/Pause (Space)"
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                <span>{isPlaying ? 'Pause' : 'Start'}</span>
              </button>

              <button
                onClick={() => setCurrentIndex((i) => Math.min(words.length - 1, i + 10))}
                className="ice-btn-dark px-2.5 h-8 flex items-center gap-1 rounded-[2px]"
                title="Forward 10 words (Right Arrow)"
              >
                <span>+10</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => {
                  setIsPlaying(false)
                  setCurrentIndex(0)
                }}
                className="ice-btn-dark p-2 h-8 rounded-[2px]"
                title="Restart from beginning"
              >
                <RotateCcw className="w-3.5 h-3.5 text-[#8b949e]" />
              </button>
            </div>

            {/* WPM Velocity Slider */}
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-[#8b949e]">Speed:</span>
              <input
                type="range"
                min="150"
                max="1200"
                step="25"
                value={wpm}
                onChange={(e) => handleWpmChange(Number(e.target.value))}
                className="w-36 accent-[#2a69df] h-1 bg-[#323744] rounded cursor-pointer"
              />
              <span className="font-mono text-white text-xs w-16 text-right font-semibold">
                {wpm} WPM
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
