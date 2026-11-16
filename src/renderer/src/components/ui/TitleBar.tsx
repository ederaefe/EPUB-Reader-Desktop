import React from 'react'
import { Minus, Square, X, BookOpen } from 'lucide-react'

export const TitleBar: React.FC = () => {
  const handleMinimize = () => window.desktopAPI?.minimize()
  const handleMaximize = () => window.desktopAPI?.maximize()
  const handleClose = () => window.desktopAPI?.close()

  return (
    <header className="app-drag-region h-10 w-full glass-card border-b border-white/5 flex items-center justify-between px-4 z-50">
      <div className="flex items-center gap-2.5">
        <div className="w-5 h-5 rounded-lg bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400">
          <BookOpen className="w-3.5 h-3.5" />
        </div>
        <span className="text-xs font-semibold tracking-wide text-slate-200">
          EPUB Reader Desktop
        </span>
      </div>

      <div className="app-no-drag flex items-center gap-1">
        <button
          onClick={handleMinimize}
          className="btn-press w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          title="Minimize"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleMaximize}
          className="btn-press w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          title="Maximize"
        >
          <Square className="w-3 h-3" />
        </button>
        <button
          onClick={handleClose}
          className="btn-press w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-300 hover:bg-rose-500/20 transition-colors"
          title="Close"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  )
}
