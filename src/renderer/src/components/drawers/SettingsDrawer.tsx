import React from 'react'
import { X, Sun, Moon, Coffee, Sliders, Type, Volume2, MoveDown } from 'lucide-react'
import { useAppStore } from '../../stores/useAppStore'

export const SettingsDrawer: React.FC = () => {
  const { isSettingsDrawerOpen, toggleSettingsDrawer, settings, updateSettings } = useAppStore()

  if (!isSettingsDrawerOpen) return null

  return (
    <aside className="fixed inset-y-0 right-0 w-84 glass-panel rounded-drawer p-5 z-50 flex flex-col justify-between shadow-2xl border-l border-white/10 overflow-y-auto animate-slide-in select-none">
      <div className="space-y-6">
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-blue-400" />
            <h2 className="text-sm font-bold text-white tracking-wide">Reading Settings</h2>
          </div>
          <button
            onClick={() => toggleSettingsDrawer(false)}
            className="btn-press p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Themes (Day, Night, Light Sepia, Dark Sepia) */}
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
            Color Themes
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => updateSettings({ theme: 'day' })}
              className={`btn-press p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                settings.theme === 'day'
                  ? 'bg-amber-100 text-stone-900 border-amber-400 shadow-md'
                  : 'bg-stone-200/90 text-stone-800 border-transparent hover:bg-stone-100'
              }`}
            >
              <Sun className="w-3.5 h-3.5 text-amber-600" />
              Day
            </button>

            <button
              onClick={() => updateSettings({ theme: 'night' })}
              className={`btn-press p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                settings.theme === 'night'
                  ? 'bg-blue-600 text-white border-blue-400 shadow-md'
                  : 'bg-[#121620] text-slate-300 border-white/10 hover:bg-[#1a202c]'
              }`}
            >
              <Moon className="w-3.5 h-3.5 text-blue-300" />
              Night
            </button>

            <button
              onClick={() => updateSettings({ theme: 'light-sepia' })}
              className={`btn-press p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                settings.theme === 'light-sepia'
                  ? 'bg-[#fbf0d9] text-[#5f4b32] border-[#bda078] shadow-md'
                  : 'bg-[#f5e7c8] text-[#5f4b32] border-transparent hover:bg-[#faeed6]'
              }`}
            >
              <Coffee className="w-3.5 h-3.5 text-[#886944]" />
              Light Sepia
            </button>

            <button
              onClick={() => updateSettings({ theme: 'dark-sepia' })}
              className={`btn-press p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                settings.theme === 'dark-sepia'
                  ? 'bg-[#2b2621] text-[#d5c7b3] border-[#7d674c] shadow-md'
                  : 'bg-[#201c18] text-[#a89984] border-white/5 hover:bg-[#2b2621]'
              }`}
            >
              <Coffee className="w-3.5 h-3.5 text-[#b09673]" />
              Dark Sepia
            </button>
          </div>
        </div>

        {/* Dimming Slider */}
        <div>
          <div className="flex items-center justify-between text-xs text-slate-300 mb-1.5">
            <span>Dimming Overlay</span>
            <span className="font-semibold text-blue-400">{settings.dimming}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="70"
            value={settings.dimming}
            onChange={(e) => updateSettings({ dimming: Number(e.target.value) })}
            className="w-full accent-blue-500 cursor-pointer"
          />
        </div>

        {/* Page Spread (Single vs Double) */}
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
            Page Layout
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => updateSettings({ pageSpread: 'single' })}
              className={`btn-press p-2 rounded-xl text-xs font-semibold border transition-all ${
                settings.pageSpread === 'single'
                  ? 'bg-blue-600/30 text-blue-300 border-blue-400/40'
                  : 'bg-white/5 text-slate-400 border-transparent hover:bg-white/10'
              }`}
            >
              Single Page
            </button>
            <button
              onClick={() => updateSettings({ pageSpread: 'double' })}
              className={`btn-press p-2 rounded-xl text-xs font-semibold border transition-all ${
                settings.pageSpread === 'double'
                  ? 'bg-blue-600/30 text-blue-300 border-blue-400/40'
                  : 'bg-white/5 text-slate-400 border-transparent hover:bg-white/10'
              }`}
            >
              Double Spread
            </button>
          </div>
        </div>

        {/* Typography */}
        <div className="space-y-3">
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
            Typography
          </label>

          {/* Font Family */}
          <div className="grid grid-cols-3 gap-1.5 text-xs">
            {(['serif', 'sans-serif', 'monospace'] as const).map((font) => (
              <button
                key={font}
                onClick={() => updateSettings({ fontFamily: font })}
                className={`btn-press p-2 rounded-xl border capitalize font-medium transition-all ${
                  settings.fontFamily === font
                    ? 'bg-blue-600/30 text-blue-300 border-blue-400/40'
                    : 'bg-white/5 text-slate-400 border-transparent hover:bg-white/10'
                }`}
              >
                {font === 'sans-serif' ? 'Sans' : font}
              </button>
            ))}
          </div>

          {/* Font Size */}
          <div>
            <div className="flex items-center justify-between text-xs text-slate-300 mb-1.5">
              <span>Font Size</span>
              <span className="font-semibold text-blue-400">{settings.fontSize}px</span>
            </div>
            <input
              type="range"
              min="12"
              max="36"
              value={settings.fontSize}
              onChange={(e) => updateSettings({ fontSize: Number(e.target.value) })}
              className="w-full accent-blue-500 cursor-pointer"
            />
          </div>

          {/* Line Height */}
          <div>
            <div className="flex items-center justify-between text-xs text-slate-300 mb-1.5">
              <span>Line Spacing</span>
              <span className="font-semibold text-blue-400">{settings.lineHeight.toFixed(1)}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => updateSettings({ lineHeight: Math.max(1.1, settings.lineHeight - 0.1) })}
                className="btn-press flex-1 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-slate-300"
              >
                Decrease
              </button>
              <button
                onClick={() => updateSettings({ lineHeight: Math.min(2.5, settings.lineHeight + 0.1) })}
                className="btn-press flex-1 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-slate-300"
              >
                Increase
              </button>
            </div>
          </div>
        </div>

        {/* TTS & Autoscroll Controls */}
        <div className="space-y-3 pt-3 border-t border-white/10">
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
            Speech & Autoscroll
          </label>

          {/* TTS Speed */}
          <div>
            <div className="flex items-center justify-between text-xs text-slate-300 mb-1.5">
              <span className="flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5 text-purple-400" />
                TTS Speed
              </span>
              <span className="font-semibold text-purple-400">{settings.ttsSpeed.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="2.5"
              step="0.1"
              value={settings.ttsSpeed}
              onChange={(e) => updateSettings({ ttsSpeed: Number(e.target.value) })}
              className="w-full accent-purple-500 cursor-pointer"
            />
          </div>

          {/* Autoscroll Speed */}
          <div>
            <div className="flex items-center justify-between text-xs text-slate-300 mb-1.5">
              <span className="flex items-center gap-1.5">
                <MoveDown className="w-3.5 h-3.5 text-cyan-400" />
                Autoscroll Velocity
              </span>
              <span className="font-semibold text-cyan-400">{settings.autoscrollSpeed} px/s</span>
            </div>
            <input
              type="range"
              min="10"
              max="150"
              step="5"
              value={settings.autoscrollSpeed}
              onChange={(e) => updateSettings({ autoscrollSpeed: Number(e.target.value) })}
              className="w-full accent-cyan-500 cursor-pointer"
            />
          </div>
        </div>
      </div>
    </aside>
  )
}
