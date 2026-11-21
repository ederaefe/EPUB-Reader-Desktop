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
  Maximize2,
  Minimize2,
  Settings
} from 'lucide-react'
import { useAppStore } from '../../stores/useAppStore'
import { useShallow } from 'zustand/react/shallow'
import { db, type Annotation, type Book, type Bookmark as BookmarkItem, type IceRangeAnchor, type NoteColor } from '../../db'
import { ReaderTopBar } from './ReaderTopBar'
import { TOCDrawer, type TocItem } from '../drawers/TOCDrawer'
import { NotesDrawer } from '../drawers/NotesDrawer'
import { BookmarksDrawer } from '../drawers/BookmarksDrawer'
import { SearchDrawer, type SearchMatch } from '../drawers/SearchDrawer'
import { SettingsDrawer } from '../drawers/SettingsDrawer'
import { SelectionPopup } from './SelectionPopup'
import { AnnotationPopover } from './AnnotationPopover'
import { FootnotePopover } from './FootnotePopover'
import { AdaptiveScrollOverlay } from './AdaptiveScrollOverlay'
import { ReaderAudioHUD } from './ReaderAudioHUD'
import { FluidClimaxProgressBar } from './FluidClimaxProgressBar'
import { FullscreenClimaxWaveOverlay } from './FullscreenClimaxWaveOverlay'
import { SideNavigation } from './SideNavigation'
import { useIdleCursor } from '../../hooks/useIdleCursor'
import { useClimaxEasterEgg } from '../../hooks/useClimaxEasterEgg'
import { ContextMenu, type ContextMenuItem } from '../ui/ContextMenu'
import { adaptiveScrollEngine, computeEffectiveWordCount } from '../../services/adaptiveScrollService'
import { splitIntoSentences, ttsService } from '../../services/ttsService'
import { injectFontIntoDocument } from '../../services/fontManager'
import { getFontCssFamily } from '../../../../shared/fontCatalog'
import {
  applyAnnotationToRendition,
  captureIceRange,
  extractVisiblePageData,
  hydrateRenditionAnnotations,
  removeAnnotationFromRendition,
  syncBookNotesCount
} from '../../services/annotationService'
import { buildResolvedToc, findActiveTocItem, findAnchorElement, resolveTocHrefToSpine } from '../../services/tocService'
import { readerHistoryService } from '../../services/readerHistoryService'

interface EpubReaderViewProps {
  book: Book
  onBack: () => void
}

const safeGetRenditionLocation = (rendition: any): any => {
  try {
    if (!rendition) return null
    if (rendition.location?.start?.cfi) {
      return rendition.location
    }
    if (typeof rendition.currentLocation === 'function') {
      const loc = rendition.currentLocation()
      if (loc && typeof loc.then !== 'function' && loc.start?.cfi) {
        return loc
      }
    }
    return rendition.location || null
  } catch {
    return null
  }
}

