import React, { useEffect, useMemo, useState } from 'react'
import {
  X,
  FilePlus2,
  FolderPlus,
  Library,
  Search,
  Check,
  ChevronLeft,
  ChevronRight,
  BookOpen
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

  // Eligible main-library books not deleted and not already in the active custom category
  const eligibleBooks = useMemo(() => {
    if (!targetCategory?.id) return []
    return allBooks
      .filter((b) => !b.isDeleted && b.id !== undefined && b.categoryId !== targetCategory.id)
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

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[2px] select-none p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={targetCategory ? `Add to ${targetCategory.name}` : 'Add to Library'}
        className={`${
          step === 'library' ? 'w-[520px]' : 'w-[440px]'
        } max-w-full bg-[#171a21] border border-[#2d323f] rounded-[3px] shadow-2xl flex flex-col overflow-hidden text-xs text-[#c9d1d9] transition-[width] duration-150`}
      >
        {/* Top Modal Header */}
        <div className="h-10 bg-[#14161c] border-b border-[#232732] px-3.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {step === 'library' && (
              <button
                type="button"
                onClick={() => setStep('choose')}
                className="p-1 -ml-1 rounded-[2px] text-[#8b949e] hover:text-white hover:bg-[#232732] transition-colors"
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
            <h2 className="text-[12px] font-semibold text-white truncate">
              {step === 'library' && targetCategory
                ? `Add from Library to "${targetCategory.name}"`
                : targetCategory
                  ? `Add to "${targetCategory.name}"`
                  : 'Add to Library'}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded-[2px] text-[#8b949e] hover:text-white hover:bg-[#282c37] transition-colors"
            title="Close (Esc)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Step 1: Choose Import Source */}
        {step === 'choose' ? (
          <>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={handleChooseFiles}
                  className="p-4 bg-[#1c1f26] hover:bg-[#232836] border border-[#2a2f3d] hover:border-[#2a69df] rounded-[2px] flex flex-col items-start text-left transition-colors group focus:outline-none focus-visible:border-[#2a69df]"
                >
                  <div className="w-9 h-9 rounded-[2px] bg-[#14171f] border border-[#2a2f3d] group-hover:border-[#2a69df]/50 group-hover:bg-[#2a69df]/15 flex items-center justify-center mb-3 transition-colors">
                    <FilePlus2 className="w-4.5 h-4.5 text-[#58a6ff]" />
                  </div>
                  <div className="text-[13px] font-semibold text-white">Add Book</div>
                  <div className="text-[11px] text-[#8b949e] mt-0.5 leading-snug">
                    Select one or more files from your computer
                  </div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-[#6e7681] mt-2.5">
                    EPUB, PDF, MOBI, TXT
                  </div>
                </button>

                <button
                  type="button"
                  onClick={handleChooseFolder}
                  className="p-4 bg-[#1c1f26] hover:bg-[#232836] border border-[#2a2f3d] hover:border-[#2a69df] rounded-[2px] flex flex-col items-start text-left transition-colors group focus:outline-none focus-visible:border-[#2a69df]"
                >
                  <div className="w-9 h-9 rounded-[2px] bg-[#14171f] border border-[#2a2f3d] group-hover:border-[#2a69df]/50 group-hover:bg-[#2a69df]/15 flex items-center justify-center mb-3 transition-colors">
                    <FolderPlus className="w-4.5 h-4.5 text-[#8b949e] group-hover:text-[#58a6ff] transition-colors" />
                  </div>
                  <div className="text-[13px] font-semibold text-white">Add Folder</div>
                  <div className="text-[11px] text-[#8b949e] mt-0.5 leading-snug">
                    Scan a directory and bulk import all books
                  </div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-[#6e7681] mt-2.5">
                    Recursive Scan
                  </div>
                </button>
              </div>

              {/* Bulk Pick from Main Library (shown when inside a custom category) */}
              {targetCategory && (
                <button
                  type="button"
                  onClick={() => setStep('library')}
                  className="w-full p-3.5 bg-[#1c1f26] hover:bg-[#232836] border border-[#2a2f3d] hover:border-[#2a69df] rounded-[2px] flex items-center justify-between text-left transition-colors group focus:outline-none focus-visible:border-[#2a69df]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-[2px] bg-[#14171f] border border-[#2a2f3d] group-hover:border-[#2a69df]/50 group-hover:bg-[#2a69df]/15 flex items-center justify-center shrink-0 transition-colors">
                      <Library className="w-4 h-4 text-[#58a6ff]" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold text-white">
                        Bulk Add from Main Library
                      </div>
                      <div className="text-[11px] text-[#8b949e] truncate">
                        {eligibleBooks.length > 0
                          ? `Select from ${eligibleBooks.length} existing ${eligibleBooks.length === 1 ? 'book' : 'books'} in your library`
                          : 'All existing library books are already in this category'}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#6e7681] group-hover:text-white shrink-0 transition-colors" />
                </button>
              )}
            </div>

            <div className="px-4 py-2.5 bg-[#14161c] border-t border-[#232732] flex items-center justify-between text-[11px] text-[#6e7681]">
              <span>You can also drag and drop files directly onto the shelf.</span>
              <span className="font-mono text-[10px] text-[#8b949e]">Ctrl+O</span>
            </div>
          </>
        ) : (
          /* Step 2: Bulk Picker from Main Library */
          <>
            {/* Filter & Select-All Strip */}
            <div className="p-3 bg-[#1a1d25] border-b border-[#232732] flex items-center gap-2 shrink-0">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-[#6e7681] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  placeholder="Filter by title or author..."
                  autoFocus
                  className="ice-input w-full h-7 pl-8 pr-2.5 text-xs rounded-[2px]"
                />
              </div>
              {filteredEligibleBooks.length > 0 && (
                <button
                  type="button"
                  onClick={handleToggleSelectAllVisible}
                  className="ice-btn-dark h-7 px-2.5 text-[11px] rounded-[2px] shrink-0"
                >
                  {allVisibleSelected ? 'Deselect all' : 'Select all'}
                </button>
              )}
            </div>

            {/* Book Checklist */}
            <div className="max-h-[320px] overflow-y-auto divide-y divide-[#232732] bg-[#171a21]">
              {filteredEligibleBooks.length === 0 ? (
                <div className="py-10 px-6 text-center text-[#8b949e] space-y-2">
                  <p className="text-xs">
                    {eligibleBooks.length === 0
                      ? 'Every book in your main library is already assigned to this category.'
                      : 'No matching books found.'}
                  </p>
                  {eligibleBooks.length === 0 && (
                    <button
                      type="button"
                      onClick={() => setStep('choose')}
                      className="ice-btn-dark px-3 h-7 text-[11px] rounded-[2px] mt-1"
                    >
                      Import new files instead
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
                        isChecked ? 'bg-[#2a69df]/12 hover:bg-[#2a69df]/18' : 'hover:bg-[#1f2430]'
                      }`}
                    >
                      {/* Checkbox */}
                      <div
                        className={`w-4 h-4 rounded-[2px] border flex items-center justify-center shrink-0 transition-colors ${
                          isChecked
                            ? 'bg-[#2a69df] border-[#2a69df] text-white'
                            : 'bg-[#14161c] border-[#3c4354]'
                        }`}
                      >
                        {isChecked && <Check className="w-3 h-3" strokeWidth={2.5} />}
                      </div>

                      {/* Mini Cover Thumbnail */}
                      <div className="w-6 h-8 bg-[#14161c] border border-[#2d323f] rounded-[2px] overflow-hidden shrink-0 flex items-center justify-center">
                        {book.coverDataUrl ? (
                          <img
                            src={book.coverDataUrl}
                            alt=""
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <BookOpen className="w-3 h-3 text-[#6e7681]" />
                        )}
                      </div>

                      {/* Title & Author */}
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] font-medium text-white truncate leading-tight">
                          {book.title}
                        </div>
                        <div className="text-[11px] text-[#8b949e] truncate leading-tight mt-0.5">
                          {book.author || 'Unknown'}
                        </div>
                      </div>

                      {/* Existing Category Tag (if moving from another shelf) */}
                      {currentCat && (
                        <span
                          className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 bg-[#14161c] border border-[#2d323f] rounded-[2px] shrink-0 max-w-[110px]"
                          title={`Currently in ${currentCat.name}`}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: currentCat.color }}
                          />
                          <span className="text-[#8b949e] truncate">{currentCat.name}</span>
                        </span>
                      )}

                      <span className="uppercase text-[10px] font-mono text-[#6e7681] shrink-0">
                        {book.format}
                      </span>
                    </button>
                  )
                })
              )}
            </div>

            {/* Action Footer */}
            <div className="px-3.5 py-2.5 bg-[#14161c] border-t border-[#232732] flex items-center justify-between shrink-0">
              <span className="text-[11px] text-[#8b949e]">
                {selectedIds.size === 0
                  ? 'Select books to add'
                  : `${selectedIds.size} ${selectedIds.size === 1 ? 'book' : 'books'} selected`}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="ice-btn-dark h-7 px-3 text-[11px] rounded-[2px]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmBulkAdd}
                  disabled={selectedIds.size === 0 || isApplying}
                  className="h-7 px-3 text-[11px] font-medium bg-[#2a69df] hover:bg-[#3576f0] disabled:opacity-45 disabled:hover:bg-[#2a69df] text-white rounded-[2px] transition-colors"
                >
                  {isApplying
                    ? 'Adding...'
                    : `Add ${selectedIds.size > 0 ? selectedIds.size : ''} to ${targetCategory?.name || 'Category'}`}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
