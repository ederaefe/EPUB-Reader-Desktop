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
import { FullscreenClimaxWaveOverlay } from './FullscreenClimaxWaveOverlay'
import { SideNavigation } from './SideNavigation'
import { useClimaxEasterEgg } from '../../hooks/useClimaxEasterEgg'
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
import { buildResolvedToc, findActiveTocItem, findAnchorElement, resolveTocHrefToSpine } from '../../services/tocService'

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
    syncActiveBookProgress,
    setPendingSeekPercent,
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
  const scrollModeRef = useRef(settings.scrollMode || 'horizontal')
  scrollModeRef.current = settings.scrollMode || 'horizontal'

  // Real-time manual reading cadence profiler refs
  const pageEnteredAtRef = useRef<number>(Date.now())
  const lastWordsOnPageRef = useRef<number>(180)

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
      ${fontRule}
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

        // Smooth manual mouse-wheel page turning in horizontal paginated mode when no panel is open
        if (scrollModeRef.current === 'vertical') {
          return
        }
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
          navigateStepRef.current('next')
        } else if (e.deltaY < -24) {
          navigateStepRef.current('prev')
        }
      },
      { passive: false }
    )

    // Throttled iframe user-activity feed & pointer-X forwarding for SideNavigation
    let lastIframeActivityAt = 0
    const recordIframeActivity = () => {
      const now = Date.now()
      if (now - lastIframeActivityAt < 1000) return
      lastIframeActivityAt = now
      adaptiveScrollEngine.recordUserActivity()
    }
    let lastPointerEmitAt = 0
    const forwardIframePointer = (e: MouseEvent) => {
      recordIframeActivity()
      const now = Date.now()
      if (now - lastPointerEmitAt < 45) return
      lastPointerEmitAt = now
      const frameRect = (contents.window.frameElement as HTMLElement | null)?.getBoundingClientRect()
        || viewerRef.current?.getBoundingClientRect()
      const clientX = (frameRect?.left || 0) + e.clientX
      window.dispatchEvent(new CustomEvent('semply:reader-pointer', { detail: { clientX } }))
    }
    contents.window.addEventListener('pointermove', forwardIframePointer, { passive: true })
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
      if (e.altKey && !e.ctrlKey && !e.metaKey && (e.key.toLowerCase() === 'x' || e.code === 'KeyX')) {
        e.preventDefault()
        e.stopPropagation()
        onBackRef.current()
        return
      }
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

      const isVert = scrollModeRef.current === 'vertical'
      const scrollContainer = (renditionRef.current as any)?.manager?.container as HTMLElement | undefined

      if (e.key === 'F7') {
        e.preventDefault()
        handleToggleTTSRef.current()
      } else if (e.key === 'F8') {
        e.preventDefault()
        handleStopTTSRef.current()
      } else if (isVert && (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ')) {
        if (scrollContainer) {
          e.preventDefault()
          const delta = e.key === 'ArrowDown' ? 140 : Math.round(scrollContainer.clientHeight * 0.85)
          scrollContainer.scrollBy({ top: delta, behavior: 'smooth' })
        }
      } else if (isVert && (e.key === 'ArrowUp' || e.key === 'PageUp')) {
        if (scrollContainer) {
          e.preventDefault()
          const delta = e.key === 'ArrowUp' ? -140 : -Math.round(scrollContainer.clientHeight * 0.85)
          scrollContainer.scrollBy({ top: delta, behavior: 'smooth' })
        }
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault()
        navigateStepRef.current('next')
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft' || e.key === 'PageUp' || e.key === 'Backspace') {
        e.preventDefault()
        navigateStepRef.current('prev')
      } else if (e.key === 'Home') {
        e.preventDefault()
        renditionRef.current?.display(0)
      } else if (e.key === 'End') {
        e.preventDefault()
        handleJumpEndRef.current()
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
        if (
          window.desktopAPI?.readFileBuffer &&
          !bookFilePathRef.current.startsWith('http://') &&
          !bookFilePathRef.current.startsWith('https://') &&
          !bookFilePathRef.current.startsWith('/assets/') &&
          !bookFilePathRef.current.startsWith('assets/')
        ) {
          try {
            sourceData = await window.desktopAPI.readFileBuffer(bookFilePathRef.current)
          } catch {
            sourceData = bookFilePathRef.current
          }
        } else {
          try {
            const resp = await fetch(bookFilePathRef.current)
            sourceData = await resp.arrayBuffer()
          } catch {
            sourceData = bookFilePathRef.current
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

      // 1:1 Horizontal Paginated Spread OR Vertical Continuous Scroll support
      const isVertical = settings.scrollMode === 'vertical'
      const isDouble = !isVertical && settings.pageSpread === 'double'
      renditionInstance = epubInstance.renderTo(viewerRef.current, {
        width: '100%',
        height: '100%',
        spread: isDouble ? 'always' : 'none',
        flow: isVertical ? 'scrolled' : 'paginated',
        manager: isVertical ? 'continuous' : 'default',
        minSpreadWidth: 800
      })
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
          const curLoc = renditionInstance?.currentLocation?.() as any
          if (curLoc?.start) {
            syncActiveChapter(curLoc, items)
          }
        })
        .catch(() => {})

      const applyLocationState = (location: any, persistToDb = true) => {
        if (isCancelled || !location || !location.start) return
        const cfi = location.start.cfi
        setCurrentCfi(cfi)
        setCurrentEndCfi(location.end?.cfi || '')

        const { page, pct, total } = computeProgressMetrics(epubInstance, location)
        setTotalPages(total)
        setProgressPercent(pct)
        setCurrentPage(page)

        syncActiveChapter(location, tocRef.current)

        // Feature 1: Record manual reading cadence between page turns (using live store state)
        const now = Date.now()
        const elapsedMs = now - pageEnteredAtRef.current
        const prevWords = lastWordsOnPageRef.current
        if (!useAppStore.getState().isAutoscrollActive && elapsedMs >= 2000 && elapsedMs <= 300000 && prevWords > 10) {
          adaptiveScrollEngine.recordManualReading(prevWords, elapsedMs)
        }
        pageEnteredAtRef.current = now

        // Cache chapter full text and estimate words visible on the current page/spread
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
      })

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
      const initialLoc = renditionInstance.currentLocation() as any
      if (initialLoc?.start) {
        applyLocationState(initialLoc, false)
      }

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
                const curLoc = renditionInstance?.currentLocation() as any
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

          // Protect the currently displayed section from being unloaded mid-read during indexing
          const origProcess = locs.process.bind(locs)
          locs.process = (section: any) => {
            const activeHref = currentHrefRef.current?.split('#')[0]
            const isActiveSection = Boolean(
              activeHref && section?.href && (section.href === activeHref || activeHref.endsWith(section.href))
            )
            if (!isActiveSection) {
              return origProcess(section)
            }
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
            const curLoc = renditionInstance?.currentLocation() as any
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
      // Stop the internal epub.js queue BEFORE destroy() so pending Rendition.start()
      // tasks never fire against an undefined book after unmount/StrictMode remount.
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
    }
  }, [
    bookKey,
    book.format,
    activeBookBuffer,
    pdfViewMode,
    reflowEpubBuffer,
    settings.pageSpread,
    settings.scrollMode,
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
  }, [settings.theme, settings.fontSize, settings.fontWeight, settings.lineHeight, settings.fontFamily, applyDynamicStylesToDoc])

  // Resilient page navigation: delegates to epub.js next()/prev(), and if a non-linear
  // spine section (linear="no", common on EPUB covers/front-matter) returns undefined from
  // section.next()/prev() or fails to advance, steps explicitly to the adjacent spine item.
  const navigateStep = useCallback(async (direction: 'next' | 'prev') => {
    const rendition = renditionRef.current as any
    const epub = epubBookRef.current as any
    if (!rendition) return

    const beforeLoc = rendition.currentLocation?.() as any
    const beforeCfi: string = beforeLoc?.start?.cfi || currentCfiRef.current || ''
    const beforeIdx: number = typeof beforeLoc?.start?.index === 'number' ? beforeLoc.start.index : -1
    const container = rendition.manager?.container as HTMLElement | undefined
    const beforeScrollLeft = container?.scrollLeft ?? 0
    const beforeScrollTop = container?.scrollTop ?? 0

    try {
      if (direction === 'next') {
        await rendition.next()
      } else {
        await rendition.prev()
      }
    } catch {
      // Fall through to explicit spine fallback below
    }

    const afterLoc = rendition.currentLocation?.() as any
    const afterCfi: string = afterLoc?.start?.cfi || ''
    const afterScrollLeft = container?.scrollLeft ?? 0
    const afterScrollTop = container?.scrollTop ?? 0

    const didMove =
      (afterCfi && afterCfi !== beforeCfi) ||
      Math.abs(afterScrollLeft - beforeScrollLeft) > 2 ||
      Math.abs(afterScrollTop - beforeScrollTop) > 2

    if (!didMove && epub?.spine?.spineItems?.length) {
      const spineItems: any[] = epub.spine.spineItems
      const curIdx = beforeIdx >= 0 ? beforeIdx : (typeof afterLoc?.start?.index === 'number' ? afterLoc.start.index : 0)
      const targetIdx = direction === 'next' ? curIdx + 1 : curIdx - 1
      if (targetIdx >= 0 && targetIdx < spineItems.length) {
        const targetItem = spineItems[targetIdx]
        if (targetItem?.href) {
          try {
            await rendition.display(targetItem.href)
          } catch {
            // Ignore display error on unrenderable spine item
          }
        }
      }
    }
  }, [])
  navigateStepRef.current = navigateStep

  const handleNext = useCallback(() => navigateStep('next'), [navigateStep])
  const handlePrev = useCallback(() => navigateStep('prev'), [navigateStep])

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

  // Cleanly stop Auto-Scroll, Read Aloud (TTS), and close Search drawer when exiting the reader back to Library
  useEffect(() => {
    return () => {
      adaptiveScrollEngine.stop()
      ttsService.stop()
      const st = useAppStore.getState()
      st.setAutoscrollActive(false)
      st.setTTSActive(false)
      st.setTTSMuted(false)
      st.toggleSearchDrawer(false)
    }
  }, [])

  // Wire F7 (Play/Pause Read Aloud) and F8 (Stop Read Aloud) refs for isolated EPUB iframe keydown
  handleToggleTTSRef.current = () => {
    const st = useAppStore.getState()
    if (st.isTTSActive) {
      if (st.isTTSMuted) {
        ttsService.resume()
        st.setTTSMuted(false)
        showToast('Read Aloud resumed')
      } else {
        ttsService.pause()
        st.setTTSMuted(true)
        showToast('Read Aloud paused')
      }
      return
    }
    const iframeDoc = (renditionRef.current?.getContents()?.[0] as any)?.document
    const text = iframeDoc?.body?.innerText?.trim() || book.title || 'Reading'
    st.setTTSActive(true)
    st.setTTSMuted(false)
    ttsService.speak(text, {
      rate: st.settings.ttsSpeed,
      pitch: st.settings.ttsPitch,
      voiceURI: st.settings.ttsVoice,
      onEnd: () => {
        const cur = useAppStore.getState()
        cur.setTTSActive(false)
        cur.setTTSMuted(false)
      }
    })
    showToast('Read Aloud started (F7 pause · F8 stop)')
  }

  handleStopTTSRef.current = () => {
    const st = useAppStore.getState()
    if (!st.isTTSActive) return
    ttsService.stop()
    st.setTTSActive(false)
    st.setTTSMuted(false)
    showToast('Read Aloud stopped')
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
              if (scrollModeRef.current === 'vertical') {
                const maxScrollY = Math.max(0, container.scrollHeight - container.clientHeight)
                container.scrollTop = Math.round((clamped / 100) * maxScrollY)
              } else {
                const delta = (rendition as any)?.manager?.layout?.delta || container.clientWidth || 1
                const maxScrollX = Math.max(0, container.scrollWidth - container.clientWidth)
                const rawLeft = (clamped / 100) * maxScrollX
                const snappedLeft = Math.floor(rawLeft / delta) * delta
                container.scrollLeft = Math.max(0, Math.min(maxScrollX, snappedLeft))
              }
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
          const loc = rendition.currentLocation() as any
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

      const isVert = scrollModeRef.current === 'vertical'
      const scrollContainer = (renditionRef.current as any)?.manager?.container as HTMLElement | undefined

      if (isVert && (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ')) {
        if (scrollContainer) {
          e.preventDefault()
          const delta = e.key === 'ArrowDown' ? 140 : Math.round(scrollContainer.clientHeight * 0.85)
          scrollContainer.scrollBy({ top: delta, behavior: 'smooth' })
        }
      } else if (isVert && (e.key === 'ArrowUp' || e.key === 'PageUp')) {
        if (scrollContainer) {
          e.preventDefault()
          const delta = e.key === 'ArrowUp' ? -140 : -Math.round(scrollContainer.clientHeight * 0.85)
          scrollContainer.scrollBy({ top: delta, behavior: 'smooth' })
        }
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault()
        handleNext()
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft' || e.key === 'PageUp' || e.key === 'Backspace') {
        e.preventDefault()
        handlePrev()
      } else if (e.key === 'Home') {
        e.preventDefault()
        renditionRef.current?.display(0)
      } else if (e.key === 'End') {
        e.preventDefault()
        handleJumpEndRef.current()
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

    // Reset stale manager scroll coordinates before jumping in vertical continuous mode
    // so epub.js ContinuousViewManager.fill()/check() does not carry over the previous
    // chapter's scrollTop and overshoot into the middle/bottom of the newly opened chapter.
    if (scrollModeRef.current === 'vertical' && rendition.manager) {
      rendition.manager.scrollTop = 0
      rendition.manager.scrollLeft = 0
    }

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

    // Locate the exact rendered view for the target spine section (never blindly contentsList[0],
    // which in continuous vertical mode is often the prepended previous chapter).
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

      if (scrollModeRef.current === 'vertical') {
        let targetTop = targetView.element?.offsetTop ?? 0
        if (anchorEl) {
          const anchorTop = anchorEl.getBoundingClientRect().top
          if (Number.isFinite(anchorTop) && anchorTop > 0) {
            targetTop += anchorTop
          }
        }
        const clampedTop = Math.max(0, Math.round(targetTop))
        manager.ignore = true
        container.scrollTop = clampedTop
        manager.scrollTop = clampedTop
        rendition.reportLocation?.()
      } else {
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
    }

    await alignViewportToChapterStart()

    // In vertical continuous mode, ContinuousViewManager.fill() can finish prepending and
    // expanding the previous chapter slightly after display() resolves, shifting offsetTop.
    // Re-pin cleanly once layout settles (cancelling immediately if the user scrolls/navigates).
    if (scrollModeRef.current === 'vertical') {
      const container = rendition.manager?.container as HTMLElement | undefined
      let userInteracted = false
      const markInteracted = () => {
        userInteracted = true
      }
      container?.addEventListener('wheel', markInteracted, { once: true, passive: true })
      container?.addEventListener('pointerdown', markInteracted, { once: true, passive: true })
      window.addEventListener('keydown', markInteracted, { once: true, passive: true })

      const scheduleRealign = (delayMs: number) => {
        setTimeout(() => {
          if (userInteracted || jumpNonce !== chapterJumpNonceRef.current) return
          alignViewportToChapterStart().catch(() => {})
        }, delayMs)
      }
      scheduleRealign(60)
      scheduleRealign(220)
      setTimeout(() => {
        container?.removeEventListener('wheel', markInteracted)
        container?.removeEventListener('pointerdown', markInteracted)
        window.removeEventListener('keydown', markInteracted)
      }, 280)
    }

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

  // Trigger epub.js layout reflow only when immersive fullscreen actually toggles (never on initial mount,
  // where an early resize() clears the active view and can snap scrollLeft back to page 1)
  useEffect(() => {
    if (!hasMountedFullscreenRef.current) {
      hasMountedFullscreenRef.current = true
      return
    }
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
      <SideNavigation
        onPrev={handlePrev}
        onNext={handleNext}
        isLeftDisabled={currentPage <= 1 && progressPercent <= 0}
        isRightDisabled={progressPercent >= 100 && currentPage >= totalPages}
        hidden={isImmersiveFullscreen}
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

        {/* EPUB Mount Point */}
        <div
          ref={viewerRef}
          className="w-full h-full max-w-6xl mx-auto relative"
        />

        {/* Center Gutter Divider for Double Page Spread (Horizontal Paginated mode only) */}
        {settings.pageSpread === 'double' && settings.scrollMode !== 'vertical' && !isImmersiveFullscreen && (
          <div
            style={{ backgroundColor: currentTheme.border }}
            className="absolute left-1/2 top-4 bottom-4 w-px pointer-events-none opacity-40"
          />
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
          climaxTarget={climaxTarget}
          isSaberGlowing={climaxEffect === 'bar-saber'}
          onSaberGlowEnd={stopClimaxEffect}
          onSeek={handleSeek}
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
