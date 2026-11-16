import React from 'react'
import { Play } from 'lucide-react'
import type { Book } from '../../db'

interface ResumeBarProps {
  book: Book | null
  onContinue: (book: Book) => void
}

export const ResumeBar: React.FC<ResumeBarProps> = ({ book, onContinue }) => {
  if (!book) return null

  return (
    <footer className="h-11 bg-[#14161c] border-t border-[#232732] px-4 flex items-center justify-between select-none shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={() => onContinue(book)}
          className="ice-btn-blue px-3 py-1.5 text-xs flex items-center gap-1.5 shadow-sm"
        >
          <Play className="w-3 h-3 fill-current" />
          <span>Continue reading</span>
        </button>

        <div className="flex items-center gap-2 truncate text-xs">
          <span className="font-semibold text-white truncate">{book.title}</span>
          <span className="text-[#8b949e] truncate">by {book.author || 'Unknown'}</span>
        </div>
      </div>

      <div className="text-[12px] text-[#8b949e] shrink-0 font-medium">
        {book.currentPage ? `p. ${book.currentPage} / ${book.totalPages} (${book.progressPercent || 0}%)` : `${book.progressPercent || 0}% read`}
      </div>
    </footer>
  )
}
