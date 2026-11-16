import React, { useEffect } from 'react'
import { useAppStore } from './stores/useAppStore'
import { db } from './db'
import { TitleBar } from './components/ui/TitleBar'
import { LibraryView } from './components/library/LibraryView'
import { EpubReaderView } from './components/reader/EpubReaderView'
import { HelpModal } from './components/ui/HelpModal'

// Bundled authentic assets
import fifthSeasonCover from './assets/covers/the_fifth_season.jpg'
import fifthSeasonEpub from './assets/books/the_fifth_season.epub'

export const App: React.FC = () => {
  const { currentView, activeBook, setView, setActiveBook, toggleHelpModal } = useAppStore()

  // Seed authentic starter library matching screen recording
  useEffect(() => {
    async function seedDefaults() {
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

        // Pre-seed categories
        await db.categories.bulkAdd([
          { name: 'Favorites', color: '#f59e0b', createdAt: Date.now() },
          { name: 'Sci-Fi & Fantasy', color: '#8b5cf6', createdAt: Date.now() },
          { name: 'Classics', color: '#2a69df', createdAt: Date.now() }
        ])
      }
    }
    seedDefaults()
  }, [])

  // Global hotkeys listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F1') {
        e.preventDefault()
        toggleHelpModal()
      } else if (e.key === 'F11') {
        e.preventDefault()
        window.desktopAPI?.toggleFullscreen?.()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggleHelpModal])

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#171a21] text-[#e6edf3] font-sans select-none">
      <TitleBar />

      <main className="flex-1 flex overflow-hidden">
        {currentView === 'library' || !activeBook ? (
          <LibraryView />
        ) : (
          <EpubReaderView
            book={activeBook}
            onBack={() => {
              setActiveBook(null)
              setView('library')
            }}
          />
        )}
      </main>

      <HelpModal />
    </div>
  )
}

export default App
