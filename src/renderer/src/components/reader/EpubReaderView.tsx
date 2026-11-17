import React, { useEffect, useRef, useState, useCallback } from 'react'
import ePub, { Book as EpubBook, Rendition } from 'epubjs'
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  FileText,
  BookOpen,
  Languages,
  Volume2,
  Bookmark,
  Zap,
  Gauge,
  Maximize2,
  Minimize2,
  Settings
} from 'lucide-react'
import { useAppStore } from '../../stores/useAppStore'
import { db, type Book } from '../../db'
import { ReaderTopBar } from './ReaderTopBar'
import { TOCDrawer, type TocItem } from '../drawers/TOCDrawer'
import { NotesDrawer } from '../drawers/NotesDrawer'
import { BookmarksDrawer } from '../drawers/BookmarksDrawer'
import { SearchDrawer, type SearchMatch } from '../drawers/SearchDrawer'
import { SettingsDrawer } from '../drawers/SettingsDrawer'
import { SelectionPopup } from './SelectionPopup'
import { FootnotePopover } from './FootnotePopover'
import { AdaptiveScrollOverlay } from './AdaptiveScrollOverlay'
import { RSVPSpeedReaderModal } from './RSVPSpeedReaderModal'
import { ContextMenu, type ContextMenuItem } from '../ui/ContextMenu'
import { adaptiveScrollEngine } from '../../services/adaptiveScrollService'
import { getWarmFilterOverlay } from '../../services/colorTempService'
import { splitIntoSentences, ttsService } from '../../services/ttsService'

interface EpubReaderViewProps {
  book: Book
  onBack: () => void
}

