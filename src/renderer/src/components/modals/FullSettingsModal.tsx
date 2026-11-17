import React, { useState } from 'react'
import {
  X,
  Sun,
  Moon,
  Coffee,
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

export const FullSettingsModal: React.FC = () => {
  const {
    isFullSettingsModalOpen,
    toggleFullSettingsModal,
    isAutoscrollActive,
    setAutoscrollActive,
    settings,
    updateSettings
  } = useAppStore()

  const [activeTab, setActiveTab] = useState<
    'system' | 'reading' | 'tts' | 'hotkeys' | 'backup' | 'about'
  >('system')

  const [autoUpdate, setAutoUpdate] = useState(true)
  const [copyExternal, setCopyExternal] = useState(false)
  const [sendStats, setSendStats] = useState(false)
  const [backupStatus, setBackupStatus] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

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

  const handleEmptyLibrary = async () => {
    if (window.confirm('Are you sure you want to empty the library? All imported books will be cleared.')) {
      await db.books.clear()
      await db.annotations.clear()
      await db.bookmarks.clear()
      setBackupStatus('Library emptied.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[2px] select-none p-4">
      <div className="w-[820px] max-h-[90vh] bg-[#171a21] border border-[#2d323f] rounded-[3px] shadow-2xl flex flex-col overflow-hidden text-xs text-[#c9d1d9] animate-in fade-in zoom-in-95 duration-100">
        {/* Top Header & Tabs */}
        <div className="h-10 bg-[#14161c] border-b border-[#232732] flex items-center justify-between px-3 shrink-0">
          <div className="flex items-center h-full">
            <button
              onClick={() => setActiveTab('system')}
              className={`h-full px-4 text-xs font-medium border-b-2 transition-colors flex items-center ${
                activeTab === 'system'
                  ? 'border-[#2a69df] text-white'
                  : 'border-transparent text-[#8b949e] hover:text-white'
              }`}
            >
              System
            </button>
            <button
              onClick={() => setActiveTab('reading')}
              className={`h-full px-4 text-xs font-medium border-b-2 transition-colors flex items-center ${
                activeTab === 'reading'
                  ? 'border-[#2a69df] text-white'
                  : 'border-transparent text-[#8b949e] hover:text-white'
              }`}
            >
              Reading settings
            </button>
            <button
              onClick={() => setActiveTab('tts')}
              className={`h-full px-4 text-xs font-medium border-b-2 transition-colors flex items-center ${
                activeTab === 'tts'
                  ? 'border-[#2a69df] text-white'
                  : 'border-transparent text-[#8b949e] hover:text-white'
              }`}
            >
              Text to speech
            </button>
            <button
              onClick={() => setActiveTab('hotkeys')}
              className={`h-full px-4 text-xs font-medium border-b-2 transition-colors flex items-center ${
                activeTab === 'hotkeys'
                  ? 'border-[#2a69df] text-white'
                  : 'border-transparent text-[#8b949e] hover:text-white'
              }`}
            >
              Hotkeys
            </button>
            <button
              onClick={() => setActiveTab('backup')}
              className={`h-full px-4 text-xs font-medium border-b-2 transition-colors flex items-center ${
                activeTab === 'backup'
                  ? 'border-[#2a69df] text-white'
                  : 'border-transparent text-[#8b949e] hover:text-white'
              }`}
            >
              Backup & Sync
            </button>
            <button
              onClick={() => setActiveTab('about')}
              className={`h-full px-4 text-xs font-medium border-b-2 transition-colors flex items-center ${
                activeTab === 'about'
                  ? 'border-[#2a69df] text-white'
                  : 'border-transparent text-[#8b949e] hover:text-white'
              }`}
            >
              About
            </button>
          </div>

          <button
            onClick={() => toggleFullSettingsModal(false)}
            className="w-6 h-6 flex items-center justify-center text-[#8b949e] hover:text-white hover:bg-[#282c37] rounded-[2px]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
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
                  <select className="ice-input w-full h-8 px-2.5 text-xs bg-[#12141a] border-[#2d323f] text-white rounded-[2px]">
                    <option value="en">English</option>
                    <option value="es">Español</option>
                    <option value="fr">Français</option>
                    <option value="de">Deutsch</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] text-[#8b949e] block mb-1.5">Theme</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => updateSettings({ theme: 'day' })}
                      className={`h-8 rounded-[2px] flex items-center justify-center gap-2 border text-xs transition-colors ${
                        settings.theme === 'day'
                          ? 'bg-[#2a69df] border-[#2a69df] text-white'
                          : 'bg-[#282c37] border-[#3c404d] text-[#c9d1d9] hover:bg-[#323745]'
                      }`}
                    >
                      <Sun className="w-3.5 h-3.5" />
                      <span>Day</span>
                    </button>
                    <button
                      onClick={() => updateSettings({ theme: 'night' })}
                      className={`h-8 rounded-[2px] flex items-center justify-center gap-2 border text-xs transition-colors ${
                        settings.theme === 'night'
                          ? 'bg-[#2a69df] border-[#2a69df] text-white'
                          : 'bg-[#282c37] border-[#3c404d] text-[#c9d1d9] hover:bg-[#323745]'
                      }`}
                    >
                      <Moon className="w-3.5 h-3.5" />
                      <span>Night</span>
                    </button>
                    <button
                      onClick={() => updateSettings({ theme: 'light-sepia' })}
                      className={`h-8 rounded-[2px] flex items-center justify-center gap-2 border text-xs transition-colors ${
                        settings.theme === 'light-sepia'
                          ? 'bg-[#2a69df] border-[#2a69df] text-white'
                          : 'bg-[#282c37] border-[#3c404d] text-[#c9d1d9] hover:bg-[#323745]'
                      }`}
                    >
                      <Coffee className="w-3.5 h-3.5" />
                      <span>Light sepia</span>
                    </button>
                    <button
                      onClick={() => updateSettings({ theme: 'dark-sepia' })}
                      className={`h-8 rounded-[2px] flex items-center justify-center gap-2 border text-xs transition-colors ${
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
                      checked={copyExternal}
                      onChange={(e) => setCopyExternal(e.target.checked)}
                      className="ice-checkbox"
                    />
                    <span className="group-hover:text-white transition-colors">Copy eBooks from external devices</span>
                  </label>
                  <label className="flex items-center gap-2.5 text-xs text-[#c9d1d9] cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={autoUpdate}
                      onChange={(e) => setAutoUpdate(e.target.checked)}
                      className="ice-checkbox"
                    />
                    <span className="group-hover:text-white transition-colors">Check for the updates automatically</span>
                  </label>
                  <label className="flex items-center gap-2.5 text-xs text-[#c9d1d9] cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={sendStats}
                      onChange={(e) => setSendStats(e.target.checked)}
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
              <div>
                <label className="text-[11px] text-[#8b949e] block mb-1.5">Default Font</label>
                <select
                  value={settings.fontFamily}
                  onChange={(e) => updateSettings({ fontFamily: e.target.value as any })}
                  className="ice-input w-full h-8 px-2.5 text-xs bg-[#12141a] border-[#2d323f] text-white rounded-[2px]"
                >
                  <option value="original">Original font</option>
                  <option value="sans-serif">Segoe UI</option>
                  <option value="serif">Georgia</option>
                  <option value="monospace">Consolas</option>
                </select>
              </div>

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

              {/* Dual-Mode Auto-Scroll Countdown Section (Icon-Only Controls + Rich Tooltips) */}
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

                return (
                  <div className="p-3 bg-[#14161c] border border-[#232732] rounded-[3px] space-y-3">
                    <div className="flex items-center justify-between">
                      <div
                        className="flex items-center gap-2"
                        title="Displays a quiet muted numeric countdown in the bottom-right corner (persists in fullscreen). Auto-pauses when leaving the app or after 5 minutes of inactivity."
                      >
                        {effectiveMode === 'countdown' ? (
                          <Timer className="w-3.5 h-3.5 text-[#2a69df]" />
                        ) : (
                          <Zap className="w-3.5 h-3.5 text-[#f59e0b]" />
                        )}
                        <span className="text-xs font-semibold text-white">Auto-Scroll Countdown</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleModeChange('countdown')}
                          aria-label="Countdown Only Mode"
                          title="Countdown Only: Fixed seconds countdown per page turn (default 20s)"
                          className={`w-7 h-7 rounded-[2px] flex items-center justify-center border transition-colors ${
                            effectiveMode === 'countdown'
                              ? 'bg-[#2a69df] border-[#2a69df] text-white'
                              : 'bg-[#282c37] border-[#3c404d] text-[#8b949e] hover:text-white'
                          }`}
                        >
                          <Timer className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleModeChange('adaptive')}
                          aria-label="Adaptive Countdown Mode"
                          title="Adaptive Countdown: Dynamically computes countdown from visible page words and learned WPM (EMA)"
                          className={`w-7 h-7 rounded-[2px] flex items-center justify-center border transition-colors ${
                            effectiveMode === 'adaptive'
                              ? 'bg-[#2a69df] border-[#2a69df] text-white'
                              : 'bg-[#282c37] border-[#3c404d] text-[#8b949e] hover:text-white'
                          }`}
                        >
                          <Zap className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const next = !isAutoscrollActive
                            if (!next) adaptiveScrollEngine.stop()
                            setAutoscrollActive(next)
                          }}
                          aria-label={isAutoscrollActive ? 'Turn off Auto-Scroll' : 'Turn on Auto-Scroll'}
                          title={
                            isAutoscrollActive
                              ? 'Auto-Scroll is ON — Click to disable'
                              : 'Auto-Scroll is OFF — Click to enable muted bottom-right countdown'
                          }
                          className={`w-7 h-7 rounded-[2px] flex items-center justify-center border transition-colors ${
                            isAutoscrollActive
                              ? 'bg-[#2a69df] border-[#2a69df] text-white'
                              : 'bg-[#282c37] border-[#3c404d] text-[#8b949e] hover:text-white'
                          }`}
                        >
                          <Power className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {effectiveMode === 'countdown' ? (
                      <div className="space-y-1.5">
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
                            aria-label="Reset countdown to 20s"
                            title="Reset fixed countdown interval to default 20s"
                            className="w-6 h-6 flex items-center justify-center rounded-[2px] text-[#8b949e] hover:text-white hover:bg-[#282c37]"
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
                          title={`Fixed countdown interval: ${countdownSec} seconds (range 5s to 120s)`}
                          className="ice-slider w-full"
                        />
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] font-mono">
                          <span
                            className="flex items-center gap-1.5 text-[#8b949e]"
                            title={`Target adaptive reading speed: ${targetWpm} WPM`}
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
                              title="Reset adaptive reading speed to default 250 WPM"
                              className="w-6 h-6 flex items-center justify-center rounded-[2px] text-[#8b949e] hover:text-white hover:bg-[#282c37]"
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
                          title={`Target adaptive reading speed: ${targetWpm} WPM (range 100 to 800 WPM)`}
                          className="ice-slider w-full"
                        />
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
                    <span>Speed Reading (RSVP)</span>
                    <span className="text-[#4cd964]">Optimal Recognition Point</span>
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
