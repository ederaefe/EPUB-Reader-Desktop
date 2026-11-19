import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Play, Pause, Square, Minus, Maximize2 } from 'lucide-react'

interface ReaderAudioHUDProps {
  isTTSActive: boolean
  isTTSMuted: boolean
  currentChapter?: string
  ttsSpeed?: number
  onTogglePlay: () => void
  onStop: () => void
}

export const ReaderAudioHUD: React.FC<ReaderAudioHUDProps> = ({
  isTTSActive,
  isTTSMuted,
  currentChapter,
  ttsSpeed = 1,
  onTogglePlay,
  onStop
}) => {
  const [isMinimized, setIsMinimized] = useState(false)
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const hudRef = useRef<HTMLDivElement>(null)
  const dragStartRef = useRef<{ pointerX: number; pointerY: number; hudX: number; hudY: number }>({
    pointerX: 0,
    pointerY: 0,
    hudX: 0,
    hudY: 0
  })

  // Center near bottom-center initially
  useEffect(() => {
    if (!position && typeof window !== 'undefined') {
      const defaultY = Math.max(80, window.innerHeight - 90)
      const defaultX = Math.max(20, Math.round(window.innerWidth / 2 - 130))
      setPosition({ x: defaultX, y: defaultY })
    }
  }, [position])

  // Drag physics with screen boundary clamping
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return
    e.preventDefault()
    setIsDragging(true)
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)

    dragStartRef.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      hudX: position?.x ?? 0,
      hudY: position?.y ?? 0
    }
  }, [position])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return
    const dx = e.clientX - dragStartRef.current.pointerX
    const dy = e.clientY - dragStartRef.current.pointerY

    const maxX = Math.max(10, window.innerWidth - (hudRef.current?.offsetWidth || 260) - 10)
    const maxY = Math.max(10, window.innerHeight - (hudRef.current?.offsetHeight || 44) - 10)

    const nextX = Math.max(10, Math.min(maxX, dragStartRef.current.hudX + dx))
    const nextY = Math.max(10, Math.min(maxY, dragStartRef.current.hudY + dy))

    setPosition({ x: nextX, y: nextY })
  }, [isDragging])

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (isDragging) {
      setIsDragging(false)
      try {
        ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
      } catch {
        // Ignore if pointer capture was already released
      }
    }
  }, [isDragging])

  if (!isTTSActive || !position) return null

  return (
    <div
      ref={hudRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{
        transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
        touchAction: 'none'
      }}
      className={`fixed top-0 left-0 z-50 select-none transition-shadow ${
        isDragging ? 'cursor-grabbing opacity-95 scale-[1.02]' : 'cursor-grab'
      }`}
      role="region"
      aria-label="Read Aloud Controller"
    >
      {isMinimized ? (
        /* Minimized Capsule: 28px height, ultra-compact */
        <div className="flex items-center gap-2 px-2.5 py-1.5 bg-[#121316]/95 backdrop-blur-md border border-white/10 rounded-full shadow-[0_12px_36px_rgba(0,0,0,0.7)] text-[#ededed] hover:border-white/20 transition-all">
          <div className="flex items-center gap-0.5 h-3">
            <span
              className={`w-1 rounded-full bg-[#58a6ff] transition-all duration-300 ${
                isTTSMuted ? 'h-1.5 opacity-40' : 'h-3 animate-pulse'
              }`}
            />
            <span
              className={`w-1 rounded-full bg-[#58a6ff] transition-all duration-300 ${
                isTTSMuted ? 'h-2 opacity-40' : 'h-2 animate-bounce'
              }`}
            />
          </div>
          <button
            type="button"
            onClick={onTogglePlay}
            className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-white/10 text-white transition-colors cursor-pointer"
            title={isTTSMuted ? 'Resume (F7)' : 'Pause (F7)'}
          >
            {isTTSMuted ? <Play className="w-2.5 h-2.5 fill-current" /> : <Pause className="w-2.5 h-2.5 fill-current" />}
          </button>
          <button
            type="button"
            onClick={() => setIsMinimized(false)}
            className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-white/10 text-[#888888] hover:text-white transition-colors cursor-pointer"
            title="Expand Read Aloud"
          >
            <Maximize2 className="w-2.5 h-2.5" />
          </button>
        </div>
      ) : (
        /* Expanded HUD Pill */
        <div className="flex items-center gap-3 px-3.5 py-2 bg-[#121316]/95 backdrop-blur-md border border-white/10 rounded-full shadow-[0_16px_48px_rgba(0,0,0,0.75)] text-[#ededed] animate-in fade-in zoom-in-95 duration-150">
          {/* Animated Equalizer Wave */}
          <div className="flex items-end gap-0.5 h-3.5 px-0.5" title={isTTSMuted ? 'Paused' : 'Playing'}>
            <span
              className={`w-0.5 rounded-full bg-[#58a6ff] transition-all duration-200 ${
                isTTSMuted ? 'h-1 bg-[#888888]' : 'h-3 animate-pulse'
              }`}
            />
            <span
              className={`w-0.5 rounded-full bg-[#58a6ff] transition-all duration-200 ${
                isTTSMuted ? 'h-1.5 bg-[#888888]' : 'h-3.5 animate-bounce'
              }`}
            />
            <span
              className={`w-0.5 rounded-full bg-[#58a6ff] transition-all duration-200 ${
                isTTSMuted ? 'h-1 bg-[#888888]' : 'h-2 animate-pulse'
              }`}
            />
          </div>

          {/* Context / Status info */}
          <div className="flex flex-col min-w-0 pr-1 max-w-[130px]">
            <span className="text-[11px] font-medium text-white leading-tight truncate">
              {isTTSMuted ? 'Paused' : 'Reading Aloud'}
            </span>
            {currentChapter && (
              <span className="text-[9px] text-[#888888] truncate leading-tight">
                {currentChapter}
              </span>
            )}
          </div>

          {/* Speed chip */}
          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/[0.06] text-[#8b949e]">
            {ttsSpeed}x
          </span>

          {/* Action Controls */}
          <div className="flex items-center gap-1 border-l border-white/10 pl-2">
            <button
              type="button"
              onClick={onTogglePlay}
              className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/10 text-white transition-colors cursor-pointer"
              title={isTTSMuted ? 'Resume (F7)' : 'Pause (F7)'}
            >
              {isTTSMuted ? <Play className="w-3 h-3 fill-current ml-0.5" /> : <Pause className="w-3 h-3 fill-current" />}
            </button>
            <button
              type="button"
              onClick={onStop}
              className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-[#f85149]/20 text-[#888888] hover:text-[#f85149] transition-colors cursor-pointer"
              title="Stop Read Aloud (F8)"
            >
              <Square className="w-2.5 h-2.5 fill-current" />
            </button>
            <button
              type="button"
              onClick={() => setIsMinimized(true)}
              className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/10 text-[#888888] hover:text-white transition-colors cursor-pointer"
              title="Minimize pill"
            >
              <Minus className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
