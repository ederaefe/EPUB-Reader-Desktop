// Unified Auto-Scroll Coordinator Facade
// Coordinates CountdownScrollEngine and AdaptivePacingEngine while maintaining
// 100% backwards-compatible APIs for reader views, store, and overlays.

import type { AutoscrollMode } from '../db'
import { CountdownScrollEngine, type CountdownState } from './countdownScrollEngine'
import {
  AdaptivePacingEngine,
  computeEffectiveWordCount,
  DEFAULT_WPM,
  MIN_DWELL_FLOOR_SEC
} from './adaptivePacingEngine'

export { computeEffectiveWordCount }

export type SuspensionReason =
  | 'blur'
  | 'hidden'
  | 'selection'
  | 'footnote'
  | 'drawer'
  | 'modal'
  | 'layout'
  | 'manualScroll'

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
  isLearning?: boolean
  isCalibrated?: boolean
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

const DEFAULT_COUNTDOWN_SEC = 20
const DEFAULT_ADAPTIVE_SEC = 25
const MIN_COUNTDOWN_SEC = 3
const MAX_COUNTDOWN_SEC = 600
const DEFAULT_INACTIVITY_MS = 5 * 60 * 1000 // 5 minutes inactivity auto-pause

export class AdaptiveScrollEngine {
  private readonly nowFn: () => number
  private readonly inactivityTimeoutMs: number

  private readonly countdownEngine: CountdownScrollEngine
  private readonly pacingEngine: AdaptivePacingEngine

  private mode: AutoscrollMode = 'adaptive'
  private fixedCountdownSec = DEFAULT_COUNTDOWN_SEC
  private adaptiveBaseSec = DEFAULT_ADAPTIVE_SEC
  private microPauseEnabled = true

  private isUserPaused = false
  private pauseReason: PauseReason = null
  private suspensionReasons: Set<SuspensionReason> = new Set()
  private isMicroPausing = false
  private isDoubleSpread = false
  private currentPage = 1

  private lastPageWordCount = 180
  private hasBreakOnPage = false
  private lastUserActivityAt = 0
  private awayStartedAt: number | null = null

  private listeners: Set<PacingListener> = new Set()
  private syncCallbacks: Set<SettingsSyncCallback> = new Set()
  private microPauseTimerId: ReturnType<typeof setTimeout> | null = null
  private pendingAdvanceCb: (() => void) | null = null

