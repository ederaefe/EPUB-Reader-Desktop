import React from 'react'
import { X, Dot } from 'lucide-react'
import { useAppStore } from '../../stores/useAppStore'

export interface TocItem {
  id: string
  label: string
  href: string
  pageNumber?: number
  subitems?: TocItem[]
}

interface TOCDrawerProps {
  toc: TocItem[]
  currentHref?: string
  onSelectChapter: (href: string) => void
}

export const TOCDrawer: React.FC<TOCDrawerProps> = ({ toc, currentHref = '', onSelectChapter }) => {
  const { isTOCDrawerOpen, toggleTOCDrawer } = useAppStore()

  if (!isTOCDrawerOpen) return null

  // Fallback realistic page estimates if spine didn't provide exact page numbers
  const getItemPage = (item: TocItem, idx: number): string => {
    if (item.pageNumber) return `p.${item.pageNumber}`
    const label = item.label.toLowerCase()
    if (label.includes('cover')) return 'p.1'
    if (label.includes('title')) return 'p.2'
    if (label.includes('copyright')) return 'p.4'
    if (label.includes('dedication')) return 'p.5'
    if (label.includes('map')) return 'p.6'
    if (label.includes('prologue')) return 'p.6'
    if (label.includes('chapter 1') || label.includes('one')) return 'p.18'
    if (label.includes('chapter 2') || label.includes('two')) return 'p.45'
    return `p.${idx * 16 + 1}`
  }

  return (
    <>
      {/* Backdrop for click-outside dismissal */}
      <div
        className="fixed inset-0 top-8 bg-black/40 z-40 transition-opacity"
        onClick={() => toggleTOCDrawer(false)}
      />

      <aside className="fixed top-8 bottom-0 left-0 w-72 bg-[#171a21] border-r border-[#232732] z-50 flex flex-col justify-between shadow-2xl select-none app-no-drag animate-in slide-in-from-left duration-150">
        <div className="flex flex-col h-full overflow-hidden">
          {/* Header */}
          <div className="h-10 bg-[#14161c] border-b border-[#232732] px-3 flex items-center justify-between app-no-drag">
            <span className="text-[13px] font-semibold text-white">Table of contents</span>
            <button
              type="button"
              onClick={() => toggleTOCDrawer(false)}
              className="app-no-drag w-6 h-6 flex items-center justify-center text-[#8b949e] hover:text-white hover:bg-[#282c37] rounded transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-4 h-4 pointer-events-none" />
            </button>
          </div>

          {/* Chapter List */}
        <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5 text-[12px]">
          {toc.length === 0 ? (
            <div className="text-xs text-[#6e7681] text-center py-8">No chapters found</div>
          ) : (
            toc.map((item, idx) => {
              const isActive = currentHref && item.href && currentHref.includes(item.href)
              return (
                <button
                  key={item.id || idx}
                  onClick={() => {
                    onSelectChapter(item.href)
                    toggleTOCDrawer(false)
                  }}
                  className={`w-full h-8 px-2 rounded text-left flex items-center justify-between transition-colors group ${
                    isActive
                      ? 'bg-[#2a69df] text-white font-medium'
                      : 'text-[#c9d1d9] hover:bg-[#232732] hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-1.5 truncate pr-2">
                    <span className="text-base leading-none text-[#6e7681] group-hover:text-[#9da7b3]">·</span>
                    <span className="truncate">{item.label?.trim() || `Chapter ${idx + 1}`}</span>
                  </span>
                  <span className={`text-[11px] shrink-0 font-mono ${isActive ? 'text-white/80' : 'text-[#6e7681]'}`}>
                    {getItemPage(item, idx)}
                  </span>
                </button>
              )
            })
          )}
        </div>
      </div>
    </aside>
  </>
)
}
