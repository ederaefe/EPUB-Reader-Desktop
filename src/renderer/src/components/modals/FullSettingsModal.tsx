import React, { useState, useEffect } from 'react'
import {
  X,
  Upload,
  Download,
  Trash2,
  Archive,
  Database,
  BookOpen,
  Timer,
  Zap,
  RotateCcw,
  ExternalLink,
  Globe,
  FileText,
  Mail,
  AlertCircle,
  Check
} from 'lucide-react'
import { useAppStore } from '../../stores/useAppStore'
import { backupService } from '../../services/backupService'
import { adaptiveScrollEngine } from '../../services/adaptiveScrollService'
import { db, type AutoscrollMode } from '../../db'
import { ThemePickerGrid } from '../ui/ThemePickerGrid'
import { SecondsNumberInput } from '../ui/SecondsNumberInput'
import { ValueStepper } from '../ui/ValueStepper'
import { FontPicker } from '../ui/FontPicker'
import { DimnessSlider } from '../ui/DimnessSlider'

type FullSettingsTab = 'system' | 'reading' | 'hotkeys' | 'backup' | 'about'

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

const SETTINGS_TABS: Array<{ id: FullSettingsTab; label: string }> = [
  { id: 'system', label: 'System' },
  { id: 'reading', label: 'Reading settings' },
  { id: 'hotkeys', label: 'Hotkeys' },
  { id: 'backup', label: 'Backup & Sync' },
  { id: 'about', label: 'About' }
]

const HOTKEYS_LEFT: Array<{ label: string; keys: string[] }> = [
  { label: 'Show hotkeys', keys: ['F1', 'Ctrl + /', '?'] },
  { label: 'Back / Close modal or drawer', keys: ['Alt + Left', 'Esc'] },
  { label: 'Forward in history', keys: ['Alt + Right'] },
  { label: 'Undo annotation / bookmark', keys: ['Ctrl + Z'] },
  { label: 'Redo annotation / bookmark', keys: ['Ctrl + Y', 'Ctrl+Shift+Z'] },
  { label: 'Go to previous page', keys: ['Left', 'PgUp', 'k'] },
  { label: 'Go to next page', keys: ['Right', 'Space', 'j'] },
  { label: 'Start/pause reading aloud', keys: ['F7'] },
  { label: 'Stop reading aloud', keys: ['F8'] }
]

const HOTKEYS_RIGHT: Array<{ label: string; keys: string[] }> = [
  { label: 'Add or remove bookmark', keys: ['Ctrl + B', 'Ctrl + D'] },
  { label: 'Search in book or library', keys: ['Ctrl + F', '/'] },
  { label: 'Zoom in / Increase font', keys: ['Ctrl + =', '+'] },
  { label: 'Zoom out / Decrease font', keys: ['Ctrl + -', '-'] },
  { label: 'Reset zoom / font size', keys: ['Ctrl + 0', '0'] },
  { label: 'Switch theme', keys: ['F9'] },
  { label: 'Switch column count', keys: ['F10', 'r'] },
  { label: 'Switch fullscreen', keys: ['F11'] },
  { label: 'Back to library', keys: ['Alt + Left', 'Alt + X'] }
]

