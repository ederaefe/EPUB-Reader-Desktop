import React, { useEffect } from 'react'
import { X, Keyboard } from 'lucide-react'
import { useAppStore } from '../../stores/useAppStore'

export const HelpModal: React.FC = () => {
  const { isHelpModalOpen, toggleHelpModal } = useAppStore()

  useEffect(() => {
    if (!isHelpModalOpen) return
    const onKey = (e: KeyboardEvent) => {
      const isBack =
        e.key === 'Escape' ||
        (e.altKey && !e.ctrlKey && !e.metaKey && e.key === 'ArrowLeft')
      if (isBack) {
        e.preventDefault()
        e.stopPropagation()
        toggleHelpModal(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isHelpModalOpen, toggleHelpModal])

  if (!isHelpModalOpen) return null

  const shortcuts = [
    { key: 'Alt + Left / Esc', desc: 'Back to Library / Close modal / drawer' },
    { key: 'Alt + Right', desc: 'Navigate forward / next page' },
    { key: 'Ctrl + Z', desc: 'Undo annotation or bookmark' },
    { key: 'Ctrl + Y / Ctrl+Shift+Z', desc: 'Redo annotation or bookmark' },
    { key: 'Ctrl + B / Ctrl + D', desc: 'Bookmark current page' },
    { key: 'Ctrl + = / +', desc: 'Zoom in / Increase font size' },
    { key: 'Ctrl + - / -', desc: 'Zoom out / Decrease font size' },
    { key: 'Ctrl + 0 / 0', desc: 'Reset zoom / font size' },
    { key: 'Ctrl + / / ?', desc: 'Toggle hotkeys & navigation help' },
    { key: 'Ctrl + F / /', desc: 'Search book text or library' },
    { key: 'Ctrl + O', desc: 'Open book file' },
    { key: 'Up / Left / PgUp / k', desc: 'Previous page (or scroll up)' },
    { key: 'Down / Right / PgDn / j / Space', desc: 'Next page (or scroll down)' },
    { key: 'Home / End', desc: 'First / Last page of chapter' },
    { key: 'F7 / F8', desc: 'Play / Stop reading aloud (TTS)' },
    { key: 'F9', desc: 'Cycle theme (Day / Night / Sepia)' },
    { key: 'F10 / r', desc: 'Toggle single / dual page layout' },
    { key: 'F11', desc: 'Toggle fullscreen distraction-free' }
  ]

  return (
    <div
      onClick={() => toggleHelpModal(false)}
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[#1c1f26] border border-[#2d323f] rounded-lg w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100"
      >
        {/* Header */}
        <div className="h-10 bg-[#171a21] border-b border-[#2b2f3a] px-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <Keyboard className="w-4 h-4 text-[#2a69df]" />
            <span className="text-[13px] font-semibold">Hotkeys & Navigation</span>
          </div>
          <button
            onClick={() => toggleHelpModal(false)}
            className="w-6 h-6 flex items-center justify-center text-[#8b949e] hover:text-white hover:bg-[#282c37] rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 max-h-[70vh] overflow-y-auto space-y-2 text-[12px]">
          {shortcuts.map((sc, i) => (
            <div
              key={i}
              className="flex items-center justify-between py-1.5 px-2 bg-[#232732] border border-[#2d323f] rounded"
            >
              <span className="font-mono text-[#79c0ff] bg-[#171a21] px-2 py-0.5 rounded border border-[#30363d] text-[11px]">
                {sc.key}
              </span>
              <span className="text-[#c9d1d9]">{sc.desc}</span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="h-10 bg-[#171a21] border-t border-[#2b2f3a] px-4 flex items-center justify-end">
          <button
            onClick={() => toggleHelpModal(false)}
            className="ice-btn-blue px-4 py-1 text-xs"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  )
}
