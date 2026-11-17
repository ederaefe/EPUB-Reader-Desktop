import React, { useState, useEffect } from 'react'
import {
  X,
  Upload,
  Download,
  Trash2,
  ChevronRight,
  Check,
  Archive,
  Database,
  Info,
  BookOpen,
  Timer,
  Zap,
  Gauge,
  RotateCcw,
  Pilcrow,
  Power
} from 'lucide-react'
import { useAppStore } from '../../stores/useAppStore'
import { backupService } from '../../services/backupService'
import { adaptiveScrollEngine } from '../../services/adaptiveScrollService'
import { db, type AutoscrollMode } from '../../db'
import { ThemePickerGrid } from '../ui/ThemePickerGrid'
import { SecondsNumberInput } from '../ui/SecondsNumberInput'
import { FontPicker } from '../ui/FontPicker'

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
    bumpLibraryVersion
  } = useAppStore()

  const [activeTab, setActiveTab] = useState<
    'system' | 'reading' | 'tts' | 'hotkeys' | 'backup' | 'about'
  >('system')

  const [backupStatus, setBackupStatus] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  useEffect(() => {
    if (!isFullSettingsModalOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') toggleFullSettingsModal(false)
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
    }
  }

  const handleExportZip = async () => {
    setIsProcessing(true)
    const res = await backupService.exportToZip()
    setIsProcessing(false)
    if (res.success) {
      setBackupStatus('Complete archive with cover art exported successfully.')
    }
  }

  const handleImportBackup = async () => {
    setIsProcessing(true)
    const res = await backupService.promptImport()
    setIsProcessing(false)
    setBackupStatus(res.message)
  }

  const handleEmptyLibrary = () => {
    openConfirmDialog({
      title: 'Empty Library?',
      message: 'All imported books, highlights, and bookmarks will be removed from Semply. Your original files on disk will not be deleted.',
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
        className="w-[780px] max-w-[92vw] h-[580px] max-h-[85vh] bg-[#111111] border border-white/[0.1] rounded-xl shadow-[0_24px_72px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden text-xs text-[#d4d4d4] animate-in fade-in zoom-in-95 duration-100"
      >
        {/* Top Header & Tabs */}
        <div className="h-11 bg-[#0a0a0a] border-b border-white/[0.08] flex items-center justify-between px-3 shrink-0">
          <div className="flex items-center h-full gap-0.5">
            <button
              onClick={() => setActiveTab('system')}
              className={`h-full px-3.5 text-xs font-medium border-b-2 transition-colors flex items-center cursor-pointer ${
                activeTab === 'system'
                  ? 'border-white text-white'
                  : 'border-transparent text-[#888888] hover:text-white'
              }`}
            >
              System
            </button>
            <button
              onClick={() => setActiveTab('reading')}
              className={`h-full px-3.5 text-xs font-medium border-b-2 transition-colors flex items-center cursor-pointer ${
                activeTab === 'reading'
                  ? 'border-white text-white'
                  : 'border-transparent text-[#888888] hover:text-white'
              }`}
            >
              Reading settings
            </button>
            <button
              onClick={() => setActiveTab('tts')}
              className={`h-full px-3.5 text-xs font-medium border-b-2 transition-colors flex items-center cursor-pointer ${
                activeTab === 'tts'
                  ? 'border-white text-white'
                  : 'border-transparent text-[#888888] hover:text-white'
              }`}
            >
              Text to speech
            </button>
            <button
              onClick={() => setActiveTab('hotkeys')}
              className={`h-full px-3.5 text-xs font-medium border-b-2 transition-colors flex items-center cursor-pointer ${
                activeTab === 'hotkeys'
                  ? 'border-white text-white'
                  : 'border-transparent text-[#888888] hover:text-white'
              }`}
            >
              Hotkeys
            </button>
            <button
              onClick={() => setActiveTab('backup')}
              className={`h-full px-3.5 text-xs font-medium border-b-2 transition-colors flex items-center cursor-pointer ${
                activeTab === 'backup'
                  ? 'border-white text-white'
                  : 'border-transparent text-[#888888] hover:text-white'
              }`}
            >
              Backup & Sync
            </button>
            <button
              onClick={() => setActiveTab('about')}
              className={`h-full px-3.5 text-xs font-medium border-b-2 transition-colors flex items-center cursor-pointer ${
                activeTab === 'about'
                  ? 'border-white text-white'
                  : 'border-transparent text-[#888888] hover:text-white'
              }`}
            >
              About
            </button>
          </div>

          <button
            onClick={() => toggleFullSettingsModal(false)}
            className="w-7 h-7 flex items-center justify-center text-[#777777] hover:text-white hover:bg-white/[0.08] rounded-md transition-colors cursor-pointer"
            title="Close (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Fixed-Frame Scrollable Tab Content Area */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6">
          {backupStatus && (
            <div className="mb-4 px-3 py-2 bg-[#1f232d] border border-[#2a69df]/50 text-[#79c0ff] text-xs rounded-[2px] flex items-center justify-between">
              <span>{backupStatus}</span>
              <button
                onClick={() => setBackupStatus(null)}
                className="text-[#8b949e] hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* 1. SYSTEM TAB */}
          {activeTab === 'system' && (
            <div className="grid grid-cols-2 gap-8">
              {/* Left Column */}
              <div className="space-y-4">
                <div>
                  <label className="text-[11px] text-[#8b949e] block mb-1.5">Language</label>
                  <select
                    value={settings.language || 'en'}
                    onChange={(e) => updateSettings({ language: e.target.value })}
                    className="ice-input w-full h-8 px-2.5 text-xs bg-[#12141a] border-[#2d323f] text-white rounded-[2px]"
                  >
                    <option value="en">English</option>
                    <option value="es">Español</option>
                    <option value="fr">Français</option>
                    <option value="de">Deutsch</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] text-[#8b949e] block mb-2">Theme</label>
                  <ThemePickerGrid
                    activeTheme={settings.theme}
                    onSelect={(theme) => updateSettings({ theme })}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between text-[11px] text-[#8b949e] mb-1.5">
                    <span>Dimming</span>
                    <span className="font-mono text-white text-[11px]">{settings.dimming}%</span>
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

                {/* Toggles (Sleek Modern Desktop Checkboxes) */}
                <div className="space-y-2.5 pt-2">
                  <label className="flex items-center gap-2.5 text-xs text-[#c9d1d9] cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={Boolean(settings.copyExternal)}
                      onChange={(e) => updateSettings({ copyExternal: e.target.checked })}
                      className="ice-checkbox"
                    />
                    <span className="group-hover:text-white transition-colors">Copy eBooks from external devices</span>
                  </label>
                  <label className="flex items-center gap-2.5 text-xs text-[#c9d1d9] cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={settings.autoUpdate ?? true}
                      onChange={(e) => updateSettings({ autoUpdate: e.target.checked })}
                      className="ice-checkbox"
                    />
                    <span className="group-hover:text-white transition-colors">Check for the updates automatically</span>
                  </label>
                  <label className="flex items-center gap-2.5 text-xs text-[#c9d1d9] cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={Boolean(settings.sendStats)}
                      onChange={(e) => updateSettings({ sendStats: e.target.checked })}
                      className="ice-checkbox"
                    />
                    <span className="group-hover:text-white transition-colors">Send anonymous usage stats</span>
                  </label>
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-4">
                <div>
                  <label className="text-[11px] text-[#8b949e] block mb-1.5">Quick Backup Actions</label>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <button
                      onClick={handleExportJson}
                      disabled={isProcessing}
                      className="ice-btn-blue h-8 flex items-center justify-center gap-1.5 rounded-[2px]"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Export JSON</span>
                    </button>
                    <button
                      onClick={handleImportBackup}
                      disabled={isProcessing}
                      className="ice-btn-blue h-8 flex items-center justify-center gap-1.5 rounded-[2px]"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Import Additive</span>
                    </button>
                  </div>
                  <button
                    onClick={handleEmptyLibrary}
                    className="ice-btn-dark w-full h-8 flex items-center justify-center gap-1.5 text-xs text-[#f85149] hover:bg-[#332225] rounded-[2px]"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Empty Library</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 2. READING SETTINGS TAB */}
          {activeTab === 'reading' && (
            <div className="space-y-5 max-w-lg">
              <FontPicker />

              <div>
                <div className="flex items-center justify-between text-[11px] text-[#8b949e] mb-1.5">
                  <span>Default Font Size</span>
                  <span className="font-mono text-white">{settings.fontSize}px</span>
                </div>
                <input
                  type="range"
                  min="12"
                  max="42"
                  value={settings.fontSize}
                  onChange={(e) => updateSettings({ fontSize: Number(e.target.value) })}
                  className="ice-slider w-full"
                />
              </div>

              <div>
                <div className="flex items-center justify-between text-[11px] text-[#8b949e] mb-1.5">
                  <span>Line Spacing</span>
                  <span className="font-mono text-white">{Math.round(settings.lineHeight * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="100"
                  max="250"
                  step="10"
                  value={Math.round(settings.lineHeight * 100)}
                  onChange={(e) => updateSettings({ lineHeight: Number(e.target.value) / 100 })}
                  className="ice-slider w-full"
                />
              </div>

              {/* Warm Blue Light Night Filter Section */}
              <div className="p-3 bg-[#14161c] border border-[#232732] rounded-[3px] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-white">Warm Blue Light Night Filter</span>
                    <span className="text-[10px] text-[#f59e0b] font-mono">Candlelight - Daylight</span>
                  </div>
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
                  <div className="space-y-3 pt-1">
                    <div>
                      <div className="flex items-center justify-between text-[11px] text-[#8b949e] mb-1">
                        <span>Color Temperature</span>
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
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-[11px] text-[#8b949e] mb-1">
                        <span>Filter Intensity</span>
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

              {/* Dual-Mode Auto-Scroll Countdown Section (Manual Seconds Input in Both Modes) */}
              {(() => {
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

                return (
                  <div className="p-3.5 bg-[#12141a] border border-[#232732] rounded-[4px] space-y-3">
                    {/* Header + Sleek Switch */}
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-1.5">
                          {effectiveMode === 'countdown' ? (
                            <Timer className="w-3.5 h-3.5 text-[#2a69df]" />
                          ) : (
                            <Zap className="w-3.5 h-3.5 text-[#f59e0b]" />
                          )}
                          <span className="text-xs font-semibold text-white">Auto-Scroll</span>
                        </div>
                        <p className="text-[11px] text-[#6e7681] mt-0.5">
                          {effectiveMode === 'countdown'
                            ? 'Turns page automatically on a fixed timer'
                            : 'Scales your base seconds dynamically to each page word count'}
                        </p>
                      </div>

                      <button
                        type="button"
                        role="switch"
                        aria-checked={isAutoscrollActive}
                        onClick={() => {
                          const next = !isAutoscrollActive
                          if (!next) {
                            adaptiveScrollEngine.stop()
                          } else {
                            adaptiveScrollEngine.clearTransientSuspensions()
                          }
                          setAutoscrollActive(next)
                        }}
                        className={`w-9 h-5 rounded-[3px] transition-colors p-0.5 flex items-center cursor-pointer shrink-0 ${
                          isAutoscrollActive ? 'bg-[#2a69df] justify-end' : 'bg-[#282c37] justify-start'
                        }`}
                        title={isAutoscrollActive ? 'Turn off Auto-Scroll' : 'Turn on Auto-Scroll'}
                      >
                        <span className="w-4 h-4 bg-white rounded-[2px] shadow-sm block" />
                      </button>
                    </div>

                    {/* Sleek Segmented Mode Selector */}
                    <div className="grid grid-cols-2 p-0.5 bg-[#0d0f14] rounded-[3px] border border-[#1f232d]">
                      <button
                        type="button"
                        onClick={() => handleModeChange('countdown')}
                        className={`h-7 rounded-[2px] flex items-center justify-center gap-1.5 text-[11px] font-medium transition-all cursor-pointer ${
                          effectiveMode === 'countdown'
                            ? 'bg-[#2a69df] text-white shadow-sm'
                            : 'text-[#8b949e] hover:text-white'
                        }`}
                      >
                        <Timer className="w-3.5 h-3.5" />
                        <span>Fixed Timer</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleModeChange('adaptive')}
                        className={`h-7 rounded-[2px] flex items-center justify-center gap-1.5 text-[11px] font-medium transition-all cursor-pointer ${
                          effectiveMode === 'adaptive'
                            ? 'bg-[#2a69df] text-white shadow-sm'
                            : 'text-[#8b949e] hover:text-white'
                        }`}
                      >
                        <Zap className="w-3.5 h-3.5" />
                        <span>Smart Pace</span>
                      </button>
                    </div>

                    {/* Mode Controls (Manual Numeric Seconds in Both Modes) */}
                    {effectiveMode === 'countdown' ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-[#8b949e]">Seconds per page (3–600s)</span>
                          {countdownSec !== 20 && (
                            <button
                              type="button"
                              onClick={() => handleCountdownChange(20)}
                              title="Reset to 20s"
                              className="text-[#6e7681] hover:text-white transition-colors cursor-pointer"
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
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-[#8b949e]">Base seconds per page (3–600s)</span>
                            {adaptiveSec !== 25 && (
                              <button
                                type="button"
                                onClick={() => handleAdaptiveSecChange(25)}
                                title="Reset to 25s"
                                className="text-[#6e7681] hover:text-white transition-colors cursor-pointer"
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

                        <div className="flex items-center justify-between pt-2 border-t border-[#1e222c]">
                          <span className="text-[11px] text-[#8b949e]">Pause at section breaks</span>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={microPauseEnabled}
                            onClick={handleMicroPauseToggle}
                            className={`w-7 h-4 rounded-[2px] transition-colors p-0.5 flex items-center cursor-pointer ${
                              microPauseEnabled ? 'bg-[#2a69df] justify-end' : 'bg-[#282c37] justify-start'
                            }`}
                          >
                            <span className="w-3 h-3 bg-white rounded-[1px] block" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>
          )}

          {/* 3. TEXT TO SPEECH TAB */}
          {activeTab === 'tts' && (
            <div className="space-y-4 max-w-md">
              <div>
                <div className="flex items-center justify-between text-[11px] text-[#8b949e] mb-1.5">
                  <span>Speech Speed</span>
                  <span className="font-mono text-white">{settings.ttsSpeed.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2.5"
                  step="0.1"
                  value={settings.ttsSpeed}
                  onChange={(e) => updateSettings({ ttsSpeed: Number(e.target.value) })}
                  className="ice-slider w-full"
                />
              </div>

              <div>
                <div className="flex items-center justify-between text-[11px] text-[#8b949e] mb-1.5">
                  <span>Speech Pitch</span>
                  <span className="font-mono text-white">{settings.ttsPitch.toFixed(1)}</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="1.5"
                  step="0.1"
                  value={settings.ttsPitch}
                  onChange={(e) => updateSettings({ ttsPitch: Number(e.target.value) })}
                  className="ice-slider w-full"
                />
              </div>

              <div className="p-3 bg-[#14161c] border border-[#232732] rounded-[3px] text-[11px] text-[#8b949e] space-y-1">
                <p className="font-medium text-white">Smart Pronunciation Normalization</p>
                <p>
                  Automatic translation for decimals (3.14 &rarr; 3 point 14), abbreviations (Dr., Mr., etc., e.g., i.e.), and Roman numerals (Chapter IV &rarr; Chapter 4).
                </p>
              </div>
            </div>
          )}

          {/* 4. HOTKEYS TAB */}
          {activeTab === 'hotkeys' && (
            <div className="grid grid-cols-2 gap-x-10 gap-y-2 text-xs">
              <div className="space-y-2">
                <div className="flex items-center justify-between py-1 border-b border-[#232732]">
                  <span>Show hotkeys</span>
                  <span className="px-2 py-0.5 bg-[#282c37] border border-[#3c404d] rounded-[2px] font-mono text-[11px]">F1</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-[#232732]">
                  <span>Go to previous page</span>
                  <div className="flex gap-1">
                    <span className="px-1.5 py-0.5 bg-[#282c37] border border-[#3c404d] rounded-[2px] font-mono text-[11px]">Left</span>
                    <span className="px-1.5 py-0.5 bg-[#282c37] border border-[#3c404d] rounded-[2px] font-mono text-[11px]">PgUp</span>
                  </div>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-[#232732]">
                  <span>Go to next page</span>
                  <div className="flex gap-1">
                    <span className="px-1.5 py-0.5 bg-[#282c37] border border-[#3c404d] rounded-[2px] font-mono text-[11px]">Right</span>
                    <span className="px-1.5 py-0.5 bg-[#282c37] border border-[#3c404d] rounded-[2px] font-mono text-[11px]">Space</span>
                  </div>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-[#232732]">
                  <span>Start/pause reading aloud</span>
                  <span className="px-2 py-0.5 bg-[#282c37] border border-[#3c404d] rounded-[2px] font-mono text-[11px]">F7</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-[#232732]">
                  <span>Stop reading aloud</span>
                  <span className="px-2 py-0.5 bg-[#282c37] border border-[#3c404d] rounded-[2px] font-mono text-[11px]">F8</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between py-1 border-b border-[#232732]">
                  <span>Add bookmark</span>
                  <span className="px-2 py-0.5 bg-[#282c37] border border-[#3c404d] rounded-[2px] font-mono text-[11px]">Ctrl + B</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-[#232732]">
                  <span>Search in book</span>
                  <span className="px-2 py-0.5 bg-[#282c37] border border-[#3c404d] rounded-[2px] font-mono text-[11px]">Ctrl + F</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-[#232732]">
                  <span>Switch theme</span>
                  <span className="px-2 py-0.5 bg-[#282c37] border border-[#3c404d] rounded-[2px] font-mono text-[11px]">F9</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-[#232732]">
                  <span>Switch column count</span>
                  <span className="px-2 py-0.5 bg-[#282c37] border border-[#3c404d] rounded-[2px] font-mono text-[11px]">F10</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-[#232732]">
                  <span>Switch fullscreen</span>
                  <span className="px-2 py-0.5 bg-[#282c37] border border-[#3c404d] rounded-[2px] font-mono text-[11px]">F11</span>
                </div>
              </div>
            </div>
          )}

          {/* 5. BACKUP & SYNC TAB (Feature 6: Additive Universal Library Backup) */}
          {activeTab === 'backup' && (
            <div className="space-y-5 max-w-xl">
              <div className="p-4 bg-[#14161c] border border-[#232732] rounded-[3px] space-y-3">
                <div className="flex items-center gap-2 text-white">
                  <Database className="w-4 h-4 text-[#2a69df]" />
                  <span className="text-sm font-semibold">Universal Additive Library Backup</span>
                </div>
                <p className="text-xs text-[#8b949e] leading-relaxed">
                  Export your complete library, custom shelves, notes, highlights, and bookmarks into portable format. When importing, the engine performs a non-destructive additive merge that preserves all local data.
                </p>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    onClick={handleExportJson}
                    disabled={isProcessing}
                    className="ice-btn-dark h-9 flex items-center justify-center gap-2 rounded-[2px]"
                  >
                    <Upload className="w-3.5 h-3.5 text-[#2a69df]" />
                    <span>Export Metadata (JSON)</span>
                  </button>

                  <button
                    onClick={handleExportZip}
                    disabled={isProcessing}
                    className="ice-btn-dark h-9 flex items-center justify-center gap-2 rounded-[2px]"
                  >
                    <Archive className="w-3.5 h-3.5 text-[#f59e0b]" />
                    <span>Export Archive with Covers (ZIP)</span>
                  </button>
                </div>
              </div>

              <div className="p-4 bg-[#14161c] border border-[#232732] rounded-[3px] space-y-3">
                <div className="flex items-center gap-2 text-white">
                  <Download className="w-4 h-4 text-[#4cd964]" />
                  <span className="text-sm font-semibold">Additive Import & Restore</span>
                </div>
                <p className="text-xs text-[#8b949e] leading-relaxed">
                  Select a previously exported .json or .zip backup. Existing reading progress is retained, books are deduplicated, and new categories and annotations are appended.
                </p>

                <button
                  onClick={handleImportBackup}
                  disabled={isProcessing}
                  className="ice-btn-blue h-9 px-4 flex items-center justify-center gap-2 rounded-[2px]"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Choose Backup File to Import</span>
                </button>
              </div>
            </div>
          )}

          {/* 6. ABOUT TAB */}
          {activeTab === 'about' && (
            <div className="space-y-4 max-w-lg">
              <div className="p-4 bg-[#14161c] border border-[#232732] rounded-[3px] space-y-3">
                <div className="flex items-center gap-2 text-white">
                  <BookOpen className="w-5 h-5 text-[#2a69df]" />
                  <div>
                    <h3 className="text-sm font-bold text-white">Semply Ebook Reader</h3>
                    <p className="text-[11px] text-[#8b949e]">Version 1.0.0 (Native Desktop Edition)</p>
                  </div>
                </div>

                <p className="text-xs text-[#c9d1d9] leading-relaxed">
                  Semply Ebook Reader is a modern, high-performance desktop reading workstation engineered with native Windows design principles, free from generic web rounded pill buttons or paywalled feature gates.
                </p>

                <div className="pt-2 border-t border-[#232732] space-y-1.5 text-[11px] text-[#8b949e]">
                  <div className="flex items-center justify-between">
                    <span>Adaptive Auto-Scroll Engine</span>
                    <span className="text-[#4cd964]">Active (EMA &alpha; = 0.15)</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Speech Normalization</span>
                    <span className="text-[#4cd964]">Librera Regex Matrix</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Footnote Handling</span>
                    <span className="text-[#4cd964]">Non-Destructive Popover</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Night Filter</span>
                    <span className="text-[#4cd964]">Chromatic Warm Amber (2000K-4500K)</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Universal Backup</span>
                    <span className="text-[#4cd964]">Additive JSON &amp; ZIP Sync</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