export const FullSettingsModal: React.FC = () => {
  const {
    isFullSettingsModalOpen,
    toggleFullSettingsModal,
    activeBook,
    isAutoscrollActive,
    setAutoscrollActive,
    settings,
    updateSettings,
    openConfirmDialog,
    showToast,
    bumpLibraryVersion
  } = useAppStore()

  const isPdf = activeBook?.format === 'pdf'

  const [activeTab, setActiveTab] = useState<FullSettingsTab>('system')
  const [backupStatus, setBackupStatus] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  useEffect(() => {
    if (!isFullSettingsModalOpen) return
    adaptiveScrollEngine.setSuspension('modal', true)
    return () => {
      adaptiveScrollEngine.setSuspension('modal', false)
      adaptiveScrollEngine.recordUserActivity()
    }
  }, [isFullSettingsModalOpen])

  useEffect(() => {
    if (!isFullSettingsModalOpen) return
    const onKey = (e: KeyboardEvent) => {
      const isBack =
        e.key === 'Escape' ||
        (e.altKey && !e.ctrlKey && !e.metaKey && e.key === 'ArrowLeft')
      if (isBack) {
        e.preventDefault()
        e.stopPropagation()
        toggleFullSettingsModal(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isFullSettingsModalOpen, toggleFullSettingsModal])

  if (!isFullSettingsModalOpen) return null

  const handleExportJson = async () => {
    setIsProcessing(true)
    const res = await backupService.exportToJson()
    setIsProcessing(false)
    if (res.success) {
      setBackupStatus('Library metadata exported successfully.')
    } else if (!res.canceled) {
      setBackupStatus('Could not export library metadata.')
    }
  }

  const handleExportZip = async () => {
    setIsProcessing(true)
    const res = await backupService.exportToZip()
    setIsProcessing(false)
    if (res.success) {
      setBackupStatus('Complete archive with cover art exported successfully.')
    } else if (!res.canceled) {
      setBackupStatus('Could not export library archive.')
    }
  }

  const handleImportBackup = async () => {
    setIsProcessing(true)
    const res = await backupService.promptImport()
    setIsProcessing(false)
    if (res.success) {
      bumpLibraryVersion()
    }
    if (res.message && res.message !== 'Import cancelled') {
      setBackupStatus(res.message)
    }
  }

  const handleEmptyLibrary = () => {
    openConfirmDialog({
      title: 'Empty Library?',
      message:
        'All imported books, highlights, and bookmarks will be removed from Semply. Your original files on disk will not be deleted.',
      confirmLabel: 'Empty Library',
      danger: true,
      onConfirm: async () => {
        await db.books.clear()
        await db.annotations.clear()
        await db.bookmarks.clear()
        bumpLibraryVersion()
        setBackupStatus('Library emptied.')
        showToast('Library cleared', 'info')
      }
    })
  }

  const handleOpenExternal = (e: React.MouseEvent, url: string) => {
    e.preventDefault()
    if (window.desktopAPI?.openExternal) {
      window.desktopAPI.openExternal(url)
    } else {
      window.open(url, '_blank', 'noopener,noreferrer')
    }
  }

  const [updateStatus, setUpdateStatus] = useState<{
    state: 'idle' | 'checking' | 'up-to-date' | 'update-available' | 'error'
    currentVersion?: string
    latestVersion?: string
    releaseName?: string
    releaseNotes?: string
    releaseUrl?: string
    downloadUrl?: string
    error?: string
  }>({ state: 'idle' })

  const handleCheckUpdatesNow = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (updateStatus.state === 'checking') return

    setUpdateStatus({ state: 'checking' })

    try {
      let result
      if (window.desktopAPI?.checkForUpdates) {
        result = await window.desktopAPI.checkForUpdates()
      } else {
        const res = await fetch('https://api.github.com/repos/ederaefe/EPUB-Reader-Desktop/releases?per_page=5', {
          headers: { Accept: 'application/vnd.github.v3+json' }
        })
        if (!res.ok) throw new Error(`HTTP error ${res.status}`)
        const releases = await res.json()
        const latestRelease = releases.find((r: any) => !r.draft) || releases[0]
        const currentVersion = '1.0.8'
        const latestVersion = latestRelease?.tag_name ? latestRelease.tag_name.replace(/^v/i, '') : currentVersion
        const hasUpdate = latestVersion !== currentVersion
        result = {
          hasUpdate,
          currentVersion,
          latestVersion,
          releaseName: latestRelease?.name || `v${latestVersion}`,
          releaseNotes: latestRelease?.body || '',
          releaseUrl: latestRelease?.html_url || 'https://github.com/ederaefe/EPUB-Reader-Desktop/releases/latest',
          downloadUrl: latestRelease?.html_url || 'https://github.com/ederaefe/EPUB-Reader-Desktop/releases/latest'
        }
      }

      if (result.error) {
        setUpdateStatus({
          state: 'error',
          error: result.error
        })
      } else if (result.hasUpdate) {
        setUpdateStatus({
          state: 'update-available',
          currentVersion: result.currentVersion,
          latestVersion: result.latestVersion,
          releaseName: result.releaseName,
          releaseNotes: result.releaseNotes,
          releaseUrl: result.releaseUrl,
          downloadUrl: result.downloadUrl
        })
      } else {
        setUpdateStatus({
          state: 'up-to-date',
          currentVersion: result.currentVersion,
          latestVersion: result.latestVersion
        })
      }
    } catch (err: any) {
      setUpdateStatus({
        state: 'error',
        error: err?.message || 'Failed to check for updates'
      })
    }
  }

  return (
    <div
      onClick={() => toggleFullSettingsModal(false)}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-[2px] select-none p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[780px] max-w-[92vw] h-[580px] max-h-[85vh] bg-[var(--app-surface)] border border-[var(--app-border-strong)] rounded-xl shadow-[0_24px_72px_rgba(0,0,0,0.45)] flex flex-col overflow-hidden text-xs text-[var(--app-text)] animate-in fade-in zoom-in-95 duration-100"
      >
        {/* Top Header & Tabs */}
        <div className="h-12 bg-[var(--app-chrome)] border-b border-[var(--app-border)] flex items-center justify-between px-3 shrink-0">
          <div className="flex items-center gap-1" role="tablist" aria-label="Settings sections">
            {SETTINGS_TABS.map((tab) => {
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  data-active={isActive ? 'true' : 'false'}
                  onClick={() => setActiveTab(tab.id)}
                  className={`settings-tab h-8 px-3 text-[12.5px] flex items-center cursor-pointer ${
                    isActive ? 'font-bold' : 'font-semibold'
                  }`}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>

          <button
            type="button"
            onClick={() => toggleFullSettingsModal(false)}
            className="settings-close-btn w-7 h-7 flex items-center justify-center rounded-md cursor-pointer"
            title="Close (Esc)"
            aria-label="Close settings"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Fixed-Frame Scrollable Tab Content Area */}
        <div className="flex-1 min-h-0 overflow-y-auto p-5">
          {backupStatus && (
            <div className="mb-3.5 px-3.5 py-2 bg-[var(--app-accent-soft)] border border-[var(--app-accent)]/40 text-[var(--app-accent-text)] text-xs rounded-lg flex items-center justify-between animate-fadeIn">
              <span className="font-semibold">{backupStatus}</span>
              <button
                type="button"
                onClick={() => setBackupStatus(null)}
                className="w-5 h-5 rounded flex items-center justify-center hover:bg-[var(--app-overlay-tint-strong)] active:scale-90 transition-all cursor-pointer"
                aria-label="Dismiss status message"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* 1. SYSTEM TAB */}
          {activeTab === 'system' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 animate-fadeIn">
              {/* Left Column */}
              <div className="space-y-3.5">
                <div className="settings-card p-3.5 rounded-lg space-y-2.5">
                  <label className="text-[13.5px] font-bold text-[var(--app-text-strong)] block">
                    Theme
                  </label>
                  <ThemePickerGrid
                    activeTheme={settings.theme}
                    onSelect={(theme) => updateSettings({ theme })}
                    compact
                  />
                </div>

                <div className="settings-card px-3.5 py-3 rounded-lg">
                  <DimnessSlider
                    value={settings.dimming ?? 0}
                    min={0}
                    max={70}
                    step={5}
                    onChange={(val) => updateSettings({ dimming: val })}
                  />
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-3.5">
                <div className="settings-card p-4 rounded-lg space-y-3">
                  <div>
                    <label className="text-[13.5px] font-bold text-[var(--app-text-strong)] block">
                      Quick Backup Actions
                    </label>
                    <p className="text-[11.5px] font-normal text-[var(--app-text-muted)] mt-0.5">
                      Export or merge your shelves, notes, and reading progress.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handleExportJson}
                      disabled={isProcessing}
                      className="settings-btn-primary h-8 px-3 rounded-md flex items-center justify-center gap-1.5 text-[12px] font-bold cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Export JSON</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleImportBackup}
                      disabled={isProcessing}
                      className="settings-btn-secondary h-8 px-3 rounded-md flex items-center justify-center gap-1.5 text-[12px] font-semibold cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Import Additive</span>
                    </button>
                  </div>
                  <div className="pt-2 border-t border-[var(--app-border)]">
                    <button
                      type="button"
                      onClick={handleEmptyLibrary}
                      className="settings-btn-danger w-full h-8 rounded-md flex items-center justify-center gap-1.5 text-[12px] font-bold cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Empty Library</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. READING SETTINGS TAB */}
          {activeTab === 'reading' && (
            <div className="space-y-3 max-w-[600px] animate-fadeIn">
              {/* Compact Unified Typography Card */}
              <div className="settings-card rounded-lg divide-y divide-[var(--app-border)]">
                <div className="px-3.5 py-2.5">
                  <FontPicker inline />
                </div>

                {/* Text Size: 3 A's in varying sizes */}
                <div className="px-3.5 py-2.5 flex items-center justify-between gap-4">
                  <span className="text-[13px] font-bold text-[var(--app-text-strong)]">
                    Default Font Size
                  </span>
                  <div
                    className="glass-pill-track grid-cols-3 w-52"
                    role="radiogroup"
                    aria-label="Default Font Size"
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
                          className="glass-pill-btn !h-7 flex items-center justify-center"
                          title={`${p.label} text size (${p.value}px)`}
                        >
                          <span className={`${p.sizeClass} font-serif font-bold leading-none`}>A</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Line Spacing: Illustrative 2, 3, or 4 line drawings */}
                <div className="px-3.5 py-2.5 flex items-center justify-between gap-4">
                  <span className="text-[13px] font-bold text-[var(--app-text-strong)]">
                    Line Spacing
                  </span>
                  <div
                    className="glass-pill-track grid-cols-3 w-52"
                    role="radiogroup"
                    aria-label="Line Spacing"
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
                          className="glass-pill-btn !h-7 flex items-center justify-center"
                          title={`${p.label} line spacing`}
                        >
                          {p.icon}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Text Weight: B preview glyphs in 3 weights */}
                <div className="px-3.5 py-2.5 flex items-center justify-between gap-4">
                  <span className="text-[13px] font-bold text-[var(--app-text-strong)]">
                    Text Weight
                  </span>
                  <div
                    className="glass-pill-track grid-cols-3 w-52"
                    role="radiogroup"
                    aria-label="Text Weight"
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
                          className="glass-pill-btn !h-7 flex items-center justify-center"
                          title={`${opt.label} weight`}
                        >
                          <span className={`text-[14px] font-serif ${opt.weightClass} leading-none`}>
                            B
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Warm Blue Light Night Filter Section */}
              <div className="settings-card p-3.5 rounded-lg space-y-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[13.5px] font-bold text-[var(--app-text-strong)]">
                      Warm Blue Light Night Filter
                    </span>
                    <span className="text-[10.5px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 font-mono font-semibold">
                      Candlelight – Daylight
                    </span>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={Boolean(settings.warmFilterEnabled)}
                    data-preserve-theme="true"
                    onClick={() => updateSettings({ warmFilterEnabled: !settings.warmFilterEnabled })}
                    style={{
                      backgroundColor: settings.warmFilterEnabled
                        ? '#f59e0b'
                        : 'var(--app-border-strong)'
                    }}
                    className="settings-switch w-10 h-5 rounded-full p-0.5 flex items-center cursor-pointer shrink-0"
                  >
                    <span
                      className={`w-4 h-4 bg-white rounded-full shadow-sm block transition-transform duration-150 ${
                        settings.warmFilterEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {settings.warmFilterEnabled && (
                  <div className="pt-2 border-t border-[var(--app-border)] space-y-2 animate-fadeIn">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-[12.5px] font-bold text-[var(--app-text)]">
                        Color Temperature
                      </span>
                      <ValueStepper
                        value={settings.warmFilterTemp || 3200}
                        min={2000}
                        max={4500}
                        step={100}
                        unit="K"
                        ariaLabel="Color Temperature"
                        onChange={(val) => updateSettings({ warmFilterTemp: val })}
                        compact
                      />
                    </div>

                    <div className="flex items-center justify-between gap-4">
                      <span className="text-[12.5px] font-bold text-[var(--app-text)]">
                        Filter Intensity
                      </span>
                      <ValueStepper
                        value={settings.warmFilterIntensity || 40}
                        min={10}
                        max={90}
                        step={5}
                        unit="%"
                        ariaLabel="Filter Intensity"
                        onChange={(val) => updateSettings({ warmFilterIntensity: val })}
                        compact
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Reading Progress Bar Section */}
              <div className="settings-card p-3.5 rounded-lg space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <span className="text-[13.5px] font-bold text-[var(--app-text-strong)]">
                      Reading Progress Bar
                    </span>
                    <p className="text-[11.5px] font-normal text-[var(--app-text-muted)] mt-0.5">
                      Show persistent bottom progress bar and chapter meniscus
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={settings.showProgressBar !== false}
                    data-preserve-theme="true"
                    onClick={() => updateSettings({ showProgressBar: settings.showProgressBar === false })}
                    style={{
                      backgroundColor: settings.showProgressBar !== false
                        ? 'var(--app-accent)'
                        : 'var(--app-border-strong)'
                    }}
                    className="settings-switch w-10 h-5 rounded-full p-0.5 flex items-center cursor-pointer shrink-0"
                    title={settings.showProgressBar !== false ? 'Hide progress bar' : 'Show progress bar'}
                  >
                    <span
                      className={`w-4 h-4 bg-white rounded-full shadow-sm block transition-transform duration-150 ${
                        settings.showProgressBar !== false ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Dual-Mode Auto-Scroll Countdown Section */}
              {(() => {
                const effectiveMode: AutoscrollMode =
                  settings.autoscrollMode ??
                  (settings.autoscrollAdaptive === false ? 'countdown' : 'adaptive')
                const countdownSec = settings.autoscrollCountdownSec ?? 20
                const adaptiveSec = settings.autoscrollAdaptiveSec ?? 25
                const microPauseEnabled = settings.autoscrollMicroPause ?? true
                const isPdfDual = (settings.pageLayout ?? (settings.pageSpread === 'single' ? 'single' : 'dual')) === 'dual'
                const pdfDwellSec = isPdfDual
                  ? (settings.pdfCountdownSecDual ?? 45)
                  : (settings.pdfCountdownSecSingle ?? 25)

                const handleModeChange = (mode: AutoscrollMode) => {
                  updateSettings({ autoscrollMode: mode, autoscrollAdaptive: mode === 'adaptive' })
                  adaptiveScrollEngine.configure({ mode })
                }

                const handleCountdownChange = (sec: number) => {
                  const clamped = Math.max(2, Math.min(600, Math.round(sec)))
                  updateSettings({ autoscrollCountdownSec: clamped })
                  adaptiveScrollEngine.configure({ fixedCountdownSec: clamped })
                }

                const handlePdfCountdownChange = (sec: number) => {
                  const clamped = Math.max(2, Math.min(600, Math.round(sec)))
                  if (isPdfDual) {
                    updateSettings({ pdfCountdownSecDual: clamped, autoscrollCountdownSec: clamped })
                  } else {
                    updateSettings({ pdfCountdownSecSingle: clamped, autoscrollCountdownSec: clamped })
                  }
                  adaptiveScrollEngine.configure({ fixedCountdownSec: clamped, mode: 'countdown' })
                }

                const handleAdaptiveSecChange = (sec: number) => {
                  const clamped = Math.max(10, Math.min(600, Math.round(sec)))
                  updateSettings({ autoscrollAdaptiveSec: clamped })
                  adaptiveScrollEngine.configure({ adaptiveBaseSec: clamped })
                }

                const handleMicroPauseToggle = () => {
                  const next = !microPauseEnabled
                  updateSettings({ autoscrollMicroPause: next })
                  adaptiveScrollEngine.configure({ microPauseEnabled: next })
                }

                return (
                  <div className="settings-card p-3.5 rounded-lg space-y-3">
                    {/* Header + Switch */}
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-1.5">
                          {effectiveMode === 'countdown' ? (
                            <Timer className="w-4 h-4 text-[var(--app-accent)]" />
                          ) : (
                            <Zap className="w-4 h-4 text-amber-500" />
                          )}
                          <span className="text-[13.5px] font-bold text-[var(--app-text-strong)]">
                            Auto-Flip
                          </span>
                        </div>
                        <p className="text-[11.5px] font-normal text-[var(--app-text-muted)] mt-0.5">
                          {isPdf
                            ? 'Fixed dwell timer per page for PDF documents'
                            : effectiveMode === 'countdown'
                              ? 'Turns page automatically on a fixed timer'
                              : 'Scales your base seconds dynamically to each page word count (min 10s floor)'}
                        </p>
                      </div>

                      <button
                        type="button"
                        role="switch"
                        aria-checked={isAutoscrollActive}
                        data-preserve-theme="true"
                        onClick={() => {
                          const next = !isAutoscrollActive
                          if (!next) {
                            adaptiveScrollEngine.stop()
                          } else {
                            adaptiveScrollEngine.clearTransientSuspensions()
                          }
                          setAutoscrollActive(next)
                        }}
                        style={{
                          backgroundColor: isAutoscrollActive
                            ? 'var(--app-accent)'
                            : 'var(--app-border-strong)'
                        }}
                        className="settings-switch w-10 h-5 rounded-full p-0.5 flex items-center shrink-0 cursor-pointer"
                        title={
                          isAutoscrollActive
                            ? 'Turn off Auto-Flip'
                            : 'Turn on Auto-Flip'
                        }
                      >
                        <span
                          className={`w-4 h-4 bg-white rounded-full shadow-sm block transition-transform duration-150 ${
                            isAutoscrollActive ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Segmented Mode Selector */}
                    <div className="glass-pill-track grid-cols-2 p-1">
                      <button
                        type="button"
                        data-active={effectiveMode === 'countdown' ? 'true' : 'false'}
                        onClick={() => handleModeChange('countdown')}
                        className="glass-pill-btn !h-7 gap-1.5 !text-[12px] font-semibold"
                      >
                        <Timer className="w-3.5 h-3.5" />
                        <span>Fixed Auto-Flip</span>
                      </button>

                      <button
                        type="button"
                        data-active={effectiveMode === 'adaptive' ? 'true' : 'false'}
                        onClick={() => handleModeChange('adaptive')}
                        className="glass-pill-btn !h-7 gap-1.5 !text-[12px] font-semibold"
                      >
                        <Zap className="w-3.5 h-3.5 text-amber-500" />
                        <span>Smart Auto-Flip</span>
                      </button>
                    </div>

                    {/* Mode Controls */}
                    {effectiveMode === 'countdown' ? (
                      isPdf ? (
                        <div className="space-y-2.5 pt-0.5">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-[12.5px] font-bold text-[var(--app-text-strong)]">
                                Dwell per spread
                              </span>
                              <span className="text-[11px] font-normal text-[var(--app-text-muted)]">
                                ({isPdfDual ? 'Dual page' : 'Single page'})
                              </span>
                              {pdfDwellSec !== (isPdfDual ? 45 : 25) && (
                                <button
                                  type="button"
                                  onClick={() => handlePdfCountdownChange(isPdfDual ? 45 : 25)}
                                  title={`Reset to default (${isPdfDual ? '45s' : '25s'})`}
                                  className="p-1 rounded-md text-[var(--app-text-muted)] hover:bg-[var(--app-accent-soft)] hover:text-[var(--app-accent-text)] active:scale-90 transition-all cursor-pointer"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                            <SecondsNumberInput
                              value={pdfDwellSec}
                              min={3}
                              max={600}
                              step={5}
                              onChange={handlePdfCountdownChange}
                              ariaLabel="PDF Dwell per spread"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-3 pt-0.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-[12.5px] font-bold text-[var(--app-text-strong)]">
                              Seconds per page
                            </span>
                            <span className="text-[11px] font-normal text-[var(--app-text-muted)]">
                              (3–600s)
                            </span>
                            {countdownSec !== 20 && (
                              <button
                                type="button"
                                onClick={() => handleCountdownChange(20)}
                                title="Reset to 20s"
                                className="p-1 rounded-md text-[var(--app-text-muted)] hover:bg-[var(--app-accent-soft)] hover:text-[var(--app-accent-text)] active:scale-90 transition-all cursor-pointer"
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
                            onChange={handleCountdownChange}
                            ariaLabel="Fixed seconds per page"
                          />
                        </div>
                      )
                    ) : (
                      <div className="space-y-2.5 pt-0.5">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-[12.5px] font-bold text-[var(--app-text-strong)]">
                              Base seconds per page
                            </span>
                            <span className="text-[11px] font-normal text-[var(--app-text-muted)]">
                              (10–600s)
                            </span>
                            {adaptiveSec !== 25 && (
                              <button
                                type="button"
                                onClick={() => {
                                  handleAdaptiveSecChange(25)
                                  updateSettings({ targetWpm: 250 })
                                }}
                                title="Reset to 25s (250 WPM)"
                                className="p-1 rounded-md text-[var(--app-text-muted)] hover:bg-[var(--app-accent-soft)] hover:text-[var(--app-accent-text)] active:scale-90 transition-all cursor-pointer"
                              >
                                <RotateCcw className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                          <SecondsNumberInput
                            value={adaptiveSec}
                            min={10}
                            max={600}
                            step={5}
                            onChange={handleAdaptiveSecChange}
                            ariaLabel="Smart base seconds per page"
                          />
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-[var(--app-border)]">
                          <span className="text-[12.5px] font-bold text-[var(--app-text)]">
                            Pause at breaks & chapter ends
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
                            className="settings-switch w-8 h-4 rounded-full p-0.5 flex items-center cursor-pointer"
                          >
                            <span
                              className={`w-3 h-3 bg-white rounded-full shadow-sm block transition-transform duration-150 ${
                                microPauseEnabled ? 'translate-x-4' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>
          )}

          {/* 3. HOTKEYS TAB */}
          {activeTab === 'hotkeys' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5 text-[12.5px] animate-fadeIn">
              <div className="space-y-1">
                {HOTKEYS_LEFT.map((item) => (
                  <div
                    key={item.label}
                    className="settings-row-interactive flex items-center justify-between px-2.5 py-2"
                  >
                    <span className="font-semibold text-[var(--app-text-strong)]">{item.label}</span>
                    <div className="flex gap-1.5">
                      {item.keys.map((keyLabel) => (
                        <kbd
                          key={keyLabel}
                          className="settings-kbd px-2 py-0.5 rounded font-mono text-[11px] font-bold"
                        >
                          {keyLabel}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-1">
                {HOTKEYS_RIGHT.map((item) => (
                  <div
                    key={item.label}
                    className="settings-row-interactive flex items-center justify-between px-2.5 py-2"
                  >
                    <span className="font-semibold text-[var(--app-text-strong)]">{item.label}</span>
                    <div className="flex gap-1.5">
                      {item.keys.map((keyLabel) => (
                        <kbd
                          key={keyLabel}
                          className="settings-kbd px-2 py-0.5 rounded font-mono text-[11px] font-bold"
                        >
                          {keyLabel}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4. BACKUP & SYNC TAB */}
          {activeTab === 'backup' && (
            <div className="space-y-3.5 max-w-xl animate-fadeIn">
              <div className="settings-card p-4 rounded-lg space-y-2.5">
                <div className="flex items-center gap-2 text-[var(--app-text-strong)]">
                  <Database className="w-4 h-4 text-[var(--app-accent)]" />
                  <span className="text-[14px] font-bold">Universal Additive Library Backup</span>
                </div>
                <p className="text-[12px] font-normal text-[var(--app-text-muted)] leading-relaxed">
                  Export your complete library, custom shelves, notes, highlights, and bookmarks
                  into portable format. When importing, the engine performs a non-destructive
                  additive merge that preserves all local data.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1.5">
                  <button
                    type="button"
                    onClick={handleExportJson}
                    disabled={isProcessing}
                    className="settings-btn-secondary h-8 px-3 rounded-md flex items-center justify-center gap-2 text-[12px] font-semibold cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5 text-[var(--app-accent)]" />
                    <span>Export Metadata (JSON)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleExportZip}
                    disabled={isProcessing}
                    className="settings-btn-secondary h-8 px-3 rounded-md flex items-center justify-center gap-2 text-[12px] font-semibold cursor-pointer"
                  >
                    <Archive className="w-3.5 h-3.5 text-amber-500" />
                    <span>Export Archive with Covers (ZIP)</span>
                  </button>
                </div>
              </div>

              <div className="settings-card p-4 rounded-lg space-y-2.5">
                <div className="flex items-center gap-2 text-[var(--app-text-strong)]">
                  <Download className="w-4 h-4 text-emerald-500" />
                  <span className="text-[14px] font-bold">Additive Import &amp; Restore</span>
                </div>
                <p className="text-[12px] font-normal text-[var(--app-text-muted)] leading-relaxed">
                  Select a previously exported .json or .zip backup. Existing reading progress is
                  retained, books are deduplicated, and new categories and annotations are appended.
                </p>

                <button
                  type="button"
                  onClick={handleImportBackup}
                  disabled={isProcessing}
                  className="settings-btn-primary h-8 px-4 rounded-md flex items-center justify-center gap-2 text-[12px] font-bold cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Choose Backup File to Import</span>
                </button>
              </div>
            </div>
          )}

          {/* 5. ABOUT TAB */}
          {activeTab === 'about' && (
            <div className="space-y-3.5 max-w-lg animate-fadeIn">
              <div className="settings-card p-4 rounded-lg space-y-3.5">
                <div className="flex items-center gap-3 text-[var(--app-text-strong)]">
                  <div className="p-2.5 bg-[var(--app-accent-soft)] rounded-lg">
                    <BookOpen className="w-6 h-6 text-[var(--app-accent)]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-[15px] font-bold text-[var(--app-text-strong)]">
                        Semply Ebook Reader
                      </h3>
                    </div>
                    <p className="text-[11.5px] font-semibold text-[var(--app-text-muted)]">
                      Version 1.0.8 (Native Desktop Edition)
                    </p>
                    <p className="text-[11px] text-[var(--app-text-subtle)] font-medium mt-0.5">
                      Published by{' '}
                      <a
                        href="https://efedera.me"
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => handleOpenExternal(e, 'https://efedera.me')}
                        className="underline hover:text-[var(--app-text)] transition-colors"
                      >
                        Efedera
                      </a>
                    </p>
                  </div>
                </div>

                <p className="text-[12.5px] font-normal text-[var(--app-text)] leading-relaxed">
                  Semply is designed to be your primary reading workstation. We prioritize
                  performance, accessibility, and focus—providing a clean, distraction-free
                  environment for deep reading.
                </p>

                {/* Subtle Preferences & Telemetry Options */}
                <div className="pt-3 border-t border-[var(--app-border)] space-y-1.5">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--app-text-subtle)] block">
                    System & Updates
                  </span>
                  <label className="flex items-center gap-2 text-[11px] text-[var(--app-text-muted)] hover:text-[var(--app-text)] cursor-pointer select-none transition-colors">
                    <input
                      type="checkbox"
                      checked={Boolean(settings.copyExternal)}
                      onChange={(e) => updateSettings({ copyExternal: e.target.checked })}
                      className="ice-checkbox scale-90"
                    />
                    <span>Copy eBooks from external devices</span>
                  </label>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <label className="flex items-center gap-2 text-[11px] text-[var(--app-text-muted)] hover:text-[var(--app-text)] cursor-pointer select-none transition-colors">
                      <input
                        type="checkbox"
                        checked={settings.autoUpdate ?? true}
                        onChange={(e) => updateSettings({ autoUpdate: e.target.checked })}
                        className="ice-checkbox scale-90"
                      />
                      <span>Check for updates automatically</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleCheckUpdatesNow}
                      disabled={updateStatus.state === 'checking'}
                      className="text-[11px] text-[var(--app-accent)] underline hover:opacity-80 transition-opacity cursor-pointer font-medium disabled:opacity-50"
                    >
                      {updateStatus.state === 'checking' ? 'Checking...' : 'Check now'}
                    </button>
                  </div>

                  {updateStatus.state === 'up-to-date' && (
                    <div className="p-2.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] flex items-center justify-between animate-fadeIn">
                      <div className="flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 shrink-0" />
                        <span>You are on the latest version (v{updateStatus.currentVersion || '1.0.8'}).</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setUpdateStatus({ state: 'idle' })}
                        className="text-emerald-400/60 hover:text-emerald-300 text-[10px] ml-2 cursor-pointer"
                      >
                        Dismiss
                      </button>
                    </div>
                  )}

                  {updateStatus.state === 'update-available' && (
                    <div className="p-3 rounded-lg bg-[var(--app-accent-soft)] border border-[var(--app-accent)]/30 space-y-2 animate-fadeIn">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[9.5px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 font-semibold uppercase tracking-wider">
                              New Version
                            </span>
                            <span className="text-[12.5px] font-bold text-[var(--app-text-strong)]">
                              v{updateStatus.latestVersion}
                            </span>
                          </div>
                          <p className="text-[11px] text-[var(--app-text-muted)] mt-1">
                            An update is available. Would you like to download it now?
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setUpdateStatus({ state: 'idle' })}
                          className="text-[var(--app-text-subtle)] hover:text-[var(--app-text)] p-0.5 rounded transition-colors cursor-pointer"
                          title="Dismiss"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center gap-3 pt-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            const target = updateStatus.downloadUrl || updateStatus.releaseUrl || 'https://github.com/ederaefe/EPUB-Reader-Desktop/releases/latest'
                            handleOpenExternal(e, target)
                          }}
                          className="settings-btn-primary h-7 px-3 rounded flex items-center gap-1.5 text-[11px] font-bold cursor-pointer"
                        >
                          <Download className="w-3 h-3" />
                          <span>Download Update</span>
                        </button>

                        {updateStatus.releaseUrl && (
                          <a
                            href={updateStatus.releaseUrl}
                            onClick={(e) => handleOpenExternal(e, updateStatus.releaseUrl!)}
                            className="text-[11px] text-[var(--app-accent)] underline hover:opacity-80 transition-opacity font-medium inline-flex items-center gap-1 cursor-pointer"
                          >
                            <span>See what's new</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  )}

                  {updateStatus.state === 'error' && (
                    <div className="p-2.5 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-[11px] flex items-center justify-between animate-fadeIn">
                      <div className="flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{updateStatus.error || 'Failed to check for updates.'}</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleCheckUpdatesNow}
                        className="text-red-400 underline hover:text-red-300 text-[10px] ml-2 cursor-pointer font-medium"
                      >
                        Retry
                      </button>
                    </div>
                  )}
                  <label className="flex items-center gap-2 text-[11px] text-[var(--app-text-muted)] hover:text-[var(--app-text)] cursor-pointer select-none transition-colors">
                    <input
                      type="checkbox"
                      checked={Boolean(settings.sendStats)}
                      onChange={(e) => updateSettings({ sendStats: e.target.checked })}
                      className="ice-checkbox scale-90"
                    />
                    <span>Send anonymous usage stats</span>
                  </label>
                </div>

                <div className="flex flex-wrap gap-2 pt-3 border-t border-[var(--app-border)] text-xs">
                  <a
                    href="https://github.com/ederaefe/EPUB-Reader-Desktop"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => handleOpenExternal(e, 'https://github.com/ederaefe/EPUB-Reader-Desktop')}
                    className="settings-btn-secondary h-8 px-3 rounded-md inline-flex items-center gap-1.5 text-[12px] font-semibold"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>GitHub</span>
                  </a>
                  <a
                    href="https://semply.vercel.app/documentations"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => handleOpenExternal(e, 'https://semply.vercel.app/documentations')}
                    className="settings-btn-secondary h-8 px-3 rounded-md inline-flex items-center gap-1.5 text-[12px] font-semibold"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Docs</span>
                  </a>
                  <a
                    href="https://efedera.me"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => handleOpenExternal(e, 'https://efedera.me')}
                    className="settings-btn-secondary h-8 px-3 rounded-md inline-flex items-center gap-1.5 text-[12px] font-semibold"
                  >
                    <Globe className="w-3.5 h-3.5 text-amber-400" />
                    <span>efedera.me</span>
                  </a>
                  <a
                    href="https://semply.vercel.app"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => handleOpenExternal(e, 'https://semply.vercel.app')}
                    className="settings-btn-secondary h-8 px-3 rounded-md inline-flex items-center gap-1.5 text-[12px] font-semibold"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>Website</span>
                  </a>
                  <a
                    href="https://github.com/ederaefe/EPUB-Reader-Desktop/issues/new"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => handleOpenExternal(e, 'https://github.com/ederaefe/EPUB-Reader-Desktop/issues/new')}
                    className="settings-btn-secondary h-8 px-3 rounded-md inline-flex items-center gap-1.5 text-[12px] font-semibold"
                  >
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Report Issue</span>
                  </a>
                  <a
                    href="mailto:efeoghene@proton.me?subject=Semply%20Feedback"
                    onClick={(e) => handleOpenExternal(e, 'mailto:efeoghene@proton.me?subject=Semply%20Feedback')}
                    className="settings-btn-secondary h-8 px-3 rounded-md inline-flex items-center gap-1.5 text-[12px] font-semibold"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Email Support</span>
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
