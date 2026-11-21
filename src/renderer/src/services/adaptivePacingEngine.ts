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

export interface AdaptivePacingState {
  isLearning: boolean
  isCalibrated: boolean
  currentWpm: number
  targetWpm: number
  observedWpm: number
  lastRecalibratedPage: number
  isSkimming: boolean
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
   * Record observed manual reading dwell between page turns.
   * Discards accidental clicks (<800ms) and skimming (>750 WPM) or idling (<60 WPM).
   * Active only once the book passes page 5 (spread 3) to protect against frontmatter skimming.
   */
  public recordManualReading(
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

    // 5. Valid physiological reading sample: Update rolling EMA
    this.isSkimming = false
    this.observedWpm = this.clampWpm(rawObserved)
    this.currentWpm = this.alpha * this.observedWpm + (1 - this.alpha) * this.currentWpm
    this.targetWpm = this.clampWpm(this.currentWpm)
    return true
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
      // Check batch recalibration milestone (every 7 pages / spreads)
      const calibratedStart = isDualSpread ? DUAL_CALIBRATED_SPREAD_START : SINGLE_CALIBRATED_PAGE_START
      const pagesSinceCalibrated = pageIndexOrSpread - calibratedStart

      if (
        this.lastRecalibratedIndex === 0 ||
        pagesSinceCalibrated % BATCH_RECALIBRATION_INTERVAL === 0
      ) {
        this.lastRecalibratedIndex = pageIndexOrSpread
        this.lastBatchWpm = this.currentWpm
      }

      // Calculate dwell from batch WPM and visible words relative to reference spread
      const effectiveWpm = this.lastBatchWpm > 0 ? this.lastBatchWpm : DEFAULT_WPM
      const referenceWords = REFERENCE_PAGE_WORDS * spreadFactor
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
      isSkimming: this.isSkimming
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
  }
}
