import React, { useState, useEffect } from 'react'
import {
  X,
  Columns,
  Square,
  ArrowRight,
  Zap,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Timer,
  RotateCcw,
  FileCode2,
  FileText,
  Download,
  Minus,
  Plus,
  Check,
  SlidersHorizontal,
  Keyboard,
  BookOpen
} from 'lucide-react'
import { useAppStore } from '../../stores/useAppStore'
import { ttsService } from '../../services/ttsService'
import { adaptiveScrollEngine } from '../../services/adaptiveScrollService'
import type { AutoscrollMode } from '../../db'
import { SecondsNumberInput } from '../ui/SecondsNumberInput'
import { ValueStepper } from '../ui/ValueStepper'
import { FontPicker } from '../ui/FontPicker'
import { BookMetadataEditor } from './BookMetadataEditor'
import { formatFileSize } from '../../../../shared/bookMetadata'

type SettingsTab = 'display' | 'flow' | 'document'
type DrawerSubview = 'tabs' | 'metadata'

const THEME_SWATCHES: Array<{
  id: 'day' | 'light-sepia' | 'dark-sepia' | 'night'
  label: string
  bg: string
  ink: string
  border: string
}> = [
  { id: 'day', label: 'Light', bg: '#ffffff', ink: '#111111', border: 'rgba(0,0,0,0.12)' },
  { id: 'light-sepia', label: 'Paper', bg: '#f6ebd4', ink: '#4a3a26', border: 'rgba(95,75,50,0.2)' },
  { id: 'dark-sepia', label: 'Dusk', bg: '#26201a', ink: '#d8cbb8', border: 'rgba(255,255,255,0.1)' },
  { id: 'night', label: 'Obsidian', bg: '#0d0d0e', ink: '#ededed', border: 'rgba(255,255,255,0.12)' }
]

const SPACING_PRESETS = [
  { label: 'Tight', value: 1.2 },
  { label: 'Normal', value: 1.5 },
  { label: 'Relaxed', value: 1.9 }
]

