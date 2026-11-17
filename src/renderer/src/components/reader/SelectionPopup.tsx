import React, { useState, useEffect } from 'react'
import {
  Copy,
  FileText,
  Volume2,
  BookMarked,
  Globe,
  Check,
  Underline,
  Search,
  ExternalLink,
  X,
  Languages
} from 'lucide-react'
import {
  DICT_PROVIDERS,
  getDefinitionUrl,
  fetchInlineDefinition,
  fetchWikipediaSummary,
  type InlineDefinition,
  type WikipediaSummary
} from '../../services/dictService'
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
  const [showNoteInput, setShowNoteInput] = useState(false)
  const [noteText, setNoteText] = useState('')

  // Contextual floating modals
  const [showDictModal, setShowDictModal] = useState(false)
  const [dictLoading, setDictLoading] = useState(false)
  const [definition, setDefinition] = useState<InlineDefinition | null>(null)

  const [showWikiModal, setShowWikiModal] = useState(false)
  const [wikiLoading, setWikiLoading] = useState(false)
  const [wikiSummary, setWikiSummary] = useState<WikipediaSummary | null>(null)

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

  const handleLookupDefinition = async () => {
    setShowDictModal(true)
    setDictLoading(true)
    const res = await fetchInlineDefinition(selectedText)
    setDefinition(res)
    setDictLoading(false)
  }

  const handleLookupWikipedia = async () => {
    setShowWikiModal(true)
    setWikiLoading(true)
    const res = await fetchWikipediaSummary(selectedText)
    setWikiSummary(res)
    setWikiLoading(false)
  }

  const handleOpenExternalProvider = (providerName: string) => {
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
      {/* 36px Native Floating Action Bar */}
      <div
        style={{ left: `${position.x}px`, top: `${Math.max(10, position.y - 44)}px` }}
        className="fixed z-50 transform -translate-x-1/2 h-9 bg-[#1c1f26] border border-[#3c404d] rounded-[3px] p-1 flex items-center gap-1 shadow-2xl select-none animate-in fade-in duration-100"
      >
        {/* Copy button */}
        <button
          onClick={handleCopy}
          className="ice-btn-dark px-2 h-7 text-xs flex items-center gap-1 rounded-[2px]"
          title="Copy Text"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-[#8b949e]" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>

        {/* Highlight Colors (1:1 Native Desktop rectangular markers) */}
        <div className="flex items-center gap-1 px-1.5 border-x border-[#2d323f]">
          <button
            onClick={() => onHighlight('blue')}
            className="w-4 h-4 rounded-[2px] border border-black/40 hover:scale-110 transition-transform"
            style={{ backgroundColor: '#aed9f1' }}
            title="Blue Highlight"
          />
          <button
            onClick={() => onHighlight('purple')}
            className="w-4 h-4 rounded-[2px] border border-black/40 hover:scale-110 transition-transform"
            style={{ backgroundColor: '#ccb8e4' }}
            title="Purple Highlight"
          />
          <button
            onClick={() => onHighlight('red')}
            className="w-4 h-4 rounded-[2px] border border-black/40 hover:scale-110 transition-transform"
            style={{ backgroundColor: '#f3a2a2' }}
            title="Red Highlight"
          />
          <button
            onClick={() => onHighlight('yellow')}
            className="w-4 h-4 rounded-[2px] border border-black/40 hover:scale-110 transition-transform"
            style={{ backgroundColor: '#f3e3a2' }}
            title="Yellow Highlight"
          />
          <button
            onClick={() => onHighlight('green')}
            className="w-4 h-4 rounded-[2px] border border-black/40 hover:scale-110 transition-transform"
            style={{ backgroundColor: '#b1f3a4' }}
            title="Green Highlight"
          />
          <button
            onClick={() => onHighlight('underline')}
            className="w-4 h-4 rounded-[2px] border border-[#3c404d] bg-[#282c37] text-white flex items-center justify-center hover:scale-110 transition-transform"
            title="Underline"
          >
            <Underline className="w-2.5 h-2.5" />
          </button>
        </div>

        {/* Note */}
        <button
          onClick={() => setShowNoteInput(true)}
          className="ice-btn-dark px-2 h-7 text-xs flex items-center gap-1 rounded-[2px]"
          title="Add Note"
        >
          <FileText className="w-3.5 h-3.5 text-[#2a69df]" />
          <span>Note</span>
        </button>

        {/* Speak */}
        <button
          onClick={handleSpeak}
          className="ice-btn-dark w-7 h-7 flex items-center justify-center rounded-[2px]"
          title="Read Aloud"
        >
          <Volume2 className="w-3.5 h-3.5 text-[#8b949e]" />
        </button>

        {/* Dictionary Lookup */}
        <button
          onClick={handleLookupDefinition}
          className="ice-btn-dark px-2 h-7 text-xs flex items-center gap-1 rounded-[2px]"
          title="Dictionary definition"
        >
          <BookMarked className="w-3.5 h-3.5 text-[#79c0ff]" />
          <span>Define</span>
        </button>

        {/* Wikipedia Encyclopedic Summary */}
        <button
          onClick={handleLookupWikipedia}
          className="ice-btn-dark px-2 h-7 text-xs flex items-center gap-1 rounded-[2px]"
          title="Wikipedia summary"
        >
          <Globe className="w-3.5 h-3.5 text-[#f59e0b]" />
          <span>Wiki</span>
        </button>

        {/* Translation (Google Translate & DeepL) */}
        <button
          onClick={() => handleOpenExternalProvider('Google Translate')}
          className="ice-btn-dark px-2 h-7 text-xs flex items-center gap-1 rounded-[2px]"
          title="Translate selection (Google Translate / DeepL)"
        >
          <Languages className="w-3.5 h-3.5 text-[#4cd964]" />
          <span>Translate</span>
        </button>
      </div>

      {/* Note input popup */}
      {showNoteInput && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveNote}
            className="bg-[#171a21] border border-[#2d323f] rounded-[3px] p-4 w-96 shadow-2xl space-y-3"
          >
            <div className="text-xs font-semibold text-white">Add Note to Highlight</div>
            <div className="text-[11px] text-[#8b949e] italic line-clamp-2 bg-[#12141a] p-2 rounded-[2px] border border-[#232732]">
              &ldquo;{selectedText}&rdquo;
            </div>
            <textarea
              autoFocus
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Write your note here..."
              rows={3}
              className="ice-input w-full p-2 text-xs rounded-[2px]"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowNoteInput(false)
                  onClose()
                }}
                className="ice-btn-dark px-3 py-1 text-xs rounded-[2px]"
              >
                Cancel
              </button>
              <button type="submit" className="ice-btn-blue px-3 py-1 text-xs rounded-[2px]">
                Save Note
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Feature 2: Inline Contextual Dictionary Modal */}
      {showDictModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-[#171a21] border border-[#2d323f] rounded-[3px] p-4 w-[460px] max-h-[80vh] shadow-2xl flex flex-col text-xs text-[#c9d1d9] space-y-3">
            <div className="flex items-center justify-between border-b border-[#232732] pb-2">
              <div className="flex items-center gap-2">
                <BookMarked className="w-4 h-4 text-[#2a69df]" />
                <span className="text-[13px] font-semibold text-white">Dictionary: {selectedText.slice(0, 30)}</span>
              </div>
              <button
                onClick={() => {
                  setShowDictModal(false)
                  onClose()
                }}
                className="w-5 h-5 flex items-center justify-center text-[#8b949e] hover:text-white hover:bg-[#282c37] rounded-[2px]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 space-y-3">
              {dictLoading ? (
                <div className="py-6 text-center text-[#8b949e]">Looking up definition...</div>
              ) : definition ? (
                <div className="space-y-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-base font-bold text-white">{definition.word}</span>
                    {definition.phonetic && (
                      <span className="text-[11px] font-mono text-[#79c0ff]">{definition.phonetic}</span>
                    )}
                  </div>
                  {definition.meanings.map((m, mi) => (
                    <div key={mi} className="bg-[#12141a] p-2.5 rounded-[2px] border border-[#232732] space-y-1">
                      <span className="text-[11px] font-semibold uppercase text-[#f59e0b] tracking-wider font-mono">
                        {m.partOfSpeech}
                      </span>
                      {m.definitions.map((def, di) => (
                        <div key={di} className="text-[12px] leading-relaxed text-[#d1d7e0] pl-1 border-l border-[#2d323f]">
                          <p>{def.definition}</p>
                          {def.example && (
                            <p className="text-[11px] text-[#8b949e] italic mt-0.5">&ldquo;{def.example}&rdquo;</p>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-4 text-[#8b949e]">
                  No instant offline definition found for &ldquo;{selectedText}&rdquo;. Choose a web dictionary provider below:
                </div>
              )}

              {/* Web Providers List */}
              <div className="pt-2 border-t border-[#232732] space-y-1">
                <div className="text-[10px] text-[#8b949e] uppercase tracking-wider font-mono mb-1">
                  External Dictionaries & Deep Translation
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {DICT_PROVIDERS.map((provider) => (
                    <button
                      key={provider.name}
                      onClick={() => handleOpenExternalProvider(provider.name)}
                      className="px-2.5 py-1.5 bg-[#14161c] hover:bg-[#282c37] border border-[#232732] rounded-[2px] text-xs text-[#c9d1d9] flex items-center justify-between transition-colors"
                    >
                      <span className="truncate">{provider.name}</span>
                      <ExternalLink className="w-3 h-3 text-[#6e7681]" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Feature 2: Encyclopedic Wikipedia Modal */}
      {showWikiModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-[#171a21] border border-[#2d323f] rounded-[3px] p-4 w-[500px] max-h-[80vh] shadow-2xl flex flex-col text-xs text-[#c9d1d9] space-y-3">
            <div className="flex items-center justify-between border-b border-[#232732] pb-2">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-[#f59e0b]" />
                <span className="text-[13px] font-semibold text-white">Wikipedia: {selectedText.slice(0, 30)}</span>
              </div>
              <button
                onClick={() => {
                  setShowWikiModal(false)
                  onClose()
                }}
                className="w-5 h-5 flex items-center justify-center text-[#8b949e] hover:text-white hover:bg-[#282c37] rounded-[2px]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-1">
              {wikiLoading ? (
                <div className="py-8 text-center text-[#8b949e]">Fetching encyclopedic summary...</div>
              ) : wikiSummary ? (
                <div className="space-y-3">
                  <div className="flex gap-3">
                    {wikiSummary.thumbnailUrl && (
                      <img
                        src={wikiSummary.thumbnailUrl}
                        alt=""
                        className="w-20 h-24 object-cover rounded-[2px] border border-[#2d323f] shrink-0"
                      />
                    )}
                    <div className="flex flex-col">
                      <h3 className="text-sm font-bold text-white">{wikiSummary.title}</h3>
                      {wikiSummary.description && (
                        <p className="text-[11px] text-[#79c0ff]">{wikiSummary.description}</p>
                      )}
                    </div>
                  </div>
                  <p className="text-[12px] leading-relaxed text-[#d1d7e0] bg-[#12141a] p-3 rounded-[2px] border border-[#232732]">
                    {wikiSummary.extract}
                  </p>
                  {wikiSummary.contentUrl && (
                    <a
                      href={wikiSummary.contentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-[#79c0ff] hover:underline pt-1"
                    >
                      <span>Read full Wikipedia article</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              ) : (
                <div className="py-6 text-center text-[#8b949e] space-y-2">
                  <p>No instant summary found on Wikipedia for &ldquo;{selectedText}&rdquo;.</p>
                  <button
                    onClick={() => handleOpenExternalProvider('Wikipedia')}
                    className="ice-btn-blue px-3 py-1 rounded-[2px] inline-flex items-center gap-1.5 text-xs"
                  >
                    <span>Search Wikipedia directly</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
