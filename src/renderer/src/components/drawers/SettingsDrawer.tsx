import React, { useState, useEffect } from 'react'
import {
  X,
  Columns,
  Square,
  Play,
  Pause,
  Volume2,
  VolumeX,
  RotateCcw,
  Check,
  SlidersHorizontal,
  Keyboard
} from 'lucide-react'
import { useAppStore } from '../../stores/useAppStore'
import { ttsService } from '../../services/ttsService'
import { adaptiveScrollEngine } from '../../services/adaptiveScrollService'
import { switchActivePdfViewMode } from '../../services/pdfViewService'
import type { AutoscrollMode } from '../../db'
import { SecondsNumberInput } from '../ui/SecondsNumberInput'
import { ValueStepper } from '../ui/ValueStepper'
import { FontPicker } from '../ui/FontPicker'

type SettingsTab = 'display' | 'scroll' | 'more'

const THEME_SWATCHES: Array<{
  id: 'day' | 'light-sepia' | 'dark-sepia' | 'night'
  label: string
  bg: string
  ink: string
  border: string
}> = [
  { id: 'day', label: 'Light', bg: '#ffffff', ink: '#121212', border: 'rgba(0,0,0,0.12)' },
  { id: 'light-sepia', label: 'Paper', bg: '#f5ecd8', ink: '#1f1810', border: 'rgba(60,44,24,0.22)' },
  { id: 'dark-sepia', label: 'Dusk', bg: '#1f1914', ink: '#f5ede0', border: 'rgba(255,255,255,0.12)' },
  { id: 'night', label: 'Obsidian', bg: '#0c0c0d', ink: '#f5f7fa', border: 'rgba(255,255,255,0.12)' }
]

