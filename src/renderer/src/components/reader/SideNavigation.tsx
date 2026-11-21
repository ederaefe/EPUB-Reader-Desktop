import React, { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface SideNavigationProps {
  onPrev: () => void
  onNext: () => void
  isLeftDisabled: boolean
  isRightDisabled: boolean
  hidden?: boolean
}

export const SideNavigation: React.FC<SideNavigationProps> = ({
  onPrev,
  onNext,
  isLeftDisabled,
  isRightDisabled,
  hidden = false
}) => {
  const [visibleSide, setVisibleSide] = useState<'left' | 'right' | null>(null)

  useEffect(() => {
    if (hidden) {
      setVisibleSide(null)
      return
    }

    const updateFromClientX = (clientX: number) => {
      const width = window.innerWidth
      const enterZone = 56
      const exitZone = 72
      if (clientX <= enterZone) {
        setVisibleSide('left')
      } else if (clientX >= width - enterZone) {
        setVisibleSide('right')
      } else if (clientX > exitZone && clientX < width - exitZone) {
        setVisibleSide(null)
      }
    }

    // Throttle edge navigation detection with 60ms delay to eliminate mouse tracking layout thrashing
    let throttleTimer: ReturnType<typeof setTimeout> | null = null
    let lastRan = 0
    let latestClientX: number | null = null
    const THROTTLE_MS = 60

    const throttledUpdate = (clientX: number) => {
      latestClientX = clientX
      const now = performance.now()
      if (now - lastRan >= THROTTLE_MS) {
        lastRan = now
        if (throttleTimer) {
          clearTimeout(throttleTimer)
          throttleTimer = null
        }
        updateFromClientX(clientX)
      } else if (!throttleTimer) {
        throttleTimer = setTimeout(() => {
          lastRan = performance.now()
          throttleTimer = null
          if (latestClientX !== null) {
            updateFromClientX(latestClientX)
          }
        }, THROTTLE_MS - (now - lastRan))
      }
    }

    const handleMouseMove = (e: MouseEvent) => {
      throttledUpdate(e.clientX)
    }

    // Listen to pointer X forwarded from isolated EPUB iframes
    const handleIframePointer = (e: Event) => {
      const detail = (e as CustomEvent<{ clientX: number }>).detail
      if (detail && typeof detail.clientX === 'number') {
        throttledUpdate(detail.clientX)
      }
    }

    const handleMouseLeave = () => {
      if (throttleTimer) {
        clearTimeout(throttleTimer)
        throttleTimer = null
      }
      latestClientX = null
      setVisibleSide(null)
    }

    window.addEventListener('mousemove', handleMouseMove, { passive: true })
    window.addEventListener('semply:reader-pointer', handleIframePointer)
    document.addEventListener('mouseleave', handleMouseLeave)

    return () => {
      if (throttleTimer) {
        clearTimeout(throttleTimer)
        throttleTimer = null
      }
      latestClientX = null
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('semply:reader-pointer', handleIframePointer)
      document.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [hidden])

  if (hidden || !visibleSide) return null

  const buttonStyle =
    'absolute top-1/2 -translate-y-1/2 z-30 p-2 flex items-center justify-center text-[var(--app-text-muted)] hover:text-[var(--app-text-strong)] opacity-35 hover:opacity-100 hover:scale-110 transition-all duration-150 cursor-pointer app-no-drag select-none'

  return (
    <>
      {visibleSide === 'left' && !isLeftDisabled && (
        <button
          type="button"
          onClick={onPrev}
          className={`${buttonStyle} left-2`}
          aria-label="Previous Page"
          title="Previous Page (Left Arrow / Page Up)"
        >
          <ChevronLeft className="w-6 h-6" strokeWidth={2.5} />
        </button>
      )}
      {visibleSide === 'right' && !isRightDisabled && (
        <button
          type="button"
          onClick={onNext}
          className={`${buttonStyle} right-2`}
          aria-label="Next Page"
          title="Next Page (Right Arrow / Space / Page Down)"
        >
          <ChevronRight className="w-6 h-6" strokeWidth={2.5} />
        </button>
      )}
    </>
  )
}
