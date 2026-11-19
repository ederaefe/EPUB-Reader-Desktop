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
  Shield,
  FolderLock,
  FolderPlus,
  FolderOpen,
  WifiOff,
  RefreshCw,
  Unlink
} from 'lucide-react'
import { useAppStore } from '../../stores/useAppStore'
import { backupService } from '../../services/backupService'
import { adaptiveScrollEngine } from '../../services/adaptiveScrollService'
import { extractBookMetadata } from '../../services/coverService'
import { db, type AutoscrollMode } from '../../db'
import type { SecurityBoundariesStatus } from '../../../../shared/securityTypes'
import { ThemePickerGrid } from '../ui/ThemePickerGrid'
import { SecondsNumberInput } from '../ui/SecondsNumberInput'
import { ValueStepper } from '../ui/ValueStepper'
import { FontPicker } from '../ui/FontPicker'

type FullSettingsTab = 'system' | 'reading' | 'vault' | 'hotkeys' | 'backup' | 'about'

const SETTINGS_TABS: Array<{ id: FullSettingsTab; label: string }> = [
  { id: 'system', label: 'System' },
  { id: 'reading', label: 'Reading settings' },
  { id: 'vault', label: 'Vault & Security' },
  { id: 'hotkeys', label: 'Hotkeys' },
  { id: 'backup', label: 'Backup & Sync' },
  { id: 'about', label: 'About' }
]

const HOTKEYS_LEFT: Array<{ label: string; keys: string[] }> = [
  { label: 'Show hotkeys', keys: ['F1'] },
  { label: 'Go to previous page', keys: ['Left', 'PgUp'] },
  { label: 'Go to next page', keys: ['Right', 'Space'] },
  { label: 'Start/pause reading aloud', keys: ['F7'] },
  { label: 'Stop reading aloud', keys: ['F8'] }
]

const HOTKEYS_RIGHT: Array<{ label: string; keys: string[] }> = [
  { label: 'Add bookmark', keys: ['Ctrl + B'] },
  { label: 'Search in book', keys: ['Ctrl + F'] },
  { label: 'Switch theme', keys: ['F9'] },
  { label: 'Switch column count', keys: ['F10'] },
  { label: 'Switch fullscreen', keys: ['F11'] },
  { label: 'Back to library', keys: ['Alt + X'] }
]

