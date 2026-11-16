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
  Pause
} from 'lucide-react'
import { useAppStore } from '../../stores/useAppStore'
import { ttsService } from '../../services/ttsService'

interface ReaderTopBarProps {
  onBack: () => void
  currentChapter?: string
}

export const ReaderTopBar: React.FC<ReaderTopBarProps> = ({ onBack }) => {
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
  const [isMuted, setIsMuted] = useState(false)

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

  const cycleTTSSpeed = () => {
    const speeds = [0.8, 1.0, 1.2, 1.5, 2.0]
    const nextIdx = (speeds.indexOf(settings.ttsSpeed) + 1) % speeds.length
    updateSettings({ ttsSpeed: speeds[nextIdx] })
  }

  return (
    <header className="h-9 bg-[#171a21] border-b border-[#232732] px-3 flex items-center justify-between select-none shrink-0 z-40">
      {/* Left Action Group with authentic dividers (1:1 Icecream Reader) */}
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

      {/* Right Controls: Columns, TTS, Fullscreen, Settings (1:1 Icecream Reader) */}
      <div className="flex items-center gap-1 text-[12px]">
        {/* Double Page Spread */}
        <button
          onClick={() => updateSettings({ pageSpread: 'double' })}
          className={`w-7 h-7 flex items-center justify-center rounded-[2px] transition-colors ${
            settings.pageSpread === 'double' ? 'text-white bg-[#282c37]' : 'text-[#8b949e] hover:text-white'
          }`}
          title="Two-page spread"
        >
          <Columns className="w-3.5 h-3.5" />
        </button>

        {/* Single Page Spread */}
        <button
          onClick={() => updateSettings({ pageSpread: 'single' })}
          className={`w-7 h-7 flex items-center justify-center rounded-[2px] transition-colors ${
            settings.pageSpread === 'single' ? 'text-white bg-[#282c37]' : 'text-[#8b949e] hover:text-white'
          }`}
          title="Single page view"
        >
          <SinglePageIcon className="w-3.5 h-3.5" />
        </button>

        {/* Read Aloud button */}
        <button
          onClick={handleToggleTTS}
          className={`h-7 px-2 flex items-center gap-1.5 rounded-[2px] transition-colors ${
            isTTSActive ? 'bg-[#2a69df] text-white' : 'text-[#8b949e] hover:text-white hover:bg-[#282c37]'
          }`}
          title="Start/pause reading aloud (F7)"
        >
          {isTTSActive ? (
            <Pause className="w-3.5 h-3.5 fill-current" />
          ) : (
            <Play className="w-3.5 h-3.5 fill-current" />
          )}
          <span>Read Aloud</span>
        </button>

        {/* Volume icon */}
        <button
          onClick={() => setIsMuted(!isMuted)}
          className="w-7 h-7 flex items-center justify-center rounded-[2px] text-[#8b949e] hover:text-white hover:bg-[#282c37] transition-colors"
          title="Volume"
        >
          {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
        </button>

        {/* Speed indicator */}
        <button
          onClick={cycleTTSSpeed}
          className="h-7 px-1.5 text-[11px] text-[#8b949e] hover:text-white hover:bg-[#282c37] rounded-[2px] font-mono flex items-center transition-colors"
          title="Reading speed"
        >
          {settings.ttsSpeed.toFixed(1)}x
        </button>

        {/* Fullscreen Toggle */}
        <button
          onClick={toggleFullscreen}
          className="w-7 h-7 flex items-center justify-center rounded-[2px] text-[#8b949e] hover:text-white hover:bg-[#282c37] transition-colors"
          title="Switch fullscreen (F11)"
        >
          {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
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
