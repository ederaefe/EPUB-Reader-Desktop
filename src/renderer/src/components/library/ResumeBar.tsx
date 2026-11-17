import React from 'react'
import { Play, X } from 'lucide-react'
import type { Book } from '../../db'

interface ResumeBarProps {
  book: Book | null
  isLoading?: boolean
  onContinue: (book: Book) => void
  onDismiss: () => void
}

export const ResumeBar: React.FC<ResumeBarProps> = ({
  book,
  isLoading = false,
  onContinue,
  onDismiss
}) => {
  if (!book) return null

  const totalPages = Math.max(1, Math.round(book.totalPages || 1))
  const currentPage = Math.max(1, Math.min(totalPages, Math.round(book.currentPage || 1)))

  return (
    <footer className="h-12 bg-[var(--app-chrome)] border-t border-[var(--app-border)] px-5 flex items-center justify-between gap-4 select-none shrink-0">
      <div className="flex items-center gap-3.5 min-w-0">
        <button
          type="button"
          disabled={isLoading}
          onClick={() => onContinue(book)}
          className="ice-btn-blue px-3.5 h-8 text-xs flex items-center gap-2 cursor-pointer shrink-0 disabled:opacity-60"
          title={`Continue reading "${book.title}" at page ${currentPage}`}
        >
          <Play className="w-3 h-3 fill-current" />
          <span>{isLoading ? 'Opening...' : 'Continue reading'}</span>
        </button>

        <div className="flex flex-col min-w-0">
          <span className="font-medium text-[var(--app-text-strong)] text-[12px] leading-tight truncate">
            {book.title}
          </span>
          <span className="text-[var(--app-text-muted)] text-[11px] leading-tight truncate">
            {book.author || 'Unknown'}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2.5 shrink-0">
        <div
          className="text-[11px] font-mono tabular-nums text-[var(--app-text-muted)]"
          title={`Page ${currentPage} of ${totalPages}`}
        >
          p.{currentPage} / {totalPages}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="w-7 h-7 rounded-md flex items-center justify-center text-[var(--app-text-muted)] hover:text-[var(--app-text-strong)] hover:bg-[var(--app-surface-hover)] transition-colors cursor-pointer"
          title="Close Continue reading bar"
          aria-label="Close Continue reading bar"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </footer>
  )
}
