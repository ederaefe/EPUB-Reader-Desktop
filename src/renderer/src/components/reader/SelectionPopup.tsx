import React, { useState } from 'react'
import { Copy, Highlighter, MessageSquare, Volume2, Globe, Check } from 'lucide-react'
import { DICT_PROVIDERS, getDefinitionUrl } from '../../services/dictService'
import { ttsService } from '../../services/ttsService'

interface SelectionPopupProps {
  selectedText: string
  position: { x: number; y: number }
  onClose: () => void
  onHighlight: (color: 'yellow' | 'green' | 'blue' | 'pink' | 'purple') => void
  onAddNote: (note: string) => void
}

export const SelectionPopup: React.FC<SelectionPopupProps> = ({
  selectedText,
  position,
  onClose,
  onHighlight,
  onAddNote
}) => {
  const [copied, setCopied] = useState(false)
  const [showDictModal, setShowDictModal] = useState(false)
  const [showNoteInput, setShowNoteInput] = useState(false)
  const [noteText, setNoteText] = useState('')

  const handleCopy = () => {
    navigator.clipboard.writeText(selectedText)
    setCopied(true)
    setTimeout(() => {
      setCopied(false)
      onClose()
    }, 800)
  }

  const handleSpeak = () => {
    ttsService.speak(selectedText)
    onClose()
  }

  const handleOpenDict = (providerName: string) => {
    const url = getDefinitionUrl(providerName, selectedText)
    window.open(url, '_blank')
    setShowDictModal(false)
    onClose()
  }

  const handleSaveNote = (e: React.FormEvent) => {
    e.preventDefault()
    if (!noteText.trim()) return
    onAddNote(noteText.trim())
    setShowNoteInput(false)
    onClose()
  }

  return (
    <>
      <div
        style={{ left: `${position.x}px`, top: `${position.y - 48}px` }}
        className="fixed z-50 transform -translate-x-1/2 glass-card rounded-full p-1.5 flex items-center gap-1.5 shadow-2xl border border-white/15 select-none animate-fade-in"
      >
        <button
          onClick={handleCopy}
          className="btn-press px-2.5 py-1 rounded-full text-xs font-medium text-slate-200 hover:text-white hover:bg-white/10 flex items-center gap-1 transition-colors"
          title="Copy Text"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>

        {/* Highlights */}
        <div className="flex items-center gap-1 px-1 border-x border-white/10">
          <button
            onClick={() => onHighlight('yellow')}
            className="w-4 h-4 rounded-full bg-amber-400/80 hover:scale-125 transition-transform"
            title="Yellow Highlight"
          />
          <button
            onClick={() => onHighlight('green')}
            className="w-4 h-4 rounded-full bg-emerald-400/80 hover:scale-125 transition-transform"
            title="Green Highlight"
          />
          <button
            onClick={() => onHighlight('blue')}
            className="w-4 h-4 rounded-full bg-blue-400/80 hover:scale-125 transition-transform"
            title="Blue Highlight"
          />
          <button
            onClick={() => onHighlight('pink')}
            className="w-4 h-4 rounded-full bg-pink-400/80 hover:scale-125 transition-transform"
            title="Pink Highlight"
          />
        </div>

        {/* Note */}
        <button
          onClick={() => setShowNoteInput(true)}
          className="btn-press px-2 py-1 rounded-full text-xs font-medium text-slate-200 hover:text-white hover:bg-white/10 flex items-center gap-1"
          title="Add Note"
        >
          <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
          <span>Note</span>
        </button>

        {/* Speak */}
        <button
          onClick={handleSpeak}
          className="btn-press px-2 py-1 rounded-full text-xs font-medium text-slate-200 hover:text-white hover:bg-white/10 flex items-center gap-1"
          title="Speak Selection"
        >
          <Volume2 className="w-3.5 h-3.5 text-purple-400" />
          <span>Speak</span>
        </button>

        {/* Define */}
        <button
          onClick={() => setShowDictModal(true)}
          className="btn-press px-2.5 py-1 rounded-full text-xs font-medium text-cyan-300 hover:bg-cyan-500/20 flex items-center gap-1"
          title="Web Dictionary Lookup"
        >
          <Globe className="w-3.5 h-3.5 text-cyan-400" />
          <span>Define</span>
        </button>
      </div>

      {/* Note input dialog */}
      {showNoteInput && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleSaveNote} className="glass-panel rounded-2xl p-5 w-full max-w-sm space-y-4">
            <h3 className="text-sm font-bold text-white">Add Note to Selection</h3>
            <p className="text-xs text-slate-400 italic line-clamp-2">"{selectedText}"</p>
            <textarea
              autoFocus
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Write your note here..."
              className="w-full h-24 bg-white/5 border border-white/10 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-400"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNoteInput(false)}
                className="btn-press px-3 py-1.5 rounded-xl bg-white/5 text-xs text-slate-400"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-press px-4 py-1.5 rounded-xl bg-blue-600 text-xs font-bold text-white shadow-md"
              >
                Save Note
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Dictionary Modal */}
      {showDictModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel rounded-3xl p-6 w-full max-w-md space-y-4 shadow-2xl border border-white/15">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Globe className="w-4 h-4 text-cyan-400" />
                Dictionary & Translation Matrix
              </h3>
              <button
                onClick={() => setShowDictModal(false)}
                className="btn-press p-1 text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Lookup <span className="font-semibold text-cyan-300">"{selectedText}"</span> in:
            </p>

            <div className="grid grid-cols-2 gap-2">
              {DICT_PROVIDERS.map((provider) => (
                <button
                  key={provider.name}
                  onClick={() => handleOpenDict(provider.name)}
                  className="btn-press p-2.5 rounded-xl glass-card text-left text-xs font-medium text-slate-200 hover:text-white hover:border-cyan-400/40 transition-colors truncate"
                >
                  {provider.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
