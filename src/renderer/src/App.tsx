import React, { useEffect, useState, useCallback } from 'react'
import { FileUp } from 'lucide-react'
import { applyDocumentTheme, useAppStore } from './stores/useAppStore'
import { db } from './db'
import { TitleBar } from './components/ui/TitleBar'
import { LibraryView } from './components/library/LibraryView'
import { EpubReaderView } from './components/reader/EpubReaderView'
import { PdfReaderView } from './components/reader/PdfReaderView'
import { HelpModal } from './components/ui/HelpModal'
import { AboutModal } from './components/ui/AboutModal'
import { FullSettingsModal } from './components/modals/FullSettingsModal'
import { NativeFeedbackHost } from './components/ui/NativeFeedbackHost'
import { getWarmFilterOverlay } from './services/colorTempService'
import { extractBookMetadata } from './services/coverService'
import { hydrateDownloadedFonts } from './services/fontManager'
import { ttsService } from './services/ttsService'

// Bundled authentic assets
import fifthSeasonCover from './assets/covers/the_fifth_season.jpg'
import fifthSeasonEpub from './assets/books/the_fifth_season.epub'

export const App: React.FC = () => {
  const {
    currentView,
    activeBook,
    currentChapterTitle,
    pdfViewMode,
    reflowEpubBuffer,
    isImmersiveFullscreen,
    settings,
    setView,
    setActiveBook,
    setPdfViewMode,
    setReflowEpubBuffer,
    setPdfConversionState,
    setImmersiveFullscreen,
    toggleHelpModal,
    hydrateSettingsFromDb,
    updateSettings,
    setPdfZoom,
    showToast,
    bumpLibraryVersion,
    setIsOnline
  } = useAppStore()

  const [isDraggingFile, setIsDraggingFile] = useState(false)

  // Hydrate persisted user settings, downloaded offline fonts, and connectivity listeners
  useEffect(() => {
    hydrateSettingsFromDb()
    hydrateDownloadedFonts()
  }, [hydrateSettingsFromDb])

  useEffect(() => {
    const syncOnline = () => setIsOnline(navigator.onLine)
    window.addEventListener('online', syncOnline)
    window.addEventListener('offline', syncOnline)
    return () => {
      window.removeEventListener('online', syncOnline)
      window.removeEventListener('offline', syncOnline)
    }
  }, [setIsOnline])

  useEffect(() => {
    applyDocumentTheme(settings.theme)
  }, [settings.theme])

  // Sync native OS Taskbar / Alt+Tab window title dynamically
  useEffect(() => {
    const osTitle =
      currentView === 'reader' && activeBook
        ? `${activeBook.title}${currentChapterTitle ? ` — ${currentChapterTitle}` : ''} — Semply`
        : 'Semply Ebook Reader'
    document.title = osTitle
    window.desktopAPI?.setWindowTitle?.(osTitle)
  }, [currentView, activeBook, currentChapterTitle])

  // Open an external .epub or .pdf path (from Explorer double-click, Ctrl+O, or window drop)
  const openLocalBookPath = useCallback(
    async (filePath: string) => {
      try {
        if (!window.desktopAPI?.readFileBuffer) return
        const ext = filePath.split('.').pop()?.toLowerCase() || ''
        if (ext !== 'epub' && ext !== 'pdf') {
          showToast('Only EPUB and PDF files can be opened.', 'error')
          return
        }
        const buffer = await window.desktopAPI.readFileBuffer(filePath)
        let book = await db.books.where('filePath').equals(filePath).first()
        if (!book) {
          const filename = filePath.split(/[\\/]/).pop() || 'Book'
          const meta = await extractBookMetadata(buffer, ext, filename)
          const id = await db.books.add({
            filePath,
            title: meta.title,
            author: meta.author,
            coverDataUrl: meta.coverDataUrl,
            format: ext as 'epub' | 'pdf',
            fileSize: buffer.byteLength,
            addedAt: Date.now(),
            lastOpenedAt: Date.now(),
            progressCfi: null,
            progressPercent: 0,
            currentPage: 1,
            totalPages: meta.totalPages || 1,
            categoryId: null,
            isFavorite: false,
            isRead: false,
            isPinned: false,
            pinnedAt: null
          })
          book = await db.books.get(id)
          bumpLibraryVersion()
        } else if (book.id) {
          await db.books.update(book.id, { lastOpenedAt: Date.now() })
        }
        if (book) {
          setActiveBook(book, buffer)
          setView('reader')
        }
      } catch (err: any) {
        showToast(err?.message || 'Could not open file.', 'error')
      }
    },
    [setActiveBook, setView, showToast, bumpLibraryVersion]
  )

  // Seed authentic starter library matching screen recording
  useEffect(() => {
    async function seedDefaults() {
      // Purge any old pre-seeded default categories from database
      await db.categories.where('name').anyOf(['Favorites', 'Sci-Fi & Fantasy', 'Science & Tech', 'Classics']).delete()

      const count = await db.books.count()
      if (count === 0) {
        // Pre-seed The Fifth Season matching the video
        await db.books.add({
          filePath: fifthSeasonEpub,
          title: 'The Fifth Season',
          author: 'N. K. Jemisin',
          coverDataUrl: fifthSeasonCover,
          format: 'epub',
          fileSize: 3200797,
          addedAt: Date.now(),
          lastOpenedAt: Date.now(),
          progressCfi: null,
          progressPercent: 3,
          currentPage: 13,
          totalPages: 416,
          categoryId: null,
          isFavorite: false,
          isRead: false,
          isPinned: false,
          pinnedAt: null
        })
      }
    }
    seedDefaults()
  }, [])

  // Sync OS fullscreen, PDF progress, content-only zoom, and external Explorer file-open events
  useEffect(() => {
    const unsubFs = window.desktopAPI?.onFullscreenChange?.((fs) => {
      setImmersiveFullscreen(fs)
    })
    const unsubPdf = window.desktopAPI?.onPdfConvertProgress?.((prog) => {
      setPdfConversionState(prog.percent < 100, { percent: prog.percent, stage: prog.stage })
    })
    const unsubOpen = window.desktopAPI?.onOpenExternalFile?.((filePath) => {
      openLocalBookPath(filePath)
    })
    const unsubZoom = window.desktopAPI?.onContentZoom?.((dir) => {
      const state = useAppStore.getState()
      if (state.currentView !== 'reader' || !state.activeBook) return
      if (state.activeBook.format === 'pdf' && state.pdfViewMode === 'original') {
        const nextZoom =
          dir === 'reset'
            ? 1.2
            : dir === 'in'
            ? Math.min(3.0, Number((state.pdfZoom + 0.15).toFixed(2)))
            : Math.max(0.5, Number((state.pdfZoom - 0.15).toFixed(2)))
        setPdfZoom(nextZoom)
        showToast(`Page zoom: ${Math.round(nextZoom * 100)}%`, 'info')
      } else {
        const nextSize =
          dir === 'reset'
            ? 21
            : dir === 'in'
            ? Math.min(42, state.settings.fontSize + 2)
            : Math.max(12, state.settings.fontSize - 2)
        updateSettings({ fontSize: nextSize })
        showToast(`Text size: ${nextSize}px`, 'info')
      }
    })
    return () => {
      unsubFs?.()
      unsubPdf?.()
      unsubOpen?.()
      unsubZoom?.()
    }
  }, [setImmersiveFullscreen, setPdfConversionState, openLocalBookPath, setPdfZoom, updateSettings, showToast])

  // Global hotkeys & desktop ergonomics (block middle-click browser scroll circle + add Ctrl+O Open Book)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Control' || e.key === 'F5') {
        e.preventDefault()
        return
      }
      if (e.key === 'F1') {
        e.preventDefault()
        toggleHelpModal()
      } else if (e.key === 'F7') {
        // Toggle TTS Play / Pause
        e.preventDefault()
        const state = useAppStore.getState()
        if (state.currentView === 'reader' && state.activeBook) {
          if (state.isTTSActive) {
            if (state.isTTSMuted) {
              state.setTTSMuted(false)
              ttsService.resume()
            } else {
              state.setTTSMuted(true)
              ttsService.pause()
            }
          } else {
            state.setTTSActive(true)
            state.setTTSMuted(false)
            const readerIframe = document.querySelector('iframe')
            const text =
              readerIframe?.contentDocument?.body?.innerText || state.activeBook.title || 'Reading'
            ttsService.speak(text, {
              rate: state.settings.ttsSpeed,
              pitch: state.settings.ttsPitch,
              voiceURI: state.settings.ttsVoice,
              onEnd: () => {
                state.setTTSActive(false)
                state.setTTSMuted(false)
              }
            })
          }
        }
      } else if (e.key === 'F8') {
        // Stop TTS
        e.preventDefault()
        const state = useAppStore.getState()
        if (state.isTTSActive) {
          ttsService.stop()
          state.setTTSActive(false)
          state.setTTSMuted(false)
        }
      } else if (e.key === 'F9') {
        e.preventDefault()
        const themes: Array<'day' | 'light-sepia' | 'dark-sepia' | 'night'> = [
          'day',
          'light-sepia',
          'dark-sepia',
          'night'
        ]
        const cur = useAppStore.getState().settings.theme
        const next = themes[(themes.indexOf(cur) + 1) % themes.length]
        updateSettings({ theme: next })
      } else if (e.key === 'F11') {
        e.preventDefault()
        const next = !useAppStore.getState().isImmersiveFullscreen
        setImmersiveFullscreen(next)
        window.desktopAPI?.setFullscreen?.(next)
      } else if (e.key === 'Escape') {
        const isFs = useAppStore.getState().isImmersiveFullscreen || Boolean(document.fullscreenElement)
        if (isFs) {
          e.preventDefault()
          setImmersiveFullscreen(false)
          window.desktopAPI?.setFullscreen?.(false)
          if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {})
          }
        }
      } else if (e.ctrlKey || e.metaKey) {
        const k = e.key.toLowerCase()
        if (k === 'o') {
          e.preventDefault()
          window.desktopAPI?.openFiles?.().then((paths) => {
            if (paths && paths.length > 0) openLocalBookPath(paths[0])
          })
          return
        }
        if (
          k === 'r' ||
          k === 'w' ||
          k === '0' ||
          k === '=' ||
          k === '+' ||
          k === '-' ||
          k === '_' ||
          e.code === 'Equal' ||
          e.code === 'Minus' ||
          e.code === 'Digit0' ||
          e.code === 'NumpadAdd' ||
          e.code === 'NumpadSubtract' ||
          e.code === 'Numpad0'
        ) {
          e.preventDefault()
        }
      }
    }

    // Block Chromium native Ctrl+Wheel browser zoom and middle-click 4-way scroll circle
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
      }
    }
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 1) {
        e.preventDefault()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('wheel', handleWheel, { passive: false })
    window.addEventListener('mousedown', handleMouseDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('wheel', handleWheel)
      window.removeEventListener('mousedown', handleMouseDown)
    }
  }, [toggleHelpModal, setImmersiveFullscreen, openLocalBookPath, updateSettings])

  const handleActivatePdfReflow = async () => {
    if (!activeBook || activeBook.format !== 'pdf') return
    if (reflowEpubBuffer) {
      setPdfViewMode('reflow')
      return
    }
    if (!window.desktopAPI?.convertToEpub || !window.desktopAPI?.readFileBuffer) return
    setPdfConversionState(true, { percent: 5, stage: 'Reflowing PDF with MuPDF engine...' })
    try {
      const res = await window.desktopAPI.convertToEpub({
        pdfPath: activeBook.filePath,
        mode: 'reflow-cache'
      })
      if (res.success && res.epubPath) {
        const epubBuf = await window.desktopAPI.readFileBuffer(res.epubPath)
        setReflowEpubBuffer(epubBuf)
        setPdfViewMode('reflow')
        showToast('Switched to Reflow mode', 'success')
      } else {
        showToast(res.error || 'Could not reflow PDF.', 'error')
      }
    } catch (err: any) {
      showToast(err?.message || 'PDF reflow failed.', 'error')
    } finally {
      setPdfConversionState(false, null)
    }
  }

  const handleExportPdfAsEpub = async () => {
    if (!activeBook || activeBook.format !== 'pdf') return
    if (!window.desktopAPI?.showSaveDialog || !window.desktopAPI?.convertToEpub) return
    const safeName = activeBook.title.replace(/[^a-z0-9 _-]/gi, '').trim() || 'Converted_Book'
    const chosenPath = await window.desktopAPI.showSaveDialog({
      title: 'Export PDF as Offline EPUB',
      defaultPath: `${safeName}.epub`,
      filters: [{ name: 'EPUB eBook', extensions: ['epub'] }]
    })
    if (!chosenPath) return

    setPdfConversionState(true, { percent: 5, stage: 'Converting PDF to EPUB...' })
    try {
      const res = await window.desktopAPI.convertToEpub({
        pdfPath: activeBook.filePath,
        outputPath: chosenPath,
        mode: 'export'
      })
      if (res.success) {
        showToast('Exported EPUB successfully', 'success')
      } else {
        showToast(res.error || 'PDF to EPUB export failed.', 'error')
      }
    } finally {
      setPdfConversionState(false, null)
    }
  }

  const handleBackToLibrary = () => {
    if (isImmersiveFullscreen) {
      setImmersiveFullscreen(false)
      window.desktopAPI?.setFullscreen?.(false)
    }
    setActiveBook(null)
    setView('library')
  }

  const hideTitleBar = isImmersiveFullscreen && currentView === 'reader' && !!activeBook
  const warmFilter = getWarmFilterOverlay(
    settings.warmFilterEnabled || false,
    settings.warmFilterTemp || 3200,
    settings.warmFilterIntensity || 40
  )

  const handleWindowDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    if (e.dataTransfer.types.includes('Files') && !isDraggingFile) {
      setIsDraggingFile(true)
    }
  }

  const handleWindowDragLeave = (e: React.DragEvent) => {
    if (e.currentTarget === e.target || e.clientX <= 0 || e.clientY <= 0 || e.clientX >= window.innerWidth || e.clientY >= window.innerHeight) {
      setIsDraggingFile(false)
    }
  }

  const handleWindowDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDraggingFile(false)
    const files = Array.from(e.dataTransfer.files || [])
    if (files.length === 0) return

    const state = useAppStore.getState()
    const inLibrary = state.currentView === 'library' || !state.activeBook

    if (!inLibrary) {
      // Dropped while reading: immediately import & open the dropped book
      const firstPath = (files[0] as any).path as string | undefined
      if (firstPath) {
        await openLocalBookPath(firstPath)
      }
      return
    }

    // Dropped while in Library: batch-import all dropped files cleanly with deduplication
    const numericCatId = /^\d+$/.test(state.selectedCategory) ? Number(state.selectedCategory) : null
    let importedCount = 0
    for (const file of files) {
      const ext = file.name.split('.').pop()?.toLowerCase() || ''
      if (ext !== 'epub' && ext !== 'pdf' && ext !== 'mobi' && ext !== 'txt') continue
      const filePath = ((file as any).path as string | undefined) || file.name
      const existing = await db.books.where('filePath').equals(filePath).first()
      if (existing) {
        if (existing.id && numericCatId !== null && existing.categoryId !== numericCatId) {
          await db.books.update(existing.id, {
            categoryId: numericCatId
          })
          importedCount++
        }
        continue
      }
      const buffer = await file.arrayBuffer()
      const rawName = file.name.replace(/\.[^/.]+$/, '')
      const meta = await extractBookMetadata(buffer, ext, rawName)
      await db.books.add({
        filePath,
        title: meta.title,
        author: meta.author,
        coverDataUrl: meta.coverDataUrl,
        format: (ext === 'pdf' ? 'pdf' : ext === 'mobi' ? 'mobi' : ext === 'txt' ? 'txt' : 'epub') as any,
        fileSize: file.size,
        addedAt: Date.now(),
        lastOpenedAt: null,
        progressCfi: null,
        progressPercent: 0,
        currentPage: 1,
        totalPages: meta.totalPages || 1,
        categoryId: numericCatId,
        isFavorite: false,
        isRead: false
      })
      importedCount++
    }
    if (importedCount > 0) {
      bumpLibraryVersion()
      showToast(`Imported ${importedCount} ${importedCount === 1 ? 'book' : 'books'}`, 'success')
    } else {
      showToast('No new supported books found in drop.', 'info')
    }
  }

  return (
    <div
      onDragOver={handleWindowDragOver}
      onDragLeave={handleWindowDragLeave}
      onDrop={handleWindowDrop}
      className="flex flex-col h-screen w-screen overflow-hidden bg-[#0a0a0a] text-[#ededed] font-sans select-none transition-colors duration-200 relative"
    >
      {!hideTitleBar && <TitleBar />}

      <main className="flex-1 flex overflow-hidden">
        {currentView === 'library' || !activeBook ? (
          <LibraryView />
        ) : activeBook.format === 'pdf' && pdfViewMode === 'original' ? (
          <PdfReaderView
            book={activeBook}
            onBack={handleBackToLibrary}
            onActivateReflow={handleActivatePdfReflow}
            onExportEpub={handleExportPdfAsEpub}
          />
        ) : (
          <EpubReaderView
            book={activeBook}
            onBack={handleBackToLibrary}
          />
        )}
      </main>

      <HelpModal />
      <AboutModal />
      <FullSettingsModal />
      <NativeFeedbackHost />

      {/* Full-Window Native File Drag-and-Drop Overlay */}
      {isDraggingFile && (
        <div className="fixed inset-0 z-[110] bg-black/75 backdrop-blur-sm flex items-center justify-center pointer-events-none">
          <div className="px-8 py-6 rounded-xl bg-[#111111] border border-white/20 shadow-2xl flex flex-col items-center gap-2.5 text-center">
            <div className="w-11 h-11 rounded-lg bg-[#1a1a1a] border border-white/10 flex items-center justify-center text-white">
              <FileUp className="w-5 h-5" />
            </div>
            <div className="text-[14px] font-semibold text-white">Drop EPUB or PDF to open</div>
            <div className="text-[11px] text-[#888888]">Imported offline into your Semply library</div>
          </div>
        </div>
      )}

      {/* App-Wide Dimming Overlay */}
      {settings.dimming > 0 && (
        <div
          style={{ opacity: settings.dimming / 100 }}
          className="fixed inset-0 bg-black pointer-events-none z-[95] transition-opacity duration-200"
        />
      )}

      {/* App-Wide Warm Blue Light Night Filter Overlay */}
      {warmFilter && (
        <div
          style={{
            backgroundColor: warmFilter.backgroundColor,
            opacity: warmFilter.opacity
          }}
          className="fixed inset-0 pointer-events-none z-[95] transition-opacity duration-300 mix-blend-multiply"
        />
      )}
    </div>
  )
}

export default App
