// Standalone Smart Adaptive Pacing Engine
// Characteristics:
// 1. Dual-page vs Single-page layout awareness (spreadFactor = 2 in dual mode)
// 2. Passive background learning begins from page 5 (spread 3 in dual mode)
// 3. Formally engages calibrated dynamic pacing at page >= 20 (single) or page >= 22 (dual)
// 4. Recalibrates in predictable batches every 7 pages/spreads
// 5. Strict 10-second minimum dwell floor (Math.max(10, ...))
// 6. 3-second end-of-chapter / section grace buffer
// 7. Physiological Skimming (<800ms / >750 WPM) and Idling (<60 WPM) guard with EMA (alpha = 0.15)

export const REFERENCE_PAGE_WORDS = 180
export const REFERENCE_SPP_WORDS = 180
export const DEFAULT_WPM = 250
export const MIN_WPM = 60
export const MAX_WPM = 750
export const MIN_DWELL_FLOOR_SEC = 10
export const END_OF_CHAPTER_GRACE_SEC = 3
export const BATCH_RECALIBRATION_INTERVAL = 7

// Activation milestones:
// Single page: learn p. 5..19, engage p. >= 20
// Dual page: learn spread 3..10 (p. 5..21), engage spread >= 11 (p. >= 22)
export const SINGLE_LEARNING_PAGE_START = 5
export const SINGLE_CALIBRATED_PAGE_START = 20

export const DUAL_LEARNING_SPREAD_START = 3 // page ~5
export const DUAL_CALIBRATED_SPREAD_START = 11 // page ~22

export interface PageDwellLedgerEntry {
  words: number
  accumulatedMs: number
  visitCount: number
  lastEnteredAt: number
  isRetreatPending?: boolean
}

export interface CommittedSampleSnapshot {
  unit: number
  priorCurrentWpm: number
  priorTargetWpm: number
  priorObservedWpm: number
  priorBatchPagesRead: number
  priorLastBatchWpm: number
  priorLastRecalibratedIndex: number
}

export interface AdaptivePacingState {
  isLearning: boolean
  isCalibrated: boolean
  currentWpm: number
  targetWpm: number
  observedWpm: number
  lastRecalibratedPage: number
  isSkimming: boolean
  readingPaceWpm: number
  readingSpeedSpp: number
  batchProgress: number
}

