import React, { useState } from 'react'
import {
  BookOpen,
  Star,
  Trash2,
  Folder,
  FolderOpen,
  CheckCircle2,
  Circle,
  FileCode2,
  Check,
  CheckSquare,
  Pin,
  PinOff,
  ImageIcon
} from 'lucide-react'
import type { Book, Category } from '../../db'
import { db } from '../../db'
import { useAppStore } from '../../stores/useAppStore'
import { ContextMenu, type ContextMenuItem } from '../ui/ContextMenu'
import { extractBookMetadata, extractEpubCover, generateCoverCanvas } from '../../services/coverService'

interface BookCardProps {
  book: Book
  categories?: Category[]
  onOpen: (book: Book) => void
  onUpdate: () => void
  viewMode?: 'grid' | 'list'
  isSelectionMode?: boolean
  isSelected?: boolean
  selectedCount?: number
  onToggleSelect?: (bookId: number, shiftKey: boolean) => void
  onSelectThis?: (book: Book) => void
  onPinAction?: (book: Book, nextPinned: boolean) => void
  onFavoriteAction?: (book: Book, nextFavorite: boolean) => void
  onMarkReadAction?: (book: Book) => void
  onMarkUnreadAction?: (book: Book) => void
  onAssignCategoryAction?: (book: Book, catId: number | null) => void
  onDeleteRequest?: (book: Book) => void
}

