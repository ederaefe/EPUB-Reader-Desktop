import React, { useState } from 'react'
import { Copy, FileText, Volume2, Globe, Check, Underline } from 'lucide-react'
import { DICT_PROVIDERS, getDefinitionUrl } from '../../services/dictService'
import { ttsService } from '../../services/ttsService'

interface SelectionPopupProps {
  selectedText: string
  position: { x: number; y: number }
  onClose: () => void
  onHighlight: (color: 'blue' | 'purple' | 'red' | 'yellow' | 'green' | 'underline') => void
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
    }, 700)
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
        style={{ left: `${position.x}px`, top: `${Math.max(10, position.y - 44)}px` }}
        className="fixed z-50 transform -translate-x-1/2 bg-[#1c1f26] border border-[#3c404d] rounded p-1 flex items-center gap-1 shadow-2xl select-none animate-in fade-in duration-100"
      >
        <button
          onClick={handleCopy}
          className="ice-btn-dark px-2 py-1 text-xs gap-1"
          title="Copy Text"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-[#8b949e]" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>

        {/* Icecream Highlight Colors */}
        <div className="flex items-center gap-1 px-1.5 border-x border-[#2d323f]">
          {/* Blue */}
          <button
            onClick={() => onHighlight('blue')}
            className="w-4 h-4 rounded-sm border border-black/40 hover:scale-110 transition-transform"
            style={{ backgroundColor: '#aed9f1' }}
            title="Blue Highlight"
          />
          {/* Purple */}
          <button
            onClick={() => onHighlight('purple')}
            className="w-4 h-4 rounded-sm border border-black/40 hover:scale-110 transition-transform"
            style={{ backgroundColor: '#ccb8e4' }}
            title="Purple Highlight"
          />
          {/* Red */}
          <button
            onClick={() => onHighlight('red')}
            className="w-4 h-4 rounded-sm border border-black/40 hover:scale-110 transition-transform"
            style={{ backgroundColor: '#f3a2a2' }}
            title="Red Highlight"
          />
          {/* Yellow */}
          <button
            onClick={() => onHighlight('yellow')}
            className="w-4 h-4 rounded-sm border border-black/40 hover:scale-110 transition-transform"
            style={{ backgroundColor: '#f3e3a2' }}
            title="Yellow Highlight"
          />
          {/* Green */}
          <button
            onClick={() => onHighlight('green')}
            className="w-4 h-4 rounded-sm border border-black/40 hover:scale-110 transition-transform"
            style={{ backgroundColor: '#b1f3a4' }}
            title="Green Highlight"
          />
          {/* Underline */}
          <button
            onClick={() => onHighlight('underline')}
            className="w-4 h-4 rounded-sm border border-[#3c404d] bg-[#282c37] text-white flex items-center justify-center hover:scale-110 transition-transform"
            title="Underline text"
          >
            <Underline className="w-2.5 h-2.5" />
          </button>
        </div>

        {/* Note */}
        <button
          onClick={() => setShowNoteInput(true)}
          className="ice-btn-dark px-2 py-1 text-xs gap-1"
          title="Add Note"
        >
          <FileText className="w-3.5 h-3.5 text-[#2a69df]" />
          <span>Note</span>
        </button>

        {/* Speak */}
        <button
          onClick={handleSpeak}
          className="ice-btn-dark p-1"
          title="Read Aloud this text"
        >
          <Volume2 className="w-3.5 h-3.5 text-[#8b949e]" />
        </button>

        {/* Web Dictionary */}
        <button
          onClick={() => setShowDictModal(true)}
          className="ice-btn-dark p-1"
          title="Lookup in Dictionary"
        >
          <Globe className="w-3.5 h-3.5 text-[#8b949e]" />
        </button>
      </div>

      {/* Note input popup */}
      {showNoteInput && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveNote}
            className="bg-[#1c1f26] border border-[#3c404d] rounded p-4 w-96 shadow-2xl space-y-3"
          >
            <div className="text-xs font-semibold text-white">Add Note to Highlight</div>
            <div className="text-[11px] text-[#8b949e] italic line-clamp-2 bg-[#12141a] p-2 rounded border border-[#2d323f]">
              "{selectedText}"
            </div>
            <textarea
              autoFocus
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Write your note here..."
              rows={3}
              className="ice-input w-full p-2 text-xs"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowNoteInput(false)
                  onClose()
                }}
                className="ice-btn-dark px-3 py-1 text-xs"
              >
                Cancel
              </button>
              <button type="submit" className="ice-btn-blue px-3 py-1 text-xs">
                Save Note
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Contextual Dictionary Modal */}
      {showDictModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-[#1c1f26] border border-[#3c404d] rounded p-4 w-80 shadow-2xl space-y-3">
            <div className="text-xs font-semibold text-white">Lookup "{selectedText.slice(0, 24)}..."</div>
            <div className="space-y-1">
              {DICT_PROVIDERS.map((provider) => (
                <button
                  key={provider.name}
                  onClick={() => handleOpenDict(provider.name)}
                  className="w-full text-left px-3 py-2 bg-[#232732] hover:bg-[#282c37] border border-[#2d323f] rounded text-xs text-[#c9d1d9] flex items-center justify-between"
                >
                  <span>{provider.name}</span>
                  <span className="text-[10px] text-[#8b949e]">Open &rarr;</span>
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                setShowDictModal(false)
                onClose()
              }}
              className="ice-btn-dark w-full py-1 text-xs"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  )
}
