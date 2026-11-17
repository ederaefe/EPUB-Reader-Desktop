import { useState, useRef, useEffect, useCallback } from 'react'
import { db, type Book } from '../db'
import { useAppStore } from '../stores/useAppStore'

export type ClimaxEffectKind = 'none' | 'bar-saber' | 'fullscreen-wave'

const CLIMAX_GLOW_STORAGE_KEY = 'semply_climax_glow_triggered_v2'
const CLIMAX_GLOW_MIN_PCT = 75
const CLIMAX_GLOW_MAX_PCT = 85
const BAR_SABER_DURATION_MS = 780 * 3 + 150 // 3 pulses × 780ms + buffer
const FULLSCREEN_WAVE_DURATION_MS = 1500 * 3 + 180 // 3 calm sweeps × 1500ms + buffer

// Module-level session set guarantees fullscreen unmount/remount never re-fires
const sessionTriggeredBookKeys = new Set<string>()

function isValidClimaxTarget(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= CLIMAX_GLOW_MIN_PCT &&
    value <= CLIMAX_GLOW_MAX_PCT
  )
}

function getBookGlowKey(book?: Book | null): string {
  if (!book) return ''
  return `${book.id ?? ''}::${book.filePath || ''}`
}

function readTriggeredLedger(): Set<string> {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return new Set()
    const raw = window.localStorage.getItem(CLIMAX_GLOW_STORAGE_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return new Set(parsed.filter((k): k is string => typeof k === 'string'))
    }
  } catch {
    // Ignore malformed localStorage
  }
  return new Set()
}

function markTriggeredInLedger(bookKey: string): void {
  if (!bookKey) return
  sessionTriggeredBookKeys.add(bookKey)
  try {
    if (typeof window === 'undefined' || !window.localStorage) return
    const set = readTriggeredLedger()
    set.add(bookKey)
    window.localStorage.setItem(CLIMAX_GLOW_STORAGE_KEY, JSON.stringify(Array.from(set)))
  } catch {
    // Ignore storage quota errors
  }
}

function hasGlowAlreadyTriggered(book: Book | null | undefined, bookKey: string): boolean {
  if (!book || !bookKey) return true
  if (book.climaxGlowTriggered && isValidClimaxTarget(book.climaxGlowTarget)) return true
  if (sessionTriggeredBookKeys.has(bookKey)) return true
  return readTriggeredLedger().has(bookKey)
}

/**
 * Unbiased uniform random integer in [75, 85] using crypto rejection sampling.
 */
function pickRandomClimaxPercent(): number {
  const span = CLIMAX_GLOW_MAX_PCT - CLIMAX_GLOW_MIN_PCT + 1 // 11 distinct integers: 75..85
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const limit = Math.floor(0x100000000 / span) * span
    const arr = new Uint32Array(1)
    let val = 0
    do {
      crypto.getRandomValues(arr)
      val = arr[0]
    } while (val >= limit)
    return CLIMAX_GLOW_MIN_PCT + (val % span)
  }
  return CLIMAX_GLOW_MIN_PCT + Math.floor(Math.random() * span)
}

interface UseClimaxEasterEggParams {
  book: Book | null | undefined
  progressPercent: number
  currentPage: number
  totalPages: number
  isImmersiveFullscreen: boolean
}

