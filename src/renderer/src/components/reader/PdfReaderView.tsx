import React, { useEffect, useRef, useState, useCallback } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Minimize2,
  Maximize2,
  Bookmark,
  FileCode2,
  Settings
} from 'lucide-react'
import { useAppStore } from '../../stores/useAppStore'
import { useShallow } from 'zustand/react/shallow'
import { adaptiveScrollEngine } from '../../services/adaptiveScrollService'
import { db, type Annotation, type Book, type Bookmark as BookmarkItem, type NoteColor } from '../../db'
import { ReaderTopBar } from './ReaderTopBar'
import { SideNavigation } from './SideNavigation'
import { TOCDrawer, type TocItem } from '../drawers/TOCDrawer'
import { NotesDrawer } from '../drawers/NotesDrawer'
import { BookmarksDrawer } from '../drawers/BookmarksDrawer'
import { SettingsDrawer } from '../drawers/SettingsDrawer'
import { ContextMenu, type ContextMenuItem } from '../ui/ContextMenu'
import { SelectionPopup } from './SelectionPopup'
import { AnnotationPopover } from './AnnotationPopover'
import { syncBookNotesCount, ICE_NOTE_COLORS } from '../../services/annotationService'
import { buildPdfToc, findActivePdfTocItem } from '../../services/tocService'
import { FluidClimaxProgressBar } from './FluidClimaxProgressBar'
import { ReaderAudioHUD } from './ReaderAudioHUD'
import { FullscreenClimaxWaveOverlay } from './FullscreenClimaxWaveOverlay'
import { AdaptiveScrollOverlay } from './AdaptiveScrollOverlay'
import { useClimaxEasterEgg } from '../../hooks/useClimaxEasterEgg'
import { ttsService } from '../../services/ttsService'

// Ensure pdfjs worker is properly configured for Electron Vite renderer
if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString()
}

