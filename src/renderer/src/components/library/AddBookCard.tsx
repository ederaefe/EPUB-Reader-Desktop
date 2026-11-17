import React from 'react'
import { Plus } from 'lucide-react'

interface AddBookCardProps {
  onClick: () => void
  viewMode: 'grid' | 'list'
  disabled?: boolean
  categoryName?: string | null
}

/**
 * Modernized "Add" slot rendered in the library shelf.
 * Sleek squircle aesthetic with soft accent interactions.
 */
export const AddBookCard: React.FC<AddBookCardProps> = ({
  onClick,
  viewMode,
  disabled = false,
  categoryName = null
}) => {
  const titleLabel = 'Add'

  if (viewMode === 'list') {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label="Add book"
        className="w-full h-11 px-3 bg-[#0d0d0d] hover:bg-white/[0.04] border-b border-white/[0.07] flex items-center gap-3 text-xs text-[#ededed] cursor-pointer transition-all group select-none text-left focus:outline-none disabled:opacity-50"
      >
        <div className="w-6 h-8 bg-[#161616] border border-white/[0.12] rounded-[4px] shrink-0 flex items-center justify-center transition-colors group-hover:border-[var(--app-accent)]/50">
          <Plus className="w-3.5 h-3.5 text-[#888888] group-hover:text-white transition-colors" />
        </div>
        <span className="font-medium text-[var(--app-text-strong)] transition-colors">
          {categoryName ? `Add to ${categoryName}` : 'Add'}
        </span>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label="Add book"
      className="w-36 flex flex-col cursor-pointer group select-none transition-transform duration-100 hover:-translate-y-0.5 text-left focus:outline-none disabled:opacity-50"
    >
      {/* Sleek squircle dashed slot */}
      <div className="w-full aspect-[3/4.4] rounded-xl bg-[#161616] group-hover:bg-white/[0.04] border-2 border-dashed border-white/[0.12] group-hover:border-white/30 relative overflow-hidden flex flex-col items-center justify-center transition-all">
        <div className="w-10 h-10 rounded-full bg-[#1c1c1c] group-hover:bg-[var(--app-accent)]/10 flex items-center justify-center transition-all group-hover:shadow-[0_0_12px_rgba(var(--app-accent-rgb),0.3)]">
          <Plus className="w-5 h-5 text-[#888888] group-hover:text-white transition-colors" strokeWidth={2.5} />
        </div>
        <span className="mt-3 text-[11px] font-semibold text-[#888888] group-hover:text-white transition-colors">
          {titleLabel}
        </span>
      </div>
    </button>
  )
}
