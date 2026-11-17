// Minimalist Dual-Mode Auto-Scroll Countdown Engine
// Supports:
// 1. Countdown Only ('countdown'): Deterministic fixed-second page turn timer (default 20s)
// 2. Adaptive Countdown ('adaptive'): Dynamic duration computed from visible on-screen words
//    and rolling Exponential Moving Average (EMA, alpha = 0.15) reading speed profiling
// 3. Monotonic clock (performance.now) with pause-preserving remainingMs
// 4. Isolated multi-reason auto-suspension (blur, hidden, drawer, modal, footnote, selection)
// 5. 5-minute inactivity auto-pause watchdog for abandoned reading sessions

import type { AutoscrollMode } from '../db'

export type SuspensionReason = 'blur' | 'hidden' | 'selection' | 'footnote' | 'drawer' | 'modal'
export type PauseReason = 'user' | 'inactivity' | null

export interface PacingMetrics {
  mode: AutoscrollMode
  isActive: boolean
  isPaused: boolean
  isUserPaused: boolean
  isAutoSuspended: boolean
  pauseReason: PauseReason
  isMicroPausing: boolean
  microPauseEnabled: boolean
  totalDurationMs: number
  remainingMs: number
  remainingSec: number
  progress: number // 1.0 -> 0.0
  fixedCountdownSec: number
  currentWpm: number
  targetWpm: number
  observedWpm: number
  currentVelocity: number
}

export type PacingListener = (metrics: PacingMetrics) => void

export interface AdaptiveScrollOptions {
  initialWpm?: number
  initialCountdownSec?: number
  initialMode?: AutoscrollMode
  inactivityTimeoutMs?: number
  nowFn?: () => number
}

const DEFAULT_WPM = 250
const MIN_WPM = 80
const MAX_WPM = 1200
const DEFAULT_COUNTDOWN_SEC = 20
const MIN_COUNTDOWN_SEC = 5
const MAX_COUNTDOWN_SEC = 120
const MIN_ADAPTIVE_MS = 3_000
const MAX_ADAPTIVE_MS = 180_000
const DEFAULT_INACTIVITY_MS = 5 * 60 * 1000 // 5 minutes
const TICK_INTERVAL_MS = 100

export class AdaptiveScrollEngine {
  private readonly alpha = 0.15
  private readonly nowFn: () => number
  private readonly inactivityTimeoutMs: number

  private mode: AutoscrollMode
  private fixedCountdownSec: number
  private microPauseEnabled = true

  private currentWpm: number
  private targetWpm: number
  private observedWpm: number
  private currentVelocity = 40

  private isActive = false
  private isUserPaused = false
  private pauseReason: PauseReason = null
  private suspensionReasons: Set<SuspensionReason> = new Set()
  private isMicroPausing = false

  private totalDurationMs: number
  private remainingMs: number
  private lastNotifiedSec = -1
  private lastPageWordCount = 180
  private hasBreakOnPage = false

  private lastTickAt = 0
  private lastUserActivityAt = 0
  private awayStartedAt: number | null = null

  private listeners: Set<PacingListener> = new Set()
  private onExpireCallback: (() => void) | null = null
  private tickIntervalId: ReturnType<typeof setInterval> | null = null
  private microPauseTimerId: ReturnType<typeof setTimeout> | null = null

  constructor(options: AdaptiveScrollOptions = {}) {
    this.nowFn =
      options.nowFn ||
      (() => (typeof performance !== 'undefined' ? performance.now() : Date.now()))
    this.inactivityTimeoutMs = options.inactivityTimeoutMs ?? DEFAULT_INACTIVITY_MS

    const initWpm = this.clampWpm(options.initialWpm ?? DEFAULT_WPM)
    this.currentWpm = initWpm
    this.targetWpm = initWpm
    this.observedWpm = initWpm

    this.mode = options.initialMode ?? 'adaptive'
    this.fixedCountdownSec = this.clampCountdownSec(
      options.initialCountdownSec ?? DEFAULT_COUNTDOWN_SEC
    )
    this.totalDurationMs = this.fixedCountdownSec * 1000
    this.remainingMs = this.totalDurationMs
    this.lastUserActivityAt = this.nowFn()
  }

