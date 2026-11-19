import React, { useEffect, useMemo, useState } from 'react'
import {
  X,
  Bookmark,
  Trash2,
  Plus,
  Search,
  Edit3,
  Check,
  ArrowUpDown,
  BookmarkCheck
} from 'lucide-react'
import { useAppStore } from '../../stores/useAppStore'
import { db, type Bookmark as BookmarkItem } from '../../db'

interface BookmarksDrawerProps {
  currentPage: number
  currentCfi?: string
  isCurrentPageBookmarked?: boolean
  onToggleCurrentBookmark?: () => Promise<void>
  onJumpToCfi: (cfi: string, pageNumber?: number) => void
  onDeleteBookmark?: (id: number) => Promise<void>
  onRenameBookmark?: (id: number, label: string) => Promise<void>
  onClearAllBookmarks?: () => Promise<void>
}

type BookmarkSort = 'page' | 'newest' | 'oldest'

export const BookmarksDrawer: React.FC<BookmarksDrawerProps> = ({
  currentPage,
  currentCfi = '',
  isCurrentPageBookmarked: isCurrentPageBookmarkedProp,
  onToggleCurrentBookmark: onToggleCurrentBookmarkProp,
  onJumpToCfi,
  onDeleteBookmark: onDeleteBookmarkProp,
  onRenameBookmark: onRenameBookmarkProp,
  onClearAllBookmarks: onClearAllBookmarksProp
}) => {
  const { isBookmarksDrawerOpen, toggleBookmarksDrawer, activeBook, bookmarksVersion, openConfirmDialog } =
    useAppStore()
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([])

  const isCurrentPageBookmarked =
    isCurrentPageBookmarkedProp ?? bookmarks.some((b) => b.pageNumber === currentPage)

  const onToggleCurrentBookmark = async () => {
    if (onToggleCurrentBookmarkProp) {
      await onToggleCurrentBookmarkProp()
    } else if (activeBook?.id) {
      const existing = bookmarks.find((b) => b.pageNumber === currentPage)
      if (existing?.id) {
        await db.bookmarks.delete(existing.id)
      } else {
        const safePage = Number.isFinite(currentPage) && currentPage > 0 ? currentPage : 1
        await db.bookmarks.add({
          bookId: activeBook.id,
          cfi: currentCfi || String(safePage),
          label: `Page ${safePage}`,
          pageNumber: safePage,
          createdAt: Date.now()
        })
      }
    }
    await loadBookmarks()
  }

  const onDeleteBookmark = async (id: number) => {
    if (onDeleteBookmarkProp) {
      await onDeleteBookmarkProp(id)
    } else {
      await db.bookmarks.delete(id)
    }
    await loadBookmarks()
  }

  const onRenameBookmark = async (id: number, label: string) => {
    if (onRenameBookmarkProp) {
      await onRenameBookmarkProp(id, label)
    } else {
      await db.bookmarks.update(id, { label })
    }
    await loadBookmarks()
  }

  const onClearAllBookmarks = async () => {
    if (onClearAllBookmarksProp) {
      await onClearAllBookmarksProp()
    } else if (activeBook?.id) {
      await db.bookmarks.where('bookId').equals(activeBook.id).delete()
    }
    await loadBookmarks()
  }
  const [searchQuery, setSearchQuery] = useState('')
  const [sortMode, setSortMode] = useState<BookmarkSort>('page')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [labelDraft, setLabelDraft] = useState('')

  const loadBookmarks = async () => {
    if (!activeBook?.id) return
    const items = await db.bookmarks.where('bookId').equals(activeBook.id).toArray()
    setBookmarks(items)
  }

  useEffect(() => {
    if (isBookmarksDrawerOpen) {
      loadBookmarks()
    }
  }, [isBookmarksDrawerOpen, activeBook?.id, bookmarksVersion])

  const filteredAndSorted = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const list = bookmarks.filter((bm) => {
      if (!q) return true
      const hay = `${bm.label} ${bm.excerpt || ''} ${bm.chapterTitle || ''} p.${bm.pageNumber}`.toLowerCase()
      return hay.includes(q)
    })

    list.sort((a, b) => {
      if (sortMode === 'page') {
        if (a.pageNumber !== b.pageNumber) return a.pageNumber - b.pageNumber
        return a.createdAt - b.createdAt
      }
      if (sortMode === 'newest') return b.createdAt - a.createdAt
      return a.createdAt - b.createdAt
    })
    return list
  }, [bookmarks, searchQuery, sortMode])

  if (!isBookmarksDrawerOpen) return null

  const startRename = (bm: BookmarkItem) => {
    if (!bm.id) return
    setEditingId(bm.id)
    setLabelDraft(bm.label || `Page ${bm.pageNumber}`)
  }

  const commitRename = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (editingId == null) return
    const cleaned = labelDraft.trim()
    if (cleaned) {
      await onRenameBookmark(editingId, cleaned)
    }
    setEditingId(null)
  }

  return (
    <>
      {/* Backdrop for click-outside dismissal */}
      <div
        className="fixed inset-0 top-8 bg-black/40 z-40 transition-opacity"
        onClick={() => toggleBookmarksDrawer(false)}
      />

      <aside className="fixed top-8 bottom-0 left-0 w-[340px] bg-[#171a21] border-r border-[#232732] z-50 flex flex-col justify-between shadow-2xl select-none app-no-drag animate-in slide-in-from-left duration-150">
        <div className="flex flex-col h-full overflow-hidden">
          {/* Header */}
          <div className="h-10 bg-[#14161c] border-b border-[#232732] px-3 flex items-center justify-between shrink-0 app-no-drag">
            <div className="flex items-center gap-2">
              <Bookmark className="w-4 h-4 text-[#2a69df]" />
              <span className="text-[13px] font-semibold text-white">
                Bookmarks ({bookmarks.length})
              </span>
            </div>
            <button
              type="button"
              onClick={() => toggleBookmarksDrawer(false)}
              className="app-no-drag w-6 h-6 flex items-center justify-center text-[#8b949e] hover:text-white hover:bg-[#282c37] rounded-[2px] transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-4 h-4 pointer-events-none" />
            </button>
          </div>

          {/* Primary Toggle Bookmark CTA */}
          <div className="p-2 border-b border-[#232732] bg-[#15181f] space-y-2 shrink-0">
            <button
              type="button"
              onClick={onToggleCurrentBookmark}
              className={`w-full h-8 gap-1.5 text-xs rounded-[2px] flex items-center justify-center font-medium transition-colors cursor-pointer ${
                isCurrentPageBookmarked
                  ? 'bg-[var(--app-accent-soft)] hover:brightness-95 border border-[var(--app-accent)]/50 text-[var(--app-accent-text)]'
                  : 'ice-btn-blue'
              }`}
              title="Toggle bookmark on current page (Ctrl+B)"
            >
              {isCurrentPageBookmarked ? (
                <>
                  <BookmarkCheck className="w-3.5 h-3.5 text-[#58a6ff]" />
                  <span>Remove bookmark on page {currentPage}</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  <span>Bookmark page {currentPage}</span>
                </>
              )}
            </button>

            {/* Search & Sort */}
            {bookmarks.length > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-[#6e7681] absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filter bookmarks..."
                    className="ice-input w-full h-7 pl-7 pr-6 text-[11px] rounded-[2px]"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[#6e7681] hover:text-white"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <div className="relative flex items-center">
                  <ArrowUpDown className="w-3 h-3 text-[#6e7681] absolute left-2 pointer-events-none" />
                  <select
                    value={sortMode}
                    onChange={(e) => setSortMode(e.target.value as BookmarkSort)}
                    className="ice-input h-7 pl-6 pr-2 text-[11px] rounded-[2px] cursor-pointer"
                    title="Sort bookmarks"
                  >
                    <option value="page">Page order</option>
                    <option value="newest">Newest</option>
                    <option value="oldest">Oldest</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Bookmarks List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-2 text-[12px]">
            {filteredAndSorted.length === 0 ? (
              <div className="text-center py-12 px-4 text-[#6e7681]">
                <Bookmark className="w-8 h-8 mx-auto mb-2.5 opacity-30" />
                <p className="text-[#9da7b3] font-medium">
                  {bookmarks.length === 0 ? 'No bookmarks yet' : 'No matching bookmarks'}
                </p>
                <p className="text-[11px] mt-1 text-[#6e7681]">
                  {bookmarks.length === 0
                    ? 'Press Ctrl+B or click the ribbon icon to save your place.'
                    : 'Try clearing your filter query.'}
                </p>
              </div>
            ) : (
              filteredAndSorted.map((bm) => {
                const isEditing = editingId === bm.id
                const isCurrent = bm.pageNumber === currentPage
                return (
                  <div
                    key={bm.id}
                    onClick={() => {
                      if (isEditing) return
                      onJumpToCfi(bm.cfi, bm.pageNumber)
                      toggleBookmarksDrawer(false)
                    }}
                    className={`p-2.5 rounded-[2px] border cursor-pointer transition-colors group space-y-1.5 ${
                      isCurrent
                        ? 'bg-[var(--app-accent-soft)] border-[var(--app-accent)]/50 hover:brightness-95'
                        : 'bg-[#1c202a] hover:bg-[#232836] border-[#282c38]'
                    }`}
                  >
                    {/* Top Row: Title/Rename + Page & Actions */}
                    <div className="flex items-center justify-between gap-2">
                      {isEditing ? (
                        <form
                          onSubmit={commitRename}
                          onClick={(e) => e.stopPropagation()}
                          className="flex-1 flex items-center gap-1"
                        >
                          <input
                            autoFocus
                            type="text"
                            value={labelDraft}
                            onChange={(e) => setLabelDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') {
                                e.stopPropagation()
                                setEditingId(null)
                              }
                            }}
                            className="ice-input flex-1 h-6 px-2 text-[11px] rounded-[2px]"
                          />
                          <button
                            type="submit"
                            className="w-6 h-6 flex items-center justify-center rounded-[2px] bg-[#2a69df] text-white"
                            title="Save label"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                        </form>
                      ) : (
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Bookmark
                            className={`w-3.5 h-3.5 shrink-0 ${
                              isCurrent ? 'text-[#58a6ff] fill-current' : 'text-[#2a69df]'
                            }`}
                          />
                          <span className="font-medium text-white truncate">{bm.label}</span>
                        </div>
                      )}

                      {!isEditing && (
                        <div
                          className="flex items-center gap-1 shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="text-[10px] font-mono text-[#9da7b3] bg-[#14161c] px-1.5 py-0.5 rounded-[2px]">
                            p.{bm.pageNumber}
                          </span>
                          <button
                            type="button"
                            onClick={() => startRename(bm)}
                            className="w-5 h-5 flex items-center justify-center rounded-[2px] text-[#6e7681] hover:text-white hover:bg-[#2d3343] opacity-70 group-hover:opacity-100 transition-opacity cursor-pointer"
                            title="Rename bookmark"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const label = bm.label || `Page ${bm.pageNumber}`
                              openConfirmDialog({
                                title: 'Delete Bookmark?',
                                message: `Are you sure you want to remove the bookmark for "${label}"?`,
                                confirmLabel: 'Delete Bookmark',
                                cancelLabel: 'Cancel',
                                danger: true,
                                onConfirm: async () => {
                                  if (bm.id) await onDeleteBookmark(bm.id)
                                }
                              })
                            }}
                            className="w-5 h-5 flex items-center justify-center rounded-[2px] text-[#6e7681] hover:text-[#f85149] hover:bg-[#2d3343] opacity-70 group-hover:opacity-100 transition-opacity cursor-pointer"
                            title="Delete bookmark"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Auto-Extracted First Visible Page Excerpt (Icecream getBookmarkData) */}
                    {bm.excerpt && (
                      <div className="text-[11px] text-[#b4bec8] font-serif italic line-clamp-2 bg-[#14161c] px-2 py-1.5 rounded-[2px] border border-[#232732]">
                        &ldquo;{bm.excerpt}&rdquo;
                      </div>
                    )}

                    {/* Chapter + Date Metadata */}
                    <div className="flex items-center justify-between text-[10px] text-[#6e7681]">
                      <span className="truncate max-w-[190px]">
                        {bm.chapterTitle || (bm.progressPercent != null && Math.round(bm.progressPercent) >= 1 ? `${Math.round(bm.progressPercent)}% read` : '')}
                      </span>
                      <span>{new Date(bm.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Footer: Clear All Bookmarks */}
          {bookmarks.length > 0 && (
            <div className="p-2 border-t border-[#232732] bg-[#14161c] shrink-0">
              <button
                type="button"
                onClick={() => {
                  openConfirmDialog({
                    title: `Clear All ${bookmarks.length} Bookmarks?`,
                    message: `Are you sure you want to delete all ${bookmarks.length} bookmarks for this book? This action cannot be undone.`,
                    confirmLabel: `Delete All ${bookmarks.length} Bookmarks`,
                    cancelLabel: 'Cancel',
                    danger: true,
                    onConfirm: async () => {
                      await onClearAllBookmarks()
                    }
                  })
                }}
                className="ice-btn-dark w-full h-7 text-[11px] gap-1.5 text-[#8b949e] hover:text-[#f85149] rounded-[2px] cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
                <span>Clear all {bookmarks.length} bookmarks</span>
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
