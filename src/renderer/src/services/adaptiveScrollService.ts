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

export type SettingsSyncCallback = (settings: {
  fixedCountdownSec: number
  adaptiveBaseSec: number
  targetWpm: number
  observedWpm: number
}) => void

export interface PacingMetrics {
  mode: AutoscrollMode
  isActive: boolean
  isPaused: boolean
  isUserPaused: boolean
  isAutoSuspended: boolean
  isSkimming: boolean
  pauseReason: PauseReason
  isMicroPausing: boolean
  microPauseEnabled: boolean
  totalDurationMs: number
  remainingMs: number
  remainingSec: number
  progress: number // 1.0 -> 0.0
  fixedCountdownSec: number
  adaptiveBaseSec: number
  currentWpm: number
  targetWpm: number
  observedWpm: number
  currentVelocity: number
}

export type PacingListener = (metrics: PacingMetrics) => void

export interface AdaptiveScrollOptions {
  initialWpm?: number
  initialCountdownSec?: number
  initialAdaptiveSec?: number
  initialMode?: AutoscrollMode
  inactivityTimeoutMs?: number
  nowFn?: () => number
}

const REFERENCE_PAGE_WORDS = 180
const DEFAULT_WPM = 250
const MIN_WPM = 18
const MAX_WPM = 3600
const DEFAULT_COUNTDOWN_SEC = 20
const DEFAULT_ADAPTIVE_SEC = 25
const MIN_COUNTDOWN_SEC = 3
const MAX_COUNTDOWN_SEC = 600
const MIN_ADAPTIVE_MS = 2500 // Allow snappy 2.5s for genuine sparse pages (foreword, chapter title)
const MAX_ADAPTIVE_MS = 600_000
const DEFAULT_INACTIVITY_MS = 5 * 60 * 1000 // 5 minutes away from app
const TICK_INTERVAL_MS = 100

// Physiological reading boundaries for the Skimming Protector:
export const MIN_RECOGNITION_DWELL_MS = 800 // Below 800ms is pure accidental flip or key repeat
export const MAX_PLAUSIBLE_READING_WPM = 750 // Above 750 WPM is scanning/skimming
export const MIN_PLAUSIBLE_READING_WPM = 60  // Below 60 WPM is distraction/idling

/**
 * Ultra-fast O(N) language-aware word & character counter.
 * Correctly accounts for non-space-delimited CJK ideograms (~0.6 words each)
 * without triggering heavy regex thrashing or memory allocations.
 */
export function computeEffectiveWordCount(
  rawText: string,
  hasIllustration = false
): { words: number; chars: number; isImageOrSparse: boolean } {
  const text = rawText.trim()
  if (!text) {
    return {
      words: hasIllustration ? 60 : 0,
      chars: 0,
      isImageOrSparse: true
    }
  }

  let cjkCount = 0
  const len = text.length
  for (let i = 0; i < len; i++) {
    const code = text.charCodeAt(i)
    if (
      (code >= 0x4e00 && code <= 0x9fff) || // CJK Unified Ideographs
      (code >= 0x3400 && code <= 0x4dbf) || // CJK Extension A
      (code >= 0x3040 && code <= 0x30ff) || // Hiragana & Katakana
      (code >= 0xac00 && code <= 0xd7af)    // Hangul Syllables
    ) {
      cjkCount++
    }
  }

  // Non-CJK text word splitting
  let latinWords = 0
  if (cjkCount < len) {
    const nonCjk = text.replace(/[\u4e00-\u9fff\u3400-\u4dbf\u3040-\u30ff\uac00-\ud7af]/g, ' ')
    latinWords = nonCjk.split(/\s+/).filter(Boolean).length
  }

  // Combine Latin words + CJK morphemes (~0.6 words per ideogram)
  let effectiveWords = latinWords + Math.round(cjkCount * 0.6)

  // If page is an illustration/figure with minimal text, allocate visual viewing dwell
  if (hasIllustration && effectiveWords < 15) {
    effectiveWords = 60
  }

  return {
    words: Math.max(1, effectiveWords),
    chars: len,
    isImageOrSparse: effectiveWords < 20
  }
}

