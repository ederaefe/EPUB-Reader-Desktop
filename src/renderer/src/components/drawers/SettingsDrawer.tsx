import React from 'react'
import {
  X,
  Columns,
  Square,
  Sun,
  Moon,
  Coffee,
  AlignJustify,
  ArrowRight
} from 'lucide-react'
import { useAppStore } from '../../stores/useAppStore'

export const SettingsDrawer: React.FC = () => {
  const {
    isSettingsDrawerOpen,
    toggleSettingsDrawer,
    toggleFullSettingsModal,
    toggleHelpModal,
    settings,
    updateSettings
  } = useAppStore()

  if (!isSettingsDrawerOpen) return null

  const handleLineSpacingChange = (delta: number) => {
    const next = Math.max(1.0, Math.min(2.5, Number((settings.lineHeight + delta).toFixed(1))))
    updateSettings({ lineHeight: next })
  }

  return (
    <aside className="fixed inset-y-0 right-0 w-80 bg-[#171a21] border-l border-[#232732] z-50 flex flex-col justify-between shadow-2xl select-none animate-in slide-in-from-right duration-150">
      <div className="flex flex-col h-full overflow-hidden">
        {/* Header (1:1 Icecream Reader rec_12.jpg) */}
        <div className="h-10 bg-[#14161c] border-b border-[#232732] px-3.5 flex items-center justify-between shrink-0">
          <span className="text-[13px] font-semibold text-white">Settings</span>
          <button
            onClick={() => toggleSettingsDrawer(false)}
            className="w-6 h-6 flex items-center justify-center text-[#8b949e] hover:text-white hover:bg-[#282c37] rounded-[2px]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Settings Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs text-[#c9d1d9]">
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
              className="w-full accent-[#2a69df] h-1 bg-[#323744] rounded cursor-pointer"
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
              className="w-full accent-[#2a69df] h-1 bg-[#323744] rounded cursor-pointer"
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
  )
}
