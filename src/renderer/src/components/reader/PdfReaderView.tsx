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
  Settings,
  Download
} from 'lucide-react'
import { useAppStore } from '../../stores/useAppStore'
import { db, type Annotation, type Book, type Bookmark as BookmarkItem, type NoteColor } from '../../db'
import { ReaderTopBar } from './ReaderTopBar'
import { TOCDrawer, type TocItem } from '../drawers/TOCDrawer'
import { NotesDrawer } from '../drawers/NotesDrawer'
import { BookmarksDrawer } from '../drawers/BookmarksDrawer'
import { SettingsDrawer } from '../drawers/SettingsDrawer'
import { ContextMenu, type ContextMenuItem } from '../ui/ContextMenu'
import { syncBookNotesCount } from '../../services/annotationService'
import { FluidClimaxProgressBar } from './FluidClimaxProgressBar'

// Ensure pdfjs worker is properly configured for Electron Vite renderer
if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString()
}

interface PdfReaderViewProps {
  book: Book
  onBack: () => void
  onActivateReflow: () => Promise<void>
  onExportEpub: () => Promise<void>
}

export const PdfReaderView: React.FC<PdfReaderViewProps> = ({
  book,
  onBack,
  onActivateReflow,
  onExportEpub
}) => {
  const {
    settings,
    activeBookBuffer,
    setCurrentChapterTitle,
    isImmersiveFullscreen,
    setImmersiveFullscreen,
    toggleSettingsDrawer,
    isConvertingPdf,
    pdfConvertProgress,
    bookmarksVersion,
    bumpAnnotationsVersion,
    bumpBookmarksVersion,
    pdfZoom: zoom,
    setPdfZoom
  } = useAppStore()

  const setZoom = (updater: number | ((z: number) => number)) => {
    const next = typeof updater === 'function' ? updater(useAppStore.getState().pdfZoom) : updater
    setPdfZoom(next)
  }

  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null)
  const [currentPage, setCurrentPage] = useState<number>(Math.max(1, book.currentPage || 1))
  const [totalPages, setTotalPages] = useState<number>(Math.max(1, book.totalPages || 1))
  const [pdfBookmarks, setPdfBookmarks] = useState<BookmarkItem[]>([])

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

  const handleTogglePdfBookmark = async () => {
    if (!book.id) return
    const existing = pdfBookmarks.find((bm) => bm.pageNumber === currentPage)
    if (existing?.id) {
      await db.bookmarks.delete(existing.id)
    } else {
      await db.bookmarks.add({
        bookId: book.id,
        cfi: String(currentPage),
        label: `Page ${currentPage}`,
        pageNumber: currentPage,
        progressPercent: totalPages > 0 ? Math.round((currentPage / totalPages) * 100) : 0,
        createdAt: Date.now()
      })
    }
    bumpBookmarksVersion()
  }
  const [toc, setToc] = useState<TocItem[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; items: ContextMenuItem[] } | null>(null)

  const viewportRef = useRef<HTMLDivElement>(null)
  const canvasLeftRef = useRef<HTMLCanvasElement>(null)
  const canvasRightRef = useRef<HTMLCanvasElement>(null)
  const textLayerLeftRef = useRef<HTMLDivElement>(null)
  const renderTaskLeftRef = useRef<any>(null)
  const renderTaskRightRef = useRef<any>(null)

  const themeStyles = {
    day: { bg: '#e9ecf0', pageFilter: 'none' },
    night: { bg: '#171a21', pageFilter: 'invert(0.88) hue-rotate(180deg) contrast(0.95)' },
    'light-sepia': { bg: '#f4e6cb', pageFilter: 'sepia(0.28) brightness(0.98)' },
    'dark-sepia': { bg: '#241e18', pageFilter: 'invert(0.86) sepia(0.35) hue-rotate(180deg) contrast(0.92)' }
  }
  const currentTheme = themeStyles[settings.theme] || themeStyles.night

  // Load PDF document
  useEffect(() => {
    let cancelled = false
    let loadedDoc: pdfjsLib.PDFDocumentProxy | null = null

    async function loadPdf() {
      setLoadError(null)
      try {
        let data: Uint8Array
        if (activeBookBuffer) {
          // Copy buffer so pdfjs worker transfer never detaches store buffer
          data = new Uint8Array(activeBookBuffer.slice(0))
        } else if (window.desktopAPI?.readFileBuffer) {
          const buf = await window.desktopAPI.readFileBuffer(book.filePath)
          data = new Uint8Array(buf)
        } else {
          const resp = await fetch(book.filePath)
          data = new Uint8Array(await resp.arrayBuffer())
        }

        const task = pdfjsLib.getDocument({ data })
        loadedDoc = await task.promise
        if (cancelled) {
          loadedDoc.destroy()
          return
        }

        setPdfDoc(loadedDoc)
        setTotalPages(loadedDoc.numPages)
        setCurrentChapterTitle(`PDF (${loadedDoc.numPages} pages)`)

        // Extract native PDF outline for TOC drawer
        try {
          const outline = await loadedDoc.getOutline()
          if (outline && outline.length > 0 && !cancelled) {
            const mapped: TocItem[] = []
            for (let i = 0; i < outline.length; i++) {
              const item = outline[i]
              let pageNum = 1
              try {
                let dest = item.dest
                if (typeof dest === 'string') {
                  dest = await loadedDoc.getDestination(dest)
                }
                if (Array.isArray(dest) && dest[0]) {
                  const idx = await loadedDoc.getPageIndex(dest[0])
                  pageNum = idx + 1
                }
              } catch {
                // keep default page 1
              }
              mapped.push({
                id: `pdf-toc-${i}`,
                label: item.title || `Section ${i + 1}`,
                href: String(pageNum),
                pageNumber: pageNum
              })
            }
            setToc(mapped)
          }
        } catch {
          setToc([])
        }

        if (book.id && loadedDoc.numPages !== book.totalPages) {
          db.books.update(book.id, { totalPages: loadedDoc.numPages })
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
  }, [book, activeBookBuffer, setCurrentChapterTitle])

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
      if (!canvas || pageNum < 1 || pageNum > pdfDoc.numPages) {
        if (canvas) {
          const ctx = canvas.getContext('2d')
          ctx?.clearRect(0, 0, canvas.width, canvas.height)
          canvas.width = 0
          canvas.height = 0
        }
        return
      }

      if (taskRef.current) {
        try {
          taskRef.current.cancel()
        } catch {
          // ignore cancellation race
        }
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
            textLayerDiv.appendChild(span)
          }
        } catch {
          // text layer optional for scanned PDFs
        }
      }
    }

    const isDouble = settings.pageSpread === 'double'
    renderSingleCanvas(currentPage, canvasLeftRef.current, renderTaskLeftRef, textLayerLeftRef.current)
    if (isDouble) {
      renderSingleCanvas(currentPage + 1, canvasRightRef.current, renderTaskRightRef, null)
    }

    // Persist reading progress
    if (book.id && totalPages > 0) {
      const rawExact = (currentPage / totalPages) * 100
      let pct = 0
      if (currentPage > 1 || rawExact >= 1) {
        pct = Math.min(100, Math.max(1, Math.round(rawExact)))
      } else {
        pct = 0
      }
      const isFinished = totalPages > 1 && currentPage >= totalPages
      db.books.update(book.id, {
        currentPage,
        totalPages,
        progressPercent: isFinished ? 100 : pct,
        lastOpenedAt: Date.now(),
        ...(isFinished ? { isRead: true } : {})
      })
    }

    return () => {
      cancelled = true
    }
  }, [pdfDoc, currentPage, totalPages, zoom, settings.pageSpread, book.id])

  const step = settings.pageSpread === 'double' ? 2 : 1

  const handleNext = useCallback(() => {
    setCurrentPage((p) => Math.min(totalPages, p + step))
  }, [totalPages, step])

  const handlePrev = useCallback(() => {
    setCurrentPage((p) => Math.max(1, p - step))
  }, [step])

  // Keyboard navigation (responsive Up/Down smooth scroll + seamless edge page turning)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
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
      } else if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault()
        handleNext()
        viewportRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp' || e.key === 'Backspace') {
        e.preventDefault()
        handlePrev()
        viewportRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
      } else if (e.key === 'Home') {
        e.preventDefault()
        setCurrentPage(1)
      } else if (e.key === 'End') {
        e.preventDefault()
        setCurrentPage(totalPages)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleNext, handlePrev, totalPages])

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
        label: 'Switch to Reflow Mode (EPUB)',
        icon: <FileCode2 className="w-3.5 h-3.5 text-[#2a69df]" />,
        onClick: () => onActivateReflow()
      },
      {
        id: 'export-epub',
        label: 'Export as EPUB (Offline)...',
        icon: <Download className="w-3.5 h-3.5 text-[#4cd964]" />,
        onClick: () => onExportEpub()
      },
      {
        id: 'bookmark',
        label: `Bookmark Page ${currentPage}`,
        icon: <Bookmark className="w-3.5 h-3.5 text-[#2a69df]" />,
        onClick: async () => {
          if (!book.id) return
          await db.bookmarks.add({
            bookId: book.id,
            cfi: String(currentPage),
            label: `Page ${currentPage}`,
            pageNumber: currentPage,
            createdAt: Date.now()
          })
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

  return (
    <div
      style={{ backgroundColor: currentTheme.bg }}
      className="flex-1 flex flex-col h-full relative overflow-hidden select-none transition-colors duration-200"
    >
      {/* Top Docked Header (hidden in immersive fullscreen) */}
      {!isImmersiveFullscreen && (
        <ReaderTopBar onBack={onBack} currentChapter={`Page ${currentPage} / ${totalPages}`} />
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
      <div
        ref={viewportRef}
        onContextMenu={handleContextMenu}
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

            {/* Second Page for Double Page Spread */}
            {settings.pageSpread === 'double' && currentPage + 1 <= totalPages && (
              <div
                className="relative shadow-2xl bg-white"
                style={{ filter: currentTheme.pageFilter }}
              >
                <canvas ref={canvasRightRef} className="block" />
              </div>
            )}
          </div>
        )}

        {/* Side Navigation Arrows (hidden in immersive fullscreen) */}
        {!isImmersiveFullscreen && (
          <>
            <button
              onClick={handlePrev}
              disabled={currentPage <= 1}
              className="fixed left-2 top-1/2 -translate-y-1/2 z-30 w-8 h-12 rounded flex items-center justify-center bg-black/25 hover:bg-black/50 text-white/60 hover:text-white transition-opacity opacity-0 hover:opacity-100 disabled:pointer-events-none"
              title="Previous Page"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={handleNext}
              disabled={currentPage >= totalPages}
              className="fixed right-2 top-1/2 -translate-y-1/2 z-30 w-8 h-12 rounded flex items-center justify-center bg-black/25 hover:bg-black/50 text-white/60 hover:text-white transition-opacity opacity-0 hover:opacity-100 disabled:pointer-events-none"
              title="Next Page"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}
      </div>

      {/* Subtle Persistent Liquid Climax Progress Bar (hidden in immersive fullscreen) */}
      {!isImmersiveFullscreen && (
        <FluidClimaxProgressBar
          progressPercent={totalPages > 0 ? (currentPage / totalPages) * 100 : 0}
          currentPage={currentPage}
          totalPages={totalPages}
          book={book}
          theme={settings.theme}
          isImmersiveFullscreen={isImmersiveFullscreen}
          onSeek={(val) => {
            const targetPage = Math.max(1, Math.min(totalPages, Math.round((val / 100) * totalPages)))
            setCurrentPage(targetPage)
          }}
        />
      )}

      {/* Drawers */}
      <TOCDrawer
        toc={toc}
        currentHref={String(currentPage)}
        onSelectChapter={(href) => {
          const p = parseInt(href, 10)
          if (!Number.isNaN(p) && p >= 1 && p <= totalPages) setCurrentPage(p)
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
