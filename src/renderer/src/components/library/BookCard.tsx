import React from 'react'
import { BookOpen, Star, Trash2 } from 'lucide-react'
import type { Book } from '../../db'
import { db } from '../../db'

interface BookCardProps {
  book: Book
  onOpen: (book: Book) => void
  onUpdate: () => void
  viewMode?: 'grid' | 'list'
  isSelected?: boolean
}

export const BookCard: React.FC<BookCardProps> = ({
  book,
  onOpen,
  onUpdate,
  viewMode = 'grid',
  isSelected = true
}) => {
  const toggleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!book.id) return
    await db.books.update(book.id, { isFavorite: !book.isFavorite })
    onUpdate()
  }

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!book.id) return
    await db.books.update(book.id, { isDeleted: !book.isDeleted })
    onUpdate()
  }

  if (viewMode === 'list') {
    return (
      <div
        onClick={() => onOpen(book)}
        className="w-full h-11 px-3 bg-[#1f232d] hover:bg-[#282c37] border-b border-[#2b2f3a] flex items-center justify-between text-xs text-[#c9d1d9] cursor-pointer transition-colors group select-none"
      >
        <div className="flex items-center gap-3 flex-1 min-w-0 pr-4">
          <div className="w-6 h-8 bg-[#171a21] border border-[#3c404d] rounded-[2px] overflow-hidden shrink-0 flex items-center justify-center">
            {book.coverDataUrl ? (
              <img src={book.coverDataUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <BookOpen className="w-3 h-3 text-[#6e7681]" />
            )}
          </div>
          <span className="font-medium text-white truncate">{book.title}</span>
          <span className="text-[#8b949e] truncate">({book.author || 'Unknown'})</span>
        </div>

        <div className="flex items-center gap-6 shrink-0 text-[11px] text-[#8b949e]">
          <span className="uppercase text-[10px] px-1.5 py-0.5 bg-[#171a21] border border-[#2d323f] rounded font-mono">
            {book.format}
          </span>
          <span className="w-20 text-right">
            p.{book.currentPage || 15} / {book.totalPages || 507}
          </span>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={toggleFavorite}
              className={`p-1 rounded hover:bg-[#333846] ${book.isFavorite ? 'text-[#e3b341]' : 'text-[#8b949e]'}`}
              title="Favorite"
            >
              <Star className="w-3.5 h-3.5 fill-current" />
            </button>
            <button
              onClick={handleDelete}
              className="p-1 rounded hover:bg-[#333846] text-[#8b949e] hover:text-[#f85149]"
              title="Delete"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Grid view (1:1 Icecream Reader book cover display)
  return (
    <div
      onClick={() => onOpen(book)}
      className="w-36 flex flex-col cursor-pointer group select-none transition-transform duration-100 hover:-translate-y-0.5"
    >
      {/* Rectangular Cover Container with Blue Selected Border */}
      <div
        className={`w-full aspect-[3/4.4] rounded-[2px] bg-[#151820] relative overflow-hidden flex flex-col justify-between shadow-md ${
          isSelected ? 'border-2 border-[#2a69df]' : 'border border-[#2d323f] group-hover:border-[#3c404d]'
        }`}
      >
        {book.coverDataUrl ? (
          <img
            src={book.coverDataUrl}
            alt={book.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full p-2.5 flex flex-col justify-between bg-gradient-to-b from-[#232834] to-[#151820]">
            <div>
              <div className="text-[10px] uppercase font-mono tracking-wider text-[#6e7681]">
                {book.format}
              </div>
              <div className="text-[12px] font-bold text-white line-clamp-3 mt-1.5 leading-snug">
                {book.title}
              </div>
            </div>
            <div className="text-[11px] text-[#8b949e] line-clamp-1">{book.author}</div>
          </div>
        )}

        {/* Action icons on hover */}
        <div className="absolute top-1.5 right-1.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-black/75 p-0.5 rounded-[2px] border border-white/10">
          <button
            onClick={toggleFavorite}
            className={`p-1 rounded-[2px] hover:bg-white/20 ${book.isFavorite ? 'text-[#e3b341]' : 'text-[#8b949e]'}`}
            title="Favorite"
          >
            <Star className="w-3 h-3 fill-current" />
          </button>
          <button
            onClick={handleDelete}
            className="p-1 rounded-[2px] hover:bg-white/20 text-[#8b949e] hover:text-[#f85149]"
            title="Delete"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>

        {/* Bottom embedded progress indicator (1:1 Icecream Reader) */}
        <div className="absolute inset-x-0 bottom-0 h-4 bg-[#14161c]/90 border-t border-[#232732] flex items-center justify-center overflow-hidden">
          <div
            className="absolute left-0 top-0 bottom-0 bg-[#2a69df]/85 transition-all duration-300"
            style={{ width: `${Math.max(3, book.progressPercent || 3)}%` }}
          />
          <span className="relative z-10 text-[10px] font-medium text-white tracking-wide">
            {book.progressPercent || 3}%
          </span>
        </div>
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
  )
}