const isTargetInput = (target: EventTarget | null): boolean => {
  if (!target) return false
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return true
  const el = target as HTMLElement
  if (el?.isContentEditable || el?.getAttribute?.('contenteditable') === 'true') return true
  if (el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA') return true
  return false
}

interface PdfReaderViewProps {
  book: Book
  onBack: () => void
  onActivateReflow: () => Promise<void>
}

const PdfReaderViewBase: React.FC<PdfReaderViewProps> = ({
  book,
  onBack,
  onActivateReflow
}) => {
  const {
    settings,
    activeBookBuffer,
    isImmersiveFullscreen,
    isTOCDrawerOpen,
    isNotesDrawerOpen,
    isBookmarksDrawerOpen,
    isSearchDrawerOpen,
    isSettingsDrawerOpen,
    isConvertingPdf,
    pdfConvertProgress,
    bookmarksVersion,
    annotationsVersion,
    zoom,
    isTTSActive,
    isTTSMuted,
    isAutoscrollActive,
    isFullSettingsModalOpen
  } = useAppStore(
    useShallow((s) => ({
      settings: s.settings,
      activeBookBuffer: s.activeBookBuffer,
      isImmersiveFullscreen: s.isImmersiveFullscreen,
      isTOCDrawerOpen: s.isTOCDrawerOpen,
      isNotesDrawerOpen: s.isNotesDrawerOpen,
      isBookmarksDrawerOpen: s.isBookmarksDrawerOpen,
      isSearchDrawerOpen: s.isSearchDrawerOpen,
      isSettingsDrawerOpen: s.isSettingsDrawerOpen,
      isConvertingPdf: s.isConvertingPdf,
      pdfConvertProgress: s.pdfConvertProgress,
      bookmarksVersion: s.bookmarksVersion,
      annotationsVersion: s.annotationsVersion,
      zoom: s.pdfZoom,
      isTTSActive: s.isTTSActive,
      isTTSMuted: s.isTTSMuted,
      isAutoscrollActive: s.isAutoscrollActive,
      isFullSettingsModalOpen: s.isFullSettingsModalOpen
    }))
  )

  const updateSettings = useAppStore((s) => s.updateSettings)
  const syncActiveBookProgress = useAppStore((s) => s.syncActiveBookProgress)
  const setCurrentChapterTitle = useAppStore((s) => s.setCurrentChapterTitle)
  const setImmersiveFullscreen = useAppStore((s) => s.setImmersiveFullscreen)
  const toggleTOCDrawer = useAppStore((s) => s.toggleTOCDrawer)
  const toggleNotesDrawer = useAppStore((s) => s.toggleNotesDrawer)
  const toggleBookmarksDrawer = useAppStore((s) => s.toggleBookmarksDrawer)
  const toggleSearchDrawer = useAppStore((s) => s.toggleSearchDrawer)
  const toggleSettingsDrawer = useAppStore((s) => s.toggleSettingsDrawer)
  const bumpAnnotationsVersion = useAppStore((s) => s.bumpAnnotationsVersion)
  const bumpBookmarksVersion = useAppStore((s) => s.bumpBookmarksVersion)
  const setPdfZoom = useAppStore((s) => s.setPdfZoom)
  const setTTSActive = useAppStore((s) => s.setTTSActive)
  const setTTSMuted = useAppStore((s) => s.setTTSMuted)
  const toggleHelpModal = useAppStore((s) => s.toggleHelpModal)
  const setAutoscrollActive = useAppStore((s) => s.setAutoscrollActive)

  const setZoom = (updater: number | ((z: number) => number)) => {
    const next = typeof updater === 'function' ? updater(useAppStore.getState().pdfZoom) : updater
    setPdfZoom(next)
  }

  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null)
  const [currentPage, setCurrentPage] = useState<number>(Math.max(1, book.currentPage || 1))
  const [totalPages, setTotalPages] = useState<number>(Math.max(1, book.totalPages || 1))
  const [pdfBookmarks, setPdfBookmarks] = useState<BookmarkItem[]>([])

  // Chrome PDF-Grade Floating Annotation & Note Selection States
  const [selectedPdfText, setSelectedPdfText] = useState<string | null>(null)
  const [selectionPos, setSelectionPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [selectedPageNum, setSelectedPageNum] = useState<number>(1)
  const [activeAnnotation, setActiveAnnotation] = useState<{
    annotation: Annotation
    position: { x: number; y: number }
  } | null>(null)

  const pdfProgressPercent =
    totalPages > 1 ? ((currentPage - 1) / (totalPages - 1)) * 100 : 100

  const {
    climaxTarget,
    activeEffect: climaxEffect,
    stopEffect: stopClimaxEffect
  } = useClimaxEasterEgg({
    book,
    progressPercent: pdfProgressPercent,
    currentPage,
    totalPages,
    isImmersiveFullscreen
  })

  // Keep book identity in stable refs so DB progress updates never tear down and reload the PDF
  const bookKey = `${book.id ?? ''}::${book.filePath}`
  const bookIdRef = useRef(book.id)
  const bookFilePathRef = useRef(book.filePath)
  const bookTotalPagesRef = useRef(book.totalPages || 1)
  const lastLoadedBookKeyRef = useRef<string>('')
  bookIdRef.current = book.id
  bookFilePathRef.current = book.filePath
  bookTotalPagesRef.current = book.totalPages || 1

  useEffect(() => {
    if (!book.id) return
    db.bookmarks
      .where('bookId')
      .equals(book.id)
      .toArray()
      .then((items) => setPdfBookmarks(items))
      .catch(() => {})
  }, [book.id, bookmarksVersion])

  const isCurrentPdfPageBookmarked = pdfBookmarks.some((bm) => bm.pageNumber === currentPage)

  const handleTogglePdfBookmark = useCallback(async () => {
    if (!bookIdRef.current) return
    const existing = pdfBookmarks.find((bm) => bm.pageNumber === currentPage)
    if (existing?.id) {
      await db.bookmarks.delete(existing.id)
    } else {
      await db.bookmarks.add({
        bookId: bookIdRef.current,
        cfi: String(currentPage),
        label: `Page ${currentPage}`,
        pageNumber: currentPage,
        progressPercent: totalPages > 0 ? Math.round((currentPage / totalPages) * 100) : 0,
        createdAt: Date.now()
      })
    }
    bumpBookmarksVersion()
  }, [pdfBookmarks, currentPage, totalPages, bumpBookmarksVersion])
  const [toc, setToc] = useState<TocItem[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; items: ContextMenuItem[] } | null>(null)

  const viewportRef = useRef<HTMLDivElement>(null)
  const canvasLeftRef = useRef<HTMLCanvasElement>(null)
  const canvasRightRef = useRef<HTMLCanvasElement>(null)
  const textLayerLeftRef = useRef<HTMLDivElement>(null)
  const textLayerRightRef = useRef<HTMLDivElement>(null)
  const renderTaskLeftRef = useRef<any>(null)
  const renderTaskRightRef = useRef<any>(null)

  const themeStyles = {
    day: { bg: '#e9ecf0', pageFilter: 'none' },
    night: { bg: '#171a21', pageFilter: 'invert(0.88) hue-rotate(180deg) contrast(0.95)' },
    'light-sepia': { bg: '#f4e6cb', pageFilter: 'sepia(0.28) brightness(0.98)' },
    'dark-sepia': { bg: '#241e18', pageFilter: 'invert(0.86) sepia(0.35) hue-rotate(180deg) contrast(0.92)' }
  }
  const currentTheme = themeStyles[settings.theme] || themeStyles.night

  // Load PDF document (keyed by stable bookKey so DB progress writes never tear down the PDF)
  useEffect(() => {
    let cancelled = false
    let loadedDoc: pdfjsLib.PDFDocumentProxy | null = null

    if (lastLoadedBookKeyRef.current !== bookKey) {
      lastLoadedBookKeyRef.current = bookKey
      setCurrentPage(Math.max(1, book.currentPage || 1))
      setTotalPages(Math.max(1, book.totalPages || 1))
      setToc([])
    }

    async function loadPdf() {
      setLoadError(null)
      try {
        let data: Uint8Array
        if (activeBookBuffer) {
          // Copy buffer so pdfjs worker transfer never detaches store buffer
          data = new Uint8Array(activeBookBuffer.slice(0))
        } else if (window.desktopAPI?.readFileBuffer) {
          const buf = await window.desktopAPI.readFileBuffer(bookFilePathRef.current)
          data = new Uint8Array(buf)
        } else {
          const resp = await fetch(bookFilePathRef.current)
          data = new Uint8Array(await resp.arrayBuffer())
        }

        const task = pdfjsLib.getDocument({ data, isEvalSupported: false })
        loadedDoc = await task.promise
        if (cancelled) {
          loadedDoc.destroy()
          return
        }

        setPdfDoc(loadedDoc)
        setTotalPages(loadedDoc.numPages)
        setCurrentPage((p) => Math.max(1, Math.min(loadedDoc!.numPages, p)))

        // Recursively extract native PDF outline (including nested sub-chapters)
        try {
          const outline = await loadedDoc.getOutline()
          const mapped = await buildPdfToc(loadedDoc, outline)
          if (!cancelled) {
            setToc(mapped)
          }
        } catch {
          if (!cancelled) setToc([])
        }

        if (bookIdRef.current && loadedDoc.numPages !== bookTotalPagesRef.current) {
          db.books.update(bookIdRef.current, { totalPages: loadedDoc.numPages })
        }
      } catch (err: any) {
        if (!cancelled) {
          setLoadError(err?.message || 'Unable to load PDF document.')
        }
      }
    }

    loadPdf()
    return () => {
      cancelled = true
      loadedDoc?.destroy()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookKey, activeBookBuffer])

  // Stop Read Aloud on unmount
  useEffect(() => {
    return () => {
      ttsService.stop()
      const st = useAppStore.getState()
      st.setTTSActive(false)
      st.setTTSMuted(false)
    }
  }, [])

  const activePdfTocItem = findActivePdfTocItem(toc, currentPage)
  const activePdfChapterLabel = activePdfTocItem?.label || `Page ${currentPage} / ${totalPages}`

  // Keep OS window title & reader chapter metadata synced as the user turns PDF pages
  useEffect(() => {
    setCurrentChapterTitle(activePdfChapterLabel)
  }, [activePdfChapterLabel, setCurrentChapterTitle])

  // Render active PDF page(s) to HiDPI canvas + selectable text layer
  useEffect(() => {
    if (!pdfDoc) return
    let cancelled = false

    const renderSingleCanvas = async (
      pageNum: number,
      canvas: HTMLCanvasElement | null,
      taskRef: React.MutableRefObject<any>,
      textLayerDiv?: HTMLDivElement | null
    ) => {
      if (taskRef.current) {
        try {
          taskRef.current.cancel()
        } catch {
          // ignore cancellation race
        }
        taskRef.current = null
      }

      if (!canvas || pageNum < 1 || pageNum > pdfDoc.numPages) {
        if (canvas) {
          const ctx = canvas.getContext('2d')
          ctx?.clearRect(0, 0, canvas.width, canvas.height)
          canvas.width = 0
          canvas.height = 0
        }
        if (textLayerDiv) {
          textLayerDiv.innerHTML = ''
        }
        return
      }

      const page = await pdfDoc.getPage(pageNum)
      if (cancelled) return

      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const viewport = page.getViewport({ scale: zoom })
      const renderViewport = page.getViewport({ scale: zoom * dpr })

      canvas.width = Math.floor(renderViewport.width)
      canvas.height = Math.floor(renderViewport.height)
      canvas.style.width = `${Math.floor(viewport.width)}px`
      canvas.style.height = `${Math.floor(viewport.height)}px`

      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const renderTask = page.render({ canvasContext: ctx, viewport: renderViewport })
      taskRef.current = renderTask
      try {
        await renderTask.promise
      } catch (e: any) {
        if (e?.name !== 'RenderingCancelledException') {
          console.warn('PDF render warning:', e)
        }
        return
      }

      // Lightweight aligned selectable text layer for primary page
      if (textLayerDiv && !cancelled) {
        textLayerDiv.innerHTML = ''
        textLayerDiv.style.width = `${Math.floor(viewport.width)}px`
        textLayerDiv.style.height = `${Math.floor(viewport.height)}px`
        try {
          const textContent = await page.getTextContent()
          if (cancelled) return

          // Query annotations for this page to paint visual highlights directly
          const pageAnns = book.id
            ? await db.annotations.where('bookId').equals(book.id).filter((a) => a.pageNumber === pageNum).toArray()
            : []

          for (const item of textContent.items as any[]) {
            if (!item.str) continue
            const tx = pdfjsLib.Util.transform(viewport.transform, item.transform)
            const span = document.createElement('span')
            span.textContent = item.str
            const fontHeight = Math.hypot(tx[2], tx[3]) || 12
            span.style.position = 'absolute'
            span.style.left = `${tx[4]}px`
            span.style.top = `${tx[5] - fontHeight}px`
            span.style.fontSize = `${fontHeight}px`
            span.style.color = 'transparent'
            span.style.whiteSpace = 'pre'
            span.style.cursor = 'text'
            span.style.userSelect = 'text'

            // Check if span matches any page highlight with word-boundary safety
            const strTrimmed = item.str.trim()
            const matchingAnn = strTrimmed.length > 0
              ? pageAnns.find((a) => {
                  if (!a.text) return false
                  const annTrimmed = a.text.trim()
                  if (annTrimmed === strTrimmed) return true
                  if (strTrimmed.includes(annTrimmed)) return true
                  return strTrimmed.length > 3 && annTrimmed.includes(strTrimmed)
                })
              : null
            if (matchingAnn) {
              const hex = (ICE_NOTE_COLORS[matchingAnn.color] || ICE_NOTE_COLORS.yellow).hex
              span.style.backgroundColor = hex
              span.style.opacity = '0.42'
              span.style.borderRadius = '2px'
              span.style.cursor = 'pointer'
              span.title = matchingAnn.note ? `Note: ${matchingAnn.note}` : 'Highlight'
              span.addEventListener('click', (ev) => {
                ev.stopPropagation()
                const rect = span.getBoundingClientRect()
                setActiveAnnotation({
                  annotation: matchingAnn,
                  position: { x: rect.left + rect.width / 2, y: rect.top }
                })
              })
            }

            textLayerDiv.appendChild(span)
          }
        } catch {
          // text layer optional for scanned PDFs
        }
      }
    }

    const isDouble = (settings.pageLayout ?? (settings.pageSpread === 'single' ? 'single' : 'dual')) === 'dual'
    renderSingleCanvas(currentPage, canvasLeftRef.current, renderTaskLeftRef, textLayerLeftRef.current)
    if (isDouble) {
      renderSingleCanvas(currentPage + 1, canvasRightRef.current, renderTaskRightRef, textLayerRightRef.current)
    }

    // Persist reading progress and keep activeBook synced for proportional PDF <-> EPUB switching
    if (book.id && totalPages > 0) {
      const exactPct =
        totalPages > 1
          ? Math.max(0, Math.min(100, ((currentPage - 1) / (totalPages - 1)) * 100))
          : 100
      const pct =
        currentPage > 1 || exactPct >= 1
          ? Math.min(100, Math.max(1, Math.round(exactPct)))
          : 0
      const isFinished = totalPages > 1 && currentPage >= totalPages
      const progressPatch = {
        currentPage,
        totalPages,
        pdfOriginalTotalPages: totalPages,
        progressPercent: isFinished ? 100 : pct,
        lastOpenedAt: Date.now(),
        ...(isFinished ? { isRead: true } : {})
      }
      db.books.update(book.id, progressPatch)
      syncActiveBookProgress(progressPatch)
    }

    return () => {
      cancelled = true
    }
  }, [pdfDoc, currentPage, totalPages, zoom, settings.pageLayout, settings.pageSpread, book.id, syncActiveBookProgress, annotationsVersion])

  const isDual = (settings.pageLayout ?? (settings.pageSpread === 'single' ? 'single' : 'dual')) === 'dual'
  const step = isDual ? 2 : 1

  const handleNext = useCallback(() => {
    setCurrentPage((p) => Math.min(totalPages, p + step))
  }, [totalPages, step])

  const handlePrev = useCallback(() => {
    setCurrentPage((p) => Math.max(1, p - step))
  }, [step])

  const handleChapterStep = useCallback(
    (direction: 'next' | 'prev') => {
      const flatPages: number[] = []
      const traverse = (items: TocItem[]) => {
        for (const it of items) {
          if (typeof it.pageNumber === 'number' && it.pageNumber >= 1) {
            flatPages.push(it.pageNumber)
          }
          if (it.subitems?.length) {
            traverse(it.subitems)
          }
        }
      }
      traverse(toc)
      const sorted = Array.from(new Set(flatPages)).sort((a, b) => a - b)

      if (sorted.length > 0) {
        if (direction === 'prev') {
          const target = [...sorted].reverse().find((p) => p < currentPage)
          if (target) {
            setCurrentPage(target)
            viewportRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
            return
          }
        } else {
          const maxVisible = isDual ? currentPage + 1 : currentPage
          const target = sorted.find((p) => p > maxVisible)
          if (target) {
            setCurrentPage(target)
            viewportRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
            return
          }
        }
      }

      // Fallback: jump 10 pages when document has no outline TOC
      if (direction === 'prev') {
        setCurrentPage((p) => Math.max(1, p - 10))
      } else {
        setCurrentPage((p) => Math.min(totalPages, p + 10))
      }
      viewportRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    },
    [toc, currentPage, isDual, totalPages]
  )

  // Keep stable refs for timer loop to avoid stale closure
  const currentPageRef = useRef(currentPage)
  const totalPagesRef = useRef(totalPages)
  currentPageRef.current = currentPage
  totalPagesRef.current = totalPages
  const armPageRef = useRef<() => void>(() => {})

  // Re-arm autoscroll on page change reactively
  useEffect(() => {
    if (useAppStore.getState().isAutoscrollActive) {
      armPageRef.current()
    }
  }, [currentPage])

  // Cleanup autoscroll on unmount
  useEffect(() => {
    return () => {
      adaptiveScrollEngine.stop()
      useAppStore.getState().setAutoscrollActive(false)
    }
  }, [])

  // Auto-pause PDF Autoscroll when any drawer, modal, or context menu is open
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

  // Auto-pause while user is selecting text
  useEffect(() => {
    adaptiveScrollEngine.setSuspension('selection', Boolean(selectedPdfText))
  }, [selectedPdfText])

  // Reverse sync: Persist dwell time changes (hotkeys/overlay) back to settings
  useEffect(() => {
    return adaptiveScrollEngine.onSyncSettings((s) => {
      const st = useAppStore.getState()
      const isDualSpread = (st.settings.pageLayout ?? (st.settings.pageSpread === 'single' ? 'single' : 'dual')) === 'dual'
      st.updateSettings({
        autoscrollCountdownSec: s.fixedCountdownSec,
        ...(isDualSpread
          ? { pdfCountdownSecDual: s.fixedCountdownSec }
          : { pdfCountdownSecSingle: s.fixedCountdownSec })
      })
    })
  }, [])

  // Shared Autoscroll Engine Lifecycle for PDF
  // Single page default: 25s, Dual spread default: 45s.
  useEffect(() => {
    if (!isAutoscrollActive) {
      adaptiveScrollEngine.stop()
      return
    }

    const mode = settings.autoscrollMode ?? 'countdown'
    const cur = currentPageRef.current
    const tot = totalPagesRef.current
    const isSpread = isDual && cur + 1 <= tot
    const dwellSec = isSpread
      ? (settings.pdfCountdownSecDual ?? 45)
      : (settings.pdfCountdownSecSingle ?? 25)

    adaptiveScrollEngine.configure({
      mode,
      fixedCountdownSec: dwellSec,
      adaptiveBaseSec: settings.autoscrollAdaptiveSec ?? dwellSec
    })

    let cancelled = false

    const armPage = () => {
      if (cancelled || !useAppStore.getState().isAutoscrollActive) return
      const cur = currentPageRef.current
      const tot = totalPagesRef.current
      if (cur > tot) {
        adaptiveScrollEngine.stop()
        setAutoscrollActive(false)
        return
      }

      const isCurrentSpread = isDual && cur + 1 <= tot

      adaptiveScrollEngine.startPageCountdown(
        180,
        false,
        () => {
          if (cancelled || !useAppStore.getState().isAutoscrollActive) return
          const current = currentPageRef.current
          const total = totalPagesRef.current
          const vp = viewportRef.current
          const canScrollVertically =
            vp &&
            vp.scrollHeight - vp.clientHeight > 80 &&
            vp.scrollTop + vp.clientHeight < vp.scrollHeight - 15
          if (canScrollVertically) {
            vp.scrollBy({ top: vp.clientHeight * 0.85, behavior: 'smooth' })
            setTimeout(() => {
              if (cancelled || !useAppStore.getState().isAutoscrollActive) return
              armPage()
            }, 450)
            return
          }
          const isLastSpread = isDual ? current + 1 >= total : current >= total
          if (isLastSpread) {
            adaptiveScrollEngine.stop()
            useAppStore.getState().setAutoscrollActive(false)
          } else {
            handleNext()
            viewportRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
          }
        },
        isCurrentSpread,
        cur
      )
    }

    armPageRef.current = armPage
    armPage()

    return () => {
      cancelled = true
    }
  }, [
    isAutoscrollActive,
    isDual,
    handleNext,
    setAutoscrollActive,
    settings.autoscrollMode,
    settings.pdfCountdownSecDual,
    settings.pdfCountdownSecSingle,
    settings.autoscrollAdaptiveSec
  ])

  // Keyboard navigation (responsive Up/Down smooth scroll + seamless edge page turning)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      adaptiveScrollEngine.recordUserActivity()
      const isBackKey =
        (e.altKey && !e.ctrlKey && !e.metaKey && e.key === 'ArrowLeft') ||
        (!e.ctrlKey && !e.altKey && !e.metaKey && e.key === 'Backspace' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement))
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
          handlePrev()
        }
        return
      }

      const isForwardKey =
        e.altKey && !e.ctrlKey && !e.metaKey && e.key === 'ArrowRight'
      if (isForwardKey) {
        e.preventDefault()
        e.stopPropagation()
        handleNext()
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
        if (k === 'b' || k === 'd') {
          e.preventDefault()
          handleTogglePdfBookmark()
          return
        }
        if (k === 'f') {
          e.preventDefault()
          toggleSearchDrawer(true)
          return
        }
        if (k === '/' || e.key === '?') {
          e.preventDefault()
          toggleHelpModal()
          return
        }
        if (k === '=' || k === '+' || e.code === 'Equal' || e.code === 'NumpadAdd') {
          e.preventDefault()
          setZoom((z) => Math.min(3.0, Number((z + 0.15).toFixed(2))))
          return
        }
        if (k === '-' || k === '_' || e.code === 'Minus' || e.code === 'NumpadSubtract') {
          e.preventDefault()
          setZoom((z) => Math.max(0.5, Number((z - 0.15).toFixed(2))))
          return
        }
        if (k === '0' || e.code === 'Digit0' || e.code === 'Numpad0') {
          e.preventDefault()
          setPdfZoom(1.2)
          return
        }
        if (k === 'r') {
          e.preventDefault()
          const nextDual = !isDual
          updateSettings({
            pageLayout: nextDual ? 'dual' : 'single',
            pageSpread: nextDual ? 'double' : 'single'
          })
          return
        }
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        const vp = viewportRef.current
        if (vp && vp.scrollHeight - vp.clientHeight > 8 && vp.scrollTop + vp.clientHeight < vp.scrollHeight - 4) {
          vp.scrollBy({ top: 160, behavior: 'smooth' })
        } else {
          handleNext()
          viewportRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        const vp = viewportRef.current
        if (vp && vp.scrollHeight - vp.clientHeight > 8 && vp.scrollTop > 4) {
          vp.scrollBy({ top: -160, behavior: 'smooth' })
        } else {
          handlePrev()
          viewportRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
        }
      } else if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey && e.key === ' ') {
        e.preventDefault()
        if (useAppStore.getState().isAutoscrollActive) {
          adaptiveScrollEngine.setUserPaused(!adaptiveScrollEngine.isPausedState())
        } else {
          handleNext()
          viewportRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
        }
      } else if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        setAutoscrollActive(!useAppStore.getState().isAutoscrollActive)
      } else if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault()
        handleNext()
        viewportRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault()
        handlePrev()
        viewportRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
      } else if (e.key === 'Home') {
        e.preventDefault()
        setCurrentPage(1)
      } else if (e.key === 'End') {
        e.preventDefault()
        setCurrentPage(totalPages)
      } else if (e.key === 'F10') {
        e.preventDefault()
        const nextDual = !isDual
        updateSettings({
          pageLayout: nextDual ? 'dual' : 'single',
          pageSpread: nextDual ? 'double' : 'single'
        })
      } else if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault()
        toggleHelpModal()
      } else if (!e.ctrlKey && !e.metaKey && !e.altKey && (e.key === '+' || e.key === '=')) {
        e.preventDefault()
        if (useAppStore.getState().isAutoscrollActive) {
          const updated = adaptiveScrollEngine.nudgeDwellSec(2)
          useAppStore.getState().showToast(`Auto-Flip: ${updated}s`, 'info')
        } else {
          setZoom((z) => Math.min(3.0, Number((z + 0.15).toFixed(2))))
        }
      } else if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === '-') {
        e.preventDefault()
        if (useAppStore.getState().isAutoscrollActive) {
          const updated = adaptiveScrollEngine.nudgeDwellSec(-2)
          useAppStore.getState().showToast(`Auto-Flip: ${updated}s`, 'info')
        } else {
          setZoom((z) => Math.max(0.5, Number((z - 0.15).toFixed(2))))
        }
      } else if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === '[') {
        e.preventDefault()
        if (useAppStore.getState().isAutoscrollActive) {
          const updated = adaptiveScrollEngine.nudgeDwellSec(-2)
          useAppStore.getState().showToast(`Auto-Flip: ${updated}s`, 'info')
        } else {
          handleChapterStep('prev')
        }
      } else if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === ']') {
        e.preventDefault()
        if (useAppStore.getState().isAutoscrollActive) {
          const updated = adaptiveScrollEngine.nudgeDwellSec(2)
          useAppStore.getState().showToast(`Auto-Flip: ${updated}s`, 'info')
        } else {
          handleChapterStep('next')
        }
      } else if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === '0') {
        e.preventDefault()
        setPdfZoom(1.2)
      } else if (e.key.toLowerCase() === 'r' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        const nextDual = !isDual
        updateSettings({
          pageLayout: nextDual ? 'dual' : 'single',
          pageSpread: nextDual ? 'double' : 'single'
        })
      } else if (e.key === 'Escape') {
        e.preventDefault()
        if (contextMenu) {
          setContextMenu(null)
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
        if (isTTSActive) {
          ttsService.stop()
          setTTSActive(false)
          setTTSMuted(false)
          return
        }
        if (isImmersiveFullscreen || Boolean(document.fullscreenElement)) {
          setImmersiveFullscreen(false)
          window.desktopAPI?.setFullscreen?.(false)
          if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {})
          }
          return
        }
        onBack()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    handleNext,
    handlePrev,
    totalPages,
    settings.pageLayout,
    settings.pageSpread,
    updateSettings,
    handleTogglePdfBookmark,
    contextMenu,
    isTOCDrawerOpen,
    isBookmarksDrawerOpen,
    isNotesDrawerOpen,
    isSearchDrawerOpen,
    isSettingsDrawerOpen,
    toggleTOCDrawer,
    toggleBookmarksDrawer,
    toggleNotesDrawer,
    toggleSearchDrawer,
    toggleSettingsDrawer,
    toggleHelpModal,
    setPdfZoom,
    isTTSActive,
    setTTSActive,
    setTTSMuted,
    isImmersiveFullscreen,
    setImmersiveFullscreen,
    onBack
  ])

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    const selectedStr = window.getSelection()?.toString().trim() || ''
    const items: ContextMenuItem[] = []

    if (selectedStr) {
      items.push(
        {
          id: 'copy',
          label: 'Copy Text',
          shortcut: 'Ctrl+C',
          onClick: () => navigator.clipboard.writeText(selectedStr)
        },
        { id: 'div-copy', divider: true }
      )
    }

    items.push(
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
      { id: 'div-zoom', divider: true },
      {
        id: 'zoom-in',
        label: 'Zoom In',
        icon: <ZoomIn className="w-3.5 h-3.5" />,
        onClick: () => setZoom((z) => Math.min(3.0, Number((z + 0.15).toFixed(2))))
      },
      {
        id: 'zoom-out',
        label: 'Zoom Out',
        icon: <ZoomOut className="w-3.5 h-3.5" />,
        onClick: () => setZoom((z) => Math.max(0.5, Number((z - 0.15).toFixed(2))))
      },
      { id: 'div-reflow', divider: true },
      {
        id: 'reflow',
        label: 'View as EPUB',
        icon: <FileCode2 className="w-3.5 h-3.5 text-[#2a69df]" />,
        onClick: () => onActivateReflow()
      },
      {
        id: 'bookmark',
        label: isCurrentPdfPageBookmarked
          ? `Remove Bookmark (p.${currentPage})`
          : `Bookmark Page ${currentPage}`,
        shortcut: 'Ctrl+B',
        icon: <Bookmark className={`w-3.5 h-3.5 text-[#2a69df] ${isCurrentPdfPageBookmarked ? 'fill-current' : ''}`} />,
        onClick: () => {
          handleTogglePdfBookmark()
        }
      },
      { id: 'div-fs', divider: true },
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
    )

    setContextMenu({ x: e.clientX, y: e.clientY, items })
  }

  const handleExitFullscreen = () => {
    setImmersiveFullscreen(false)
    if (window.desktopAPI?.setFullscreen) {
      window.desktopAPI.setFullscreen(false)
    } else if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {})
    }
  }

  // Handle PDF text selection across the rendered text layer
  const handlePdfTextSelection = useCallback(() => {
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed) return
    const text = sel.toString().trim()
    if (!text) {
      setSelectedPdfText(null)
      return
    }
    try {
      const range = sel.getRangeAt(0)
      const rect = range.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) {
        setSelectedPdfText(text)
        setSelectionPos({
          x: rect.left + rect.width / 2,
          y: rect.top
        })
        const isRight = Boolean(textLayerRightRef.current?.contains(range.commonAncestorContainer))
        setSelectedPageNum(isRight ? currentPage + 1 : currentPage)
      }
    } catch {
      // Range calculation fallback
    }
  }, [currentPage])

  const handleAddPdfHighlight = async (color: NoteColor) => {
    if (!book.id || !selectedPdfText) return
    const record: Annotation = {
      bookId: book.id,
      cfiRange: String(selectedPageNum),
      text: selectedPdfText,
      note: '',
      color,
      pageNumber: selectedPageNum,
      createdAt: Date.now()
    }
    await db.annotations.add(record)
    window.getSelection()?.removeAllRanges()
    setSelectedPdfText(null)
    await syncBookNotesCount(book.id)
    bumpAnnotationsVersion()
  }

  const handleAddPdfNote = async (noteText: string, color: NoteColor) => {
    if (!book.id || !selectedPdfText) return
    const record: Annotation = {
      bookId: book.id,
      cfiRange: String(selectedPageNum),
      text: selectedPdfText,
      note: noteText,
      color,
      pageNumber: selectedPageNum,
      createdAt: Date.now()
    }
    await db.annotations.add(record)
    window.getSelection()?.removeAllRanges()
    setSelectedPdfText(null)
    await syncBookNotesCount(book.id)
    bumpAnnotationsVersion()
  }

  const handleUpdatePdfAnnotation = async (id: number, updates: { color?: NoteColor; note?: string }) => {
    await db.annotations.update(id, { ...updates, updatedAt: Date.now() })
    if (activeAnnotation?.annotation.id === id) {
      setActiveAnnotation((prev) =>
        prev
          ? {
              ...prev,
              annotation: {
                ...prev.annotation,
                ...updates,
                updatedAt: Date.now()
              }
            }
          : null
      )
    }
    bumpAnnotationsVersion()
  }

  const handleDeletePdfAnnotation = async (ann: Annotation) => {
    if (ann.id) {
      await db.annotations.delete(ann.id)
      if (book.id) await syncBookNotesCount(book.id)
      bumpAnnotationsVersion()
    }
  }

  return (
    <div
      style={{ backgroundColor: currentTheme.bg }}
      className="flex-1 flex flex-col h-full relative overflow-hidden select-none transition-colors duration-200"
    >
      {/* Top Docked Header (hidden in immersive fullscreen) */}
      {!isImmersiveFullscreen && (
        <ReaderTopBar
          onBack={onBack}
          currentChapter={activePdfChapterLabel}
          isCurrentPageBookmarked={isCurrentPdfPageBookmarked}
        />
      )}

      {/* Floating Exit Fullscreen Control */}
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

      {/* Main PDF Scroll / Page Viewport */}
      <SideNavigation
        onPrev={handlePrev}
        onNext={handleNext}
        isLeftDisabled={currentPage <= 1}
        isRightDisabled={isDual ? currentPage + 1 >= totalPages : currentPage >= totalPages}
        hidden={
          isImmersiveFullscreen ||
          isSettingsDrawerOpen ||
          isNotesDrawerOpen ||
          isBookmarksDrawerOpen ||
          isSearchDrawerOpen ||
          isTOCDrawerOpen
        }
      />
      <div
        ref={viewportRef}
        onContextMenu={handleContextMenu}
        onMouseUp={handlePdfTextSelection}
        className="flex-1 relative overflow-auto flex items-start justify-center p-6 scroll-smooth"
      >
        {loadError ? (
          <div className="my-auto text-center max-w-md bg-[#171a21] border border-[#2d323f] p-5 rounded-[2px]">
            <p className="text-sm font-semibold text-white mb-1">Could not render PDF</p>
            <p className="text-xs text-[#8b949e] mb-4">{loadError}</p>
            <button onClick={onBack} className="ice-btn-blue h-8 px-4 text-xs">
              Back to Library
            </button>
          </div>
        ) : (
          <div className="flex items-start justify-center gap-4 my-auto">
            {/* Primary PDF Page */}
            <div
              className="relative shadow-2xl bg-white"
              style={{ filter: currentTheme.pageFilter }}
            >
              <canvas ref={canvasLeftRef} className="block" />
              <div
                ref={textLayerLeftRef}
                className="absolute inset-0 overflow-hidden select-text"
              />
            </div>

            {/* Second Page for Dual Page Layout */}
            {isDual && currentPage + 1 <= totalPages && (
              <div
                className="relative shadow-2xl bg-white"
                style={{ filter: currentTheme.pageFilter }}
              >
                <canvas ref={canvasRightRef} className="block" />
                <div
                  ref={textLayerRightRef}
                  className="absolute inset-0 overflow-hidden select-text"
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Draggable & Minimizable Reader Audio HUD for Read Aloud */}
      <ReaderAudioHUD
        isTTSActive={isTTSActive}
        isTTSMuted={isTTSMuted}
        currentChapter={activePdfChapterLabel}
        ttsSpeed={settings.ttsSpeed}
        onTogglePlay={() => {
          const st = useAppStore.getState()
          if (st.isTTSActive) {
            if (st.isTTSMuted) {
              ttsService.resume()
              st.setTTSMuted(false)
            } else {
              ttsService.pause()
              st.setTTSMuted(true)
            }
          }
        }}
        onStop={() => {
          ttsService.stop()
          const st = useAppStore.getState()
          st.setTTSActive(false)
          st.setTTSMuted(false)
        }}
      />

      {/* Auto-Scroll Dwell-Timer Overlay for PDF */}
      <AdaptiveScrollOverlay
        isActive={isAutoscrollActive}
        onClose={() => setAutoscrollActive(false)}
      />

      {/* Subtle Persistent Liquid Climax Progress Bar (hidden in immersive fullscreen or when toggled off in settings) */}
      {!isImmersiveFullscreen && settings.showProgressBar !== false && (
        <FluidClimaxProgressBar
          progressPercent={pdfProgressPercent}
          currentPage={currentPage}
          totalPages={totalPages}
          book={book}
          theme={settings.theme}
          isImmersiveFullscreen={isImmersiveFullscreen}
          climaxTarget={climaxTarget}
          isSaberGlowing={climaxEffect === 'bar-saber'}
          onSaberGlowEnd={stopClimaxEffect}
          onSeek={(val) => {
            const targetPage =
              totalPages <= 1
                ? 1
                : val <= 0
                ? 1
                : val >= 100
                ? totalPages
                : Math.max(1, Math.min(totalPages, Math.round((val / 100) * (totalPages - 1)) + 1))
            setCurrentPage(targetPage)
            viewportRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
          }}
        />
      )}

      {/* Subtle Theme-Adaptive Fullscreen Climax Crimson Wave (3 sweeps, stops immediately on exit) */}
      <FullscreenClimaxWaveOverlay
        active={climaxEffect === 'fullscreen-wave'}
        isImmersiveFullscreen={isImmersiveFullscreen}
        theme={settings.theme}
        onComplete={stopClimaxEffect}
      />

      {/* Drawers */}
      <TOCDrawer
        toc={toc}
        currentHref={String(currentPage)}
        activeTocId={activePdfTocItem?.id || ''}
        onSelectChapter={(href, item) => {
          const p = item?.pageNumber ?? parseInt(href, 10)
          if (!Number.isNaN(p) && p >= 1 && p <= totalPages) {
            setCurrentPage(p)
            viewportRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
          }
        }}
      />
      <NotesDrawer
        onJumpToCfi={(_cfi, pageNumber) => {
          if (pageNumber && pageNumber >= 1 && pageNumber <= totalPages) setCurrentPage(pageNumber)
        }}
        onDeleteAnnotation={async (ann: Annotation) => {
          if (ann.id) await db.annotations.delete(ann.id)
          if (book.id) await syncBookNotesCount(book.id)
          bumpAnnotationsVersion()
        }}
        onUpdateAnnotation={async (id: number, updates: { color?: NoteColor; note?: string }) => {
          await db.annotations.update(id, { ...updates, updatedAt: Date.now() })
          bumpAnnotationsVersion()
        }}
        onClearAllAnnotations={async () => {
          if (book.id) {
            await db.annotations.where('bookId').equals(book.id).delete()
            await syncBookNotesCount(book.id)
            bumpAnnotationsVersion()
          }
        }}
      />
      <BookmarksDrawer
        currentPage={currentPage}
        currentCfi={String(currentPage)}
        isCurrentPageBookmarked={isCurrentPdfPageBookmarked}
        onToggleCurrentBookmark={handleTogglePdfBookmark}
        onJumpToCfi={(cfi, pageNumber) => {
          const p = pageNumber || parseInt(cfi, 10)
          if (!Number.isNaN(p) && p >= 1 && p <= totalPages) setCurrentPage(p)
        }}
        onDeleteBookmark={async (id) => {
          await db.bookmarks.delete(id)
          bumpBookmarksVersion()
        }}
        onRenameBookmark={async (id, label) => {
          await db.bookmarks.update(id, { label })
          bumpBookmarksVersion()
        }}
        onClearAllBookmarks={async () => {
          if (book.id) {
            await db.bookmarks.where('bookId').equals(book.id).delete()
            bumpBookmarksVersion()
          }
        }}
      />
      <SettingsDrawer />

      {/* Offline Reflow Conversion Progress Overlay */}
      {isConvertingPdf && (
        <div className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-[1px] flex items-center justify-center">
          <div className="w-80 bg-[#171a21] border border-[#2d323f] rounded-lg p-4 shadow-2xl space-y-2.5">
            <div className="flex items-center justify-between text-xs font-semibold text-white">
              <span>Reflowing PDF to EPUB (Offline)</span>
              <span className="font-mono text-[#2a69df]">{pdfConvertProgress?.percent ?? 0}%</span>
            </div>
            <div className="w-full h-1.5 bg-[#232732] rounded overflow-hidden">
              <div
                className="h-full bg-[#2a69df] transition-all duration-150"
                style={{ width: `${pdfConvertProgress?.percent ?? 5}%` }}
              />
            </div>
            <p className="text-[11px] text-[#8b949e] truncate">
              {pdfConvertProgress?.stage || 'Initializing MuPDF structured text engine...'}
            </p>
          </div>
        </div>
      )}

      {/* Clicked Highlight Popover */}
      {activeAnnotation && (
        <AnnotationPopover
          annotation={activeAnnotation.annotation}
          position={activeAnnotation.position}
          onClose={() => setActiveAnnotation(null)}
          onUpdate={handleUpdatePdfAnnotation}
          onDelete={handleDeletePdfAnnotation}
        />
      )}

      {/* Chrome PDF-Grade Floating Selection & Annotation Pill */}
      {selectedPdfText && (
        <SelectionPopup
          selectedText={selectedPdfText}
          position={selectionPos}
          onClose={() => {
            setSelectedPdfText(null)
            window.getSelection()?.removeAllRanges()
          }}
          onHighlight={handleAddPdfHighlight}
          onAddNote={handleAddPdfNote}
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

export const PdfReaderView = React.memo<PdfReaderViewProps>(
  PdfReaderViewBase,
  (prev, next) =>
    prev.book.id === next.book.id &&
    prev.book.filePath === next.book.filePath &&
    prev.book.format === next.book.format
)
