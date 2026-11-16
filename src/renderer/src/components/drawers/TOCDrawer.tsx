import React from 'react'
import { X, BookOpen, ChevronRight } from 'lucide-react'
import { useAppStore } from '../../stores/useAppStore'

export interface TocItem {
  id: string
  label: string
  href: string
  subitems?: TocItem[]
}

interface TOCDrawerProps {
  toc: TocItem[]
  onSelectChapter: (href: string) => void
}

export const TOCDrawer: React.FC<TOCDrawerProps> = ({ toc, onSelectChapter }) => {
  const { isTOCDrawerOpen, toggleTOCDrawer } = useAppStore()

  if (!isTOCDrawerOpen) return null

  return (
    <aside className="fixed inset-y-0 right-0 w-80 glass-panel rounded-drawer p-5 z-50 flex flex-col justify-between shadow-2xl border-l border-white/10 animate-slide-in">
      <div className="space-y-4 overflow-hidden flex flex-col h-full">
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-blue-400" />
            <h2 className="text-sm font-bold text-white tracking-wide">Table of Contents</h2>
          </div>
          <button
            onClick={() => toggleTOCDrawer(false)}
            className="btn-press p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-1 pr-1">
          {toc.length === 0 ? (
            <div className="text-xs text-slate-500 text-center py-8">No chapters found</div>
          ) : (
            toc.map((item, idx) => (
              <button
                key={item.id || idx}
                onClick={() => {
                  onSelectChapter(item.href)
                  toggleTOCDrawer(false)
                }}
                className="btn-press w-full text-left px-3 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-white/5 transition-colors flex items-center justify-between group"
              >
                <span className="truncate pr-2">{item.label?.trim() || `Chapter ${idx + 1}`}</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-blue-400 shrink-0" />
              </button>
            ))
          )}
        </div>
      </div>
    </aside>
  )
}
