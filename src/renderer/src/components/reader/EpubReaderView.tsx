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
import { FluidClimaxProgressBar } from './FluidClimaxProgressBar'
import { ContextMenu, type ContextMenuItem } from '../ui/ContextMenu'
import { adaptiveScrollEngine } from '../../services/adaptiveScrollService'
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
    pdfViewMode,
    reflowEpubBuffer,
    setPdfViewMode,
    isTTSActive,
    setTTSActive,
    isAutoscrollActive,
    setAutoscrollActive,
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
    setImmersiveFullscreen,
    annotationsVersion,
    bookmarksVersion,
    lastNoteColor,
    bumpAnnotationsVersion,
    bumpBookmarksVersion,
    setLastNoteColor
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
  const [currentEndCfi, setCurrentEndCfi] = useState<string>('')
  const [currentPage, setCurrentPage] = useState<number>(book.currentPage || 1)
  const [totalPages, setTotalPages] = useState<number>(book.totalPages || 1)
  const [progressPercent, setProgressPercent] = useState<number>(book.progressPercent || 0)

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

  // Custom native desktop toast notification with optional Undo action
  const [readerToast, setReaderToast] = useState<{
    message: string
    actionLabel?: string
    onAction?: () => void
  } | null>(null)
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null)
  const showToast = useCallback(
    (message: string, actionLabel?: string, onAction?: () => void) => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
      setReaderToast({ message, actionLabel, onAction })
      toastTimerRef.current = setTimeout(() => {
        setReaderToast(null)
      }, 3600)
    },
    []
  )

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; items: ContextMenuItem[] } | null>(null)
  const openContextMenuRef = useRef<(x: number, y: number, text?: string, cfiRange?: string) => void>(() => {})

  // Scrubber & pagination synchronization refs
  const isScrubbingRef = useRef(false)
  const scrubDebounceTimerRef = useRef<NodeJS.Timeout | null>(null)
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

  // Theme palettes aligned with Vercel/Geist Obsidian + Paper surfaces
  const themeStyles = {
    day: { bg: '#ffffff', text: '#171717', link: '#0070f3', bottomBg: '#fafafa', border: 'rgba(0,0,0,0.08)' },
    night: { bg: '#0d0d0e', text: '#dcdcdc', link: '#66b2ff', bottomBg: '#0a0a0a', border: 'rgba(255,255,255,0.08)' },
    'light-sepia': { bg: '#f6ebd4', text: '#4a3a26', link: '#8b5a2b', bottomBg: '#efe2c6', border: 'rgba(95,75,50,0.16)' },
    'dark-sepia': { bg: '#221c16', text: '#d8cbb8', link: '#e6c8a5', bottomBg: '#1a1510', border: 'rgba(255,255,255,0.08)' }
  }

  const currentTheme = themeStyles[settings.theme] || themeStyles.night

  // Injects dynamic user typography rules (font family, font size, line height) into an iframe Document
  const applyDynamicStylesToDoc = useCallback((doc: Document | null | undefined) => {
    if (!doc || !doc.head) return
    let styleEl = doc.getElementById('semply-reader-dynamic-style') as HTMLStyleElement | null
    if (!styleEl) {
      styleEl = doc.createElement('style')
      styleEl.id = 'semply-reader-dynamic-style'
      doc.head.appendChild(styleEl)
    }

    const currentSettings = useAppStore.getState().settings
    const fontFam = getFontCssFamily(currentSettings.fontFamily)
    const fontRule =
      fontFam !== 'inherit'
        ? `body, body p, body div, body span, body li, body blockquote, body h1, body h2, body h3, body h4, body h5, body h6 { font-family: ${fontFam} !important; }`
        : ''

    styleEl.textContent = `
      html, body {
        font-size: ${currentSettings.fontSize}px !important;
      }
      body p, body div, body span, body li, body blockquote {
        font-size: ${currentSettings.fontSize}px !important;
        line-height: ${Math.round(currentSettings.lineHeight * 100)}% !important;
      }
      ${fontRule}
    `
  }, [])

  // Attach smart footnote click interception, custom downloaded font CSS, and cadence wheel listener to iframe
  const attachIframeHooks = useCallback((contents: any) => {
    const doc = contents.document
    if (!doc) return

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

    // Feature 1: Cadence Behavioral Correction & Responsive Wheel Page-Turn Listener (blocks Ctrl+Wheel zoom)
    let lastWheelTime = 0
    contents.window.addEventListener(
      'wheel',
      (e: WheelEvent) => {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault()
          return
        }
        adaptiveScrollEngine.recordUserActivity()
        const now = Date.now()
        if (now - lastWheelTime < 220) return
        lastWheelTime = now

        const state = useAppStore.getState()
        const mode =
          state.settings.autoscrollMode ??
          (state.settings.autoscrollAdaptive === false ? 'countdown' : 'adaptive')

        if (state.isAutoscrollActive && mode === 'adaptive') {
          if (e.deltaY < -25) {
            // Back-scroll detected: User scrolled up -> decrease WPM (-15%)
            adaptiveScrollEngine.onBackScrollDetected()
          } else if (e.deltaY > 25) {
            // Forward nudge detected: User scrolling forward -> increase WPM (+10%)
            adaptiveScrollEngine.onForwardNudgeDetected()
          }
          return
        }

        // Smooth manual mouse-wheel page turning when no panel is open
        if (
          state.isTOCDrawerOpen ||
          state.isNotesDrawerOpen ||
          state.isBookmarksDrawerOpen ||
          state.isSearchDrawerOpen ||
          state.isSettingsDrawerOpen
        ) {
          return
        }
        if (e.deltaY > 24) {
          renditionRef.current?.next()
        } else if (e.deltaY < -24) {
          renditionRef.current?.prev()
        }
      },
      { passive: false }
    )

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
      // Keep bare Control key and destructive/zoom Ctrl combos unresponsive
      if (e.key === 'Control' || e.key === 'F5') {
        e.preventDefault()
        return
      }
      if (e.ctrlKey || e.metaKey) {
        const k = e.key.toLowerCase()
        if (k === 'f') {
          e.preventDefault()
          e.stopPropagation()
          openSearchDrawerRef.current()
        } else if (k === 'b') {
          e.preventDefault()
          e.stopPropagation()
          toggleCurrentBookmarkRef.current()
        } else if (k === 'r' || k === 'w' || k === '0' || k === '=' || k === '+' || k === '-' || k === '_') {
          e.preventDefault()
          e.stopPropagation()
        }
        return
      }

      if (e.key === 'ArrowDown' || e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault()
        renditionRef.current?.next()
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft' || e.key === 'PageUp' || e.key === 'Backspace') {
        e.preventDefault()
        renditionRef.current?.prev()
      } else if (e.key === 'Home') {
        e.preventDefault()
        renditionRef.current?.display(0)
      } else if (e.key === 'Escape') {
        setContextMenu(null)
        setActiveAnnotation(null)
        setSelectedText(null)
        setOpenNoteModalDirect(false)
        const st = useAppStore.getState()
        if (st.isSearchDrawerOpen || st.isTOCDrawerOpen || st.isBookmarksDrawerOpen || st.isNotesDrawerOpen || st.isSettingsDrawerOpen) {
          st.toggleSearchDrawer(false)
          st.toggleTOCDrawer(false)
          st.toggleBookmarksDrawer(false)
          st.toggleNotesDrawer(false)
          st.toggleSettingsDrawer(false)
        } else if (st.isImmersiveFullscreen || Boolean(document.fullscreenElement)) {
          st.setImmersiveFullscreen(false)
          window.desktopAPI?.setFullscreen?.(false)
          if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {})
          }
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
  }, [setActiveFootnote])

  // Initialize ePub reader engine
  useEffect(() => {
    let isCancelled = false
    let epubInstance: EpubBook | null = null
    let renditionInstance: Rendition | null = null

    async function initReader() {
      if (!viewerRef.current) return
      viewerRef.current.innerHTML = ''

      let sourceData: any =
        book.format === 'pdf' && pdfViewMode === 'reflow' && reflowEpubBuffer
          ? reflowEpubBuffer
          : activeBookBuffer
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
        const fontFam = getFontCssFamily(useAppStore.getState().settings.fontFamily)

        const baseRules = {
          'html, body': {
            margin: '0 auto !important',
            padding: '24px 32px !important'
          },
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
          body: { background: '#0d0d0e !important', color: '#dcdcdc !important' },
          'p, div, span, li, blockquote': { color: '#dcdcdc !important' },
          'h1, h2, h3, h4, h5': { color: '#f5f5f5 !important' },
          a: { color: '#66b2ff !important' }
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
            const rawExact = currentPct * 100
            const calcPct = (numLoc > 1 && rawExact > 0)
              ? Math.min(100, Math.max(1, Math.round(rawExact)))
              : Math.min(100, Math.max(0, Math.round(rawExact)))
            setProgressPercent(calcPct)
          }
        }
      }).catch(() => {})

      // Display initial position
      const startLocation = book.progressCfi || undefined
      await renditionInstance.display(startLocation)

      // Hydrate all saved annotations/highlights onto the rendition immediately
      if (book.id && !isCancelled) {
        try {
          const saved = await db.annotations.where('bookId').equals(book.id).toArray()
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
        setCurrentEndCfi(location.end?.cfi || '')

        let page = 1
        let pct = 0

        // 1. If epub.js locations are generated, use accurate location & percentage from CFI
        const hasMovedPastStart = (location.start.index != null && location.start.index > 0) || (location.start.displayed?.page && location.start.displayed.page > 1)
        if (epubInstance?.locations?.length()) {
          const rawLoc = (epubInstance.locations as any).locationFromCfi(cfi)
          const numLoc = typeof rawLoc === 'number' ? rawLoc : Number(rawLoc)
          if (!isNaN(numLoc) && numLoc > 0) {
            page = numLoc
          }
          const rawPct = epubInstance.locations.percentageFromCfi(cfi)
          if (rawPct != null && !isNaN(rawPct)) {
            const rawExact = rawPct * 100
            pct = (page > 1 || hasMovedPastStart) && rawExact > 0
              ? Math.min(100, Math.max(1, Math.round(rawExact)))
              : Math.min(100, Math.max(0, Math.round(rawExact)))
          }
        } else if (location.start.location != null && Number(location.start.location) > 0) {
          page = Number(location.start.location)
          const rawExact = (location.start.percentage || 0) * 100
          pct = (page > 1 || hasMovedPastStart) && rawExact > 0
            ? Math.min(100, Math.max(1, Math.round(rawExact)))
            : Math.min(100, Math.max(0, Math.round(rawExact)))
        } else {
          // 2. Fallback: Proportional progress based on spine index and section pages
          const spineTotal = (epubInstance?.spine as any)?.length || (epubInstance?.spine as any)?.spineItems?.length || 1
          const spineIdx = location.start.index ?? 0
          const secPage = location.start.displayed?.page || 1
          const secTotal = Math.max(1, location.start.displayed?.total || 1)
          const progressRatio = (spineIdx + ((secPage - 1) / secTotal)) / Math.max(1, spineTotal)
          const rawExact = progressRatio * 100
          pct = (spineIdx > 0 || secPage > 1) && rawExact > 0
            ? Math.min(100, Math.max(1, Math.round(rawExact)))
            : Math.min(100, Math.max(0, Math.round(rawExact)))
          const bookTotal = (epubInstance?.locations as any)?.total || totalPagesRef.current || (book.totalPages || 507)
          page = Math.min(bookTotal, Math.max(1, Math.round(progressRatio * bookTotal)))
        }

        setProgressPercent(pct)
        setCurrentPage(page)

        if (location.start.href) {
          setCurrentHref(location.start.href)
          const cleanHref = location.start.href.split('#')[0]
          const matching = tocRef.current.find(
            (t) => t.href && (cleanHref.includes(t.href.split('#')[0]) || t.href.includes(cleanHref))
          )
          const chapterLabel = matching ? matching.label.trim() : ''
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
          const isFinished = pct >= 99 || Boolean(location.atEnd)
          db.books.update(book.id, {
            progressCfi: cfi,
            progressPercent: isFinished ? 100 : pct,
            currentPage: page,
            lastOpenedAt: Date.now(),
            ...(isFinished ? { isRead: true } : {})
          })
        }
      })

      // Selection listener for notes & highlights (accurate iframe-relative viewport coordinates)
      renditionInstance.on('selected', (cfiRange: string, contents: any) => {
        if (isCancelled) return
        const selection = contents.window.getSelection()
        const text = selection?.toString().trim()
        if (text && selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0)
          const rect = range.getBoundingClientRect()
          const frameEl = contents.window.frameElement as HTMLElement | null
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
    }

    initReader()

    return () => {
      isCancelled = true
      renditionInstance?.destroy()
    }
  }, [book, activeBookBuffer, pdfViewMode, reflowEpubBuffer, settings.pageSpread, attachIframeHooks])

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

  // Synchronize dynamic settings (theme, font size, line height, and downloaded/local font family)
  useEffect(() => {
    if (!renditionRef.current) return
    const fontFam = getFontCssFamily(settings.fontFamily)

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
    }

    applyFontAndTheme()
  }, [settings.theme, settings.fontSize, settings.lineHeight, settings.fontFamily, applyDynamicStylesToDoc])

  const handleNext = useCallback(() => renditionRef.current?.next(), [])
  const handlePrev = useCallback(() => renditionRef.current?.prev(), [])

  // Analyze only the currently visible page/spread for Adaptive Countdown word density & break markers
  const analyzeVisiblePage = useCallback((): {
    visibleWords: number
    hasBreak: boolean
    atEnd: boolean
  } => {
    const loc = renditionRef.current?.currentLocation() as any
    const spineItems = (epubBookRef.current?.spine as any)?.spineItems || []
    const spineLength = spineItems.length || (epubBookRef.current?.spine as any)?.length || 0
    const endIdx = loc?.end?.index ?? loc?.start?.index ?? 0
    // Only treat as true end-of-book when on the final spine section AND epub.js reports atEnd
    const atEnd = Boolean(loc?.atEnd && (spineLength <= 0 || endIdx >= spineLength - 1))
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
      if (blurTimer) clearTimeout(blurTimer)
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
    let recoveryTimer: ReturnType<typeof setTimeout> | null = null

    const armPage = () => {
      if (cancelled || !useAppStore.getState().isAutoscrollActive) return
      const { visibleWords, hasBreak, atEnd } = analyzeVisiblePage()
      if (atEnd) {
        adaptiveScrollEngine.stop()
        setAutoscrollActive(false)
        return
      }

      const cfiBeforeTurn = currentCfiRef.current
      adaptiveScrollEngine.startPageCountdown(visibleWords, hasBreak, () => {
        if (cancelled || !useAppStore.getState().isAutoscrollActive) return
        Promise.resolve(handleNext()).catch(() => {})

        // Recovery watchdog: if epub.js stalls on a section edge or emits the same CFI,
        // retry next() once and re-arm so Auto-Scroll never freezes at 0s.
        if (recoveryTimer) clearTimeout(recoveryTimer)
        recoveryTimer = setTimeout(() => {
          if (cancelled || !useAppStore.getState().isAutoscrollActive) return
          if (currentCfiRef.current === cfiBeforeTurn) {
            const check = analyzeVisiblePage()
            if (check.atEnd) {
              adaptiveScrollEngine.stop()
              setAutoscrollActive(false)
            } else {
              Promise.resolve(handleNext()).catch(() => {})
              recoveryTimer = setTimeout(() => {
                if (!cancelled && useAppStore.getState().isAutoscrollActive && currentCfiRef.current === cfiBeforeTurn) {
                  armPage()
                }
              }, 800)
            }
          }
        }, 750)
      })
    }

    armPage()

    return () => {
      cancelled = true
      if (recoveryTimer) clearTimeout(recoveryTimer)
    }
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

      if (e.key === 'ArrowDown' || e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault()
        handleNext()
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft' || e.key === 'PageUp' || e.key === 'Backspace') {
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
        toggleCurrentBookmarkRef.current()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        if (activeAnnotation) {
          setActiveAnnotation(null)
        } else if (selectedText) {
          setSelectedText(null)
          setOpenNoteModalDirect(false)
        } else if (
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
    activeAnnotation,
    selectedText,
    activeFootnote,
    isAutoscrollActive,
    setAutoscrollActive,
    setActiveFootnote,
    onBack
  ])

  const handleSelectChapter = (href: string) => {
    renditionRef.current?.display(href)
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
    if (pageNumber && epubBookRef.current?.locations?.length()) {
      try {
        const fallbackCfi = (epubBookRef.current.locations as any).cfiFromLocation(pageNumber)
        if (fallbackCfi) {
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
    const backup = { ...ann }
    await db.annotations.delete(ann.id)
    removeAnnotationFromRendition(renditionRef.current, ann.cfiRange)
    if (activeAnnotation?.annotation.id === ann.id) {
      setActiveAnnotation(null)
    }
    await syncBookNotesCount(book.id)
    bumpAnnotationsVersion()

    showToast('Highlight removed', 'Undo', async () => {
      const { id: _oldId, ...rest } = backup
      const newId = await db.annotations.add(rest)
      const restored: Annotation = { ...rest, id: Number(newId) }
      applyAnnotationToRendition(
        renditionRef.current,
        restored,
        themeRef.current,
        (a, ev) => openAnnotationPopoverRef.current(a, ev)
      )
      await syncBookNotesCount(book.id!)
      bumpAnnotationsVersion()
    })
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
    showToast('All notes cleared')
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
        showToast('Highlight color updated')
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

    showToast('Highlight saved', 'Undo', () => {
      handleDeleteAnnotation(saved)
    })
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
        showToast('Note updated')
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

    showToast(note ? 'Note saved' : 'Highlight saved', 'View Notes', () => {
      toggleNotesDrawer(true)
    })
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
      await db.bookmarks.delete(existing.id)
      bumpBookmarksVersion()
      showToast(`Removed bookmark on page ${existing.pageNumber}`)
      return
    }

    const { excerpt, xpath } = extractVisiblePageData(
      renditionRef.current,
      epubBookRef.current,
      currentCfiRef.current,
      currentEndCfiRef.current
    )

    await db.bookmarks.add({
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
    })
    bumpBookmarksVersion()
    showToast(`Bookmarked page ${currentPageRef.current}`, 'View Bookmarks', () => {
      toggleBookmarksDrawer(true)
    })
  }
  toggleCurrentBookmarkRef.current = handleToggleCurrentBookmark

  const handleDeleteBookmark = async (id: number) => {
    await db.bookmarks.delete(id)
    bumpBookmarksVersion()
    showToast('Bookmark deleted')
  }

  const handleRenameBookmark = async (id: number, label: string) => {
    await db.bookmarks.update(id, { label })
    bumpBookmarksVersion()
    showToast('Bookmark renamed')
  }

  const handleClearAllBookmarks = async () => {
    if (!book.id) return
    await db.bookmarks.where('bookId').equals(book.id).delete()
    bumpBookmarksVersion()
    showToast('All bookmarks cleared')
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
          label: isCurrentPageBookmarked ? `Remove Bookmark (p.${currentPage})` : `Bookmark Page ${currentPage}`,
          shortcut: 'Ctrl+B',
          icon: <Bookmark className={`w-3.5 h-3.5 text-[#2a69df] ${isCurrentPageBookmarked ? 'fill-current' : ''}`} />,
          onClick: () => handleToggleCurrentBookmark()
        },
        {
          id: 'autoscroll',
          label: isAutoscrollActive ? 'Stop Auto-Scroll' : 'Start Auto-Scroll',
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
      <div
        onContextMenu={(e) => {
          e.preventDefault()
          openContextMenuRef.current(e.clientX, e.clientY)
        }}
        className={`flex-1 relative flex items-center justify-center overflow-hidden ${
          isImmersiveFullscreen ? 'py-6 px-4' : ''
        }`}
      >
        {/* Icecream-style On-Page Top-Right Bookmark Ribbon Toggle */}
        {!isImmersiveFullscreen && (
          <button
            type="button"
            onClick={handleToggleCurrentBookmark}
            className={`absolute top-2 right-5 z-30 w-7 h-8 flex items-center justify-center rounded-[2px] transition-all cursor-pointer app-no-drag ${
              isCurrentPageBookmarked
                ? 'text-[#2a69df] opacity-100 hover:scale-105'
                : 'text-[#8b949e] opacity-25 hover:opacity-85 hover:text-white'
            }`}
            title={
              isCurrentPageBookmarked
                ? `Remove bookmark on page ${currentPage} (Ctrl+B)`
                : `Bookmark page ${currentPage} (Ctrl+B)`
            }
          >
            <Bookmark className={`w-5 h-5 ${isCurrentPageBookmarked ? 'fill-current drop-shadow' : ''}`} />
          </button>
        )}

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

      {/* Feature 1: Minimalist Bottom-Right Auto-Scroll Countdown (persists even in Fullscreen) */}
      <AdaptiveScrollOverlay
        isActive={isAutoscrollActive}
        onClose={() => setAutoscrollActive(false)}
      />

      {/* Custom Contextual Toast Notification */}
      {readerToast && (
        <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-50 bg-[#171a21] border border-[#2d323f] text-[#e6edf3] text-xs px-3.5 py-2 rounded-md shadow-2xl flex items-center gap-3 app-no-drag animate-in fade-in duration-100">
          <span>{readerToast.message}</span>
          {readerToast.actionLabel && readerToast.onAction && (
            <button
              type="button"
              onClick={() => {
                const fn = readerToast.onAction
                setReaderToast(null)
                fn?.()
              }}
              className="text-[#58a6ff] hover:text-[#79c0ff] font-semibold cursor-pointer"
            >
              {readerToast.actionLabel}
            </button>
          )}
        </div>
      )}

      {/* Subtle Persistent Liquid Climax Progress Bar (hidden in immersive fullscreen) */}
      {!isImmersiveFullscreen && (
        <FluidClimaxProgressBar
          progressPercent={progressPercent || 0}
          currentPage={currentPage}
          totalPages={totalPages}
          book={book}
          theme={settings.theme}
          isImmersiveFullscreen={isImmersiveFullscreen}
          onSeek={(val) => {
            setProgressPercent(val)
            if (epubBookRef.current?.locations && epubBookRef.current.locations.length() > 0) {
              const cfi = epubBookRef.current.locations.cfiFromPercentage(val / 100)
              if (cfi) renditionRef.current?.display(cfi)
            } else {
              const spine = (epubBookRef.current?.spine as any)?.spineItems || (epubBookRef.current?.spine as any)
              if (spine && spine.length) {
                const targetIdx = Math.min(spine.length - 1, Math.max(0, Math.floor((val / 100) * spine.length)))
                const item = spine[targetIdx]
                if (item?.href) renditionRef.current?.display(item.href)
              }
            }
          }}
        />
      )}

      {/* Sliding Drawers */}
      <TOCDrawer
        toc={toc}
        currentHref={currentHref}
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
