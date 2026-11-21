import React, { useEffect, useState } from 'react'
import { Minus, Square, Copy, X } from 'lucide-react'
import { useAppStore } from '../../stores/useAppStore'
import semplyLogo from '../../assets/icons/semply_logo.png'

export const TitleBar: React.FC = () => {
  const { currentView, activeBook, currentChapterTitle } = useAppStore()
  const [isMaximized, setIsMaximized] = useState(false)
  const [isFocused, setIsFocused] = useState(true)

  useEffect(() => {
    window.desktopAPI?.isMaximized?.().then((max) => setIsMaximized(!!max)).catch(() => {})
    const unsubMax = window.desktopAPI?.onWindowMaximizedChange?.((max) => setIsMaximized(max))
    const unsubFocus = window.desktopAPI?.onWindowFocusChange?.((focused) => setIsFocused(focused))
    return () => {
      unsubMax?.()
      unsubFocus?.()
    }
  }, [])

  const handleMinimize = () => window.desktopAPI?.minimize()
  const handleMaximize = () => window.desktopAPI?.maximize()
  const handleClose = () => window.desktopAPI?.close()

  return (
    <header className="app-drag-region h-8 w-full bg-[#0a0a0a] border-b border-white/[0.07] flex items-center justify-between px-3 z-50 select-none">
      {/* Left side */}
      <div className={`flex items-center gap-2 min-w-[240px] transition-opacity duration-150 ${isFocused ? 'opacity-100' : 'opacity-45'}`}>
        <div className="flex items-center gap-2">
          <img
            src={semplyLogo}
            alt="Semply Ebook Reader"
            draggable={false}
            className="w-4 h-4 rounded-[4px] object-cover shrink-0"
          />
          <span className="text-[12px] font-medium tracking-[-0.01em] text-[#d4d4d4]">
            Semply
          </span>
          <span className="text-[9.5px] font-mono px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-400/90 border border-amber-500/30 uppercase tracking-wider font-semibold">
            Beta
          </span>
          <a
            href="https://efedera.me"
            target="_blank"
            rel="noopener noreferrer"
            className="app-no-drag text-[10px] text-[#777777] hover:text-[#d4d4d4] transition-colors font-normal tracking-normal hidden sm:inline"
            title="efedera.me"
          >
            by Efedera
          </a>
        </div>
      </div>

      {/* Center title in Reader mode */}
      <div className={`flex-1 text-center truncate px-4 pointer-events-none transition-opacity duration-150 ${isFocused ? 'opacity-100' : 'opacity-45'}`}>
        {currentView === 'reader' && activeBook && (
          <span className="text-[11px] text-[#777777]">
            {activeBook.title}{currentChapterTitle ? ` — ${currentChapterTitle}` : ''}
          </span>
        )}
      </div>

      {/* Right side native window controls */}
      <div className={`app-no-drag flex items-center h-full transition-opacity duration-150 ${isFocused ? 'opacity-100' : 'opacity-50'}`}>
        <button
          onClick={handleMinimize}
          className="w-10 h-full flex items-center justify-center text-[#777777] hover:text-white hover:bg-white/[0.06] transition-colors"
          title="Minimize"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleMaximize}
          className="w-10 h-full flex items-center justify-center text-[#777777] hover:text-white hover:bg-white/[0.06] transition-colors"
          title={isMaximized ? 'Restore Down' : 'Maximize'}
        >
          {isMaximized ? (
            <Copy className="w-3 h-3 -scale-x-100" />
          ) : (
            <Square className="w-3 h-3" />
          )}
        </button>
        <button
          onClick={handleClose}
          className="w-10 h-full flex items-center justify-center text-[#777777] hover:text-white hover:bg-[#e5484d] transition-colors"
          title="Close"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  )
}