const TIMER_PRESETS = [10, 20, 30, 45]
const SMART_SEC_PRESETS = [15, 25, 35, 50]
const TTS_SPEEDS = [0.8, 1.0, 1.2, 1.5, 2.0]

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
    pdfViewMode,
    setPdfViewMode,
    setScrollMode,
    reflowEpubBuffer,
    setReflowEpubBuffer,
    isConvertingPdf,
    pdfConvertProgress,
    setPdfConversionState,
    showToast,
    settings,
    updateSettings
  } = useAppStore()

  const [activeTab, setActiveTab] = useState<SettingsTab>('display')
  const [subview, setSubview] = useState<DrawerSubview>('tabs')

  // Reset drill-in view whenever drawer closes or active book changes
  useEffect(() => {
    if (!isSettingsDrawerOpen) {
      setSubview('tabs')
    }
  }, [isSettingsDrawerOpen, activeBook?.id])

  useEffect(() => {
    if (!isSettingsDrawerOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (subview === 'metadata') {
          setSubview('tabs')
        } else {
          toggleSettingsDrawer(false)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isSettingsDrawerOpen, subview, toggleSettingsDrawer])

  if (!isSettingsDrawerOpen) return null

  const effectiveMode: AutoscrollMode =
    settings.autoscrollMode ?? (settings.autoscrollAdaptive === false ? 'countdown' : 'adaptive')
  const countdownSec = settings.autoscrollCountdownSec ?? 20
  const adaptiveSec = settings.autoscrollAdaptiveSec ?? 25
  const microPauseEnabled = settings.autoscrollMicroPause ?? true

  const handleModeChange = (mode: AutoscrollMode) => {
    updateSettings({ autoscrollMode: mode, autoscrollAdaptive: mode === 'adaptive' })
    adaptiveScrollEngine.configure({ mode })
  }

  const handleCountdownChange = (sec: number) => {
    const clamped = Math.max(3, Math.min(600, Math.round(sec)))
    updateSettings({ autoscrollCountdownSec: clamped })
    adaptiveScrollEngine.configure({ fixedCountdownSec: clamped })
  }

  const handleAdaptiveSecChange = (sec: number) => {
    const clamped = Math.max(3, Math.min(600, Math.round(sec)))
    updateSettings({ autoscrollAdaptiveSec: clamped })
    adaptiveScrollEngine.configure({ adaptiveBaseSec: clamped })
  }

  const handleMicroPauseToggle = () => {
    const next = !microPauseEnabled
    updateSettings({ autoscrollMicroPause: next })
    adaptiveScrollEngine.configure({ microPauseEnabled: next })
  }

  const handleToggleAutoScroll = () => {
    const next = !isAutoscrollActive
    if (!next) {
      adaptiveScrollEngine.stop()
    } else {
      adaptiveScrollEngine.clearTransientSuspensions()
    }
    setAutoscrollActive(next)
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
      if (nextMuted) ttsService.pause()
      else ttsService.resume()
    }
  }

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
        showToast('Switched to Reflow mode', 'success')
      } else {
        showToast(res.error || 'Could not reflow PDF.', 'error')
      }
    } catch (err: any) {
      showToast(err?.message || 'PDF reflow failed.', 'error')
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
      if (res.success) {
        showToast('Exported EPUB successfully', 'success')
      } else {
        showToast(res.error || 'EPUB export failed.', 'error')
      }
    } finally {
      setPdfConversionState(false, null)
    }
  }

  const isPdf = activeBook?.format === 'pdf'

  return (
    <>
      {/* Subtle Geist backdrop */}
      <div
        className="fixed inset-0 top-8 bg-black/50 backdrop-blur-[1px] z-40 transition-opacity"
        onClick={() => toggleSettingsDrawer(false)}
      />

      {/* Elevated Geist Obsidian Panel */}
      <aside className="fixed top-10 right-3 bottom-3 w-[328px] bg-[#111111] border border-white/[0.09] rounded-[10px] z-50 flex flex-col justify-between shadow-[0_24px_64px_rgba(0,0,0,0.75)] select-none app-no-drag overflow-hidden animate-in slide-in-from-right-2 fade-in duration-150">
        {subview === 'metadata' && activeBook ? (
          <BookMetadataEditor
            book={activeBook}
            onBack={() => setSubview('tabs')}
            onClose={() => toggleSettingsDrawer(false)}
          />
        ) : (
        <>
        {/* Top Bar + Segmented 3-Tab Switcher */}
        <div className="px-3.5 pt-3 pb-2.5 border-b border-white/[0.07] space-y-2.5 shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-semibold tracking-[-0.015em] text-[#ededed]">
              Reader Settings
            </span>
            <button
              type="button"
              onClick={() => toggleSettingsDrawer(false)}
              className="app-no-drag w-6 h-6 flex items-center justify-center text-[#777777] hover:text-white hover:bg-white/[0.07] rounded-md transition-colors cursor-pointer"
              title="Close (Esc)"
            >
              <X className="w-3.5 h-3.5 pointer-events-none" />
            </button>
          </div>

          {/* Crisp Vercel Segmented Navigation */}
          <div className="grid grid-cols-3 p-0.5 bg-[#0a0a0a] rounded-md border border-white/[0.07]">
            <button
              type="button"
              onClick={() => setActiveTab('display')}
              className={`h-7 rounded-[4px] text-[11px] font-medium transition-all cursor-pointer ${
                activeTab === 'display'
                  ? 'bg-[#1f1f1f] text-white shadow-sm'
                  : 'text-[#888888] hover:text-[#ededed]'
              }`}
            >
              Display
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('flow')}
              className={`h-7 rounded-[4px] text-[11px] font-medium transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'flow'
                  ? 'bg-[#1f1f1f] text-white shadow-sm'
                  : 'text-[#888888] hover:text-[#ededed]'
              }`}
            >
              <span>Flow</span>
              {(isAutoscrollActive || isTTSActive) && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#0070f3]" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('document')}
              className={`h-7 rounded-[4px] text-[11px] font-medium transition-all cursor-pointer ${
                activeTab === 'document'
                  ? 'bg-[#1f1f1f] text-white shadow-sm'
                  : 'text-[#888888] hover:text-[#ededed]'
              }`}
            >
              {isPdf ? 'PDF' : 'More'}
            </button>
          </div>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {/* ===================== TAB 1: DISPLAY (Aa) ===================== */}
          {activeTab === 'display' && (
            <>
              {/* Scroll Mode + Surface */}
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12px] font-bold text-[#ededed]">Scroll Mode</span>
                <div className="bg-[#1a1a1a] rounded-md border border-white/[0.08] w-36">
                  <select
                    value={settings.scrollMode || 'horizontal'}
                    onChange={(e) => setScrollMode(e.target.value as 'horizontal' | 'vertical')}
                    className="w-full bg-transparent text-[12px] font-semibold text-white px-2 py-1 outline-none cursor-pointer"
                  >
                    <option value="horizontal">Horizontal</option>
                    <option value="vertical">Vertical</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <span className="text-[12px] font-bold text-[#ededed]">Surface</span>
                <div className="grid grid-cols-4 gap-2">
                  {THEME_SWATCHES.map((t) => {
                    const active = settings.theme === t.id
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => updateSettings({ theme: t.id })}
                        className={`flex flex-col items-center gap-1 group cursor-pointer`}
                      >
                        <div
                          data-preserve-theme="true"
                          style={{ backgroundColor: t.bg, color: t.ink, borderColor: active ? 'var(--app-accent)' : t.border }}
                          className={`w-full h-10 rounded-md border flex items-center justify-center relative transition-all ${
                            active ? 'ring-2 ring-[var(--app-accent)]/40 scale-[1.02]' : 'opacity-85 group-hover:opacity-100'
                          }`}
                        >
                          <span className="text-[14px] font-serif font-semibold">Aa</span>
                          {active && (
                            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[#2a69df] text-white flex items-center justify-center shadow">
                              <Check className="w-2.5 h-2.5 stroke-[3]" />
                            </span>
                          )}
                        </div>
                        <span className={`text-[10.5px] font-semibold ${active ? 'text-white' : 'text-[#888888]'}`}>
                          {t.label}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Expanded Downloadable Font Library Picker */}
              <FontPicker compact />

              {/* Compact Inline Typography Steppers */}
              <div className="px-3 py-2 bg-[#161616] border border-white/[0.07] rounded-lg divide-y divide-white/[0.06]">
                <div className="py-1.5 flex items-center justify-between gap-2">
                  <span className="text-[12px] font-bold text-[#ededed]">Text size</span>
                  <ValueStepper
                    value={settings.fontSize}
                    min={12}
                    max={42}
                    step={1}
                    unit="px"
                    ariaLabel="Font size"
                    onChange={(val) => updateSettings({ fontSize: val })}
                    compact
                  />
                </div>

                <div className="py-1.5 flex items-center justify-between gap-2">
                  <span className="text-[12px] font-bold text-[#ededed]">Line spacing</span>
                  <ValueStepper
                    value={Math.round(settings.lineHeight * 100)}
                    min={100}
                    max={250}
                    step={10}
                    unit="%"
                    ariaLabel="Line spacing"
                    onChange={(val) => updateSettings({ lineHeight: val / 100 })}
                    compact
                  />
                </div>
              </div>

              {/* Page Layout & Lighting */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-bold text-[#ededed]">Page layout</span>
                  <div className="grid grid-cols-2 p-0.5 bg-[#0a0a0a] rounded-md border border-white/[0.07] w-36">
                    <button
                      type="button"
                      onClick={() => updateSettings({ pageSpread: 'single' })}
                      className={`h-6 rounded-[4px] flex items-center justify-center gap-1 text-[11px] font-semibold transition-all cursor-pointer ${
                        settings.pageSpread === 'single' ? 'bg-[#222222] text-white' : 'text-[#888888] hover:text-white'
                      }`}
                    >
                      <Square className="w-3 h-3" />
                      <span>Single</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => updateSettings({ pageSpread: 'double' })}
                      className={`h-6 rounded-[4px] flex items-center justify-center gap-1 text-[11px] font-semibold transition-all cursor-pointer ${
                        settings.pageSpread === 'double' ? 'bg-[#222222] text-white' : 'text-[#888888] hover:text-white'
                      }`}
                    >
                      <Columns className="w-3 h-3" />
                      <span>Spread</span>
                    </button>
                  </div>
                </div>

                {/* Dimming + Warm Light */}
                <div className="p-3 bg-[#161616] border border-white/[0.07] rounded-lg space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12px] font-bold text-[#ededed]">Screen dim</span>
                    <ValueStepper
                      value={settings.dimming}
                      min={0}
                      max={70}
                      step={5}
                      unit="%"
                      ariaLabel="Screen dimming"
                      onChange={(val) => updateSettings({ dimming: val })}
                      compact
                    />
                  </div>

                  <div className="pt-2 border-t border-white/[0.06] space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-[12px] font-bold text-[#ededed]">Warm eye filter</div>
                        <div className="text-[10.5px] font-normal text-[#888888]">Reduces blue light at night</div>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={!!settings.warmFilterEnabled}
                        onClick={() => updateSettings({ warmFilterEnabled: !settings.warmFilterEnabled })}
                        className={`w-9 h-5 rounded-full p-0.5 flex items-center transition-colors cursor-pointer ${
                          settings.warmFilterEnabled ? 'bg-[#f59e0b] justify-end' : 'bg-[#262626] justify-start'
                        }`}
                      >
                        <span className="w-4 h-4 rounded-full bg-white shadow-sm block" />
                      </button>
                    </div>

                    {settings.warmFilterEnabled && (
                      <div className="space-y-2 pt-1.5 border-t border-white/[0.06]">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11.5px] font-bold text-[#ededed]">Warmth</span>
                          <ValueStepper
                            value={settings.warmFilterTemp || 3200}
                            min={2000}
                            max={4500}
                            step={100}
                            unit="K"
                            ariaLabel="Color temperature"
                            onChange={(val) => updateSettings({ warmFilterTemp: val })}
                            compact
                          />
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11.5px] font-bold text-[#ededed]">Strength</span>
                          <ValueStepper
                            value={settings.warmFilterIntensity || 40}
                            min={10}
                            max={90}
                            step={5}
                            unit="%"
                            ariaLabel="Warm filter strength"
                            onChange={(val) => updateSettings({ warmFilterIntensity: val })}
                            compact
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ===================== TAB 2: FLOW (Auto-Scroll, Speech) ===================== */}
          {activeTab === 'flow' && (
            <>
              {/* Hero Auto-Scroll Card */}
              <div className="p-3.5 bg-[#161616] border border-white/[0.08] rounded-lg space-y-3.5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[12px] font-semibold text-white flex items-center gap-1.5">
                      <span>Auto-Scroll</span>
                      {isAutoscrollActive && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[#0070f3]" />
                      )}
                    </div>
                    <div className="text-[11px] text-[#777777]">Hands-free page turning</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleToggleAutoScroll}
                      className={`h-7 px-2.5 rounded flex items-center gap-1.5 text-xs font-semibold cursor-pointer transition-colors ${
                        isAutoscrollActive
                          ? 'bg-[#e5484d]/12 text-[#e5484d] hover:bg-[#e5484d]/20 border border-[#e5484d]/30'
                          : 'bg-[var(--app-btn-primary-bg)] text-[var(--app-btn-primary-fg)] hover:bg-[var(--app-btn-primary-hover)]'
                      }`}
                      title={isAutoscrollActive ? 'Pause auto-scroll' : 'Play auto-scroll'}
                    >
                      {isAutoscrollActive ? (
                        <>
                          <Pause className="w-3.5 h-3.5" />
                          <span>Pause</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Play</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isAutoscrollActive}
                      data-preserve-theme="true"
                      onClick={handleToggleAutoScroll}
                      style={{
                        backgroundColor: isAutoscrollActive
                          ? 'var(--app-accent)'
                          : 'var(--app-border-strong)'
                      }}
                      className="w-9 h-5 rounded-full p-0.5 flex items-center transition-colors cursor-pointer"
                      title={isAutoscrollActive ? 'Turn off Auto-Scroll' : 'Turn on Auto-Scroll'}
                    >
                      <span
                        className={`w-4 h-4 rounded-full bg-white shadow-sm block transition-transform duration-150 ${
                          isAutoscrollActive ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Clear 2-Card Mode Chooser */}
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleModeChange('countdown')}
                    className={`p-2.5 rounded-md border text-left transition-all cursor-pointer ${
                      effectiveMode === 'countdown'
                        ? 'bg-white text-black border-white'
                        : 'bg-[#0f0f0f] border-white/[0.07] text-[#cccccc] hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold">
                      <Timer className="w-3.5 h-3.5" />
                      <span>Timer</span>
                    </div>
                    <div className={`text-[10px] mt-0.5 ${effectiveMode === 'countdown' ? 'text-black/65' : 'text-[#666666]'}`}>
                      Fixed seconds per page
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleModeChange('adaptive')}
                    className={`p-2.5 rounded-md border text-left transition-all cursor-pointer ${
                      effectiveMode === 'adaptive'
                        ? 'bg-white text-black border-white'
                        : 'bg-[#0f0f0f] border-white/[0.07] text-[#cccccc] hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold">
                      <Zap className="w-3.5 h-3.5" />
                      <span>Smart</span>
                    </div>
                    <div className={`text-[10px] mt-0.5 ${effectiveMode === 'adaptive' ? 'text-black/65' : 'text-[#666666]'}`}>
                      Matches your speed
                    </div>
                  </button>
                </div>

                {/* One-Tap Presets + Manual Seconds Input */}
                {effectiveMode === 'countdown' ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-[11.5px] font-bold text-[#ededed]">Turn every</span>
                        {countdownSec !== 20 && (
                          <button
                            type="button"
                            onClick={() => handleCountdownChange(20)}
                            title="Reset to 20s"
                            className="text-[#888888] hover:text-white cursor-pointer"
                          >
                            <RotateCcw className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      <SecondsNumberInput
                        value={countdownSec}
                        min={3}
                        max={600}
                        step={5}
                        compact
                        onChange={handleCountdownChange}
                        ariaLabel="Fixed seconds per page"
                      />
                    </div>

                    <div className="grid grid-cols-4 gap-1">
                      {TIMER_PRESETS.map((sec) => (
                        <button
                          key={sec}
                          type="button"
                          onClick={() => handleCountdownChange(sec)}
                          className={`h-7 rounded text-[11px] font-mono tabular-nums border transition-colors cursor-pointer ${
                            countdownSec === sec
                              ? 'bg-[#262626] border-white/25 text-white font-bold'
                              : 'bg-[#0f0f0f] border-white/[0.06] text-[#888888] hover:text-white'
                          }`}
                        >
                          {sec}s
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-[11.5px] font-bold text-[#ededed]">Base / page</span>
                        {adaptiveSec !== 25 && (
                          <button
                            type="button"
                            onClick={() => handleAdaptiveSecChange(25)}
                            title="Reset to 25s"
                            className="text-[#888888] hover:text-white cursor-pointer"
                          >
                            <RotateCcw className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      <SecondsNumberInput
                        value={adaptiveSec}
                        min={3}
                        max={600}
                        step={5}
                        compact
                        onChange={handleAdaptiveSecChange}
                        ariaLabel="Smart base seconds per page"
                      />
                    </div>

                    <div className="grid grid-cols-4 gap-1">
                      {SMART_SEC_PRESETS.map((sec) => (
                        <button
                          key={sec}
                          type="button"
                          onClick={() => handleAdaptiveSecChange(sec)}
                          className={`h-7 rounded text-[11px] font-mono tabular-nums border transition-colors cursor-pointer ${
                            adaptiveSec === sec
                              ? 'bg-[#262626] border-white/25 text-white font-bold'
                              : 'bg-[#0f0f0f] border-white/[0.06] text-[#888888] hover:text-white'
                          }`}
                        >
                          {sec}s
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
                      <span className="text-[11.5px] font-bold text-[#ededed]">Pause at breaks</span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={microPauseEnabled}
                        data-preserve-theme="true"
                        onClick={handleMicroPauseToggle}
                        style={{
                          backgroundColor: microPauseEnabled
                            ? 'var(--app-accent)'
                            : 'var(--app-border-strong)'
                        }}
                        className="w-8 h-4 rounded-full p-0.5 flex items-center transition-colors cursor-pointer"
                      >
                        <span
                          className={`w-3 h-3 rounded-full bg-white shadow-sm block transition-transform duration-150 ${
                            microPauseEnabled ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Read Aloud Card */}
              <div className="p-3.5 bg-[#161616] border border-white/[0.08] rounded-lg space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[12px] font-semibold text-white">Read Aloud</div>
                    <div className="text-[11px] text-[#777777]">Natural voice narration</div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleToggleMute}
                      className={`w-7 h-7 rounded-md border flex items-center justify-center transition-colors cursor-pointer ${
                        isTTSMuted
                          ? 'bg-[#e5484d]/12 border-[#e5484d]/30 text-[#e5484d]'
                          : 'bg-[#0f0f0f] border-white/[0.08] text-[#888888] hover:text-white'
                      }`}
                      title={isTTSMuted ? 'Resume voice' : 'Pause voice'}
                    >
                      {isTTSMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={handleToggleTTS}
                      className={`h-7 px-3 rounded-md text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                        isTTSActive
                          ? 'bg-[#0070f3] text-white'
                          : 'bg-[var(--app-btn-primary-bg)] text-[var(--app-btn-primary-fg)] hover:bg-[var(--app-btn-primary-hover)]'
                      }`}
                    >
                      {isTTSActive ? <Pause className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
                      <span>{isTTSActive ? 'Stop' : 'Play'}</span>
                    </button>
                  </div>
                </div>

                {/* One-tap Speed Chips */}
                <div className="grid grid-cols-5 gap-1">
                  {TTS_SPEEDS.map((sp) => (
                    <button
                      key={sp}
                      type="button"
                      onClick={() => updateSettings({ ttsSpeed: sp })}
                      className={`h-6 rounded text-[10px] font-mono tabular-nums border transition-colors cursor-pointer ${
                        Math.abs(settings.ttsSpeed - sp) < 0.05
                          ? 'bg-[#262626] border-white/25 text-white font-medium'
                          : 'bg-[#0f0f0f] border-white/[0.06] text-[#777777] hover:text-white'
                      }`}
                    >
                      {sp.toFixed(1)}×
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ===================== TAB 3: PDF & MORE ===================== */}
          {activeTab === 'document' && (
            <>
              {activeBook && (
                <button
                  type="button"
                  onClick={() => setSubview('metadata')}
                  className="settings-btn-secondary w-full p-2.5 rounded-lg flex items-center gap-3 text-left group transition-all active:scale-[0.99]"
                  title="Inspect and edit book metadata, tags, and cover thumbnail"
                >
                  <div
                    data-preserve-theme="true"
                    className="w-[38px] h-[54px] rounded-[4px] overflow-hidden shrink-0 border border-white/[0.12] bg-[#141414] flex items-center justify-center"
                  >
                    {activeBook.coverDataUrl ? (
                      <img
                        src={activeBook.coverDataUrl}
                        alt={activeBook.title}
                        className="w-full h-full object-cover block"
                      />
                    ) : (
                      <BookOpen className="w-4 h-4 text-[#777777]" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="text-[12px] font-semibold truncate leading-snug">
                      {activeBook.title}
                    </div>
                    <div className="text-[10.5px] opacity-70 truncate">
                      {activeBook.author || 'Unknown Author'}
                    </div>
                    <div className="flex items-center gap-1.5 pt-0.5 flex-wrap">
                      <span className="text-[9.5px] font-mono uppercase tabular-nums opacity-60">
                        {activeBook.format} · {formatFileSize(activeBook.fileSize)}
                      </span>
                      {activeBook.tags && activeBook.tags.length > 0 && (
                        <>
                          {activeBook.tags.slice(0, 2).map((tag) => (
                            <span
                              key={tag}
                              className="px-1.5 py-[1px] rounded-[3px] bg-[var(--app-surface-2)] border border-[var(--app-border)] text-[9.5px] opacity-85 truncate max-w-[78px]"
                            >
                              {tag}
                            </span>
                          ))}
                          {activeBook.tags.length > 2 && (
                            <span className="text-[9.5px] font-mono tabular-nums opacity-60">
                              +{activeBook.tags.length - 2}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  <ArrowRight className="w-3.5 h-3.5 opacity-55 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all shrink-0" />
                </button>
              )}

              {isPdf && (
                <div className="p-3.5 bg-[#161616] border border-white/[0.08] rounded-lg space-y-3">
                  <div>
                    <div className="text-[12px] font-semibold text-white">PDF Reading Mode</div>
                    <div className="text-[11px] text-[#777777]">Switch between exact layout or fluid text</div>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      disabled={isConvertingPdf}
                      onClick={() => handleSwitchPdfMode('original')}
                      className={`p-2.5 rounded-md border text-left transition-all cursor-pointer ${
                        pdfViewMode === 'original'
                          ? 'bg-white text-black border-white'
                          : 'bg-[#0f0f0f] border-white/[0.07] text-[#cccccc] hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold">
                        <FileText className="w-3.5 h-3.5" />
                        <span>Original</span>
                      </div>
                      <div className={`text-[10px] mt-0.5 ${pdfViewMode === 'original' ? 'text-black/65' : 'text-[#666666]'}`}>
                        Exact PDF pages
                      </div>
                    </button>

                    <button
                      type="button"
                      disabled={isConvertingPdf}
                      onClick={() => handleSwitchPdfMode('reflow')}
                      className={`p-2.5 rounded-md border text-left transition-all cursor-pointer ${
                        pdfViewMode === 'reflow'
                          ? 'bg-white text-black border-white'
                          : 'bg-[#0f0f0f] border-white/[0.07] text-[#cccccc] hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold">
                        <FileCode2 className="w-3.5 h-3.5" />
                        <span>{isConvertingPdf ? 'Reflowing...' : 'Reflow'}</span>
                      </div>
                      <div className={`text-[10px] mt-0.5 ${pdfViewMode === 'reflow' ? 'text-black/65' : 'text-[#666666]'}`}>
                        Fluid text &amp; fonts
                      </div>
                    </button>
                  </div>

                  {isConvertingPdf && pdfConvertProgress && (
                    <div className="space-y-1">
                      <div className="w-full h-1 bg-[#262626] rounded overflow-hidden">
                        <div
                          className="h-full bg-[var(--app-accent)] transition-all duration-150"
                          style={{ width: `${pdfConvertProgress.percent}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-[#888888]">
                        <span className="truncate pr-2">{pdfConvertProgress.stage}</span>
                        <span className="font-mono tabular-nums">{pdfConvertProgress.percent}%</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={async () => {
                  if (!isPdf || !window.desktopAPI?.showSaveDialog || !window.desktopAPI?.convertToEpub) {
                    showToast('PDF conversion is only available for PDF files.', 'error')
                    return
                  }
                  const savePath = await window.desktopAPI.showSaveDialog({
                    title: 'Save EPUB',
                    filters: [{ name: 'EPUB Files', extensions: ['epub'] }]
                  })
                  if (savePath) {
                    setPdfConversionState(true, { percent: 10, stage: 'Converting...' })
                    const res = await window.desktopAPI.convertToEpub({
                      pdfPath: activeBook!.filePath,
                      outputPath: savePath,
                      mode: 'export'
                    })
                    setPdfConversionState(false)
                    if (res.success) {
                      showToast('Saved as EPUB', 'success')
                    } else {
                      showToast(res.error || 'Conversion failed', 'error')
                    }
                  }
                }}
                className={`w-full flex items-center justify-between p-3.5 rounded-lg transition-all cursor-pointer active:scale-[0.98] ${
                  isPdf
                    ? 'settings-btn-secondary'
                    : 'bg-[var(--app-surface-2)] border border-[var(--app-border)] text-[var(--app-text-muted)] opacity-55'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Download className="w-4 h-4" />
                  <span className="text-[12px] font-semibold">Convert to EPUB</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 opacity-70" />
              </button>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    toggleSettingsDrawer(false)
                    toggleFullSettingsModal(true)
                  }}
                  className="settings-btn-secondary w-full p-3 rounded-lg flex items-center justify-between cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5 text-left">
                    <SlidersHorizontal className="w-4 h-4 opacity-75 group-hover:opacity-100" />
                    <div>
                      <div className="text-[12px] font-medium">All Preferences</div>
                      <div className="text-[10px] opacity-65">Backup, hotkeys, system options</div>
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 opacity-60 group-hover:translate-x-0.5 transition-transform" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    toggleSettingsDrawer(false)
                    toggleHelpModal(true)
                  }}
                  className="settings-btn-secondary w-full p-3 rounded-lg flex items-center justify-between cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5 text-left">
                    <Keyboard className="w-4 h-4 opacity-75 group-hover:opacity-100" />
                    <div>
                      <div className="text-[12px] font-medium">Keyboard Shortcuts</div>
                      <div className="text-[10px] opacity-65">Navigation &amp; quick commands</div>
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 opacity-60 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>
            </>
          )}
        </div>
        </>
        )}
      </aside>
    </>
  )
}