export class AdaptiveScrollEngine {
  private readonly alpha = 0.15
  private readonly nowFn: () => number
  private readonly inactivityTimeoutMs: number

  private mode: AutoscrollMode
  private fixedCountdownSec: number
  private adaptiveBaseSec: number
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
  private isSkimming = false
  private isDoubleSpread = false

  private totalDurationMs: number
  private remainingMs: number
  private lastNotifiedSec = -1
  private lastPageWordCount = 180
  private hasBreakOnPage = false

  private lastTickAt = 0
  private lastUserActivityAt = 0
  private awayStartedAt: number | null = null

  private listeners: Set<PacingListener> = new Set()
  private syncCallbacks: Set<SettingsSyncCallback> = new Set()
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
    this.adaptiveBaseSec = this.clampCountdownSec(
      options.initialAdaptiveSec ?? DEFAULT_ADAPTIVE_SEC
    )
    this.totalDurationMs =
      (this.mode === 'countdown' ? this.fixedCountdownSec : this.adaptiveBaseSec) * 1000
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

  public onSyncSettings(cb: SettingsSyncCallback): () => void {
    this.syncCallbacks.add(cb)
    return () => this.syncCallbacks.delete(cb)
  }

  private triggerSettingsSync(): void {
    const data = {
      fixedCountdownSec: this.fixedCountdownSec,
      adaptiveBaseSec: this.adaptiveBaseSec,
      targetWpm: Math.round(this.targetWpm),
      observedWpm: Math.round(this.observedWpm)
    }
    this.syncCallbacks.forEach((cb) => {
      try {
        cb(data)
      } catch {}
    })
  }

  private notify(): void {
    const metrics = this.getMetrics()
    this.lastNotifiedSec = metrics.remainingSec
    this.listeners.forEach((l) => {
      try {
        l(metrics)
      } catch {}
    })
  }

  public isPausedState(): boolean {
    return this.isUserPaused || this.suspensionReasons.size > 0
  }

