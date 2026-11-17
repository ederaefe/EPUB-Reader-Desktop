import React, { useEffect } from 'react'
import { useAppStore } from './stores/useAppStore'
import { db } from './db'
import { TitleBar } from './components/ui/TitleBar'
import { LibraryView } from './components/library/LibraryView'
import { EpubReaderView } from './components/reader/EpubReaderView'
import { HelpModal } from './components/ui/HelpModal'
import { FullSettingsModal } from './components/modals/FullSettingsModal'

// Bundled authentic assets
import fifthSeasonCover from './assets/covers/the_fifth_season.jpg'
import fifthSeasonEpub from './assets/books/the_fifth_season.epub'

export const App: React.FC = () => {
  const {
    currentView,
    activeBook,
    isImmersiveFullscreen,
    setView,
    setActiveBook,
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

  // Sync OS fullscreen events from Electron main process
  useEffect(() => {
    const unsubscribe = window.desktopAPI?.onFullscreenChange?.((fs) => {
      setImmersiveFullscreen(fs)
    })
    return () => {
      unsubscribe?.()
    }
  }, [setImmersiveFullscreen])

  // Global hotkeys listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
        if (e.key === '=' || e.key === '+' || e.code === 'Equal' || e.code === 'NumpadAdd') {
          e.preventDefault()
          const current = window.desktopAPI?.getZoomFactor?.() ?? 1.0
          window.desktopAPI?.setZoomFactor?.(Math.min(3.0, Math.round((current + 0.1) * 10) / 10))
        } else if (e.key === '-' || e.key === '_' || e.code === 'Minus' || e.code === 'NumpadSubtract') {
          e.preventDefault()
          const current = window.desktopAPI?.getZoomFactor?.() ?? 1.0
          window.desktopAPI?.setZoomFactor?.(Math.max(0.5, Math.round((current - 0.1) * 10) / 10))
        } else if (e.key === '0' || e.code === 'Digit0' || e.code === 'Numpad0') {
          e.preventDefault()
          window.desktopAPI?.setZoomFactor?.(1.0)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggleHelpModal])

  const hideTitleBar = isImmersiveFullscreen && currentView === 'reader' && !!activeBook

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#171a21] text-[#e6edf3] font-sans select-none">
      {!hideTitleBar && <TitleBar />}

      <main className="flex-1 flex overflow-hidden">
        {currentView === 'library' || !activeBook ? (
          <LibraryView />
        ) : (
          <EpubReaderView
            book={activeBook}
            onBack={() => {
              if (isImmersiveFullscreen) {
                setImmersiveFullscreen(false)
                window.desktopAPI?.setFullscreen?.(false)
              }
              setActiveBook(null)
              setView('library')
            }}
          />
        )}
      </main>

      <HelpModal />
      <FullSettingsModal />
    </div>
  )
}

export default App