  constructor(options: AdaptiveScrollOptions = {}) {
    this.nowFn =
      options.nowFn ||
      (() => (typeof performance !== 'undefined' ? performance.now() : Date.now()))
    this.inactivityTimeoutMs = options.inactivityTimeoutMs ?? DEFAULT_INACTIVITY_MS

    this.mode = options.initialMode ?? 'adaptive'
    this.fixedCountdownSec = Math.max(
      MIN_COUNTDOWN_SEC,
      Math.min(MAX_COUNTDOWN_SEC, options.initialCountdownSec ?? DEFAULT_COUNTDOWN_SEC)
    )
    this.adaptiveBaseSec = Math.max(
      MIN_DWELL_FLOOR_SEC,
      Math.min(MAX_COUNTDOWN_SEC, options.initialAdaptiveSec ?? DEFAULT_ADAPTIVE_SEC)
    )

    this.countdownEngine = new CountdownScrollEngine({
      nowFn: this.nowFn,
      inactivityTimeoutMs: 60 * 60 * 1000 // 60 min hardware safety
    })

    this.pacingEngine = new AdaptivePacingEngine(options.initialWpm ?? DEFAULT_WPM)

    this.lastUserActivityAt = this.nowFn()

    // Relay countdown ticks directly to pacing listeners
    this.countdownEngine.subscribe((_state: CountdownState) => {
      this.checkInactivityWatchdog()
      this.notify()
    })
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

  private getCurrentUnit(): number {
    return this.isDoubleSpread ? Math.ceil(this.currentPage / 2) : this.currentPage
  }

  private triggerSettingsSync(): void {
    const pacingState = this.pacingEngine.getState(this.getCurrentUnit(), this.isDoubleSpread)
    const data = {
      fixedCountdownSec: this.fixedCountdownSec,
      adaptiveBaseSec: this.adaptiveBaseSec,
      targetWpm: pacingState.targetWpm,
      observedWpm: pacingState.observedWpm
    }
    this.syncCallbacks.forEach((cb) => {
      try {
        cb(data)
      } catch {}
    })
  }

  private notify(): void {
    const metrics = this.getMetrics()
    this.listeners.forEach((l) => {
      try {
        l(metrics)
      } catch {}
    })
  }

  public isPausedState(): boolean {
    return this.isUserPaused || this.suspensionReasons.size > 0
  }

  private checkInactivityWatchdog(): void {
    const now = this.nowFn()
    if (
      this.countdownEngine.getState().isActive &&
      !this.isUserPaused &&
      now - this.lastUserActivityAt >= this.inactivityTimeoutMs
    ) {
      this.isUserPaused = true
      this.pauseReason = 'inactivity'
      this.countdownEngine.pause()
    }
  }

  public configure(params: {
    mode?: AutoscrollMode
    fixedCountdownSec?: number
    adaptiveBaseSec?: number
    targetWpm?: number
    microPauseEnabled?: boolean
  }): void {
    if (params.mode !== undefined && params.mode !== this.mode) {
      this.mode = params.mode
      if (this.countdownEngine.getState().isActive) {
        const spreadFactor = this.isDoubleSpread ? 2 : 1
        const targetSec = this.mode === 'countdown' ? this.fixedCountdownSec : (this.adaptiveBaseSec * spreadFactor)
        const minFloor = this.mode === 'countdown' ? MIN_COUNTDOWN_SEC : MIN_DWELL_FLOOR_SEC
        this.countdownEngine.setSeconds(targetSec, minFloor, MAX_COUNTDOWN_SEC)
      }
    }

    if (params.fixedCountdownSec !== undefined) {
      this.fixedCountdownSec = Math.max(MIN_COUNTDOWN_SEC, Math.min(MAX_COUNTDOWN_SEC, Math.round(params.fixedCountdownSec)))
      if (this.mode === 'countdown' && this.countdownEngine.getState().isActive) {
        this.countdownEngine.setSeconds(this.fixedCountdownSec, MIN_COUNTDOWN_SEC, MAX_COUNTDOWN_SEC)
      }
    }

    if (params.adaptiveBaseSec !== undefined) {
      this.adaptiveBaseSec = Math.max(MIN_DWELL_FLOOR_SEC, Math.min(MAX_COUNTDOWN_SEC, Math.round(params.adaptiveBaseSec)))
      this.pacingEngine.syncBaseSeconds(this.adaptiveBaseSec)
      if (this.mode === 'adaptive' && this.countdownEngine.getState().isActive) {
        const spreadFactor = this.isDoubleSpread ? 2 : 1
        const targetSec = this.adaptiveBaseSec * spreadFactor
        this.countdownEngine.setSeconds(targetSec, MIN_DWELL_FLOOR_SEC, MAX_COUNTDOWN_SEC)
      }
    }

    if (params.targetWpm !== undefined) {
      this.pacingEngine.setTargetWpm(params.targetWpm)
      this.adaptiveBaseSec = Math.max(MIN_DWELL_FLOOR_SEC, Math.round((180 / params.targetWpm) * 60))
    }

    if (params.microPauseEnabled !== undefined) {
      this.microPauseEnabled = params.microPauseEnabled
    }

    this.notify()
  }

  /**
   * Start or reset page countdown with layout & chapter-end awareness
   */
  public startPageCountdown(
    visibleWords: number,
    hasBreak: boolean,
    onExpire: () => void,
    isDoubleSpread = false,
    pageIndex = 1
  ): void {
    this.clearMicroPauseTimer()
    this.pendingAdvanceCb = null
    this.isMicroPausing = false
    this.isDoubleSpread = isDoubleSpread
    this.currentPage = Math.max(1, pageIndex)
    this.lastPageWordCount = Math.max(5, visibleWords)
    this.hasBreakOnPage = hasBreak

    const now = this.nowFn()
    this.lastUserActivityAt = now

    let dwellSec = 20
    let minFloor = MIN_COUNTDOWN_SEC

    if (this.mode === 'countdown') {
      dwellSec = this.fixedCountdownSec
      minFloor = MIN_COUNTDOWN_SEC
    } else {
      dwellSec = this.pacingEngine.computeDwellSeconds(
        this.getCurrentUnit(),
        this.lastPageWordCount,
        this.isDoubleSpread,
        this.hasBreakOnPage,
        this.adaptiveBaseSec
      )
      minFloor = MIN_DWELL_FLOOR_SEC
    }

    const wrappedOnExpire = () => {
      if (this.mode === 'adaptive' && this.microPauseEnabled && this.hasBreakOnPage) {
        this.triggerMicroPause(() => {
          if (this.countdownEngine.getState().isActive && !this.isPausedState()) onExpire()
        }, 300)
      } else {
        onExpire()
      }
    }

    this.countdownEngine.start(dwellSec, wrappedOnExpire, minFloor, MAX_COUNTDOWN_SEC)

    // Synchronize pause state if currently suspended
    if (this.isPausedState()) {
      this.countdownEngine.pause()
    }

    this.notify()
  }

  public stop(): void {
    this.clearMicroPauseTimer()
    this.pendingAdvanceCb = null
    this.countdownEngine.stop()
    this.isUserPaused = false
    this.pauseReason = null
    this.isMicroPausing = false
    this.awayStartedAt = null
    this.notify()
  }

  public recordUserActivity(): void {
    this.lastUserActivityAt = this.nowFn()
  }

  public setUserPaused(paused: boolean): void {
    const now = this.nowFn()
    this.isUserPaused = paused
    this.pauseReason = paused ? 'user' : null
    this.lastUserActivityAt = now

    if (paused) {
      this.countdownEngine.pause()
    } else {
      this.suspensionReasons.delete('blur')
      this.suspensionReasons.delete('footnote')
      if (!this.isPausedState()) {
        this.countdownEngine.resume()
        // If there was a pending advance queued from an interrupted micro-pause, execute it on unpause
        if (this.pendingAdvanceCb && !this.isMicroPausing) {
          const cb = this.pendingAdvanceCb
          this.pendingAdvanceCb = null
          cb()
        }
      }
    }
    this.notify()
  }

  public setPaused(paused: boolean): void {
    this.setUserPaused(paused)
  }

  public clearTransientSuspensions(): void {
    this.suspensionReasons.delete('blur')
    this.suspensionReasons.delete('hidden')
    this.suspensionReasons.delete('footnote')
    if (!this.isPausedState()) {
      this.countdownEngine.resume()
    }
    this.notify()
  }

  public setSuspension(reason: SuspensionReason, suspended: boolean): void {
    const now = this.nowFn()
    const wasAway = this.suspensionReasons.has('blur') || this.suspensionReasons.has('hidden')

    if (suspended) {
      this.suspensionReasons.add(reason)
      if ((reason === 'blur' || reason === 'hidden') && this.awayStartedAt === null) {
        this.awayStartedAt = now
      }
      this.countdownEngine.pause()
    } else {
      this.suspensionReasons.delete(reason)
    }

    const isStillAway = this.suspensionReasons.has('blur') || this.suspensionReasons.has('hidden')
    if (wasAway && !isStillAway && this.awayStartedAt !== null) {
      const awayDuration = now - this.awayStartedAt
      this.awayStartedAt = null
      if (this.countdownEngine.getState().isActive && awayDuration >= this.inactivityTimeoutMs) {
        this.isUserPaused = true
        this.pauseReason = 'inactivity'
        this.countdownEngine.pause()
      } else {
        this.lastUserActivityAt = now
      }
    }

    if (!this.isPausedState() && this.countdownEngine.getState().isActive) {
      this.countdownEngine.resume()
    }

    this.notify()
  }

  /**
   * On-the-fly hotkey speed nudging (+/- 2 seconds)
   * Does not restart or interrupt running countdown timer!
   */
  public nudgeDwellSec(deltaSec: number): number {
    this.recordUserActivity()
    const isAdaptive = this.mode === 'adaptive'
    const minFloor = isAdaptive ? MIN_DWELL_FLOOR_SEC : MIN_COUNTDOWN_SEC

    if (isAdaptive) {
      this.adaptiveBaseSec = Math.max(minFloor, Math.min(MAX_COUNTDOWN_SEC, this.adaptiveBaseSec + deltaSec))
      this.pacingEngine.syncBaseSeconds(this.adaptiveBaseSec)
    } else {
      this.fixedCountdownSec = Math.max(minFloor, Math.min(MAX_COUNTDOWN_SEC, this.fixedCountdownSec + deltaSec))
    }

    const updatedTotal = this.countdownEngine.adjustSeconds(deltaSec, minFloor, MAX_COUNTDOWN_SEC)
    this.triggerSettingsSync()
    this.notify()
    return updatedTotal
  }

  public adjustCountdownSec(deltaSec: number): number {
    return this.nudgeDwellSec(deltaSec)
  }

  public recordManualReading(wordCount: number, elapsedMs: number, pageIndex?: number, isDoubleSpread?: boolean): void {
    const page = pageIndex ?? this.currentPage
    const isDual = isDoubleSpread ?? this.isDoubleSpread
    const unit = isDual ? Math.ceil(page / 2) : page
    const updated = this.pacingEngine.recordManualReading(unit, wordCount, elapsedMs, isDual)
    if (updated) {
      const pacing = this.pacingEngine.getState(unit, isDual)
      this.adaptiveBaseSec = Math.max(MIN_DWELL_FLOOR_SEC, Math.round((180 / pacing.currentWpm) * 60))
      this.triggerSettingsSync()
    }
    this.notify()
  }

  public extendCurrentPageDwell(factor = 1.25): void {
    const cur = this.countdownEngine.getState().remainingSec
    const delta = Math.round(cur * (factor - 1))
    this.countdownEngine.adjustSeconds(delta)
    this.notify()
  }

  public onBackScrollDetected(): void {
    if (this.mode !== 'adaptive') return
    this.recordUserActivity()
    this.extendCurrentPageDwell(1.25)
  }

  public onForwardNudgeDetected(): void {
    if (this.mode !== 'adaptive') return
    this.recordUserActivity()
    const cur = this.countdownEngine.getState().remainingSec
    const delta = -Math.round(cur * 0.25)
    this.countdownEngine.adjustSeconds(delta)
    this.notify()
  }

  public triggerMicroPause(callback?: () => void, durationMs = 300): void {
    this.clearMicroPauseTimer()
    this.isMicroPausing = true
    this.pendingAdvanceCb = callback ?? null
    this.countdownEngine.pause()
    this.notify()
    this.microPauseTimerId = setTimeout(() => {
      this.microPauseTimerId = null
      this.isMicroPausing = false
      if (!this.isPausedState()) {
        this.countdownEngine.resume()
        const cb = this.pendingAdvanceCb
        this.pendingAdvanceCb = null
        this.notify()
        cb?.()
      } else {
        this.notify()
      }
    }, durationMs)
  }

  public reset(baseSec = DEFAULT_ADAPTIVE_SEC): void {
    this.adaptiveBaseSec = Math.max(MIN_DWELL_FLOOR_SEC, baseSec)
    this.fixedCountdownSec = DEFAULT_COUNTDOWN_SEC
    this.pacingEngine.reset()
    this.pacingEngine.syncBaseSeconds(this.adaptiveBaseSec)
    this.isMicroPausing = false
    this.clearMicroPauseTimer()
    this.pendingAdvanceCb = null
    if (this.countdownEngine.getState().isActive) {
      const spreadFactor = this.isDoubleSpread ? 2 : 1
      const targetSec = this.mode === 'countdown' ? this.fixedCountdownSec : (this.adaptiveBaseSec * spreadFactor)
      const minFloor = this.mode === 'countdown' ? MIN_COUNTDOWN_SEC : MIN_DWELL_FLOOR_SEC
      this.countdownEngine.setSeconds(targetSec, minFloor, MAX_COUNTDOWN_SEC)
    }
    this.triggerSettingsSync()
    this.notify()
  }

  public setTargetWpm(wpm: number): void {
    this.pacingEngine.setTargetWpm(wpm)
    this.adaptiveBaseSec = Math.max(MIN_DWELL_FLOOR_SEC, Math.round((180 / wpm) * 60))
    this.triggerSettingsSync()
    this.notify()
  }

  public computePageDurationMs(visibleWords: number, isDoubleSpread = false): number {
    if (this.mode === 'countdown') {
      return this.fixedCountdownSec * 1000
    }
    const unit = isDoubleSpread ? Math.ceil(this.currentPage / 2) : this.currentPage
    const sec = this.pacingEngine.computeDwellSeconds(
      unit,
      visibleWords,
      isDoubleSpread,
      this.hasBreakOnPage,
      this.adaptiveBaseSec
    )
    return sec * 1000
  }

  public calculateBlockDurationMs(wordsOnScreen: number, isDoubleSpread = false): number {
    return this.computePageDurationMs(wordsOnScreen, isDoubleSpread)
  }

  public tick(): void {
    this.countdownEngine.tick()
  }

  public getMetrics(): PacingMetrics {
    const cd = this.countdownEngine.getState()
    const pacing = this.pacingEngine.getState(this.getCurrentUnit(), this.isDoubleSpread)

    const scrollSeconds = this.mode === 'countdown' ? this.fixedCountdownSec : this.adaptiveBaseSec
    const baseVelocity = 50
    const currentVelocity = Math.max(10, Math.round(baseVelocity * (20 / scrollSeconds)))

    return {
      mode: this.mode,
      isActive: cd.isActive,
      isPaused: this.isPausedState() || cd.isPaused,
      isUserPaused: this.isUserPaused,
      isAutoSuspended: this.suspensionReasons.size > 0,
      isSkimming: pacing.isSkimming,
      pauseReason: this.pauseReason,
      isMicroPausing: this.isMicroPausing,
      microPauseEnabled: this.microPauseEnabled,
      totalDurationMs: cd.totalSec * 1000,
      remainingMs: cd.remainingSec * 1000,
      remainingSec: cd.remainingSec,
      progress: cd.progress,
      fixedCountdownSec: this.fixedCountdownSec,
      adaptiveBaseSec: this.adaptiveBaseSec,
      currentWpm: pacing.currentWpm,
      targetWpm: pacing.targetWpm,
      observedWpm: pacing.observedWpm,
      currentVelocity,
      isLearning: pacing.isLearning,
      isCalibrated: pacing.isCalibrated
    }
  }

  private clearMicroPauseTimer(): void {
    if (this.microPauseTimerId !== null) {
      clearTimeout(this.microPauseTimerId)
      this.microPauseTimerId = null
    }
  }
}

export const adaptiveScrollEngine = new AdaptiveScrollEngine()
