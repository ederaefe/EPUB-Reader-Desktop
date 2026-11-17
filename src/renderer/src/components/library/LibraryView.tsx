import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import {
  Search,
  LayoutGrid,
  List,
  Pin,
  PinOff,
  Star,
  CheckCircle2,
  Circle,
  Trash2,
  X,
  Folder,
  ChevronDown
} from 'lucide-react'
import { useAppStore } from '../../stores/useAppStore'
import { db, permanentlyDeleteBooks, type Book, type Category } from '../../db'
import { Sidebar } from './Sidebar'
import { BookCard } from './BookCard'
import { AddBookCard } from './AddBookCard'
import { ResumeBar } from './ResumeBar'
import { SettingsDrawer } from '../drawers/SettingsDrawer'
import { ImportBooksModal } from '../modals/ImportBooksModal'
import {
  extractBookMetadata,
  parseBookTitleAndAuthor,
  generateCoverCanvas
} from '../../services/coverService'

export const LibraryView: React.FC = () => {
  const {
    selectedCategory,
    searchQuery,
    setSearchQuery,
    formatFilter,
    viewMode,
    setViewMode,
    activeBook,
    setActiveBook,
    setView,
    libraryVersion,
    showToast,
    openConfirmDialog
  } = useAppStore()

  const [books, setBooks] = useState<Book[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const catalogScrollRef = useRef<HTMLDivElement>(null)

  // Subtle top-bar Select Mode & multi-select state
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [selectedBookIds, setSelectedBookIds] = useState<Set<number>>(new Set())
  const [showBulkCategoryMenu, setShowBulkCategoryMenu] = useState(false)
  const lastSelectedIdRef = useRef<number | null>(null)
  const selectAllInputRef = useRef<HTMLInputElement>(null)

  const [sortBy, setSortBy] = useState<'title' | 'author' | 'date' | 'notes' | 'progress'>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const handleSortClick = (field: 'title' | 'author' | 'date' | 'notes' | 'progress') => {
    if (sortBy === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(field)
      setSortDir(field === 'title' || field === 'author' ? 'asc' : 'desc')
    }
  }

  const loadData = useCallback(async () => {
    const [allBooks, allCats, allAnnotations] = await Promise.all([
      db.books.toArray(),
      db.categories.toArray(),
      db.annotations.toArray()
    ])

    const notesCountMap: Record<number, number> = {}
    for (const ann of allAnnotations) {
      notesCountMap[ann.bookId] = (notesCountMap[ann.bookId] || 0) + 1
    }

    // Auto-cleanse any books with raw scrape prefixes, unknown authors, or accidental 3% unread progress
    for (const b of allBooks) {
      let needsUpdate = false
      const liveNotesCount = b.id ? notesCountMap[b.id] || 0 : 0
      if (b.notesCount !== liveNotesCount) {
        b.notesCount = liveNotesCount
      }
      const updates: Partial<Book> = {}

      if (
        (b.title && /^(d-pdf\.com|oceanofpdf\.com|\[z-lib\.org\])/i.test(b.title)) ||
        b.author === 'Unknown Author'
      ) {
        const parsed = parseBookTitleAndAuthor(b.title)
        if (parsed.title !== b.title) {
          updates.title = parsed.title
          needsUpdate = true
        }
        if (parsed.author !== 'Unknown Author' && (b.author === 'Unknown Author' || !b.author)) {
          updates.author = parsed.author
          needsUpdate = true
        }
      }

      if (b.progressPercent === 3 && !b.progressCfi && !b.lastOpenedAt) {
        updates.progressPercent = 0
        updates.currentPage = 1
        needsUpdate = true
      }

      if (needsUpdate && b.id) {
        if (updates.title || updates.author) {
          const effectiveTitle = updates.title || b.title
          const effectiveAuthor = updates.author || b.author
          // Only generate a fallback cover if the book does not already have one
          if (!b.coverDataUrl) {
            updates.coverDataUrl = generateCoverCanvas(effectiveTitle, effectiveAuthor)
          }
        }
        await db.books.update(b.id, updates)
        Object.assign(b, updates)
      }
    }

    setBooks(allBooks)
    setCategories(allCats)
  }, [])

  useEffect(() => {
    loadData()
  }, [libraryVersion, loadData])

  // Exit selection mode cleanly whenever the user switches shelves or format filters
  useEffect(() => {
    setIsSelectionMode(false)
    setSelectedBookIds(new Set())
    lastSelectedIdRef.current = null
  }, [selectedCategory, formatFilter])

  // Calculate per-category book counts
  const categoryCounts = useMemo(() => {
    const countsMap: Record<number, number> = {}
    for (const b of books) {
      if (b.categoryId) {
        countsMap[b.categoryId] = (countsMap[b.categoryId] || 0) + 1
      }
    }
    return countsMap
  }, [books])

  // Calculate shelf counts
  const counts = useMemo(() => {
    return {
      all: books.length,
      recent: books.filter((b) => Boolean(b.lastOpenedAt)).length,
      favorites: books.filter((b) => b.isFavorite).length,
      read: books.filter((b) => b.isRead).length,
      epub: books.filter((b) => b.format === 'epub').length,
      pdf: books.filter((b) => b.format === 'pdf').length,
      other: books.filter((b) => b.format === 'mobi' || b.format === 'txt').length
    }
  }, [books])

  // Filter and sort books (pinned books always float cleanly to the top)
  const filteredBooks = useMemo(() => {
    const filtered = books.filter((b) => {
      if (selectedCategory === 'recent') {
        if (!b.lastOpenedAt) return false
      } else if (selectedCategory === 'favorites') {
        if (!b.isFavorite) return false
      } else if (selectedCategory === 'read') {
        if (!b.isRead) return false
      } else if (selectedCategory !== 'all') {
        if (String(b.categoryId) !== selectedCategory) return false
      }

      if (formatFilter && b.format !== formatFilter) return false

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const titleMatch = b.title.toLowerCase().includes(q)
        const authorMatch = b.author?.toLowerCase().includes(q)
        const tagMatch = Array.isArray(b.tags) && b.tags.some((t) => t.toLowerCase().includes(q))
        const publisherMatch = b.publisher?.toLowerCase().includes(q)
        const seriesMatch = b.series?.toLowerCase().includes(q)
        if (!titleMatch && !authorMatch && !tagMatch && !publisherMatch && !seriesMatch) return false
      }

      return true
    })

    const dir = sortDir === 'asc' ? 1 : -1
    filtered.sort((a, b) => {
      // Pinned books always remain anchored at the top
      const pinDiff = (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0)
      if (pinDiff !== 0) return pinDiff

      if (sortBy === 'title') return a.title.localeCompare(b.title) * dir
      if (sortBy === 'author') return (a.author || '').localeCompare(b.author || '') * dir
      if (sortBy === 'notes') return ((a.notesCount || 0) - (b.notesCount || 0)) * dir
      if (sortBy === 'progress') return ((a.progressPercent || 0) - (b.progressPercent || 0)) * dir

      if (a.isPinned && b.isPinned) {
        const pinnedDiff = (b.pinnedAt || 0) - (a.pinnedAt || 0)
        if (pinnedDiff !== 0) return pinnedDiff
      }
      return ((a.addedAt || 0) - (b.addedAt || 0)) * dir
    })

    return filtered
  }, [books, selectedCategory, formatFilter, searchQuery, sortBy, sortDir])

  // Prune any selected IDs that are no longer visible in the filtered list
  const visibleBookIds = useMemo(
    () => filteredBooks.map((b) => b.id).filter((id): id is number => id !== undefined),
    [filteredBooks]
  )

  const selectedVisibleIds = useMemo(
    () => visibleBookIds.filter((id) => selectedBookIds.has(id)),
    [visibleBookIds, selectedBookIds]
  )

  const selectedBooks = useMemo(() => {
    const idSet = new Set(selectedVisibleIds)
    return filteredBooks.filter((b) => b.id !== undefined && idSet.has(b.id))
  }, [filteredBooks, selectedVisibleIds])

  const allVisibleSelected =
    visibleBookIds.length > 0 && selectedVisibleIds.length === visibleBookIds.length
  const someVisibleSelected =
    selectedVisibleIds.length > 0 && selectedVisibleIds.length < visibleBookIds.length

  // Sync native DOM indeterminate state on the header tri-state Select All checkbox
  useEffect(() => {
    if (selectAllInputRef.current) {
      selectAllInputRef.current.indeterminate = someVisibleSelected
    }
  }, [someVisibleSelected, isSelectionMode])

  const exitSelectionMode = useCallback(() => {
    setIsSelectionMode(false)
    setSelectedBookIds(new Set())
    lastSelectedIdRef.current = null
  }, [])

  // Top-bar hover-reveal [] handler:
  // Tap 1 (idle) -> activates Select Mode with 0 selected
  // Tap 2 (in Select Mode, 0 or partial selected) -> Selects All visible books
  // Tap 3 (in Select Mode, all selected) -> Deselects All (stays in Select Mode)
  const handleTopSelectClick = useCallback(() => {
    if (!isSelectionMode) {
      setIsSelectionMode(true)
      setSelectedBookIds(new Set())
      lastSelectedIdRef.current = null
      return
    }
    if (allVisibleSelected) {
      setSelectedBookIds(new Set())
      lastSelectedIdRef.current = null
    } else {
      setSelectedBookIds(new Set(visibleBookIds))
    }
  }, [isSelectionMode, allVisibleSelected, visibleBookIds])

  // Per-book selection toggle with conventional Shift+Click range selection
  const handleToggleSelectBook = useCallback(
    (bookId: number, shiftKey: boolean) => {
      setSelectedBookIds((prev) => {
        const next = new Set(prev)
        if (shiftKey && lastSelectedIdRef.current !== null) {
          const anchorIdx = visibleBookIds.indexOf(lastSelectedIdRef.current)
          const targetIdx = visibleBookIds.indexOf(bookId)
          if (anchorIdx !== -1 && targetIdx !== -1) {
            const [start, end] = anchorIdx < targetIdx ? [anchorIdx, targetIdx] : [targetIdx, anchorIdx]
            for (let i = start; i <= end; i++) {
              next.add(visibleBookIds[i])
            }
            return next
          }
        }
        if (next.has(bookId)) {
          next.delete(bookId)
        } else {
          next.add(bookId)
        }
        lastSelectedIdRef.current = bookId
        return next
      })
    },
    [visibleBookIds]
  )

  const handleSelectThisBook = useCallback((book: Book) => {
    if (book.id === undefined) return
    setIsSelectionMode(true)
    setSelectedBookIds(new Set([book.id]))
    lastSelectedIdRef.current = book.id
  }, [])

  // Active custom category when browsing a user-created shelf
  const activeCustomCategory = useMemo(() => {
    if (
      selectedCategory === 'all' ||
      selectedCategory === 'recent' ||
      selectedCategory === 'favorites' ||
      selectedCategory === 'read'
    ) {
      return null
    }
    return categories.find((c) => String(c.id) === selectedCategory) || null
  }, [selectedCategory, categories])

  // Human-readable active shelf label
  const shelfTitle = useMemo(() => {
    if (activeCustomCategory) return activeCustomCategory.name
    if (selectedCategory === 'recent') return 'Recently Read'
    if (selectedCategory === 'favorites') return 'Favorites'
    if (selectedCategory === 'read') return 'Read'
    return 'All Books'
  }, [selectedCategory, activeCustomCategory])

  // =========================================================================
  // Holistic Backend Actions (shared by Right-Click Menu & Bulk Action Bar)
  // =========================================================================

  const resolveActionTargets = useCallback(
    (book: Book): Book[] => {
      if (isSelectionMode && book.id !== undefined && selectedBookIds.has(book.id) && selectedBooks.length > 1) {
        return selectedBooks
      }
      return [book]
    },
    [isSelectionMode, selectedBookIds, selectedBooks]
  )

  const handlePinBooks = useCallback(
    async (targets: Book[], nextPinned: boolean) => {
      const ids = targets.map((b) => b.id).filter((id): id is number => id !== undefined)
      if (ids.length === 0) return
      const now = Date.now()
      await Promise.all(
        ids.map((id, idx) =>
          db.books.update(id, {
            isPinned: nextPinned,
            pinnedAt: nextPinned ? now + idx : null
          })
        )
      )
      await loadData()
      const noun = ids.length === 1 ? `"${targets[0].title}"` : `${ids.length} books`
      showToast(nextPinned ? `Pinned ${noun} to top` : `Unpinned ${noun}`, 'success')
    },
    [loadData, showToast]
  )

  const handleFavoriteBooks = useCallback(
    async (targets: Book[], nextFavorite: boolean) => {
      const ids = targets.map((b) => b.id).filter((id): id is number => id !== undefined)
      if (ids.length === 0) return
      await Promise.all(ids.map((id) => db.books.update(id, { isFavorite: nextFavorite })))
      await loadData()
      const noun = ids.length === 1 ? `"${targets[0].title}"` : `${ids.length} books`
      showToast(
        nextFavorite ? `Added ${noun} to Favorites` : `Removed ${noun} from Favorites`,
        'success'
      )
    },
    [loadData, showToast]
  )

  const handleMarkReadBooks = useCallback(
    async (targets: Book[]) => {
      const valid = targets.filter((b) => b.id !== undefined)
      if (valid.length === 0) return
      await Promise.all(
        valid.map((b) =>
          db.books.update(b.id!, {
            isRead: true,
            progressPercent: 100,
            currentPage: Math.max(b.totalPages || 1, 1)
          })
        )
      )
      await loadData()
      const noun = valid.length === 1 ? `"${valid[0].title}"` : `${valid.length} books`
      showToast(`Marked ${noun} as read`, 'success')
    },
    [loadData, showToast]
  )

  const handleMarkUnreadBooks = useCallback(
    async (targets: Book[]) => {
      const valid = targets.filter((b) => b.id !== undefined)
      if (valid.length === 0) return
      await Promise.all(
        valid.map((b) =>
          db.books.update(b.id!, {
            isRead: false,
            progressPercent: 0,
            currentPage: 1,
            progressCfi: null
          })
        )
      )
      await loadData()
      const noun = valid.length === 1 ? `"${valid[0].title}"` : `${valid.length} books`
      showToast(`Marked ${noun} as unread`, 'success')
    },
    [loadData, showToast]
  )

  const handleAssignCategoryBooks = useCallback(
    async (targets: Book[], catId: number | null) => {
      const ids = targets.map((b) => b.id).filter((id): id is number => id !== undefined)
      if (ids.length === 0) return
      await Promise.all(ids.map((id) => db.books.update(id, { categoryId: catId })))
      await loadData()
      const cat = catId !== null ? categories.find((c) => c.id === catId) : null
      const noun = ids.length === 1 ? `"${targets[0].title}"` : `${ids.length} books`
      showToast(
        cat ? `Moved ${noun} to "${cat.name}"` : `Removed ${noun} from category`,
        'success'
      )
    },
    [loadData, categories, showToast]
  )

  const handleRequestDeleteBooks = useCallback(
    (targets: Book[]) => {
      const valid = targets.filter((b) => b.id !== undefined)
      if (valid.length === 0) return
      const ids = valid.map((b) => b.id!)
      const isSingle = valid.length === 1

      openConfirmDialog({
        title: isSingle ? 'Delete Book Permanently?' : `Delete ${valid.length} Books Permanently?`,
        message: isSingle
          ? `"${valid[0].title}" along with its reading progress, highlights, notes, and bookmarks will be permanently deleted from your library. This action cannot be undone.`
          : `${valid.length} selected books along with all of their reading progress, highlights, notes, and bookmarks will be permanently deleted from your library. This action cannot be undone.`,
        confirmLabel: 'Delete Permanently',
        cancelLabel: 'Cancel',
        danger: true,
        onConfirm: async () => {
          await permanentlyDeleteBooks(ids)
          if (activeBook?.id && ids.includes(activeBook.id)) {
            setActiveBook(null, null)
          }
          setSelectedBookIds((prev) => {
            const next = new Set(prev)
            for (const id of ids) next.delete(id)
            return next
          })
          if (ids.length >= selectedVisibleIds.length && isSelectionMode) {
            setIsSelectionMode(false)
          }
          await loadData()
          showToast(
            isSingle
              ? `Permanently deleted "${valid[0].title}"`
              : `Permanently deleted ${valid.length} books`,
            'info'
          )
        }
      })
    },
    [
      openConfirmDialog,
      activeBook,
      setActiveBook,
      selectedVisibleIds.length,
      isSelectionMode,
      loadData,
      showToast
    ]
  )

  // Keyboard shortcuts: Ctrl+O import, Ctrl+A select all, Escape exit select mode, Delete permanent delete, Up/Down scroll
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') {
        e.preventDefault()
        setIsImportModalOpen(true)
        return
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        if (visibleBookIds.length > 0 && !isImportModalOpen) {
          e.preventDefault()
          setIsSelectionMode(true)
          setSelectedBookIds(new Set(visibleBookIds))
        }
        return
      }

      if (e.key === 'Escape' && isSelectionMode) {
        e.preventDefault()
        exitSelectionMode()
        return
      }

      if (e.key === 'Delete' && isSelectionMode && selectedBooks.length > 0 && !isImportModalOpen) {
        e.preventDefault()
        handleRequestDeleteBooks(selectedBooks)
        return
      }

      if (isImportModalOpen) return
      const scroller = catalogScrollRef.current
      if (!scroller) return

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        scroller.scrollBy({ top: 180, behavior: 'smooth' })
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        scroller.scrollBy({ top: -180, behavior: 'smooth' })
      } else if (e.key === 'PageDown') {
        e.preventDefault()
        scroller.scrollBy({ top: Math.round(scroller.clientHeight * 0.8), behavior: 'smooth' })
      } else if (e.key === 'PageUp') {
        e.preventDefault()
        scroller.scrollBy({ top: -Math.round(scroller.clientHeight * 0.8), behavior: 'smooth' })
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    isImportModalOpen,
    isSelectionMode,
    visibleBookIds,
    selectedBooks,
    exitSelectionMode,
    handleRequestDeleteBooks
  ])

  // Active book for Quick-Resume bar
  const resumeBook = useMemo(() => {
    const active = books.filter((b) => Boolean(b.lastOpenedAt))
    active.sort((a, b) => (b.lastOpenedAt || 0) - (a.lastOpenedAt || 0))
    return active[0] || null
  }, [books])

  // Process & add a single file into DB with thumbnail extraction
  const processAndAddFile = async (filePath: string, targetCategoryId: number | null = null) => {
    const ext = filePath.split('.').pop()?.toLowerCase() || 'epub'
    const targetPath = filePath
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
      const rawName = filePath.split(/[\\/]/).pop()?.replace(/\.[^/.]+$/, '') || 'Untitled'
      const meta = await extractBookMetadata(buffer, ext, rawName)

      await db.books.add({
        filePath: targetPath,
        title: meta.title,
        author: meta.author,
        coverDataUrl: meta.coverDataUrl,
        format,
        fileSize: buffer.byteLength,
        addedAt: Date.now(),
        lastOpenedAt: null,
        progressCfi: null,
        progressPercent: 0,
        currentPage: 1,
        totalPages: meta.totalPages || 100,
        categoryId: targetCategoryId,
        isFavorite: false,
        isRead: false,
        isPinned: false,
        pinnedAt: null,
        tags: meta.embedded.tags || [],
        description: meta.embedded.description,
        publisher: meta.embedded.publisher,
        publishedDate: meta.embedded.publishedDate,
        language: meta.embedded.language,
        identifier: meta.embedded.identifier,
        series: meta.embedded.series,
        seriesIndex: meta.embedded.seriesIndex,
        rights: meta.embedded.rights,
        subject: meta.embedded.subject,
        creatorTool: meta.embedded.creatorTool,
        producer: meta.embedded.producer,
        formatVersion: meta.embedded.formatVersion,
        metadataHydrated: true
      })
      return true
    } catch (err: any) {
      console.error('Error importing book:', filePath, err)
      return false
    }
  }

  // Import Files Handler
  const handleImportFiles = async () => {
    const targetCatId = activeCustomCategory?.id ?? null
    const targetCatName = activeCustomCategory?.name ?? null
    setIsLoading(true)
    setStatusMessage('Selecting files...')
    const paths = await window.desktopAPI?.openFiles()
    if (paths && paths.length > 0) {
      let importedCount = 0
      for (const p of paths) {
        if (await processAndAddFile(p, targetCatId)) importedCount++
      }
      await loadData()
      if (importedCount > 0) {
        const noun = importedCount === 1 ? 'book' : 'books'
        showToast(
          targetCatName
            ? `Added ${importedCount} ${noun} to "${targetCatName}"`
            : `Imported ${importedCount} ${noun}`,
          'success'
        )
      }
    }
    setIsLoading(false)
    setStatusMessage(null)
  }

  // Bulk Folder Import Handler
  const handleImportFolder = async () => {
    const targetCatId = activeCustomCategory?.id ?? null
    const targetCatName = activeCustomCategory?.name ?? null
    setIsLoading(true)
    setStatusMessage('Scanning folder...')
    const folder = await window.desktopAPI?.openFolder()
    if (folder) {
      const files = await window.desktopAPI.scanFolder(folder)
      setStatusMessage(`Found ${files.length} books. Importing...`)
      let importedCount = 0
      for (const f of files) {
        if (await processAndAddFile(f, targetCatId)) importedCount++
      }
      await loadData()
      if (importedCount > 0) {
        const noun = importedCount === 1 ? 'book' : 'books'
        showToast(
          targetCatName
            ? `Added ${importedCount} ${noun} to "${targetCatName}"`
            : `Imported ${importedCount} ${noun} from folder`,
          'success'
        )
      }
    }
    setIsLoading(false)
    setStatusMessage(null)
  }

  // Bulk assign existing library books into the active custom category
  const handleBulkAddToCategory = async (bookIds: number[], categoryId: number) => {
    if (bookIds.length === 0) return
    await Promise.all(bookIds.map((id) => db.books.update(id, { categoryId })))
    await loadData()
    const targetCat = categories.find((c) => c.id === categoryId)
    const noun = bookIds.length === 1 ? 'book' : 'books'
    showToast(
      targetCat
        ? `Added ${bookIds.length} ${noun} to "${targetCat.name}"`
        : `Updated ${bookIds.length} ${noun}`,
      'success'
    )
  }

  // Open Book in Reader
  const handleOpenBook = async (book: Book) => {
    setIsLoading(true)
    try {
      let buffer: ArrayBuffer | null = null
      if (
        book.filePath.startsWith('http') ||
        book.filePath.startsWith('/src') ||
        book.filePath.includes('the_fifth_season')
      ) {
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
      showToast(`Could not open file: ${e.message}`, 'error')
    } finally {
      setIsLoading(false)
    }
  }

  // Handle Drag & Drop
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const targetCatId = activeCustomCategory?.id ?? null
      const targetCatName = activeCustomCategory?.name ?? null
      setIsLoading(true)
      const count = e.dataTransfer.files.length
      let importedCount = 0
      for (let i = 0; i < count; i++) {
        const file = e.dataTransfer.files[i]
        const ext = file.name.split('.').pop()?.toLowerCase() || 'epub'
        let format: 'epub' | 'pdf' | 'mobi' | 'txt' = 'epub'
        if (ext === 'pdf') format = 'pdf'
        else if (ext === 'mobi' || ext === 'azw' || ext === 'azw3') format = 'mobi'
        else if (ext === 'txt') format = 'txt'

        const buffer = await file.arrayBuffer()
        const rawName = file.name.replace(/\.[^/.]+$/, '')
        const meta = await extractBookMetadata(buffer, ext, rawName)

        await db.books.add({
          filePath: (file as any).path || file.name,
          title: meta.title,
          author: meta.author,
          coverDataUrl: meta.coverDataUrl,
          format,
          fileSize: file.size,
          addedAt: Date.now(),
          lastOpenedAt: null,
          progressCfi: null,
          progressPercent: 0,
          currentPage: 1,
          totalPages: meta.totalPages || 100,
          categoryId: targetCatId,
          isFavorite: false,
          isRead: false,
          isPinned: false,
          pinnedAt: null,
          tags: meta.embedded.tags || [],
          description: meta.embedded.description,
          publisher: meta.embedded.publisher,
          publishedDate: meta.embedded.publishedDate,
          language: meta.embedded.language,
          identifier: meta.embedded.identifier,
          series: meta.embedded.series,
          seriesIndex: meta.embedded.seriesIndex,
          rights: meta.embedded.rights,
          subject: meta.embedded.subject,
          creatorTool: meta.embedded.creatorTool,
          producer: meta.embedded.producer,
          formatVersion: meta.embedded.formatVersion,
          metadataHydrated: true
        })
        importedCount++
      }
      await loadData()
      setIsLoading(false)
      if (importedCount > 0) {
        const noun = importedCount === 1 ? 'book' : 'books'
        showToast(
          targetCatName
            ? `Added ${importedCount} ${noun} to "${targetCatName}"`
            : `Imported ${importedCount} ${noun}`,
          'success'
        )
      }
    }
  }

  const canShowAddCard = searchQuery.trim() === '' && !isSelectionMode
  const allSelectedArePinned = selectedBooks.length > 0 && selectedBooks.every((b) => Boolean(b.isPinned))
  const allSelectedAreFav = selectedBooks.length > 0 && selectedBooks.every((b) => b.isFavorite)

  return (
    <div className="flex-1 flex overflow-hidden bg-[#0a0a0a] relative">
      {/* Left Sidebar */}
      <Sidebar counts={counts} categories={categories} categoryCounts={categoryCounts} onRefresh={loadData} />

      {/* Main Catalog View */}
      <div className="flex-1 flex flex-col justify-between overflow-hidden bg-[#0a0a0a]">
        {/* Top Action Strip with Subtle Hover-to-Reveal Select Mode [] */}
        <header className="group/header h-11 bg-[#0d0d0d] border-b border-white/[0.07] px-5 flex items-center justify-between gap-3 select-none shrink-0">
          {/* Left Context: Subtle Hover-Reveal [] Select Mode / Select All + Active Shelf Label */}
          <div className="flex items-center gap-2.5 min-w-0">
            {visibleBookIds.length > 0 && (
              isSelectionMode ? (
                <div className="flex items-center gap-2 shrink-0">
                  <input
                    ref={selectAllInputRef}
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={handleTopSelectClick}
                    className="ice-checkbox"
                    aria-label={
                      allVisibleSelected
                        ? 'Deselect all books'
                        : 'Select all books'
                    }
                    title={
                      allVisibleSelected
                        ? 'Deselect all'
                        : 'Select all'
                    }
                  />
                  <span className="text-[11.5px] font-medium text-[var(--app-text-strong)] tabular-nums">
                    {selectedVisibleIds.length === 0
                      ? 'Select'
                      : `${selectedVisibleIds.length} selected`}
                  </span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleTopSelectClick}
                  aria-label="Enter selection mode"
                  title="Select books"
                  className="w-4 h-4 rounded-[3px] border border-[var(--app-checkbox-border)] bg-transparent hover:border-[var(--app-accent)] opacity-0 group-hover/header:opacity-100 focus-visible:opacity-100 transition-opacity duration-150 shrink-0 cursor-pointer"
                />
              )
            )}

            {!isSelectionMode && (
              <>
                {activeCustomCategory && (
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: activeCustomCategory.color }}
                  />
                )}
                <span className="text-[13px] font-semibold tracking-[-0.015em] text-[#ededed] truncate">
                  {shelfTitle}
                </span>
                {formatFilter && (
                  <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 bg-[#161616] border border-white/[0.08] text-[#888888] rounded">
                    {formatFilter}
                  </span>
                )}
                <span className="text-[11px] font-mono tabular-nums text-[#666666]">
                  {filteredBooks.length}
                </span>
              </>
            )}

            {isSelectionMode && (
              <div className="flex items-center gap-1 ml-1">
                <span className="h-3.5 w-px bg-[var(--app-border)] mx-1" />
                <div className="relative">
                  <button
                    type="button"
                    disabled={selectedBooks.length === 0}
                    onClick={() => setShowBulkCategoryMenu(!showBulkCategoryMenu)}
                    className="h-7 px-2 rounded-md text-[11px] flex items-center gap-1.5 text-[var(--app-text)] hover:bg-[var(--app-surface-hover)] disabled:opacity-35 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    title="Assign category to selected"
                  >
                    <Folder className="w-3.5 h-3.5" />
                    <span>Category</span>
                    <ChevronDown className="w-3 h-3 opacity-60" />
                  </button>
                  {showBulkCategoryMenu && (
                    <div className="absolute top-full left-0 mt-1 w-40 bg-[#171a21] border border-[#2d323f] rounded-[2px] shadow-xl py-1 z-50 text-[11px]">
                      <button
                        onClick={() => {
                          handleAssignCategoryBooks(selectedBooks, null)
                          setShowBulkCategoryMenu(false)
                        }}
                        className="w-full px-2 py-1.5 flex items-center gap-1.5 text-left hover:bg-[#232732] transition-colors text-[var(--app-text)]"
                      >
                        Remove Category
                      </button>
                      {categories.map((cat) => (
                        <button
                          key={cat.id}
                          onClick={() => {
                            handleAssignCategoryBooks(selectedBooks, cat.id!)
                            setShowBulkCategoryMenu(false)
                          }}
                          className="w-full px-2 py-1.5 flex items-center gap-1.5 text-left hover:bg-[#232732] transition-colors text-[var(--app-text)]"
                        >
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                          <span className="truncate">{cat.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  disabled={selectedBooks.length === 0}
                  onClick={() => handleFavoriteBooks(selectedBooks, !allSelectedAreFav)}
                  className="h-7 px-2 rounded-md text-[11px] flex items-center gap-1.5 text-[var(--app-text)] hover:bg-[var(--app-surface-hover)] disabled:opacity-35 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  title={allSelectedAreFav ? 'Remove from Favorites' : 'Add to Favorites'}
                >
                  <Star className={`w-3.5 h-3.5 ${allSelectedAreFav ? 'text-[#e3b341] fill-current' : ''}`} />
                  <span>Favorite</span>
                </button>
                <button
                  type="button"
                  disabled={selectedBooks.length === 0}
                  onClick={() => handleMarkReadBooks(selectedBooks)}
                  className="h-7 px-2 rounded-md text-[11px] flex items-center gap-1.5 text-[var(--app-text)] hover:bg-[var(--app-surface-hover)] disabled:opacity-35 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  title="Mark selected as read"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#4cd964]" />
                  <span>Read</span>
                </button>
                <button
                  type="button"
                  disabled={selectedBooks.length === 0}
                  onClick={() => handleMarkUnreadBooks(selectedBooks)}
                  className="h-7 px-2 rounded-md text-[11px] flex items-center gap-1.5 text-[var(--app-text)] hover:bg-[var(--app-surface-hover)] disabled:opacity-35 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  title="Mark selected as unread"
                >
                  <Circle className="w-3.5 h-3.5 text-[var(--app-text-muted)]" />
                  <span>Unread</span>
                </button>
                <button
                  type="button"
                  disabled={selectedBooks.length === 0}
                  onClick={() => handleRequestDeleteBooks(selectedBooks)}
                  className="h-7 px-2 rounded-md text-[11px] flex items-center gap-1.5 text-[#f85149] hover:bg-[#e5484d]/15 disabled:opacity-35 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  title="Delete selected permanently"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
                <span className="h-3.5 w-px bg-[var(--app-border)] mx-1" />
                <button
                  type="button"
                  onClick={exitSelectionMode}
                  className="h-7 px-2 rounded-md text-[11px] flex items-center gap-1 text-[var(--app-text-muted)] hover:text-[var(--app-text-strong)] hover:bg-[var(--app-surface-hover)] transition-colors cursor-pointer"
                  title="Exit selection mode (Esc)"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Done</span>
                </button>
              </div>
            )}
          </div>

          {/* Right Controls: Search & View Toggle */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#555555] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search library..."
                className="ice-input h-7 pl-8 pr-2.5 w-60 text-xs"
              />
            </div>

            <div className="flex items-center gap-0.5 border border-white/[0.08] rounded-md p-0.5 bg-[#0a0a0a]">
              <button
                onClick={() => setViewMode('grid')}
                className={`w-6 h-6 flex items-center justify-center rounded-[4px] transition-colors cursor-pointer ${
                  viewMode === 'grid' ? 'bg-[#1f1f1f] text-white' : 'text-[#666666] hover:text-white'
                }`}
                title="Grid view"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`w-6 h-6 flex items-center justify-center rounded-[4px] transition-colors cursor-pointer ${
                  viewMode === 'list' ? 'bg-[#1f1f1f] text-white' : 'text-[#666666] hover:text-white'
                }`}
                title="List view"
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </header>

        {/* Minimal Sort Strip */}
        <div className="h-8 px-5 border-b border-white/[0.06] flex items-center text-[11px] text-[#666666] select-none bg-[#0a0a0a] shrink-0">
          <button
            type="button"
            onClick={() => handleSortClick('title')}
            className={`w-[38%] flex items-center gap-1 cursor-pointer text-left ${sortBy === 'title' ? 'text-[var(--app-text-strong)]' : 'hover:text-[var(--app-text-strong)]'}`}
          >
            <span>Title{sortBy === 'title' ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}</span>
          </button>
          <button
            type="button"
            onClick={() => handleSortClick('author')}
            className={`w-[24%] flex items-center gap-1 cursor-pointer text-left ${sortBy === 'author' ? 'text-[var(--app-text-strong)]' : 'hover:text-[var(--app-text-strong)]'}`}
          >
            <span>Author{sortBy === 'author' ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}</span>
          </button>
          <button
            type="button"
            onClick={() => handleSortClick('date')}
            className={`w-[14%] flex items-center gap-1 cursor-pointer text-left ${sortBy === 'date' ? 'text-[var(--app-text-strong)]' : 'hover:text-[var(--app-text-strong)]'}`}
          >
            <span>Date{sortBy === 'date' ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}</span>
          </button>
          <button
            type="button"
            onClick={() => handleSortClick('notes')}
            className={`w-[12%] flex items-center gap-1 cursor-pointer text-left ${sortBy === 'notes' ? 'text-[var(--app-text-strong)]' : 'hover:text-[var(--app-text-strong)]'}`}
          >
            <span>Notes{sortBy === 'notes' ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}</span>
          </button>
          <button
            type="button"
            onClick={() => handleSortClick('progress')}
            className={`w-[12%] flex items-center justify-end gap-1 cursor-pointer pr-4 ${sortBy === 'progress' ? 'text-[var(--app-text-strong)]' : 'hover:text-[var(--app-text-strong)]'}`}
          >
            <span>Progress{sortBy === 'progress' ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}</span>
          </button>
        </div>

        {/* Catalog Body */}
        <div
          ref={catalogScrollRef}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="flex-1 overflow-y-auto p-5 scroll-smooth"
        >
          {statusMessage && (
            <div className="mb-4 px-3 py-2 bg-[#232732] border border-[#2a69df]/40 text-[#79c0ff] text-xs rounded-[2px]">
              {statusMessage}
            </div>
          )}

          {filteredBooks.length === 0 && !canShowAddCard ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 select-none">
              <p className="text-[13px] text-[#8b949e] mb-6">
                {searchQuery.trim()
                  ? `No books matching "${searchQuery.trim()}".`
                  : `No books found in "${shelfTitle}".`}
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
              {canShowAddCard && (
                <AddBookCard
                  onClick={() => setIsImportModalOpen(true)}
                  viewMode="grid"
                  disabled={isLoading}
                  categoryName={activeCustomCategory?.name ?? null}
                />
              )}
              {filteredBooks.map((book) => (
                <BookCard
                  key={book.id}
                  book={book}
                  categories={categories}
                  onOpen={handleOpenBook}
                  onUpdate={loadData}
                  viewMode="grid"
                  isSelectionMode={isSelectionMode}
                  isSelected={book.id !== undefined && selectedBookIds.has(book.id)}
                  selectedCount={selectedVisibleIds.length}
                  onToggleSelect={handleToggleSelectBook}
                  onSelectThis={handleSelectThisBook}
                  onPinAction={(target, nextPinned) =>
                    handlePinBooks(resolveActionTargets(target), nextPinned)
                  }
                  onFavoriteAction={(target, nextFav) =>
                    handleFavoriteBooks(resolveActionTargets(target), nextFav)
                  }
                  onMarkReadAction={(target) => handleMarkReadBooks(resolveActionTargets(target))}
                  onMarkUnreadAction={(target) => handleMarkUnreadBooks(resolveActionTargets(target))}
                  onAssignCategoryAction={(target, catId) =>
                    handleAssignCategoryBooks(resolveActionTargets(target), catId)
                  }
                  onDeleteRequest={(target) =>
                    handleRequestDeleteBooks(resolveActionTargets(target))
                  }
                />
              ))}
            </div>
          ) : (
            <div className="bg-[#1f232d] border border-[#2b2f3a] rounded-[2px] divide-y divide-[#2b2f3a]">
              {canShowAddCard && (
                <AddBookCard
                  onClick={() => setIsImportModalOpen(true)}
                  viewMode="list"
                  disabled={isLoading}
                  categoryName={activeCustomCategory?.name ?? null}
                />
              )}
              {filteredBooks.map((book) => (
                <BookCard
                  key={book.id}
                  book={book}
                  categories={categories}
                  onOpen={handleOpenBook}
                  onUpdate={loadData}
                  viewMode="list"
                  isSelectionMode={isSelectionMode}
                  isSelected={book.id !== undefined && selectedBookIds.has(book.id)}
                  selectedCount={selectedVisibleIds.length}
                  onToggleSelect={handleToggleSelectBook}
                  onSelectThis={handleSelectThisBook}
                  onPinAction={(target, nextPinned) =>
                    handlePinBooks(resolveActionTargets(target), nextPinned)
                  }
                  onFavoriteAction={(target, nextFav) =>
                    handleFavoriteBooks(resolveActionTargets(target), nextFav)
                  }
                  onMarkReadAction={(target) => handleMarkReadBooks(resolveActionTargets(target))}
                  onMarkUnreadAction={(target) => handleMarkUnreadBooks(resolveActionTargets(target))}
                  onAssignCategoryAction={(target, catId) =>
                    handleAssignCategoryBooks(resolveActionTargets(target), catId)
                  }
                  onDeleteRequest={(target) =>
                    handleRequestDeleteBooks(resolveActionTargets(target))
                  }
                />
              ))}
            </div>
          )}
        </div>

        {/* Bottom Resume Bar */}
        <ResumeBar book={resumeBook} onContinue={handleOpenBook} />
      </div>

      <SettingsDrawer />

      {/* Unified Import & Bulk Category Assignment Modal */}
      <ImportBooksModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onAddFiles={handleImportFiles}
        onAddFolder={handleImportFolder}
        targetCategory={activeCustomCategory}
        allBooks={books}
        categories={categories}
        onBulkAddToCategory={handleBulkAddToCategory}
      />
    </div>
  )
}
