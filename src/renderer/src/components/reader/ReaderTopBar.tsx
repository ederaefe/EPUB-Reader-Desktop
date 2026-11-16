import React, { useState } from 'react'
import {
  ChevronLeft,
  List,
  FileText,
  Bookmark,
  Search,
  Columns,
  Square as SinglePageIcon,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Settings,
  Play,
  Square
} from 'lucide-react'
import { useAppStore } from '../../stores/useAppStore'
import { ttsService } from '../../services/ttsService'

interface ReaderTopBarProps {
  onBack: () => void
  currentChapter: string
}

export const ReaderTopBar: React.FC<ReaderTopBarProps> = ({ onBack, currentChapter }) => {
  const {
    activeBook,
    isTTSActive,
    setTTSActive,
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
    settings,
    updateSettings
  } = useAppStore()

  const [isFullscreen, setIsFullscreen] = useState(false)

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
      setIsFullscreen(true)
    } else {
      document.exitFullscreen().catch(() => {})
      setIsFullscreen(false)
    }
  }

  const handleToggleTTS = () => {
    if (isTTSActive) {
      ttsService.stop()
      setTTSActive(false)
    } else {
      setTTSActive(true)
      const readerIframe = document.querySelector('iframe')
      const text = readerIframe?.contentDocument?.body?.innerText || activeBook?.title || 'Reading'
      ttsService.speak(text, {
        rate: settings.ttsSpeed,
        pitch: settings.ttsPitch,
        voiceURI: settings.ttsVoice,
        onEnd: () => setTTSActive(false)
      })
    }
  }

  const togglePageSpread = () => {
    updateSettings({
      pageSpread: settings.pageSpread === 'double' ? 'single' : 'double'
    })
  }

  return (
    <header className="h-10 bg-[#171a21] border-b border-[#232732] px-3 flex items-center justify-between select-none shrink-0 z-40">
      {/* Left Group: Back to Library & Section Drawers */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={onBack}
          className="ice-btn-dark h-7 px-2.5 gap-1 text-xs"
          title="Back to Library (Esc)"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span>Library</span>
        </button>

        <div className="h-4 w-px bg-[#2d323f] mx-1" />

        {/* Contents (TOC) */}
        <button
          onClick={() => toggleTOCDrawer()}
          className={`h-7 px-2 ice-icon-btn gap-1.5 text-xs ${isTOCDrawerOpen ? 'active' : ''}`}
          title="Table of Contents (Left drawer)"
        >
          <List className="w-3.5 h-3.5 text-[#8b949e]" />
          <span>Contents</span>
        </button>

        {/* Notes */}
        <button
          onClick={() => toggleNotesDrawer()}
          className={`h-7 px-2 ice-icon-btn gap-1.5 text-xs ${isNotesDrawerOpen ? 'active' : ''}`}
          title="Notes & Highlights"
        >
          <FileText className="w-3.5 h-3.5 text-[#8b949e]" />
          <span>Notes</span>
        </button>

        {/* Bookmarks */}
        <button
          onClick={() => toggleBookmarksDrawer()}
          className={`h-7 px-2 ice-icon-btn gap-1.5 text-xs ${isBookmarksDrawerOpen ? 'active' : ''}`}
          title="Bookmarks (Ctrl+B)"
        >
          <Bookmark className="w-3.5 h-3.5 text-[#8b949e]" />
          <span>Bookmarks</span>
        </button>

        {/* Search */}
        <button
          onClick={() => toggleSearchDrawer()}
          className={`w-7 h-7 ice-icon-btn ${isSearchDrawerOpen ? 'active' : ''}`}
          title="Search in book (Ctrl+F)"
        >
          <Search className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Center: Title & Current Chapter */}
      <div className="flex items-center gap-2 truncate max-w-md text-center">
        <span className="text-xs font-semibold text-white truncate">
          {activeBook?.title || 'EPUB Reader'}
        </span>
        {currentChapter && (
          <span className="text-[11px] text-[#8b949e] truncate hidden md:inline">
            · {currentChapter}
          </span>
        )}
      </div>

      {/* Right Controls: Columns, TTS, Fullscreen, Settings */}
      <div className="flex items-center gap-1.5">
        {/* Toggle Page View (Single / Double) */}
        <button
          onClick={togglePageSpread}
          className={`h-7 px-2 ice-icon-btn gap-1 text-xs ${settings.pageSpread === 'double' ? 'active' : ''}`}
          title={`Page spread: ${settings.pageSpread === 'double' ? 'Two columns (F10)' : 'Single column (F10)'}`}
        >
          {settings.pageSpread === 'double' ? (
            <Columns className="w-3.5 h-3.5 text-[#2a69df]" />
          ) : (
            <SinglePageIcon className="w-3.5 h-3.5 text-[#8b949e]" />
          )}
          <span className="text-[11px]">{settings.pageSpread === 'double' ? 'Double' : 'Single'}</span>
        </button>

        {/* Read Aloud TTS button */}
        <button
          onClick={handleToggleTTS}
          className={`h-7 px-2 ice-icon-btn gap-1 text-xs ${
            isTTSActive ? 'active border-[#2a69df] text-[#79c0ff]' : ''
          }`}
          title="Read Aloud (F7 / F8)"
        >
          {isTTSActive ? (
            <Volume2 className="w-3.5 h-3.5 text-[#2a69df] animate-pulse" />
          ) : (
            <Play className="w-3.5 h-3.5 text-[#8b949e] fill-current" />
          )}
          <span className="text-[11px]">Read Aloud</span>
        </button>

        {/* Fullscreen Toggle */}
        <button
          onClick={toggleFullscreen}
          className="w-7 h-7 ice-icon-btn"
          title="Fullscreen (F11)"
        >
          {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </button>

        {/* Settings Flyout Trigger */}
        <button
          onClick={() => toggleSettingsDrawer()}
          className={`w-7 h-7 ice-icon-btn ${isSettingsDrawerOpen ? 'active text-white' : ''}`}
          title="Reading Settings"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  )
}
