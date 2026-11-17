import React from 'react'
import {
  X,
  Columns,
  Square,
  Sun,
  Moon,
  Coffee,
  AlignJustify,
  ArrowRight,
  Zap,
  Gauge,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Timer,
  RotateCcw,
  Pilcrow,
  Power,
  FileCode2,
  FileText,
  Download
} from 'lucide-react'
import { useAppStore } from '../../stores/useAppStore'
import { ttsService } from '../../services/ttsService'
import { adaptiveScrollEngine } from '../../services/adaptiveScrollService'
import type { AutoscrollMode } from '../../db'

export const SettingsDrawer: React.FC = () => {
  const {
    activeBook,
    isSettingsDrawerOpen,
    toggleSettingsDrawer,
    toggleFullSettingsModal,
    toggleHelpModal,
    isTTSActive,
    setTTSActive,
    isTTSMuted,
    setTTSMuted,
    isAutoscrollActive,
    setAutoscrollActive,
    toggleRSVP,
    pdfViewMode,
    setPdfViewMode,
    reflowEpubBuffer,
    setReflowEpubBuffer,
    isConvertingPdf,
    pdfConvertProgress,
    setPdfConversionState,
    settings,
    updateSettings
  } = useAppStore()

  if (!isSettingsDrawerOpen) return null

  const handleSwitchPdfMode = async (targetMode: 'original' | 'reflow') => {
    if (!activeBook || activeBook.format !== 'pdf') return
    if (targetMode === 'original') {
      setPdfViewMode('original')
      return
    }
    if (reflowEpubBuffer) {
      setPdfViewMode('reflow')
      return
    }
    if (!window.desktopAPI?.convertToEpub || !window.desktopAPI?.readFileBuffer) return

    setPdfConversionState(true, { percent: 5, stage: 'Starting MuPDF reflow engine...' })
    try {
      const res = await window.desktopAPI.convertToEpub({
        pdfPath: activeBook.filePath,
        mode: 'reflow-cache'
      })
      if (res.success && res.epubPath) {
        const epubBuf = await window.desktopAPI.readFileBuffer(res.epubPath)
        setReflowEpubBuffer(epubBuf)
        setPdfViewMode('reflow')
      } else {
        alert(res.error || 'Could not reflow PDF.')
      }
    } catch (err: any) {
      alert(err?.message || 'PDF reflow failed.')
    } finally {
      setPdfConversionState(false, null)
    }
  }

  const handleExportPdfAsEpub = async () => {
    if (!activeBook || activeBook.format !== 'pdf') return
    if (!window.desktopAPI?.showSaveDialog || !window.desktopAPI?.convertToEpub) return
    const safeName = activeBook.title.replace(/[^a-z0-9 _-]/gi, '').trim() || 'Converted_Book'
    const chosenPath = await window.desktopAPI.showSaveDialog({
      title: 'Export PDF as Offline EPUB',
      defaultPath: `${safeName}.epub`,
      filters: [{ name: 'EPUB eBook', extensions: ['epub'] }]
    })
    if (!chosenPath) return

    setPdfConversionState(true, { percent: 5, stage: 'Converting PDF to EPUB...' })
    try {
      const res = await window.desktopAPI.convertToEpub({
        pdfPath: activeBook.filePath,
        outputPath: chosenPath,
        mode: 'export'
      })
      if (!res.success) {
        alert(res.error || 'EPUB export failed.')
      }
    } finally {
      setPdfConversionState(false, null)
    }
  }

  const handleLineSpacingChange = (delta: number) => {
    const next = Math.max(1.0, Math.min(2.5, Number((settings.lineHeight + delta).toFixed(1))))
    updateSettings({ lineHeight: next })
  }

  const handleToggleTTS = () => {
    if (isTTSActive) {
      ttsService.stop()
      setTTSActive(false)
      setTTSMuted(false)
    } else {
      setTTSActive(true)
      setTTSMuted(false)
      const readerIframe = document.querySelector('iframe')
      const text = readerIframe?.contentDocument?.body?.innerText || activeBook?.title || 'Reading'
      ttsService.speak(text, {
        rate: settings.ttsSpeed,
        pitch: settings.ttsPitch,
        voiceURI: settings.ttsVoice,
        onEnd: () => {
          setTTSActive(false)
          setTTSMuted(false)
        }
      })
    }
  }

  const handleToggleMute = () => {
    const nextMuted = !isTTSMuted
    setTTSMuted(nextMuted)
    if (isTTSActive) {
      if (nextMuted) {
        ttsService.pause()
      } else {
        ttsService.resume()
      }
    }
  }

  const cycleTTSSpeed = () => {
    const speeds = [0.8, 1.0, 1.2, 1.5, 2.0]
    const nextIdx = (speeds.indexOf(settings.ttsSpeed) + 1) % speeds.length
    updateSettings({ ttsSpeed: speeds[nextIdx] })
  }

  return (
    <>
      {/* Backdrop for click-outside dismissal */}
      <div
        className="fixed inset-0 top-8 bg-black/40 z-40 transition-opacity"
        onClick={() => toggleSettingsDrawer(false)}
      />

      <aside className="fixed top-8 bottom-0 right-0 w-80 bg-[#171a21] border-l border-[#232732] z-50 flex flex-col justify-between shadow-2xl select-none app-no-drag animate-in slide-in-from-right duration-150">
        <div className="flex flex-col h-full overflow-hidden">
          {/* Header (1:1 Icecream Reader rec_12.jpg) */}
          <div className="h-10 bg-[#14161c] border-b border-[#232732] px-3.5 flex items-center justify-between shrink-0 app-no-drag">
            <span className="text-[13px] font-semibold text-white">Settings</span>
            <button
              type="button"
              onClick={() => toggleSettingsDrawer(false)}
              className="app-no-drag w-6 h-6 flex items-center justify-center text-[#8b949e] hover:text-white hover:bg-[#282c37] rounded-[2px] cursor-pointer"
              title="Close"
            >
              <X className="w-4 h-4 pointer-events-none" />
            </button>
          </div>

        {/* Settings Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs text-[#c9d1d9]">
          {/* PDF Reflow Mode & Offline EPUB Export (effective one-click switch in Settings) */}
          {activeBook?.format === 'pdf' && (
            <div className="p-2.5 bg-[#12141a] border border-[#2d323f] rounded-[2px] space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-white">PDF Reflow Mode</span>
                <span className="text-[10px] font-mono text-[#2a69df]">
                  {pdfViewMode === 'reflow' ? 'Reflow EPUB' : 'Original PDF'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <button
                  disabled={isConvertingPdf}
                  onClick={() => handleSwitchPdfMode('original')}
                  className={`h-8 rounded-[2px] flex items-center justify-center gap-1.5 border text-[11px] font-medium transition-colors ${
                    pdfViewMode === 'original'
                      ? 'bg-[#2a69df] border-[#2a69df] text-white'
                      : 'bg-[#282c37] border-[#3c404d] text-[#c9d1d9] hover:bg-[#323745]'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Original PDF</span>
                </button>
                <button
                  disabled={isConvertingPdf}
                  onClick={() => handleSwitchPdfMode('reflow')}
                  className={`h-8 rounded-[2px] flex items-center justify-center gap-1.5 border text-[11px] font-medium transition-colors ${
                    pdfViewMode === 'reflow'
                      ? 'bg-[#2a69df] border-[#2a69df] text-white'
                      : 'bg-[#282c37] border-[#3c404d] text-[#c9d1d9] hover:bg-[#323745]'
                  }`}
                  title="Reflow PDF into clean customizable EPUB text with images preserved"
                >
                  <FileCode2 className="w-3.5 h-3.5" />
                  <span>{isConvertingPdf ? 'Reflowing...' : 'Reflow EPUB'}</span>
                </button>
              </div>

              {isConvertingPdf && pdfConvertProgress && (
                <div className="space-y-1">
                  <div className="w-full h-1 bg-[#232732] rounded overflow-hidden">
                    <div
                      className="h-full bg-[#2a69df] transition-all duration-150"
                      style={{ width: `${pdfConvertProgress.percent}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-[#8b949e]">
                    <span className="truncate pr-2">{pdfConvertProgress.stage}</span>
                    <span className="font-mono shrink-0">{pdfConvertProgress.percent}%</span>
                  </div>
                </div>
              )}

              <button
                disabled={isConvertingPdf}
                onClick={handleExportPdfAsEpub}
                className="ice-btn-dark w-full h-7 flex items-center justify-center gap-1.5 text-[11px] rounded-[2px] disabled:opacity-50"
              >
                <Download className="w-3 h-3 text-[#4cd964]" />
                <span>Convert &amp; Export as EPUB (Offline)</span>
              </button>
            </div>
          )}

          {/* 1. Theme (2x2 grid with authentic icons, 1:1 rec_12.jpg) */}
          <div>
            <label className="text-[11px] font-medium text-[#8b949e] block mb-2">
              Theme
            </label>
            <div className="grid grid-cols-2 gap-2">
              {/* Day */}
              <button
                onClick={() => updateSettings({ theme: 'day' })}
                className={`h-9 rounded-[2px] flex items-center justify-center gap-2 border text-xs font-medium transition-colors ${
                  settings.theme === 'day'
                    ? 'bg-[#2a69df] border-[#2a69df] text-white'
                    : 'bg-[#282c37] border-[#3c404d] text-[#c9d1d9] hover:bg-[#323745]'
                }`}
              >
                <Sun className="w-3.5 h-3.5" />
                <span>Day</span>
              </button>

              {/* Night */}
              <button
                onClick={() => updateSettings({ theme: 'night' })}
                className={`h-9 rounded-[2px] flex items-center justify-center gap-2 border text-xs font-medium transition-colors ${
                  settings.theme === 'night'
                    ? 'bg-[#2a69df] border-[#2a69df] text-white'
                    : 'bg-[#282c37] border-[#3c404d] text-[#c9d1d9] hover:bg-[#323745]'
                }`}
              >
                <Moon className="w-3.5 h-3.5" />
                <span>Night</span>
              </button>

              {/* Light Sepia */}
              <button
                onClick={() => updateSettings({ theme: 'light-sepia' })}
                className={`h-9 rounded-[2px] flex items-center justify-center gap-2 border text-xs font-medium transition-colors ${
                  settings.theme === 'light-sepia'
                    ? 'bg-[#2a69df] border-[#2a69df] text-white'
                    : 'bg-[#282c37] border-[#3c404d] text-[#c9d1d9] hover:bg-[#323745]'
                }`}
              >
                <Coffee className="w-3.5 h-3.5" />
                <span>Light sepia</span>
              </button>

              {/* Dark Sepia */}
              <button
                onClick={() => updateSettings({ theme: 'dark-sepia' })}
                className={`h-9 rounded-[2px] flex items-center justify-center gap-2 border text-xs font-medium transition-colors ${
                  settings.theme === 'dark-sepia'
                    ? 'bg-[#2a69df] border-[#2a69df] text-white'
                    : 'bg-[#282c37] border-[#3c404d] text-[#c9d1d9] hover:bg-[#323745]'
                }`}
              >
                <Coffee className="w-3.5 h-3.5" />
                <span>Dark sepia</span>
              </button>
            </div>
          </div>

          {/* 2. Dimming Slider */}
          <div>
            <div className="flex items-center justify-between text-[11px] text-[#8b949e] mb-1.5">
              <span>Dimming</span>
            </div>
            <input
              type="range"
              min="0"
              max="75"
              value={settings.dimming}
              onChange={(e) => updateSettings({ dimming: Number(e.target.value) })}
              className="ice-slider w-full"
            />
          </div>

          {/* 3. Page view (Single vs Double, 1:1 Icecream rec_12.jpg) */}
          <div>
            <label className="text-[11px] font-medium text-[#8b949e] block mb-1.5">
              Page view
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => updateSettings({ pageSpread: 'double' })}
                className={`h-8 rounded-[2px] flex items-center justify-center gap-2 border text-xs font-medium transition-colors ${
                  settings.pageSpread === 'double'
                    ? 'bg-[#2a69df] border-[#2a69df] text-white'
                    : 'bg-[#282c37] border-[#3c404d] text-[#8b949e] hover:text-white'
                }`}
              >
                <Columns className="w-3.5 h-3.5" />
                <span>Double</span>
              </button>

              <button
                onClick={() => updateSettings({ pageSpread: 'single' })}
                className={`h-8 rounded-[2px] flex items-center justify-center gap-2 border text-xs font-medium transition-colors ${
                  settings.pageSpread === 'single'
                    ? 'bg-[#2a69df] border-[#2a69df] text-white'
                    : 'bg-[#282c37] border-[#3c404d] text-[#8b949e] hover:text-white'
                }`}
              >
                <Square className="w-3.5 h-3.5" />
                <span>Single</span>
              </button>
            </div>
          </div>

          {/* 4. Text Font Dropdown (rec_12.jpg shows 'Original font') */}
          <div>
            <label className="text-[11px] font-medium text-[#8b949e] block mb-1.5">
              Text Font
            </label>
            <select
              value={settings.fontFamily}
              onChange={(e) => updateSettings({ fontFamily: e.target.value as any })}
              className="ice-input w-full h-8 px-2.5 text-xs bg-[#12141a] border-[#2d323f] text-white rounded-[2px] cursor-pointer"
            >
              <option value="original">Original font</option>
              <option value="sans-serif">Segoe UI</option>
              <option value="serif">Georgia</option>
              <option value="monospace">Consolas</option>
            </select>
          </div>

          {/* 5. Font size Slider (rec_12.jpg shows 21px) */}
          <div>
            <div className="flex items-center justify-between text-[11px] text-[#8b949e] mb-1.5">
              <span>Font size</span>
              <span className="font-mono text-white text-[11px]">{settings.fontSize}px</span>
            </div>
            <input
              type="range"
              min="12"
              max="42"
              step="1"
              value={settings.fontSize}
              onChange={(e) => updateSettings({ fontSize: Number(e.target.value) })}
              className="ice-slider w-full"
            />
          </div>

          {/* 6. Line Spacing buttons (1:1 Icecream rec_12.jpg / rec_14.jpg) */}
          <div className="space-y-1.5">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleLineSpacingChange(-0.1)}
                className="ice-btn-dark h-9 flex flex-col items-center justify-center text-[10px] rounded-[2px]"
                title="Decrease line spacing"
              >
                <AlignJustify className="w-3.5 h-3.5 mb-0.5" />
                <span>Decrease line spacing</span>
              </button>
              <button
                onClick={() => handleLineSpacingChange(0.1)}
                className="ice-btn-dark h-9 flex flex-col items-center justify-center text-[10px] rounded-[2px]"
                title="Increase line spacing"
              >
                <AlignJustify className="w-3.5 h-3.5 mb-0.5" />
                <span>Increase line spacing</span>
              </button>
            </div>
          </div>

          <div className="h-px bg-[#232732] my-2" />

          {/* 7. Warm Blue Light Night Filter (Feature 5: isEnableBlueFilterNight) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-medium text-white flex items-center gap-1.5">
                <span>Warm Night Light</span>
              </label>
              <button
                onClick={() => updateSettings({ warmFilterEnabled: !settings.warmFilterEnabled })}
                className={`w-9 h-5 rounded-[2px] transition-colors p-0.5 flex items-center ${
                  settings.warmFilterEnabled ? 'bg-[#f59e0b] justify-end' : 'bg-[#282c37] justify-start'
                }`}
              >
                <span className="w-4 h-4 bg-white rounded-[1px] shadow-sm block" />
              </button>
            </div>

            {settings.warmFilterEnabled && (
              <div className="space-y-2.5 pt-1 bg-[#12141a] p-2.5 rounded-[2px] border border-[#232732]">
                <div>
                  <div className="flex items-center justify-between text-[10px] text-[#8b949e] mb-1">
                    <span>Temperature</span>
                    <span className="font-mono text-[#f59e0b]">{settings.warmFilterTemp || 3200}K</span>
                  </div>
                  <input
                    type="range"
                    min="2000"
                    max="4500"
                    step="100"
                    value={settings.warmFilterTemp || 3200}
                    onChange={(e) => updateSettings({ warmFilterTemp: Number(e.target.value) })}
                    className="ice-slider w-full"
                  />
                  <div className="flex justify-between text-[9px] text-[#6e7681] mt-0.5">
                    <span>2000K Candle</span>
                    <span>4500K Mild</span>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-[10px] text-[#8b949e] mb-1">
                    <span>Intensity</span>
                    <span className="font-mono text-white">{settings.warmFilterIntensity || 40}%</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="90"
                    step="5"
                    value={settings.warmFilterIntensity || 40}
                    onChange={(e) => updateSettings({ warmFilterIntensity: Number(e.target.value) })}
                    className="ice-slider w-full"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="h-px bg-[#232732] my-2" />

          {/* 8. Reading Tools & Speech (Moved from Top Bar) */}
          <div className="space-y-2.5">
            <label className="text-[11px] font-medium text-[#8b949e] block">
              Reading Tools & Speech
            </label>

            {/* Read Aloud Row: Play/Stop + Mute + Speed */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleToggleTTS}
                className={`flex-1 h-8 px-2.5 rounded-[2px] flex items-center justify-center gap-1.5 border text-xs font-medium transition-colors ${
                  isTTSActive
                    ? 'bg-[#2a69df] border-[#2a69df] text-white'
                    : 'bg-[#282c37] border-[#3c404d] text-[#c9d1d9] hover:bg-[#323745]'
                }`}
                title="Start/stop reading aloud (F7)"
              >
                {isTTSActive ? (
                  <Pause className="w-3.5 h-3.5 fill-current" />
                ) : (
                  <Play className="w-3.5 h-3.5 fill-current" />
                )}
                <span>{isTTSActive ? 'Stop Read Aloud' : 'Read Aloud'}</span>
              </button>

              <button
                onClick={handleToggleMute}
                className={`w-8 h-8 rounded-[2px] flex items-center justify-center border transition-colors ${
                  isTTSMuted
                    ? 'bg-[#3d1c20] border-[#5c262d] text-[#f85149]'
                    : 'bg-[#282c37] border-[#3c404d] text-[#c9d1d9] hover:bg-[#323745]'
                }`}
                title={isTTSMuted ? 'Unmute speech' : 'Mute / pause speech'}
              >
                {isTTSMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              </button>

              <button
                onClick={cycleTTSSpeed}
                className="h-8 px-2 rounded-[2px] border border-[#3c404d] bg-[#282c37] hover:bg-[#323745] text-[#c9d1d9] hover:text-white font-mono text-[11px] transition-colors"
                title="Cycle speech rate"
              >
                {settings.ttsSpeed.toFixed(1)}x
              </button>
            </div>

            {/* RSVP Launch Row */}
            <button
              type="button"
              onClick={() => {
                toggleSettingsDrawer(false)
                toggleRSVP(true)
              }}
              className="w-full h-8 px-2 rounded-[2px] flex items-center justify-center gap-1.5 border border-[#3c404d] bg-[#282c37] text-[#c9d1d9] hover:bg-[#323745] text-xs font-medium transition-colors"
              title="Launch RSVP Speed Reader (Optimal Recognition Point)"
            >
              <Gauge className="w-3.5 h-3.5 text-[#2a69df]" />
              <span>RSVP Reader</span>
            </button>

            <div className="h-px bg-[#232732] my-1.5" />

            {/* Dual-Mode Auto-Scroll Countdown Controls (Icon-Only + Rich Tooltips) */}
            {(() => {
              const effectiveMode: AutoscrollMode =
                settings.autoscrollMode ?? (settings.autoscrollAdaptive === false ? 'countdown' : 'adaptive')
              const countdownSec = settings.autoscrollCountdownSec ?? 20
              const targetWpm = settings.targetWpm ?? 250
              const microPauseEnabled = settings.autoscrollMicroPause ?? true

              const handleModeChange = (mode: AutoscrollMode) => {
                updateSettings({ autoscrollMode: mode, autoscrollAdaptive: mode === 'adaptive' })
                adaptiveScrollEngine.configure({ mode })
              }

              const handleCountdownChange = (sec: number) => {
                const clamped = Math.max(5, Math.min(120, Math.round(sec)))
                updateSettings({ autoscrollCountdownSec: clamped })
                adaptiveScrollEngine.configure({ fixedCountdownSec: clamped })
              }

              const handleWpmChange = (wpm: number) => {
                const clamped = Math.max(100, Math.min(800, Math.round(wpm)))
                updateSettings({ targetWpm: clamped })
                adaptiveScrollEngine.configure({ targetWpm: clamped })
              }

              const handleMicroPauseToggle = () => {
                const next = !microPauseEnabled
                updateSettings({ autoscrollMicroPause: next })
                adaptiveScrollEngine.configure({ microPauseEnabled: next })
              }

              const handleToggleAutoScroll = () => {
                const next = !isAutoscrollActive
                if (!next) adaptiveScrollEngine.stop()
                setAutoscrollActive(next)
              }

              return (
                <div className="space-y-2 pt-0.5">
                  <div className="flex items-center justify-between">
                    <span
                      className="text-[11px] font-medium text-white flex items-center gap-1.5"
                      title="Auto-Scroll displays a muted bottom-right countdown (even in fullscreen). Tap the number to pause or tweak parameters. Auto-pauses when leaving the app or after 5 minutes of inactivity."
                    >
                      {effectiveMode === 'countdown' ? (
                        <Timer className="w-3.5 h-3.5 text-[#2a69df]" />
                      ) : (
                        <Zap className="w-3.5 h-3.5 text-[#f59e0b]" />
                      )}
                      <span>Auto-Scroll</span>
                    </span>

                    <button
                      type="button"
                      onClick={handleToggleAutoScroll}
                      aria-label={isAutoscrollActive ? 'Turn off Auto-Scroll' : 'Turn on Auto-Scroll'}
                      title={
                        isAutoscrollActive
                          ? 'Auto-Scroll is ON — Click to stop and hide bottom-right countdown'
                          : 'Auto-Scroll is OFF — Click to start muted bottom-right countdown'
                      }
                      className={`w-7 h-7 rounded-[2px] flex items-center justify-center border transition-colors ${
                        isAutoscrollActive
                          ? 'bg-[#2a69df] border-[#2a69df] text-white'
                          : 'bg-[#282c37] border-[#3c404d] text-[#8b949e] hover:text-white hover:bg-[#323745]'
                      }`}
                    >
                      <Power className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Icon-Only Mode Switcher: Countdown Only vs Adaptive Countdown */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleModeChange('countdown')}
                      aria-label="Countdown Only Mode"
                      title="Countdown Only: Fixed seconds countdown per page turn (default 20s)"
                      className={`h-8 rounded-[2px] flex items-center justify-center border transition-colors ${
                        effectiveMode === 'countdown'
                          ? 'bg-[#2a69df] border-[#2a69df] text-white'
                          : 'bg-[#282c37] border-[#3c404d] text-[#8b949e] hover:text-white hover:bg-[#323745]'
                      }`}
                    >
                      <Timer className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleModeChange('adaptive')}
                      aria-label="Adaptive Countdown Mode"
                      title="Adaptive Countdown: Dynamically adjusts countdown based on visible page word count and your reading pace (EMA)"
                      className={`h-8 rounded-[2px] flex items-center justify-center border transition-colors ${
                        effectiveMode === 'adaptive'
                          ? 'bg-[#2a69df] border-[#2a69df] text-white'
                          : 'bg-[#282c37] border-[#3c404d] text-[#8b949e] hover:text-white hover:bg-[#323745]'
                      }`}
                    >
                      <Zap className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Parameter Controls */}
                  <div className="bg-[#12141a] p-2.5 rounded-[2px] border border-[#232732] space-y-2">
                    {effectiveMode === 'countdown' ? (
                      <>
                        <div className="flex items-center justify-between text-[11px] font-mono">
                          <span
                            className="flex items-center gap-1.5 text-[#8b949e]"
                            title={`Fixed countdown interval: ${countdownSec} seconds per page`}
                          >
                            <Timer className="w-3.5 h-3.5 text-[#2a69df]" />
                            <span className="text-white">{countdownSec}s</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCountdownChange(20)}
                            aria-label="Reset countdown interval to 20s"
                            title="Reset fixed countdown interval to default 20s"
                            className="w-6 h-6 flex items-center justify-center rounded-[2px] text-[#8b949e] hover:text-white hover:bg-[#282c37] transition-colors"
                          >
                            <RotateCcw className="w-3 h-3" />
                          </button>
                        </div>
                        <input
                          type="range"
                          min="5"
                          max="120"
                          step="5"
                          value={countdownSec}
                          onChange={(e) => handleCountdownChange(Number(e.target.value))}
                          aria-label="Fixed countdown seconds per page"
                          title={`Fixed countdown interval: ${countdownSec} seconds per page (5s to 120s)`}
                          className="ice-slider w-full"
                        />
                      </>
                    ) : (
                      <>
                        <div className="flex items-center justify-between text-[11px] font-mono">
                          <span
                            className="flex items-center gap-1.5 text-[#8b949e]"
                            title={`Target adaptive reading pace: ${targetWpm} WPM`}
                          >
                            <Gauge className="w-3.5 h-3.5 text-[#f59e0b]" />
                            <span className="text-white">{targetWpm}</span>
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={handleMicroPauseToggle}
                              aria-label="Toggle cognitive micro-pause"
                              title={
                                microPauseEnabled
                                  ? 'Cognitive micro-pause ON (300ms pause at section breaks & blockquotes) — Click to disable'
                                  : 'Cognitive micro-pause OFF — Click to enable 300ms pause at section breaks'
                              }
                              className={`w-6 h-6 flex items-center justify-center rounded-[2px] transition-colors ${
                                microPauseEnabled
                                  ? 'bg-[#2a69df]/20 text-[#79c0ff] border border-[#2a69df]/50'
                                  : 'text-[#6e7681] hover:text-white hover:bg-[#282c37]'
                              }`}
                            >
                              <Pilcrow className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                updateSettings({ targetWpm: 250 })
                                adaptiveScrollEngine.reset(250)
                              }}
                              aria-label="Reset adaptive pace to 250 WPM"
                              title="Reset adaptive reading pace to default 250 WPM"
                              className="w-6 h-6 flex items-center justify-center rounded-[2px] text-[#8b949e] hover:text-white hover:bg-[#282c37] transition-colors"
                            >
                              <RotateCcw className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                        <input
                          type="range"
                          min="100"
                          max="800"
                          step="25"
                          value={targetWpm}
                          onChange={(e) => handleWpmChange(Number(e.target.value))}
                          aria-label="Target adaptive reading speed (WPM)"
                          title={`Target adaptive reading pace: ${targetWpm} WPM (100 to 800 WPM)`}
                          className="ice-slider w-full"
                        />
                      </>
                    )}
                  </div>
                </div>
              )
            })()}
          </div>
        </div>

        {/* Bottom Docked Action Links (1:1 Icecream rec_14.jpg) */}
        <div className="p-3 border-t border-[#232732] space-y-2 shrink-0 bg-[#14161c]">
          <button
            onClick={() => {
              toggleSettingsDrawer(false)
              toggleFullSettingsModal(true)
            }}
            className="ice-btn-dark w-full h-8 flex items-center justify-center gap-1.5 text-xs text-[#c9d1d9] rounded-[2px]"
          >
            <span>Open All Settings</span>
            <ArrowRight className="w-3.5 h-3.5 text-[#8b949e]" />
          </button>
          <button
            onClick={() => {
              toggleSettingsDrawer(false)
              toggleHelpModal(true)
            }}
            className="ice-btn-dark w-full h-8 flex items-center justify-center gap-1.5 text-xs text-[#c9d1d9] rounded-[2px]"
          >
            <span>Show hotkeys</span>
            <ArrowRight className="w-3.5 h-3.5 text-[#8b949e]" />
          </button>
        </div>
      </div>
    </aside>
  </>
)
}
