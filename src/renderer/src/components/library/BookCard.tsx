import React from 'react'
import { BookOpen, Heart, Trash2, FileText } from 'lucide-react'
import type { Book } from '../../db'
import { db } from '../../db'

interface BookCardProps {
  book: Book
  onOpen: (book: Book) => void
  onUpdate: () => void
}

export const BookCard: React.FC<BookCardProps> = ({ book, onOpen, onUpdate }) => {
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

  const formatBadgeColors = {
    epub: 'bg-blue-500/20 text-blue-300 border-blue-400/30',
    pdf: 'bg-rose-500/20 text-rose-300 border-rose-400/30',
    mobi: 'bg-amber-500/20 text-amber-300 border-amber-400/30',
    txt: 'bg-slate-500/20 text-slate-300 border-slate-400/30'
  }

  return (
    <div
      onClick={() => onOpen(book)}
      className="btn-press glass-card rounded-2xl p-3 group hover:border-blue-400/35 transition-all duration-200 cursor-pointer flex flex-col justify-between"
    >
      {/* Cover / Placeholder */}
      <div className="aspect-[3/4] rounded-xl bg-slate-800/80 mb-3 overflow-hidden relative border border-white/5 flex items-center justify-center">
        {book.coverDataUrl ? (
          <img src={book.coverDataUrl} alt={book.title} className="w-full h-full object-cover" />
        ) : (
          <div className="text-center p-3 z-10">
            <BookOpen className="w-8 h-8 text-blue-400/50 mx-auto mb-2" />
            <div className="text-xs font-bold text-white line-clamp-2">{book.title}</div>
            <div className="text-[11px] text-slate-400 mt-1 line-clamp-1">{book.author}</div>
          </div>
        )}

        {/* Top Badges */}
        <div className="absolute top-2 left-2 z-20 flex items-center gap-1.5">
          <span
            className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border ${
              formatBadgeColors[book.format] || formatBadgeColors.epub
            }`}
          >
            {book.format}
          </span>
        </div>

        <div className="absolute top-2 right-2 z-20 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={toggleFavorite}
            className={`p-1 rounded-lg backdrop-blur-md transition-colors ${
              book.isFavorite ? 'bg-rose-500/40 text-rose-300' : 'bg-black/40 text-slate-300 hover:text-white'
            }`}
            title="Favorite"
          >
            <Heart className="w-3.5 h-3.5 fill-current" />
          </button>
          <button
            onClick={handleDelete}
            className="p-1 rounded-lg bg-black/40 text-slate-300 hover:text-rose-400 backdrop-blur-md transition-colors"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Bottom Vignette */}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#0e1422] to-transparent pointer-events-none" />
      </div>

      {/* Info & Progress */}
      <div className="space-y-1.5">
        <h3 className="text-xs font-bold text-white truncate" title={book.title}>
          {book.title}
        </h3>
        <p className="text-[11px] text-slate-400 truncate">{book.author || 'Unknown Author'}</p>

        <div className="pt-1">
          <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
            <span>Progress</span>
            <span className="font-semibold text-slate-200">{book.progressPercent || 0}%</span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-1 overflow-hidden">
            <div
              className="bg-blue-500 h-full rounded-full transition-all duration-300"
              style={{ width: `${Math.max(2, book.progressPercent || 0)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