  private clampWpm(wpm: number): number {
    return Math.max(MIN_WPM, Math.min(MAX_WPM, Math.round(wpm)))
  }

  private clampCountdownSec(sec: number): number {
    return Math.max(MIN_COUNTDOWN_SEC, Math.min(MAX_COUNTDOWN_SEC, Math.round(sec)))
  }

  public subscribe(listener: PacingListener): () => void {
    this.listeners.add(listener)
    listener(this.getMetrics())
    return () => this.listeners.delete(listener)
  }

  private notify(): void {
    const metrics = this.getMetrics()
    this.lastNotifiedSec = metrics.remainingSec
    this.listeners.forEach((l) => l(metrics))
  }

  public isPausedState(): boolean {
    return this.isUserPaused || this.suspensionReasons.size > 0
  }

  // Configure engine parameters from Settings store
  public configure(params: {
    mode?: AutoscrollMode
    fixedCountdownSec?: number
    targetWpm?: number
    microPauseEnabled?: boolean
  }): void {
    let shouldRecalibrate = false

    if (params.mode !== undefined && params.mode !== this.mode) {
      this.mode = params.mode
      shouldRecalibrate = true
    }

    if (params.fixedCountdownSec !== undefined) {
      const clamped = this.clampCountdownSec(params.fixedCountdownSec)
      if (clamped !== this.fixedCountdownSec) {
        this.fixedCountdownSec = clamped
        if (this.mode === 'countdown') shouldRecalibrate = true
      }
    }

    if (params.targetWpm !== undefined) {
      const clamped = this.clampWpm(params.targetWpm)
      if (clamped !== Math.round(this.targetWpm)) {
        this.targetWpm = clamped
        this.currentWpm = clamped
        if (this.mode === 'adaptive') shouldRecalibrate = true
      }
    }

    if (
      params.microPauseEnabled !== undefined &&
      params.microPauseEnabled !== this.microPauseEnabled
    ) {
      this.microPauseEnabled = params.microPauseEnabled
    }

    if (this.isActive && shouldRecalibrate) {
      this.recalibrateActiveDuration()
    } else {
      this.notify()
    }
  }

  public computePageDurationMs(visibleWords: number): number {
    if (this.mode === 'countdown') {
      return this.fixedCountdownSec * 1000
    }
    return this.calculateBlockDurationMs(visibleWords)
  }

  // Calculate dynamic duration for visible on-screen words in Adaptive mode
  public calculateBlockDurationMs(wordsOnScreen: number): number {
    const effectiveWords = Math.max(10, wordsOnScreen)
    const minutesNeeded = effectiveWords / Math.max(MIN_WPM, this.currentWpm)
    const rawMs = Math.round(minutesNeeded * 60 * 1000)
    return Math.max(MIN_ADAPTIVE_MS, Math.min(MAX_ADAPTIVE_MS, rawMs))
  }

  private recalibrateActiveDuration(): void {
    const newTotalMs = this.computePageDurationMs(this.lastPageWordCount)
    const ratio = this.totalDurationMs > 0 ? this.remainingMs / this.totalDurationMs : 1
    this.totalDurationMs = newTotalMs
    this.remainingMs = Math.min(newTotalMs, Math.max(1000, Math.round(ratio * newTotalMs)))
    this.notify()
  }

  // Start or restart countdown for the currently visible page
  public startPageCountdown(
    visibleWords: number,
    hasBreak: boolean,
    onExpire: () => void
  ): void {
    this.clearMicroPauseTimer()
    this.isMicroPausing = false

    const now = this.nowFn()
    if (!this.isActive) {
      this.isUserPaused = false
      this.pauseReason = null
      this.lastUserActivityAt = now
      this.awayStartedAt = null
    }

    this.isActive = true
    this.lastPageWordCount = Math.max(10, visibleWords)
    this.hasBreakOnPage = hasBreak
    this.onExpireCallback = onExpire

    const durationMs = this.computePageDurationMs(this.lastPageWordCount)
    this.totalDurationMs = durationMs
    this.remainingMs = durationMs
    this.lastTickAt = now

    this.ensureTickLoop()
    this.notify()
  }

