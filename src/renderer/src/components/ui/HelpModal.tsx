import React, { useEffect } from 'react'
import { X, Keyboard } from 'lucide-react'
import { useAppStore } from '../../stores/useAppStore'

export const HelpModal: React.FC = () => {
  const { isHelpModalOpen, toggleHelpModal } = useAppStore()

  useEffect(() => {
    if (!isHelpModalOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') toggleHelpModal(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isHelpModalOpen, toggleHelpModal])

  if (!isHelpModalOpen) return null

  const shortcuts = [
    { key: 'Up / Left / Page Up / Backspace', desc: 'Previous page (or scroll up)' },
    { key: 'Down / Right / Page Down / Space', desc: 'Next page (or scroll down)' },
    { key: 'Home', desc: 'First page of chapter' },
    { key: 'End', desc: 'Last page of chapter' },
    { key: 'F7', desc: 'Play / Pause Read Aloud (TTS)' },
    { key: 'F8', desc: 'Stop Read Aloud' },
    { key: 'F9', desc: 'Cycle theme (Day / Night / Sepia)' },
    { key: 'F10', desc: 'Toggle Single / Double page spread' },
    { key: 'F11', desc: 'Toggle Fullscreen distraction-free' },
    { key: 'Ctrl + B', desc: 'Add bookmark on current page' },
    { key: 'Ctrl + F', desc: 'Search text in book' },
    { key: 'Ctrl + O', desc: 'Open book or import folder' },
    { key: 'Alt + X', desc: 'Back to Library' },
    { key: 'Esc', desc: 'Exit fullscreen / Close open drawers' }
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