const isTargetInput = (target: EventTarget | null): boolean => {
  if (!target) return false
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return true
  const el = target as HTMLElement
  if (el?.isContentEditable || el?.getAttribute?.('contenteditable') === 'true') return true
  if (el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA') return true
  return false
}

const EpubReaderViewBase: React.FC<EpubReaderViewProps> = ({ book, onBack }) => {
  const viewerRef = useRef<HTMLDivElement>(null)
  const epubBookRef = useRef<EpubBook | null>(null)
  const renditionRef = useRef<Rendition | null>(null)

  const {
    settings,
    activeBookBuffer,
    pdfViewMode,
    reflowEpubBuffer,
    isTTSActive,
    isTTSMuted,
    isAutoscrollActive,
    activeFootnote,
    isTOCDrawerOpen,
    isBookmarksDrawerOpen,
    isNotesDrawerOpen,
    isSearchDrawerOpen,
    isSettingsDrawerOpen,
    isFullSettingsModalOpen,
    isImmersiveFullscreen,
    annotationsVersion,
    bookmarksVersion,
    lastNoteColor
  } = useAppStore(
    useShallow((s) => ({
      settings: s.settings,
      activeBookBuffer: s.activeBookBuffer,
      pdfViewMode: s.pdfViewMode,
      reflowEpubBuffer: s.reflowEpubBuffer,
      isTTSActive: s.isTTSActive,
      isTTSMuted: s.isTTSMuted,
      isAutoscrollActive: s.isAutoscrollActive,
      activeFootnote: s.activeFootnote,
      isTOCDrawerOpen: s.isTOCDrawerOpen,
      isBookmarksDrawerOpen: s.isBookmarksDrawerOpen,
      isNotesDrawerOpen: s.isNotesDrawerOpen,
      isSearchDrawerOpen: s.isSearchDrawerOpen,
      isSettingsDrawerOpen: s.isSettingsDrawerOpen,
      isFullSettingsModalOpen: s.isFullSettingsModalOpen,
      isImmersiveFullscreen: s.isImmersiveFullscreen,
      annotationsVersion: s.annotationsVersion,
      bookmarksVersion: s.bookmarksVersion,
      lastNoteColor: s.lastNoteColor
    }))
  )

  const updateSettings = useAppStore((s) => s.updateSettings)
  const setPdfViewMode = useAppStore((s) => s.setPdfViewMode)
  const syncActiveBookProgress = useAppStore((s) => s.syncActiveBookProgress)
  const setPendingSeekPercent = useAppStore((s) => s.setPendingSeekPercent)
  const setTTSActive = useAppStore((s) => s.setTTSActive)
  const setAutoscrollActive = useAppStore((s) => s.setAutoscrollActive)
  const setActiveFootnote = useAppStore((s) => s.setActiveFootnote)
  const toggleTOCDrawer = useAppStore((s) => s.toggleTOCDrawer)
  const toggleBookmarksDrawer = useAppStore((s) => s.toggleBookmarksDrawer)
  const toggleNotesDrawer = useAppStore((s) => s.toggleNotesDrawer)
  const toggleSearchDrawer = useAppStore((s) => s.toggleSearchDrawer)
  const toggleSettingsDrawer = useAppStore((s) => s.toggleSettingsDrawer)
  const setCurrentChapterTitle = useAppStore((s) => s.setCurrentChapterTitle)
  const setImmersiveFullscreen = useAppStore((s) => s.setImmersiveFullscreen)
  const bumpAnnotationsVersion = useAppStore((s) => s.bumpAnnotationsVersion)
  const bumpBookmarksVersion = useAppStore((s) => s.bumpBookmarksVersion)
  const setLastNoteColor = useAppStore((s) => s.setLastNoteColor)

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
  const [activeTocId, setActiveTocId] = useState('')
  const [currentCfi, setCurrentCfi] = useState<string>(book.progressCfi || '')
  const [currentEndCfi, setCurrentEndCfi] = useState<string>('')
  const [currentPage, setCurrentPage] = useState<number>(book.currentPage || 1)
  const [totalPages, setTotalPages] = useState<number>(book.totalPages || 1)
  const [progressPercent, setProgressPercent] = useState<number>(book.progressPercent || 0)

  const {
    climaxTarget,
    activeEffect: climaxEffect,
    stopEffect: stopClimaxEffect
  } = useClimaxEasterEgg({
    book,
    progressPercent: progressPercent || 0,
    currentPage,
    totalPages,
    isImmersiveFullscreen
  })

  // Keep book identity & metadata synced in refs so initReader only re-mounts when the actual
  // book identity or layout mode changes — never when DB progress updates re-render the parent.
  const bookKey = `${book.id ?? ''}::${book.filePath}`
  const bookIdRef = useRef(book.id)
  const bookFilePathRef = useRef(book.filePath)
  const bookFormatRef = useRef(book.format)
  const bookLocationsCacheRef = useRef(book.locationsCache)
  const bookTotalPagesRef = useRef(book.totalPages || 1)
  const bookInitialCfiRef = useRef(book.progressCfi)
  const lastLoadedBookKeyRef = useRef<string>('')
  const navigateStepRef = useRef<(dir: 'next' | 'prev') => Promise<void>>(async () => {})
  const onBackRef = useRef(onBack)
  onBackRef.current = onBack
  const hasMountedFullscreenRef = useRef(false)

  bookIdRef.current = book.id
  bookFilePathRef.current = book.filePath
  bookFormatRef.current = book.format
  bookLocationsCacheRef.current = book.locationsCache
  bookTotalPagesRef.current = book.totalPages || 1
  if (lastLoadedBookKeyRef.current !== bookKey) {
    bookInitialCfiRef.current = book.progressCfi
  }

  const [selectedText, setSelectedText] = useState<string | null>(null)
  const [selectedCfiRange, setSelectedCfiRange] = useState<string>('')
  const [selectionPos, setSelectionPos] = useState({ x: 0, y: 0 })
  const [openNoteModalDirect, setOpenNoteModalDirect] = useState(false)
  const selectedIceRangeRef = useRef<IceRangeAnchor | undefined>(undefined)
  const selectionContentsRef = useRef<any>(null)

  // Interactive clicked highlight popover state
  const [activeAnnotation, setActiveAnnotation] = useState<{
    annotation: Annotation
    position: { x: number; y: number }
  } | null>(null)
  const annotationsListRef = useRef<Annotation[]>([])
  const openAnnotationPopoverRef = useRef<(ann: Annotation, e: MouseEvent) => void>(() => {})

  // Bookmarks state for instant current-page ribbon indicator
  const [bookBookmarks, setBookBookmarks] = useState<BookmarkItem[]>([])
  const toggleCurrentBookmarkRef = useRef<() => Promise<void>>(async () => {})
  const handleUndoRef = useRef<() => Promise<void>>(async () => {})
  const handleRedoRef = useRef<() => Promise<void>>(async () => {})
  const handleChapterStepRef = useRef<(dir: 'prev' | 'next') => void>(() => {})

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; items: ContextMenuItem[] } | null>(null)
  const openContextMenuRef = useRef<(x: number, y: number, text?: string, cfiRange?: string) => void>(() => {})

  // Scrubber, locations readiness & pagination synchronization refs
  const isScrubbingRef = useRef(false)
  const locationsReadyRef = useRef(false)
  const seekRequestIdRef = useRef(0)
  const chapterJumpNonceRef = useRef(0)
  const handleToggleTTSRef = useRef<() => void>(() => {})
  const handleStopTTSRef = useRef<() => void>(() => {})
  const handleJumpEndRef = useRef<() => void>(() => {})
  const totalPagesRef = useRef(totalPages)
  totalPagesRef.current = totalPages
  const currentCfiRef = useRef(currentCfi)
  currentCfiRef.current = currentCfi
  const currentEndCfiRef = useRef(currentEndCfi)
  currentEndCfiRef.current = currentEndCfi
  const currentPageRef = useRef(currentPage)
  currentPageRef.current = currentPage
  const currentChapterRef = useRef(currentChapter)
  currentChapterRef.current = currentChapter
  const currentHrefRef = useRef(currentHref)
  currentHrefRef.current = currentHref
  const progressPercentRef = useRef(progressPercent)
  progressPercentRef.current = progressPercent
  const themeRef = useRef(settings.theme)
  themeRef.current = settings.theme

  // Real-time manual reading cadence profiler refs
  const pageEnteredAtRef = useRef<number>(Date.now())
  const lastWordsOnPageRef = useRef<number>(180)

  // Adaptive autoscroll page re-arming and manual scroll takeover refs
  const armPageRef = useRef<() => void>(() => {})
  const analyzeVisiblePageRef = useRef<(loc?: any) => { visibleWords: number; hasBreak: boolean; atEnd: boolean }>(() => ({
    visibleWords: 150,
    hasBreak: false,
    atEnd: false
  }))
  const cachedPageMetricsRef = useRef<{
    cfi: string
    visibleWords: number
    hasBreak: boolean
    atEnd: boolean
  } | null>(null)
  const manualScrollIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const triggerManualScrollTakeover = useCallback(() => {
    if (!useAppStore.getState().isAutoscrollActive) return
    adaptiveScrollEngine.setSuspension('manualScroll', true)
    if (manualScrollIdleTimerRef.current) {
      clearTimeout(manualScrollIdleTimerRef.current)
    }
    manualScrollIdleTimerRef.current = setTimeout(() => {
      adaptiveScrollEngine.setSuspension('manualScroll', false)
      if (useAppStore.getState().isAutoscrollActive) {
        armPageRef.current()
      }
    }, 400)
  }, [])

  // Theme palettes aligned with Vercel/Geist Obsidian + Paper surfaces
  const themeStyles = {
    day: { bg: '#ffffff', text: '#121212', link: '#005cc5', bottomBg: '#fafafa', border: 'rgba(0,0,0,0.08)' },
    night: { bg: '#0c0c0d', text: '#f5f7fa', link: '#8cc4ff', bottomBg: '#0a0a0a', border: 'rgba(255,255,255,0.10)' },
    'light-sepia': { bg: '#f5ecd8', text: '#1f1810', link: '#6e4318', bottomBg: '#ebe0c7', border: 'rgba(60,44,24,0.16)' },
    'dark-sepia': { bg: '#1f1914', text: '#f5ede0', link: '#f3d9b8', bottomBg: '#18130f', border: 'rgba(255,255,255,0.10)' }
  }

  const currentTheme = themeStyles[settings.theme] || themeStyles.night

  // Injects dynamic user typography rules (font family, size, weight, optical rendering, line height) into an iframe Document
  const applyDynamicStylesToDoc = useCallback((doc: Document | null | undefined) => {
    if (!doc || !doc.head) return
    let styleEl = doc.getElementById('semply-reader-dynamic-style') as HTMLStyleElement | null
    if (!styleEl) {
      styleEl = doc.createElement('style')
      styleEl.id = 'semply-reader-dynamic-style'
      doc.head.appendChild(styleEl)
    }

    const currentSettings = useAppStore.getState().settings
    const isDual = (currentSettings.pageLayout ?? (currentSettings.pageSpread === 'single' ? 'single' : 'dual')) === 'dual'
    const fontFam = getFontCssFamily(currentSettings.fontFamily)
    const rawSize = Number(currentSettings.fontSize)
    const safeFontSize = Number.isFinite(rawSize) ? Math.max(12, Math.min(42, Math.round(rawSize))) : 21
    const rawWeight = Number(currentSettings.fontWeight)
    const fontWeight = Number.isFinite(rawWeight) ? Math.max(300, Math.min(800, Math.round(rawWeight))) : 400
    const rawLineHeight = Number(currentSettings.lineHeight)
    const safeLineHeight = Number.isFinite(rawLineHeight) ? Math.max(1.0, Math.min(2.5, rawLineHeight)) : 1.5
    const isLightTheme = currentSettings.theme === 'day' || currentSettings.theme === 'light-sepia'
    const smoothingRule = isLightTheme
      ? '-webkit-font-smoothing: subpixel-antialiased !important;'
      : '-webkit-font-smoothing: antialiased !important;'
    // Subtle optical stroke lift at weight 500 so 2-weight Windows system serifs (Garamond/Georgia) visibly gain crispness
    const mediumStrokeRule =
      fontWeight === 500 ? '-webkit-text-stroke: 0.18px currentColor !important;' : '-webkit-text-stroke: 0 !important;'
    const emphasisWeight = fontWeight >= 600 ? 800 : 700
    const fontRule =
      fontFam !== 'inherit'
        ? `body, body p, body div, body span, body li, body blockquote, body h1, body h2, body h3, body h4, body h5, body h6 { font-family: ${fontFam} !important; }`
        : ''

    // Layout and scrollbar suppression rules (preserves epub.js native multi-column inline expansion)
    const baseLayoutRule = `
      html, body {
        box-sizing: border-box !important;
        scrollbar-width: none !important;
        -ms-overflow-style: none !important;
      }
      ::-webkit-scrollbar {
        display: none !important;
        width: 0 !important;
        height: 0 !important;
      }
      *::-webkit-scrollbar {
        display: none !important;
        width: 0 !important;
        height: 0 !important;
      }
      .galley-rw, section, article, div.body-rw, main {
        max-width: none !important;
        width: auto !important;
      }
      h1, h2, h3, h4, h5, h6 {
        column-span: none !important;
        -webkit-column-span: none !important;
      }
      img, svg, figure {
        max-width: 100% !important;
        max-height: 90vh !important;
        object-fit: contain !important;
      }
    `

    styleEl.textContent = `
      html, body {
        font-size: ${safeFontSize}px !important;
        font-weight: ${fontWeight} !important;
        font-optical-sizing: auto !important;
        text-rendering: optimizeLegibility !important;
        ${smoothingRule}
      }
      body p, body div, body span, body li, body blockquote {
        font-size: ${safeFontSize}px !important;
        line-height: ${Math.round(safeLineHeight * 100)}% !important;
        font-weight: ${fontWeight} !important;
        ${mediumStrokeRule}
      }
      body strong, body b {
        font-weight: ${emphasisWeight} !important;
      }
      /* Clean Literary Underline Highlight (replaces bounding box with bottom stroke) */
      svg g.underlinenote rect {
        stroke: none !important;
        fill: transparent !important;
        cursor: pointer !important;
      }
      svg g.underlinenote line {
        stroke: ${isLightTheme ? '#2a69df' : '#79c0ff'} !important;
        stroke-width: 2.5px !important;
        stroke-linecap: round !important;
        stroke-opacity: 0.9 !important;
      }
      span.underlinenote {
        text-decoration: underline !important;
        text-decoration-color: ${isLightTheme ? '#2a69df' : '#79c0ff'} !important;
        text-underline-offset: 3px !important;
        text-decoration-thickness: 2px !important;
      }
      .cursor-idle-hidden,
      .cursor-idle-hidden * {
        cursor: none !important;
      }
      ${fontRule}
      ${baseLayoutRule}
    `
  }, [])

  // Defense-in-depth sanitizer for untrusted EPUB XHTML (runs pre-parse via spine.hooks.content and post-mount)
  const sanitizeEpubDocument = useCallback((doc: Document) => {
    try {
      // Strip active/embedded elements, foreignObject, and meta redirects
      doc
        .querySelectorAll(
          'script, object, embed, applet, iframe, frame, frameset, form, foreignObject, meta[http-equiv="refresh" i]'
        )
        .forEach((node) => node.remove())

      // Strip external <base> and external <link> tags while preserving local/blob EPUB assets
      doc.querySelectorAll('base[href]').forEach((baseEl) => {
        const href = (baseEl.getAttribute('href') || '').replace(/[\0-\x20]+/g, '').toLowerCase()
        if (/^(?:https?:|\/\/|javascript:|vbscript:|data:)/.test(href)) {
          baseEl.remove()
        }
      })
      doc.querySelectorAll('link[href]').forEach((linkEl) => {
        const href = (linkEl.getAttribute('href') || '').replace(/[\0-\x20]+/g, '').toLowerCase()
        if (/^(?:https?:|\/\/|javascript:|vbscript:)/.test(href)) {
          linkEl.remove()
        }
      })

      // Strip remote @import and external http(s) url(...) rules from embedded book <style> blocks
      doc.querySelectorAll('style').forEach((styleEl) => {
        if (styleEl.id === 'semply-reader-dynamic-style' || styleEl.hasAttribute('data-semply-font-id')) {
          return
        }
        const cssText = styleEl.textContent
        if (cssText && /(?:@import|url\s*\(\s*['"]?(?:https?:|\/\/))/i.test(cssText)) {
          styleEl.textContent = cssText
            .replace(/@import\s+(?:url\([^)]*\)|['"][^'"]*['"])[^;]*;?/gi, '')
            .replace(/url\(\s*['"]?(?:https?:|\/\/)[^)]*\)/gi, 'none')
        }
      })

      // Remove inline event handlers, script/HTML-data URLs, and external network tracking pixels
      const elements = doc.querySelectorAll('*')
      elements.forEach((el) => {
        for (const attr of Array.from(el.attributes)) {
          const nameLower = attr.name.toLowerCase()
          const compactVal = attr.value.replace(/[\0-\x20]+/g, '').toLowerCase()

          if (nameLower.startsWith('on')) {
            el.removeAttribute(attr.name)
            continue
          }

          if (
            (nameLower === 'href' ||
              nameLower === 'xlink:href' ||
              nameLower === 'src' ||
              nameLower === 'action' ||
              nameLower === 'formaction') &&
            (compactVal.startsWith('javascript:') ||
              compactVal.startsWith('vbscript:') ||
              compactVal.startsWith('data:text/html') ||
              compactVal.startsWith('data:application/xhtml'))
          ) {
            el.removeAttribute(attr.name)
            continue
          }

          if (
            (nameLower === 'src' || nameLower === 'srcset' || nameLower === 'poster') &&
            /^(?:https?:|\/\/)/.test(compactVal)
          ) {
            el.removeAttribute(attr.name)
          }
        }
      })
    } catch {
      // Never block rendering if an EPUB has malformed XML nodes
    }
  }, [])

  // Attach smart footnote click interception, custom downloaded font CSS, and cadence wheel listener to iframe
  const attachIframeHooks = useCallback((contents: any) => {
    const doc = contents.document
    if (!doc) return

    sanitizeEpubDocument(doc)

    // Inject active downloaded font stylesheet and dynamic typography rules into the isolated EPUB iframe
    const activeFontId = useAppStore.getState().settings.fontFamily
    if (activeFontId) {
      injectFontIntoDocument(doc, activeFontId).catch(() => {})
    }
    applyDynamicStylesToDoc(doc)

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

    // Feature 1: Manual Scroll Takeover & Responsive Wheel Navigation (blocks Ctrl+Wheel zoom)
    let lastWheelTime = 0
    contents.window.addEventListener(
      'wheel',
      (e: WheelEvent) => {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault()
          return
        }
        adaptiveScrollEngine.recordUserActivity()

        const state = useAppStore.getState()
        if (state.isAutoscrollActive) {
          // Manual scroll takeover: autoscroll pauses instantly, native scroll works freely,
          // and the timer resets to 0 once the reader settles on the new position.
          triggerManualScrollTakeover()

          // Wheel steps pages naturally in horizontal paginated mode
          const now = Date.now()
          if (now - lastWheelTime >= 220) {
            lastWheelTime = now
            if (e.deltaY > 24) {
              navigateStepRef.current('next')
            } else if (e.deltaY < -24) {
              navigateStepRef.current('prev')
            }
          }
          return
        }

        // Smooth manual mouse-wheel page turning in horizontal paginated mode when no panel is open
        if (
          state.isTOCDrawerOpen ||
          state.isNotesDrawerOpen ||
          state.isBookmarksDrawerOpen ||
          state.isSearchDrawerOpen ||
          state.isSettingsDrawerOpen
        ) {
          return
        }
        const now = Date.now()
        if (now - lastWheelTime < 220) return
        lastWheelTime = now
        if (e.deltaY > 24) {
          navigateStepRef.current('next')
        } else if (e.deltaY < -24) {
          navigateStepRef.current('prev')
        }
      },
      { passive: false }
    )

    // Throttled iframe user-activity feed (zero getBoundingClientRect() layout thrashing on cursor move)
    let lastIframeActivityAt = 0
    const recordIframeActivity = () => {
      const now = Date.now()
      if (now - lastIframeActivityAt < 1000) return
      lastIframeActivityAt = now
      adaptiveScrollEngine.recordUserActivity()
    }

    const handleIframePointerMove = (e: MouseEvent | PointerEvent) => {
      recordIframeActivity()
      const frameEl = contents.window?.frameElement as HTMLElement | null
      const rect = frameEl?.getBoundingClientRect()
      const clientX = (rect?.left || 0) + e.clientX
      window.dispatchEvent(new CustomEvent('semply:reader-pointer', { detail: { clientX } }))
    }

    contents.window.addEventListener('pointermove', handleIframePointerMove, { passive: true })
    contents.window.addEventListener('mousedown', recordIframeActivity, { passive: true })
    contents.window.addEventListener('keydown', recordIframeActivity, { passive: true })
    contents.window.addEventListener('touchstart', recordIframeActivity, { passive: true })
    contents.window.addEventListener(
      'touchmove',
      () => {
        recordIframeActivity()
        if (useAppStore.getState().isAutoscrollActive) {
          triggerManualScrollTakeover()
        }
      },
      { passive: true }
    )

    // Clear any transient blur suspension whenever focus enters the EPUB iframe
    contents.window.addEventListener('focus', () => {
      adaptiveScrollEngine.setSuspension('blur', false)
    })

    // Close context menu and popups on left click or Escape inside the EPUB iframe
    doc.addEventListener('mousedown', (e: MouseEvent) => {
      if (e.button === 0) {
        setContextMenu(null)
        setActiveAnnotation(null)
        setSelectedText(null)
        setOpenNoteModalDirect(false)
      }
    })
    contents.window.addEventListener('keydown', (e: KeyboardEvent) => {
      if (isTargetInput(e.target)) return

      const isBackKey =
        (e.altKey && !e.ctrlKey && !e.metaKey && e.key === 'ArrowLeft') ||
        (!e.ctrlKey && !e.altKey && !e.metaKey && e.key === 'Backspace')
      if (isBackKey) {
        e.preventDefault()
        e.stopPropagation()
        const st = useAppStore.getState()
        if (st.isSearchDrawerOpen || st.isTOCDrawerOpen || st.isBookmarksDrawerOpen || st.isNotesDrawerOpen || st.isSettingsDrawerOpen) {
          st.toggleSearchDrawer(false)
          st.toggleTOCDrawer(false)
          st.toggleBookmarksDrawer(false)
          st.toggleNotesDrawer(false)
          st.toggleSettingsDrawer(false)
        } else {
          navigateStepRef.current('prev')
        }
        return
      }
      const isForwardKey =
        e.altKey && !e.ctrlKey && !e.metaKey && e.key === 'ArrowRight'
      if (isForwardKey) {
        e.preventDefault()
        e.stopPropagation()
        navigateStepRef.current('next')
        return
      }
      // Keep bare Control key and destructive/zoom Ctrl combos unresponsive
      if (e.key === 'Control' || e.key === 'F5') {
        e.preventDefault()
        return
      }
      if (e.ctrlKey || e.metaKey) {
        const k = e.key.toLowerCase()
        if (k === 'z') {
          e.preventDefault()
          e.stopPropagation()
          if (e.shiftKey) {
            handleRedoRef.current()
          } else {
            handleUndoRef.current()
          }
          return
        }
        if (k === 'y') {
          e.preventDefault()
          e.stopPropagation()
          handleRedoRef.current()
          return
        }
        if (k === 'f') {
          e.preventDefault()
          e.stopPropagation()
          openSearchDrawerRef.current()
          return
        }
        if (k === 'b' || k === 'd') {
          e.preventDefault()
          e.stopPropagation()
          toggleCurrentBookmarkRef.current()
          return
        }
        if (k === '/' || e.key === '?') {
          e.preventDefault()
          e.stopPropagation()
          useAppStore.getState().toggleHelpModal()
          return
        }
        if (k === '=' || k === '+' || e.code === 'Equal' || e.code === 'NumpadAdd') {
          e.preventDefault()
          e.stopPropagation()
          const cur = useAppStore.getState().settings.fontSize
          useAppStore.getState().updateSettings({ fontSize: Math.min(42, cur + 2) })
          return
        }
        if (k === '-' || k === '_' || e.code === 'Minus' || e.code === 'NumpadSubtract') {
          e.preventDefault()
          e.stopPropagation()
          const cur = useAppStore.getState().settings.fontSize
          useAppStore.getState().updateSettings({ fontSize: Math.max(12, cur - 2) })
          return
        }
        if (k === '0' || e.code === 'Digit0' || e.code === 'Numpad0') {
          e.preventDefault()
          e.stopPropagation()
          useAppStore.getState().updateSettings({ fontSize: 21 })
          return
        }
        if (k === 'r') {
          e.preventDefault()
          e.stopPropagation()
          const curSettings = useAppStore.getState().settings
          const curDual = (curSettings.pageLayout ?? (curSettings.pageSpread === 'single' ? 'single' : 'dual')) === 'dual'
          useAppStore.getState().updateSettings({
            pageLayout: curDual ? 'single' : 'dual',
            pageSpread: curDual ? 'single' : 'double'
          })
          return
        }
        if (k === 'w') {
          e.preventDefault()
          e.stopPropagation()
          return
        }
        return
      }

      if (e.key === 'F7') {
        e.preventDefault()
        handleToggleTTSRef.current()
      } else if (e.key === 'F8') {
        e.preventDefault()
        handleStopTTSRef.current()
      } else if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey && (e.key === ' ' || e.code === 'Space')) {
        e.preventDefault()
        e.stopPropagation()
        if (useAppStore.getState().isAutoscrollActive) {
          adaptiveScrollEngine.setUserPaused(!adaptiveScrollEngine.isPausedState())
        } else {
          navigateStepRef.current('next')
        }
        return
      } else if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        useAppStore.getState().setAutoscrollActive(!useAppStore.getState().isAutoscrollActive)
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === 'j') {
        e.preventDefault()
        navigateStepRef.current('next')
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft' || e.key === 'PageUp' || e.key === 'Backspace' || e.key === 'k') {
        e.preventDefault()
        navigateStepRef.current('prev')
      } else if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === '[') {
        e.preventDefault()
        if (useAppStore.getState().isAutoscrollActive) {
          const updated = adaptiveScrollEngine.nudgeDwellSec(-2)
          useAppStore.getState().showToast(`Auto-Flip: ${updated}s`, 'info')
        } else {
          handleChapterStepRef.current('prev')
        }
      } else if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === ']') {
        e.preventDefault()
        if (useAppStore.getState().isAutoscrollActive) {
          const updated = adaptiveScrollEngine.nudgeDwellSec(2)
          useAppStore.getState().showToast(`Auto-Flip: ${updated}s`, 'info')
        } else {
          handleChapterStepRef.current('next')
        }
      } else if (e.key === 'Home') {
        e.preventDefault()
        renditionRef.current?.display(0)
      } else if (e.key === 'End') {
        e.preventDefault()
        handleJumpEndRef.current()
      } else if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault()
        useAppStore.getState().toggleHelpModal()
      } else if (!e.ctrlKey && !e.metaKey && !e.altKey && (e.key === '+' || e.key === '=')) {
        e.preventDefault()
        if (useAppStore.getState().isAutoscrollActive) {
          const updated = adaptiveScrollEngine.nudgeDwellSec(2)
          useAppStore.getState().showToast(`Auto-Flip: ${updated}s`, 'info')
        } else {
          const cur = useAppStore.getState().settings.fontSize
          useAppStore.getState().updateSettings({ fontSize: Math.min(42, cur + 2) })
        }
      } else if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === '-') {
        e.preventDefault()
        if (useAppStore.getState().isAutoscrollActive) {
          const updated = adaptiveScrollEngine.nudgeDwellSec(-2)
          useAppStore.getState().showToast(`Auto-Flip: ${updated}s`, 'info')
        } else {
          const cur = useAppStore.getState().settings.fontSize
          useAppStore.getState().updateSettings({ fontSize: Math.max(12, cur - 2) })
        }
      } else if (e.key === '0') {
        e.preventDefault()
        useAppStore.getState().updateSettings({ fontSize: 21 })
      } else if (e.key.toLowerCase() === 'r' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        const curSettings = useAppStore.getState().settings
        const curDual = (curSettings.pageLayout ?? (curSettings.pageSpread === 'single' ? 'single' : 'dual')) === 'dual'
        useAppStore.getState().updateSettings({
          pageLayout: curDual ? 'single' : 'dual',
          pageSpread: curDual ? 'single' : 'double'
        })
      } else if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        if (contextMenu) {
          setContextMenu(null)
          return
        }
        if (activeAnnotation) {
          setActiveAnnotation(null)
          return
        }
        if (selectedText) {
          setSelectedText(null)
          setOpenNoteModalDirect(false)
          return
        }
        const st = useAppStore.getState()
        if (st.isSearchDrawerOpen || st.isTOCDrawerOpen || st.isBookmarksDrawerOpen || st.isNotesDrawerOpen || st.isSettingsDrawerOpen) {
          st.toggleSearchDrawer(false)
          st.toggleTOCDrawer(false)
          st.toggleBookmarksDrawer(false)
          st.toggleNotesDrawer(false)
          st.toggleSettingsDrawer(false)
          return
        }
        if (activeFootnote) {
          setActiveFootnote(null)
          return
        }
        if (st.isAutoscrollActive) {
          st.setAutoscrollActive(false)
          return
        }
        if (st.isTTSActive) {
          handleStopTTSRef.current()
          return
        }
        if (st.isImmersiveFullscreen || Boolean(document.fullscreenElement)) {
          st.setImmersiveFullscreen(false)
          window.desktopAPI?.setFullscreen?.(false)
          if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {})
          }
          return
        }
        onBackRef.current()
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
          const range = sel.getRangeAt(0)
          cfiRange = contents.cfiFromRange(range) || ''
          selectedIceRangeRef.current = captureIceRange(range, doc, currentHrefRef.current)
          selectionContentsRef.current = contents
        } catch {
          cfiRange = ''
        }
      }

      openContextMenuRef.current(clickX, clickY, text, cfiRange)
    })
  }, [setActiveFootnote, applyDynamicStylesToDoc, sanitizeEpubDocument])

  // Helper: only trust epub.js locations once generation/load has finalized with total > 0
  const hasReadyLocations = useCallback((epub: EpubBook | null | undefined): boolean => {
    if (!epub || !locationsReadyRef.current) return false
    const locs = epub.locations as any
    return Boolean(locs && typeof locs.total === 'number' && locs.total > 0 && locs.length?.() > 1)
  }, [])

  // Compute consistent 1-based page number and smooth fractional progress percent from a rendition location
  const computeProgressMetrics = useCallback(
    (epub: EpubBook | null | undefined, location: any): { page: number; pct: number; total: number } => {
      const start = location?.start
      if (!start) {
        return {
          page: currentPageRef.current || 1,
          pct: progressPercentRef.current || 0,
          total: Math.max(1, totalPagesRef.current || bookTotalPagesRef.current || 1)
        }
      }

      const cfi: string = start.cfi || ''
      const atEnd = Boolean(location?.atEnd)
      const hasMovedPastStart =
        (start.index != null && start.index > 0) ||
        Boolean(start.displayed?.page && start.displayed.page > 1)

      // 1. Accurate locations-backed metrics (only when locations are fully indexed)
      if (hasReadyLocations(epub) && cfi) {
        const locs = epub!.locations as any
        const locCount = Math.max(1, Number(locs.length?.() || locs.total + 1 || 1))
        const rawLoc = Number(locs.locationFromCfi(cfi))
        const page = atEnd
          ? locCount
          : Number.isFinite(rawLoc) && rawLoc >= 0
          ? Math.min(locCount, Math.max(1, rawLoc + 1))
          : 1

        let rawPct = Number(locs.percentageFromCfi(cfi))
        if (!Number.isFinite(rawPct) || rawPct < 0) {
          rawPct = locCount > 1 ? (page - 1) / (locCount - 1) : 0
        }
        const pct = atEnd
          ? 100
          : page <= 1 && !hasMovedPastStart
          ? 0
          : Math.min(100, Math.max(0.5, Math.round(rawPct * 1000) / 10))
        return { page, pct, total: locCount }
      }

      // 2. Reliable spine-proportional fallback while locations index in the background
      const spineItems: any[] = ((epub?.spine as any)?.spineItems || []).filter(
        (item: any) => item && item.linear !== false && item.linear !== 'no'
      )
      const spineTotal = Math.max(1, spineItems.length || (epub?.spine as any)?.length || 1)
      let spineIdx = typeof start.index === 'number' ? start.index : 0
      if (spineItems.length > 0 && start.href) {
        const cleanHref = String(start.href).split('#')[0]
        const foundIdx = spineItems.findIndex(
          (item: any) => item.href && (item.href === cleanHref || cleanHref.endsWith(item.href))
        )
        if (foundIdx >= 0) spineIdx = foundIdx
      }
      const secPage = Math.max(1, start.displayed?.page || 1)
      const secTotal = Math.max(1, start.displayed?.total || 1)
      const progressRatio = atEnd
        ? 1
        : Math.min(1, Math.max(0, (spineIdx + (secPage - 1) / secTotal) / spineTotal))

      const fallbackTotal = Math.max(
        spineTotal,
        totalPagesRef.current > 1 ? totalPagesRef.current : 0,
        bookTotalPagesRef.current > 1 ? bookTotalPagesRef.current : 0,
        secTotal
      )
      const page = atEnd
        ? fallbackTotal
        : Math.min(fallbackTotal, Math.max(1, Math.round(progressRatio * Math.max(1, fallbackTotal - 1)) + 1))
      const pct = atEnd
        ? 100
        : spineIdx === 0 && secPage <= 1
        ? 0
        : Math.min(100, Math.max(0.5, Math.round(progressRatio * 1000) / 10))

      return { page, pct, total: fallbackTotal }
    },
    [hasReadyLocations]
  )

  // Initialize ePub reader engine
  useEffect(() => {
    let isCancelled = false
    let epubInstance: EpubBook | null = null
    adaptiveScrollEngine.setSuspension('layout', true)
    let renditionInstance: Rendition | null = null
    locationsReadyRef.current = false
    isScrubbingRef.current = false

    async function initReader() {
      if (!viewerRef.current) return
      viewerRef.current.innerHTML = ''

      let sourceData: any =
        bookFormatRef.current === 'pdf' && pdfViewMode === 'reflow' && reflowEpubBuffer
          ? reflowEpubBuffer
          : activeBookBuffer
      if (!sourceData) {
        const currentPath = typeof bookFilePathRef.current === 'string' ? bookFilePathRef.current : ''
        if (
          window.desktopAPI?.readFileBuffer &&
          currentPath &&
          !currentPath.startsWith('http://') &&
          !currentPath.startsWith('https://') &&
          !currentPath.startsWith('/assets/') &&
          !currentPath.startsWith('assets/')
        ) {
          try {
            sourceData = await window.desktopAPI.readFileBuffer(currentPath)
          } catch {
            sourceData = currentPath
          }
        } else if (currentPath) {
          try {
            const resp = await fetch(currentPath)
            sourceData = await resp.arrayBuffer()
          } catch {
            sourceData = currentPath
          }
        }
      }

      epubInstance = ePub(sourceData)
      epubBookRef.current = epubInstance

      // Sanitize untrusted EPUB XHTML pre-parse (before epub.js serializes into iframe.srcdoc)
      epubInstance.ready
        .then(() => {
          ;(epubInstance?.spine as any)?.hooks?.content?.register?.((doc: Document) => {
            if (doc) sanitizeEpubDocument(doc)
          })
        })
        .catch(() => {})

      // 1:1 Horizontal Paginated Spread: Single Page vs Dual Page
      const isDual = (settings.pageLayout ?? (settings.pageSpread === 'single' ? 'single' : 'dual')) === 'dual'
      renditionInstance = epubInstance.renderTo(viewerRef.current, {
        width: '100%',
        height: '100%',
        spread: isDual ? 'always' : 'none',
        flow: 'paginated',
        manager: 'default',
        minSpreadWidth: 0,
        gap: 64
      } as any)
      renditionInstance.settings.minSpreadWidth = 0
      if ((renditionInstance as any)._layout) {
        ;(renditionInstance as any)._layout._minSpreadWidth = 0
      }

      const applyMinSpreadWidth = () => {
        if ((renditionInstance as any)?._layout) {
          ;(renditionInstance as any)._layout._minSpreadWidth = 0
        }
        if ((renditionInstance as any)?.manager?.layout) {
          ;(renditionInstance as any).manager.layout._minSpreadWidth = 0
        }
      }
      renditionInstance.on('started', applyMinSpreadWidth)
      renditionRef.current = renditionInstance

      // Guard epub.js internal Queue against permanent rejection deadlocks:
      // In epubjs@0.3.93, Queue.run() lacks a rejection handler on dequeue(), so any rejected
      // display() leaves q.running === true forever and freezes arrow keys, wheel, and seeking.
      // We also replace `this.tick` (which epub.js sets to setTimeout) with a plain setTimeout
      // so the queue drains even when the iframe is not painted (e.g. during initial mount),
      // preventing the rAF-invisible-frame stall that blocks all navigation after book open.
      const q = (renditionInstance as any).q
      if (q && typeof q.run === 'function' && !q.__semplySafePatched) {
        q.__semplySafePatched = true
        q.run = function () {
          if (!this.running) {
            this.running = true
            let resolveDeferred!: () => void
            const promise = new Promise<void>((res) => {
              resolveDeferred = res
            })
            this.defered = { promise, resolve: resolveDeferred }
          }
          // Always use setTimeout (never rAF) so the queue drains even when the
          // document/iframe is hidden or not yet painted during initial book load.
          // Wrap dequeue() inside Promise.resolve().then(...) so synchronous throws
          // cannot escape and permanently leave this.running === true.
          setTimeout(() => {
            if (this.paused) {
              this.running = undefined
              return
            }
            if (this._q && this._q.length) {
              Promise.resolve()
                .then(() => this.dequeue())
                .then(
                  () => {
                    if (!this.paused) this.run()
                    else this.running = undefined
                  },
                  () => {
                    if (!this.paused) this.run()
                    else this.running = undefined
                  }
                )
            } else {
              this.defered?.resolve?.()
              this.running = undefined
            }
          }, 0)
          if (this.paused === true) {
            this.paused = false
          }
          return this.defered.promise
        }
      }

      // Also resolve dangling displaying deferred on displayError so q never stalls mid-display.
      // We also force-drain the queue's running flag here so a failed display(startCfi) during
      // initial book open does not permanently lock all subsequent next()/prev() calls.
      renditionInstance.on('displayError', () => {
        const rendAny = renditionInstance as any
        if (rendAny?.displaying) {
          try {
            rendAny.displaying.resolve()
          } catch {}
          rendAny.displaying = undefined
        }
        // Reset the queue's running flag so the queue can process the next enqueued display()
        const queueAny = (renditionInstance as any)?.q
        if (queueAny && queueAny.running) {
          try {
            queueAny.defered?.resolve?.()
          } catch {}
          queueAny.running = undefined
        }
      })

      // Intercept epub.js rendition.onResized to guarantee resize always restores currentCfiRef
      // rather than falling back to stale this.location.start.cfi
      const origOnResized = (renditionInstance as any).onResized?.bind(renditionInstance)
      if (origOnResized) {
        ;(renditionInstance as any).onResized = function (size: any, epubcfi?: string) {
          const targetCfi = epubcfi || currentCfiRef.current || (this.location?.start?.cfi)
          if (this.location && targetCfi) {
            this.location.start = { ...(this.location.start || {}), cfi: targetCfi }
          }
          return origOnResized(size, targetCfi)
        }
      }

      // Register themes without clobbering epub.js paginated column padding/margins
      const registerThemes = () => {
        const baseRules = {
          p: {
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
          body: { background: '#0c0c0d !important', color: '#f5f7fa !important' },
          'p, div, span, li, blockquote': { color: '#f5f7fa !important' },
          'h1, h2, h3, h4, h5': { color: '#ffffff !important' },
          a: { color: '#8cc4ff !important' }
        })

        renditionInstance!.themes.register('day', {
          ...baseRules,
          body: { background: '#ffffff !important', color: '#121212 !important' },
          'p, div, span, li, blockquote': { color: '#121212 !important' },
          'h1, h2, h3, h4, h5': { color: '#000000 !important' },
          a: { color: '#005cc5 !important' }
        })

        renditionInstance!.themes.register('light-sepia', {
          ...baseRules,
          body: { background: '#f5ecd8 !important', color: '#1f1810 !important' },
          'p, div, span, li, blockquote': { color: '#1f1810 !important' },
          'h1, h2, h3, h4, h5': { color: '#120d08 !important' },
          a: { color: '#6e4318 !important' }
        })

        renditionInstance!.themes.register('dark-sepia', {
          ...baseRules,
          body: { background: '#1f1914 !important', color: '#f5ede0 !important' },
          'p, div, span, li, blockquote': { color: '#f5ede0 !important' },
          'h1, h2, h3, h4, h5': { color: '#fffcf6 !important' },
          a: { color: '#f3d9b8 !important' }
        })

        renditionInstance!.themes.select(settings.theme)
      }

      registerThemes()

      // Hook iframe rendered content
      renditionInstance.hooks.content.register((contents: any) => {
        attachIframeHooks(contents)
      })

      const syncActiveChapter = (location: any, tocItems: TocItem[]) => {
        if (!location?.start) return
        if (location.start.href) {
          setCurrentHref(location.start.href)
        }
        // In vertical continuous mode, multiple iframes are mounted simultaneously;
        // pick the Contents matching location.start.index rather than assuming index 0.
        const contentsList = ((renditionInstance?.getContents?.() as unknown as any[]) || []).filter(Boolean)
        const targetIdx = typeof location.start.index === 'number' ? location.start.index : -1
        const activeContents =
          (targetIdx >= 0 ? contentsList.find((c: any) => c?.sectionIndex === targetIdx) : null) ||
          contentsList[0]
        const iframeDoc = activeContents?.document as Document | undefined
        const matched = findActiveTocItem(tocItems, location, iframeDoc, epubInstance)
        if (matched) {
          setActiveTocId(matched.id)
          const label = matched.label.trim()
          if (label) {
            setCurrentChapter(label)
            setCurrentChapterTitle(label)
          }
        }
      }

      // Load Navigation TOC once spine & packaging are ready so every href maps accurately to a spine section
      Promise.all([epubInstance.ready, epubInstance.loaded.navigation])
        .then(([, nav]) => {
          if (isCancelled || !epubInstance) return
          const items = buildResolvedToc(epubInstance, (nav as any)?.toc || [])
          tocRef.current = items
          setToc(items)
          const curLoc = safeGetRenditionLocation(renditionInstance)
          if (curLoc?.start) {
            syncActiveChapter(curLoc, items)
          }
        })
        .catch(() => {})

      const applyLocationState = (location: any, persistToDb = true) => {
        if (isCancelled || !location || !location.start) return
        const cfi = location.start.cfi
        currentCfiRef.current = cfi
        setCurrentCfi(cfi)
        setCurrentEndCfi(location.end?.cfi || '')
        if (renditionInstance && location) {
          renditionInstance.location = location
        }

        const { page, pct, total } = computeProgressMetrics(epubInstance, location)
        setTotalPages(total)
        setProgressPercent(pct)
        setCurrentPage(page)

        syncActiveChapter(location, tocRef.current)

        // Feature 1: Record manual reading cadence between page turns with Skimming Protection
        const now = Date.now()
        const elapsedMs = now - pageEnteredAtRef.current
        const prevWords = lastWordsOnPageRef.current
        if (!useAppStore.getState().isAutoscrollActive && prevWords > 0) {
          const prevPage = currentPageRef.current || page
          const isDual = (settings.pageLayout ?? (settings.pageSpread === 'single' ? 'single' : 'dual')) === 'dual'
          if (prevPage !== page) {
            adaptiveScrollEngine.recordManualNavigation(prevPage, page, prevWords, elapsedMs, isDual)
          } else {
            adaptiveScrollEngine.recordManualReading(prevWords, elapsedMs, page, isDual)
          }
        }
        pageEnteredAtRef.current = now

        // Analyze visible page metrics once and cache for autoscroll/pacing without redundant DOM cloning
        const pageMetrics = analyzeVisiblePageRef.current(location)
        lastWordsOnPageRef.current = pageMetrics.visibleWords

        if (persistToDb && bookIdRef.current) {
          const isFinished = pct >= 99.5 || Boolean(location.atEnd)
          const progressPatch = {
            progressCfi: cfi,
            progressPercent: isFinished ? 100 : Math.round(pct),
            currentPage: page,
            totalPages: total,
            lastOpenedAt: Date.now(),
            ...(isFinished ? { isRead: true } : {})
          }
          db.books.update(bookIdRef.current, progressPatch)
          syncActiveBookProgress(progressPatch)
        }
      }

      // Register relocation & selection listeners BEFORE initial display so initial events are never missed
      renditionInstance.on('relocated', (location: any) => {
        if (isCancelled || isScrubbingRef.current) return
        applyLocationState(location, true)
        if (useAppStore.getState().isAutoscrollActive) {
          armPageRef.current()
        }
      })

      renditionInstance.on('selected', (cfiRange: string, contents: any) => {
        if (isCancelled) return
        const win = contents?.window
        if (!win) return
        const selection = win.getSelection?.()
        const text = selection?.toString().trim()
        if (text && selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0)
          const rect = range.getBoundingClientRect()
          const frameEl = win.frameElement as HTMLElement | null
          const iframeRect = frameEl?.getBoundingClientRect() || viewerRef.current?.getBoundingClientRect()

          selectedIceRangeRef.current = captureIceRange(range, contents.document, currentHrefRef.current)
          selectionContentsRef.current = contents
          setActiveAnnotation(null)
          setOpenNoteModalDirect(false)
          setSelectedText(text)
          setSelectedCfiRange(cfiRange)

          if (rect && iframeRect) {
            setSelectionPos({
              x: iframeRect.left + rect.left + rect.width / 2,
              y: iframeRect.top + rect.top
            })
          }
        }
      })

      // Display initial position safely (fall back to book start if stored CFI is stale/invalid).
      // When re-initializing the SAME book (e.g. switching single/double spread or scroll mode),
      // resume from the live currentCfiRef so the reader never snaps back to page 1.
      const isSameBook = lastLoadedBookKeyRef.current === bookKey
      lastLoadedBookKeyRef.current = bookKey
      const pendingPct = useAppStore.getState().pendingSeekPercent
      const resumeCfi = isSameBook ? currentCfiRef.current : bookInitialCfiRef.current
      let startLocation: string | undefined =
        pendingPct === null && typeof resumeCfi === 'string' && resumeCfi.trim().length > 0
          ? resumeCfi
          : undefined

      // If transitioning from PDF -> EPUB at a proportional percent, pre-select the nearest spine section
      if (pendingPct !== null && pendingPct > 0.5) {
        try {
          await epubInstance.ready
          const spineItems = ((epubInstance.spine as any)?.spineItems || []) as Array<{ href?: string }>
          if (spineItems.length > 1) {
            const idx = Math.max(
              0,
              Math.min(spineItems.length - 1, Math.round((pendingPct / 100) * (spineItems.length - 1)))
            )
            if (spineItems[idx]?.href) {
              startLocation = spineItems[idx].href
            }
          }
        } catch {
          // Fall back to default start if spine isn't inspectable yet
        }
      }

      try {
        await renditionInstance.display(startLocation)
      } catch {
        if (!isCancelled) {
          try {
            await renditionInstance.display()
          } catch (fallbackErr) {
            console.warn('EPUB initial display failed:', fallbackErr)
          }
        }
      }

      if (isCancelled) return

      // Immediately sync initial page/progress once displayed
      const initialLoc = safeGetRenditionLocation(renditionInstance)
      if (initialLoc?.start) {
        applyLocationState(initialLoc, false)
      }
      adaptiveScrollEngine.setSuspension('layout', false)
      adaptiveScrollEngine.recordUserActivity()
      viewerRef.current?.focus()

      // Hydrate all saved annotations/highlights onto the rendition immediately
      if (bookIdRef.current && !isCancelled) {
        try {
          const saved = await db.annotations.where('bookId').equals(bookIdRef.current).toArray()
          annotationsListRef.current = saved
          hydrateRenditionAnnotations(
            renditionInstance,
            saved,
            themeRef.current,
            (ann, e) => openAnnotationPopoverRef.current(ann, e)
          )
        } catch (err) {
          console.warn('Annotation hydration failed:', err)
        }
      }

      // Hydrate or fast-generate spine locations AFTER initial display (never racing or unloading active section)
      epubInstance.ready
        .then(async () => {
          if (isCancelled || !epubInstance) return
          const locs = epubInstance.locations as any
          const cachedLocs = bookLocationsCacheRef.current
          const canUseCache =
            (bookFormatRef.current === 'epub' || Boolean(reflowEpubBuffer)) &&
            typeof cachedLocs === 'string' &&
            cachedLocs.length > 2

          const applyPendingProportionalSeek = async () => {
            const targetPct = useAppStore.getState().pendingSeekPercent
            if (targetPct === null || isCancelled || !epubInstance || !renditionInstance) return
            setPendingSeekPercent(null)
            try {
              const frac = Math.max(0, Math.min(1, targetPct / 100))
              const targetCfi = locs.cfiFromPercentage?.(frac)
              if (targetCfi) {
                await renditionInstance.display(targetCfi)
              }
            } catch {
              // Ignore seek fallback failure
            }
          }

          if (canUseCache) {
            try {
              locs.load(cachedLocs)
              if (locs.total > 0 && locs.length() > 1) {
                locationsReadyRef.current = true
                const total = locs.length()
                setTotalPages(total)
                await applyPendingProportionalSeek()
                const curLoc = safeGetRenditionLocation(renditionInstance)
                if (curLoc?.start && !isScrubbingRef.current) {
                  applyLocationState(curLoc, false)
                }
                return
              }
            } catch {
              // Fall through to clean regeneration if cache is malformed
            }
          }

          // Speed up background indexing (default 100ms pause per section stalls 10-60s on large books)
          locs.pause = 4

          // Protect all sections from being unloaded during background indexing to prevent race conditions with navigation
          const origProcess = locs.process.bind(locs)
          locs.process = (section: any) => {
            const origUnload = section.unload
            section.unload = () => {}
            return Promise.resolve(origProcess(section)).finally(() => {
              section.unload = origUnload
            })
          }

          await epubInstance.locations.generate(1000)
          if (isCancelled || !epubInstance) return

          if (locs.total > 0 && locs.length() > 1) {
            locationsReadyRef.current = true
            const total = locs.length()
            setTotalPages(total)

            if (bookIdRef.current && (bookFormatRef.current === 'epub' || Boolean(reflowEpubBuffer))) {
              try {
                const serialized = locs.save()
                bookLocationsCacheRef.current = serialized
                db.books.update(bookIdRef.current, { locationsCache: serialized, totalPages: total }).catch(() => {})
              } catch {}
            }

            await applyPendingProportionalSeek()
            const curLoc = safeGetRenditionLocation(renditionInstance)
            if (curLoc?.start && !isScrubbingRef.current) {
              applyLocationState(curLoc, true)
            }
          }
        })
        .catch(() => {})
    }

    initReader()

    return () => {
      isCancelled = true
      locationsReadyRef.current = false
      adaptiveScrollEngine.setSuspension('layout', false)
      // Stop the internal epub.js queue BEFORE destroy() so pending Rendition.start()
      // tasks never fire against an undefined book after unmount/StrictMode remount.
      // IMPORTANT: null the refs AFTER destroy() — nulling before destroy() causes a
      // use-after-free race where the new initReader() starts while the old rendition
      // is still alive and firing relocated/displayError events against null refs.
      const rendAny = renditionInstance as any
      try {
        rendAny?.q?.stop?.()
        rendAny?.q?.clear?.()
      } catch {}
      try {
        renditionInstance?.destroy()
      } catch {}
      try {
        epubInstance?.destroy?.()
      } catch {}
      renditionRef.current = null
      epubBookRef.current = null
    }
  }, [
    bookKey,
    book.format,
    activeBookBuffer,
    pdfViewMode,
    reflowEpubBuffer,
    settings.pageLayout,
    settings.pageSpread,
    attachIframeHooks,
    computeProgressMetrics
  ])

  // Load & sync bookmarks list for live current-page ribbon state
  useEffect(() => {
    if (!book.id) return
    db.bookmarks
      .where('bookId')
      .equals(book.id)
      .toArray()
      .then((items) => setBookBookmarks(items))
      .catch(() => {})
  }, [book.id, bookmarksVersion])

  // Keep SVG highlight blend-mode and opacity synced when theme changes
  useEffect(() => {
    if (!renditionRef.current || !book.id) return
    db.annotations
      .where('bookId')
      .equals(book.id)
      .toArray()
      .then((saved) => {
        annotationsListRef.current = saved
        hydrateRenditionAnnotations(
          renditionRef.current,
          saved,
          settings.theme,
          (ann, e) => openAnnotationPopoverRef.current(ann, e)
        )
      })
      .catch(() => {})
  }, [settings.theme, book.id, annotationsVersion])

  // Synchronize dynamic settings (theme, font size, line height, font weight, and downloaded/local font family)
  useEffect(() => {
    if (!renditionRef.current) return
    adaptiveScrollEngine.setSuspension('layout', true)

    // Inject @font-face CSS and dynamic typography rules into any currently mounted EPUB iframes
    const applyFontAndTheme = async () => {
      try {
        const contentsList = (renditionRef.current?.getContents() as unknown as any[]) || []
        for (const c of contentsList) {
          if (c?.document) {
            await injectFontIntoDocument(c.document, settings.fontFamily)
            applyDynamicStylesToDoc(c.document)
          }
        }
      } catch {
        // Ignore iframe injection races during chapter unload
      }
      if (!renditionRef.current) return
      renditionRef.current.themes.select(settings.theme)
      renditionRef.current.themes.fontSize(`${settings.fontSize}px`)

      // Allow DOM reflow to settle, then lift suspension and re-arm the engine with new visible word metrics
      setTimeout(() => {
        adaptiveScrollEngine.setSuspension('layout', false)
        if (useAppStore.getState().isAutoscrollActive) {
          armPageRef.current()
        }
      }, 200)
    }

    applyFontAndTheme()
  }, [
    settings.theme,
    settings.fontSize,
    settings.fontWeight,
    settings.lineHeight,
    settings.fontFamily,
    applyDynamicStylesToDoc
  ])

  // Standard page navigation: delegates to epub.js next()/prev() cleanly without manual spine thrashing
  const isNavigatingRef = useRef(false)
  const navigateStep = useCallback(async (direction: 'next' | 'prev') => {
    const rendition = renditionRef.current as any
    if (!rendition || isNavigatingRef.current) return

    // Suspend countdown during page transition animation
    if (useAppStore.getState().isAutoscrollActive) {
      adaptiveScrollEngine.setSuspension('layout', true)
    }

    isNavigatingRef.current = true
    try {
      if (direction === 'next') {
        await rendition.next()
      } else {
        await rendition.prev()
      }
      const loc = safeGetRenditionLocation(rendition)
      if (loc?.start?.cfi) {
        currentCfiRef.current = loc.start.cfi
        setCurrentCfi(loc.start.cfi)
        if (rendition.location) {
          rendition.location = loc
        }
      }
    } catch (err) {
      console.warn('Navigation step error:', err)
    } finally {
      isNavigatingRef.current = false
      if (useAppStore.getState().isAutoscrollActive) {
        adaptiveScrollEngine.setSuspension('layout', false)
      }
    }
  }, [])
  navigateStepRef.current = navigateStep

  const handleNext = useCallback(() => navigateStep('next'), [navigateStep])
  const handlePrev = useCallback(() => navigateStep('prev'), [navigateStep])

  // Analyze only the currently visible page/spread for Adaptive Countdown word density & break markers
  const analyzeVisiblePage = useCallback((overrideLocation?: any): {
    visibleWords: number
    hasBreak: boolean
    atEnd: boolean
  } => {
    const loc = overrideLocation || safeGetRenditionLocation(renditionRef.current)
    const currentStartCfi = loc?.start?.cfi || ''
    if (
      cachedPageMetricsRef.current &&
      currentStartCfi &&
      cachedPageMetricsRef.current.cfi === currentStartCfi
    ) {
      return cachedPageMetricsRef.current
    }

    const spineItems = (epubBookRef.current?.spine as any)?.spineItems || []
    const spineLength = spineItems.length || (epubBookRef.current?.spine as any)?.length || 0
    const endIdx = loc?.end?.index ?? loc?.start?.index ?? 0
    // Gate atEnd detection strictly to loc.atEnd && endIdx >= spineLength - 1
    const atEnd = Boolean(loc?.atEnd && spineLength > 0 && endIdx >= spineLength - 1)
    const iframeDoc = (renditionRef.current?.getContents()?.[0] as any)?.document

    let visibleWords = 0
    let hasBreak = false

    // Tier 1: Exact visible range between start.cfi and end.cfi
    try {
      if (loc?.start?.cfi && loc?.end?.cfi && renditionRef.current) {
        const startR = (renditionRef.current as any).getRange?.(loc.start.cfi) as Range | undefined
        const endR = (renditionRef.current as any).getRange?.(loc.end.cfi) as Range | undefined
        if (startR && endR && startR.startContainer?.ownerDocument) {
          const startDoc = startR.startContainer.ownerDocument
          const endDoc = endR.endContainer?.ownerDocument
          if (startDoc === endDoc) {
            const combined = startDoc.createRange()
            combined.setStart(startR.startContainer, startR.startOffset)
            combined.setEnd(endR.endContainer, endR.endOffset)
            const frag = combined.cloneContents()
            frag.querySelectorAll('script, style, rt, rp, aside, [hidden], [aria-hidden="true"]').forEach((el) => el.remove())
            const hasImg = Boolean(frag.querySelector('img, svg, figure, image'))
            const cleanText = frag.textContent || combined.toString() || ''
            visibleWords = computeEffectiveWordCount(cleanText, hasImg).words

            hasBreak = Boolean(
              frag.querySelector('hr, .section-break, .break, .separator, blockquote, .asterism') ||
              /\*\s*\*\s*\*|\u2042|\u2041/.test(cleanText)
            )
          } else {
            const r1 = startDoc.createRange()
            r1.setStart(startR.startContainer, startR.startOffset)
            if (startDoc.body) r1.setEndAfter(startDoc.body.lastChild || startDoc.body)
            const frag1 = r1.cloneContents()

            let frag2: DocumentFragment | null = null
            if (endDoc && endDoc.body) {
              const r2 = endDoc.createRange()
              r2.setStartBefore(endDoc.body.firstChild || endDoc.body)
              r2.setEnd(endR.endContainer, endR.endOffset)
              frag2 = r2.cloneContents()
            }

            frag1.querySelectorAll('script, style, rt, rp, aside, [hidden], [aria-hidden="true"]').forEach((el) => el.remove())
            if (frag2) frag2.querySelectorAll('script, style, rt, rp, aside, [hidden], [aria-hidden="true"]').forEach((el) => el.remove())

            const cleanText = (frag1.textContent || '') + ' ' + (frag2?.textContent || '')
            const hasImg = Boolean(frag1.querySelector('img, svg, figure, image') || frag2?.querySelector('img, svg, figure, image'))
            visibleWords = computeEffectiveWordCount(cleanText, hasImg).words

            hasBreak = Boolean(
              frag1.querySelector('hr, .section-break, .break, .separator, blockquote, .asterism') ||
              frag2?.querySelector('hr, .section-break, .break, .separator, blockquote, .asterism') ||
              /\*\s*\*\s*\*|\u2042|\u2041/.test(cleanText)
            )
          }
        }
      }
    } catch {}

    // Tier 2: Proportional chapter fallback if exact range is unavailable
    if (visibleWords <= 0) {
      const chapterText = iframeDoc?.body?.innerText || ''
      if (chapterText) {
        const hasImg = Boolean(iframeDoc?.querySelector('img, svg, figure, image'))
        const chapterWords = computeEffectiveWordCount(chapterText, hasImg).words
        const secTotal = Math.max(1, loc?.start?.displayed?.total || 1)
        const isDual = (settings.pageLayout ?? (settings.pageSpread === 'single' ? 'single' : 'dual')) === 'dual'
        const spreadFactor = isDual ? 2 : 1
        visibleWords = Math.round((chapterWords / secTotal) * spreadFactor)
        if (!hasBreak) {
          hasBreak = Boolean(
            iframeDoc?.querySelector('hr, .section-break, .break, .separator, blockquote, .asterism') ||
            /\*\s*\*\s*\*|\u2042|\u2041/.test(chapterText)
          )
        }
      }
    }

    // Tier 3: Safe default for illustration/title spreads
    if (visibleWords <= 0) {
      const hasImg = Boolean(iframeDoc?.querySelector('img, svg, figure, image'))
      visibleWords = hasImg ? 60 : 150
    }

    const isSectionEnd = Boolean(
      loc?.end?.displayed?.page &&
      loc?.end?.displayed?.total &&
      loc.end.displayed.page >= loc.end.displayed.total
    )
    const hasChapterEndOrBreak = hasBreak || isSectionEnd

    const result = { visibleWords, hasBreak: hasChapterEndOrBreak, atEnd }
    if (currentStartCfi) {
      cachedPageMetricsRef.current = {
        cfi: currentStartCfi,
        ...result
      }
    }

    return result
  }, [settings.pageLayout, settings.pageSpread])
  analyzeVisiblePageRef.current = analyzeVisiblePage

  // Sync Auto-Scroll settings from Zustand store into engine
  useEffect(() => {
    const mode = settings.autoscrollMode ?? (settings.autoscrollAdaptive === false ? 'countdown' : 'adaptive')
    adaptiveScrollEngine.configure({
      mode,
      fixedCountdownSec: settings.autoscrollCountdownSec ?? 20,
      adaptiveBaseSec: settings.autoscrollAdaptiveSec ?? 25,
      microPauseEnabled: settings.autoscrollMicroPause ?? true
    })
  }, [
    settings.autoscrollMode,
    settings.autoscrollAdaptive,
    settings.autoscrollCountdownSec,
    settings.autoscrollAdaptiveSec,
    settings.autoscrollMicroPause
  ])

  // Reverse sync: Persist live cadence (WPM) and wheel nudges from engine back to store
  useEffect(() => {
    return adaptiveScrollEngine.onSyncSettings((s) => {
      const st = useAppStore.getState()
      st.setAdaptiveWpm(s.targetWpm)
      st.updateSettings({
        autoscrollCountdownSec: s.fixedCountdownSec,
        autoscrollAdaptiveSec: s.adaptiveBaseSec,
        targetWpm: s.targetWpm,
        observedWpm: s.observedWpm
      })
    })
  }, [])

  // App-level abandonment (blur/hidden) suspension & user activity listeners
  useEffect(() => {
    let blurTimer: ReturnType<typeof setTimeout> | null = null
    const handleBlur = () => {
      if (blurTimer) clearTimeout(blurTimer)
      // Clicking inside the EPUB iframe fires window.blur while document.hasFocus() stays true.
      // Only suspend if the Electron window truly lost OS focus.
      blurTimer = setTimeout(() => {
        if (!document.hasFocus()) {
          adaptiveScrollEngine.setSuspension('blur', true)
        }
      }, 60)
    }
    const handleFocus = () => {
      if (blurTimer) {
        clearTimeout(blurTimer)
        blurTimer = null
      }
      adaptiveScrollEngine.setSuspension('blur', false)
    }
    const handleVisibility = () => {
      adaptiveScrollEngine.setSuspension('hidden', document.visibilityState === 'hidden')
    }

    let lastActivityAt = 0
    const recordActivity = () => {
      const now = Date.now()
      if (now - lastActivityAt < 2000) return
      lastActivityAt = now
      adaptiveScrollEngine.recordUserActivity()
    }

    window.addEventListener('blur', handleBlur)
    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('mousedown', recordActivity, { passive: true })
    window.addEventListener('keydown', recordActivity, { passive: true })
    window.addEventListener('wheel', recordActivity, { passive: true })
    window.addEventListener('touchstart', recordActivity, { passive: true })

    return () => {
      if (blurTimer) clearTimeout(blurTimer)
      window.removeEventListener('blur', handleBlur)
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibility)
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
    contextMenu
  ])

  // Feature 1: Dual-Mode Auto-Scroll Countdown Lifecycle (with stall recovery across chapter edges)
  useEffect(() => {
    if (!isAutoscrollActive) {
      adaptiveScrollEngine.stop()
      return
    }

    // Clear any stale footnote hover suspension whenever relocating to a new page
    if (!useAppStore.getState().activeFootnote) {
      adaptiveScrollEngine.setSuspension('footnote', false)
    }
    if (document.hasFocus()) {
      adaptiveScrollEngine.setSuspension('blur', false)
    }

    let cancelled = false
    let isAdvancing = false
    let recoveryTimer: ReturnType<typeof setTimeout> | null = null

    const armPage = () => {
      if (cancelled || !useAppStore.getState().isAutoscrollActive) return
      if (recoveryTimer) {
        clearTimeout(recoveryTimer)
        recoveryTimer = null
      }
      isAdvancing = false
      const { visibleWords, hasBreak, atEnd } = analyzeVisiblePage()
      if (atEnd) {
        adaptiveScrollEngine.stop()
        setAutoscrollActive(false)
        return
      }

      const cfiBeforeTurn = currentCfiRef.current
      const container = (renditionRef.current as any)?.manager?.container as HTMLElement | undefined
      const scrollTopBeforeTurn = container?.scrollTop ?? 0
      const isDual = (settings.pageLayout ?? (settings.pageSpread === 'single' ? 'single' : 'dual')) === 'dual'
      const curPage = currentPageRef.current || 1
      const totalPages = totalPagesRef.current || bookTotalPagesRef.current || 1
      // Lone odd-page end guard: in dual mode on the final odd page where only 1 page is visible, treat as single page
      const isLoneOddFinalPage = isDual && totalPages > 1 && totalPages % 2 !== 0 && curPage >= totalPages
      const isDoubleSpread = isDual && !isLoneOddFinalPage

      const advancePage = async () => {
        if (cancelled || !useAppStore.getState().isAutoscrollActive || isAdvancing) return
        isAdvancing = true
        try {
          await handleNext()
          // Fallback guarantee: if epub.js relocated event does not fire within 600ms, re-arm the countdown
          setTimeout(() => {
            if (
              !cancelled &&
              useAppStore.getState().isAutoscrollActive &&
              !adaptiveScrollEngine.getMetrics().isActive
            ) {
              armPage()
            }
          }, 600)
        } catch (err) {
          console.warn('Auto-advance error:', err)
        } finally {
          setTimeout(() => {
            isAdvancing = false
          }, 400)
        }
      }

      adaptiveScrollEngine.startPageCountdown(
        visibleWords,
        hasBreak,
        () => {
          advancePage()

          // Recovery watchdog: if epub.js stalls on a section edge or emits the same CFI,
          // retry once after 1200ms so Auto-Scroll never freezes at 0s or skips multiple pages.
          if (recoveryTimer) clearTimeout(recoveryTimer)
          recoveryTimer = setTimeout(() => {
            if (cancelled || !useAppStore.getState().isAutoscrollActive) return
            if (currentCfiRef.current === cfiBeforeTurn) {
              const check = analyzeVisiblePage()
              if (check.atEnd) {
                adaptiveScrollEngine.stop()
                setAutoscrollActive(false)
              } else {
                advancePage()
                recoveryTimer = setTimeout(() => {
                  if (
                    !cancelled &&
                    useAppStore.getState().isAutoscrollActive &&
                    currentCfiRef.current === cfiBeforeTurn
                  ) {
                    armPage()
                  }
                }, 1000)
              }
            }
          }, 1200)
        },
        isDoubleSpread,
        curPage
      )
    }

    armPageRef.current = armPage
    armPage()

    return () => {
      cancelled = true
      if (recoveryTimer) clearTimeout(recoveryTimer)
    }
  }, [isAutoscrollActive, analyzeVisiblePage, handleNext, setAutoscrollActive])

  // Cleanly stop Auto-Scroll, Read Aloud (TTS), and close Search drawer when exiting the reader back to Library
  useEffect(() => {
    return () => {
      isTTSSpeakingLoopRef.current = false
      adaptiveScrollEngine.stop()
      ttsService.stop()
      const st = useAppStore.getState()
      st.setAutoscrollActive(false)
      st.setTTSActive(false)
      st.setTTSMuted(false)
      st.setActiveTTSWord(null)
      st.toggleSearchDrawer(false)
    }
  }, [])

  const isTTSSpeakingLoopRef = useRef(false)

  const getVisibleSpreadText = useCallback((): string => {
    const loc = safeGetRenditionLocation(renditionRef.current)
    const iframeDoc = (renditionRef.current?.getContents()?.[0] as any)?.document

    try {
      if (loc?.start?.cfi && loc?.end?.cfi && renditionRef.current) {
        const startR = (renditionRef.current as any).getRange?.(loc.start.cfi) as Range | undefined
        const endR = (renditionRef.current as any).getRange?.(loc.end.cfi) as Range | undefined
        if (startR && endR && startR.startContainer?.ownerDocument) {
          const startDoc = startR.startContainer.ownerDocument
          const endDoc = endR.endContainer?.ownerDocument
          if (startDoc === endDoc) {
            const combined = startDoc.createRange()
            combined.setStart(startR.startContainer, startR.startOffset)
            combined.setEnd(endR.endContainer, endR.endOffset)
            const frag = combined.cloneContents()
            frag.querySelectorAll('script, style, rt, rp, aside, [hidden], [aria-hidden="true"]').forEach((el) => el.remove())
            const text = (frag.textContent || combined.toString() || '').trim()
            if (text.length > 0) return text
          } else {
            const r1 = startDoc.createRange()
            r1.setStart(startR.startContainer, startR.startOffset)
            if (startDoc.body) r1.setEndAfter(startDoc.body.lastChild || startDoc.body)
            const frag1 = r1.cloneContents()

            let frag2: DocumentFragment | null = null
            if (endDoc && endDoc.body) {
              const r2 = endDoc.createRange()
              r2.setStartBefore(endDoc.body.firstChild || endDoc.body)
              r2.setEnd(endR.endContainer, endR.endOffset)
              frag2 = r2.cloneContents()
            }

            frag1.querySelectorAll('script, style, rt, rp, aside, [hidden], [aria-hidden="true"]').forEach((el) => el.remove())
            if (frag2) frag2.querySelectorAll('script, style, rt, rp, aside, [hidden], [aria-hidden="true"]').forEach((el) => el.remove())

            const text = ((frag1.textContent || '') + ' ' + (frag2?.textContent || '')).trim()
            if (text.length > 0) return text
          }
        }
      }
    } catch {}

    return iframeDoc?.body?.innerText?.trim() || book.title || 'Reading'
  }, [book.title])

  const speakSpreadLoop = useCallback(() => {
    const st = useAppStore.getState()
    if (!st.isTTSActive || !isTTSSpeakingLoopRef.current) return

    const text = getVisibleSpreadText()
    ttsService.speak(text, {
      rate: st.settings.ttsSpeed,
      pitch: st.settings.ttsPitch,
      voiceURI: st.settings.ttsVoice,
      onBoundary: (word) => {
        useAppStore.getState().setActiveTTSWord(word)
      },
      onEnd: async () => {
        useAppStore.getState().setActiveTTSWord(null)
        const cur = useAppStore.getState()
        if (!cur.isTTSActive || !isTTSSpeakingLoopRef.current) return

        const loc = safeGetRenditionLocation(renditionRef.current)
        const spineItems = (epubBookRef.current?.spine as any)?.spineItems || []
        const spineLength = spineItems.length || (epubBookRef.current?.spine as any)?.length || 0
        const endIdx = loc?.end?.index ?? loc?.start?.index ?? 0
        const isBookEnd = Boolean(loc?.atEnd && spineLength > 0 && endIdx >= spineLength - 1)

        if (isBookEnd) {
          cur.setTTSActive(false)
          cur.setTTSMuted(false)
          isTTSSpeakingLoopRef.current = false
          return
        }

        // Visually advance spread or progress across chapter boundary
        try {
          await navigateStep('next')
          setTimeout(() => {
            if (useAppStore.getState().isTTSActive && isTTSSpeakingLoopRef.current) {
              speakSpreadLoop()
            }
          }, 350)
        } catch (err) {
          console.warn('TTS auto-advance error:', err)
          cur.setTTSActive(false)
          isTTSSpeakingLoopRef.current = false
        }
      }
    })
  }, [getVisibleSpreadText, navigateStep])

  // Wire F7 (Play/Pause Read Aloud) and F8 (Stop Read Aloud) refs for isolated EPUB iframe keydown
  handleToggleTTSRef.current = () => {
    const st = useAppStore.getState()
    if (st.isTTSActive) {
      if (st.isTTSMuted) {
        ttsService.resume()
        st.setTTSMuted(false)
      } else {
        ttsService.pause()
        st.setTTSMuted(true)
      }
      return
    }
    st.setTTSActive(true)
    st.setTTSMuted(false)
    isTTSSpeakingLoopRef.current = true
    speakSpreadLoop()
  }

  handleStopTTSRef.current = () => {
    isTTSSpeakingLoopRef.current = false
    const st = useAppStore.getState()
    if (!st.isTTSActive) return
    ttsService.stop()
    st.setTTSActive(false)
    st.setTTSMuted(false)
    st.setActiveTTSWord(null)
  }

  // Reliable progress bar seeking with strict locations readiness check, CFI validation & spine/scroll fallbacks
  const handleSeek = useCallback(
    async (val: number) => {
      const rendition = renditionRef.current
      const epub = epubBookRef.current
      if (!rendition || !epub) return

      const clamped = Math.max(0, Math.min(100, Number.isFinite(val) ? val : 0))
      const reqId = ++seekRequestIdRef.current
      isScrubbingRef.current = true

      // Immediate optimistic UI update so the fluid bar & page counter respond instantaneously
      const safeTotal = Math.max(1, totalPagesRef.current || 1)
      const optimisticPage =
        safeTotal <= 1
          ? 1
          : clamped <= 0
          ? 1
          : clamped >= 100
          ? safeTotal
          : Math.max(1, Math.min(safeTotal, Math.round((clamped / 100) * (safeTotal - 1)) + 1))
      setProgressPercent(clamped)
      setCurrentPage(optimisticPage)

      let navigated = false
      try {
        // 1. Pinpoint CFI seek once locations have finished indexing (total > 0)
        if (hasReadyLocations(epub)) {
          const rawCfi = (epub.locations as any).cfiFromPercentage(clamped / 100)
          if (typeof rawCfi === 'string' && rawCfi.startsWith('epubcfi(')) {
            await rendition.display(rawCfi)
            navigated = true
          }
        }

        // 2. Fallback: Spine-item navigation (works immediately before locations finish indexing)
        if (!navigated) {
          const allSpine: any[] = (epub.spine as any)?.spineItems || []
          const linearSpine = allSpine.filter(
            (item) => item && item.linear !== false && item.linear !== 'no'
          )
          const spineList = linearSpine.length > 0 ? linearSpine : allSpine

          if (spineList.length > 1) {
            const targetIdx =
              clamped >= 100
                ? spineList.length - 1
                : Math.min(spineList.length - 1, Math.max(0, Math.round((clamped / 100) * (spineList.length - 1))))
            const item = spineList[targetIdx]
            if (item?.href) {
              await rendition.display(item.href)
              navigated = true
            }
          } else if (spineList.length === 1) {
            // Single-section EPUB fallback: scroll container proportionally
            const container = (rendition as any)?.manager?.container as HTMLElement | undefined
            if (container) {
              const delta = (rendition as any)?.manager?.layout?.delta || container.clientWidth || 1
              const maxScrollX = Math.max(0, container.scrollWidth - container.clientWidth)
              const rawLeft = (clamped / 100) * maxScrollX
              const snappedLeft = Math.floor(rawLeft / delta) * delta
              container.scrollLeft = Math.max(0, Math.min(maxScrollX, snappedLeft))
              ;(rendition as any)?.reportLocation?.()
              navigated = true
            }
          }
        }
      } catch (err) {
        console.warn('EPUB seek error:', err)
      } finally {
        if (reqId === seekRequestIdRef.current) {
          isScrubbingRef.current = false
          const loc = safeGetRenditionLocation(rendition)
          if (loc?.start) {
            const { page, pct, total } = computeProgressMetrics(epub, loc)
            setTotalPages(total)
            setCurrentPage(page)
            setProgressPercent(pct)
            if (loc.start.cfi) setCurrentCfi(loc.start.cfi)
            if (loc.end?.cfi) setCurrentEndCfi(loc.end.cfi)
            if (book.id) {
              const isFinished = pct >= 99.5 || Boolean(loc.atEnd)
              db.books.update(book.id, {
                progressCfi: loc.start.cfi,
                progressPercent: isFinished ? 100 : Math.round(pct),
                currentPage: page,
                totalPages: total,
                lastOpenedAt: Date.now(),
                ...(isFinished ? { isRead: true } : {})
              })
            }
          }
        }
      }
    },
    [book.id, computeProgressMetrics, hasReadyLocations]
  )

  handleJumpEndRef.current = () => {
    handleSeek(100)
  }

  const handleJumpToPage = useCallback(
    async (targetPage: number) => {
      const rendition = renditionRef.current
      const epub = epubBookRef.current
      if (!rendition || !epub) return
      const safeTotal = Math.max(1, totalPagesRef.current || 1)
      const pageClamped = Math.max(1, Math.min(safeTotal, targetPage))
      setCurrentPage(pageClamped)
      const pct = safeTotal > 1 ? ((pageClamped - 1) / (safeTotal - 1)) * 100 : 0
      setProgressPercent(pct)

      if (hasReadyLocations(epub)) {
        try {
          const rawCfi =
            (epub.locations as any).cfiFromLocation?.(pageClamped - 1) ||
            (epub.locations as any).cfiFromPercentage?.(pct / 100)
          if (typeof rawCfi === 'string' && rawCfi.startsWith('epubcfi(')) {
            await rendition.display(rawCfi)
            return
          }
        } catch (err) {
          console.warn('Page jump cfi error:', err)
        }
      }
      await handleSeek(pct)
    },
    [handleSeek, hasReadyLocations]
  )

  // Keyboard Navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTargetInput(e.target)) {
        if (e.key === 'Escape') {
          ;(e.target as HTMLElement)?.blur?.()
        }
        return
      }

      const isBackKey =
        (e.altKey && !e.ctrlKey && !e.metaKey && e.key === 'ArrowLeft') ||
        (!e.ctrlKey && !e.altKey && !e.metaKey && e.key === 'Backspace')
      if (isBackKey) {
        e.preventDefault()
        e.stopPropagation()
        const st = useAppStore.getState()
        if (st.isSearchDrawerOpen || st.isTOCDrawerOpen || st.isBookmarksDrawerOpen || st.isNotesDrawerOpen || st.isSettingsDrawerOpen) {
          st.toggleSearchDrawer(false)
          st.toggleTOCDrawer(false)
          st.toggleBookmarksDrawer(false)
          st.toggleNotesDrawer(false)
          st.toggleSettingsDrawer(false)
        } else {
          navigateStepRef.current('prev')
        }
        return
      }
      const isForwardKey =
        e.altKey && !e.ctrlKey && !e.metaKey && e.key === 'ArrowRight'
      if (isForwardKey) {
        e.preventDefault()
        e.stopPropagation()
        navigateStepRef.current('next')
        return
      }

      // Allow Ctrl+F / Cmd+F even when focus is inside an input so it always opens & selects Find
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        openSearchDrawerRef.current()
        return
      }

      if (isTargetInput(e.target)) {
        if (e.key === 'Escape') {
          ;(e.target as HTMLElement)?.blur?.()
        }
        return
      }

      if (e.ctrlKey || e.metaKey) {
        const k = e.key.toLowerCase()
        if (k === 'z') {
          e.preventDefault()
          e.stopPropagation()
          if (e.shiftKey) {
            handleRedoRef.current()
          } else {
            handleUndoRef.current()
          }
          return
        }
        if (k === 'y') {
          e.preventDefault()
          e.stopPropagation()
          handleRedoRef.current()
          return
        }
        if (k === 'b' || k === 'd') {
          e.preventDefault()
          e.stopPropagation()
          toggleCurrentBookmarkRef.current()
          return
        }
        if (k === '/' || e.key === '?') {
          e.preventDefault()
          e.stopPropagation()
          useAppStore.getState().toggleHelpModal()
          return
        }
        if (k === '=' || k === '+' || e.code === 'Equal' || e.code === 'NumpadAdd') {
          e.preventDefault()
          e.stopPropagation()
          const cur = useAppStore.getState().settings.fontSize
          useAppStore.getState().updateSettings({ fontSize: Math.min(42, cur + 2) })
          return
        }
        if (k === '-' || k === '_' || e.code === 'Minus' || e.code === 'NumpadSubtract') {
          e.preventDefault()
          e.stopPropagation()
          const cur = useAppStore.getState().settings.fontSize
          useAppStore.getState().updateSettings({ fontSize: Math.max(12, cur - 2) })
          return
        }
        if (k === '0' || e.code === 'Digit0' || e.code === 'Numpad0') {
          e.preventDefault()
          e.stopPropagation()
          useAppStore.getState().updateSettings({ fontSize: 21 })
          return
        }
        if (k === 'r') {
          e.preventDefault()
          e.stopPropagation()
          const curSettings = useAppStore.getState().settings
          const curDual = (curSettings.pageLayout ?? (curSettings.pageSpread === 'single' ? 'single' : 'dual')) === 'dual'
          useAppStore.getState().updateSettings({
            pageLayout: curDual ? 'single' : 'dual',
            pageSpread: curDual ? 'single' : 'double'
          })
          return
        }
        if (k === 'w') {
          e.preventDefault()
          e.stopPropagation()
          return
        }
        return
      }

      if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey && (e.key === ' ' || e.code === 'Space')) {
        e.preventDefault()
        e.stopPropagation()
        if (useAppStore.getState().isAutoscrollActive) {
          adaptiveScrollEngine.setUserPaused(!adaptiveScrollEngine.isPausedState())
        } else {
          handleNext()
        }
        return
      } else if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        setAutoscrollActive(!useAppStore.getState().isAutoscrollActive)
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === 'j') {
        e.preventDefault()
        handleNext()
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft' || e.key === 'PageUp' || e.key === 'Backspace' || e.key === 'k') {
        e.preventDefault()
        handlePrev()
      } else if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === '[') {
        e.preventDefault()
        if (useAppStore.getState().isAutoscrollActive) {
          const updated = adaptiveScrollEngine.nudgeDwellSec(-2)
          useAppStore.getState().showToast(`Auto-Flip: ${updated}s`, 'info')
        } else {
          handleChapterStepRef.current('prev')
        }
      } else if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === ']') {
        e.preventDefault()
        if (useAppStore.getState().isAutoscrollActive) {
          const updated = adaptiveScrollEngine.nudgeDwellSec(2)
          useAppStore.getState().showToast(`Auto-Flip: ${updated}s`, 'info')
        } else {
          handleChapterStepRef.current('next')
        }
      } else if (!e.ctrlKey && !e.metaKey && !e.altKey && (e.key === '+' || e.key === '=')) {
        e.preventDefault()
        if (useAppStore.getState().isAutoscrollActive) {
          const updated = adaptiveScrollEngine.nudgeDwellSec(2)
          useAppStore.getState().showToast(`Auto-Flip: ${updated}s`, 'info')
        } else {
          const cur = useAppStore.getState().settings.fontSize
          useAppStore.getState().updateSettings({ fontSize: Math.min(42, cur + 2) })
        }
      } else if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === '-') {
        e.preventDefault()
        if (useAppStore.getState().isAutoscrollActive) {
          const updated = adaptiveScrollEngine.nudgeDwellSec(-2)
          useAppStore.getState().showToast(`Auto-Flip: ${updated}s`, 'info')
        } else {
          const cur = useAppStore.getState().settings.fontSize
          useAppStore.getState().updateSettings({ fontSize: Math.max(12, cur - 2) })
        }
      } else if (e.key === 'Home') {
        e.preventDefault()
        renditionRef.current?.display(0)
      } else if (e.key === 'End') {
        e.preventDefault()
        handleJumpEndRef.current()
      } else if (e.key === 'F7') {
        e.preventDefault()
        handleToggleTTSRef.current()
      } else if (e.key === 'F8') {
        e.preventDefault()
        handleStopTTSRef.current()
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
        const curSettings = useAppStore.getState().settings
        const curDual = (curSettings.pageLayout ?? (curSettings.pageSpread === 'single' ? 'single' : 'dual')) === 'dual'
        updateSettings({
          pageLayout: curDual ? 'single' : 'dual',
          pageSpread: curDual ? 'single' : 'double'
        })
      } else if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault()
        useAppStore.getState().toggleHelpModal()
      } else if (e.key === '0') {
        e.preventDefault()
        useAppStore.getState().updateSettings({ fontSize: 21 })
      } else if (e.key.toLowerCase() === 'r' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        const curSettings = useAppStore.getState().settings
        const curDual = (curSettings.pageLayout ?? (curSettings.pageSpread === 'single' ? 'single' : 'dual')) === 'dual'
        useAppStore.getState().updateSettings({
          pageLayout: curDual ? 'single' : 'dual',
          pageSpread: curDual ? 'single' : 'double'
        })
      } else if (e.key === 'Escape') {
        e.preventDefault()
        if (contextMenu) {
          setContextMenu(null)
          return
        }
        if (activeAnnotation) {
          setActiveAnnotation(null)
          return
        }
        if (selectedText) {
          setSelectedText(null)
          setOpenNoteModalDirect(false)
          return
        }
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
          return
        }
        if (activeFootnote) {
          setActiveFootnote(null)
          return
        }
        if (isAutoscrollActive) {
          setAutoscrollActive(false)
          return
        }
        if (useAppStore.getState().isTTSActive) {
          handleStopTTSRef.current()
          return
        }
        if (useAppStore.getState().isImmersiveFullscreen || Boolean(document.fullscreenElement)) {
          useAppStore.getState().setImmersiveFullscreen(false)
          window.desktopAPI?.setFullscreen?.(false)
          if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {})
          }
          return
        }
        onBack()
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
    activeAnnotation,
    selectedText,
    activeFootnote,
    isAutoscrollActive,
    setAutoscrollActive,
    setActiveFootnote,
    onBack
  ])

  const handleSelectChapter = useCallback(async (href: string, item?: TocItem) => {
    const rendition = renditionRef.current as any
    const epub = epubBookRef.current as any
    if (!rendition || !epub) return

    const jumpNonce = ++chapterJumpNonceRef.current
    const resolved = resolveTocHrefToSpine(epub, item?.href || href)
    const spineItems: any[] = epub?.spine?.spineItems || []
    const spineItem =
      resolved.spineItem ||
      (typeof item?.spineIndex === 'number' && item.spineIndex >= 0 ? spineItems[item.spineIndex] : null)
    const hash = resolved.hash || item?.hash || ''
    const targetIdx = typeof spineItem?.index === 'number' ? spineItem.index : -1

    // Build ordered display candidates: hash-qualified spine href -> plain spine href -> spine index -> raw href
    const displayCandidates: Array<string | number> = []
    if (spineItem?.href) {
      if (hash) displayCandidates.push(`${spineItem.href}#${hash}`)
      displayCandidates.push(spineItem.href)
    }
    if (targetIdx >= 0) {
      displayCandidates.push(targetIdx)
    }
    if (resolved.displayTarget && !displayCandidates.includes(resolved.displayTarget)) {
      displayCandidates.push(resolved.displayTarget)
    }
    if (href && !displayCandidates.includes(href)) {
      displayCandidates.push(href)
    }

    let displayed = false
    for (const target of displayCandidates) {
      try {
        await rendition.display(target)
        displayed = true
        break
      } catch {
        // Try next resolved candidate
      }
    }

    if (!displayed || jumpNonce !== chapterJumpNonceRef.current) return

    // Locate the rendered view for the target spine section
    const findTargetView = () => {
      const viewsApi = rendition.manager?.views
      const allViews: any[] = viewsApi?.all?.() || viewsApi?._views || []
      if (targetIdx >= 0) {
        const byIndex = allViews.find(
          (v: any) => v?.index === targetIdx || v?.section?.index === targetIdx
        )
        if (byIndex) return byIndex
      }
      if (spineItem && typeof viewsApi?.find === 'function') {
        const found = viewsApi.find(spineItem)
        if (found) return found
      }
      return allViews[allViews.length - 1] || null
    }

    const alignViewportToChapterStart = async () => {
      if (jumpNonce !== chapterJumpNonceRef.current) return
      const manager = rendition.manager
      const container = manager?.container as HTMLElement | undefined
      const targetView = findTargetView()
      if (!container || !targetView) return

      const doc = (targetView.document || targetView.contents?.document) as Document | undefined
      const anchorEl = hash ? findAnchorElement(doc, hash) : null

      if (anchorEl) {
        try {
          const anchorCfi = targetView.contents?.cfiFromNode?.(anchorEl)
          if (typeof anchorCfi === 'string' && anchorCfi.startsWith('epubcfi(')) {
            await rendition.display(anchorCfi)
          } else if (typeof targetView.locationOf === 'function' && typeof manager.moveTo === 'function') {
            const offset = targetView.locationOf(`#${hash}`)
            if (offset) manager.moveTo(offset, targetView.width?.() || 0)
          }
        } catch {
          // Keep section-start display
        }
      } else if (typeof targetView.element?.offsetLeft === 'number') {
        manager.ignore = true
        container.scrollLeft = targetView.element.offsetLeft
        manager.scrollLeft = container.scrollLeft
      }
      rendition.reportLocation?.()
    }

    await alignViewportToChapterStart()

    if (item) {
      setActiveTocId(item.id)
      const label = item.label.trim()
      if (label) {
        setCurrentChapter(label)
        setCurrentChapterTitle(label)
      }
      if (spineItem?.href) {
        setCurrentHref(spineItem.href)
      }
    }
  }, [setCurrentChapterTitle])

  handleChapterStepRef.current = (dir: 'prev' | 'next') => {
    const list = tocRef.current
    if (!list || list.length === 0) return
    const curIdx = list.findIndex(
      (item) => item.id === activeTocId || item.href === currentHrefRef.current
    )
    const targetIdx =
      dir === 'next'
        ? Math.min(list.length - 1, curIdx >= 0 ? curIdx + 1 : 0)
        : Math.max(0, curIdx >= 0 ? curIdx - 1 : 0)
    if (targetIdx >= 0 && targetIdx < list.length) {
      handleSelectChapter(list[targetIdx].href, list[targetIdx])
    }
  }

  const handleJumpToCfi = async (cfi: string, pageNumber?: number) => {
    if (cfi && renditionRef.current) {
      try {
        await renditionRef.current.display(cfi)
        return
      } catch {
        // Fall through to location fallback if CFI fails
      }
    }
    if (pageNumber && hasReadyLocations(epubBookRef.current)) {
      try {
        const locIdx = Math.max(0, pageNumber - 1)
        const fallbackCfi = (epubBookRef.current!.locations as any).cfiFromLocation(locIdx)
        if (typeof fallbackCfi === 'string' && fallbackCfi.startsWith('epubcfi(')) {
          await renditionRef.current?.display(fallbackCfi)
        }
      } catch {
        // Ignore fallback failure
      }
    }
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

  const handleSearchBook = useCallback(async (query: string, signal?: AbortSignal): Promise<SearchMatch[]> => {
    const epub = epubBookRef.current as any
    if (!epub || !query.trim() || signal?.aborted) return []

    const spineItems: any[] = epub.spine?.spineItems || []
    const allMatches: SearchMatch[] = []
    const MAX_RESULTS = 250

    for (let i = 0; i < spineItems.length; i++) {
      if (signal?.aborted || allMatches.length >= MAX_RESULTS) break
      const section = spineItems[i]
      if (!section || typeof section.load !== 'function' || typeof section.find !== 'function') continue

      const wasLoaded = Boolean(section.contents)
      try {
        await section.load(epub.load.bind(epub))
        if (signal?.aborted) break
        const found: Array<{ cfi: string; excerpt: string }> = section.find(query) || []
        if (found.length > 0) {
          const href: string = section.href || ''
          const matchingToc = tocRef.current.find(
            (t) => t.href && href && (href.includes(t.href.split('#')[0]) || t.href.includes(href))
          )
          const chapterLabel = matchingToc?.label?.trim() || `Section ${i + 1}`

          for (const hit of found) {
            if (signal?.aborted || allMatches.length >= MAX_RESULTS) break
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

    return signal?.aborted ? [] : allMatches
  }, [])

  // Clear browser text selection inside the active EPUB iframe (Icecream window.getSelection().empty())
  const clearIframeSelection = () => {
    try {
      selectionContentsRef.current?.window?.getSelection?.()?.removeAllRanges?.()
      const contents = (renditionRef.current?.getContents() as any)?.[0]
      contents?.window?.getSelection?.()?.removeAllRanges?.()
    } catch {
      // Ignore cross-frame selection cleanup errors
    }
  }

  // Open interactive highlight popover when clicking any existing highlight mark on the page
  openAnnotationPopoverRef.current = async (ann: Annotation, e: MouseEvent) => {
    const fresh = ann.id ? (await db.annotations.get(ann.id)) || ann : ann
    const targetRect = (e.target as Element | null)?.getBoundingClientRect?.()
    const x = e.clientX || (targetRect ? targetRect.left + targetRect.width / 2 : window.innerWidth / 2)
    const y = e.clientY || (targetRect ? targetRect.top : window.innerHeight / 2)
    setSelectedText(null)
    setContextMenu(null)
    setActiveAnnotation({ annotation: fresh, position: { x, y } })
  }

  const handleDeleteAnnotation = async (ann: Annotation) => {
    if (!book.id || !ann.id) return
    readerHistoryService.pushAction({ type: 'delete_annotation', annotation: ann })
    await db.annotations.delete(ann.id)
    removeAnnotationFromRendition(renditionRef.current, ann.cfiRange)
    if (activeAnnotation?.annotation.id === ann.id) {
      setActiveAnnotation(null)
    }
    await syncBookNotesCount(book.id)
    bumpAnnotationsVersion()
  }

  const handleUpdateAnnotation = async (id: number, updates: { color?: NoteColor; note?: string }) => {
    if (!book.id) return
    const existing = await db.annotations.get(id)
    if (!existing) return
    const updated: Annotation = {
      ...existing,
      ...(updates.color !== undefined ? { color: updates.color } : {}),
      ...(updates.note !== undefined ? { note: updates.note } : {}),
      updatedAt: Date.now()
    }
    await db.annotations.update(id, {
      color: updated.color,
      note: updated.note,
      updatedAt: updated.updatedAt
    })
    if (updates.color) {
      setLastNoteColor(updates.color)
    }
    applyAnnotationToRendition(
      renditionRef.current,
      updated,
      themeRef.current,
      (a, ev) => openAnnotationPopoverRef.current(a, ev)
    )
    if (activeAnnotation?.annotation.id === id) {
      setActiveAnnotation((prev) => (prev ? { ...prev, annotation: updated } : null))
    }
    bumpAnnotationsVersion()
  }

  const handleClearAllAnnotations = async () => {
    if (!book.id) return
    const existing = await db.annotations.where('bookId').equals(book.id).toArray()
    for (const ann of existing) {
      removeAnnotationFromRendition(renditionRef.current, ann.cfiRange)
    }
    await db.annotations.where('bookId').equals(book.id).delete()
    setActiveAnnotation(null)
    await syncBookNotesCount(book.id)
    bumpAnnotationsVersion()
  }

  const handleAddAnnotation = async (
    color: NoteColor,
    textOverride?: string,
    cfiOverride?: string
  ) => {
    const textToSave = textOverride || selectedText
    const cfiToSave = cfiOverride || selectedCfiRange
    if (!book.id || !textToSave) return

    // If an annotation already exists on the exact same CFI, update its color instead of duplicating
    if (cfiToSave) {
      const duplicate = await db.annotations
        .where('bookId')
        .equals(book.id)
        .filter((a) => a.cfiRange === cfiToSave)
        .first()
      if (duplicate?.id) {
        await handleUpdateAnnotation(duplicate.id, { color })
        clearIframeSelection()
        setSelectedText(null)
        setOpenNoteModalDirect(false)
        return
      }
    }

    const record: Annotation = {
      bookId: book.id,
      cfiRange: cfiToSave,
      text: textToSave,
      note: '',
      color,
      pageNumber: currentPageRef.current,
      chapterTitle: currentChapterRef.current || undefined,
      href: currentHrefRef.current || undefined,
      iceRange: selectedIceRangeRef.current,
      createdAt: Date.now()
    }
    const newId = await db.annotations.add(record)
    const saved: Annotation = { ...record, id: Number(newId) }
    readerHistoryService.pushAction({ type: 'add_annotation', annotation: saved })

    setLastNoteColor(color)
    applyAnnotationToRendition(
      renditionRef.current,
      saved,
      themeRef.current,
      (a, ev) => openAnnotationPopoverRef.current(a, ev)
    )
    clearIframeSelection()
    setSelectedText(null)
    setOpenNoteModalDirect(false)
    await syncBookNotesCount(book.id)
    bumpAnnotationsVersion()
  }

  const handleAddNote = async (
    note: string,
    color: NoteColor = lastNoteColor,
    textOverride?: string,
    cfiOverride?: string
  ) => {
    const textToSave = textOverride || selectedText
    const cfiToSave = cfiOverride || selectedCfiRange
    if (!book.id || !textToSave) return

    // Update existing highlight on same CFI if present
    if (cfiToSave) {
      const duplicate = await db.annotations
        .where('bookId')
        .equals(book.id)
        .filter((a) => a.cfiRange === cfiToSave)
        .first()
      if (duplicate?.id) {
        await handleUpdateAnnotation(duplicate.id, { note, color })
        clearIframeSelection()
        setSelectedText(null)
        setOpenNoteModalDirect(false)
        return
      }
    }

    const record: Annotation = {
      bookId: book.id,
      cfiRange: cfiToSave,
      text: textToSave,
      note,
      color,
      pageNumber: currentPageRef.current,
      chapterTitle: currentChapterRef.current || undefined,
      href: currentHrefRef.current || undefined,
      iceRange: selectedIceRangeRef.current,
      createdAt: Date.now()
    }
    const newId = await db.annotations.add(record)
    const saved: Annotation = { ...record, id: Number(newId) }
    readerHistoryService.pushAction({ type: 'add_annotation', annotation: saved })

    setLastNoteColor(color)
    applyAnnotationToRendition(
      renditionRef.current,
      saved,
      themeRef.current,
      (a, ev) => openAnnotationPopoverRef.current(a, ev)
    )
    clearIframeSelection()
    setSelectedText(null)
    setOpenNoteModalDirect(false)
    await syncBookNotesCount(book.id)
    bumpAnnotationsVersion()
  }

  // Bookmarks CRUD & Smart Toggle (Icecream getBookmarkData + duplicate guard)
  const currentPageBookmark = bookBookmarks.find(
    (bm) =>
      bm.pageNumber === currentPage ||
      (currentCfi && bm.cfi && bm.cfi === currentCfi)
  )
  const isCurrentPageBookmarked = Boolean(currentPageBookmark)

  const handleToggleCurrentBookmark = async () => {
    if (!book.id) return
    const existing = await db.bookmarks
      .where('bookId')
      .equals(book.id)
      .filter(
        (bm) =>
          bm.pageNumber === currentPageRef.current ||
          Boolean(currentCfiRef.current && bm.cfi === currentCfiRef.current)
      )
      .first()

    if (existing?.id) {
      readerHistoryService.pushAction({ type: 'delete_bookmark', bookmark: existing })
      await db.bookmarks.delete(existing.id)
      bumpBookmarksVersion()
      return
    }

    const { excerpt, xpath } = extractVisiblePageData(
      renditionRef.current,
      epubBookRef.current,
      currentCfiRef.current,
      currentEndCfiRef.current
    )

    const newBookmark: BookmarkItem = {
      bookId: book.id,
      cfi: currentCfiRef.current,
      label: currentChapterRef.current
        ? `${currentChapterRef.current} (p.${currentPageRef.current})`
        : `Page ${currentPageRef.current}`,
      excerpt: excerpt || undefined,
      chapterTitle: currentChapterRef.current || undefined,
      href: currentHrefRef.current || undefined,
      xpath: xpath || undefined,
      pageNumber: currentPageRef.current,
      progressPercent: progressPercentRef.current,
      createdAt: Date.now()
    }
    const newId = await db.bookmarks.add(newBookmark)
    readerHistoryService.pushAction({ type: 'add_bookmark', bookmark: { ...newBookmark, id: Number(newId) } })
    bumpBookmarksVersion()
  }
  toggleCurrentBookmarkRef.current = handleToggleCurrentBookmark

  const handleDeleteBookmark = async (id: number) => {
    const existing = await db.bookmarks.get(id)
    if (existing) {
      readerHistoryService.pushAction({ type: 'delete_bookmark', bookmark: existing })
    }
    await db.bookmarks.delete(id)
    bumpBookmarksVersion()
  }

  const handleUndo = useCallback(async () => {
    const success = await readerHistoryService.undo(
      renditionRef.current,
      themeRef.current,
      (a, ev) => openAnnotationPopoverRef.current(a, ev)
    )
    if (success) {
      bumpAnnotationsVersion()
      bumpBookmarksVersion()
    }
  }, [bumpAnnotationsVersion, bumpBookmarksVersion])

  const handleRedo = useCallback(async () => {
    const success = await readerHistoryService.redo(
      renditionRef.current,
      themeRef.current,
      (a, ev) => openAnnotationPopoverRef.current(a, ev)
    )
    if (success) {
      bumpAnnotationsVersion()
      bumpBookmarksVersion()
    }
  }, [bumpAnnotationsVersion, bumpBookmarksVersion])

  handleUndoRef.current = handleUndo
  handleRedoRef.current = handleRedo

  const handleRenameBookmark = async (id: number, label: string) => {
    await db.bookmarks.update(id, { label })
    bumpBookmarksVersion()
  }

  const handleClearAllBookmarks = async () => {
    if (!book.id) return
    await db.bookmarks.where('bookId').equals(book.id).delete()
    bumpBookmarksVersion()
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
            { color: 'yellow', hex: '#f3e3a2', title: 'Yellow Highlight', onClick: () => handleAddAnnotation('yellow', text, targetCfi) },
            { color: 'blue', hex: '#aed9f1', title: 'Blue Highlight', onClick: () => handleAddAnnotation('blue', text, targetCfi) },
            { color: 'green', hex: '#b1f3a4', title: 'Green Highlight', onClick: () => handleAddAnnotation('green', text, targetCfi) },
            { color: 'purple', hex: '#ccb8e4', title: 'Purple Highlight', onClick: () => handleAddAnnotation('purple', text, targetCfi) },
            { color: 'red', hex: '#f3a2a2', title: 'Red Highlight', onClick: () => handleAddAnnotation('red', text, targetCfi) }
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
            setOpenNoteModalDirect(true)
          }
        },
        { id: 'div-sel', divider: true },
        {
          id: 'dict',
          label: 'Define in Dictionary',
          icon: <BookOpen className="w-3.5 h-3.5 text-[#a78bfa]" />,
          onClick: () =>
            window.open(
              `https://www.merriam-webster.com/dictionary/${encodeURIComponent(text)}`,
              '_blank',
              'noopener,noreferrer'
            )
        },
        {
          id: 'translate',
          label: 'Translate Selection',
          icon: <Languages className="w-3.5 h-3.5 text-[#4cd964]" />,
          onClick: () =>
            window.open(
              `https://translate.google.com/?sl=auto&tl=en&text=${encodeURIComponent(text)}`,
              '_blank',
              'noopener,noreferrer'
            )
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
          label: isCurrentPageBookmarked ? `Remove Bookmark (p.${currentPage})` : `Bookmark Page ${currentPage}`,
          shortcut: 'Ctrl+B',
          icon: <Bookmark className={`w-3.5 h-3.5 text-[#2a69df] ${isCurrentPageBookmarked ? 'fill-current' : ''}`} />,
          onClick: () => handleToggleCurrentBookmark()
        },
        {
          id: 'autoscroll',
          label: isAutoscrollActive ? 'Stop Auto-Flip' : 'Start Auto-Flip',
          icon: <Zap className="w-3.5 h-3.5 text-[#f59e0b]" />,
          onClick: () => setAutoscrollActive(!isAutoscrollActive)
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
        },
        ...(book.format === 'pdf' && pdfViewMode === 'reflow'
          ? [
              { id: 'div-pdf-back', divider: true },
              {
                id: 'back-original-pdf',
                label: 'Switch Back to Original PDF',
                icon: <FileText className="w-3.5 h-3.5 text-[#2a69df]" />,
                onClick: () => setPdfViewMode('original')
              }
            ]
          : [])
      ]
      setContextMenu({ x: clickX, y: clickY, items })
    }
  }

  // Floating overlay state for all drawers (TOC, Notes, Bookmarks, Search, Settings)
  // All panels float smoothly above the book canvas with backdrops without contracting or reflowing the reading canvas
  const isAnyDrawerOpen =
    isSettingsDrawerOpen || isNotesDrawerOpen || isBookmarksDrawerOpen || isSearchDrawerOpen || isTOCDrawerOpen
  const isDual = (settings.pageLayout ?? (settings.pageSpread === 'single' ? 'single' : 'dual')) === 'dual'

  // Synchronous CFI-preserving resize helper for fullscreen toggles & layout shifts
  const safeResizeRendition = useCallback((targetCfi?: string) => {
    const rendition = renditionRef.current as any
    if (!rendition) return
    const cfi =
      targetCfi ||
      currentCfiRef.current ||
      safeGetRenditionLocation(rendition)?.start?.cfi ||
      rendition.location?.start?.cfi
    if (rendition.location && cfi) {
      rendition.location.start = { ...(rendition.location.start || {}), cfi }
    }
    try {
      rendition.resize(undefined, undefined, cfi)
    } catch {
      // Ignore resize race during unmount
    }
  }, [])

  // Trigger epub.js layout reflow only when immersive fullscreen actually toggles (never on initial mount,
  // where an early resize() clears the active view and can snap scrollLeft back to page 1)
  useEffect(() => {
    if (!hasMountedFullscreenRef.current) {
      hasMountedFullscreenRef.current = true
      return
    }
    const t = setTimeout(() => {
      safeResizeRendition()
    }, 120)
    return () => clearTimeout(t)
  }, [isImmersiveFullscreen, safeResizeRendition])

  const handleExitFullscreen = () => {
    setImmersiveFullscreen(false)
    if (window.desktopAPI?.setFullscreen) {
      window.desktopAPI.setFullscreen(false)
    } else if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {})
    }
  }

  // Zero-CPU 10s idle cursor suppression (distraction-free reading, suspended when menus/drawers/selections are active)
  const isAnyModalOrPopoverOpen =
    isAnyDrawerOpen ||
    Boolean(selectedText) ||
    Boolean(activeAnnotation) ||
    Boolean(contextMenu)

  const isCursorIdle = useIdleCursor({
    timeoutMs: 10000,
    disabled: isAnyModalOrPopoverOpen
  })

  // Synchronize cursor concealment to active EPUB iframe bodies
  useEffect(() => {
    try {
      const contents = renditionRef.current?.getContents() as any
      const list = Array.isArray(contents) ? contents : contents ? [contents] : []
      list.forEach((c: any) => {
        c.document?.body?.classList.toggle('cursor-idle-hidden', isCursorIdle)
      })
    } catch {
      // Ignore detached iframes
    }
  }, [isCursorIdle])

  return (
    <div
      style={{ backgroundColor: currentTheme.bg }}
      className={`flex-1 flex flex-col h-full relative overflow-hidden select-none transition-colors duration-200 ${
        isCursorIdle ? 'cursor-idle-hidden' : ''
      }`}
    >
      {/* Top Docked Header (hidden completely in immersive fullscreen) */}
      {!isImmersiveFullscreen && (
        <ReaderTopBar
          onBack={onBack}
          currentChapter={currentChapter}
          isCurrentPageBookmarked={isCurrentPageBookmarked}
        />
      )}

      {/* Floating Exit Fullscreen Control (only visible in immersive fullscreen) */}
      {isImmersiveFullscreen && (
        <button
          type="button"
          onClick={handleExitFullscreen}
          className="fixed top-3 right-3 z-50 w-8 h-8 flex items-center justify-center rounded-md bg-[#14161c]/80 hover:bg-[#1f232d] border border-[#2d323f] text-[#c8d1dc] hover:text-white shadow-lg opacity-40 hover:opacity-100 transition-all duration-150 app-no-drag cursor-pointer"
          title="Exit Fullscreen (Esc / F11)"
          aria-label="Exit Fullscreen"
        >
          <Minimize2 className="w-4 h-4" />
        </button>
      )}

      {/* Main Reading Viewport */}
      <SideNavigation
        onPrev={handlePrev}
        onNext={handleNext}
        isLeftDisabled={currentPage <= 1 && progressPercent <= 0}
        isRightDisabled={progressPercent >= 100 && totalPages > 1 && currentPage >= totalPages}
        hidden={isImmersiveFullscreen || isAnyDrawerOpen}
      />
      <div
        onContextMenu={(e) => {
          e.preventDefault()
          openContextMenuRef.current(e.clientX, e.clientY)
        }}
        className={`flex-1 relative flex items-center justify-center overflow-hidden ${
          isImmersiveFullscreen ? 'py-6 px-4' : ''
        }`}
      >
        {/* Icecream-style On-Page Top-Right Bookmark Ribbon Toggle & Bare Page Indicator */}
        {!isImmersiveFullscreen && (
          <div className="absolute top-2 right-5 z-30 flex items-center gap-2 app-no-drag">
            <span
              className="text-[12px] font-mono font-medium tracking-wide text-[#8b949e] opacity-40 select-none pointer-events-none"
              title={`Page ${currentPage}`}
            >
              {currentPage}
            </span>
            <button
              type="button"
              onClick={handleToggleCurrentBookmark}
              className={`w-7 h-8 flex items-center justify-center rounded-[2px] transition-all duration-200 cursor-pointer ${
                isCurrentPageBookmarked
                  ? 'text-[#2a69df] opacity-100 hover:scale-110 active:scale-95'
                  : 'text-[#8b949e] opacity-25 hover:opacity-85 hover:text-white active:scale-95'
              }`}
              title={
                isCurrentPageBookmarked
                  ? `Remove bookmark on page ${currentPage} (Ctrl+B)`
                  : `Bookmark page ${currentPage} (Ctrl+B)`
              }
            >
              <Bookmark
                className={`w-5 h-5 transition-transform duration-200 ${
                  isCurrentPageBookmarked ? 'fill-current drop-shadow scale-105' : 'scale-100'
                }`}
              />
            </button>
          </div>
        )}

        {/* EPUB Mount Point (kept completely empty of React children so 3rd-party DOM cleanup never collides with React fiber reconciler) */}
        <div
          ref={viewerRef}
          tabIndex={-1}
          className="w-full h-full max-w-6xl mx-auto relative overflow-hidden outline-none"
        />

        {/* Center Gutter Divider for Dual Page Mode (Horizontal Paginated mode) */}
        {isDual && !isImmersiveFullscreen && (
          <div
            data-testid="dual-page-gutter-divider"
            aria-hidden="true"
            style={{
              backgroundColor: currentTheme.border,
              boxShadow: '-1px 0 6px rgba(0,0,0,0.3), 1px 0 6px rgba(0,0,0,0.3)'
            }}
            className="absolute left-1/2 top-4 bottom-4 w-px -translate-x-1/2 pointer-events-none opacity-40 z-20"
          />
        )}
      </div>

      {/* Feature 1: Minimalist Bottom-Right Auto-Flip Countdown HUD (persists even in Fullscreen) */}
      <AdaptiveScrollOverlay
        isActive={isAutoscrollActive}
        onClose={() => setAutoscrollActive(false)}
      />

      {/* Draggable & Minimizable Reader Audio HUD for Read Aloud */}
      <ReaderAudioHUD
        isTTSActive={isTTSActive}
        isTTSMuted={isTTSMuted}
        currentChapter={currentChapter}
        ttsSpeed={settings.ttsSpeed}
        onTogglePlay={() => handleToggleTTSRef.current()}
        onStop={() => handleStopTTSRef.current()}
      />

      {/* Subtle Persistent Liquid Climax Progress Bar (hidden in immersive fullscreen or when toggled off in settings) */}
      {!isImmersiveFullscreen && settings.showProgressBar !== false && (
        <FluidClimaxProgressBar
          progressPercent={progressPercent || 0}
          currentPage={currentPage}
          totalPages={totalPages}
          book={book}
          theme={settings.theme}
          isImmersiveFullscreen={isImmersiveFullscreen}
          climaxTarget={climaxTarget}
          isSaberGlowing={climaxEffect === 'bar-saber'}
          onSaberGlowEnd={stopClimaxEffect}
          onSeek={handleSeek}
          onPageChange={handleJumpToPage}
        />
      )}

      {/* Subtle Theme-Adaptive Fullscreen Climax Crimson Wave (3 sweeps, stops immediately on exit) */}
      <FullscreenClimaxWaveOverlay
        active={climaxEffect === 'fullscreen-wave'}
        isImmersiveFullscreen={isImmersiveFullscreen}
        theme={settings.theme}
        onComplete={stopClimaxEffect}
      />

      {/* Sliding Drawers */}
      <TOCDrawer
        toc={toc}
        currentHref={currentHref}
        activeTocId={activeTocId}
        onSelectChapter={handleSelectChapter}
      />
      <NotesDrawer
        onJumpToCfi={handleJumpToCfi}
        onDeleteAnnotation={handleDeleteAnnotation}
        onUpdateAnnotation={handleUpdateAnnotation}
        onClearAllAnnotations={handleClearAllAnnotations}
      />
      <BookmarksDrawer
        currentPage={currentPage}
        currentCfi={currentCfi}
        isCurrentPageBookmarked={isCurrentPageBookmarked}
        onToggleCurrentBookmark={handleToggleCurrentBookmark}
        onJumpToCfi={handleJumpToCfi}
        onDeleteBookmark={handleDeleteBookmark}
        onRenameBookmark={handleRenameBookmark}
        onClearAllBookmarks={handleClearAllBookmarks}
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

      {/* Interactive Clicked Highlight Popover */}
      {activeAnnotation && (
        <AnnotationPopover
          annotation={activeAnnotation.annotation}
          position={activeAnnotation.position}
          onClose={() => setActiveAnnotation(null)}
          onUpdate={handleUpdateAnnotation}
          onDelete={handleDeleteAnnotation}
        />
      )}

      {/* Inline Selection & Dictionary Popup */}
      {selectedText && (
        <SelectionPopup
          selectedText={selectedText}
          position={selectionPos}
          initialShowNoteInput={openNoteModalDirect}
          defaultColor={lastNoteColor}
          onClose={() => {
            setSelectedText(null)
            setOpenNoteModalDirect(false)
          }}
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

export const EpubReaderView = React.memo<EpubReaderViewProps>(
  EpubReaderViewBase,
  (prev, next) =>
    prev.book.id === next.book.id &&
    prev.book.filePath === next.book.filePath &&
    prev.book.format === next.book.format
)