const FONT_WEIGHT_OPTIONS: Array<{ label: string; value: number }> = [
  { label: 'Normal', value: 400 },
  { label: 'Medium', value: 500 },
  { label: 'Bold', value: 600 }
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
    toggleBookMetadataModal,
    toggleHelpModal,
    isTTSActive,
    setTTSActive,
    isTTSMuted,
    setTTSMuted,
    isAutoscrollActive,
    setAutoscrollActive,
    pdfViewMode,
    pdfZoom,
    setPdfZoom,
    setScrollMode,
    isConvertingPdf,
    pdfConvertProgress,
    settings,
    updateSettings
  } = useAppStore()

  const [activeTab, setActiveTab] = useState<SettingsTab>('display')
  const [autoscrollMetrics, setAutoscrollMetrics] = useState(adaptiveScrollEngine.getMetrics())

  useEffect(() => {
    if (!isSettingsDrawerOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') toggleSettingsDrawer(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isSettingsDrawerOpen, toggleSettingsDrawer])

  useEffect(() => {
    if (!isSettingsDrawerOpen) return
    setAutoscrollMetrics(adaptiveScrollEngine.getMetrics())
    return adaptiveScrollEngine.subscribe((m) => setAutoscrollMetrics(m))
  }, [isSettingsDrawerOpen])

  if (!isSettingsDrawerOpen) return null

  const effectiveMode: AutoscrollMode =
    settings.autoscrollMode ?? (settings.autoscrollAdaptive === false ? 'countdown' : 'adaptive')
  const countdownSec = settings.autoscrollCountdownSec ?? 20
  const adaptiveSec = settings.autoscrollAdaptiveSec ?? 25
  const microPauseEnabled = settings.autoscrollMicroPause ?? true
  const isPdf = activeBook?.format === 'pdf'
  const isOriginalPdf = isPdf && pdfViewMode === 'original'

  const handleToggleAutoScrollPause = () => {
    adaptiveScrollEngine.setUserPaused(!autoscrollMetrics.isUserPaused)
  }

  const handleModeChange = (mode: AutoscrollMode) => {
    if (effectiveMode === mode) return
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

  const handleSelectPdfView = (target: 'original' | 'reflow') => {
    if (!isPdf || isConvertingPdf || pdfViewMode === target) return
    switchActivePdfViewMode(target)
  }

  return (
    <>
      {/* Subtle backdrop */}
      <div
        className="fixed inset-0 top-8 bg-black/45 backdrop-blur-[1px] z-40 transition-opacity"
        onClick={() => toggleSettingsDrawer(false)}
      />

      {/* Calm, Borderless Reading Settings Panel */}
      <aside className="fixed top-10 right-3 bottom-3 w-[320px] bg-[var(--app-surface)] border border-[var(--app-border)] rounded-[10px] z-50 flex flex-col justify-between shadow-[0_24px_64px_rgba(0,0,0,0.55)] select-none app-no-drag overflow-hidden animate-in slide-in-from-right-2 fade-in duration-150">
        {/* Header + Borderless 3-Tab Navigation (Display | Scroll | More) */}
        <div className="px-4 pt-3.5 pb-0 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[13px] font-semibold tracking-[-0.015em] text-[var(--app-text-strong)]">
              Reader Settings
            </span>
            <button
              type="button"
              onClick={() => toggleSettingsDrawer(false)}
              className="app-no-drag w-6 h-6 flex items-center justify-center text-[var(--app-text-subtle)] hover:text-[var(--app-text-strong)] hover:bg-[var(--app-surface-hover)] rounded-md transition-colors"
              title="Close (Esc)"
              aria-label="Close Reader Settings"
            >
              <X className="w-3.5 h-3.5 pointer-events-none" />
            </button>
          </div>

          <nav
            className="grid grid-cols-3 border-b border-[var(--app-border)]"
            role="tablist"
            aria-label="Reader settings sections"
          >
            {(
              [
                { id: 'display', label: 'Display' },
                { id: 'scroll', label: 'Scroll' },
                { id: 'more', label: 'More' }
              ] as const
            ).map((tab) => {
              const active = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative pb-2 text-[11.5px] font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                    active
                      ? 'text-[var(--app-text-strong)]'
                      : 'text-[var(--app-text-subtle)] hover:text-[var(--app-text)]'
                  }`}
                >
                  <span>{tab.label}</span>
                  {tab.id === 'scroll' && (isAutoscrollActive || isTTSActive) && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--app-accent)]" />
                  )}
                  {active && (
                    <span className="absolute inset-x-3 -bottom-px h-[1.5px] bg-[var(--app-text-strong)] rounded-full" />
                  )}
                </button>
              )
            })}
          </nav>
        </div>

        {/* Open, Airy Tab Body — Spacing Instead of Nested Boxes */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {/* ===================== TAB 1: DISPLAY ===================== */}
          {activeTab === 'display' && (
            <div className="space-y-6">
              {/* Surface Theme Swatches */}
              <div className="space-y-2">
                <span className="block text-[11px] font-semibold text-[var(--app-text-subtle)]">
                  Surface
                </span>
                <div className="grid grid-cols-4 gap-2">
                  {THEME_SWATCHES.map((t) => {
                    const active = settings.theme === t.id
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => updateSettings({ theme: t.id })}
                        className="flex flex-col items-center gap-1 group"
                      >
                        <div
                          data-preserve-theme="true"
                          style={{
                            backgroundColor: t.bg,
                            color: t.ink,
                            borderColor: active ? 'var(--app-accent)' : t.border
                          }}
                          className={`w-full h-9 rounded-md border flex items-center justify-center relative transition-all ${
                            active
                              ? 'ring-2 ring-[var(--app-accent)]/35'
                              : 'opacity-85 group-hover:opacity-100'
                          }`}
                        >
                          <span className="text-[13.5px] font-serif font-semibold">Aa</span>
                          {active && (
                            <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-[#2a69df] text-white flex items-center justify-center shadow">
                              <Check className="w-2 h-2 stroke-[3]" />
                            </span>
                          )}
                        </div>
                        <span
                          className={`text-[10px] font-semibold ${
                            active ? 'text-[var(--app-text-strong)]' : 'text-[var(--app-text-subtle)]'
                          }`}
                        >
                          {t.label}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Font Picker */}
              <FontPicker compact />

              {/* Flat Typography Rows */}
              <div className="space-y-3.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] font-semibold text-[var(--app-text)]">Text size</span>
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

                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] font-semibold text-[var(--app-text)]">
                    Line spacing
                  </span>
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

                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] font-semibold text-[var(--app-text)]">
                    Text weight
                  </span>
                  <div
                    className="grid grid-cols-3 p-0.5 bg-[var(--app-surface-2)] rounded-md w-[144px]"
                    role="radiogroup"
                    aria-label="Text weight"
                  >
                    {FONT_WEIGHT_OPTIONS.map((opt) => {
                      const active = (settings.fontWeight || 400) === opt.value
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          onClick={() => updateSettings({ fontWeight: opt.value })}
                          className={`h-6 rounded-[4px] text-[10.5px] font-semibold transition-all ${
                            active
                              ? 'bg-[var(--app-btn-primary-bg)] text-[var(--app-btn-primary-fg)]'
                              : 'text-[var(--app-text-muted)] hover:text-[var(--app-text-strong)]'
                          }`}
                        >
                          {opt.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] font-semibold text-[var(--app-text)]">
                    Page layout
                  </span>
                  <div
                    className="grid grid-cols-2 p-0.5 bg-[var(--app-surface-2)] rounded-md w-[144px]"
                    role="radiogroup"
                    aria-label="Page layout"
                  >
                    <button
                      type="button"
                      role="radio"
                      aria-checked={settings.pageSpread === 'single'}
                      onClick={() => updateSettings({ pageSpread: 'single' })}
                      className={`h-6 rounded-[4px] flex items-center justify-center gap-1 text-[10.5px] font-semibold transition-all ${
                        settings.pageSpread === 'single'
                          ? 'bg-[var(--app-btn-primary-bg)] text-[var(--app-btn-primary-fg)]'
                          : 'text-[var(--app-text-muted)] hover:text-[var(--app-text-strong)]'
                      }`}
                    >
                      <Square className="w-2.5 h-2.5" />
                      <span>Single</span>
                    </button>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={settings.pageSpread === 'double'}
                      onClick={() => updateSettings({ pageSpread: 'double' })}
                      className={`h-6 rounded-[4px] flex items-center justify-center gap-1 text-[10.5px] font-semibold transition-all ${
                        settings.pageSpread === 'double'
                          ? 'bg-[var(--app-btn-primary-bg)] text-[var(--app-btn-primary-fg)]'
                          : 'text-[var(--app-text-muted)] hover:text-[var(--app-text-strong)]'
                      }`}
                    >
                      <Columns className="w-2.5 h-2.5" />
                      <span>Spread</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Flat Lighting Rows */}
              <div className="space-y-3.5 pt-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] font-semibold text-[var(--app-text)]">
                    Screen dim
                  </span>
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

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-[12px] font-semibold text-[var(--app-text)]">
                        Warm eye filter
                      </div>
                      <div className="text-[10.5px] font-normal text-[var(--app-text-subtle)]">
                        Reduces blue light at night
                      </div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={!!settings.warmFilterEnabled}
                      data-preserve-theme="true"
                      onClick={() =>
                        updateSettings({ warmFilterEnabled: !settings.warmFilterEnabled })
                      }
                      style={{
                        backgroundColor: settings.warmFilterEnabled
                          ? '#f59e0b'
                          : 'var(--app-border-strong)'
                      }}
                      className="w-8 h-4 rounded-full p-0.5 flex items-center transition-colors shrink-0"
                    >
                      <span
                        className={`w-3 h-3 rounded-full bg-white shadow-sm block transition-transform duration-150 ${
                          settings.warmFilterEnabled ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {settings.warmFilterEnabled && (
                    <div className="space-y-2.5 pl-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11.5px] font-semibold text-[var(--app-text-muted)]">
                          Warmth
                        </span>
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
                        <span className="text-[11.5px] font-semibold text-[var(--app-text-muted)]">
                          Strength
                        </span>
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

                {/* Reading Progress Bar */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-[var(--app-border)]">
                  <div>
                    <div className="text-[12px] font-semibold text-[var(--app-text)]">
                      Progress bar
                    </div>
                    <div className="text-[10.5px] font-normal text-[var(--app-text-subtle)]">
                      Show bottom reading progress bar
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={settings.showProgressBar !== false}
                    data-preserve-theme="true"
                    onClick={() =>
                      updateSettings({ showProgressBar: settings.showProgressBar === false })
                    }
                    style={{
                      backgroundColor:
                        settings.showProgressBar !== false
                          ? 'var(--app-accent)'
                          : 'var(--app-border-strong)'
                    }}
                    className="w-8 h-4 rounded-full p-0.5 flex items-center transition-colors shrink-0 cursor-pointer"
                    title={settings.showProgressBar !== false ? 'Hide progress bar' : 'Show progress bar'}
                  >
                    <span
                      className={`w-3 h-3 rounded-full bg-white shadow-sm block transition-transform duration-150 ${
                        settings.showProgressBar !== false ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ===================== TAB 2: SCROLL ===================== */}
          {activeTab === 'scroll' && (
            <div className="space-y-6">
              {/* Scroll Direction */}
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12px] font-semibold text-[var(--app-text)]">Direction</span>
                <div
                  className="grid grid-cols-2 p-0.5 bg-[var(--app-surface-2)] rounded-md w-[152px]"
                  role="radiogroup"
                  aria-label="Scroll direction"
                >
                  {(
                    [
                      { id: 'horizontal', label: 'Horizontal' },
                      { id: 'vertical', label: 'Vertical' }
                    ] as const
                  ).map((dir) => {
                    const active = (settings.scrollMode || 'horizontal') === dir.id
                    return (
                      <button
                        key={dir.id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setScrollMode(dir.id)}
                        className={`h-6 rounded-[4px] text-[10.5px] font-semibold transition-all ${
                          active
                            ? 'bg-[var(--app-btn-primary-bg)] text-[var(--app-btn-primary-fg)]'
                            : 'text-[var(--app-text-muted)] hover:text-[var(--app-text-strong)]'
                        }`}
                      >
                        {dir.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Auto-Scroll (Flat, Subtle Controls) */}
              <div className="space-y-3.5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[12px] font-semibold text-[var(--app-text-strong)] flex items-center gap-1.5">
                      <span>Auto-Scroll</span>
                      {isAutoscrollActive && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--app-accent)]" />
                      )}
                    </div>
                    <div className="text-[10.5px] font-normal text-[var(--app-text-subtle)]">
                      Hands-free page turning
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isAutoscrollActive && (
                      <button
                        type="button"
                        onClick={handleToggleAutoScrollPause}
                        className={`h-6 px-2 rounded-md flex items-center gap-1 text-[11px] font-semibold transition-colors cursor-pointer ${
                          autoscrollMetrics.isUserPaused
                            ? 'bg-[var(--app-btn-primary-bg)] text-[var(--app-btn-primary-fg)]'
                            : 'bg-[var(--app-surface-2)] text-[var(--app-text-strong)] hover:bg-[var(--app-surface-hover)] border border-[var(--app-border)]'
                        }`}
                      >
                        {autoscrollMetrics.isUserPaused ? (
                          <>
                            <Play className="w-3 h-3 fill-current" />
                            <span>Resume</span>
                          </>
                        ) : (
                          <>
                            <Pause className="w-3 h-3" />
                            <span>Pause</span>
                          </>
                        )}
                      </button>
                    )}
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
                      className="w-8 h-4 rounded-full p-0.5 flex items-center transition-colors shrink-0 cursor-pointer"
                      title={isAutoscrollActive ? 'Turn off Auto-Scroll' : 'Turn on Auto-Scroll'}
                    >
                      <span
                        className={`w-3 h-3 rounded-full bg-white shadow-sm block transition-transform duration-150 ${
                          isAutoscrollActive ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Small Inline Mode Switcher */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11.5px] font-semibold text-[var(--app-text-muted)]">
                    Pacing
                  </span>
                  <div
                    className="grid grid-cols-2 p-0.5 bg-[var(--app-surface-2)] rounded-md w-[132px]"
                    role="radiogroup"
                    aria-label="Auto-scroll pacing mode"
                  >
                    {(
                      [
                        { id: 'countdown', label: 'Timer' },
                        { id: 'adaptive', label: 'Smart' }
                      ] as const
                    ).map((m) => {
                      const active = effectiveMode === m.id
                      return (
                        <button
                          key={m.id}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          onClick={() => handleModeChange(m.id)}
                          className={`h-6 rounded-[4px] text-[10.5px] font-semibold transition-all ${
                            active
                              ? 'bg-[var(--app-btn-primary-bg)] text-[var(--app-btn-primary-fg)]'
                              : 'text-[var(--app-text-muted)] hover:text-[var(--app-text-strong)]'
                          }`}
                        >
                          {m.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Interval + Subtle Presets */}
                {effectiveMode === 'countdown' ? (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-[11.5px] font-semibold text-[var(--app-text-muted)]">
                          Turn every
                        </span>
                        {countdownSec !== 20 && (
                          <button
                            type="button"
                            onClick={() => handleCountdownChange(20)}
                            title="Reset to 20s"
                            className="text-[var(--app-text-subtle)] hover:text-[var(--app-text-strong)]"
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

                    <div className="grid grid-cols-4 gap-1.5">
                      {TIMER_PRESETS.map((sec) => {
                        const active = countdownSec === sec
                        return (
                          <button
                            key={sec}
                            type="button"
                            onClick={() => handleCountdownChange(sec)}
                            className={`h-6 rounded-[4px] text-[10.5px] font-mono tabular-nums transition-colors ${
                              active
                                ? 'bg-[var(--app-btn-primary-bg)] text-[var(--app-btn-primary-fg)] font-semibold'
                                : 'bg-[var(--app-surface-2)] text-[var(--app-text-muted)] hover:text-[var(--app-text-strong)]'
                            }`}
                          >
                            {sec}s
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-[11.5px] font-semibold text-[var(--app-text-muted)]">
                          Base / page
                        </span>
                        {adaptiveSec !== 25 && (
                          <button
                            type="button"
                            onClick={() => handleAdaptiveSecChange(25)}
                            title="Reset to 25s"
                            className="text-[var(--app-text-subtle)] hover:text-[var(--app-text-strong)]"
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

                    <div className="grid grid-cols-4 gap-1.5">
                      {SMART_SEC_PRESETS.map((sec) => {
                        const active = adaptiveSec === sec
                        return (
                          <button
                            key={sec}
                            type="button"
                            onClick={() => handleAdaptiveSecChange(sec)}
                            className={`h-6 rounded-[4px] text-[10.5px] font-mono tabular-nums transition-colors ${
                              active
                                ? 'bg-[var(--app-btn-primary-bg)] text-[var(--app-btn-primary-fg)] font-semibold'
                                : 'bg-[var(--app-surface-2)] text-[var(--app-text-muted)] hover:text-[var(--app-text-strong)]'
                            }`}
                          >
                            {sec}s
                          </button>
                        )
                      })}
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11.5px] font-semibold text-[var(--app-text-muted)]">
                        Pause at breaks
                      </span>
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
                        className="w-8 h-4 rounded-full p-0.5 flex items-center transition-colors"
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

              {/* Read Aloud (Flat, Open Spacing) */}
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[12px] font-semibold text-[var(--app-text-strong)]">
                      Read Aloud
                    </div>
                    <div className="text-[10.5px] font-normal text-[var(--app-text-subtle)]">
                      Voice narration
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleToggleMute}
                      className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${
                        isTTSMuted
                          ? 'bg-[#e5484d]/15 text-[#e5484d]'
                          : 'bg-[var(--app-surface-2)] text-[var(--app-text-muted)] hover:text-[var(--app-text-strong)]'
                      }`}
                      title={isTTSMuted ? 'Resume voice' : 'Pause voice'}
                      aria-label={isTTSMuted ? 'Resume voice' : 'Pause voice'}
                    >
                      {isTTSMuted ? (
                        <VolumeX className="w-3.5 h-3.5" />
                      ) : (
                        <Volume2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={handleToggleTTS}
                      className={`h-6 px-2.5 rounded-md text-[11px] font-semibold flex items-center gap-1 transition-colors ${
                        isTTSActive
                          ? 'bg-[var(--app-accent)] text-white'
                          : 'bg-[var(--app-btn-primary-bg)] text-[var(--app-btn-primary-fg)]'
                      }`}
                    >
                      {isTTSActive ? (
                        <Pause className="w-3 h-3 fill-current" />
                      ) : (
                        <Play className="w-3 h-3 fill-current" />
                      )}
                      <span>{isTTSActive ? 'Stop' : 'Play'}</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-5 gap-1">
                  {TTS_SPEEDS.map((sp) => {
                    const active = Math.abs(settings.ttsSpeed - sp) < 0.05
                    return (
                      <button
                        key={sp}
                        type="button"
                        onClick={() => updateSettings({ ttsSpeed: sp })}
                        className={`h-6 rounded-[4px] text-[10px] font-mono tabular-nums transition-colors ${
                          active
                            ? 'bg-[var(--app-btn-primary-bg)] text-[var(--app-btn-primary-fg)] font-semibold'
                            : 'bg-[var(--app-surface-2)] text-[var(--app-text-muted)] hover:text-[var(--app-text-strong)]'
                        }`}
                      >
                        {sp.toFixed(1)}×
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ===================== TAB 3: MORE ===================== */}
          {activeTab === 'more' && (
            <div className="space-y-6">
              {/* View Mode Switcher: PDF | EPUB */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[12px] font-semibold text-[var(--app-text)]">
                      View as
                    </div>
                    {isPdf && pdfViewMode === 'original' && (
                      <div className="text-[10px] font-normal text-[var(--app-text-subtle)]">
                        convert
                      </div>
                    )}
                  </div>

                  <div
                    className="grid grid-cols-2 p-0.5 bg-[var(--app-surface-2)] rounded-md w-[124px] shrink-0"
                    role="radiogroup"
                    aria-label="View format"
                  >
                    <button
                      type="button"
                      role="radio"
                      aria-checked={isPdf ? pdfViewMode === 'original' : false}
                      disabled={!isPdf || isConvertingPdf}
                      onClick={() => handleSelectPdfView('original')}
                      title={!isPdf ? 'Native EPUB book' : undefined}
                      className={`h-6 rounded-[4px] text-[10.5px] font-semibold transition-all ${
                        isPdf && pdfViewMode === 'original'
                          ? 'bg-[var(--app-btn-primary-bg)] text-[var(--app-btn-primary-fg)]'
                          : !isPdf
                          ? 'text-[var(--app-text-subtle)] opacity-40'
                          : 'text-[var(--app-text-muted)] hover:text-[var(--app-text-strong)]'
                      }`}
                    >
                      PDF
                    </button>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={!isPdf || pdfViewMode === 'reflow'}
                      disabled={isConvertingPdf}
                      onClick={() => handleSelectPdfView('reflow')}
                      className={`h-6 rounded-[4px] text-[10.5px] font-semibold transition-all ${
                        !isPdf || pdfViewMode === 'reflow'
                          ? 'bg-[var(--app-btn-primary-bg)] text-[var(--app-btn-primary-fg)]'
                          : 'text-[var(--app-text-muted)] hover:text-[var(--app-text-strong)]'
                      }`}
                    >
                      {isConvertingPdf ? '...' : 'EPUB'}
                    </button>
                  </div>
                </div>

                {isConvertingPdf && pdfConvertProgress && (
                  <div className="space-y-1">
                    <div className="w-full h-1 bg-[var(--app-surface-2)] rounded overflow-hidden">
                      <div
                        className="h-full bg-[var(--app-accent)] transition-all duration-150"
                        style={{ width: `${pdfConvertProgress.percent}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] font-normal text-[var(--app-text-subtle)]">
                      <span className="truncate pr-2">{pdfConvertProgress.stage}</span>
                      <span className="font-mono tabular-nums">{pdfConvertProgress.percent}%</span>
                    </div>
                  </div>
                )}
              </div>

              {isOriginalPdf && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] font-semibold text-[var(--app-text)]">
                    Page zoom
                  </span>
                  <ValueStepper
                    value={Math.round(pdfZoom * 100)}
                    min={50}
                    max={300}
                    step={15}
                    unit="%"
                    ariaLabel="PDF zoom"
                    onChange={(val) => setPdfZoom(val / 100)}
                    compact
                  />
                </div>
              )}

              {/* Quiet Borderless Utility Rows */}
              <div className="space-y-1 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    toggleSettingsDrawer(false)
                    toggleFullSettingsModal(true)
                  }}
                  className="w-full px-2 py-2 -mx-2 rounded-md flex items-center gap-2.5 text-left text-[var(--app-text-muted)] hover:text-[var(--app-text-strong)] hover:bg-[var(--app-surface-hover)] transition-colors"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 opacity-75 shrink-0" />
                  <div>
                    <div className="text-[12px] font-semibold text-[var(--app-text)]">
                      All Preferences
                    </div>
                    <div className="text-[10px] font-normal text-[var(--app-text-subtle)]">
                      Backup, hotkeys, system options
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    toggleSettingsDrawer(false)
                    toggleHelpModal(true)
                  }}
                  className="w-full px-2 py-2 -mx-2 rounded-md flex items-center gap-2.5 text-left text-[var(--app-text-muted)] hover:text-[var(--app-text-strong)] hover:bg-[var(--app-surface-hover)] transition-colors"
                >
                  <Keyboard className="w-3.5 h-3.5 opacity-75 shrink-0" />
                  <div>
                    <div className="text-[12px] font-semibold text-[var(--app-text)]">
                      Keyboard Shortcuts
                    </div>
                    <div className="text-[10px] font-normal text-[var(--app-text-subtle)]">
                      Navigation &amp; quick commands
                    </div>
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Quiet Subtle Footer Text Button — Opens Centered Metadata Modal */}
        {activeBook && (
          <div className="px-4 py-2.5 flex items-center justify-center shrink-0">
            <button
              type="button"
              onClick={() => toggleBookMetadataModal(true)}
              className="text-[11px] font-normal text-[var(--app-text-subtle)] hover:text-[var(--app-text-strong)] hover:underline underline-offset-4 transition-colors py-0.5 px-2"
            >
              Metadata
            </button>
          </div>
        )}
      </aside>
    </>
  )
}
