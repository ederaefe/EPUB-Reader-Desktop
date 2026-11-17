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
      const zoneWidth = Math.min(220, width * 0.22)
      if (clientX <= zoneWidth) {
        setVisibleSide('left')
      } else if (clientX >= width - zoneWidth) {
        setVisibleSide('right')
      } else {
        setVisibleSide(null)
      }
    }

    const handleMouseMove = (e: MouseEvent) => {
      updateFromClientX(e.clientX)
    }

    // Listen to pointer X forwarded from isolated EPUB iframes
    const handleIframePointer = (e: Event) => {
      const detail = (e as CustomEvent<{ clientX: number }>).detail
      if (detail && typeof detail.clientX === 'number') {
        updateFromClientX(detail.clientX)
      }
    }

    const handleMouseLeave = () => {
      setVisibleSide(null)
    }

    window.addEventListener('mousemove', handleMouseMove, { passive: true })
    window.addEventListener('semply:reader-pointer', handleIframePointer)
    document.addEventListener('mouseleave', handleMouseLeave)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('semply:reader-pointer', handleIframePointer)
      document.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [hidden])

  if (hidden || !visibleSide) return null

  const buttonStyle =
    'absolute top-1/2 -translate-y-1/2 z-30 w-10 h-14 rounded-full flex items-center justify-center bg-[var(--app-surface)]/85 hover:bg-[var(--app-surface-hover)] border border-[var(--app-border-strong)] text-[var(--app-text-muted)] hover:text-[var(--app-text-strong)] shadow-md backdrop-blur-sm transition-all duration-150 cursor-pointer app-no-drag'

  return (
    <>
      {visibleSide === 'left' && !isLeftDisabled && (
        <button
          type="button"
          onClick={onPrev}
          className={`${buttonStyle} left-3`}
          aria-label="Previous Page"
          title="Previous Page (Left Arrow / Page Up)"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      )}
      {visibleSide === 'right' && !isRightDisabled && (
        <button
          type="button"
          onClick={onNext}
          className={`${buttonStyle} right-3`}
          aria-label="Next Page"
          title="Next Page (Right Arrow / Space / Page Down)"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      )}
    </>
  )
}
