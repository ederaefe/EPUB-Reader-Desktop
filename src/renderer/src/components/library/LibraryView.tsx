import React, { useEffect, useState, useMemo } from 'react'
import { Plus, Search, FolderUp, BookOpen, AlertCircle } from 'lucide-react'
import ePub from 'epubjs'
import { useAppStore } from '../../stores/useAppStore'
import { db, type Book, type Category } from '../../db'
import { Sidebar } from './Sidebar'
import { BookCard } from './BookCard'
import { ResumeBar } from './ResumeBar'
import { SettingsDrawer } from '../drawers/SettingsDrawer'

export const LibraryView: React.FC = () => {
  const {
    selectedCategory,
    searchQuery,
    setSearchQuery,
    formatFilter,
    setActiveBook,
    setView
  } = useAppStore()

  const [books, setBooks] = useState<Book[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  const loadData = async () => {
    const allBooks = await db.books.toArray()
    const allCats = await db.categories.toArray()
    setBooks(allBooks)
    setCategories(allCats)
  }

  useEffect(() => {
    loadData()
  }, [])

  // Calculate shelf counts
  const counts = useMemo(() => {
    return {
      all: books.filter((b) => !b.isDeleted).length,
      recent: books.filter((b) => !b.isDeleted && b.lastOpenedAt).length,
      favorites: books.filter((b) => !b.isDeleted && b.isFavorite).length,
      read: books.filter((b) => !b.isDeleted && b.isRead).length,
      deleted: books.filter((b) => b.isDeleted).length,
      epub: books.filter((b) => !b.isDeleted && b.format === 'epub').length,
      pdf: books.filter((b) => !b.isDeleted && b.format === 'pdf').length,
      other: books.filter((b) => !b.isDeleted && (b.format === 'mobi' || b.format === 'txt')).length
    }
  }, [books])

  // Filter books
  const filteredBooks = useMemo(() => {
    return books.filter((b) => {
      // Deletion check
      if (selectedCategory === 'deleted') {
        if (!b.isDeleted) return false
      } else {
        if (b.isDeleted) return false
      }

      // Shelf / Category check
      if (selectedCategory === 'recent') {
        if (!b.lastOpenedAt) return false
      } else if (selectedCategory === 'favorites') {
        if (!b.isFavorite) return false
      } else if (selectedCategory === 'read') {
        if (!b.isRead) return false
      } else if (selectedCategory !== 'all' && selectedCategory !== 'deleted') {
        if (String(b.categoryId) !== selectedCategory) return false
      }

      // Format filter
      if (formatFilter && b.format !== formatFilter) return false

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const titleMatch = b.title.toLowerCase().includes(q)
        const authorMatch = b.author?.toLowerCase().includes(q)
        if (!titleMatch && !authorMatch) return false
      }

      return true
    })
  }, [books, selectedCategory, formatFilter, searchQuery])

  // Active book for Quick-Resume bar
  const resumeBook = useMemo(() => {
    const active = books.filter((b) => !b.isDeleted && b.lastOpenedAt)
    active.sort((a, b) => (b.lastOpenedAt || 0) - (a.lastOpenedAt || 0))
    return active[0] || null
  }, [books])

  // Parse & Add a single file into DB
  const processAndAddFile = async (filePath: string) => {
    const ext = filePath.split('.').pop()?.toLowerCase() || 'epub'

    // If PDF, convert to EPUB via conversion engine
    let targetPath = filePath
    let format: 'epub' | 'pdf' | 'mobi' | 'txt' = 'epub'

    if (ext === 'pdf') {
      setStatusMessage('Converting PDF to EPUB with layout preservation...')
      const conv = await window.desktopAPI.convertToEpub(filePath)
      if (conv.success && conv.epubPath) {
        targetPath = conv.epubPath
        format = 'pdf'
      }
    } else if (ext === 'mobi') {
      format = 'mobi'
    } else if (ext === 'txt') {
      format = 'txt'
    }

    try {
      const buffer = await window.desktopAPI.readFileBuffer(targetPath)
      let title = filePath.split(/[\\/]/).pop()?.replace(/\.[^/.]+$/, '') || 'Untitled'
      let author = 'Unknown Author'
      let coverDataUrl: string | null = null

      // If valid epub buffer, extract metadata & cover
      try {
        const epub = ePub(buffer)
        const meta = await epub.loaded.metadata
        if (meta?.title) title = meta.title
        if (meta?.creator) author = meta.creator

        const coverUrl = await epub.coverUrl()
        if (coverUrl) {
          const resp = await fetch(coverUrl)
          const blob = await resp.blob()
          coverDataUrl = await new Promise((res) => {
            const reader = new FileReader()
            reader.onloadend = () => res(reader.result as string)
            reader.readAsDataURL(blob)
          })
        }
      } catch (e) {
        // Fallback to file name
      }

      await db.books.add({
        filePath: targetPath,
        title,
        author,
        coverDataUrl,
        format,
        fileSize: buffer.byteLength,
        addedAt: Date.now(),
        lastOpenedAt: null,
        progressCfi: null,
        progressPercent: 0,
        currentPage: 1,
        totalPages: 100,
        categoryId: null,
        isFavorite: false,
        isRead: false,
        isDeleted: false
      })
    } catch (err: any) {
      console.error('Error importing book:', filePath, err)
    }
  }

  // Import Files Handler
  const handleImportFiles = async () => {
    setIsLoading(true)
    setStatusMessage('Selecting files...')
    const paths = await window.desktopAPI.openFiles()
    for (const p of paths) {
      await processAndAddFile(p)
    }
    await loadData()
    setIsLoading(false)
    setStatusMessage(null)
  }

  // Bulk Folder Import Handler
  const handleImportFolder = async () => {
    setIsLoading(true)
    setStatusMessage('Scanning folder...')
    const folder = await window.desktopAPI.openFolder()
    if (folder) {
      const files = await window.desktopAPI.scanFolder(folder)
      setStatusMessage(`Found ${files.length} books. Importing...`)
      for (const f of files) {
        await processAndAddFile(f)
      }
      await loadData()
    }
    setIsLoading(false)
    setStatusMessage(null)
  }

  // Open Book in Reader
  const handleOpenBook = async (book: Book) => {
    setIsLoading(true)
    try {
      const buffer = await window.desktopAPI.readFileBuffer(book.filePath)
      setActiveBook(book, buffer)
      setView('reader')
    } catch (e: any) {
      alert(`Could not open file: ${e.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Sidebar */}
      <Sidebar counts={counts} categories={categories} onRefresh={loadData} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col justify-between p-6 overflow-hidden">
        <div className="space-y-4 overflow-y-auto pr-1 flex-1">
          {/* Top Search & Actions Bar */}
          <div className="glass-card rounded-2xl p-2.5 flex items-center justify-between gap-4">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search title, author, or keywords..."
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-400/50"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleImportFolder}
                className="btn-press px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
                title="Bulk Import whole folders (Unlocked Icecream PRO feature)"
              >
                <FolderUp className="w-3.5 h-3.5" />
                <span>Bulk Folder</span>
              </button>

              <button
                onClick={handleImportFiles}
                className="btn-press px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/30 flex items-center gap-1.5 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Books</span>
              </button>
            </div>
          </div>

          {/* Status Message */}
          {statusMessage && (
            <div className="glass-card rounded-xl p-2.5 px-4 text-xs text-blue-300 flex items-center gap-2 border-blue-400/30 animate-pulse">
              <AlertCircle className="w-4 h-4" />
              <span>{statusMessage}</span>
            </div>
          )}

          {/* Books Grid */}
          {filteredBooks.length === 0 ? (
            <div className="h-96 flex flex-col items-center justify-center text-center p-8 rounded-3xl glass-card border-dashed border-white/10">
              <BookOpen className="w-12 h-12 text-blue-400/30 mb-3" />
              <h3 className="text-sm font-bold text-white mb-1">Your bookshelf is empty</h3>
              <p className="text-xs text-slate-400 max-w-sm mb-4">
                Import single EPUB, PDF, and MOBI files or bulk scan your folders to get started.
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleImportFiles}
                  className="btn-press px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30"
                >
                  Import Books
                </button>
                <button
                  onClick={handleImportFolder}
                  className="btn-press px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold"
                >
                  Bulk Import Folder
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 pb-4">
              {filteredBooks.map((book) => (
                <BookCard key={book.id} book={book} onOpen={handleOpenBook} onUpdate={loadData} />
              ))}
            </div>
          )}
        </div>

        {/* Quick Resume Bar */}
        <div className="pt-3">
          <ResumeBar book={resumeBook} onContinue={handleOpenBook} />
        </div>
      </div>

      <SettingsDrawer />
    </div>
  )
}
