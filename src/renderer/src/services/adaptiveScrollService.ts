// Adaptive Auto-Scroll Engine (AI / Cadence Learning)
// Implements mathematical model from advanced_feature_plan.md:
// - Rolling Exponential Moving Average (EMA, alpha = 0.15) for reading speed profiling
// - Dynamic scroll velocity calculation based on DOM block word density
// - Behavioral correction heuristics (back-scroll deceleration, forward nudge, idle suspension, micro-pauses)

export interface PacingMetrics {
  currentWpm: number
  targetWpm: number
  observedWpm: number
  isPaused: boolean
  isMicroPausing: boolean
  currentVelocity: number // px/sec or ms per unit
}

export type PacingListener = (metrics: PacingMetrics) => void

export class AdaptiveScrollEngine {
  private alpha = 0.15 // EMA smoothing factor
  private currentWpm = 250
  private targetWpm = 250
  private observedWpm = 250
  private isPaused = false
  private isMicroPausing = false
  private currentVelocity = 40 // px/sec baseline

  private lastScrollTime = 0
  private lastScrollY = 0
  private lastWordCount = 0

  private listeners: Set<PacingListener> = new Set()
  private timer: number | null = null
  private animationFrameId: number | null = null

  constructor(initialWpm = 250) {
    this.currentWpm = initialWpm
    this.targetWpm = initialWpm
    this.observedWpm = initialWpm
  }

  public subscribe(listener: PacingListener): () => void {
    this.listeners.add(listener)
    this.notify()
    return () => this.listeners.delete(listener)
  }

  private notify(): void {
    const metrics: PacingMetrics = {
      currentWpm: Math.round(this.currentWpm),
      targetWpm: Math.round(this.targetWpm),
      observedWpm: Math.round(this.observedWpm),
      isPaused: this.isPaused,
      isMicroPausing: this.isMicroPausing,
      currentVelocity: Math.round(this.currentVelocity)
    }
    this.listeners.forEach((l) => l(metrics))
  }

  // Record observed manual reading speed
  public recordManualReading(wordCount: number, elapsedMs: number): void {
    if (elapsedMs <= 500 || wordCount <= 0) return
    const elapsedMinutes = elapsedMs / 60000
    const rawObserved = wordCount / elapsedMinutes

    // Clamp between realistic bounds (80 - 1200 WPM)
    this.observedWpm = Math.max(80, Math.min(1200, rawObserved))

    // Apply EMA: WPM_current = alpha * WPM_observed + (1 - alpha) * WPM_previous
    this.currentWpm = this.alpha * this.observedWpm + (1 - this.alpha) * this.currentWpm
    this.notify()
  }

  // Behavioral Heuristic 1: Back-Scroll Detection
  // If the user scrolls upward against the auto-scroll direction, speed outpaced comprehension.
  public onBackScrollDetected(): void {
    this.targetWpm = Math.max(80, this.targetWpm * 0.85)
    this.currentWpm = this.alpha * this.targetWpm + (1 - this.alpha) * this.currentWpm
    this.notify()
  }

  // Behavioral Heuristic 2: Forward Nudge Detection
  // If the user taps down or presses down arrow, recognize eagerness and increment.
  public onForwardNudgeDetected(): void {
    this.targetWpm = Math.min(1200, this.targetWpm * 1.1)
    this.currentWpm = this.alpha * this.targetWpm + (1 - this.alpha) * this.currentWpm
    this.notify()
  }

  // Calculate dynamic velocity for an upcoming block
  // v_scroll(t) = (Words in Next Block / (WPM_current * 60)) * Block Height (px)
  public calculateBlockDurationMs(wordsInBlock: number): number {
    const effectiveWords = Math.max(5, wordsInBlock)
    const minutesNeeded = effectiveWords / Math.max(80, this.currentWpm)
    return Math.max(800, minutesNeeded * 60 * 1000)
  }

  // Introduce subtle 300ms cognitive micro-pause at section dividers, chapter ends, blockquotes
  public triggerMicroPause(callback?: () => void, durationMs = 300): void {
    this.isMicroPausing = true
    this.notify()
    setTimeout(() => {
      this.isMicroPausing = false
      this.notify()
      callback?.()
    }, durationMs)
  }

  public setPaused(paused: boolean): void {
    this.isPaused = paused
    this.notify()
  }

  public setTargetWpm(wpm: number): void {
    this.targetWpm = Math.max(80, Math.min(1200, wpm))
    this.currentWpm = this.targetWpm
    this.notify()
  }

  public getMetrics(): PacingMetrics {
    return {
      currentWpm: Math.round(this.currentWpm),
      targetWpm: Math.round(this.targetWpm),
      observedWpm: Math.round(this.observedWpm),
      isPaused: this.isPaused,
      isMicroPausing: this.isMicroPausing,
      currentVelocity: Math.round(this.currentVelocity)
    }
  }
}

export const adaptiveScrollEngine = new AdaptiveScrollEngine()
