import React from 'react'
import { X, ExternalLink, Bookmark } from 'lucide-react'

interface FootnotePopoverProps {
  footnote: {
    id: string
    index?: string
    text: string
    href?: string
  }
  onClose: () => void
  onJumpToNote?: (href: string) => void
}

export const FootnotePopover: React.FC<FootnotePopoverProps> = ({
  footnote,
  onClose,
  onJumpToNote
}) => {
  return (
    <div className="absolute bottom-14 left-1/2 -translate-x-1/2 z-40 w-[480px] max-w-[90vw] bg-[#171a21] border border-[#2d323f] rounded-[3px] shadow-2xl p-3.5 text-xs text-[#c9d1d9] select-none animate-in fade-in slide-in-from-bottom-2 duration-150">
      <div className="flex items-center justify-between border-b border-[#232732] pb-2 mb-2">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-[2px] bg-[#2a69df]/20 text-[#79c0ff] flex items-center justify-center font-mono text-[11px] font-semibold border border-[#2a69df]/30">
            {footnote.index || 'fn'}
          </div>
          <span className="text-[12px] font-semibold text-white">Footnote Reference</span>
        </div>
        <button
          onClick={onClose}
          className="w-5 h-5 flex items-center justify-center text-[#8b949e] hover:text-white hover:bg-[#282c37] rounded-[2px] transition-colors"
          title="Close note"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="text-[12px] leading-relaxed text-[#d1d7e0] max-h-40 overflow-y-auto pr-1">
        {footnote.text || 'No note text available.'}
      </div>

      <div className="mt-3 pt-2 border-t border-[#232732] flex items-center justify-between text-[11px] text-[#8b949e]">
        <span>Non-destructive footnote preview</span>
        {footnote.href && onJumpToNote && (
          <button
            onClick={() => onJumpToNote(footnote.href!)}
            className="flex items-center gap-1 text-[#79c0ff] hover:text-white transition-colors"
          >
            <span>Jump to note</span>
            <ExternalLink className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  )
}