  private ensureTickLoop(): void {
    if (this.tickIntervalId !== null) return
    this.tickIntervalId = setInterval(() => {
      this.tick()
    }, TICK_INTERVAL_MS)
  }

  private clearTickLoop(): void {
    if (this.tickIntervalId !== null) {
      clearInterval(this.tickIntervalId)
      this.tickIntervalId = null
    }
  }

  private clearMicroPauseTimer(): void {
    if (this.microPauseTimerId !== null) {
      clearTimeout(this.microPauseTimerId)
      this.microPauseTimerId = null
    }
  }

  // Exposed for deterministic testing and internal interval execution
  public tick(): void {
    if (!this.isActive) return

    const now = this.nowFn()
    const deltaMs = Math.max(0, now - this.lastTickAt)
    this.lastTickAt = now

    // Freeze countdown while paused, suspended, or micro-pausing
    if (this.isPausedState() || this.isMicroPausing) return

    // 5-minute inactivity watchdog: auto-pause if the reader appears abandoned
    if (now - this.lastUserActivityAt >= this.inactivityTimeoutMs) {
      this.isUserPaused = true
      this.pauseReason = 'inactivity'
      this.notify()
      return
    }

    this.remainingMs = Math.max(0, this.remainingMs - deltaMs)
    const nextSec = Math.ceil(this.remainingMs / 1000)

    if (this.remainingMs <= 0) {
      const cb = this.onExpireCallback
      this.onExpireCallback = null
      this.notify()

      if (this.mode === 'adaptive' && this.microPauseEnabled && this.hasBreakOnPage) {
        this.triggerMicroPause(() => {
          if (this.isActive) cb?.()
        }, 300)
      } else {
        cb?.()
      }
      return
    }

    // Only emit UI notifications when the displayed second changes (max 1 Hz)
    if (nextSec !== this.lastNotifiedSec) {
      this.notify()
    }
  }

  // Stop the countdown engine completely and release all timers
  public stop(): void {
    this.clearTickLoop()
    this.clearMicroPauseTimer()
    this.isActive = false
    this.isUserPaused = false
    this.pauseReason = null
    this.isMicroPausing = false
    this.onExpireCallback = null
    this.awayStartedAt = null
    this.notify()
  }

  // Record explicit user interaction to keep the 5-minute inactivity watchdog fresh
  public recordUserActivity(): void {
    this.lastUserActivityAt = this.nowFn()
  }

  // Explicit user pause/resume (never overridden by transient focus/drawer events)
  public setUserPaused(paused: boolean): void {
    const now = this.nowFn()
    this.isUserPaused = paused
    this.pauseReason = paused ? 'user' : null
    this.lastTickAt = now
    if (!paused) {
      this.lastUserActivityAt = now
    }
    this.notify()
  }

  // Backward-compatible alias for user pause toggle
  public setPaused(paused: boolean): void {
    this.setUserPaused(paused)
  }

  // Isolated transient auto-suspension (blur, hidden, drawer, modal, footnote, selection)
  public setSuspension(reason: SuspensionReason, suspended: boolean): void {
    const now = this.nowFn()
    const wasAway = this.suspensionReasons.has('blur') || this.suspensionReasons.has('hidden')

    if (suspended) {
      this.suspensionReasons.add(reason)
      if ((reason === 'blur' || reason === 'hidden') && this.awayStartedAt === null) {
        this.awayStartedAt = now
      }
    } else {
      this.suspensionReasons.delete(reason)
    }

    const isStillAway = this.suspensionReasons.has('blur') || this.suspensionReasons.has('hidden')
    // If the user left the app for >= inactivityTimeoutMs and returns, keep safely paused
    if (wasAway && !isStillAway && this.awayStartedAt !== null) {
      const awayDuration = now - this.awayStartedAt
      this.awayStartedAt = null
      if (this.isActive && awayDuration >= this.inactivityTimeoutMs) {
        this.isUserPaused = true
        this.pauseReason = 'inactivity'
      } else {
        this.lastUserActivityAt = now
      }
    }

    this.lastTickAt = now
    this.notify()
  }

