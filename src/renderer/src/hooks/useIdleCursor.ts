import { useEffect, useRef, useState } from 'react'

interface UseIdleCursorOptions {
  timeoutMs?: number
  disabled?: boolean
  onIdleChange?: (isIdle: boolean) => void
}

/**
 * High-performance, zero-CPU idle cursor suppression hook.
 *
 * Guarantees zero unnecessary React re-renders:
 * - Maintains active state in a ref; `setState` only triggers on state transitions (active <-> idle).
 * - Mousemove events while already active bypass re-renders entirely and throttle timer re-arming
 *   to once per 500ms, completely avoiding event loop churn and CPU consumption.
 * - Automatically wakes up on any pointer movement, mouse click, keyboard press, or wheel scroll.
 */
export function useIdleCursor({
  timeoutMs = 10000,
  disabled = false,
  onIdleChange
}: UseIdleCursorOptions = {}) {
  const [isIdle, setIsIdle] = useState(false)
  const isIdleRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastActiveTimeRef = useRef(0)

  useEffect(() => {
    if (disabled) {
      if (isIdleRef.current) {
        isIdleRef.current = false
        setIsIdle(false)
        onIdleChange?.(false)
      }
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      return
    }

    const setIdleState = (idle: boolean) => {
      if (isIdleRef.current !== idle) {
        isIdleRef.current = idle
        setIsIdle(idle)
        onIdleChange?.(idle)
      }
    }

    const armTimer = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
      timerRef.current = setTimeout(() => {
        setIdleState(true)
      }, timeoutMs)
    }

    // High-velocity zero-overhead activity handler:
    // Wakes up immediately if sleeping; throttles reschedule calls if already awake.
    const handleUserActivity = () => {
      const now = performance.now()
      if (isIdleRef.current) {
        setIdleState(false)
        lastActiveTimeRef.current = now
        armTimer()
        return
      }

      // Throttle re-arming while already active (max once every 500ms)
      if (now - lastActiveTimeRef.current > 500) {
        lastActiveTimeRef.current = now
        armTimer()
      }
    }

    // Initial countdown start
    armTimer()

    const opts: AddEventListenerOptions = { passive: true }
    window.addEventListener('pointermove', handleUserActivity, opts)
    window.addEventListener('mousedown', handleUserActivity, opts)
    window.addEventListener('keydown', handleUserActivity, opts)
    window.addEventListener('wheel', handleUserActivity, opts)
    window.addEventListener('touchstart', handleUserActivity, opts)

    // Forwarded pointer activity from EPUB iframes
    const handleIframePointer = () => handleUserActivity()
    window.addEventListener('semply:reader-pointer', handleIframePointer)

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      window.removeEventListener('pointermove', handleUserActivity)
      window.removeEventListener('mousedown', handleUserActivity)
      window.removeEventListener('keydown', handleUserActivity)
      window.removeEventListener('wheel', handleUserActivity)
      window.removeEventListener('touchstart', handleUserActivity)
      window.removeEventListener('semply:reader-pointer', handleIframePointer)
    }
  }, [timeoutMs, disabled, onIdleChange])

  return isIdle
}
