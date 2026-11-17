import React from 'react'
import { Minus, Square, X } from 'lucide-react'
import { useAppStore } from '../../stores/useAppStore'
import semplyLogo from '../../assets/icons/semply_logo.png'

export const TitleBar: React.FC = () => {
  const { currentView, activeBook, currentChapterTitle } = useAppStore()

  const handleMinimize = () => window.desktopAPI?.minimize()
  const handleMaximize = () => window.desktopAPI?.maximize()
  const handleClose = () => window.desktopAPI?.close()

  return (
    <header className="app-drag-region h-8 w-full bg-[#14161c] border-b border-[#232732] flex items-center justify-between px-3 z-50 select-none">
      {/* Left side */}
      <div className="flex items-center gap-2 min-w-[200px]">
        <div className="flex items-center gap-2">
          <img
            src={semplyLogo}
            alt="Semply Ebook Reader"
            className="w-4 h-4 rounded-[2px] object-cover shrink-0"
          />
          <span className="text-[12px] font-medium text-[#c8d1dc]">
            Semply Ebook Reader
          </span>
        </div>
      </div>

      {/* Center title in Reader mode */}
      <div className="flex-1 text-center truncate px-4 pointer-events-none">
        {currentView === 'reader' && activeBook && (
          <span className="text-[12px] text-[#8b949e]">
            {activeBook.title}{currentChapterTitle ? `: ${currentChapterTitle}` : ''}
          </span>
        )}
      </div>

      {/* Right side window controls */}
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