export const BookCard: React.FC<BookCardProps> = ({
  book,
  categories = [],
  onOpen,
  onUpdate,
  viewMode = 'grid',
  isSelectionMode = false,
  isSelected = false,
  selectedCount = 0,
  onToggleSelect,
  onSelectThis,
  onPinAction,
  onFavoriteAction,
  onMarkReadAction,
  onMarkUnreadAction,
  onAssignCategoryAction,
  onDeleteRequest
}) => {
  const [showCategoryMenu, setShowCategoryMenu] = useState(false)
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null)
  const showToast = useAppStore((s) => s.showToast)

  const assignedCategory = categories.find((c) => c.id === book.categoryId)
  const isBatchContext = isSelectionMode && isSelected && selectedCount > 1

  const toggleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!book.id) return
    if (onFavoriteAction) {
      onFavoriteAction(book, !book.isFavorite)
      return
    }
    await db.books.update(book.id, { isFavorite: !book.isFavorite })
    onUpdate()
  }

  const handleAssignCategory = async (e: React.MouseEvent, catId: number | null) => {
    e.stopPropagation()
    if (!book.id) return
    setShowCategoryMenu(false)
    if (onAssignCategoryAction) {
      onAssignCategoryAction(book, catId)
      return
    }
    await db.books.update(book.id, { categoryId: catId })
    onUpdate()
  }

  const handleConvertPdfToEpub = async () => {
    if (book.format !== 'pdf' || !window.desktopAPI?.convertToEpub || !window.desktopAPI?.readFileBuffer) return
    showToast('Converting PDF to EPUB offline...', 'info')
    try {
      const res = await window.desktopAPI.convertToEpub({
        pdfPath: book.filePath,
        mode: 'library'
      })
      if (!res.success || !res.epubPath) {
        showToast(res.error || 'PDF to EPUB conversion failed.', 'error')
        return
      }
      const existing = await db.books.where('filePath').equals(res.epubPath).first()
      if (!existing) {
        const epubBuf = await window.desktopAPI.readFileBuffer(res.epubPath)
        const cover =
          (await extractEpubCover(epubBuf)) ||
          book.coverDataUrl ||
          generateCoverCanvas(res.title || book.title, res.author || book.author)
        await db.books.add({
          filePath: res.epubPath,
          title: res.title || `${book.title}`,
          author: res.author || book.author || 'Unknown Author',
          coverDataUrl: cover,
          format: 'epub',
          fileSize: epubBuf.byteLength,
          addedAt: Date.now(),
          lastOpenedAt: null,
          progressCfi: null,
          progressPercent: 0,
          currentPage: 1,
          totalPages: res.pageCount || book.totalPages || 1,
          categoryId: book.categoryId,
          isFavorite: false,
          isRead: false,
          isPinned: false,
          pinnedAt: null
        })
      }
      onUpdate()
      showToast('Converted to EPUB and added to library', 'success')
    } catch (err: any) {
      showToast(err?.message || 'PDF to EPUB conversion failed.', 'error')
    }
  }

  const handleRevealInExplorer = async () => {
    if (!window.desktopAPI?.showItemInFolder) return
    const ok = await window.desktopAPI.showItemInFolder(book.filePath)
    if (!ok) {
      showToast('Book file is bundled or no longer at its original path.', 'info')
    }
  }

  const handleRefreshCover = async () => {
    if (!book.id) return
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
      }
      if (!buffer) return
      const ext = book.filePath.split('.').pop()?.toLowerCase() || book.format
      const meta = await extractBookMetadata(buffer, ext, book.title)
      if (meta.coverDataUrl) {
        await db.books.update(book.id, {
          coverDataUrl: meta.coverDataUrl,
          totalPages: meta.totalPages || book.totalPages
        })
        onUpdate()
        showToast('Cover refreshed', 'success')
      }
    } catch (err) {
      console.warn('Refresh cover failed:', err)
    }
  }

  const handleCardClick = (e: React.MouseEvent) => {
    if (isSelectionMode && book.id !== undefined && onToggleSelect) {
      e.preventDefault()
      onToggleSelect(book.id, e.shiftKey)
      return
    }
    onOpen(book)
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenuPos({ x: e.clientX, y: e.clientY })
  }

  const buildContextMenuItems = (): ContextMenuItem[] => {
    const batchSuffix = isBatchContext ? ` (${selectedCount})` : ''
    const isAlreadyFullyRead = !isBatchContext && book.isRead && (book.progressPercent || 0) >= 100
    const isAlreadyCompletelyUnread =
      !isBatchContext && !book.isRead && (book.progressPercent || 0) === 0 && (book.currentPage || 1) <= 1

    const items: ContextMenuItem[] = []

    if (!isBatchContext) {
      items.push(
        {
          id: 'open',
          label: 'Open',
          icon: <BookOpen className="w-3.5 h-3.5 text-[#2a69df]" />,
          onClick: () => onOpen(book)
        },
        { id: 'div-open', divider: true }
      )
    }

    const markAsChildren: ContextMenuItem[] = [
      {
        id: 'mark-read',
        label: 'Read',
        icon: <CheckCircle2 className="w-3.5 h-3.5 text-[#4cd964]" />,
        disabled: isAlreadyFullyRead,
        onClick: () => {
          if (onMarkReadAction) {
            onMarkReadAction(book)
          } else if (book.id) {
            db.books
              .update(book.id, {
                isRead: true,
                progressPercent: 100,
                currentPage: Math.max(book.totalPages || 1, 1)
              })
              .then(onUpdate)
          }
        }
      },
      {
        id: 'mark-unread',
        label: 'Unread',
        icon: <Circle className="w-3.5 h-3.5 text-[#8b949e]" />,
        disabled: isAlreadyCompletelyUnread,
        onClick: () => {
          if (onMarkUnreadAction) {
            onMarkUnreadAction(book)
          } else if (book.id) {
            db.books
              .update(book.id, {
                isRead: false,
                progressPercent: 0,
                currentPage: 1,
                progressCfi: null
              })
              .then(onUpdate)
          }
        }
      }
    ]

    items.push(
      {
        id: 'favorite',
        label: book.isFavorite
          ? `Remove from Favorites${batchSuffix}`
          : `Add to Favorites${batchSuffix}`,
        icon: <Star className={`w-3.5 h-3.5 ${book.isFavorite ? 'text-[#e3b341] fill-current' : ''}`} />,
        onClick: () => {
          if (onFavoriteAction) {
            onFavoriteAction(book, !book.isFavorite)
          } else if (book.id) {
            db.books.update(book.id, { isFavorite: !book.isFavorite }).then(onUpdate)
          }
        }
      },
      {
        id: 'mark-as',
        label: `Mark as${batchSuffix}`,
        icon: <CheckCircle2 className="w-3.5 h-3.5 text-[#4cd964]" />,
        children: markAsChildren
      }
    )

    if (categories.length > 0) {
      items.push({ id: 'div-cats', divider: true })
      categories.forEach((cat) => {
        const isCurrent = !isBatchContext && book.categoryId === cat.id
        items.push({
          id: `cat-${cat.id}`,
          label: `${isCurrent ? 'Remove from: ' : 'Move to: '}${cat.name}${batchSuffix}`,
          icon: <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: cat.color }} />,
          onClick: () => {
            const nextCat = isCurrent ? null : cat.id!
            if (onAssignCategoryAction) {
              onAssignCategoryAction(book, nextCat)
            } else if (book.id) {
              db.books.update(book.id, { categoryId: nextCat }).then(onUpdate)
            }
          }
        })
      })
    }

    if (!isBatchContext) {
      items.push(
        { id: 'div-tools', divider: true },
        {
          id: 'select-this',
          label: 'Select this',
          icon: <CheckSquare className="w-3.5 h-3.5 text-[#79c0ff]" />,
          onClick: () => onSelectThis?.(book)
        },
        ...(book.format === 'pdf'
          ? [
              {
                id: 'convert-epub',
                label: 'Convert to EPUB (Offline)',
                icon: <FileCode2 className="w-3.5 h-3.5 text-[#4cd964]" />,
                onClick: handleConvertPdfToEpub
              }
            ]
          : []),
        {
          id: 'reveal',
          label: 'Reveal in Explorer',
          icon: <FolderOpen className="w-3.5 h-3.5 text-[#888888]" />,
          onClick: handleRevealInExplorer
        }
      )
    }

    items.push(
      { id: 'div-delete', divider: true },
      {
        id: 'delete',
        label: isBatchContext ? `Delete ${selectedCount} Books...` : 'Delete',
        icon: <Trash2 className="w-3.5 h-3.5" />,
        danger: true,
        onClick: () => {
          onDeleteRequest?.(book)
        }
      }
    )

    return items
  }

  if (viewMode === 'list') {
    return (
      <>
        <div
          onClick={handleCardClick}
          onContextMenu={handleContextMenu}
          className={`w-full h-11 px-3 border-b border-[#2b2f3a] flex items-center justify-between text-xs text-[#c9d1d9] cursor-pointer transition-colors group select-none relative ${
            isSelected
              ? 'bg-[var(--app-accent-soft)]'
              : 'bg-[#1f232d] hover:bg-[#282c37]'
          }`}
        >
          <div className="flex items-center gap-3 flex-1 min-w-0 pr-4">
            {isSelectionMode && (
              <div
                onClick={(e) => {
                  e.stopPropagation()
                  if (book.id !== undefined) onToggleSelect?.(book.id, e.shiftKey)
                }}
                role="checkbox"
                aria-checked={isSelected}
                aria-label={`Select ${book.title}`}
                className={`w-4 h-4 rounded-[3px] border flex items-center justify-center shrink-0 transition-colors ${
                  isSelected
                    ? 'bg-[#2a69df] border-[#2a69df] text-white'
                    : 'bg-[var(--app-checkbox-bg)] border-[var(--app-checkbox-border)] hover:border-[#2a69df]'
                }`}
                data-preserve-theme={isSelected ? 'true' : undefined}
              >
                {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
              </div>
            )}

            <div className="w-6 h-8 bg-[#171a21] border border-[#3c404d] rounded-[2px] overflow-hidden shrink-0 flex items-center justify-center">
              {book.coverDataUrl ? (
                <img src={book.coverDataUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <BookOpen className="w-3 h-3 text-[#6e7681]" />
              )}
            </div>

            <span className="font-medium text-white truncate">{book.title}</span>
            <span className="text-[#8b949e] truncate">({book.author || 'Unknown'})</span>

            {book.isRead && (
              <span
                title="Read"
                className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-[#4cd964]/15 text-[#4cd964] shrink-0"
              >
                <CheckCircle2 className="w-2.5 h-2.5" />
                <span>Read</span>
              </span>
            )}

            {assignedCategory && (
              <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 bg-[#171a21] border border-[#2d323f] rounded-[2px] shrink-0">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: assignedCategory.color }} />
                <span className="text-[#c8d1dc]">{assignedCategory.name}</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-6 shrink-0 text-[11px] text-[#8b949e]">
            <span className="uppercase text-[10px] px-1.5 py-0.5 bg-[#171a21] border border-[#2d323f] rounded font-mono">
              {book.format}
            </span>
            <span className="w-16 text-right" title="Saved highlights and notes">
              {book.notesCount ? `${book.notesCount} ${book.notesCount === 1 ? 'note' : 'notes'}` : '0 notes'}
            </span>
            <span className="w-20 text-right">
              p.{book.currentPage || 1} / {book.totalPages || 1}
            </span>
            <span className="w-12 text-right font-mono tabular-nums text-[#8b949e]">
              {book.progressPercent != null && Math.round(book.progressPercent) >= 1
                ? `${Math.round(book.progressPercent)}%`
                : '—'}
            </span>
            {!isSelectionMode && (
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {categories.length > 0 && (
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setShowCategoryMenu(!showCategoryMenu)
                      }}
                      className={`p-1 rounded hover:bg-[#333846] ${assignedCategory ? 'text-[#2a69df]' : 'text-[#8b949e]'}`}
                      title="Assign Category"
                    >
                      <Folder className="w-3.5 h-3.5" />
                    </button>
                    {showCategoryMenu && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="absolute right-0 top-full mt-1 w-36 bg-[#171a21] border border-[#2d323f] rounded-[2px] shadow-xl py-1 z-30 text-[11px]"
                      >
                        <div className="px-2 py-1 text-[10px] text-[#6e7681] border-b border-[#232732] font-medium uppercase tracking-wider">
                          Category
                        </div>
                        <button
                          onClick={(e) => handleAssignCategory(e, null)}
                          className={`w-full px-2 py-1 flex items-center justify-between text-left hover:bg-[#282c37] transition-colors ${
                            !book.categoryId ? 'text-white font-medium bg-[#232732]' : 'text-[#8b949e]'
                          }`}
                        >
                          <span>None</span>
                        </button>
                        {categories.map((cat) => (
                          <button
                            key={cat.id}
                            onClick={(e) => handleAssignCategory(e, cat.id!)}
                            className={`w-full px-2 py-1 flex items-center gap-1.5 text-left hover:bg-[#282c37] transition-colors ${
                              book.categoryId === cat.id ? 'text-white font-medium bg-[#232732]' : 'text-[#c8d1dc]'
                            }`}
                          >
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                            <span className="truncate">{cat.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <button
                  onClick={toggleFavorite}
                  className={`p-1 rounded hover:bg-[#333846] ${book.isFavorite ? 'text-[#e3b341]' : 'text-[#8b949e]'}`}
                  title={book.isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
                >
                  <Star className={`w-3.5 h-3.5 ${book.isFavorite ? 'fill-current' : ''}`} />
                </button>
              </div>
            )}
          </div>
        </div>
        {contextMenuPos && (
          <ContextMenu
            x={contextMenuPos.x}
            y={contextMenuPos.y}
            items={buildContextMenuItems()}
            onClose={() => setContextMenuPos(null)}
          />
        )}
      </>
    )
  }

  // Grid view
  return (
    <>
      <div
        onClick={handleCardClick}
        onContextMenu={handleContextMenu}
        className="w-36 flex flex-col cursor-pointer group select-none transition-all duration-200 ease-out hover:-translate-y-1 active:scale-[0.98] relative"
      >
        {/* Rectangular Cover Container */}
        <div
          className={`w-full aspect-[3/4.4] rounded-[4px] bg-[#151820] relative overflow-hidden flex flex-col justify-between shadow-md group-hover:shadow-xl group-hover:shadow-black/35 transition-all duration-200 ${
            isSelected
              ? 'border-2 border-[#2a69df] ring-2 ring-[#2a69df]/35'
              : 'border border-[#2d323f] group-hover:border-[#4c5568]'
          }`}
        >
          {book.coverDataUrl ? (
            <img
              src={book.coverDataUrl}
              alt={book.title}
              className="w-full h-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03]"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full p-2.5 flex flex-col justify-between bg-gradient-to-b from-[#232834] to-[#151820]" data-preserve-theme="true">
              <div>
                <div className="text-[10px] uppercase font-mono tracking-wider text-[#8b949e]">
                  {book.format}
                </div>
                <div className="text-[12px] font-bold text-white line-clamp-3 mt-1.5 leading-snug">
                  {book.title}
                </div>
              </div>
              <div className="text-[11px] text-[#9da7b3] line-clamp-1">{book.author}</div>
            </div>
          )}

          {/* Selection Mode Checkbox (only shown once Select Mode is activated from the top bar) */}
          {isSelectionMode && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                if (book.id !== undefined) onToggleSelect?.(book.id, e.shiftKey)
              }}
              aria-label={isSelected ? `Deselect ${book.title}` : `Select ${book.title}`}
              data-preserve-theme="true"
              className={`absolute top-2 left-2 z-20 w-5 h-5 rounded-[4px] border flex items-center justify-center shadow-md transition-all cursor-pointer ${
                isSelected
                  ? 'bg-[#2a69df] border-[#2a69df] text-white'
                  : 'bg-black/60 border-white/60 text-transparent hover:border-white hover:bg-black/75'
              }`}
            >
              {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
            </button>
          )}

          {/* Persistent Status Badges (Pin / Read / Favorite) */}
          <div
            className={`absolute top-1.5 z-10 flex items-center gap-1 ${
              isSelectionMode ? 'right-1.5' : 'left-1.5'
            }`}
            data-preserve-theme="true"
          >
            {book.isRead && (
              <span
                className="w-5 h-5 rounded-[3px] bg-black/75 border border-white/15 flex items-center justify-center text-[#4cd964]"
                title="Read"
              >
                <CheckCircle2 className="w-3 h-3" />
              </span>
            )}
          </div>

          {/* Assigned Category indicator above progress bar */}
          {assignedCategory && (
            <div
              className="absolute bottom-5 left-1.5 flex items-center gap-1 bg-[#14161c]/90 px-1.5 py-0.5 rounded-[2px] border border-white/15 z-10 max-w-[calc(100%-12px)]"
              title={`Category: ${assignedCategory.name}`}
              data-preserve-theme="true"
            >
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: assignedCategory.color }} />
              <span className="text-[10px] text-[#ededed] font-medium leading-none truncate">{assignedCategory.name}</span>
            </div>
          )}

          {/* Subtle hover actions (Category & Favorite only — Delete lives strictly in right-click menu) */}
          {!isSelectionMode && (
            <div
              className="absolute top-1.5 right-1.5 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-black/75 p-0.5 rounded-[3px] border border-white/15 z-20"
              data-preserve-theme="true"
            >
              {categories.length > 0 && (
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowCategoryMenu(!showCategoryMenu)
                    }}
                    className={`p-1 rounded-[2px] hover:bg-white/20 transition-colors cursor-pointer ${
                      assignedCategory ? 'text-[#58a6ff]' : 'text-[#c8d1dc]'
                    }`}
                    title="Assign Category"
                  >
                    <Folder className="w-3 h-3" />
                  </button>
                  {showCategoryMenu && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="absolute right-0 top-full mt-1 w-36 bg-[#171a21] border border-[#2d323f] rounded-[2px] shadow-xl py-1 z-30 text-[11px]"
                    >
                      <div className="px-2 py-1 text-[10px] text-[#8b949e] border-b border-[#232732] font-medium uppercase tracking-wider">
                        Category
                      </div>
                      <button
                        onClick={(e) => handleAssignCategory(e, null)}
                        className={`w-full px-2 py-1 flex items-center justify-between text-left hover:bg-[#282c37] transition-colors ${
                          !book.categoryId ? 'text-white font-medium bg-[#232732]' : 'text-[#8b949e]'
                        }`}
                      >
                        <span>None</span>
                      </button>
                      {categories.map((cat) => (
                        <button
                          key={cat.id}
                          onClick={(e) => handleAssignCategory(e, cat.id!)}
                          className={`w-full px-2 py-1 flex items-center gap-1.5 text-left hover:bg-[#282c37] transition-colors ${
                            book.categoryId === cat.id ? 'text-white font-medium bg-[#232732]' : 'text-[#c8d1dc]'
                          }`}
                        >
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                          <span className="truncate">{cat.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <button
                onClick={toggleFavorite}
                className={`p-1 rounded-[2px] hover:bg-white/20 cursor-pointer ${book.isFavorite ? 'text-[#e3b341]' : 'text-[#c8d1dc]'}`}
                title={book.isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
              >
                <Star className={`w-3 h-3 ${book.isFavorite ? 'fill-current' : ''}`} />
              </button>
            </div>
          )}

          {/* Bottom embedded progress indicator - ONLY shown when book has been read to at least 1% */}
          {book.progressPercent != null && Math.round(book.progressPercent) >= 1 && (
            <div
              className="absolute inset-x-0 bottom-0 h-4 bg-[#14161c]/90 border-t border-white/10 flex items-center justify-center overflow-hidden"
              data-preserve-theme="true"
            >
              <div
                className="absolute left-0 top-0 bottom-0 bg-[#2a69df]/85 transition-all duration-300"
                style={{ width: `${Math.min(100, Math.max(1, Math.round(book.progressPercent)))}%` }}
              />
              <span className="relative z-10 text-[10px] font-medium text-white tracking-wide">
                {`${Math.min(100, Math.max(1, Math.round(book.progressPercent)))}%`}
              </span>
            </div>
          )}
        </div>

        {/* Book Metadata below cover */}
        <div className="mt-2 space-y-0.5">
          <div
            className="text-[12px] font-medium text-white truncate leading-tight group-hover:text-[#58a6ff]"
            title={book.title}
          >
            {book.title}
          </div>
          <div className="text-[11px] text-[#8b949e] truncate leading-tight">
            {book.author || 'Unknown'}
          </div>
        </div>
      </div>

      {contextMenuPos && (
        <ContextMenu
          x={contextMenuPos.x}
          y={contextMenuPos.y}
          items={buildContextMenuItems()}
          onClose={() => setContextMenuPos(null)}
        />
      )}
    </>
  )
}
