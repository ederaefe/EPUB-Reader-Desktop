import React, { useEffect, useState } from 'react'
import { X, Bookmark, Trash2, Plus } from 'lucide-react'
import { useAppStore } from '../../stores/useAppStore'
import { db, type Bookmark as BookmarkItem } from '../../db'

interface BookmarksDrawerProps {
  currentPage: number
  currentCfi?: string
  onJumpToCfi: (cfi: string) => void
}

export const BookmarksDrawer: React.FC<BookmarksDrawerProps> = ({
  currentPage,
  currentCfi = '',
  onJumpToCfi
}) => {
  const { isBookmarksDrawerOpen, toggleBookmarksDrawer, activeBook } = useAppStore()
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([])

  const loadBookmarks = async () => {
    if (!activeBook?.id) return
    const items = await db.bookmarks.where('bookId').equals(activeBook.id).toArray()
    setBookmarks(items)
  }

  useEffect(() => {
    if (isBookmarksDrawerOpen) {
      loadBookmarks()
    }
  }, [isBookmarksDrawerOpen, activeBook])

  const handleAddBookmark = async () => {
    if (!activeBook?.id) return
    await db.bookmarks.add({
      bookId: activeBook.id,
      cfi: currentCfi,
      label: `Page ${currentPage}`,
      pageNumber: currentPage,
      createdAt: Date.now()
    })
    loadBookmarks()
  }

  const handleDelete = async (id: number) => {
    await db.bookmarks.delete(id)
    loadBookmarks()
  }

  if (!isBookmarksDrawerOpen) return null

  return (
    <>
      {/* Backdrop for click-outside dismissal */}
      <div
        className="fixed inset-0 top-8 bg-black/40 z-40 transition-opacity"
        onClick={() => toggleBookmarksDrawer(false)}
      />

      <aside className="fixed top-8 bottom-0 left-0 w-72 bg-[#171a21] border-r border-[#232732] z-50 flex flex-col justify-between shadow-2xl select-none app-no-drag animate-in slide-in-from-left duration-150">
        <div className="flex flex-col h-full overflow-hidden">
          {/* Header */}
          <div className="h-10 bg-[#14161c] border-b border-[#232732] px-3 flex items-center justify-between app-no-drag">
            <div className="flex items-center gap-2">
              <Bookmark className="w-4 h-4 text-[#2a69df]" />
              <span className="text-[13px] font-semibold text-white">Bookmarks</span>
            </div>
            <button
              type="button"
              onClick={() => toggleBookmarksDrawer(false)}
              className="app-no-drag w-6 h-6 flex items-center justify-center text-[#8b949e] hover:text-white hover:bg-[#282c37] rounded transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-4 h-4 pointer-events-none" />
            </button>
          </div>

        {/* Add bookmark button */}
        <div className="p-2 border-b border-[#232732]">
          <button
            onClick={handleAddBookmark}
            className="ice-btn-blue w-full h-8 gap-1.5 text-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Bookmark page {currentPage}</span>
          </button>
        </div>

        {/* Bookmarks List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1 text-[12px]">
          {bookmarks.length === 0 ? (
            <div className="text-center py-10 text-[#6e7681]">
              <p>No bookmarks saved</p>
              <p className="text-[11px] mt-1 text-[#484f58]">
                Click above or press Ctrl+B to bookmark this page.
              </p>
            </div>
          ) : (
            bookmarks.map((bm) => (
              <div
                key={bm.id}
                onClick={() => {
                  if (bm.cfi) onJumpToCfi(bm.cfi)
                  toggleBookmarksDrawer(false)
                }}
                className="w-full h-9 px-2.5 bg-[#1f232d] hover:bg-[#252a36] border border-[#2b2f3a] rounded flex items-center justify-between cursor-pointer transition-colors group"
              >
                <div className="flex items-center gap-2 truncate">
                  <Bookmark className="w-3.5 h-3.5 text-[#2a69df] shrink-0" />
                  <span className="text-white truncate font-medium">{bm.label}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] text-[#6e7681]">
                    {new Date(bm.createdAt).toLocaleDateString()}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      if (bm.id) handleDelete(bm.id)
                    }}
                    className="text-[#6e7681] hover:text-[#f85149] p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </aside>
  </>
)
}
