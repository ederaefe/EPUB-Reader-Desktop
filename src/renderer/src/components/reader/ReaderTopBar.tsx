import React from 'react'
import {
  ChevronLeft,
  List,
  FileText,
  Bookmark,
  Search,
  Maximize2,
  Minimize2,
  Settings
} from 'lucide-react'
import { useAppStore } from '../../stores/useAppStore'

interface ReaderTopBarProps {
  onBack: () => void
  currentChapter?: string
  isCurrentPageBookmarked?: boolean
  currentPage?: number
}

export function ReaderTopBar({
  onBack,
  isCurrentPageBookmarked = false,
  currentPage
}: ReaderTopBarProps) {
  const {
    isTOCDrawerOpen,
    toggleTOCDrawer,
    isNotesDrawerOpen,
    toggleNotesDrawer,
    isBookmarksDrawerOpen,
    toggleBookmarksDrawer,
    isSearchDrawerOpen,
    toggleSearchDrawer,
    isSettingsDrawerOpen,
    toggleSettingsDrawer,
    isImmersiveFullscreen,
    setImmersiveFullscreen
  } = useAppStore()

  const handleToggleFullscreen = () => {
    const next = !isImmersiveFullscreen
    setImmersiveFullscreen(next)
    if (window.desktopAPI?.setFullscreen) {
      window.desktopAPI.setFullscreen(next)
    } else if (next) {
      document.documentElement.requestFullscreen().catch(() => {})
    } else if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {})
    }
  }

  return (
    <header className="h-10 bg-[#0d0d0d] border-b border-white/[0.07] px-3 flex items-center justify-between select-none shrink-0 z-40 relative">
      {/* Left Action Group */}
      <div className="flex items-center gap-0.5 text-[12px]">
        <button
          onClick={onBack}
          className="h-7 px-2 rounded-md flex items-center gap-1 text-[#888888] hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
          title="Back to Library (Alt+Left)"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span>Library</span>
        </button>

        <span className="h-3.5 w-px bg-white/[0.08] mx-1.5" />

        <button
          onClick={() => toggleTOCDrawer()}
          className={`h-7 px-2 rounded-md flex items-center gap-1.5 transition-colors cursor-pointer ${
            isTOCDrawerOpen
              ? 'bg-white/[0.1] text-white font-medium'
              : 'text-[#888888] hover:text-white hover:bg-white/[0.06]'
          }`}
          title="Table of contents (1)"
        >
          <List className="w-3.5 h-3.5" />
          <span>Contents</span>
        </button>

        <button
          onClick={() => toggleNotesDrawer()}
          className={`h-7 px-2 rounded-md flex items-center gap-1.5 transition-colors cursor-pointer ${
            isNotesDrawerOpen
              ? 'bg-white/[0.1] text-white font-medium'
              : 'text-[#888888] hover:text-white hover:bg-white/[0.06]'
          }`}
          title="Notes & Highlights (2)"
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Notes</span>
        </button>

        <button
          onClick={() => toggleBookmarksDrawer()}
          className={`h-7 px-2 rounded-md flex items-center gap-1.5 transition-colors cursor-pointer ${
            isBookmarksDrawerOpen
              ? 'bg-white/[0.1] text-white font-medium'
              : 'text-[#888888] hover:text-white hover:bg-white/[0.06]'
          }`}
          title="Bookmarks (3)"
        >
          <Bookmark
            className={`w-3.5 h-3.5 transition-transform duration-200 ${
              isCurrentPageBookmarked ? 'fill-[#0070f3] text-[#0070f3] scale-110' : 'scale-100'
            }`}
          />
          <span>Bookmarks</span>
        </button>

        <button
          onClick={() => toggleSearchDrawer()}
          className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors cursor-pointer ${
            isSearchDrawerOpen
              ? 'bg-white/[0.1] text-white'
              : 'text-[#888888] hover:text-white hover:bg-white/[0.06]'
          }`}
          title="Search in book (Ctrl+F)"
        >
          <Search className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Right Controls: Bare Page Number, Immersive Fullscreen & Settings */}
      <div className="flex items-center gap-1.5 text-[12px]">
        {typeof currentPage === 'number' && currentPage > 0 && (
          <span
            className="px-1.5 py-0.5 text-[11px] font-mono font-medium tracking-wide text-[#8b949e] opacity-60 tabular-nums select-none"
            title={`Page ${currentPage}`}
          >
            {currentPage}
          </span>
        )}

        <button
          onClick={handleToggleFullscreen}
          className="w-7 h-7 flex items-center justify-center rounded-md text-[#888888] hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
          title="Immersive Fullscreen (F11)"
        >
          {isImmersiveFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </button>

        <button
          onClick={() => toggleSettingsDrawer()}
          className={`w-7 h-7 flex items-center justify-center rounded-md transition-colors cursor-pointer ${
            isSettingsDrawerOpen
              ? 'bg-white text-black'
              : 'text-[#888888] hover:text-white hover:bg-white/[0.06]'
          }`}
          title="Reader Settings"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  )
}
