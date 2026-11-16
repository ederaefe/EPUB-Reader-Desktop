import React from 'react'
import { X, Columns, Square, AlignJustify, Minus, Plus } from 'lucide-react'
import { useAppStore } from '../../stores/useAppStore'

export const SettingsDrawer: React.FC = () => {
  const { isSettingsDrawerOpen, toggleSettingsDrawer, settings, updateSettings } = useAppStore()

  if (!isSettingsDrawerOpen) return null

  const handleLineSpacingChange = (delta: number) => {
    const next = Math.max(1.0, Math.min(2.5, Number((settings.lineHeight + delta).toFixed(1))))
    updateSettings({ lineHeight: next })
  }

  return (
    <aside className="fixed inset-y-0 right-0 w-80 bg-[#171a21] border-l border-[#232732] z-50 flex flex-col justify-between shadow-2xl select-none animate-in slide-in-from-right duration-150">
      <div className="flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="h-10 bg-[#14161c] border-b border-[#232732] px-3 flex items-center justify-between">
          <span className="text-[13px] font-semibold text-white">Settings</span>
          <button
            onClick={() => toggleSettingsDrawer(false)}
            className="w-6 h-6 flex items-center justify-center text-[#8b949e] hover:text-white hover:bg-[#282c37] rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Settings Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs text-[#c9d1d9]">
          {/* 1. Theme Tiles (4 in a row, matching Icecream rec_05.jpg) */}
          <div>
            <label className="text-[11px] font-medium text-[#8b949e] block mb-2">
              Color profile
            </label>
            <div className="grid grid-cols-4 gap-2">
              {/* Day */}
              <button
                onClick={() => updateSettings({ theme: 'day' })}
                className={`h-14 rounded flex flex-col items-center justify-center gap-1 border transition-all ${
                  settings.theme === 'day'
                    ? 'border-[#2a69df] bg-white ring-1 ring-[#2a69df]'
                    : 'border-[#3c404d] bg-white/90 hover:bg-white'
                }`}
              >
                <span className="text-sm font-serif font-bold text-[#111111]">A</span>
                <span className="text-[10px] text-[#444444] font-medium">Day</span>
              </button>

              {/* Night */}
              <button
                onClick={() => updateSettings({ theme: 'night' })}
                className={`h-14 rounded flex flex-col items-center justify-center gap-1 border transition-all ${
                  settings.theme === 'night'
                    ? 'border-[#2a69df] bg-[#1c1f26] ring-1 ring-[#2a69df]'
                    : 'border-[#3c404d] bg-[#1c1f26] hover:bg-[#232732]'
                }`}
              >
                <span className="text-sm font-serif font-bold text-white">A</span>
                <span className="text-[10px] text-[#8b949e] font-medium">Night</span>
              </button>

              {/* Light Sepia */}
              <button
                onClick={() => updateSettings({ theme: 'light-sepia' })}
                className={`h-14 rounded flex flex-col items-center justify-center gap-1 border transition-all ${
                  settings.theme === 'light-sepia'
                    ? 'border-[#2a69df] bg-[#fbf0d9] ring-1 ring-[#2a69df]'
                    : 'border-[#3c404d] bg-[#f5e7c8] hover:bg-[#fbf0d9]'
                }`}
              >
                <span className="text-sm font-serif font-bold text-[#5f4b32]">A</span>
                <span className="text-[10px] text-[#5f4b32] font-medium">Sepia</span>
              </button>

              {/* Dark Sepia */}
              <button
                onClick={() => updateSettings({ theme: 'dark-sepia' })}
                className={`h-14 rounded flex flex-col items-center justify-center gap-1 border transition-all ${
                  settings.theme === 'dark-sepia'
                    ? 'border-[#2a69df] bg-[#2d261e] ring-1 ring-[#2a69df]'
                    : 'border-[#3c404d] bg-[#201c18] hover:bg-[#2d261e]'
                }`}
              >
                <span className="text-sm font-serif font-bold text-[#d5c7b3]">A</span>
                <span className="text-[10px] text-[#d5c7b3] font-medium">D-Sepia</span>
              </button>
            </div>
          </div>

          {/* 2. Dimming Slider */}
          <div>
            <div className="flex items-center justify-between text-[11px] text-[#8b949e] mb-1.5">
              <span>Dimming</span>
              <span className="font-mono text-white">{settings.dimming}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="75"
              value={settings.dimming}
              onChange={(e) => updateSettings({ dimming: Number(e.target.value) })}
              className="w-full accent-[#2a69df] h-1.5 bg-[#232732] rounded cursor-pointer"
            />
          </div>

          <div className="h-px bg-[#232732]" />

          {/* 3. Page view (Single vs Double, 1:1 Icecream rec_05.jpg) */}
          <div>
            <label className="text-[11px] font-medium text-[#8b949e] block mb-2">
              Page view
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => updateSettings({ pageSpread: 'double' })}
                className={`h-8 rounded flex items-center justify-center gap-2 border text-xs font-medium transition-colors ${
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
                className={`h-8 rounded flex items-center justify-center gap-2 border text-xs font-medium transition-colors ${
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

          <div className="h-px bg-[#232732]" />

          {/* 4. Text Font Dropdown (rec_05.jpg shows 'Original font') */}
          <div>
            <label className="text-[11px] font-medium text-[#8b949e] block mb-1.5">
              Text font
            </label>
            <select
              value={settings.fontFamily}
              onChange={(e) => updateSettings({ fontFamily: e.target.value as any })}
              className="ice-input w-full h-8 px-2 text-xs bg-[#12141a] border-[#2d323f] text-white rounded cursor-pointer"
            >
              <option value="original">Original font</option>
              <option value="sans-serif">Segoe UI (Sans)</option>
              <option value="serif">Georgia (Serif)</option>
              <option value="monospace">Consolas (Monospace)</option>
            </select>
          </div>

          {/* 5. Font size Slider (rec_05.jpg shows 21px) */}
          <div>
            <div className="flex items-center justify-between text-[11px] text-[#8b949e] mb-1.5">
              <span>Font size</span>
              <span className="font-mono text-white">{settings.fontSize}px</span>
            </div>
            <input
              type="range"
              min="12"
              max="42"
              step="1"
              value={settings.fontSize}
              onChange={(e) => updateSettings({ fontSize: Number(e.target.value) })}
              className="w-full accent-[#2a69df] h-1.5 bg-[#232732] rounded cursor-pointer"
            />
          </div>

          {/* 6. Line Spacing buttons */}
          <div>
            <div className="flex items-center justify-between text-[11px] text-[#8b949e] mb-1.5">
              <span>Line spacing</span>
              <span className="font-mono text-white">{Math.round(settings.lineHeight * 100)}%</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleLineSpacingChange(-0.1)}
                className="ice-btn-dark flex-1 h-8 gap-1.5 text-xs"
                title="Decrease line spacing"
              >
                <Minus className="w-3.5 h-3.5" />
                <span>Decrease</span>
              </button>
              <button
                onClick={() => handleLineSpacingChange(0.1)}
                className="ice-btn-dark flex-1 h-8 gap-1.5 text-xs"
                title="Increase line spacing"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Increase</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}