export function useClimaxEasterEgg({
  book,
  progressPercent,
  currentPage,
  totalPages,
  isImmersiveFullscreen
}: UseClimaxEasterEggParams) {
  const bookKey = getBookGlowKey(book)

  const [climaxTarget, setClimaxTarget] = useState<number>(() =>
    isValidClimaxTarget(book?.climaxGlowTarget)
      ? Math.round(book!.climaxGlowTarget!)
      : pickRandomClimaxPercent()
  )
  const [activeEffect, setActiveEffect] = useState<ClimaxEffectKind>('none')

  const prevEffectivePctRef = useRef<number | null>(null)
  const effectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const persistedTargetKeyRef = useRef<string>('')

  const stopEffect = useCallback(() => {
    setActiveEffect('none')
    if (effectTimeoutRef.current) {
      clearTimeout(effectTimeoutRef.current)
      effectTimeoutRef.current = null
    }
  }, [])

  // Reset tracking and active effects strictly when switching to a different book
  useEffect(() => {
    prevEffectivePctRef.current = null
    stopEffect()
  }, [bookKey, stopEffect])

  // Resolve and persist this book's unique random 75..85 climax target once
  useEffect(() => {
    if (!book || !bookKey) return
    const hadValidTarget = isValidClimaxTarget(book.climaxGlowTarget)
    const resolved = hadValidTarget
      ? Math.round(book.climaxGlowTarget!)
      : pickRandomClimaxPercent()

    setClimaxTarget(resolved)

    if (
      book.id &&
      !hadValidTarget &&
      persistedTargetKeyRef.current !== `${bookKey}::${resolved}`
    ) {
      persistedTargetKeyRef.current = `${bookKey}::${resolved}`
      const patch: Partial<Book> = {
        climaxGlowTarget: resolved,
        ...(book.climaxGlowTriggered ? { climaxGlowTriggered: false } : {})
      }
      db.books.update(book.id, patch).catch(() => {})
      useAppStore.getState().updateActiveBook(patch)
    }
  }, [bookKey, book?.id, book?.climaxGlowTarget, book?.climaxGlowTriggered])

  // Immediately stop fullscreen wave if the user exits fullscreen (and stop bar saber if entering fullscreen)
  useEffect(() => {
    if (activeEffect === 'fullscreen-wave' && !isImmersiveFullscreen) {
      stopEffect()
    } else if (activeEffect === 'bar-saber' && isImmersiveFullscreen) {
      stopEffect()
    }
  }, [activeEffect, isImmersiveFullscreen, stopEffect])

  useEffect(() => {
    return () => {
      if (effectTimeoutRef.current) clearTimeout(effectTimeoutRef.current)
    }
  }, [])

  // Normalized effective progress percentage matching FluidClimaxProgressBar
  const safeTotal = Math.max(1, Math.round(totalPages || 1))
  const safeCurrentPage = Math.max(1, Math.min(safeTotal, Math.round(currentPage || 1)))
  const clampedPct = Math.max(
    0,
    Math.min(100, Number.isFinite(progressPercent) ? progressPercent : 0)
  )
  const derivedPagePct =
    safeTotal > 1 ? ((safeCurrentPage - 1) / (safeTotal - 1)) * 100 : clampedPct
  const effectivePct =
    clampedPct > 0 ? clampedPct : safeCurrentPage > 1 ? Math.max(0.5, derivedPagePct) : 0

  // Trigger strictly once per book when hitting or crossing its random 75..85 climax target
  useEffect(() => {
    if (!book || !bookKey) return

    const prevPct = prevEffectivePctRef.current
    prevEffectivePctRef.current = effectivePct

    if (hasGlowAlreadyTriggered(book, bookKey)) return

    const hitExactTarget = Math.round(effectivePct) === climaxTarget
    const crossedTargetForward =
      prevPct !== null &&
      prevPct < climaxTarget &&
      effectivePct >= climaxTarget &&
      effectivePct <= climaxTarget + 3

    if (!hitExactTarget && !crossedTargetForward) return

    // Lock permanently before launching either visual effect
    markTriggeredInLedger(bookKey)
    if (book.id) {
      db.books
        .update(book.id, { climaxGlowTriggered: true, climaxGlowTarget: climaxTarget })
        .catch(() => {})
    }
    useAppStore.getState().updateActiveBook({
      climaxGlowTriggered: true,
      climaxGlowTarget: climaxTarget
    })

    const nextEffect: ClimaxEffectKind = isImmersiveFullscreen ? 'fullscreen-wave' : 'bar-saber'
    const duration =
      nextEffect === 'fullscreen-wave' ? FULLSCREEN_WAVE_DURATION_MS : BAR_SABER_DURATION_MS

    setActiveEffect(nextEffect)
    if (effectTimeoutRef.current) clearTimeout(effectTimeoutRef.current)
    effectTimeoutRef.current = setTimeout(() => {
      setActiveEffect('none')
      effectTimeoutRef.current = null
    }, duration)
  }, [book, bookKey, climaxTarget, effectivePct, isImmersiveFullscreen])

  return {
    climaxTarget,
    activeEffect,
    stopEffect
  }
}
