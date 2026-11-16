import React from 'react'
import { Minus, Square, X, BookOpen } from 'lucide-react'
import { useAppStore } from '../../stores/useAppStore'

export const TitleBar: React.FC = () => {
  const { currentView, activeBook, toggleFullSettingsModal } = useAppStore()

  const handleMinimize = () => window.desktopAPI?.minimize()
  const handleMaximize = () => window.desktopAPI?.maximize()
  const handleClose = () => window.desktopAPI?.close()

  return (
    <header className="app-drag-region h-8 w-full bg-[#14161c] border-b border-[#232732] flex items-center justify-between px-3 z-50 select-none">
      {/* Left side */}
      <div className="flex items-center gap-2 min-w-[200px]">
        {currentView === 'reader' && (
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-[2px] bg-[#2a69df] flex items-center justify-center text-white shrink-0">
              <BookOpen className="w-2.5 h-2.5" />
            </div>
            <span className="text-[12px] font-medium text-[#c8d1dc]">
              Ebook Reader
            </span>
          </div>
        )}
      </div>

      {/* Center title in Reader mode */}
      <div className="flex-1 text-center truncate px-4 pointer-events-none">
        {currentView === 'reader' && (
          <span className="text-[12px] text-[#8b949e]">
            {activeBook ? `${activeBook.title}: Prologue: you are here` : 'The Fifth Season: Prologue: you are here'}
          </span>
        )}
      </div>

      {/* Right side controls & badges */}
      <div className="app-no-drag flex items-center h-full gap-2">
        <button
          onClick={() => toggleFullSettingsModal(true)}
          className="bg-[#152e1c] border border-[#235d30] text-[#4cd964] px-2 py-0.5 text-[11px] rounded-[2px] hover:bg-[#1c3d25] transition-colors leading-normal"
          title="Version 6.45 available"
        >
          Update available!
        </button>

        <button
          onClick={() => toggleFullSettingsModal(true)}
          className="bg-[#2a69df] text-white px-3 py-1 text-[11px] font-medium rounded-[2px] hover:bg-[#387bf0] transition-colors leading-normal mr-2"
          title="PRO Unlocked"
        >
          Upgrade to PRO
        </button>

        <div className="flex items-center h-full">
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
      </div>
    </header>
  )
}
