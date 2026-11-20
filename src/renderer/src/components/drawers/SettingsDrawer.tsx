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
import { DimnessSlider } from '../ui/DimnessSlider'

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

const TEXT_SIZE_PRESETS = [
  { id: 'small', value: 15, label: 'Small', sizeClass: 'text-[11px]' },
  { id: 'medium', value: 19, label: 'Medium', sizeClass: 'text-[14px]' },
  { id: 'large', value: 24, label: 'Large', sizeClass: 'text-[18px]' }
]

const isTextSizeActive = (cur: number, val: number) => {
  if (val === 15) return cur <= 16
  if (val === 19) return cur > 16 && cur < 22
  return cur >= 22
}

const LINE_SPACING_PRESETS = [
  {
    id: 'compact',
    value: 1.25,
    label: 'Compact',
    icon: (
      <svg className="w-4 h-2.5 text-current shrink-0" viewBox="0 0 16 10" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
        <line x1="2" y1="3" x2="14" y2="3" />
        <line x1="2" y1="7" x2="14" y2="7" />
      </svg>
    )
  },
  {
    id: 'balanced',
    value: 1.5,
    label: 'Balanced',
    icon: (
      <svg className="w-4 h-3 text-current shrink-0" viewBox="0 0 16 12" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
        <line x1="2" y1="2.5" x2="14" y2="2.5" />
        <line x1="2" y1="6" x2="14" y2="6" />
        <line x1="2" y1="9.5" x2="14" y2="9.5" />
      </svg>
    )
  },
  {
    id: 'relaxed',
    value: 1.85,
    label: 'Relaxed',
    icon: (
      <svg className="w-4 h-3.5 text-current shrink-0" viewBox="0 0 16 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <line x1="2" y1="2" x2="14" y2="2" />
        <line x1="2" y1="5.5" x2="14" y2="5.5" />
        <line x1="2" y1="9" x2="14" y2="9" />
        <line x1="2" y1="12.5" x2="14" y2="12.5" />
      </svg>
    )
  }
]

const isLineSpacingActive = (cur: number, val: number) => {
  if (val === 1.25) return cur <= 1.35
  if (val === 1.5) return cur > 1.35 && cur <= 1.65
  return cur > 1.65
}

const FONT_WEIGHT_PRESETS = [
  { value: 400, label: 'Regular', weightClass: 'font-normal' },
  { value: 500, label: 'Medium', weightClass: 'font-medium' },
  { value: 600, label: 'Bold', weightClass: 'font-bold' }
]

