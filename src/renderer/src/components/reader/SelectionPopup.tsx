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
import type { NoteColor } from '../../db'
import { ICE_NOTE_COLOR_LIST, ICE_NOTE_COLORS } from '../../services/annotationService'

interface SelectionPopupProps {
  selectedText: string
  position: { x: number; y: number }
  initialShowNoteInput?: boolean
  defaultColor?: NoteColor
  onClose: () => void
  onHighlight: (color: NoteColor) => void
  onAddNote: (note: string, color: NoteColor) => void
}

export const SelectionPopup: React.FC<SelectionPopupProps> = ({
  selectedText,
  position,
  initialShowNoteInput = false,
  defaultColor = 'yellow',
  onClose,
  onHighlight,
  onAddNote
}) => {
  const [copied, setCopied] = useState(false)
  const [showNoteInput, setShowNoteInput] = useState(initialShowNoteInput)
  const [noteText, setNoteText] = useState('')
  const [noteColor, setNoteColor] = useState<NoteColor>(defaultColor)

  // Contextual floating modals
  const [showDictModal, setShowDictModal] = useState(false)
  const [dictLoading, setDictLoading] = useState(false)
  const [definition, setDefinition] = useState<InlineDefinition | null>(null)

  const [showWikiModal, setShowWikiModal] = useState(false)
  const [wikiLoading, setWikiLoading] = useState(false)
  const [wikiSummary, setWikiSummary] = useState<WikipediaSummary | null>(null)

  useEffect(() => {
    setShowNoteInput(initialShowNoteInput)
  }, [initialShowNoteInput])

  useEffect(() => {
    setNoteColor(defaultColor)
  }, [defaultColor])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  // Clamp bar position strictly within the desktop window
  const barHalfWidth = 265
  const clampedX = Math.max(barHalfWidth + 12, Math.min(window.innerWidth - barHalfWidth - 12, position.x))
  const clampedY = position.y < 96 ? Math.min(window.innerHeight - 60, position.y + 24) : Math.max(44, position.y - 46)

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
    try {
      const parsed = new URL(url)
      if (parsed.protocol === 'https:') {
        window.open(url, '_blank', 'noopener,noreferrer')
      }
    } catch {
      // Ignore invalid or non-HTTPS URLs
    }
    setShowDictModal(false)
    onClose()
  }

  const handleSaveNote = (e?: React.FormEvent) => {
    e?.preventDefault()
    onAddNote(noteText.trim(), noteColor)
    setShowNoteInput(false)
    setNoteText('')
    onClose()
  }

  return (
    <>
      {/* 36px Native Floating Action Bar */}
      {!showNoteInput && (
        <div
          style={{ left: `${clampedX}px`, top: `${clampedY}px` }}
          className="fixed z-50 transform -translate-x-1/2 h-9 bg-[#171a21] border border-[#2d323f] rounded-md p-1 flex items-center gap-1 shadow-2xl select-none app-no-drag animate-in fade-in duration-100"
        >
          {/* Copy button */}
          <button
            type="button"
            onClick={handleCopy}
            className="ice-btn-dark px-2 h-7 text-xs flex items-center gap-1 rounded-[2px]"
            title="Copy Text"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-[#8b949e]" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>

          {/* Highlight Colors (1:1 Native Desktop rectangular markers) */}
          <div className="flex items-center gap-1 px-1.5 border-x border-[#232732]">
            {ICE_NOTE_COLOR_LIST.map((col) => (
              <button
                key={col.id}
                type="button"
                onClick={() => onHighlight(col.id)}
                className="w-4 h-4 rounded-[2px] flex items-center justify-center hover:scale-110 transition-transform cursor-pointer"
                style={
                  col.isUnderline
                    ? { backgroundColor: 'var(--app-surface-2)', border: '1px solid var(--app-border-strong)', color: 'var(--app-accent-text)' }
                    : { backgroundColor: col.hex, border: '1px solid rgba(0,0,0,0.4)' }
                }
                title={`${col.label}${col.isUnderline ? '' : ' Highlight'}`}
              >
                {col.isUnderline && <Underline className="w-2.5 h-2.5 pointer-events-none" />}
              </button>
            ))}
          </div>

          {/* Note */}
          <button
            type="button"
            onClick={() => setShowNoteInput(true)}
            className="ice-btn-dark px-2 h-7 text-xs flex items-center gap-1 rounded-[2px]"
            title="Add Note"
          >
            <FileText className="w-3.5 h-3.5 text-[#2a69df]" />
            <span>Note</span>
          </button>

          {/* Speak */}
          <button
            type="button"
            onClick={handleSpeak}
            className="ice-btn-dark w-7 h-7 flex items-center justify-center rounded-[2px]"
            title="Read Aloud"
          >
            <Volume2 className="w-3.5 h-3.5 text-[#8b949e]" />
          </button>

          {/* Dictionary Lookup */}
          <button
            type="button"
            onClick={handleLookupDefinition}
            className="ice-btn-dark px-2 h-7 text-xs flex items-center gap-1 rounded-[2px]"
            title="Dictionary definition"
          >
            <BookMarked className="w-3.5 h-3.5 text-[#79c0ff]" />
            <span>Define</span>
          </button>

          {/* Wikipedia Encyclopedic Summary */}
          <button
            type="button"
            onClick={handleLookupWikipedia}
            className="ice-btn-dark px-2 h-7 text-xs flex items-center gap-1 rounded-[2px]"
            title="Wikipedia summary"
          >
            <Globe className="w-3.5 h-3.5 text-[#f59e0b]" />
            <span>Wiki</span>
          </button>

          {/* Translation (Google Translate & DeepL) */}
          <button
            type="button"
            onClick={() => handleOpenExternalProvider('Google Translate')}
            className="ice-btn-dark px-2 h-7 text-xs flex items-center gap-1 rounded-[2px]"
            title="Translate selection (Google Translate / DeepL)"
          >
            <Languages className="w-3.5 h-3.5 text-[#4cd964]" />
            <span>Translate</span>
          </button>
        </div>
      )}

      {/* Note Composer Modal */}
      {showNoteInput && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 app-no-drag"
          onClick={() => {
            setShowNoteInput(false)
            onClose()
          }}
        >
          <form
            onSubmit={handleSaveNote}
            onClick={(e) => e.stopPropagation()}
            className="bg-[#171a21] border border-[#2d323f] rounded-lg p-4 w-[420px] shadow-2xl space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#2a69df]" />
                <span className="text-xs font-semibold text-white">Add Note &amp; Highlight</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowNoteInput(false)
                  onClose()
                }}
                className="w-6 h-6 flex items-center justify-center rounded-[2px] text-[#8b949e] hover:text-white hover:bg-[#282c37]"
              >
                <X className="w-3.5 h-3.5 pointer-events-none" />
              </button>
            </div>

            <div
              className="text-[11px] text-[#c9d1d9] font-serif italic line-clamp-3 bg-[#12141a] p-2.5 rounded-[2px] border border-[#232732] border-l-2"
              style={{ borderLeftColor: (ICE_NOTE_COLORS[noteColor] || ICE_NOTE_COLORS.yellow).borderHex }}
            >
              &ldquo;{selectedText}&rdquo;
            </div>

            {/* Highlight Color Selector */}
            <div className="flex items-center justify-between bg-[#14161c] border border-[#232732] rounded-[2px] px-2.5 py-1.5">
              <span className="text-[11px] text-[#8b949e]">Highlight Style</span>
              <div className="flex items-center gap-1.5">
                {ICE_NOTE_COLOR_LIST.map((col) => {
                  const active = noteColor === col.id
                  return (
                    <button
                      key={col.id}
                      type="button"
                      onClick={() => setNoteColor(col.id)}
                      className={`w-5 h-5 rounded-[2px] flex items-center justify-center transition-transform cursor-pointer ${
                        active ? 'ring-2 ring-[var(--app-text-strong)] scale-105' : 'opacity-75 hover:opacity-100'
                      }`}
                      style={
                        col.isUnderline
                          ? { backgroundColor: 'var(--app-surface-2)', border: '1px solid var(--app-border-strong)', color: 'var(--app-accent-text)' }
                          : { backgroundColor: col.hex, border: '1px solid rgba(0,0,0,0.35)' }
                      }
                      title={col.label}
                    >
                      {col.isUnderline && <Underline className="w-3 h-3 pointer-events-none" />}
                    </button>
                  )
                })}
              </div>
            </div>

            <textarea
              autoFocus
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                  e.preventDefault()
                  handleSaveNote()
                }
              }}
              placeholder="Write your note or comment here... (Ctrl+Enter to save)"
              rows={4}
              className="ice-input w-full p-2.5 text-xs rounded-[2px] resize-none"
            />

            <div className="flex items-center justify-between pt-1">
              <span className="text-[10px] text-[#6e7681]">Ctrl+Enter to save</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowNoteInput(false)
                    onClose()
                  }}
                  className="ice-btn-dark px-3 h-7 text-xs rounded-[2px]"
                >
                  Cancel
                </button>
                <button type="submit" className="ice-btn-blue px-3.5 h-7 text-xs rounded-[2px]">
                  Save Note
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Feature 2: Inline Contextual Dictionary Modal */}
      {showDictModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-[#171a21] border border-[#2d323f] rounded-lg p-4 w-[460px] max-h-[80vh] shadow-2xl flex flex-col text-xs text-[#c9d1d9] space-y-3">
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
          <div className="bg-[#171a21] border border-[#2d323f] rounded-lg p-4 w-[500px] max-h-[80vh] shadow-2xl flex flex-col text-xs text-[#c9d1d9] space-y-3">
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
                    {wikiSummary.thumbnailUrl &&
                      (wikiSummary.thumbnailUrl.startsWith('https://') ||
                        /^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(
                          wikiSummary.thumbnailUrl
                        )) && (
                      <img
                        src={wikiSummary.thumbnailUrl}
                        alt=""
                        referrerPolicy="no-referrer"
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
                  {wikiSummary.contentUrl && wikiSummary.contentUrl.startsWith('https://') && (
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