/**
 * Ultra-fast language-aware word & character counter.
 * Supports CJK ideograms (~0.6 words each) without heavy regex thrashing.
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

  let latinWords = 0
  if (cjkCount < len) {
    const nonCjk = text.replace(/[\u4e00-\u9fff\u3400-\u4dbf\u3040-\u30ff\uac00-\ud7af]/g, ' ')
    latinWords = nonCjk.split(/\s+/).filter(Boolean).length
  }

  let effectiveWords = latinWords + Math.round(cjkCount * 0.6)

  if (hasIllustration && effectiveWords < 15) {
    effectiveWords = 60
  }

  return {
    words: Math.max(1, effectiveWords),
    chars: len,
    isImageOrSparse: effectiveWords < 20
  }
}

export class AdaptivePacingEngine {
  private readonly alpha = 0.15
  private currentWpm = DEFAULT_WPM
  private targetWpm = DEFAULT_WPM
  private observedWpm = DEFAULT_WPM
  private isSkimming = false

  private lastRecalibratedIndex = 0
  private lastBatchWpm = DEFAULT_WPM
  private batchPagesRead = 0
  private lastJumpTimestamp = 0
  private lastNavTimestamp = 0
  private consecutiveRapidFlips = 0
  private lastUnit = 0
  private lastCommittedSample: CommittedSampleSnapshot | null = null
  private pendingBounceRetreat: {
    fromUnit: number
    toUnit: number
    timestamp: number
    savedBatchPagesRead: number
    savedLastRecalibratedIndex: number
  } | null = null

  private readonly pageDwellLedger = new Map<number, PageDwellLedgerEntry>()

  constructor(initialWpm = DEFAULT_WPM) {
    this.currentWpm = this.clampWpm(initialWpm)
    this.targetWpm = this.currentWpm
    this.observedWpm = this.currentWpm
    this.lastBatchWpm = this.currentWpm
  }

  public clampWpm(wpm: number): number {
    return Math.max(MIN_WPM, Math.min(MAX_WPM, Math.round(wpm)))
  }

  public isLearning(pageIndexOrSpread: number, isDualSpread: boolean): boolean {
    const start = isDualSpread ? DUAL_LEARNING_SPREAD_START : SINGLE_LEARNING_PAGE_START
    const calibratedStart = isDualSpread ? DUAL_CALIBRATED_SPREAD_START : SINGLE_CALIBRATED_PAGE_START
    return pageIndexOrSpread >= start && pageIndexOrSpread < calibratedStart
  }

  public isCalibrated(pageIndexOrSpread: number, isDualSpread: boolean): boolean {
    const calibratedStart = isDualSpread ? DUAL_CALIBRATED_SPREAD_START : SINGLE_CALIBRATED_PAGE_START
    return pageIndexOrSpread >= calibratedStart
  }

  /**
   * Reading pace in Words Per Minute.
   */
  public getReadingPaceWpm(): number {
    return Math.round(this.currentWpm)
  }

  /**
   * Reading speed in Seconds Per Page (derived from reference page word count).
   * Enforces strict 10s minimum dwell floor. In dual-spread mode, duration is exactly 2x single-page SPP.
   */
  public getReadingSpeedSpp(isDualSpread = false): number {
    const referenceWords = REFERENCE_PAGE_WORDS
    const wpm = this.currentWpm > 0 ? this.currentWpm : DEFAULT_WPM
    const rawSpp = Math.round((referenceWords / wpm) * 60)
    const singleSpp = Math.max(MIN_DWELL_FLOOR_SEC, rawSpp)
    return isDualSpread ? singleSpp * 2 : singleSpp
  }

  /**
   * Current 1..7 progress within the active calibration batch.
   */
  public getBatchProgress(): number {
    return Math.min(BATCH_RECALIBRATION_INTERVAL, (this.batchPagesRead % BATCH_RECALIBRATION_INTERVAL) + 1)
  }

  public getBatchPagesRead(): number {
    return this.batchPagesRead
  }

  public getPageDwellLedger(): ReadonlyMap<number, PageDwellLedgerEntry> {
    return this.pageDwellLedger
  }

  /**
   * Reset active 7-page calibration batch (triggered by rapid scrub or discontinuous jumps).
   */
  public resetBatch(newUnit?: number): void {
    this.batchPagesRead = 0
    this.consecutiveRapidFlips = 0
    this.lastCommittedSample = null
    if (newUnit !== undefined) {
      this.lastRecalibratedIndex = newUnit
      this.lastUnit = newUnit
    }
    this.lastJumpTimestamp = Date.now()
  }

  /**
   * Roll back premature flip velocity mutation if the reader immediately retreats.
   */
  public rollbackPrematureSample(): void {
    if (!this.lastCommittedSample) return
    this.currentWpm = this.lastCommittedSample.priorCurrentWpm
    this.targetWpm = this.lastCommittedSample.priorTargetWpm
    this.observedWpm = this.lastCommittedSample.priorObservedWpm
    this.batchPagesRead = this.lastCommittedSample.priorBatchPagesRead
    this.lastBatchWpm = this.lastCommittedSample.priorLastBatchWpm
    this.lastRecalibratedIndex = this.lastCommittedSample.priorLastRecalibratedIndex
    this.isSkimming = false
    this.lastCommittedSample = null
  }

  /**
   * Mark a page unit as re-entered via retreat.
   */
  public markRetreat(unit: number): void {
    // If a sample was prematurely committed on this unit, roll it back to prevent locking in premature pace
    if (this.lastCommittedSample && this.lastCommittedSample.unit === unit) {
      this.rollbackPrematureSample()
    }
    const prior = this.pageDwellLedger.get(unit)
    if (prior) {
      prior.isRetreatPending = true
      prior.lastEnteredAt = Date.now()
    } else {
      this.pageDwellLedger.set(unit, {
        words: 0,
        accumulatedMs: 0,
        visitCount: 1,
        lastEnteredAt: Date.now(),
        isRetreatPending: true
      })
    }
  }

  /**
   * Process a valid physiological reading sample into the velocity model and batch recalibration.
   */
  public processReadingSample(
    pageIndexOrSpread: number,
    wordCount: number,
    elapsedMs: number,
    isDualSpread = false
  ): boolean {
    // 1. Guard against frontmatter/copyright/TOC skimming before page 5 (spread 3)
    const learningStart = isDualSpread ? DUAL_LEARNING_SPREAD_START : SINGLE_LEARNING_PAGE_START
    if (pageIndexOrSpread < learningStart) {
      return false
    }

    // 2. Physical fixation minimum: Dwells under 800ms or very low word count are accidental clicks
    if (elapsedMs < 800 || wordCount < 30) {
      return false
    }

    const elapsedMinutes = elapsedMs / 60000
    const rawObserved = wordCount / elapsedMinutes

    // 3. Skimming Protector: If observed speed exceeds 750 WPM
    if (rawObserved > MAX_WPM) {
      this.isSkimming = true
      this.observedWpm = this.clampWpm(rawObserved)
      return false
    }

    // 4. Idling Protector: Below 60 WPM represents distraction or pausing
    if (rawObserved < MIN_WPM) {
      return false
    }

    // Snapshot state before mutation so immediate single retreats can cleanly rollback premature flip
    this.lastCommittedSample = {
      unit: pageIndexOrSpread,
      priorCurrentWpm: this.currentWpm,
      priorTargetWpm: this.targetWpm,
      priorObservedWpm: this.observedWpm,
      priorBatchPagesRead: this.batchPagesRead,
      priorLastBatchWpm: this.lastBatchWpm,
      priorLastRecalibratedIndex: this.lastRecalibratedIndex
    }

    // 5. Valid physiological reading sample: Update rolling EMA
    this.isSkimming = false
    this.observedWpm = this.clampWpm(rawObserved)
    this.currentWpm = this.alpha * this.observedWpm + (1 - this.alpha) * this.currentWpm
    this.targetWpm = this.clampWpm(this.currentWpm)

    // Increment batch progress and recalibrate at 7-page milestone
    this.batchPagesRead++
    const calibratedStart = isDualSpread ? DUAL_CALIBRATED_SPREAD_START : SINGLE_CALIBRATED_PAGE_START
    if (pageIndexOrSpread >= calibratedStart) {
      if (this.batchPagesRead >= BATCH_RECALIBRATION_INTERVAL) {
        this.lastRecalibratedIndex = pageIndexOrSpread
        this.lastBatchWpm = this.currentWpm
        this.batchPagesRead = 0
      }
    }

    return true
  }

  /**
   * Record page visit dwell with retreat accumulation and rapid scrub batch reset.
   *
   * @param unit Page index or spread index being left
   * @param words Word count of the page/spread
   * @param elapsedMs Duration spent on this page/spread in ms
   * @param isRetreat True if the navigation was an immediate step back (ΔUnit = -1) or accumulated retreat
   * @param isScrub True if rapid multi-page browsing was detected (|ΔUnit| >= 2, or rapid scrubbing)
   * @param isDualSpread Whether dual spread mode is active
   */
  public recordPageDwell(
    unit: number,
    words: number,
    elapsedMs: number,
    isRetreat: boolean,
    isScrub: boolean,
    isDualSpread = false
  ): boolean {
    if (isScrub) {
      // Exclude scrubbing from speed profile and restart calibration batch
      this.resetBatch(unit)
      return false
    }

    const prior = this.pageDwellLedger.get(unit)
    const accumulatedMs = (isRetreat && prior ? prior.accumulatedMs : 0) + elapsedMs
    const visitCount = (prior?.visitCount ?? 0) + 1

    this.pageDwellLedger.set(unit, {
      words,
      accumulatedMs,
      visitCount,
      lastEnteredAt: Date.now(),
      isRetreatPending: false
    })

    // Prune ledger to latest 30 entries to strictly cap memory
    if (this.pageDwellLedger.size > 30) {
      const oldestKey = this.pageDwellLedger.keys().next().value
      if (oldestKey !== undefined) {
        this.pageDwellLedger.delete(oldestKey)
      }
    }

    return this.processReadingSample(unit, words, accumulatedMs, isDualSpread)
  }

  /**
   * Record observed manual reading dwell between page turns.
   * Supports immediate retreat dwell accumulation (isRetreat = true).
   */
  public recordManualReading(
    pageIndexOrSpread: number,
    wordCount: number,
    elapsedMs: number,
    isDualSpread = false,
    isRetreat = false
  ): boolean {
    if (isRetreat) {
      this.markRetreat(pageIndexOrSpread)
    }
    return this.recordPageDwell(pageIndexOrSpread, wordCount, elapsedMs, isRetreat, false, isDualSpread)
  }

  /**
   * Evaluate a page navigation transition between fromUnit and toUnit.
   * Automatically classifies immediate single-page retreats vs multi-page rapid scrubbing.
   */
  public recordNavigation(
    fromUnit: number,
    toUnit: number,
    words: number,
    elapsedMs: number,
    isDualSpread = false
  ): { isRetreat: boolean; isScrub: boolean; updated: boolean } {
    const delta = toUnit - fromUnit
    const now = Date.now()
    const isInitialNav = this.lastNavTimestamp === 0
    const timeSinceLastNav = isInitialNav ? 0 : now - this.lastNavTimestamp
    this.lastNavTimestamp = now

    // 0. Accidental Bounce / Fat-Finger Retreat Guard:
    // If user stepped back 2 pages and immediately advances 1 page within <= 1500ms,
    // recognize as accidental bounce rather than a deliberate multi-page scrub, preserving batch progress.
    if (
      this.pendingBounceRetreat &&
      fromUnit === this.pendingBounceRetreat.toUnit &&
      toUnit === this.pendingBounceRetreat.toUnit + 1 &&
      now - this.pendingBounceRetreat.timestamp <= 1500
    ) {
      this.batchPagesRead = this.pendingBounceRetreat.savedBatchPagesRead
      this.lastRecalibratedIndex = this.pendingBounceRetreat.savedLastRecalibratedIndex
      this.pendingBounceRetreat = null
      this.consecutiveRapidFlips = 0
      this.lastUnit = toUnit
      return { isRetreat: false, isScrub: false, updated: false }
    }

    if (this.pendingBounceRetreat && (now - this.pendingBounceRetreat.timestamp > 1500 || delta !== 1)) {
      this.pendingBounceRetreat = null
    }

    // Step back 2 pages candidate for accidental bounce
    if (delta === -2) {
      this.pendingBounceRetreat = {
        fromUnit,
        toUnit,
        timestamp: now,
        savedBatchPagesRead: this.batchPagesRead,
        savedLastRecalibratedIndex: this.lastRecalibratedIndex
      }
      this.consecutiveRapidFlips = 0
      this.resetBatch(toUnit)
      return { isRetreat: true, isScrub: true, updated: false }
    }

    // 1. Detect rapid scrub / discontinuous jump:
    // Discontinuous jump (|delta| >= 2) OR sequential rapid flips (2+ consecutive flips in < 2500ms with < 4000ms interval)
    const isDiscontinuous = Math.abs(delta) >= 2
    const isFastDwell = elapsedMs < 2500
    const isRapidFlip = Math.abs(delta) === 1 && isFastDwell && timeSinceLastNav < 4000

    if (isRapidFlip) {
      this.consecutiveRapidFlips++
    } else if (elapsedMs >= 2500 || timeSinceLastNav >= 4000) {
      this.consecutiveRapidFlips = 0
    }

    const isRapidScrub = isDiscontinuous || this.consecutiveRapidFlips >= 2

    if (isRapidScrub) {
      this.consecutiveRapidFlips = 0
      this.resetBatch(toUnit)
      return { isRetreat: false, isScrub: true, updated: false }
    }

    // 2. Detect single-unit retreat (delta === -1)
    if (delta === -1) {
      this.markRetreat(toUnit)
      return { isRetreat: true, isScrub: false, updated: false }
    }

    // 3. Normal forward progression: accumulate dwell if prior retreat exists
    const prior = this.pageDwellLedger.get(fromUnit)
    const isAccumulatedRetreat = Boolean(prior && (prior.isRetreatPending || prior.accumulatedMs > 0))
    const updated = this.recordPageDwell(
      fromUnit,
      words,
      elapsedMs,
      isAccumulatedRetreat,
      false,
      isDualSpread
    )
    this.lastUnit = toUnit
    return { isRetreat: false, isScrub: false, updated }
  }

  /**
   * Compute dynamic dwell duration in seconds for a page or spread.
   * Guarantees:
   * - Strict 10-second minimum dwell floor
   * - Batch calibration cadence (recalibrates every 7 pages)
   * - Graceful single-page vs dual-page spreadFactor
   * - 3-second grace buffer at chapter ends / section breaks
   */
  public computeDwellSeconds(
    pageIndexOrSpread: number,
    visibleWords: number,
    isDualSpread: boolean,
    hasBreakOrChapterEnd: boolean,
    userBaseSec = 25
  ): number {
    const spreadFactor = isDualSpread ? 2 : 1
    const calibrated = this.isCalibrated(pageIndexOrSpread, isDualSpread)

    let baseDurationSec: number

    if (!calibrated) {
      // Pages 1-19 (or spreads 1-10): Run safely on user base duration without fluctuating
      baseDurationSec = userBaseSec * spreadFactor
    } else {
      // Page >= 20 (or spread >= 11): Calibrated dynamic pacing engaged
      // Check batch recalibration milestone (every 7 pages / spreads or 7 pages from user anchor)
      const calibratedStart = isDualSpread ? DUAL_CALIBRATED_SPREAD_START : SINGLE_CALIBRATED_PAGE_START
      const pagesSinceCalibrated = pageIndexOrSpread - calibratedStart
      const pagesSinceLastBatch =
        this.lastRecalibratedIndex > 0 ? pageIndexOrSpread - this.lastRecalibratedIndex : -1

      if (
        this.lastRecalibratedIndex === 0 ||
        (pagesSinceCalibrated >= 0 && pagesSinceCalibrated % BATCH_RECALIBRATION_INTERVAL === 0) ||
        (pagesSinceLastBatch >= BATCH_RECALIBRATION_INTERVAL)
      ) {
        this.lastRecalibratedIndex = pageIndexOrSpread
        this.lastBatchWpm = this.currentWpm
      }

      // Calculate dwell from batch WPM and visible words relative to reference spread
      const effectiveWpm = this.lastBatchWpm > 0 ? this.lastBatchWpm : DEFAULT_WPM
      const words = Math.max(20 * spreadFactor, visibleWords)

      // Time in seconds to read the visible words at the calibrated batch WPM
      const calculatedSec = Math.round((words / effectiveWpm) * 60)
      baseDurationSec = calculatedSec
    }

    // Apply strict 10-second minimum dwell floor
    let finalSec = Math.max(MIN_DWELL_FLOOR_SEC, baseDurationSec)

    // Append 3-second end-of-chapter dwell grace buffer if section break or chapter finish detected
    if (hasBreakOrChapterEnd) {
      finalSec += END_OF_CHAPTER_GRACE_SEC
    }

    return finalSec
  }

  public getState(pageIndexOrSpread: number, isDualSpread: boolean): AdaptivePacingState {
    return {
      isLearning: this.isLearning(pageIndexOrSpread, isDualSpread),
      isCalibrated: this.isCalibrated(pageIndexOrSpread, isDualSpread),
      currentWpm: Math.round(this.currentWpm),
      targetWpm: Math.round(this.targetWpm),
      observedWpm: Math.round(this.observedWpm),
      lastRecalibratedPage: this.lastRecalibratedIndex,
      isSkimming: this.isSkimming,
      readingPaceWpm: this.getReadingPaceWpm(),
      readingSpeedSpp: this.getReadingSpeedSpp(isDualSpread),
      batchProgress: this.getBatchProgress()
    }
  }

  public setTargetWpm(wpm: number): void {
    const clamped = this.clampWpm(wpm)
    this.targetWpm = clamped
    this.currentWpm = clamped
    this.lastBatchWpm = clamped
  }

  public syncBaseSeconds(baseSec: number): void {
    const clampedSec = Math.max(MIN_DWELL_FLOOR_SEC, Math.round(baseSec))
    const derivedWpm = this.clampWpm((REFERENCE_PAGE_WORDS / clampedSec) * 60)
    this.targetWpm = derivedWpm
    this.currentWpm = derivedWpm
    this.lastBatchWpm = derivedWpm
  }

  public reset(wpm = DEFAULT_WPM): void {
    const clamped = this.clampWpm(wpm)
    this.currentWpm = clamped
    this.targetWpm = clamped
    this.observedWpm = clamped
    this.lastBatchWpm = clamped
    this.lastRecalibratedIndex = 0
    this.isSkimming = false
    this.batchPagesRead = 0
    this.lastJumpTimestamp = 0
    this.lastNavTimestamp = 0
    this.consecutiveRapidFlips = 0
    this.lastUnit = 0
    this.lastCommittedSample = null
    this.pendingBounceRetreat = null
    this.pageDwellLedger.clear()
  }
}
