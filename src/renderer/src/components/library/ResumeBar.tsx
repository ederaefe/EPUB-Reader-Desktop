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
    <footer className="h-12 bg-[#0d0d0d] border-t border-white/[0.07] px-5 flex items-center justify-between select-none shrink-0">
      <div className="flex items-center gap-3.5 min-w-0">
        <button
          onClick={() => onContinue(book)}
          className="ice-btn-blue px-3.5 h-8 text-xs flex items-center gap-2 cursor-pointer"
          title="Continue reading"
        >
          <Play className="w-3 h-3 fill-current" />
          <span>Continue reading</span>
        </button>

        <div className="flex flex-col truncate">
          <span className="font-medium text-[#ededed] text-[12px] leading-tight truncate">
            {book.title}
          </span>
          <span className="text-[#777777] text-[11px] leading-tight truncate">
            {book.author || 'Unknown'}
          </span>
        </div>
      </div>

      <div className="text-[11px] font-mono tabular-nums text-[#777777] shrink-0">
        p.{book.currentPage || 1} / {book.totalPages || 1}
      </div>
    </footer>
  )
}
