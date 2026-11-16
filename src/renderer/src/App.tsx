import React, { useEffect } from 'react'
import { useAppStore } from './stores/useAppStore'
import { db } from './db'
import { AppBackground } from './components/ui/AppBackground'
import { TitleBar } from './components/ui/TitleBar'
import { LibraryView } from './components/library/LibraryView'
import { EpubReaderView } from './components/reader/EpubReaderView'

export const App: React.FC = () => {
  const { currentView, activeBook, setView, setActiveBook } = useAppStore()

  // Seed sample books from APK on first launch if library is empty
  useEffect(() => {
    async function seedDefaults() {
      const count = await db.books.count()
      if (count === 0) {
        // Add sample starter books
        await db.books.bulkAdd([
          {
            filePath: 'src/renderer/src/assets/books/alicesadventures.epub',
            title: "Alice's Adventures in Wonderland",
            author: 'Lewis Carroll',
            coverDataUrl: null,
            format: 'epub',
            fileSize: 188710,
            addedAt: Date.now(),
            lastOpenedAt: Date.now(),
            progressCfi: null,
            progressPercent: 12,
            currentPage: 15,
            totalPages: 120,
            categoryId: null,
            isFavorite: true,
            isRead: false,
            isDeleted: false
          },
          {
            filePath: 'src/renderer/src/assets/books/mobydick.epub',
            title: 'Moby-Dick; or, The Whale',
            author: 'Herman Melville',
            coverDataUrl: null,
            format: 'epub',
            fileSize: 836537,
            addedAt: Date.now(),
            lastOpenedAt: null,
            progressCfi: null,
            progressPercent: 0,
            currentPage: 1,
            totalPages: 520,
            categoryId: null,
            isFavorite: false,
            isRead: false,
            isDeleted: false
          }
        ])

        // Add default categories
        await db.categories.bulkAdd([
          { name: 'Classics', color: '#3b82f6', createdAt: Date.now() },
          { name: 'Sci-Fi & Fantasy', color: '#8b5cf6', createdAt: Date.now() },
          { name: 'Science & Tech', color: '#10b981', createdAt: Date.now() }
        ])
      }
    }
    seedDefaults()
  }, [])

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden text-slate-100 font-sans select-none relative">
      <AppBackground />
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
    </div>
  )
}

export default App
