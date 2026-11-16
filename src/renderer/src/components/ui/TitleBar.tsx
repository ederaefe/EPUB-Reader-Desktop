import React from 'react'
import { Minus, Square, X, BookOpen } from 'lucide-react'

export const TitleBar: React.FC = () => {
  const handleMinimize = () => window.desktopAPI?.minimize()
  const handleMaximize = () => window.desktopAPI?.maximize()
  const handleClose = () => window.desktopAPI?.close()

  return (
    <header className="app-drag-region h-8 w-full bg-[#14161c] border-b border-[#232732] flex items-center justify-between px-3 z-50 select-none">
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 rounded-sm bg-[#2a69df] flex items-center justify-center text-white">
          <BookOpen className="w-2.5 h-2.5" />
        </div>
        <span className="text-[12px] font-medium text-[#c8d1dc]">
          Icecream Ebook Reader
        </span>
      </div>

      <div className="app-no-drag flex items-center h-full">
        <button
          onClick={handleMinimize}
          className="w-10 h-full flex items-center justify-center text-[#8b949e] hover:text-white hover:bg-[#282c37] transition-colors"
          title="Minimize"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleMaximize}
          className="w-10 h-full flex items-center justify-center text-[#8b949e] hover:text-white hover:bg-[#282c37] transition-colors"
          title="Maximize"
        >
          <Square className="w-3 h-3" />
        </button>
        <button
          onClick={handleClose}
          className="w-10 h-full flex items-center justify-center text-[#8b949e] hover:text-white hover:bg-[#c42b1c] transition-colors"
          title="Close"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  )
}