  // Record observed manual reading speed between page turns (EMA alpha = 0.15)
  public recordManualReading(wordCount: number, elapsedMs: number): void {
    if (elapsedMs <= 500 || wordCount <= 0) return
    const elapsedMinutes = elapsedMs / 60000
    const rawObserved = wordCount / elapsedMinutes

    this.observedWpm = this.clampWpm(rawObserved)
    this.currentWpm = this.alpha * this.observedWpm + (1 - this.alpha) * this.currentWpm
    this.notify()
  }

  // Behavioral Heuristic 1: Back-Scroll Detection (-15% WPM in Adaptive mode)
  public onBackScrollDetected(): void {
    if (this.mode !== 'adaptive') return
    this.recordUserActivity()
    this.targetWpm = this.clampWpm(this.targetWpm * 0.85)
    this.currentWpm = this.alpha * this.targetWpm + (1 - this.alpha) * this.currentWpm
    if (this.isActive) {
      this.recalibrateActiveDuration()
    } else {
      this.notify()
    }
  }

  // Behavioral Heuristic 2: Forward Nudge Detection (+10% WPM in Adaptive mode)
  public onForwardNudgeDetected(): void {
    if (this.mode !== 'adaptive') return
    this.recordUserActivity()
    this.targetWpm = this.clampWpm(this.targetWpm * 1.1)
    this.currentWpm = this.alpha * this.targetWpm + (1 - this.alpha) * this.currentWpm
    if (this.isActive) {
      this.recalibrateActiveDuration()
    } else {
      this.notify()
    }
  }

  // Adjust countdown seconds in Countdown Only mode (+5s slower / -5s faster)
  public adjustCountdownSec(deltaSec: number): number {
    this.recordUserActivity()
    this.fixedCountdownSec = this.clampCountdownSec(this.fixedCountdownSec + deltaSec)
    if (this.isActive && this.mode === 'countdown') {
      this.recalibrateActiveDuration()
    } else {
      this.notify()
    }
    return this.fixedCountdownSec
  }

  // Subtle 300ms cognitive micro-pause at section dividers, chapter ends, blockquotes
  public triggerMicroPause(callback?: () => void, durationMs = 300): void {
    this.clearMicroPauseTimer()
    this.isMicroPausing = true
    this.notify()
    this.microPauseTimerId = setTimeout(() => {
      this.microPauseTimerId = null
      this.isMicroPausing = false
      this.notify()
      callback?.()
    }, durationMs)
  }

  public reset(wpm = DEFAULT_WPM): void {
    const clamped = this.clampWpm(wpm)
    this.currentWpm = clamped
    this.targetWpm = clamped
    this.observedWpm = clamped
    this.isMicroPausing = false
    if (this.isActive && this.mode === 'adaptive') {
      this.recalibrateActiveDuration()
    } else {
      this.notify()
    }
  }

  public setTargetWpm(wpm: number): void {
    const clamped = this.clampWpm(wpm)
    this.targetWpm = clamped
    this.currentWpm = clamped
    if (this.isActive && this.mode === 'adaptive') {
      this.recalibrateActiveDuration()
    } else {
      this.notify()
    }
  }

  public getMetrics(): PacingMetrics {
    const remainingSec = Math.max(0, Math.ceil(this.remainingMs / 1000))
    const progress =
      this.totalDurationMs > 0
        ? Math.max(0, Math.min(1, this.remainingMs / this.totalDurationMs))
        : 0

    return {
      mode: this.mode,
      isActive: this.isActive,
      isPaused: this.isPausedState(),
      isUserPaused: this.isUserPaused,
      isAutoSuspended: this.suspensionReasons.size > 0,
      pauseReason: this.pauseReason,
      isMicroPausing: this.isMicroPausing,
      microPauseEnabled: this.microPauseEnabled,
      totalDurationMs: this.totalDurationMs,
      remainingMs: this.remainingMs,
      remainingSec,
      progress,
      fixedCountdownSec: this.fixedCountdownSec,
      currentWpm: Math.round(this.currentWpm),
      targetWpm: Math.round(this.targetWpm),
      observedWpm: Math.round(this.observedWpm),
      currentVelocity: Math.round(this.currentVelocity)
    }
  }
}

export const adaptiveScrollEngine = new AdaptiveScrollEngine()
