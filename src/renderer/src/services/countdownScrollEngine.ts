// Standalone Pure Integer Countdown Scroll Engine
// Characteristics:
// 1. Monotonic 1000ms integer clock
// 2. Zero DOM layout dependencies or word counting
// 3. Nuclear queue purge on pause/stop (nullifies callback refs)
// 4. On-the-fly duration nudges (+/- delta seconds) without timer restarts
// 5. 60-minute hardware safety watchdog against unattended book reading
// 6. Sleep / suspension guard against sudden wall-clock leaps

export interface CountdownState {
  isActive: boolean
  isPaused: boolean
  totalSec: number
  remainingSec: number
  progress: number // 1.0 -> 0.0
}

export type CountdownListener = (state: CountdownState) => void

export interface CountdownScrollEngineOptions {
  nowFn?: () => number
  inactivityTimeoutMs?: number
}

const DEFAULT_INACTIVITY_MS = 60 * 60 * 1000 // 60 minutes hardware safety watchdog

export class CountdownScrollEngine {
  private readonly nowFn: () => number
  private readonly inactivityTimeoutMs: number

  private isActive = false
  private isPaused = false
  private totalSec = 20
  private remainingSec = 20
  private lastTickAt = 0
  private startedAt = 0

  private intervalId: ReturnType<typeof setInterval> | null = null
  private onExpire: (() => void) | null = null
  private listeners: Set<CountdownListener> = new Set()

  constructor(options: CountdownScrollEngineOptions = {}) {
    this.nowFn =
      options.nowFn ||
      (() => (typeof performance !== 'undefined' ? performance.now() : Date.now()))
    this.inactivityTimeoutMs = options.inactivityTimeoutMs ?? DEFAULT_INACTIVITY_MS
  }

  public subscribe(listener: CountdownListener): () => void {
    this.listeners.add(listener)
    listener(this.getState())
    return () => this.listeners.delete(listener)
  }

  private notify(): void {
    const state = this.getState()
    this.listeners.forEach((l) => {
      try {
        l(state)
      } catch {}
    })
  }

  public getState(): CountdownState {
    const progress = this.totalSec > 0 ? Math.max(0, Math.min(1, this.remainingSec / this.totalSec)) : 0
    return {
      isActive: this.isActive,
      isPaused: this.isPaused,
      totalSec: this.totalSec,
      remainingSec: this.remainingSec,
      progress
    }
  }

  /**
   * Start or re-arm the countdown timer for a page
   */
  public start(seconds: number, onExpire: () => void, minSec = 3, maxSec = 600): void {
    this.clearTimer()
    const validSec = Number.isFinite(seconds) ? Math.round(seconds) : 20
    const clampedSec = Math.max(minSec, Math.min(maxSec, validSec))
    const now = this.nowFn()

    this.isActive = true
    this.isPaused = false
    this.totalSec = clampedSec
    this.remainingSec = clampedSec
    this.onExpire = onExpire
    this.lastTickAt = now
    this.startedAt = now

    this.ensureTimer()
    this.notify()
  }

  public pause(): void {
    if (!this.isActive || this.isPaused) return
    this.isPaused = true
    this.clearTimer()
    this.notify()
  }

  public resume(): void {
    if (!this.isActive || !this.isPaused) return
    this.isPaused = false
    this.lastTickAt = this.nowFn()
    this.ensureTimer()
    this.notify()
  }

  /**
   * Nuclear queue purge and stop
   */
  public stop(): void {
    this.clearTimer()
    this.isActive = false
    this.isPaused = false
    this.onExpire = null
    this.remainingSec = this.totalSec
    this.notify()
  }

  /**
   * Adjust remaining and total seconds on the fly without restarting or jittering the timer.
   * e.g., delta = +2 or -2
   */
  public adjustSeconds(delta: number, minSec = 3, maxSec = 600): number {
    const validDelta = Number.isFinite(delta) ? Math.round(delta) : 0
    const nextTotal = Math.max(minSec, Math.min(maxSec, this.totalSec + validDelta))
    const actualDelta = nextTotal - this.totalSec
    this.totalSec = nextTotal
    this.remainingSec = Math.max(1, Math.min(nextTotal, this.remainingSec + actualDelta))
    this.notify()
    return this.totalSec
  }

  public setSeconds(seconds: number, minSec = 3, maxSec = 600): number {
    const clamped = Math.max(minSec, Math.min(maxSec, Math.round(seconds)))
    const diff = clamped - this.totalSec
    return this.adjustSeconds(diff, minSec, maxSec)
  }

  /**
   * Cleanly re-arm the active countdown from the new full duration.
   * Resets remainingSec to totalSec and refreshes lastTickAt without losing onExpire callback.
   */
  public rearm(seconds?: number, minSec = 3, maxSec = 600): number {
    if (seconds !== undefined) {
      const validSec = Number.isFinite(seconds) ? Math.round(seconds) : this.totalSec
      this.totalSec = Math.max(minSec, Math.min(maxSec, validSec))
    }
    this.remainingSec = this.totalSec
    this.lastTickAt = this.nowFn()
    this.ensureTimer()
    this.notify()
    return this.totalSec
  }

  public tick(): void {
    if (!this.isActive || this.isPaused) return

    const now = this.nowFn()
    const rawDeltaMs = Math.max(0, now - this.lastTickAt)
    this.lastTickAt = now

    // 1. Sleep / Hibernate / Process freeze guard:
    // If delta exceeds 3000ms, the system was suspended. Pause cleanly to avoid fast-forwarding pages!
    if (rawDeltaMs > 3000) {
      this.pause()
      return
    }

    // 2. Hardware safety watchdog: 60 minutes continuous unpaused execution
    if (now - this.startedAt >= this.inactivityTimeoutMs) {
      this.pause()
      return
    }

    if (this.remainingSec > 1) {
      this.remainingSec -= 1
      this.notify()
    } else {
      this.remainingSec = 0
      this.clearTimer()
      const cb = this.onExpire
      this.onExpire = null
      this.notify()
      cb?.()
    }
  }

  private ensureTimer(): void {
    if (this.intervalId !== null || this.isPaused || !this.isActive) return
    this.intervalId = setInterval(() => {
      this.tick()
    }, 1000)
  }

  private clearTimer(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }
}
