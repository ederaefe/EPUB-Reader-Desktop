import React from 'react'
import { Play, BookOpen } from 'lucide-react'
import type { Book } from '../../db'

interface ResumeBarProps {
  book: Book | null
  onContinue: (book: Book) => void
}

export const ResumeBar: React.FC<ResumeBarProps> = ({ book, onContinue }) => {
  if (!book) return null

  return (
    <footer className="glass-panel rounded-2xl p-2.5 px-4 flex items-center justify-between shadow-2xl border border-white/10">
      <div className="flex items-center gap-3">
        <div className="w-8 h-11 rounded-lg bg-slate-800 border border-white/10 overflow-hidden flex items-center justify-center shrink-0">
          {book.coverDataUrl ? (
            <img src={book.coverDataUrl} alt={book.title} className="w-full h-full object-cover" />
          ) : (
            <BookOpen className="w-4 h-4 text-blue-400" />
          )}
        </div>
        <div className="truncate max-w-md">
          <div className="text-xs font-bold text-white truncate">{book.title}</div>
          <div className="text-[11px] text-slate-400 truncate">
            {book.author} · Progress {book.progressPercent || 0}%
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => onContinue(book)}
          className="btn-press px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors shadow-lg shadow-blue-600/30"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          Continue Reading
        </button>
      </div>
    </footer>
  )
}
