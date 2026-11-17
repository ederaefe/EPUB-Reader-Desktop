import React, { useEffect, useMemo, useState } from 'react'
import {
  X,
  BookOpen,
  FolderInput,
  Library,
  Search,
  Check,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import type { Book, Category } from '../../db'

interface ImportBooksModalProps {
  isOpen: boolean
  onClose: () => void
  onAddFiles: () => void
  onAddFolder: () => void
  targetCategory: Category | null
  allBooks: Book[]
  categories: Category[]
  onBulkAddToCategory: (bookIds: number[], categoryId: number) => Promise<void>
}

export const ImportBooksModal: React.FC<ImportBooksModalProps> = ({
  isOpen,
  onClose,
  onAddFiles,
  onAddFolder,
  targetCategory,
  allBooks,
  categories,
  onBulkAddToCategory
}) => {
  const [step, setStep] = useState<'choose' | 'library'>('choose')
  const [filterText, setFilterText] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [isApplying, setIsApplying] = useState(false)

  // Reset modal internal state whenever opened or target category changes
  useEffect(() => {
    if (isOpen) {
      setStep('choose')
      setFilterText('')
      setSelectedIds(new Set())
      setIsApplying(false)
    }
  }, [isOpen, targetCategory?.id])

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  const categoryMap = useMemo(() => {
    const map = new Map<number, Category>()
    for (const c of categories) {
      if (c.id !== undefined) map.set(c.id, c)
    }
    return map
  }, [categories])

  // Eligible main-library books not already in the active custom category
  const eligibleBooks = useMemo(() => {
    if (!targetCategory?.id) return []
    return allBooks
      .filter((b) => b.id !== undefined && b.categoryId !== targetCategory.id)
      .sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0))
  }, [allBooks, targetCategory?.id])

  const filteredEligibleBooks = useMemo(() => {
    const q = filterText.trim().toLowerCase()
    if (!q) return eligibleBooks
    return eligibleBooks.filter(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        (b.author && b.author.toLowerCase().includes(q))
    )
  }, [eligibleBooks, filterText])

  if (!isOpen) return null

  const toggleBookSelection = (bookId: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(bookId)) {
        next.delete(bookId)
      } else {
        next.add(bookId)
      }
      return next
    })
  }

  const allVisibleSelected =
    filteredEligibleBooks.length > 0 &&
    filteredEligibleBooks.every((b) => b.id !== undefined && selectedIds.has(b.id))

  const handleToggleSelectAllVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allVisibleSelected) {
        for (const b of filteredEligibleBooks) {
          if (b.id !== undefined) next.delete(b.id)
        }
      } else {
        for (const b of filteredEligibleBooks) {
          if (b.id !== undefined) next.add(b.id)
        }
      }
      return next
    })
  }

  const handleConfirmBulkAdd = async () => {
    if (!targetCategory?.id || selectedIds.size === 0 || isApplying) return
    setIsApplying(true)
    try {
      await onBulkAddToCategory(Array.from(selectedIds), targetCategory.id)
      onClose()
    } finally {
      setIsApplying(false)
    }
  }

  const handleChooseFiles = () => {
    onClose()
    onAddFiles()
  }

  const handleChooseFolder = () => {
    onClose()
    onAddFolder()
  }

  const dialogTitle =
    step === 'library' && targetCategory
      ? `Open from Library into "${targetCategory.name}"`
      : targetCategory
        ? `Open in "${targetCategory.name}"`
        : 'Open to Library'

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-[2px] select-none p-4 animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={dialogTitle}
        className={`${
          step === 'library' ? 'w-[520px]' : 'w-[460px]'
        } max-w-full bg-[var(--app-surface)] border border-[var(--app-border-strong)] rounded-xl shadow-2xl flex flex-col overflow-hidden text-xs text-[var(--app-text)] transition-[width] duration-150 animate-in zoom-in-95`}
      >
        {/* Top Modal Header */}
        <div className="h-11 bg-[var(--app-chrome)] border-b border-[var(--app-border)] px-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {step === 'library' && (
              <button
                type="button"
                onClick={() => setStep('choose')}
                className="w-6 h-6 -ml-1 flex items-center justify-center rounded-md text-[var(--app-text-muted)] hover:text-[var(--app-text-strong)] hover:bg-[var(--app-overlay-tint)] transition-colors"
                title="Back"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
            {targetCategory && (
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: targetCategory.color }}
              />
            )}
            <h2 className="text-[13px] font-semibold text-[var(--app-text-strong)] truncate">
              {dialogTitle}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="settings-close-btn w-6 h-6 flex items-center justify-center rounded-md"
            title="Close (Esc)"
            aria-label="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Step 1: Choose Source (harmonized with shelf Open squircle card) */}
        {step === 'choose' ? (
          <>
            <div className="p-4 space-y-3 bg-[var(--app-bg)]">
              <div className="grid grid-cols-2 gap-3.5">
                {/* Open Book Card */}
                <button
                  type="button"
                  onClick={handleChooseFiles}
                  className="px-4 py-6 rounded-xl bg-[var(--app-surface)] hover:bg-[var(--app-surface-hover)] border-2 border-dashed border-[var(--app-border-strong)] hover:border-[var(--app-accent)] flex flex-col items-center text-center transition-all duration-150 hover:-translate-y-0.5 group focus:outline-none focus-visible:border-[var(--app-accent)]"
                >
                  <div className="w-12 h-12 rounded-full bg-[var(--app-surface-2)] border border-[var(--app-border)] group-hover:bg-[var(--app-accent-soft)] group-hover:border-[var(--app-accent)]/40 flex items-center justify-center mb-3.5 transition-all duration-150">
                    <BookOpen
                      className="w-5 h-5 text-[var(--app-text-muted)] group-hover:text-[var(--app-accent-text)] transition-colors"
                      strokeWidth={2}
                    />
                  </div>
                  <div className="text-[13px] font-semibold text-[var(--app-text-strong)]">
                    Open Book
                  </div>
                  <div className="text-[11px] font-normal text-[var(--app-text-muted)] mt-1 leading-relaxed max-w-[165px]">
                    Select one or more files from your computer
                  </div>
                  <div className="mt-3.5 px-2 py-0.5 rounded-md bg-[var(--app-surface-2)] border border-[var(--app-border)] text-[9.5px] font-mono uppercase tracking-wider text-[var(--app-text-subtle)] group-hover:text-[var(--app-text-muted)] transition-colors">
                    EPUB · PDF · MOBI · TXT
                  </div>
                </button>

                {/* Import Folder Card */}
                <button
                  type="button"
                  onClick={handleChooseFolder}
                  className="px-4 py-6 rounded-xl bg-[var(--app-surface)] hover:bg-[var(--app-surface-hover)] border-2 border-dashed border-[var(--app-border-strong)] hover:border-[var(--app-accent)] flex flex-col items-center text-center transition-all duration-150 hover:-translate-y-0.5 group focus:outline-none focus-visible:border-[var(--app-accent)]"
                >
                  <div className="w-12 h-12 rounded-full bg-[var(--app-surface-2)] border border-[var(--app-border)] group-hover:bg-[var(--app-accent-soft)] group-hover:border-[var(--app-accent)]/40 flex items-center justify-center mb-3.5 transition-all duration-150">
                    <FolderInput
                      className="w-5 h-5 text-[var(--app-text-muted)] group-hover:text-[var(--app-accent-text)] transition-colors"
                      strokeWidth={2}
                    />
                  </div>
                  <div className="text-[13px] font-semibold text-[var(--app-text-strong)]">
                    Import Folder
                  </div>
                  <div className="text-[11px] font-normal text-[var(--app-text-muted)] mt-1 leading-relaxed max-w-[165px]">
                    Scan a directory and bulk import all books
                  </div>
                  <div className="mt-3.5 px-2 py-0.5 rounded-md bg-[var(--app-surface-2)] border border-[var(--app-border)] text-[9.5px] font-mono uppercase tracking-wider text-[var(--app-text-subtle)] group-hover:text-[var(--app-text-muted)] transition-colors">
                    Recursive Scan
                  </div>
                </button>
              </div>

              {/* Pick from Main Library (shown when inside a custom category) */}
              {targetCategory && (
                <button
                  type="button"
                  onClick={() => setStep('library')}
                  className="w-full px-3.5 py-3 rounded-xl bg-[var(--app-surface)] hover:bg-[var(--app-surface-hover)] border border-dashed border-[var(--app-border-strong)] hover:border-[var(--app-accent)] flex items-center justify-between text-left transition-all duration-150 group focus:outline-none focus-visible:border-[var(--app-accent)]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-[var(--app-surface-2)] border border-[var(--app-border)] group-hover:bg-[var(--app-accent-soft)] group-hover:border-[var(--app-accent)]/40 flex items-center justify-center shrink-0 transition-colors">
                      <Library className="w-4 h-4 text-[var(--app-text-muted)] group-hover:text-[var(--app-accent-text)] transition-colors" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[12.5px] font-semibold text-[var(--app-text-strong)]">
                        Open from Main Library
                      </div>
                      <div className="text-[11px] font-normal text-[var(--app-text-muted)] truncate">
                        {eligibleBooks.length > 0
                          ? `Select from ${eligibleBooks.length} existing ${eligibleBooks.length === 1 ? 'book' : 'books'} in your library`
                          : 'All existing library books are already in this category'}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[var(--app-text-subtle)] group-hover:text-[var(--app-text-strong)] shrink-0 transition-colors" />
                </button>
              )}
            </div>

            <div className="px-4 py-2.5 bg-[var(--app-chrome)] border-t border-[var(--app-border)] flex items-center justify-between text-[11px] text-[var(--app-text-muted)]">
              <span className="font-normal">You can also drag and drop files directly onto the shelf.</span>
              <kbd className="settings-kbd px-1.5 py-0.5 rounded font-mono text-[10px] shrink-0">
                Ctrl+O
              </kbd>
            </div>
          </>
        ) : (
          /* Step 2: Bulk Picker from Main Library */
          <>
            {/* Filter & Select-All Strip */}
            <div className="p-3 bg-[var(--app-chrome)] border-b border-[var(--app-border)] flex items-center gap-2 shrink-0">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-[var(--app-text-subtle)] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  placeholder="Filter by title or author..."
                  autoFocus
                  className="ice-input w-full h-7 pl-8 pr-2.5 text-xs rounded-md"
                />
              </div>
              {filteredEligibleBooks.length > 0 && (
                <button
                  type="button"
                  onClick={handleToggleSelectAllVisible}
                  className="settings-btn-secondary h-7 px-2.5 text-[11px] rounded-md shrink-0"
                >
                  {allVisibleSelected ? 'Deselect all' : 'Select all'}
                </button>
              )}
            </div>

            {/* Book Checklist */}
            <div className="max-h-[320px] overflow-y-auto divide-y divide-[var(--app-border)] bg-[var(--app-surface)]">
              {filteredEligibleBooks.length === 0 ? (
                <div className="py-10 px-6 text-center text-[var(--app-text-muted)] space-y-2.5">
                  <p className="text-xs font-normal">
                    {eligibleBooks.length === 0
                      ? 'Every book in your main library is already assigned to this category.'
                      : 'No matching books found.'}
                  </p>
                  {eligibleBooks.length === 0 && (
                    <button
                      type="button"
                      onClick={() => setStep('choose')}
                      className="settings-btn-secondary px-3 h-7 text-[11px] rounded-md mt-1"
                    >
                      Open new files instead
                    </button>
                  )}
                </div>
              ) : (
                filteredEligibleBooks.map((book) => {
                  const isChecked = book.id !== undefined && selectedIds.has(book.id)
                  const currentCat =
                    book.categoryId !== null && book.categoryId !== undefined
                      ? categoryMap.get(book.categoryId)
                      : null

                  return (
                    <button
                      key={book.id}
                      type="button"
                      onClick={() => book.id !== undefined && toggleBookSelection(book.id)}
                      className={`w-full px-3.5 py-2 flex items-center gap-3 text-left transition-colors ${
                        isChecked
                          ? 'bg-[var(--app-accent-soft)]'
                          : 'hover:bg-[var(--app-surface-hover)]'
                      }`}
                    >
                      {/* Checkbox */}
                      <div
                        className={`w-4 h-4 rounded-[3px] border flex items-center justify-center shrink-0 transition-colors ${
                          isChecked
                            ? 'bg-[var(--app-accent)] border-[var(--app-accent)] text-white'
                            : 'bg-[var(--app-checkbox-bg)] border-[var(--app-checkbox-border)]'
                        }`}
                      >
                        {isChecked && <Check className="w-3 h-3" strokeWidth={2.5} />}
                      </div>

                      {/* Mini Cover Thumbnail */}
                      <div className="w-6 h-8 bg-[var(--app-chrome)] border border-[var(--app-border)] rounded-[3px] overflow-hidden shrink-0 flex items-center justify-center">
                        {book.coverDataUrl ? (
                          <img
                            src={book.coverDataUrl}
                            alt=""
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <BookOpen className="w-3 h-3 text-[var(--app-text-subtle)]" />
                        )}
                      </div>

                      {/* Title & Author */}
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] font-medium text-[var(--app-text-strong)] truncate leading-tight">
                          {book.title}
                        </div>
                        <div className="text-[11px] font-normal text-[var(--app-text-muted)] truncate leading-tight mt-0.5">
                          {book.author || 'Unknown'}
                        </div>
                      </div>

                      {/* Existing Category Tag (if moving from another shelf) */}
                      {currentCat && (
                        <span
                          className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 bg-[var(--app-surface-2)] border border-[var(--app-border)] rounded shrink-0 max-w-[110px]"
                          title={`Currently in ${currentCat.name}`}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: currentCat.color }}
                          />
                          <span className="text-[var(--app-text-muted)] truncate">{currentCat.name}</span>
                        </span>
                      )}

                      <span className="uppercase text-[10px] font-mono text-[var(--app-text-subtle)] shrink-0">
                        {book.format}
                      </span>
                    </button>
                  )
                })
              )}
            </div>

            {/* Action Footer */}
            <div className="px-3.5 py-2.5 bg-[var(--app-chrome)] border-t border-[var(--app-border)] flex items-center justify-between shrink-0">
              <span className="text-[11px] font-normal text-[var(--app-text-muted)]">
                {selectedIds.size === 0
                  ? 'Select books to include'
                  : `${selectedIds.size} ${selectedIds.size === 1 ? 'book' : 'books'} selected`}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="settings-btn-secondary h-7 px-3 text-[11px] rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmBulkAdd}
                  disabled={selectedIds.size === 0 || isApplying}
                  className="settings-btn-primary h-7 px-3 text-[11px] rounded-md"
                >
                  {isApplying
                    ? 'Saving...'
                    : `Open ${selectedIds.size > 0 ? selectedIds.size : ''} in ${targetCategory?.name || 'Category'}`}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