const isFontWeightActive = (cur: number | undefined, val: number) => {
  const current = cur || 400
  if (val === 400) return current <= 450
  if (val === 500) return current > 450 && current < 600
  return current >= 600
}

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
      const isClose =
        e.key === 'Escape' ||
        (e.altKey && !e.ctrlKey && !e.metaKey && (
          e.key === 'ArrowLeft' || e.key === '<' || e.key === ',' || e.code === 'Comma' || e.code === 'IntlBackslash' || e.key.toLowerCase() === 'x' || e.code === 'KeyX'
        ))
      if (isClose) {
        e.preventDefault()
        e.stopPropagation()
        toggleSettingsDrawer(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isSettingsDrawerOpen, toggleSettingsDrawer])

  useEffect(() => {
    if (!isSettingsDrawerOpen) return
    adaptiveScrollEngine.setSuspension('drawer', true)
    setAutoscrollMetrics(adaptiveScrollEngine.getMetrics())
    const unsub = adaptiveScrollEngine.subscribe((m) => setAutoscrollMetrics(m))
    return () => {
      unsub()
      adaptiveScrollEngine.setSuspension('drawer', false)
      adaptiveScrollEngine.recordUserActivity()
    }
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
    if (isPdf) return
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
        className="fixed inset-0 top-8 bg-black/45 backdrop-blur-[1px] z-[96] transition-opacity"
        onClick={() => toggleSettingsDrawer(false)}
      />

      {/* Calm, Borderless Reading Settings Panel */}
      <aside className="fixed top-10 right-3 bottom-3 w-[320px] bg-[var(--app-surface)] border border-[var(--app-border)] rounded-[10px] z-[97] flex flex-col justify-between shadow-[0_24px_64px_rgba(0,0,0,0.55)] select-none app-no-drag overflow-hidden animate-in slide-in-from-right-2 fade-in duration-150">
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
                {/* Text Size: 3 A's in varying sizes without text labels */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] font-semibold text-[var(--app-text)]">Text size</span>
                  <div
                    className="glass-pill-track grid-cols-3 w-[156px]"
                    role="radiogroup"
                    aria-label="Text size"
                  >
                    {TEXT_SIZE_PRESETS.map((p) => {
                      const active = isTextSizeActive(settings.fontSize, p.value)
                      return (
                        <button
                          key={p.id}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          data-active={active ? 'true' : 'false'}
                          onClick={() => updateSettings({ fontSize: p.value })}
                          className="glass-pill-btn flex items-center justify-center"
                          title={`${p.label} text size (${p.value}px)`}
                        >
                          <span className={`${p.sizeClass} font-serif font-bold leading-none`}>A</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Line Spacing: Illustrative 2, 3, or 4 line drawings */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] font-semibold text-[var(--app-text)]">
                    Line spacing
                  </span>
                  <div
                    className="glass-pill-track grid-cols-3 w-[156px]"
                    role="radiogroup"
                    aria-label="Line spacing"
                  >
                    {LINE_SPACING_PRESETS.map((p) => {
                      const active = isLineSpacingActive(settings.lineHeight, p.value)
                      return (
                        <button
                          key={p.id}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          data-active={active ? 'true' : 'false'}
                          onClick={() => updateSettings({ lineHeight: p.value })}
                          className="glass-pill-btn flex items-center justify-center"
                          title={`${p.label} line spacing`}
                        >
                          {p.icon}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Text Weight: B preview glyphs in 3 weights without words */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] font-semibold text-[var(--app-text)]">
                    Text weight
                  </span>
                  <div
                    className="glass-pill-track grid-cols-3 w-[156px]"
                    role="radiogroup"
                    aria-label="Text weight"
                  >
                    {FONT_WEIGHT_PRESETS.map((opt) => {
                      const active = isFontWeightActive(settings.fontWeight, opt.value)
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          data-active={active ? 'true' : 'false'}
                          onClick={() => updateSettings({ fontWeight: opt.value })}
                          className="glass-pill-btn flex items-center justify-center"
                          title={`${opt.label} weight`}
                        >
                          <span className={`text-[13.5px] font-serif ${opt.weightClass} leading-none`}>
                            B
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Page Layout: A4 Paper Dimension for Single, Book icon for Spread */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] font-semibold text-[var(--app-text)]">
                    Page layout
                  </span>
                  <div
                    className="glass-pill-track grid-cols-2 w-[156px]"
                    role="radiogroup"
                    aria-label="Page layout"
                  >
                    <button
                      type="button"
                      role="radio"
                      aria-checked={settings.pageSpread === 'single'}
                      data-active={settings.pageSpread === 'single' ? 'true' : 'false'}
                      onClick={() => updateSettings({ pageSpread: 'single' })}
                      className="glass-pill-btn gap-1.5"
                      title="Single Page (A4 Paper)"
                    >
                      <svg
                        className="w-3 h-3.5 text-current shrink-0"
                        viewBox="0 0 14 18"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect x="2" y="1.5" width="10" height="15" rx="1.5" />
                        <line x1="4.5" y1="5.5" x2="9.5" y2="5.5" strokeWidth="1.1" />
                        <line x1="4.5" y1="8.5" x2="9.5" y2="8.5" strokeWidth="1.1" />
                        <line x1="4.5" y1="11.5" x2="7.5" y2="11.5" strokeWidth="1.1" />
                      </svg>
                      <span>Single</span>
                    </button>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={settings.pageSpread === 'double'}
                      data-active={settings.pageSpread === 'double' ? 'true' : 'false'}
                      onClick={() => updateSettings({ pageSpread: 'double' })}
                      className="glass-pill-btn gap-1.5"
                      title="Two-Page Spread (Open Book)"
                    >
                      <svg
                        className="w-3.5 h-3 text-current shrink-0"
                        viewBox="0 0 16 14"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M2 3C4 2 6 2.5 8 3.5C10 2.5 12 2 14 3V12C12 11 10 11.5 8 12.5C6 11.5 4 11 2 12V3Z" />
                        <line x1="8" y1="3.5" x2="8" y2="12.5" />
                      </svg>
                      <span>Spread</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Flat Lighting Rows: Custom Dimness Slider */}
              <div className="space-y-3.5 pt-1">
                <DimnessSlider
                  value={settings.dimming ?? 0}
                  min={0}
                  max={70}
                  step={5}
                  onChange={(val) => updateSettings({ dimming: val })}
                />

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
                  className="glass-pill-track grid-cols-2 w-[164px]"
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
                        data-active={active ? 'true' : 'false'}
                        onClick={() => setScrollMode(dir.id)}
                        className="glass-pill-btn"
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
                      {!isPdf && isAutoscrollActive && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--app-accent)]" />
                      )}
                    </div>
                    <div className="text-[10.5px] font-normal text-[var(--app-text-subtle)]">
                      {isPdf ? 'Disabled for PDF documents' : 'Hands-free page turning'}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {!isPdf && isAutoscrollActive && (
                      <button
                        type="button"
                        onClick={handleToggleAutoScrollPause}
                        className="glass-action-pill !h-6 !px-2.5 !text-[11px]"
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
                      aria-checked={!isPdf && isAutoscrollActive}
                      data-preserve-theme="true"
                      disabled={isPdf}
                      onClick={handleToggleAutoScroll}
                      style={{
                        backgroundColor: !isPdf && isAutoscrollActive
                          ? 'var(--app-accent)'
                          : 'var(--app-border-strong)'
                      }}
                      className={`w-8 h-4 rounded-full p-0.5 flex items-center transition-colors shrink-0 ${
                        isPdf ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
                      }`}
                      title={
                        isPdf
                          ? 'Auto-Scroll is disabled for PDF documents'
                          : isAutoscrollActive
                            ? 'Turn off Auto-Scroll'
                            : 'Turn on Auto-Scroll'
                      }
                    >
                      <span
                        className={`w-3 h-3 rounded-full bg-white shadow-sm block transition-transform duration-150 ${
                          !isPdf && isAutoscrollActive ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {!isPdf && (
                  <>
                    {/* Small Inline Mode Switcher */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11.5px] font-semibold text-[var(--app-text-muted)]">
                    Pacing
                  </span>
                  <div
                    className="glass-pill-track grid-cols-2 w-[140px]"
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
                          data-active={active ? 'true' : 'false'}
                          onClick={() => handleModeChange(m.id)}
                          className="glass-pill-btn"
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
                            data-active={active ? 'true' : 'false'}
                            onClick={() => handleCountdownChange(sec)}
                            className="glass-preset-btn"
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
                            data-active={active ? 'true' : 'false'}
                            onClick={() => handleAdaptiveSecChange(sec)}
                            className="glass-preset-btn"
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
                  </>
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
                      className={`glass-action-pill ${
                        isTTSActive
                          ? '!bg-[var(--app-accent)] !border-[var(--app-accent)] !text-white'
                          : ''
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

                <div className="grid grid-cols-5 gap-1.5">
                  {TTS_SPEEDS.map((sp) => {
                    const active = Math.abs(settings.ttsSpeed - sp) < 0.05
                    return (
                      <button
                        key={sp}
                        type="button"
                        data-active={active ? 'true' : 'false'}
                        onClick={() => updateSettings({ ttsSpeed: sp })}
                        className="glass-preset-btn text-[10px]"
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
                    className="glass-pill-track grid-cols-2 w-[136px] shrink-0"
                    role="radiogroup"
                    aria-label="View format"
                  >
                    <button
                      type="button"
                      role="radio"
                      aria-checked={isPdf ? pdfViewMode === 'original' : false}
                      data-active={isPdf && pdfViewMode === 'original' ? 'true' : 'false'}
                      disabled={!isPdf || isConvertingPdf}
                      onClick={() => handleSelectPdfView('original')}
                      title={!isPdf ? 'Native EPUB book' : undefined}
                      className="glass-pill-btn disabled:opacity-40"
                    >
                      PDF
                    </button>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={!isPdf || pdfViewMode === 'reflow'}
                      data-active={!isPdf || pdfViewMode === 'reflow' ? 'true' : 'false'}
                      disabled={isConvertingPdf}
                      onClick={() => handleSelectPdfView('reflow')}
                      className="glass-pill-btn disabled:opacity-40"
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
