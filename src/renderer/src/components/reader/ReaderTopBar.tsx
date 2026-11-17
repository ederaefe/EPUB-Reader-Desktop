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
}

export function ReaderTopBar({ onBack }: ReaderTopBarProps) {
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
    <header className="h-9 bg-[#171a21] border-b border-[#232732] px-3 flex items-center justify-between select-none shrink-0 z-40 relative">
      {/* Left Action Group with authentic dividers */}
      <div className="flex items-center text-[12px]">
        {/* Back to Library */}
        <button
          onClick={onBack}
          className="h-7 px-2 flex items-center gap-1 text-[#8b949e] hover:text-white transition-colors"
          title="Back to Library (~)"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span>Library</span>
        </button>

        <span className="text-[#2d323f] px-1.5 font-light">|</span>

        {/* Contents (TOC) */}
        <button
          onClick={() => toggleTOCDrawer()}
          className={`h-7 px-2 flex items-center gap-1.5 transition-colors ${
            isTOCDrawerOpen ? 'text-[#2a69df] font-medium' : 'text-[#8b949e] hover:text-white'
          }`}
          title="Show Table of contents (1)"
        >
          <List className="w-3.5 h-3.5" />
          <span>Contents</span>
        </button>

        <span className="text-[#2d323f] px-1.5 font-light">|</span>

        {/* Notes */}
        <button
          onClick={() => toggleNotesDrawer()}
          className={`h-7 px-2 flex items-center gap-1.5 transition-colors ${
            isNotesDrawerOpen ? 'text-[#2a69df] font-medium' : 'text-[#8b949e] hover:text-white'
          }`}
          title="Show notes list (2)"
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Notes</span>
        </button>

        <span className="text-[#2d323f] px-1.5 font-light">|</span>

        {/* Bookmarks */}
        <button
          onClick={() => toggleBookmarksDrawer()}
          className={`h-7 px-2 flex items-center gap-1.5 transition-colors ${
            isBookmarksDrawerOpen ? 'text-[#2a69df] font-medium' : 'text-[#8b949e] hover:text-white'
          }`}
          title="Show bookmarks list (3)"
        >
          <Bookmark className="w-3.5 h-3.5" />
          <span>Bookmarks</span>
        </button>

        <span className="text-[#2d323f] px-1.5 font-light">|</span>

        {/* Search */}
        <button
          onClick={() => toggleSearchDrawer()}
          className={`w-7 h-7 flex items-center justify-center transition-colors ${
            isSearchDrawerOpen ? 'text-[#2a69df]' : 'text-[#8b949e] hover:text-white'
          }`}
          title="Search in book (Ctrl+F)"
        >
          <Search className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Right Controls: Only Immersive Fullscreen & Settings */}
      <div className="flex items-center gap-1 text-[12px]">
        {/* Immersive Fullscreen Toggle */}
        <button
          onClick={handleToggleFullscreen}
          className="w-7 h-7 flex items-center justify-center rounded-[2px] text-[#8b949e] hover:text-white hover:bg-[#282c37] transition-colors"
          title="Immersive Fullscreen (F11)"
        >
          {isImmersiveFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </button>

        {/* Settings Flyout Trigger */}
        <button
          onClick={() => toggleSettingsDrawer()}
          className={`w-7 h-7 flex items-center justify-center rounded-[2px] transition-colors ${
            isSettingsDrawerOpen ? 'bg-[#282c37] text-white' : 'text-[#8b949e] hover:text-white hover:bg-[#282c37]'
          }`}
          title="Settings"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  )
}
