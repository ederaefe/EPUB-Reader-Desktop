import React, { useEffect, useState, useMemo } from 'react'
import { Plus, Search, FolderPlus, LayoutGrid, List, BookOpen } from 'lucide-react'
import { useAppStore } from '../../stores/useAppStore'
import { db, type Book, type Category } from '../../db'
import { Sidebar } from './Sidebar'
import { BookCard } from './BookCard'
import { ResumeBar } from './ResumeBar'
import { SettingsDrawer } from '../drawers/SettingsDrawer'
import { extractEpubCover, extractPdfCover, generateCoverCanvas } from '../../services/coverService'

export const LibraryView: React.FC = () => {
  const {
    selectedCategory,
    searchQuery,
    setSearchQuery,
    formatFilter,
    viewMode,
    setViewMode,
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

  // Calculate per-category book counts
  const categoryCounts = useMemo(() => {
    const countsMap: Record<number, number> = {}
    for (const b of books) {
      if (!b.isDeleted && b.categoryId) {
        countsMap[b.categoryId] = (countsMap[b.categoryId] || 0) + 1
      }
    }
    return countsMap
  }, [books])

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
      if (selectedCategory === 'deleted') {
        if (!b.isDeleted) return false
      } else {
        if (b.isDeleted) return false
      }

      if (selectedCategory === 'recent') {
        if (!b.lastOpenedAt) return false
      } else if (selectedCategory === 'favorites') {
        if (!b.isFavorite) return false
      } else if (selectedCategory === 'read') {
        if (!b.isRead) return false
      } else if (selectedCategory !== 'all' && selectedCategory !== 'deleted') {
        if (String(b.categoryId) !== selectedCategory) return false
      }

      if (formatFilter && b.format !== formatFilter) return false

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

  // Process & add a single file into DB with thumbnail extraction
  const processAndAddFile = async (filePath: string) => {
    const ext = filePath.split('.').pop()?.toLowerCase() || 'epub'
    let targetPath = filePath
    let format: 'epub' | 'pdf' | 'mobi' | 'txt' = 'epub'

    if (ext === 'pdf') {
      format = 'pdf'
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

      // Extract real embedded cover
      if (ext === 'epub') {
        coverDataUrl = await extractEpubCover(buffer)
      } else if (ext === 'pdf') {
        coverDataUrl = await extractPdfCover(buffer)
      }

      if (!coverDataUrl) {
        coverDataUrl = generateCoverCanvas(title, author)
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
    const paths = await window.desktopAPI?.openFiles()
    if (paths && paths.length > 0) {
      for (const p of paths) {
        await processAndAddFile(p)
      }
      await loadData()
    }
    setIsLoading(false)
    setStatusMessage(null)
  }

  // Bulk Folder Import Handler
  const handleImportFolder = async () => {
    setIsLoading(true)
    setStatusMessage('Scanning folder...')
    const folder = await window.desktopAPI?.openFolder()
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
      let buffer: ArrayBuffer | null = null
      // Check if file is bundled or on local disk
      if (book.filePath.startsWith('http') || book.filePath.startsWith('/src') || book.filePath.includes('the_fifth_season')) {
        const resp = await fetch(book.filePath)
        buffer = await resp.arrayBuffer()
      } else if (window.desktopAPI?.readFileBuffer) {
        buffer = await window.desktopAPI.readFileBuffer(book.filePath)
      } else {
        const resp = await fetch(book.filePath)
        buffer = await resp.arrayBuffer()
      }

      await db.books.update(book.id!, { lastOpenedAt: Date.now() })
      setActiveBook(book, buffer)
      setView('reader')
    } catch (e: any) {
      alert(`Could not open file: ${e.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  // Handle Drag & Drop
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setIsLoading(true)
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        const file = e.dataTransfer.files[i]
        const buffer = await file.arrayBuffer()
        const ext = file.name.split('.').pop()?.toLowerCase() || 'epub'
        let coverDataUrl: string | null = null

        if (ext === 'epub') {
          coverDataUrl = await extractEpubCover(buffer)
        } else if (ext === 'pdf') {
          coverDataUrl = await extractPdfCover(buffer)
        }

        const title = file.name.replace(/\.[^/.]+$/, '')
        const author = 'Imported Book'

        if (!coverDataUrl) {
          coverDataUrl = generateCoverCanvas(title, author)
        }

        await db.books.add({
          filePath: (file as any).path || file.name,
          title,
          author,
          coverDataUrl,
          format: (ext === 'pdf' ? 'pdf' : 'epub') as any,
          fileSize: file.size,
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
      }
      await loadData()
      setIsLoading(false)
    }
  }

  return (
    <div className="flex-1 flex overflow-hidden bg-[#1c1f26]">
      {/* Left Sidebar */}
      <Sidebar counts={counts} categories={categories} categoryCounts={categoryCounts} onRefresh={loadData} />

      {/* Main Catalog View */}
      <div className="flex-1 flex flex-col justify-between overflow-hidden bg-[#1c1f26]">
        {/* Top Docked Action Strip (1:1 Icecream Reader) */}
        <header className="h-10 bg-[#171a21] border-b border-[#232732] px-3 flex items-center justify-between select-none shrink-0">
          {/* Left Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleImportFiles}
              className="ice-btn-dark px-3 h-7 text-xs flex items-center gap-1.5 rounded-[2px]"
              title="Add book from computer (Ctrl+O)"
            >
              <Plus className="w-3.5 h-3.5 text-[#2a69df]" />
              <span>Add book</span>
            </button>

            <button
              onClick={handleImportFolder}
              className="ice-btn-dark px-3 h-7 text-xs flex items-center gap-1.5 rounded-[2px]"
              title="Add books from folder"
            >
              <FolderPlus className="w-3.5 h-3.5 text-[#8b949e]" />
              <span>Add folder</span>
            </button>
          </div>

          {/* Right Controls: Search & View Toggle */}
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#6e7681] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search in Library"
                className="ice-input h-7 pl-8 pr-2.5 w-60 text-xs rounded-[2px]"
              />
            </div>

            <div className="flex items-center gap-0.5 border border-[#232732] rounded-[2px] p-0.5 bg-[#171a21]">
              <button
                onClick={() => setViewMode('grid')}
                className={`w-6 h-6 flex items-center justify-center rounded-[2px] transition-colors ${
                  viewMode === 'grid' ? 'bg-[#232732] text-[#2a69df]' : 'text-[#8b949e] hover:text-white'
                }`}
                title="Grid view"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`w-6 h-6 flex items-center justify-center rounded-[2px] transition-colors ${
                  viewMode === 'list' ? 'bg-[#232732] text-[#2a69df]' : 'text-[#8b949e] hover:text-white'
                }`}
                title="List view"
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </header>

        {/* Table sorting column headers (1:1 Icecream Reader) */}
        <div className="h-7 px-5 border-b border-[#232732] flex items-center text-[11px] text-[#6e7681] select-none bg-[#171a21]/50 shrink-0">
          <div className="w-[38%] flex items-center gap-1 cursor-pointer hover:text-[#9da7b3]">Title</div>
          <div className="w-[24%] flex items-center gap-1 cursor-pointer hover:text-[#9da7b3]">Author</div>
          <div className="w-[14%] flex items-center gap-1 cursor-pointer text-[#c8d1dc]">Date ▼</div>
          <div className="w-[12%] flex items-center gap-1 cursor-pointer hover:text-[#9da7b3]">Notes</div>
          <div className="w-[12%] flex items-center gap-1 cursor-pointer hover:text-[#9da7b3] text-right pr-4">Progress</div>
        </div>

        {/* Catalog Body */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="flex-1 overflow-y-auto p-5"
        >
          {statusMessage && (
            <div className="mb-4 px-3 py-2 bg-[#232732] border border-[#2a69df]/40 text-[#79c0ff] text-xs rounded">
              {statusMessage}
            </div>
          )}

          {filteredBooks.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 select-none">
              <p className="text-[13px] text-[#8b949e] mb-6">
                No books found in &quot;{selectedCategory === 'recent' ? 'Recently Read' : selectedCategory === 'favorites' ? 'Favorites' : selectedCategory === 'read' ? 'Read' : selectedCategory === 'deleted' ? 'Deleted' : 'All'}&quot;.
              </p>
              <div className="opacity-20 flex items-center justify-center relative w-24 h-24">
                <div className="flex gap-1.5 items-end">
                  <div className="w-5 h-16 bg-[#6e7681] rounded-sm" />
                  <div className="w-5 h-18 bg-[#6e7681] rounded-sm" />
                  <div className="w-5 h-14 bg-[#6e7681] rounded-sm" />
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-10 h-10 rounded-full border-2 border-[#6e7681] flex items-center justify-center">
                    <span className="text-lg font-bold text-[#6e7681]">?</span>
                  </div>
                </div>
              </div>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="flex flex-wrap gap-5">
              {filteredBooks.map((book) => (
                <BookCard
                  key={book.id}
                  book={book}
                  categories={categories}
                  onOpen={handleOpenBook}
                  onUpdate={loadData}
                  viewMode="grid"
                />
              ))}
            </div>
          ) : (
            <div className="bg-[#1f232d] border border-[#2b2f3a] rounded divide-y divide-[#2b2f3a]">
              {filteredBooks.map((book) => (
                <BookCard
                  key={book.id}
                  book={book}
                  categories={categories}
                  onOpen={handleOpenBook}
                  onUpdate={loadData}
                  viewMode="list"
                />
              ))}
            </div>
          )}
        </div>

        {/* Bottom Resume Bar */}
        <ResumeBar book={resumeBook} onContinue={handleOpenBook} />
      </div>

      <SettingsDrawer />
    </div>
  )
}