export const FullSettingsModal: React.FC = () => {
  const {
    isFullSettingsModalOpen,
    toggleFullSettingsModal,
    isAutoscrollActive,
    setAutoscrollActive,
    settings,
    updateSettings,
    openConfirmDialog,
    showToast,
    bumpLibraryVersion,
    setIsOnline
  } = useAppStore()

  const [activeTab, setActiveTab] = useState<FullSettingsTab>('system')
  const [backupStatus, setBackupStatus] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [securityStatus, setSecurityStatus] = useState<SecurityBoundariesStatus | null>(null)
  const [isVaultBusy, setIsVaultBusy] = useState(false)

  useEffect(() => {
    if (!isFullSettingsModalOpen) return
    if (window.desktopAPI?.getSecurityStatus) {
      window.desktopAPI
        .getSecurityStatus()
        .then((st) => setSecurityStatus(st))
        .catch(() => {})
    }
  }, [isFullSettingsModalOpen])

  useEffect(() => {
    if (!isFullSettingsModalOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') toggleFullSettingsModal(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isFullSettingsModalOpen, toggleFullSettingsModal])

  if (!isFullSettingsModalOpen) return null

  const importBookPathsIntoLibrary = async (filePaths: string[]): Promise<number> => {
    if (!window.desktopAPI?.readFileBuffer || filePaths.length === 0) return 0
    let added = 0
    for (const filePath of filePaths) {
      const existing = await db.books.where('filePath').equals(filePath).first()
      if (existing) continue
      try {
        const ext = filePath.split('.').pop()?.toLowerCase() || 'epub'
        const format: 'epub' | 'pdf' | 'mobi' | 'txt' =
          ext === 'pdf' ? 'pdf' : ext === 'mobi' ? 'mobi' : ext === 'txt' ? 'txt' : 'epub'
        const buffer = await window.desktopAPI.readFileBuffer(filePath)
        const rawName = filePath.split(/[\\/]/).pop()?.replace(/\.[^/.]+$/, '') || 'Untitled'
        const meta = await extractBookMetadata(buffer, ext, rawName)
        await db.books.add({
          filePath,
          title: meta.title,
          author: meta.author,
          coverDataUrl: meta.coverDataUrl,
          format,
          fileSize: buffer.byteLength,
          addedAt: Date.now(),
          lastOpenedAt: null,
          progressCfi: null,
          progressPercent: 0,
          currentPage: 1,
          totalPages: meta.totalPages || 100,
          categoryId: null,
          isFavorite: false,
          isRead: false,
          isPinned: false,
          pinnedAt: null,
          tags: meta.embedded.tags || [],
          description: meta.embedded.description,
          publisher: meta.embedded.publisher,
          publishedDate: meta.embedded.publishedDate,
          language: meta.embedded.language,
          identifier: meta.embedded.identifier,
          series: meta.embedded.series,
          seriesIndex: meta.embedded.seriesIndex,
          rights: meta.embedded.rights,
          subject: meta.embedded.subject,
          creatorTool: meta.embedded.creatorTool,
          producer: meta.embedded.producer,
          formatVersion: meta.embedded.formatVersion,
          metadataHydrated: true
        })
        added++
      } catch {
        // Skip unreadable entries during vault sync
      }
    }
    if (added > 0) bumpLibraryVersion()
    return added
  }

  const handleChooseVault = async () => {
    if (!window.desktopAPI?.chooseVaultFolder) return
    setIsVaultBusy(true)
    try {
      const res = await window.desktopAPI.chooseVaultFolder()
      if (res.error) {
        showToast(res.error, 'error')
        return
      }
      if (res.canceled) return
      setSecurityStatus(res.status)
      const added = await importBookPathsIntoLibrary(res.scannedFiles || [])
      showToast(
        added > 0
          ? `Library Vault connected — synced ${added} new ${added === 1 ? 'book' : 'books'}`
          : 'Library Vault connected',
        'success'
      )
    } finally {
      setIsVaultBusy(false)
    }
  }

  const handleScanVault = async () => {
    if (!window.desktopAPI?.scanVault) return
    setIsVaultBusy(true)
    try {
      const files = await window.desktopAPI.scanVault()
      const added = await importBookPathsIntoLibrary(files)
      showToast(
        added > 0
          ? `Synced ${added} new ${added === 1 ? 'book' : 'books'} from Vault`
          : 'Vault is already up to date',
        'info'
      )
    } finally {
      setIsVaultBusy(false)
    }
  }

  const handleClearVault = () => {
    if (!window.desktopAPI?.clearVaultFolder) return
    openConfirmDialog({
      title: 'Unlink Library Vault?',
      message:
        'Your files on disk will not be deleted. Strict Vault Lock will turn off and Semply will fall back to your Authorized Folders.',
      confirmLabel: 'Unlink Vault',
      onConfirm: async () => {
        const next = await window.desktopAPI.clearVaultFolder()
        setSecurityStatus(next)
        showToast('Library Vault unlinked', 'info')
      }
    })
  }

  const handleToggleStrictVault = async () => {
    if (!window.desktopAPI?.setStrictVaultOnly || !securityStatus?.vaultPath) return
    try {
      const next = await window.desktopAPI.setStrictVaultOnly(!securityStatus.strictVaultOnly)
      setSecurityStatus(next)
      showToast(
        next.strictVaultOnly
          ? 'Strict Vault Lock enabled — access sealed to your Vault folder'
          : 'Strict Vault Lock disabled',
        'info'
      )
    } catch (err: any) {
      showToast(err?.message || 'Could not update Strict Vault Lock', 'error')
    }
  }

  const handleToggleCopyImports = async () => {
    if (!window.desktopAPI?.setCopyImportsIntoVault || !securityStatus) return
    const next = await window.desktopAPI.setCopyImportsIntoVault(!securityStatus.copyImportsIntoVault)
    setSecurityStatus(next)
  }

  const handleAddAuthorizedFolder = async () => {
    if (!window.desktopAPI?.addAuthorizedFolder) return
    const res = await window.desktopAPI.addAuthorizedFolder()
    if (res.error) {
      showToast(res.error, 'error')
      return
    }
    if (!res.canceled) {
      setSecurityStatus(res.status)
      showToast('Folder authorized for Semply', 'success')
    }
  }

  const handleRemoveAuthorizedFolder = async (folder: string) => {
    if (!window.desktopAPI?.removeAuthorizedFolder) return
    const next = await window.desktopAPI.removeAuthorizedFolder(folder)
    setSecurityStatus(next)
    showToast('Folder access revoked', 'info')
  }

  const handleToggleStrictOffline = async () => {
    if (!window.desktopAPI?.setStrictOfflineMode || !securityStatus) return
    const next = await window.desktopAPI.setStrictOfflineMode(!securityStatus.strictOfflineMode)
    setSecurityStatus(next)
    setIsOnline(!next.strictOfflineMode && navigator.onLine)
    showToast(
      next.strictOfflineMode
        ? 'Strict Offline Mode enabled — all internet access sealed'
        : 'Allowlisted lookups re-enabled (Fonts, Dictionary, Wikipedia)',
      'info'
    )
  }

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

                <div className="settings-card px-3.5 py-2.5 rounded-lg flex items-center justify-between gap-3">
                  <div>
                    <span className="text-[13px] font-bold text-[var(--app-text-strong)] block">
                      Screen Dimming
                    </span>
                    <span className="text-[11px] font-normal text-[var(--app-text-muted)]">
                      Soften overall window brightness
                    </span>
                  </div>
                  <ValueStepper
                    value={settings.dimming}
                    min={0}
                    max={75}
                    step={5}
                    unit="%"
                    ariaLabel="Dimming"
                    onChange={(val) => updateSettings({ dimming: val })}
                  />
                </div>

                {/* Interactive Checkbox Rows */}
                <div className="settings-card p-2 rounded-lg space-y-0.5">
                  <label className="settings-row-interactive flex items-center gap-2.5 px-2.5 py-1.5 text-[12.5px] font-semibold text-[var(--app-text)] cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={Boolean(settings.copyExternal)}
                      onChange={(e) => updateSettings({ copyExternal: e.target.checked })}
                      className="ice-checkbox"
                    />
                    <span className="group-hover:text-[var(--app-text-strong)] transition-colors">
                      Copy eBooks from external devices
                    </span>
                  </label>
                  <label className="settings-row-interactive flex items-center gap-2.5 px-2.5 py-1.5 text-[12.5px] font-semibold text-[var(--app-text)] cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={settings.autoUpdate ?? true}
                      onChange={(e) => updateSettings({ autoUpdate: e.target.checked })}
                      className="ice-checkbox"
                    />
                    <span className="group-hover:text-[var(--app-text-strong)] transition-colors">
                      Check for updates automatically
                    </span>
                  </label>
                  <label className="settings-row-interactive flex items-center gap-2.5 px-2.5 py-1.5 text-[12.5px] font-semibold text-[var(--app-text)] cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={Boolean(settings.sendStats)}
                      onChange={(e) => updateSettings({ sendStats: e.target.checked })}
                      className="ice-checkbox"
                    />
                    <span className="group-hover:text-[var(--app-text-strong)] transition-colors">
                      Send anonymous usage stats
                    </span>
                  </label>
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

                <div className="px-3.5 py-2.5 flex items-center justify-between gap-4">
                  <span className="text-[13px] font-bold text-[var(--app-text-strong)]">
                    Default Font Size
                  </span>
                  <ValueStepper
                    value={settings.fontSize}
                    min={12}
                    max={42}
                    step={1}
                    unit="px"
                    ariaLabel="Default Font Size"
                    onChange={(val) => updateSettings({ fontSize: val })}
                  />
                </div>

                <div className="px-3.5 py-2.5 flex items-center justify-between gap-4">
                  <span className="text-[13px] font-bold text-[var(--app-text-strong)]">
                    Line Spacing
                  </span>
                  <ValueStepper
                    value={Math.round(settings.lineHeight * 100)}
                    min={100}
                    max={250}
                    step={10}
                    unit="%"
                    ariaLabel="Line Spacing"
                    onChange={(val) => updateSettings({ lineHeight: val / 100 })}
                  />
                </div>

                <div className="px-3.5 py-2.5 flex items-center justify-between gap-4">
                  <span className="text-[13px] font-bold text-[var(--app-text-strong)]">
                    Text Weight
                  </span>
                  <div
                    className="grid grid-cols-3 p-0.5 bg-[var(--app-bg)] rounded-md border border-[var(--app-border)] w-48"
                    role="radiogroup"
                    aria-label="Text Weight"
                  >
                    {[
                      { label: 'Normal', value: 400 },
                      { label: 'Medium', value: 500 },
                      { label: 'Bold', value: 600 }
                    ].map((opt) => {
                      const active = (settings.fontWeight || 400) === opt.value
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          onClick={() => updateSettings({ fontWeight: opt.value })}
                          className={`h-7 rounded-[4px] text-[11.5px] font-semibold transition-all ${
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

              {/* Dual-Mode Auto-Scroll Countdown Section */}
              {(() => {
                const effectiveMode: AutoscrollMode =
                  settings.autoscrollMode ??
                  (settings.autoscrollAdaptive === false ? 'countdown' : 'adaptive')
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
                            Auto-Scroll
                          </span>
                        </div>
                        <p className="text-[11.5px] font-normal text-[var(--app-text-muted)] mt-0.5">
                          {effectiveMode === 'countdown'
                            ? 'Turns page automatically on a fixed timer'
                            : 'Scales your base seconds dynamically to each page word count'}
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
                        className="settings-switch w-10 h-5 rounded-full p-0.5 flex items-center cursor-pointer shrink-0"
                        title={isAutoscrollActive ? 'Turn off Auto-Scroll' : 'Turn on Auto-Scroll'}
                      >
                        <span
                          className={`w-4 h-4 bg-white rounded-full shadow-sm block transition-transform duration-150 ${
                            isAutoscrollActive ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Segmented Mode Selector */}
                    <div className="grid grid-cols-2 gap-1 p-1 bg-[var(--app-surface-2)] rounded-lg border border-[var(--app-border)]">
                      <button
                        type="button"
                        data-active={effectiveMode === 'countdown' ? 'true' : 'false'}
                        onClick={() => handleModeChange('countdown')}
                        className="settings-segment-btn h-7 rounded-md flex items-center justify-center gap-1.5 text-[12px] font-bold cursor-pointer"
                      >
                        <Timer className="w-3.5 h-3.5" />
                        <span>Fixed Timer</span>
                      </button>

                      <button
                        type="button"
                        data-active={effectiveMode === 'adaptive' ? 'true' : 'false'}
                        onClick={() => handleModeChange('adaptive')}
                        className="settings-segment-btn h-7 rounded-md flex items-center justify-center gap-1.5 text-[12px] font-bold cursor-pointer"
                      >
                        <Zap className="w-3.5 h-3.5" />
                        <span>Smart Pace</span>
                      </button>
                    </div>

                    {/* Inline Compact Mode Controls */}
                    {effectiveMode === 'countdown' ? (
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
                    ) : (
                      <div className="space-y-2.5 pt-0.5">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-[12.5px] font-bold text-[var(--app-text-strong)]">
                              Base seconds per page
                            </span>
                            <span className="text-[11px] font-normal text-[var(--app-text-muted)]">
                              (3–600s)
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
                            min={3}
                            max={600}
                            step={5}
                            onChange={handleAdaptiveSecChange}
                            ariaLabel="Smart base seconds per page"
                          />
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-[var(--app-border)]">
                          <span className="text-[12.5px] font-bold text-[var(--app-text)]">
                            Pause at section breaks
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

          {/* 3. VAULT & SECURITY TAB (Obsidian-Style Vault + Hard Egress Seal) */}
          {activeTab === 'vault' && (
            <div className="space-y-4 max-w-[660px] animate-fadeIn">
              {/* Obsidian-Style Single-Folder Library Vault */}
              <div className="settings-card p-4 rounded-lg space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <FolderLock className="w-4 h-4 text-[var(--app-accent)]" />
                      <span className="text-[14px] font-bold text-[var(--app-text-strong)]">
                        Library Vault
                      </span>
                      {securityStatus?.strictVaultOnly && (
                        <span className="text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                          Locked
                        </span>
                      )}
                    </div>
                    <p className="text-[11.5px] font-normal text-[var(--app-text-muted)] leading-relaxed">
                      Designate a single local folder as your portable book vault (Obsidian-style).
                      Locking the vault prevents the app from reading, scanning, or modifying files anywhere else on disk.
                    </p>
                  </div>
                </div>

                {/* Active Vault Path Display */}
                <div className="px-3 py-2 rounded-md bg-[var(--app-bg)] border border-[var(--app-border)] flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] text-[var(--app-text)] truncate">
                    {securityStatus?.vaultPath || 'No Vault configured — using Authorized Folders'}
                  </span>
                  {securityStatus?.vaultPath && (
                    <button
                      type="button"
                      onClick={() => window.desktopAPI?.openVaultInExplorer?.()}
                      className="text-[11px] font-semibold text-[var(--app-accent-text)] hover:underline shrink-0 inline-flex items-center gap-1 cursor-pointer"
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                      <span>Open</span>
                    </button>
                  )}
                </div>

                {/* Vault Actions */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={isVaultBusy}
                    onClick={handleChooseVault}
                    className="settings-btn-primary h-8 px-3.5 rounded-md inline-flex items-center gap-1.5 text-[12px] font-bold cursor-pointer disabled:opacity-50"
                  >
                    <FolderPlus className="w-3.5 h-3.5" />
                    <span>{securityStatus?.vaultPath ? 'Switch Vault' : 'Choose or Create Vault'}</span>
                  </button>

                  {securityStatus?.vaultPath && (
                    <>
                      <button
                        type="button"
                        disabled={isVaultBusy}
                        onClick={handleScanVault}
                        className="settings-btn-secondary h-8 px-3 rounded-md inline-flex items-center gap-1.5 text-[12px] font-semibold cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isVaultBusy ? 'animate-spin' : ''}`} />
                        <span>Scan Vault</span>
                      </button>

                      <button
                        type="button"
                        disabled={isVaultBusy}
                        onClick={handleClearVault}
                        className="settings-btn-danger h-8 px-3 rounded-md inline-flex items-center gap-1.5 text-[12px] font-semibold cursor-pointer disabled:opacity-50"
                      >
                        <Unlink className="w-3.5 h-3.5" />
                        <span>Unlink</span>
                      </button>
                    </>
                  )}
                </div>

                {/* Vault Toggles */}
                {securityStatus?.vaultPath && (
                  <div className="pt-2.5 border-t border-[var(--app-border)] space-y-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <span className="text-[12.5px] font-bold text-[var(--app-text-strong)] block">
                          Strict Vault Lock
                        </span>
                        <span className="text-[11px] font-normal text-[var(--app-text-muted)]">
                          Deny reading or scanning any book outside this Vault folder
                        </span>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={Boolean(securityStatus.strictVaultOnly)}
                        data-preserve-theme="true"
                        onClick={handleToggleStrictVault}
                        style={{
                          backgroundColor: securityStatus.strictVaultOnly
                            ? 'var(--app-accent)'
                            : 'var(--app-border-strong)'
                        }}
                        className="settings-switch w-10 h-5 rounded-full p-0.5 flex items-center cursor-pointer shrink-0"
                      >
                        <span
                          className={`w-4 h-4 bg-white rounded-full shadow-sm block transition-transform duration-150 ${
                            securityStatus.strictVaultOnly ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <span className="text-[12.5px] font-bold text-[var(--app-text-strong)] block">
                          Copy imported &amp; dropped books into Vault
                        </span>
                        <span className="text-[11px] font-normal text-[var(--app-text-muted)]">
                          Keep every book you open or drop stored safely inside the Vault
                        </span>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={Boolean(securityStatus.copyImportsIntoVault)}
                        data-preserve-theme="true"
                        onClick={handleToggleCopyImports}
                        style={{
                          backgroundColor: securityStatus.copyImportsIntoVault
                            ? 'var(--app-accent)'
                            : 'var(--app-border-strong)'
                        }}
                        className="settings-switch w-10 h-5 rounded-full p-0.5 flex items-center cursor-pointer shrink-0"
                      >
                        <span
                          className={`w-4 h-4 bg-white rounded-full shadow-sm block transition-transform duration-150 ${
                            securityStatus.copyImportsIntoVault ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Authorized Folder Boundaries */}
              <div className="settings-card p-4 rounded-lg space-y-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[13.5px] font-bold text-[var(--app-text-strong)]">
                        Authorized Folders
                      </span>
                      {securityStatus?.strictVaultOnly && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--app-surface-2)] text-[var(--app-text-muted)] border border-[var(--app-border)]">
                          Paused by Strict Vault Lock
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] font-normal text-[var(--app-text-muted)] mt-0.5">
                      Semply can only read inside these OS-approved folders ({securityStatus?.authorizedFileCount ?? 0} individual files granted).
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddAuthorizedFolder}
                    className="settings-btn-secondary h-7 px-2.5 rounded-md inline-flex items-center gap-1.5 text-[11.5px] font-semibold cursor-pointer shrink-0"
                  >
                    <FolderPlus className="w-3.5 h-3.5" />
                    <span>Add Folder</span>
                  </button>
                </div>

                {securityStatus && securityStatus.authorizedFolders.length > 0 ? (
                  <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
                    {securityStatus.authorizedFolders.map((folder) => {
                      const isVault = securityStatus.vaultPath === folder
                      return (
                        <div
                          key={folder}
                          className="px-2.5 py-1.5 rounded bg-[var(--app-bg)] border border-[var(--app-border)] flex items-center justify-between gap-2"
                        >
                          <span className="font-mono text-[11px] text-[var(--app-text)] truncate">
                            {folder}
                          </span>
                          {isVault ? (
                            <span className="text-[10px] font-mono text-[var(--app-accent-text)] shrink-0">
                              Vault
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleRemoveAuthorizedFolder(folder)}
                              className="text-[11px] font-semibold text-[#e5484d] hover:underline shrink-0 cursor-pointer"
                            >
                              Revoke
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-[11px] text-[var(--app-text-muted)] italic">
                    No folders authorized yet. Use Import Folder or Add Folder to grant access.
                  </p>
                )}
              </div>

              {/* Network Egress Seal */}
              <div className="settings-card p-4 rounded-lg space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-emerald-500" />
                      <span className="text-[13.5px] font-bold text-[var(--app-text-strong)]">
                        Network Egress Seal
                      </span>
                      <span className="text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                        Renderer Air-Gapped
                      </span>
                    </div>
                    <p className="text-[11.5px] font-normal text-[var(--app-text-muted)] mt-0.5">
                      Book pages and the UI cannot connect to the internet directly. Only the verified services below may make HTTPS requests through the main process:
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {(securityStatus?.allowedNetworkHosts || [
                    'fonts.googleapis.com',
                    'fonts.gstatic.com',
                    'api.dictionaryapi.dev',
                    'en.wikipedia.org',
                    'upload.wikimedia.org'
                  ]).map((host) => (
                    <span
                      key={host}
                      className={`px-2 py-0.5 rounded font-mono text-[10.5px] border ${
                        securityStatus?.strictOfflineMode
                          ? 'bg-[var(--app-surface-2)] text-[var(--app-text-muted)] border-[var(--app-border)] line-through opacity-60'
                          : 'bg-[var(--app-bg)] text-[var(--app-text)] border-[var(--app-border)]'
                      }`}
                    >
                      {host}
                    </span>
                  ))}
                </div>

                <div className="pt-2.5 border-t border-[var(--app-border)] flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <WifiOff className="w-4 h-4 text-[var(--app-text-muted)] shrink-0" />
                    <div>
                      <span className="text-[12.5px] font-bold text-[var(--app-text-strong)] block">
                        Strict Offline Mode
                      </span>
                      <span className="text-[11px] font-normal text-[var(--app-text-muted)]">
                        Block even font downloads, dictionary, and Wikipedia lookups
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={Boolean(securityStatus?.strictOfflineMode)}
                    data-preserve-theme="true"
                    onClick={handleToggleStrictOffline}
                    style={{
                      backgroundColor: securityStatus?.strictOfflineMode
                        ? '#e5484d'
                        : 'var(--app-border-strong)'
                    }}
                    className="settings-switch w-10 h-5 rounded-full p-0.5 flex items-center cursor-pointer shrink-0"
                  >
                    <span
                      className={`w-4 h-4 bg-white rounded-full shadow-sm block transition-transform duration-150 ${
                        securityStatus?.strictOfflineMode ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 4. HOTKEYS TAB */}
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
                    <h3 className="text-[15px] font-bold text-[var(--app-text-strong)]">
                      Semply Ebook Reader
                    </h3>
                    <p className="text-[11.5px] font-semibold text-[var(--app-text-muted)]">
                      Version 1.0.0 (Native Desktop Edition)
                    </p>
                  </div>
                </div>

                <p className="text-[12.5px] font-normal text-[var(--app-text)] leading-relaxed">
                  Semply is designed to be your primary reading workstation. We prioritize
                  performance, accessibility, and focus—providing a clean, distraction-free
                  environment for deep reading.
                </p>

                <div className="flex flex-wrap gap-2 pt-3 border-t border-[var(--app-border)] text-xs">
                  <a
                    href="https://github.com/ederaefe/EPUB-Reader-Desktop"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="settings-btn-secondary h-8 px-3 rounded-md inline-flex items-center gap-1.5 text-[12px] font-semibold"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>GitHub</span>
                  </a>
                  <a
                    href="https://github.com/ederaefe/EPUB-Reader-Desktop/blob/main/documentation.md"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="settings-btn-secondary h-8 px-3 rounded-md inline-flex items-center gap-1.5 text-[12px] font-semibold"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>User Manual</span>
                  </a>
                  <a
                    href="https://github.com/ederaefe/EPUB-Reader-Desktop#readme"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="settings-btn-secondary h-8 px-3 rounded-md inline-flex items-center gap-1.5 text-[12px] font-semibold"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>Website</span>
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
