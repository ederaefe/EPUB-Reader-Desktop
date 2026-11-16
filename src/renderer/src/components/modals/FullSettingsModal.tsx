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
  ShieldCheck,
  Key
} from 'lucide-react'
import { useAppStore } from '../../stores/useAppStore'

export const FullSettingsModal: React.FC = () => {
  const {
    isFullSettingsModalOpen,
    toggleFullSettingsModal,
    settings,
    updateSettings
  } = useAppStore()

  const [activeTab, setActiveTab] = useState<
    'system' | 'reading' | 'tts' | 'hotkeys' | 'license'
  >('system')

  const [autoUpdate, setAutoUpdate] = useState(true)
  const [copyExternal, setCopyExternal] = useState(false)
  const [sendStats, setSendStats] = useState(false)
  const [licenseKey, setLicenseKey] = useState('ICR-PRO-UNLOCKED-PERMANENT-2026')
  const [isActivated, setIsActivated] = useState(true)

  if (!isFullSettingsModalOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[2px] select-none p-4">
      <div className="w-[820px] max-h-[90vh] bg-[#171a21] border border-[#2d323f] rounded-[3px] shadow-2xl flex flex-col overflow-hidden text-xs text-[#c9d1d9] animate-in fade-in zoom-in-95 duration-100">
        {/* Top Header & Tabs (1:1 Icecream rec_05.jpg) */}
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
              onClick={() => setActiveTab('license')}
              className={`h-full px-4 text-xs font-medium border-b-2 transition-colors flex items-center ${
                activeTab === 'license'
                  ? 'border-[#2a69df] text-white'
                  : 'border-transparent text-[#8b949e] hover:text-white'
              }`}
            >
              License
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
          {/* 1. SYSTEM TAB (1:1 rec_05.jpg) */}
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
                  <label className="text-[11px] text-[#8b949e] block mb-1.5">Path to Local Library</label>
                  <div className="flex items-center gap-1.5 ice-input h-8 px-2.5 bg-[#12141a] border-[#2d323f] rounded-[2px] text-xs text-[#8b949e] cursor-pointer hover:border-[#3c404d]">
                    <span className="truncate flex-1">C:\Users\USER\.Icecream Ebook Reader\Bookshelf</span>
                    <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                  </div>
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
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="75"
                    value={settings.dimming}
                    onChange={(e) => updateSettings({ dimming: Number(e.target.value) })}
                    className="w-full accent-[#2a69df] h-1 bg-[#323744] rounded cursor-pointer"
                  />
                </div>

                {/* Toggles */}
                <div className="space-y-2 pt-2">
                  <label className="flex items-center gap-2.5 text-xs text-[#c9d1d9] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={copyExternal}
                      onChange={(e) => setCopyExternal(e.target.checked)}
                      className="accent-[#2a69df] rounded-[2px] w-3.5 h-3.5"
                    />
                    <span>Copy eBooks from external devices</span>
                  </label>
                  <label className="flex items-center gap-2.5 text-xs text-[#c9d1d9] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoUpdate}
                      onChange={(e) => setAutoUpdate(e.target.checked)}
                      className="accent-[#2a69df] rounded-[2px] w-3.5 h-3.5"
                    />
                    <span>Check for the updates automatically</span>
                  </label>
                  <label className="flex items-center gap-2.5 text-xs text-[#c9d1d9] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sendStats}
                      onChange={(e) => setSendStats(e.target.checked)}
                      className="accent-[#2a69df] rounded-[2px] w-3.5 h-3.5"
                    />
                    <span>Send anonymous usage stats</span>
                  </label>
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-4">
                <div>
                  <label className="text-[11px] text-[#8b949e] block mb-1.5">Library path</label>
                  <div className="flex items-center gap-1.5 ice-input h-8 px-2.5 bg-[#12141a] border-[#2d323f] rounded-[2px] text-xs text-[#8b949e] cursor-pointer hover:border-[#3c404d]">
                    <span className="truncate flex-1">C:\Users\USER\.Icecream Ebook Reader\Import</span>
                    <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] text-[#8b949e] block mb-1.5">Manage Library</label>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <button className="ice-btn-blue h-8 flex items-center justify-center gap-1.5 rounded-[2px]">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Export</span>
                    </button>
                    <button className="ice-btn-blue h-8 flex items-center justify-center gap-1.5 rounded-[2px]">
                      <Download className="w-3.5 h-3.5" />
                      <span>Import</span>
                    </button>
                  </div>
                  <button className="ice-btn-dark w-full h-8 flex items-center justify-center gap-1.5 text-xs text-[#f85149] hover:bg-[#332225] rounded-[2px]">
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Empty Library</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 2. READING SETTINGS TAB */}
          {activeTab === 'reading' && (
            <div className="space-y-4 max-w-md">
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
                  className="w-full accent-[#2a69df] h-1 bg-[#323744] rounded cursor-pointer"
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
                  className="w-full accent-[#2a69df] h-1 bg-[#323744] rounded cursor-pointer"
                />
              </div>
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
                  className="w-full accent-[#2a69df] h-1 bg-[#323744] rounded cursor-pointer"
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
                  className="w-full accent-[#2a69df] h-1 bg-[#323744] rounded cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* 4. HOTKEYS TAB (1:1 rec_07.jpg) */}
          {activeTab === 'hotkeys' && (
            <div className="grid grid-cols-2 gap-x-10 gap-y-2 text-xs">
              {/* Left Column */}
              <div className="space-y-2">
                <div className="flex items-center justify-between py-1 border-b border-[#232732]">
                  <span>Show hotkeys</span>
                  <span className="px-2 py-0.5 bg-[#282c37] border border-[#3c404d] rounded-[2px] text-[#c8d1dc] font-mono text-[11px]">F1</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-[#232732]">
                  <span>Go to previous page</span>
                  <div className="flex gap-1">
                    <span className="px-1.5 py-0.5 bg-[#282c37] border border-[#3c404d] rounded-[2px] font-mono text-[11px]">Left</span>
                    <span className="px-1.5 py-0.5 bg-[#282c37] border border-[#3c404d] rounded-[2px] font-mono text-[11px]">Up</span>
                    <span className="px-1.5 py-0.5 bg-[#282c37] border border-[#3c404d] rounded-[2px] font-mono text-[11px]">PgUp</span>
                    <span className="px-1.5 py-0.5 bg-[#282c37] border border-[#3c404d] rounded-[2px] font-mono text-[11px]">Backspace</span>
                  </div>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-[#232732]">
                  <span>Go to next page</span>
                  <div className="flex gap-1">
                    <span className="px-1.5 py-0.5 bg-[#282c37] border border-[#3c404d] rounded-[2px] font-mono text-[11px]">Right</span>
                    <span className="px-1.5 py-0.5 bg-[#282c37] border border-[#3c404d] rounded-[2px] font-mono text-[11px]">Down</span>
                    <span className="px-1.5 py-0.5 bg-[#282c37] border border-[#3c404d] rounded-[2px] font-mono text-[11px]">PgDown</span>
                    <span className="px-1.5 py-0.5 bg-[#282c37] border border-[#3c404d] rounded-[2px] font-mono text-[11px]">Space</span>
                  </div>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-[#232732]">
                  <span>Go to the first page</span>
                  <span className="px-2 py-0.5 bg-[#282c37] border border-[#3c404d] rounded-[2px] font-mono text-[11px]">Home</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-[#232732]">
                  <span>Go to the last page</span>
                  <span className="px-2 py-0.5 bg-[#282c37] border border-[#3c404d] rounded-[2px] font-mono text-[11px]">End</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-[#232732]">
                  <span>Start/pause reading aloud</span>
                  <div className="flex gap-1">
                    <span className="px-2 py-0.5 bg-[#282c37] border border-[#3c404d] rounded-[2px] font-mono text-[11px]">F7</span>
                    <span className="px-2 py-0.5 bg-[#282c37] border border-[#3c404d] rounded-[2px] font-mono text-[11px]">Media Play</span>
                  </div>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-[#232732]">
                  <span>Stop reading aloud</span>
                  <div className="flex gap-1">
                    <span className="px-2 py-0.5 bg-[#282c37] border border-[#3c404d] rounded-[2px] font-mono text-[11px]">F8</span>
                    <span className="px-2 py-0.5 bg-[#282c37] border border-[#3c404d] rounded-[2px] font-mono text-[11px]">Media Stop</span>
                  </div>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-[#232732]">
                  <span>Decrease volume</span>
                  <span className="px-2 py-0.5 bg-[#282c37] border border-[#3c404d] rounded-[2px] font-mono text-[11px]">Ctrl + Down</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-[#232732]">
                  <span>Increase volume</span>
                  <span className="px-2 py-0.5 bg-[#282c37] border border-[#3c404d] rounded-[2px] font-mono text-[11px]">Ctrl + Up</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-[#232732]">
                  <span>Add bookmark</span>
                  <span className="px-2 py-0.5 bg-[#282c37] border border-[#3c404d] rounded-[2px] font-mono text-[11px]">Ctrl + B</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-[#232732]">
                  <span>Search</span>
                  <div className="flex gap-1">
                    <span className="px-2 py-0.5 bg-[#282c37] border border-[#3c404d] rounded-[2px] font-mono text-[11px]">Ctrl + F</span>
                    <span className="px-2 py-0.5 bg-[#282c37] border border-[#3c404d] rounded-[2px] font-mono text-[11px]">F3</span>
                  </div>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-[#232732]">
                  <span>Zoom in/ increase font size</span>
                  <div className="flex gap-1">
                    <span className="px-2 py-0.5 bg-[#282c37] border border-[#3c404d] rounded-[2px] font-mono text-[11px]">+</span>
                    <span className="px-2 py-0.5 bg-[#282c37] border border-[#3c404d] rounded-[2px] font-mono text-[11px]">=</span>
                  </div>
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-2">
                <div className="flex items-center justify-between py-1 border-b border-[#232732]">
                  <span>Zoom out/ decrease font size</span>
                  <span className="px-2 py-0.5 bg-[#282c37] border border-[#3c404d] rounded-[2px] font-mono text-[11px]">-</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-[#232732]">
                  <span>Reset zoom to 100%</span>
                  <div className="flex gap-1">
                    <span className="px-2 py-0.5 bg-[#282c37] border border-[#3c404d] rounded-[2px] font-mono text-[11px]">Ctrl + 0</span>
                    <span className="px-2 py-0.5 bg-[#282c37] border border-[#3c404d] rounded-[2px] font-mono text-[11px]">Shift + 0</span>
                  </div>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-[#232732]">
                  <span>Fit to page</span>
                  <div className="flex gap-1">
                    <span className="px-2 py-0.5 bg-[#282c37] border border-[#3c404d] rounded-[2px] font-mono text-[11px]">Ctrl + 1</span>
                    <span className="px-2 py-0.5 bg-[#282c37] border border-[#3c404d] rounded-[2px] font-mono text-[11px]">Shift + 1</span>
                  </div>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-[#232732]">
                  <span>Fit to width</span>
                  <div className="flex gap-1">
                    <span className="px-2 py-0.5 bg-[#282c37] border border-[#3c404d] rounded-[2px] font-mono text-[11px]">Ctrl + 2</span>
                    <span className="px-2 py-0.5 bg-[#282c37] border border-[#3c404d] rounded-[2px] font-mono text-[11px]">Shift + 2</span>
                  </div>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-[#232732]">
                  <span>Back to library</span>
                  <span className="px-2 py-0.5 bg-[#282c37] border border-[#3c404d] rounded-[2px] font-mono text-[11px]">~</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-[#232732]">
                  <span>Show Table of contents</span>
                  <span className="px-2 py-0.5 bg-[#282c37] border border-[#3c404d] rounded-[2px] font-mono text-[11px]">1</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-[#232732]">
                  <span>Show notes list</span>
                  <span className="px-2 py-0.5 bg-[#282c37] border border-[#3c404d] rounded-[2px] font-mono text-[11px]">2</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-[#232732]">
                  <span>Show bookmarks list</span>
                  <span className="px-2 py-0.5 bg-[#282c37] border border-[#3c404d] rounded-[2px] font-mono text-[11px]">3</span>
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

          {/* 5. LICENSE TAB */}
          {activeTab === 'license' && (
            <div className="space-y-4 max-w-md">
              <div className="p-4 bg-[#14161c] border border-[#232732] rounded-[3px] space-y-3">
                <div className="flex items-center gap-2 text-[#4cd964]">
                  <ShieldCheck className="w-5 h-5" />
                  <span className="text-sm font-semibold">Icecream PRO Status</span>
                </div>
                <p className="text-xs text-[#8b949e]">
                  All PRO capabilities unlocked: full screen reading, unlimited notes and bookmarks, high-quality audio synthesis, multi-format conversion, and zero ads.
                </p>
                <div className="flex items-center gap-2 pt-2">
                  <Key className="w-4 h-4 text-[#8b949e]" />
                  <input
                    type="text"
                    value={licenseKey}
                    onChange={(e) => setLicenseKey(e.target.value)}
                    className="ice-input flex-1 h-8 px-2 text-xs font-mono rounded-[2px]"
                  />
                  <button
                    onClick={() => setIsActivated(true)}
                    className="ice-btn-blue h-8 px-3 rounded-[2px]"
                  >
                    Activate
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
