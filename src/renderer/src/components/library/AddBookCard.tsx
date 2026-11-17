import React from 'react'
import { Plus } from 'lucide-react'

interface AddBookCardProps {
  onClick: () => void
  viewMode: 'grid' | 'list'
  disabled?: boolean
  categoryName?: string | null
}

/**
 * Theme-adaptive "Open" slot rendered in the library shelf.
 * Shares its dashed squircle geometry and circular icon medallion with ImportBooksModal.
 */
export const AddBookCard: React.FC<AddBookCardProps> = ({
  onClick,
  viewMode,
  disabled = false,
  categoryName = null
}) => {
  const titleLabel = 'Open'

  if (viewMode === 'list') {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={categoryName ? `Open in ${categoryName}` : 'Open book'}
        className="w-full h-11 px-3 bg-[var(--app-chrome)] hover:bg-[var(--app-surface-hover)] border-b border-[var(--app-border)] flex items-center gap-3 text-xs text-[var(--app-text)] cursor-pointer transition-all group select-none text-left focus:outline-none disabled:opacity-50"
      >
        <div className="w-6 h-8 bg-[var(--app-surface)] border border-dashed border-[var(--app-border-strong)] rounded-[5px] shrink-0 flex items-center justify-center transition-colors group-hover:border-[var(--app-accent)] group-hover:bg-[var(--app-accent-soft)]">
          <Plus className="w-3.5 h-3.5 text-[var(--app-text-muted)] group-hover:text-[var(--app-accent-text)] transition-colors" />
        </div>
        <span className="font-medium text-[var(--app-text-strong)] transition-colors">
          {categoryName ? `Open in ${categoryName}` : 'Open'}
        </span>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={categoryName ? `Open in ${categoryName}` : 'Open book'}
      className="w-36 flex flex-col cursor-pointer group select-none transition-transform duration-150 hover:-translate-y-0.5 text-left focus:outline-none disabled:opacity-50"
    >
      {/* Theme-adaptive squircle dashed slot */}
      <div className="w-full aspect-[3/4.4] rounded-xl bg-[var(--app-surface)] group-hover:bg-[var(--app-surface-hover)] border-2 border-dashed border-[var(--app-border-strong)] group-hover:border-[var(--app-accent)] relative overflow-hidden flex flex-col items-center justify-center transition-all duration-150">
        <div className="w-11 h-11 rounded-full bg-[var(--app-surface-2)] border border-[var(--app-border)] group-hover:bg-[var(--app-accent-soft)] group-hover:border-[var(--app-accent)]/40 flex items-center justify-center transition-all duration-150">
          <Plus
            className="w-5 h-5 text-[var(--app-text-muted)] group-hover:text-[var(--app-accent-text)] transition-colors"
            strokeWidth={2.25}
          />
        </div>
        <span className="mt-3 text-[12px] font-semibold text-[var(--app-text-muted)] group-hover:text-[var(--app-text-strong)] transition-colors">
          {titleLabel}
        </span>
      </div>
    </button>
  )
}
