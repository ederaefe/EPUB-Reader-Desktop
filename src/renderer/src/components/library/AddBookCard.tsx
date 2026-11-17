import React from 'react'
import { Plus } from 'lucide-react'

interface AddBookCardProps {
  onClick: () => void
  viewMode: 'grid' | 'list'
  disabled?: boolean
  categoryName?: string | null
}

/**
 * Book-shaped "+" slot rendered at the start of the library shelf (Grid or List).
 * Replaces top-bar import buttons to keep the catalog header uncluttered.
 */
export const AddBookCard: React.FC<AddBookCardProps> = ({
  onClick,
  viewMode,
  disabled = false,
  categoryName = null
}) => {
  const titleLabel = categoryName ? `Add to ${categoryName}` : 'Add book'
  const subtitleLabel = categoryName ? 'Files, folder, or library' : 'Book or folder'

  if (viewMode === 'list') {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={titleLabel}
        className="w-full h-11 px-3 bg-[#191d26] hover:bg-[#232836] border-b border-[#2b2f3a] flex items-center justify-between text-xs text-[#c9d1d9] cursor-pointer transition-colors group select-none text-left focus:outline-none focus-visible:ring-1 focus-visible:ring-[#2a69df] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-6 h-8 bg-[#14171f] border border-dashed border-[#3c4354] group-hover:border-[#2a69df] group-hover:bg-[#1a2233] rounded-[2px] shrink-0 flex items-center justify-center transition-colors">
            <Plus className="w-3.5 h-3.5 text-[#8b949e] group-hover:text-[#58a6ff] transition-colors" />
          </div>
          <span className="font-medium text-[#c8d1dc] group-hover:text-white truncate transition-colors">
            {titleLabel}
          </span>
        </div>
        <span className="text-[11px] text-[#6e7681] group-hover:text-[#8b949e] shrink-0 transition-colors">
          {subtitleLabel}
        </span>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={titleLabel}
      className="w-36 flex flex-col cursor-pointer group select-none transition-transform duration-100 hover:-translate-y-0.5 text-left focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {/* Book-proportioned dashed slot with centered Plus icon */}
      <div className="w-full aspect-[3/4.4] rounded-[2px] bg-[#151820]/70 group-hover:bg-[#1b202c] border border-dashed border-[#343a49] group-hover:border-[#2a69df] group-focus-visible:border-[#2a69df] relative overflow-hidden flex flex-col items-center justify-center shadow-sm transition-colors">
        <div className="w-11 h-11 rounded-[2px] bg-[#1c202b] group-hover:bg-[#2a69df]/15 border border-[#2a2f3d] group-hover:border-[#2a69df]/50 flex items-center justify-center transition-colors">
          <Plus className="w-6 h-6 text-[#8b949e] group-hover:text-[#58a6ff] transition-colors" strokeWidth={1.75} />
        </div>
        <span className="mt-2.5 text-[11px] font-medium text-[#8b949e] group-hover:text-[#c8d1dc] transition-colors px-2 text-center">
          {categoryName ? 'Add books' : 'Import'}
        </span>
      </div>

      {/* Footer matching BookCard metadata block height for clean grid row alignment */}
      <div className="mt-2 space-y-0.5">
        <div className="text-[12px] font-medium text-[#c8d1dc] group-hover:text-[#58a6ff] truncate leading-tight transition-colors">
          {titleLabel}
        </div>
        <div className="text-[11px] text-[#6e7681] truncate leading-tight">
          {subtitleLabel}
        </div>
      </div>
    </button>
  )
}
