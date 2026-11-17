import React, { useEffect } from 'react'
import { useAppStore } from './stores/useAppStore'
import { db } from './db'
import { TitleBar } from './components/ui/TitleBar'
import { LibraryView } from './components/library/LibraryView'
import { EpubReaderView } from './components/reader/EpubReaderView'
import { PdfReaderView } from './components/reader/PdfReaderView'
import { HelpModal } from './components/ui/HelpModal'
import { FullSettingsModal } from './components/modals/FullSettingsModal'

// Bundled authentic assets
import fifthSeasonCover from './assets/covers/the_fifth_season.jpg'
import fifthSeasonEpub from './assets/books/the_fifth_season.epub'

export const App: React.FC = () => {
  const {
    currentView,
    activeBook,
    pdfViewMode,
    reflowEpubBuffer,
    isImmersiveFullscreen,
    setView,
    setActiveBook,
    setPdfViewMode,
    setReflowEpubBuffer,
    setPdfConversionState,
    setImmersiveFullscreen,
    toggleHelpModal
  } = useAppStore()

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
          isDeleted: false
        })
      }
    }
    seedDefaults()
  }, [])

  // Sync OS fullscreen events and PDF conversion progress from Electron main process
  useEffect(() => {
    const unsubFs = window.desktopAPI?.onFullscreenChange?.((fs) => {
      setImmersiveFullscreen(fs)
    })
    const unsubPdf = window.desktopAPI?.onPdfConvertProgress?.((prog) => {
      setPdfConversionState(prog.percent < 100, { percent: prog.percent, stage: prog.stage })
    })
    return () => {
      unsubFs?.()
      unsubPdf?.()
    }
  }, [setImmersiveFullscreen, setPdfConversionState])

  // Global hotkeys listener (Ctrl reload/zoom/reset intentionally disabled so Ctrl never resets the app)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Control' || e.key === 'F5') {
        e.preventDefault()
        return
      }
      if (e.key === 'F1') {
        e.preventDefault()
        toggleHelpModal()
      } else if (e.key === 'F11') {
        e.preventDefault()
        const next = !useAppStore.getState().isImmersiveFullscreen
        setImmersiveFullscreen(next)
        window.desktopAPI?.setFullscreen?.(next)
      } else if (e.key === 'Escape' && useAppStore.getState().isImmersiveFullscreen) {
        e.preventDefault()
        setImmersiveFullscreen(false)
        window.desktopAPI?.setFullscreen?.(false)
      } else if (e.ctrlKey || e.metaKey) {
        const k = e.key.toLowerCase()
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

    // Block Chromium native Ctrl+Wheel zoom
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('wheel', handleWheel)
    }
  }, [toggleHelpModal, setImmersiveFullscreen])

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
      } else {
        alert(res.error || 'Could not reflow PDF.')
      }
    } catch (err: any) {
      alert(err?.message || 'PDF reflow failed.')
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
      if (!res.success) {
        alert(res.error || 'PDF to EPUB export failed.')
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

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0a0a0a] text-[#ededed] font-sans select-none">
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
      <FullSettingsModal />
    </div>
  )
}

export default App
