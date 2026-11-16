import React from 'react'
import {
  ArrowLeft,
  List,
  Volume2,
  VolumeX,
  Play,
  Pause,
  Sliders,
  Maximize,
  Minimize,
  BookMarked
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
    isAutoscrollActive,
    setAutoscrollActive,
    toggleTOCDrawer,
    toggleSettingsDrawer,
    settings
  } = useAppStore()

  const [isFullscreen, setIsFullscreen] = React.useState(false)

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  const handleToggleTTS = () => {
    if (isTTSActive) {
      ttsService.stop()
      setTTSActive(false)
    } else {
      setTTSActive(true)
      // Play current page text
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

  return (
    <header className="h-11 glass-card border-b border-white/5 flex items-center justify-between px-4 z-40">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="btn-press px-2.5 py-1 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs font-medium flex items-center gap-1.5 transition-colors"
          title="Back to Library"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Library</span>
        </button>
        <span className="text-xs font-semibold text-slate-200 truncate max-w-sm">
          {activeBook?.title} {currentChapter ? `· ${currentChapter}` : ''}
        </span>
      </div>

      <div className="flex items-center gap-2">
        {/* TOC Drawer button */}
        <button
          onClick={() => toggleTOCDrawer()}
          className="btn-press p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          title="Table of Contents"
        >
          <List className="w-4 h-4" />
        </button>

        {/* TTS Toggle */}
        <button
          onClick={handleToggleTTS}
          className={`btn-press px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
            isTTSActive
              ? 'bg-purple-600/30 text-purple-300 border border-purple-400/40 shadow-sm animate-pulse'
              : 'text-slate-400 hover:text-white hover:bg-white/10'
          }`}
          title="Text-to-Speech (Librera Rules)"
        >
          {isTTSActive ? <Volume2 className="w-3.5 h-3.5 text-purple-300" /> : <VolumeX className="w-3.5 h-3.5" />}
          <span>TTS</span>
        </button>

        {/* Autoscroll Toggle */}
        <button
          onClick={() => setAutoscrollActive(!isAutoscrollActive)}
          className={`btn-press px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
            isAutoscrollActive
              ? 'bg-cyan-600/30 text-cyan-300 border border-cyan-400/40'
              : 'text-slate-400 hover:text-white hover:bg-white/10'
          }`}
          title="Hands-free Autoscroll"
        >
          {isAutoscrollActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          <span>Scroll</span>
        </button>

        {/* Settings Drawer */}
        <button
          onClick={() => toggleSettingsDrawer()}
          className="btn-press p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          title="Reading Settings (Themes, Typography, Dimming)"
        >
          <Sliders className="w-4 h-4" />
        </button>

        {/* Fullscreen */}
        <button
          onClick={toggleFullscreen}
          className="btn-press p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          title="Fullscreen (F11)"
        >
          {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
        </button>
      </div>
    </header>
  )
}