  // Configure engine parameters from Settings store
  public configure(params: {
    mode?: AutoscrollMode
    fixedCountdownSec?: number
    adaptiveBaseSec?: number
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

    if (params.adaptiveBaseSec !== undefined) {
      const clamped = this.clampCountdownSec(params.adaptiveBaseSec)
      if (clamped !== this.adaptiveBaseSec) {
        this.adaptiveBaseSec = clamped
        const derivedWpm = this.clampWpm((REFERENCE_PAGE_WORDS / clamped) * 60)
        this.targetWpm = derivedWpm
        this.currentWpm = derivedWpm
        if (this.mode === 'adaptive') shouldRecalibrate = true
      }
    } else if (params.targetWpm !== undefined) {
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

  public computePageDurationMs(visibleWords: number, isDoubleSpread = false): number {
    if (this.mode === 'countdown') {
      return this.fixedCountdownSec * 1000
    }
    return this.calculateBlockDurationMs(visibleWords, isDoubleSpread)
  }

  // Calculate dynamic duration for visible on-screen words in Smart/Adaptive mode
  // Scales proportionally around the user's manual adaptiveBaseSec for a reference 180-word page (or 360-word spread)
  public calculateBlockDurationMs(wordsOnScreen: number, isDoubleSpread = false): number {
    const effectiveWords = Math.max(5, wordsOnScreen)
    const refWords = isDoubleSpread ? REFERENCE_PAGE_WORDS * 2 : REFERENCE_PAGE_WORDS
    const densityRatio = effectiveWords / refWords
    const rawMs = Math.round(this.adaptiveBaseSec * 1000 * densityRatio)
    return Math.max(MIN_ADAPTIVE_MS, Math.min(MAX_ADAPTIVE_MS, rawMs))
  }

  private recalibrateActiveDuration(): void {
    const newTotalMs = this.computePageDurationMs(this.lastPageWordCount, this.isDoubleSpread)
    const ratio = this.totalDurationMs > 0 ? this.remainingMs / this.totalDurationMs : 1
    this.totalDurationMs = newTotalMs
    this.remainingMs = Math.min(newTotalMs, Math.max(500, Math.round(ratio * newTotalMs)))
    this.notify()
  }

  // Start or restart countdown for the currently visible page
  public startPageCountdown(
    visibleWords: number,
    hasBreak: boolean,
    onExpire: () => void,
    isDoubleSpread = false
  ): void {
    this.clearMicroPauseTimer()
    this.isMicroPausing = false
    this.isDoubleSpread = isDoubleSpread

    const now = this.nowFn()
    if (!this.isActive) {
      this.isUserPaused = false
      this.pauseReason = null
      this.lastUserActivityAt = now
      this.awayStartedAt = null
    }

    this.isActive = true
    this.lastPageWordCount = Math.max(5, visibleWords)
    this.hasBreakOnPage = hasBreak
    this.onExpireCallback = onExpire

    const durationMs = this.computePageDurationMs(this.lastPageWordCount, isDoubleSpread)
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

    this.remainingMs = Math.max(0, this.remainingMs - deltaMs)
    const nextSec = Math.ceil(this.remainingMs / 1000)

    if (this.remainingMs <= 0) {
      const cb = this.onExpireCallback
      this.onExpireCallback = null
      this.lastUserActivityAt = now
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

    // Always emit on active tick so UI progress rings animate fluidly at 10 Hz (100ms)
    this.notify()
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
    this.remainingMs = this.totalDurationMs
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
      // Clear any stale transient hover/blur locks when user explicitly resumes
      this.suspensionReasons.delete('blur')
      this.suspensionReasons.delete('footnote')
    }
    this.notify()
  }

  // Clear stale transient suspensions when explicitly starting Auto-Scroll
  public clearTransientSuspensions(): void {
    this.suspensionReasons.delete('blur')
    this.suspensionReasons.delete('hidden')
    this.suspensionReasons.delete('footnote')
    this.lastTickAt = this.nowFn()
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
  // Protected by the Mathematical Skimming & Idling Guard:
  public recordManualReading(wordCount: number, elapsedMs: number): void {
    // 1. Physical fixation minimum: Dwells under 800ms are accidental clicks or rapid key-repeats
    if (elapsedMs < MIN_RECOGNITION_DWELL_MS || wordCount <= 0) return

    const elapsedMinutes = elapsedMs / 60000
    const rawObserved = wordCount / elapsedMinutes

    // 2. Skimming Protector: If observed speed exceeds plausible reading ceiling
    // (e.g. 230 words in 3s or 10s gives 4,600 / 1,380 WPM)
    if (rawObserved > MAX_PLAUSIBLE_READING_WPM) {
      this.isSkimming = true
      this.observedWpm = this.clampWpm(rawObserved)
      // Do NOT corrupt the learned cadence! Preserve currentWpm and adaptiveBaseSec intact.
      this.notify()
      return
    }

    // 3. Idling / Inattention Protector: If observed speed is lower than 60 WPM (e.g. reader paused or stepped away)
    if (rawObserved < MIN_PLAUSIBLE_READING_WPM) {
      // Do not pull learned reading cadence down to turtle pace
      return
    }

    // 4. Normal Reading Cadence: User is reading within physiological bounds (even short pages like 5 words in 2s = 150 WPM)
    this.isSkimming = false
    this.observedWpm = this.clampWpm(rawObserved)
    this.currentWpm = this.alpha * this.observedWpm + (1 - this.alpha) * this.currentWpm
    this.targetWpm = this.clampWpm(this.currentWpm)
    // Synchronize adaptiveBaseSec with the learned WPM
    this.adaptiveBaseSec = this.clampCountdownSec((REFERENCE_PAGE_WORDS / this.currentWpm) * 60)
    this.notify()
    this.triggerSettingsSync()
  }

  // Behavioral Heuristic 1: Back-Scroll Detection (+15% slower in Adaptive mode)
  public onBackScrollDetected(): void {
    if (this.mode !== 'adaptive') return
    this.recordUserActivity()
    this.adaptiveBaseSec = this.clampCountdownSec(this.adaptiveBaseSec * 1.15)
    const derivedWpm = this.clampWpm((REFERENCE_PAGE_WORDS / this.adaptiveBaseSec) * 60)
    this.targetWpm = derivedWpm
    this.currentWpm = derivedWpm
    if (this.isActive) {
      this.recalibrateActiveDuration()
    } else {
      this.notify()
    }
    this.triggerSettingsSync()
  }

  // Behavioral Heuristic 2: Forward Nudge Detection (-10% faster in Adaptive mode)
  public onForwardNudgeDetected(): void {
    if (this.mode !== 'adaptive') return
    this.recordUserActivity()
    this.adaptiveBaseSec = this.clampCountdownSec(this.adaptiveBaseSec * 0.9)
    const derivedWpm = this.clampWpm((REFERENCE_PAGE_WORDS / this.adaptiveBaseSec) * 60)
    this.targetWpm = derivedWpm
    this.currentWpm = derivedWpm
    if (this.isActive) {
      this.recalibrateActiveDuration()
    } else {
      this.notify()
    }
    this.triggerSettingsSync()
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
    this.triggerSettingsSync()
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

  public reset(baseSec = DEFAULT_ADAPTIVE_SEC): void {
    this.adaptiveBaseSec = this.clampCountdownSec(baseSec)
    this.fixedCountdownSec = DEFAULT_COUNTDOWN_SEC
    const derivedWpm = this.clampWpm((REFERENCE_PAGE_WORDS / this.adaptiveBaseSec) * 60)
    this.currentWpm = derivedWpm
    this.targetWpm = derivedWpm
    this.observedWpm = derivedWpm
    this.isMicroPausing = false
    this.clearMicroPauseTimer()
    if (this.isActive) {
      this.recalibrateActiveDuration()
    } else {
      this.totalDurationMs =
        (this.mode === 'countdown' ? this.fixedCountdownSec : this.adaptiveBaseSec) * 1000
      this.remainingMs = this.totalDurationMs
      this.notify()
    }
    this.triggerSettingsSync()
  }

  public setTargetWpm(wpm: number): void {
    const clamped = this.clampWpm(wpm)
    this.targetWpm = clamped
    this.currentWpm = clamped
    this.adaptiveBaseSec = this.clampCountdownSec((REFERENCE_PAGE_WORDS / clamped) * 60)
    if (this.isActive && this.mode === 'adaptive') {
      this.recalibrateActiveDuration()
    } else {
      this.notify()
    }
    this.triggerSettingsSync()
  }

  public getMetrics(): PacingMetrics {
    const remainingSec = Math.max(0, Math.ceil(this.remainingMs / 1000))
    const progress =
      this.totalDurationMs > 0
        ? Math.max(0, Math.min(1, this.remainingMs / this.totalDurationMs))
        : 0
    
    // Inverse mapping: Speed is proportional to 1 / seconds
    const scrollSeconds = this.mode === 'countdown' ? this.fixedCountdownSec : this.adaptiveBaseSec
    const baseVelocity = 50 
    const currentVelocity = Math.max(10, Math.round(baseVelocity * (20 / scrollSeconds)))

    return {
      mode: this.mode,
      isActive: this.isActive,
      isPaused: this.isPausedState(),
      isUserPaused: this.isUserPaused,
      isAutoSuspended: this.suspensionReasons.size > 0,
      isSkimming: this.isSkimming,
      pauseReason: this.pauseReason,
      isMicroPausing: this.isMicroPausing,
      microPauseEnabled: this.microPauseEnabled,
      totalDurationMs: this.totalDurationMs,
      remainingMs: this.remainingMs,
      remainingSec,
      progress,
      fixedCountdownSec: this.fixedCountdownSec,
      adaptiveBaseSec: this.adaptiveBaseSec,
      currentWpm: Math.round(this.currentWpm),
      targetWpm: Math.round(this.targetWpm),
      observedWpm: Math.round(this.observedWpm),
      currentVelocity: currentVelocity
    }
  }
}

export const adaptiveScrollEngine = new AdaptiveScrollEngine()
