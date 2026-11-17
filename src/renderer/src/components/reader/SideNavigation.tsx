import React, { useState, useEffect } from 'react'

interface SideNavigationProps {
  onPrev: () => void
  onNext: () => void
  isLeftDisabled: boolean
  isRightDisabled: boolean
}

export const SideNavigation: React.FC<SideNavigationProps> = ({
  onPrev,
  onNext,
  isLeftDisabled,
  isRightDisabled
}) => {
  const [isVisible, setIsVisible] = useState(false)

  // Only show navigation when mouse is in the side 30% zones
  const handleMouseMove = (e: MouseEvent) => {
    const width = window.innerWidth
    const x = e.clientX
    const zoneWidth = width * 0.3
    
    if (x < zoneWidth || x > width - zoneWidth) {
      setIsVisible(true)
    } else {
      setIsVisible(false)
    }
  }

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  if (!isVisible) return null

  const buttonStyle = "absolute top-1/2 -translate-y-1/2 p-4 rounded-full bg-black/10 hover:bg-black/20 backdrop-blur-sm transition-opacity duration-200"

  return (
    <>
      {!isLeftDisabled && (
        <button
          onClick={onPrev}
          className={`${buttonStyle} left-4`}
          aria-label="Previous"
        >
          <svg className="w-6 h-6 text-black/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}
      {!isRightDisabled && (
        <button
          onClick={onNext}
          className={`${buttonStyle} right-4`}
          aria-label="Next"
        >
          <svg className="w-6 h-6 text-black/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}
    </>
  )
}