export const EpubReaderView: React.FC<EpubReaderViewProps> = ({ book, onBack }) => {
  const viewerRef = useRef<HTMLDivElement>(null)
  const epubBookRef = useRef<EpubBook | null>(null)
  const renditionRef = useRef<Rendition | null>(null)

  const {
    settings,
    updateSettings,
    activeBookBuffer,
    isTTSActive,
    setTTSActive,
    isAutoscrollActive,
    setAutoscrollActive,
    isRSVPActive,
    toggleRSVP,
    activeFootnote,
    setActiveFootnote,
    isTOCDrawerOpen,
    toggleTOCDrawer,
    isBookmarksDrawerOpen,
    toggleBookmarksDrawer,
    isNotesDrawerOpen,
    toggleNotesDrawer,
    isSearchDrawerOpen,
    toggleSearchDrawer,
    isSettingsDrawerOpen,
    toggleSettingsDrawer,
    isFullSettingsModalOpen,
    setCurrentChapterTitle,
    isImmersiveFullscreen,
    setImmersiveFullscreen
  } = useAppStore()

  const [toc, setToc] = useState<TocItem[]>([])
  const tocRef = useRef<TocItem[]>([])
  tocRef.current = toc
  const [searchFocusNonce, setSearchFocusNonce] = useState(0)
  const activeSearchHighlightCfiRef = useRef<string | null>(null)
  const openSearchDrawerRef = useRef<() => void>(() => {})
  openSearchDrawerRef.current = () => {
    toggleSearchDrawer(true)
    setSearchFocusNonce((n) => n + 1)
  }
  const [currentChapter, setCurrentChapter] = useState('')
  const [currentHref, setCurrentHref] = useState('')
  const [currentCfi, setCurrentCfi] = useState<string>(book.progressCfi || '')
  const [currentPage, setCurrentPage] = useState<number>(book.currentPage || 1)
  const [totalPages, setTotalPages] = useState<number>(book.totalPages || 1)
  const [progressPercent, setProgressPercent] = useState<number>(book.progressPercent || 0)

  const [selectedText, setSelectedText] = useState<string | null>(null)
  const [selectedCfiRange, setSelectedCfiRange] = useState<string>('')
  const [selectionPos, setSelectionPos] = useState({ x: 0, y: 0 })
  const [isBottomHovered, setIsBottomHovered] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; items: ContextMenuItem[] } | null>(null)
  const openContextMenuRef = useRef<(x: number, y: number, text?: string, cfiRange?: string) => void>(() => {})

  // Scrubber & pagination synchronization refs
  const isScrubbingRef = useRef(false)
  const scrubDebounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const totalPagesRef = useRef(totalPages)
  totalPagesRef.current = totalPages
  const currentCfiRef = useRef(currentCfi)
  currentCfiRef.current = currentCfi
  const [chapterFullText, setChapterFullText] = useState('')

  // Real-time manual reading cadence profiler refs
  const pageEnteredAtRef = useRef<number>(Date.now())
  const lastWordsOnPageRef = useRef<number>(180)

  // Theme palettes matching Semply Reader
  const themeStyles = {
    day: { bg: '#ffffff', text: '#202020', link: '#2a69df', bottomBg: '#f2f2f2', border: '#e1e4e8' },
    night: { bg: '#1c1f26', text: '#d8d8d8', link: '#79c0ff', bottomBg: '#14161c', border: '#232732' },
    'light-sepia': { bg: '#fbf0d9', text: '#5f4b32', link: '#8b5a2b', bottomBg: '#f2e5cb', border: '#e2d3b5' },
    'dark-sepia': { bg: '#2d261e', text: '#d5c7b3', link: '#e6c8a5', bottomBg: '#211c16', border: '#3d3429' }
  }

  const currentTheme = themeStyles[settings.theme] || themeStyles.night

  // Feature 5: Warm Blue Light Night Filter style
  const warmFilter = getWarmFilterOverlay(
    settings.warmFilterEnabled || false,
    settings.warmFilterTemp || 3200,
    settings.warmFilterIntensity || 40
  )

  // Attach smart footnote click interception and cadence wheel listener to iframe
  const attachIframeHooks = useCallback((contents: any) => {
    const doc = contents.document
    if (!doc) return

    // Feature 4: Smart footnote interception
    const noteLinks = doc.querySelectorAll(
      'a[epub\\:type~="noteref"], a[href*="#fn"], a[href*="#footnote"], a[role="doc-noteref"], sup a'
    )

    noteLinks.forEach((link: any) => {
      // Idle suspension on hovering over footnote links
      link.addEventListener('mouseenter', () => {
        adaptiveScrollEngine.setSuspension('footnote', true)
      })
      link.addEventListener('mouseleave', () => {
        adaptiveScrollEngine.setSuspension('footnote', false)
      })

      link.addEventListener('click', async (e: MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        const href = link.getAttribute('href') || ''
        const hash = href.includes('#') ? href.split('#')[1] : ''
        let noteText = ''
        if (hash) {
          const targetElem = doc.getElementById(hash)
          if (targetElem) {
            noteText = targetElem.innerText.trim()
          } else if (epubBookRef.current) {
            // Target might be in a separate endnotes chapter file
            try {
              const targetDocPath = href.split('#')[0]
              if (targetDocPath) {
                const section = (epubBookRef.current.spine as any)?.get?.(targetDocPath) ||
                  (epubBookRef.current as any)?.section?.(targetDocPath)
                if (section) {
                  const loadedDoc = await section.load((epubBookRef.current as any).load.bind(epubBookRef.current))
                  const el = loadedDoc?.getElementById(hash)
                  if (el) noteText = el.innerText.trim()
                }
              }
            } catch (err) {
              console.warn('Cross-document footnote load error:', err)
            }
          }
        }
        if (!noteText) {
          noteText = link.getAttribute('title') || link.innerText || 'Footnote reference.'
        }
        setActiveFootnote({
          id: hash || 'fn',
          index: link.innerText.trim() || 'fn',
          text: noteText,
          href
        })
      })
    })

    // Feature 1: Cadence Behavioral Correction Wheel Listener (Adaptive mode only) & Inactivity Watchdog
    let lastWheelTime = 0
    contents.window.addEventListener('wheel', (e: WheelEvent) => {
      adaptiveScrollEngine.recordUserActivity()
      const now = Date.now()
      if (now - lastWheelTime < 200) return
      lastWheelTime = now

      const state = useAppStore.getState()
      const mode = state.settings.autoscrollMode ?? (state.settings.autoscrollAdaptive === false ? 'countdown' : 'adaptive')
      if (!state.isAutoscrollActive || mode !== 'adaptive') return

      if (e.deltaY < -25) {
        // Back-scroll detected: User scrolled up -> decrease WPM (-15%)
        adaptiveScrollEngine.onBackScrollDetected()
      } else if (e.deltaY > 25) {
        // Forward nudge detected: User scrolling forward -> increase WPM (+10%)
        adaptiveScrollEngine.onForwardNudgeDetected()
      }
    }, { passive: true })

    // Throttled iframe user-activity feed for the 5-minute inactivity auto-pause watchdog
    let lastIframeActivityAt = 0
    const recordIframeActivity = () => {
      const now = Date.now()
      if (now - lastIframeActivityAt < 1000) return
      lastIframeActivityAt = now
      adaptiveScrollEngine.recordUserActivity()
    }
    contents.window.addEventListener('pointermove', recordIframeActivity, { passive: true })
    contents.window.addEventListener('mousedown', recordIframeActivity, { passive: true })
    contents.window.addEventListener('keydown', recordIframeActivity, { passive: true })
    contents.window.addEventListener('touchstart', recordIframeActivity, { passive: true })

    // Close context menu on left click or Escape inside the EPUB iframe
    doc.addEventListener('mousedown', (e: MouseEvent) => {
      if (e.button === 0) {
        setContextMenu(null)
      }
    })
    contents.window.addEventListener('keydown', (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        e.stopPropagation()
        openSearchDrawerRef.current()
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        e.stopPropagation()
        useAppStore.getState().toggleBookmarksDrawer(true)
      } else if (e.key === 'Escape') {
        setContextMenu(null)
        const st = useAppStore.getState()
        if (st.isSearchDrawerOpen || st.isTOCDrawerOpen || st.isBookmarksDrawerOpen || st.isNotesDrawerOpen || st.isSettingsDrawerOpen) {
          st.toggleSearchDrawer(false)
          st.toggleTOCDrawer(false)
          st.toggleBookmarksDrawer(false)
          st.toggleNotesDrawer(false)
          st.toggleSettingsDrawer(false)
        } else if (st.isImmersiveFullscreen) {
          st.setImmersiveFullscreen(false)
          window.desktopAPI?.setFullscreen?.(false)
        }
      } else if (e.key === 'F11') {
        e.preventDefault()
        const next = !useAppStore.getState().isImmersiveFullscreen
        useAppStore.getState().setImmersiveFullscreen(next)
        window.desktopAPI?.setFullscreen?.(next)
      }
    })

    // Right-click context menu inside the EPUB iframe
    doc.addEventListener('contextmenu', (e: MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()

      const frameRect = (contents.window.frameElement as HTMLElement | null)?.getBoundingClientRect()
        || viewerRef.current?.getBoundingClientRect()
      const clickX = (frameRect?.left || 0) + e.clientX
      const clickY = (frameRect?.top || 0) + e.clientY

      const sel = contents.window.getSelection()
      const text = sel?.toString().trim() || ''
      let cfiRange = ''
      if (text && sel && sel.rangeCount > 0) {
        try {
          cfiRange = contents.cfiFromRange(sel.getRangeAt(0)) || ''
        } catch {
          cfiRange = ''
        }
      }

      openContextMenuRef.current(clickX, clickY, text, cfiRange)
    })
  }, [setActiveFootnote])

  // Initialize ePub reader engine
  useEffect(() => {
    let isCancelled = false
    let epubInstance: EpubBook | null = null
    let renditionInstance: Rendition | null = null

    async function initReader() {
      if (!viewerRef.current) return
      viewerRef.current.innerHTML = ''

      let sourceData: any = activeBookBuffer
      if (!sourceData) {
        try {
          const resp = await fetch(book.filePath)
          sourceData = await resp.arrayBuffer()
        } catch {
          sourceData = book.filePath
        }
      }

      epubInstance = ePub(sourceData)
      epubBookRef.current = epubInstance

      // 1:1 Dual page spread support
      const isDouble = settings.pageSpread === 'double'
      renditionInstance = epubInstance.renderTo(viewerRef.current, {
        width: '100%',
        height: '100%',
        spread: isDouble ? 'always' : 'none',
        flow: 'paginated',
        minSpreadWidth: 800
      })
      renditionRef.current = renditionInstance

      // Register themes with exact CSS injection
      const registerThemes = () => {
        const fontFam =
          settings.fontFamily === 'serif'
            ? 'Georgia, serif'
            : settings.fontFamily === 'sans-serif'
            ? '"Segoe UI", sans-serif'
            : settings.fontFamily === 'monospace'
            ? 'Consolas, monospace'
            : 'inherit'

        const baseRules = {
          'html, body': {
            'font-family': `${fontFam} !important`,
            'font-size': `${settings.fontSize}px !important`,
            margin: '0 auto !important',
            padding: '24px 32px !important'
          },
          p: {
            'line-height': `${Math.round(settings.lineHeight * 100)}% !important`,
            'margin-bottom': '1em !important'
          },
          'span.bluenote': { 'background-color': '#aed9f1 !important', color: '#111 !important' },
          'span.purplenote': { 'background-color': '#ccb8e4 !important', color: '#111 !important' },
          'span.rednote': { 'background-color': '#f3a2a2 !important', color: '#111 !important' },
          'span.yellownote': { 'background-color': '#f3e3a2 !important', color: '#111 !important' },
          'span.greennote': { 'background-color': '#b1f3a4 !important', color: '#111 !important' },
          'span.underlinenote': { 'text-decoration': 'underline !important' },
          'span.speechActive': { 'background-color': '#f3e3a2 !important', color: '#111 !important' }
        }

        renditionInstance!.themes.register('night', {
          ...baseRules,
          body: { background: '#1c1f26 !important', color: '#d8d8d8 !important' },
          'p, div, span, li, blockquote': { color: '#d8d8d8 !important' },
          'h1, h2, h3, h4, h5': { color: '#f0f6fc !important' },
          a: { color: '#79c0ff !important' }
        })

        renditionInstance!.themes.register('day', {
          ...baseRules,
          body: { background: '#ffffff !important', color: '#202020 !important' },
          'p, div, span, li, blockquote': { color: '#202020 !important' },
          'h1, h2, h3, h4, h5': { color: '#000000 !important' },
          a: { color: '#2a69df !important' }
        })

        renditionInstance!.themes.register('light-sepia', {
          ...baseRules,
          body: { background: '#fbf0d9 !important', color: '#5f4b32 !important' },
          'p, div, span, li, blockquote': { color: '#5f4b32 !important' },
          'h1, h2, h3, h4, h5': { color: '#433422 !important' },
          a: { color: '#8b5a2b !important' }
        })

        renditionInstance!.themes.register('dark-sepia', {
          ...baseRules,
          body: { background: '#2d261e !important', color: '#d5c7b3 !important' },
          'p, div, span, li, blockquote': { color: '#d5c7b3 !important' },
          'h1, h2, h3, h4, h5': { color: '#ede3d5 !important' },
          a: { color: '#e6c8a5 !important' }
        })

        renditionInstance!.themes.select(settings.theme)
      }

      registerThemes()

      // Hook iframe rendered content
      renditionInstance.hooks.content.register((contents: any) => {
        attachIframeHooks(contents)
      })

      // Load Navigation TOC
      epubInstance.loaded.navigation.then((nav) => {
        if (isCancelled) return
        const items: TocItem[] = nav.toc.map((item, i) => ({
          id: item.id || `toc_${i}`,
          label: item.label,
          href: item.href
        }))
        setToc(items)
      })

      // Generate spine locations
      epubInstance.ready.then(() => {
        if (isCancelled) return
        return epubInstance?.locations.generate(1000)
      }).then(() => {
        if (isCancelled) return
        const total = (epubInstance?.locations as any)?.total || 416
        setTotalPages(total)
        // Immediately sync page numbers once locations finish generating
        const loc = renditionInstance?.currentLocation() as any
        if (loc && loc.start) {
          const currentLoc = (epubInstance.locations as any).locationFromCfi(loc.start.cfi)
          const currentPct = epubInstance.locations.percentageFromCfi(loc.start.cfi)
          const numLoc = typeof currentLoc === 'number' ? currentLoc : Number(currentLoc)
          if (!isNaN(numLoc) && numLoc > 0) {
            setCurrentPage(numLoc)
          }
          if (currentPct != null && !isNaN(currentPct)) {
            setProgressPercent(Math.min(100, Math.max(0, Math.round(currentPct * 100))))
          }
        }
      }).catch(() => {})

      // Display initial position
      const startLocation = book.progressCfi || undefined
      await renditionInstance.display(startLocation)

      // Inject Librera CSS normalization layer
      fetch('/src/assets/app-Librera.css')
        .then((res) => res.text())
        .then((css) => {
          if (isCancelled) return
          ;(renditionInstance?.getContents() as any)?.forEach?.((contents: any) => {
            const style = contents.document.createElement('style')
            style.textContent = css
            contents.document.head.appendChild(style)
          })
        })
        .catch(() => {})

      // Relocation listener
      renditionInstance.on('relocated', (location: any) => {
        if (isCancelled || !location || !location.start) return
        const cfi = location.start.cfi
        setCurrentCfi(cfi)

        let page = 1
        let pct = 0

        // 1. If epub.js locations are generated, use accurate location & percentage from CFI
        if (epubInstance?.locations?.length()) {
          const rawLoc = (epubInstance.locations as any).locationFromCfi(cfi)
          const numLoc = typeof rawLoc === 'number' ? rawLoc : Number(rawLoc)
          if (!isNaN(numLoc) && numLoc > 0) {
            page = numLoc
          }
          const rawPct = epubInstance.locations.percentageFromCfi(cfi)
          if (rawPct != null && !isNaN(rawPct)) {
            pct = Math.min(100, Math.max(0, Math.round(rawPct * 100)))
          }
        } else if (location.start.location != null && Number(location.start.location) > 0) {
          page = Number(location.start.location)
          pct = Math.round((location.start.percentage || 0) * 100)
        } else {
          // 2. Fallback: Proportional progress based on spine index and section pages
          const spineTotal = (epubInstance?.spine as any)?.length || (epubInstance?.spine as any)?.spineItems?.length || 1
          const spineIdx = location.start.index ?? 0
          const secPage = location.start.displayed?.page || 1
          const secTotal = Math.max(1, location.start.displayed?.total || 1)
          const progressRatio = (spineIdx + ((secPage - 1) / secTotal)) / Math.max(1, spineTotal)
          pct = Math.min(100, Math.max(0, Math.round(progressRatio * 100)))
          const bookTotal = (epubInstance?.locations as any)?.total || totalPages || (book.totalPages || 507)
          page = Math.min(bookTotal, Math.max(1, Math.round(progressRatio * bookTotal)))
        }

        setProgressPercent(pct)
        setCurrentPage(page)

        if (location.start.href) {
          setCurrentHref(location.start.href)
          const matching = toc.find((t) => location.start.href.includes(t.href))
          const chapterLabel = matching ? matching.label : ''
          if (chapterLabel) {
            setCurrentChapter(chapterLabel)
            setCurrentChapterTitle(chapterLabel)
          }
        }

        // Feature 1: Record manual reading cadence between page turns (using live store state)
        const now = Date.now()
        const elapsedMs = now - pageEnteredAtRef.current
        const prevWords = lastWordsOnPageRef.current
        if (!useAppStore.getState().isAutoscrollActive && elapsedMs >= 2000 && elapsedMs <= 300000 && prevWords > 10) {
          adaptiveScrollEngine.recordManualReading(prevWords, elapsedMs)
        }
        pageEnteredAtRef.current = now

        // Cache chapter full text and accurately estimate words visible on the current page/spread
        const iframeDoc = (renditionInstance?.getContents()?.[0] as any)?.document
        const pageText = iframeDoc?.body?.innerText || ''
        if (pageText) {
          setChapterFullText(pageText)
          let visibleWords = 0
          try {
            if (location.start?.cfi && location.end?.cfi) {
              const visibleRange = (epubInstance as any)?.getRange?.(location.start.cfi, location.end.cfi)
              const rangeText = visibleRange?.toString?.() || ''
              visibleWords = rangeText.split(/\s+/).filter(Boolean).length
            }
          } catch {}
          if (visibleWords <= 0) {
            const chapterWords = pageText.split(/\s+/).filter(Boolean).length
            const secPages = Math.max(1, location.start?.displayed?.total || 1)
            visibleWords = Math.round(chapterWords / secPages) || 150
          }
          lastWordsOnPageRef.current = visibleWords
        }

        if (book.id) {
          db.books.update(book.id, {
            progressCfi: cfi,
            progressPercent: pct,
            currentPage: page,
            lastOpenedAt: Date.now()
          })
        }
      })

      // Selection listener for notes & highlights
      renditionInstance.on('selected', (cfiRange: string, contents: any) => {
        if (isCancelled) return
        const selection = contents.window.getSelection()
        const text = selection?.toString().trim()
        if (text) {
          setSelectedText(text)
          setSelectedCfiRange(cfiRange)
          const range = selection?.getRangeAt(0)
          const rect = range?.getBoundingClientRect()
          const iframeRect = viewerRef.current?.getBoundingClientRect()
          if (rect && iframeRect) {
            setSelectionPos({
              x: iframeRect.left + rect.left + rect.width / 2,
              y: iframeRect.top + rect.top
            })
          }
        }
      })
    }

    initReader()

    return () => {
      isCancelled = true
      renditionInstance?.destroy()
    }
  }, [book, activeBookBuffer, settings.pageSpread, attachIframeHooks])

  // Synchronize dynamic settings
  useEffect(() => {
    if (!renditionRef.current) return
    renditionRef.current.themes.select(settings.theme)
    renditionRef.current.themes.fontSize(`${settings.fontSize}px`)
    renditionRef.current.themes.default({
      'html, body': {
        'font-family':
          settings.fontFamily === 'serif'
            ? 'Georgia, serif !important'
            : settings.fontFamily === 'sans-serif'
            ? '"Segoe UI", sans-serif !important'
            : settings.fontFamily === 'monospace'
            ? 'Consolas, monospace !important'
            : 'inherit'
      },
      p: {
        'line-height': `${Math.round(settings.lineHeight * 100)}% !important`
      }
    })
  }, [settings.theme, settings.fontSize, settings.lineHeight, settings.fontFamily])

  const handleNext = useCallback(() => renditionRef.current?.next(), [])
  const handlePrev = useCallback(() => renditionRef.current?.prev(), [])

  // Analyze only the currently visible page/spread for Adaptive Countdown word density & break markers
  const analyzeVisiblePage = useCallback((): {
    visibleWords: number
    hasBreak: boolean
    atEnd: boolean
  } => {
    const loc = renditionRef.current?.currentLocation() as any
    const atEnd = Boolean(loc?.atEnd)
    const iframeDoc = (renditionRef.current?.getContents()?.[0] as any)?.document
    const chapterText = iframeDoc?.body?.innerText || ''

    let visibleWords = 0
    let hasBreak = false

    // Tier 1: Exact visible range between start.cfi and end.cfi
    try {
      if (loc?.start?.cfi && loc?.end?.cfi && epubBookRef.current) {
        const range = (epubBookRef.current as any).getRange?.(loc.start.cfi, loc.end.cfi)
        if (range) {
          const rangeText = range.toString() || ''
          visibleWords = rangeText.split(/\s+/).filter(Boolean).length
          const frag = range.cloneContents?.()
          hasBreak = Boolean(
            frag?.querySelector?.('hr, .section-break, .break, .separator, blockquote, .asterism') ||
            /\*\s*\*\s*\*|\u2042|\u2041/.test(rangeText)
          )
        }
      }
    } catch {}

    // Tier 2: Proportional chapter fallback if exact range is unavailable
    if (visibleWords <= 0 && chapterText) {
      const chapterWords = chapterText.split(/\s+/).filter(Boolean).length
      const secTotal = Math.max(1, loc?.start?.displayed?.total || 1)
      visibleWords = Math.round(chapterWords / secTotal)
      if (!hasBreak) {
        hasBreak = Boolean(
          iframeDoc?.querySelector('hr, .section-break, .break, .separator, blockquote, .asterism') ||
          /\*\s*\*\s*\*|\u2042|\u2041/.test(chapterText)
        )
      }
    }

    // Tier 3: Safe default for illustration/title spreads
    if (visibleWords <= 0) {
      visibleWords = 150
    }

    return { visibleWords, hasBreak, atEnd }
  }, [])

  // Sync Auto-Scroll settings from Zustand store into engine
  useEffect(() => {
    const mode = settings.autoscrollMode ?? (settings.autoscrollAdaptive === false ? 'countdown' : 'adaptive')
    adaptiveScrollEngine.configure({
      mode,
      fixedCountdownSec: settings.autoscrollCountdownSec ?? 20,
      targetWpm: settings.targetWpm ?? 250,
      microPauseEnabled: settings.autoscrollMicroPause ?? true
    })
  }, [
    settings.autoscrollMode,
    settings.autoscrollAdaptive,
    settings.autoscrollCountdownSec,
    settings.targetWpm,
    settings.autoscrollMicroPause
  ])

  // App-level abandonment (blur/hidden) suspension & 5-minute inactivity watchdog listeners
  useEffect(() => {
    const handleBlur = () => adaptiveScrollEngine.setSuspension('blur', true)
    const handleFocus = () => adaptiveScrollEngine.setSuspension('blur', false)
    const handleVisibility = () => {
      adaptiveScrollEngine.setSuspension('hidden', document.visibilityState === 'hidden')
    }

    let lastActivityAt = 0
    const recordActivity = () => {
      const now = Date.now()
      if (now - lastActivityAt < 1000) return
      lastActivityAt = now
      adaptiveScrollEngine.recordUserActivity()
    }

    window.addEventListener('blur', handleBlur)
    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('pointermove', recordActivity, { passive: true })
    window.addEventListener('mousedown', recordActivity, { passive: true })
    window.addEventListener('keydown', recordActivity, { passive: true })
    window.addEventListener('wheel', recordActivity, { passive: true })
    window.addEventListener('touchstart', recordActivity, { passive: true })

    return () => {
      window.removeEventListener('blur', handleBlur)
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('pointermove', recordActivity)
      window.removeEventListener('mousedown', recordActivity)
      window.removeEventListener('keydown', recordActivity)
      window.removeEventListener('wheel', recordActivity)
      window.removeEventListener('touchstart', recordActivity)
    }
  }, [])

  // Suspend countdown cleanly while any drawer, modal, footnote, selection, or context menu is open
  useEffect(() => {
    adaptiveScrollEngine.setSuspension('footnote', Boolean(activeFootnote))
  }, [activeFootnote])

  useEffect(() => {
    adaptiveScrollEngine.setSuspension('selection', Boolean(selectedText))
  }, [selectedText])

  useEffect(() => {
    const anyPanelOpen = Boolean(
      isTOCDrawerOpen ||
      isNotesDrawerOpen ||
      isBookmarksDrawerOpen ||
      isSearchDrawerOpen ||
      isSettingsDrawerOpen ||
      isFullSettingsModalOpen ||
      isRSVPActive ||
      contextMenu
    )
    adaptiveScrollEngine.setSuspension('drawer', anyPanelOpen)
  }, [
    isTOCDrawerOpen,
    isNotesDrawerOpen,
    isBookmarksDrawerOpen,
    isSearchDrawerOpen,
    isSettingsDrawerOpen,
    isFullSettingsModalOpen,
    isRSVPActive,
    contextMenu
  ])

  // Feature 1: Dual-Mode Auto-Scroll Countdown Lifecycle
  useEffect(() => {
    if (!isAutoscrollActive) {
      adaptiveScrollEngine.stop()
      return
    }

    const { visibleWords, hasBreak, atEnd } = analyzeVisiblePage()
    if (atEnd) {
      adaptiveScrollEngine.stop()
      setAutoscrollActive(false)
      return
    }

    adaptiveScrollEngine.startPageCountdown(visibleWords, hasBreak, () => {
      handleNext()
    })
  }, [isAutoscrollActive, currentCfi, analyzeVisiblePage, handleNext, setAutoscrollActive])

  // Cleanly stop Auto-Scroll and close Search drawer when exiting the reader back to Library
  useEffect(() => {
    return () => {
      adaptiveScrollEngine.stop()
      useAppStore.getState().setAutoscrollActive(false)
      useAppStore.getState().toggleSearchDrawer(false)
    }
  }, [])

  // Keyboard Navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Allow Ctrl+F / Cmd+F even when focus is inside an input so it always opens & selects Find
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        openSearchDrawerRef.current()
        return
      }

      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault()
        handleNext()
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp' || e.key === 'Backspace') {
        e.preventDefault()
        handlePrev()
      } else if (e.key === 'Home') {
        e.preventDefault()
        renditionRef.current?.display(0)
      } else if (e.key === 'F9') {
        e.preventDefault()
        const themes: Array<'day' | 'night' | 'light-sepia' | 'dark-sepia'> = [
          'day',
          'night',
          'light-sepia',
          'dark-sepia'
        ]
        const nextTheme = themes[(themes.indexOf(settings.theme) + 1) % themes.length]
        updateSettings({ theme: nextTheme })
      } else if (e.key === 'F10') {
        e.preventDefault()
        updateSettings({
          pageSpread: settings.pageSpread === 'double' ? 'single' : 'double'
        })
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        toggleBookmarksDrawer(true)
      } else if (e.key === 'Escape') {
        e.preventDefault()
        if (
          isTOCDrawerOpen ||
          isBookmarksDrawerOpen ||
          isNotesDrawerOpen ||
          isSearchDrawerOpen ||
          isSettingsDrawerOpen
        ) {
          toggleTOCDrawer(false)
          toggleBookmarksDrawer(false)
          toggleNotesDrawer(false)
          toggleSearchDrawer(false)
          toggleSettingsDrawer(false)
        } else if (activeFootnote) {
          setActiveFootnote(null)
        } else if (isAutoscrollActive) {
          setAutoscrollActive(false)
        } else {
          onBack()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    handleNext,
    handlePrev,
    settings.theme,
    settings.pageSpread,
    updateSettings,
    isTOCDrawerOpen,
    toggleTOCDrawer,
    isBookmarksDrawerOpen,
    toggleBookmarksDrawer,
    isNotesDrawerOpen,
    toggleNotesDrawer,
    isSearchDrawerOpen,
    toggleSearchDrawer,
    isSettingsDrawerOpen,
    toggleSettingsDrawer,
    activeFootnote,
    isAutoscrollActive,
    setAutoscrollActive,
    setActiveFootnote,
    onBack
  ])

  const handleSelectChapter = (href: string) => {
    renditionRef.current?.display(href)
  }

  const handleJumpToCfi = (cfi: string) => {
    renditionRef.current?.display(cfi)
  }

  const handleClearSearchHighlight = useCallback(() => {
    if (activeSearchHighlightCfiRef.current) {
      try {
        renditionRef.current?.annotations?.remove(activeSearchHighlightCfiRef.current, 'highlight')
      } catch {
        // Ignore stale annotation removal on section unload
      }
      activeSearchHighlightCfiRef.current = null
    }
  }, [])

  const handleSelectSearchMatch = useCallback(
    async (cfi: string) => {
      handleClearSearchHighlight()
      if (!renditionRef.current) return
      try {
        await renditionRef.current.display(cfi)
        renditionRef.current.annotations?.highlight(
          cfi,
          {},
          () => {},
          'search-match',
          { fill: '#f59e0b', 'fill-opacity': '0.35' }
        )
        activeSearchHighlightCfiRef.current = cfi
      } catch {
        // Ignore display race if book changed
      }
    },
    [handleClearSearchHighlight]
  )

  const handleSearchBook = useCallback(async (query: string): Promise<SearchMatch[]> => {
    const epub = epubBookRef.current as any
    if (!epub || !query.trim()) return []

    const spineItems: any[] = epub.spine?.spineItems || []
    const allMatches: SearchMatch[] = []
    const MAX_RESULTS = 250

    for (let i = 0; i < spineItems.length; i++) {
      if (allMatches.length >= MAX_RESULTS) break
      const section = spineItems[i]
      if (!section || typeof section.load !== 'function' || typeof section.find !== 'function') continue

      const wasLoaded = Boolean(section.contents)
      try {
        await section.load(epub.load.bind(epub))
        const found: Array<{ cfi: string; excerpt: string }> = section.find(query) || []
        if (found.length > 0) {
          const href: string = section.href || ''
          const matchingToc = tocRef.current.find(
            (t) => t.href && href && (href.includes(t.href.split('#')[0]) || t.href.includes(href))
          )
          const chapterLabel = matchingToc?.label?.trim() || `Section ${i + 1}`

          for (const hit of found) {
            if (allMatches.length >= MAX_RESULTS) break
            allMatches.push({
              cfi: hit.cfi,
              excerpt: hit.excerpt || query,
              chapter: chapterLabel
            })
          }
        }
      } catch {
        // Skip unreadable/non-text spine items gracefully
      } finally {
        // Only unload sections we loaded on demand; never clobber the active section
        if (!wasLoaded && typeof section.unload === 'function') {
          try {
            section.unload()
          } catch {
            // Ignore unload error
          }
        }
      }
    }

    return allMatches
  }, [])

  const handleAddAnnotation = async (
    color: 'blue' | 'purple' | 'red' | 'yellow' | 'green' | 'underline',
    textOverride?: string,
    cfiOverride?: string
  ) => {
    const textToSave = textOverride || selectedText
    const cfiToSave = cfiOverride || selectedCfiRange
    if (!book.id || !textToSave) return
    await db.annotations.add({
      bookId: book.id,
      cfiRange: cfiToSave,
      text: textToSave,
      note: '',
      color,
      createdAt: Date.now()
    })
    if (cfiToSave) {
      renditionRef.current?.annotations?.highlight(
        cfiToSave,
        {},
        () => {},
        `${color}note`
      )
    }
    setSelectedText(null)
  }

  const handleAddNote = async (note: string, textOverride?: string, cfiOverride?: string) => {
    const textToSave = textOverride || selectedText
    const cfiToSave = cfiOverride || selectedCfiRange
    if (!book.id || !textToSave) return
    await db.annotations.add({
      bookId: book.id,
      cfiRange: cfiToSave,
      text: textToSave,
      note,
      color: 'blue',
      createdAt: Date.now()
    })
    if (cfiToSave) {
      renditionRef.current?.annotations?.highlight(
        cfiToSave,
        {},
        () => {},
        'bluenote'
      )
    }
    setSelectedText(null)
  }

  // Always-fresh right-click context menu builder (via ref so iframe hooks never re-mount EPUB)
  openContextMenuRef.current = (clickX: number, clickY: number, text?: string, cfiRange?: string) => {
    if (text) {
      const targetCfi = cfiRange || selectedCfiRange
      const items: ContextMenuItem[] = [
        {
          id: 'copy',
          label: 'Copy Text',
          shortcut: 'Ctrl+C',
          icon: <Copy className="w-3.5 h-3.5" />,
          onClick: () => navigator.clipboard.writeText(text)
        },
        {
          id: 'highlight-swatches',
          label: 'Highlight',
          swatches: [
            { color: 'blue', hex: '#aed9f1', title: 'Blue Highlight', onClick: () => handleAddAnnotation('blue', text, targetCfi) },
            { color: 'purple', hex: '#ccb8e4', title: 'Purple Highlight', onClick: () => handleAddAnnotation('purple', text, targetCfi) },
            { color: 'red', hex: '#f3a2a2', title: 'Red Highlight', onClick: () => handleAddAnnotation('red', text, targetCfi) },
            { color: 'yellow', hex: '#f3e3a2', title: 'Yellow Highlight', onClick: () => handleAddAnnotation('yellow', text, targetCfi) },
            { color: 'green', hex: '#b1f3a4', title: 'Green Highlight', onClick: () => handleAddAnnotation('green', text, targetCfi) }
          ]
        },
        {
          id: 'note',
          label: 'Add Note...',
          icon: <FileText className="w-3.5 h-3.5 text-[#2a69df]" />,
          onClick: () => {
            setSelectedText(text)
            if (targetCfi) setSelectedCfiRange(targetCfi)
            setSelectionPos({ x: clickX, y: clickY })
          }
        },
        { id: 'div-sel', divider: true },
        {
          id: 'dict',
          label: 'Define in Dictionary',
          icon: <BookOpen className="w-3.5 h-3.5 text-[#a78bfa]" />,
          onClick: () => window.open(`https://www.merriam-webster.com/dictionary/${encodeURIComponent(text)}`, '_blank')
        },
        {
          id: 'translate',
          label: 'Translate Selection',
          icon: <Languages className="w-3.5 h-3.5 text-[#4cd964]" />,
          onClick: () => window.open(`https://translate.google.com/?sl=auto&tl=en&text=${encodeURIComponent(text)}`, '_blank')
        },
        {
          id: 'tts',
          label: 'Read Aloud Selection',
          icon: <Volume2 className="w-3.5 h-3.5 text-[#38bdf8]" />,
          onClick: () => {
            setTTSActive(true)
            ttsService.speak(text, {
              rate: settings.ttsSpeed,
              pitch: settings.ttsPitch,
              voiceURI: settings.ttsVoice,
              onEnd: () => setTTSActive(false)
            })
          }
        }
      ]
      setContextMenu({ x: clickX, y: clickY, items })
    } else {
      const items: ContextMenuItem[] = [
        {
          id: 'prev',
          label: 'Previous Page',
          shortcut: 'Left',
          icon: <ChevronLeft className="w-3.5 h-3.5" />,
          onClick: handlePrev
        },
        {
          id: 'next',
          label: 'Next Page',
          shortcut: 'Right',
          icon: <ChevronRight className="w-3.5 h-3.5" />,
          onClick: handleNext
        },
        { id: 'div-nav', divider: true },
        {
          id: 'bookmark',
          label: `Bookmark Page ${currentPage}`,
          shortcut: 'Ctrl+B',
          icon: <Bookmark className="w-3.5 h-3.5 text-[#2a69df]" />,
          onClick: async () => {
            if (!book.id) return
            await db.bookmarks.add({
              bookId: book.id,
              cfi: currentCfiRef.current,
              label: `Page ${currentPage}`,
              pageNumber: currentPage,
              createdAt: Date.now()
            })
          }
        },
        {
          id: 'autoscroll',
          label: isAutoscrollActive ? 'Stop Auto-Scroll' : 'Start Auto-Scroll',
          icon: <Zap className="w-3.5 h-3.5 text-[#f59e0b]" />,
          onClick: () => setAutoscrollActive(!isAutoscrollActive)
        },
        {
          id: 'rsvp',
          label: 'RSVP Speed Reader',
          icon: <Gauge className="w-3.5 h-3.5 text-[#2a69df]" />,
          onClick: () => toggleRSVP(true)
        },
        { id: 'div-view', divider: true },
        {
          id: 'fullscreen',
          label: isImmersiveFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen',
          shortcut: 'F11',
          icon: isImmersiveFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />,
          onClick: () => {
            const next = !isImmersiveFullscreen
            setImmersiveFullscreen(next)
            window.desktopAPI?.setFullscreen?.(next)
          }
        },
        {
          id: 'settings',
          label: 'Reading Settings',
          icon: <Settings className="w-3.5 h-3.5" />,
          onClick: () => toggleSettingsDrawer(true)
        }
      ]
      setContextMenu({ x: clickX, y: clickY, items })
    }
  }

  // Trigger epub.js layout reflow when entering/exiting immersive fullscreen
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        ;(renditionRef.current as any)?.resize?.()
      } catch {
        // Ignore resize race during unmount
      }
    }, 120)
    return () => clearTimeout(t)
  }, [isImmersiveFullscreen])

  const handleExitFullscreen = () => {
    setImmersiveFullscreen(false)
    if (window.desktopAPI?.setFullscreen) {
      window.desktopAPI.setFullscreen(false)
    } else if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {})
    }
  }

  return (
    <div
      style={{ backgroundColor: currentTheme.bg }}
      className="flex-1 flex flex-col h-full relative overflow-hidden select-none transition-colors duration-200"
    >
      {/* Top Docked Header (hidden completely in immersive fullscreen) */}
      {!isImmersiveFullscreen && (
        <ReaderTopBar onBack={onBack} currentChapter={currentChapter} />
      )}

      {/* Floating Exit Fullscreen Control (only visible in immersive fullscreen) */}
      {isImmersiveFullscreen && (
        <button
          onClick={handleExitFullscreen}
          className="fixed top-3 right-3 z-50 h-8 px-2.5 flex items-center gap-1.5 rounded-[2px] bg-[#14161c]/80 hover:bg-[#1f232d] border border-[#2d323f] text-[#c8d1dc] hover:text-white text-[11px] shadow-lg opacity-30 hover:opacity-100 transition-opacity duration-150 app-no-drag"
          title="Exit Fullscreen (Esc / F11)"
        >
          <Minimize2 className="w-3.5 h-3.5" />
          <span>Exit Fullscreen</span>
        </button>
      )}

      {/* Main Reading Viewport */}
      <div
        onContextMenu={(e) => {
          e.preventDefault()
          openContextMenuRef.current(e.clientX, e.clientY)
        }}
        className={`flex-1 relative flex items-center justify-center overflow-hidden ${
          isImmersiveFullscreen ? 'py-6 px-4' : ''
        }`}
      >
        {/* Subtle Left Prev Page button (hidden in immersive fullscreen) */}
        {!isImmersiveFullscreen && (
          <button
            onClick={handlePrev}
            className="absolute left-2 z-30 w-8 h-12 rounded flex items-center justify-center bg-black/20 hover:bg-black/40 text-white/50 hover:text-white transition-opacity opacity-0 hover:opacity-100"
            title="Previous Page (Left Arrow / Page Up)"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}

        {/* EPUB Mount Point */}
        <div
          ref={viewerRef}
          className="w-full h-full max-w-6xl mx-auto relative"
        />

        {/* Center Gutter Divider for Double Page Spread */}
        {settings.pageSpread === 'double' && !isImmersiveFullscreen && (
          <div
            style={{ backgroundColor: currentTheme.border }}
            className="absolute left-1/2 top-4 bottom-4 w-px pointer-events-none opacity-40"
          />
        )}

        {/* Subtle Right Next Page button (hidden in immersive fullscreen) */}
        {!isImmersiveFullscreen && (
          <button
            onClick={handleNext}
            className="absolute right-2 z-30 w-8 h-12 rounded flex items-center justify-center bg-black/20 hover:bg-black/40 text-white/50 hover:text-white transition-opacity opacity-0 hover:opacity-100"
            title="Next Page (Right Arrow / Space / Page Down)"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Dimming Overlay */}
      {settings.dimming > 0 && (
        <div
          style={{ opacity: settings.dimming / 100 }}
          className="fixed inset-0 bg-black pointer-events-none z-30 transition-opacity"
        />
      )}

      {/* Feature 5: Warm Blue Light Night Filter Overlay (isEnableBlueFilterNight) */}
      {warmFilter && (
        <div
          style={{
            backgroundColor: warmFilter.backgroundColor,
            opacity: warmFilter.opacity
          }}
          className="fixed inset-0 pointer-events-none z-30 transition-opacity duration-300 mix-blend-multiply"
        />
      )}

      {/* Feature 1: Minimalist Bottom-Right Auto-Scroll Countdown (persists even in Fullscreen) */}
      <AdaptiveScrollOverlay
        isActive={isAutoscrollActive}
        onClose={() => setAutoscrollActive(false)}
      />

      {/* Bottom Floating Progress Area (hidden completely in immersive fullscreen) */}
      {!isImmersiveFullscreen && (
        <footer
          onMouseEnter={() => setIsBottomHovered(true)}
          onMouseLeave={() => setIsBottomHovered(false)}
          className="h-10 px-6 flex flex-col justify-end pb-2 relative z-30 select-none transition-all duration-200"
        >
          {isBottomHovered ? (
            <div className="w-full flex flex-col gap-1 animate-fadeIn">
              <div className="text-[12px] text-white font-medium pl-0.5">
                {currentPage || 1} / {totalPages || 1}
              </div>
              <div className="w-full relative flex items-center h-4">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={progressPercent || 0}
                  onChange={(e) => {
                    const val = Number(e.target.value)
                    setProgressPercent(val)
                    const cfi = epubBookRef.current?.locations.cfiFromPercentage(val / 100)
                    if (cfi) renditionRef.current?.display(cfi)
                  }}
                  className="ice-slider w-full"
                />
              </div>
            </div>
          ) : (
            <div className="w-full flex items-center justify-center pb-1 gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#383d4a]" />
              <span className="w-1.5 h-1.5 rounded-full bg-[#383d4a]" />
              <span className="w-1.5 h-1.5 rounded-full bg-[#6e7681]" />
              <span className="w-1.5 h-1.5 rounded-full bg-[#383d4a]" />
              <span className="w-1.5 h-1.5 rounded-full bg-[#383d4a]" />
            </div>
          )}
        </footer>
      )}

      {/* Sliding Drawers */}
      <TOCDrawer
        toc={toc}
        currentHref={currentHref}
        onSelectChapter={handleSelectChapter}
      />
      <NotesDrawer onJumpToCfi={handleJumpToCfi} />
      <BookmarksDrawer
        currentPage={currentPage}
        currentCfi={currentCfi}
        onJumpToCfi={handleJumpToCfi}
      />
      <SearchDrawer
        onSearch={handleSearchBook}
        onSelectMatch={handleSelectSearchMatch}
        onClearHighlight={handleClearSearchHighlight}
        focusNonce={searchFocusNonce}
      />
      <SettingsDrawer />

      {/* Feature 4: Footnote Popover Modal */}
      {activeFootnote && (
        <FootnotePopover
          footnote={activeFootnote}
          onClose={() => setActiveFootnote(null)}
          onJumpToNote={(href) => handleSelectChapter(href)}
        />
      )}

      {/* Feature 3: RSVP Speed Reading Modal (Optimal Recognition Point) */}
      <RSVPSpeedReaderModal
        isOpen={isRSVPActive}
        onClose={() => toggleRSVP(false)}
        initialText={chapterFullText || ((renditionRef.current?.getContents()?.[0] as any)?.document?.body?.innerText) || book.title}
        title={currentChapter || book.title}
      />

      {/* Inline Selection & Dictionary Popup */}
      {selectedText && (
        <SelectionPopup
          selectedText={selectedText}
          position={selectionPos}
          onClose={() => setSelectedText(null)}
          onHighlight={handleAddAnnotation}
          onAddNote={handleAddNote}
        />
      )}

      {/* Desktop Right-Click Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenu.items}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  )
}
