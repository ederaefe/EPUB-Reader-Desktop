import React, { useState, useEffect, useRef } from 'react'
import {
  Copy,
  FileText,
  Volume2,
  BookMarked,
  Globe,
  Check,
  Underline,
  ExternalLink,
  X,
  Languages,
  CornerDownLeft
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
  const [showNoteComposer, setShowNoteComposer] = useState(initialShowNoteInput)
  const [noteText, setNoteText] = useState('')
  const [noteColor, setNoteColor] = useState<NoteColor>(defaultColor)

  // Floating Contextual Modals
  const [showDictModal, setShowDictModal] = useState(false)
  const [dictLoading, setDictLoading] = useState(false)
  const [definition, setDefinition] = useState<InlineDefinition | null>(null)

  const [showWikiModal, setShowWikiModal] = useState(false)
  const [wikiLoading, setWikiLoading] = useState(false)
  const [wikiSummary, setWikiSummary] = useState<WikipediaSummary | null>(null)

  const popupRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setShowNoteComposer(initialShowNoteInput)
  }, [initialShowNoteInput])

  useEffect(() => {
    setNoteColor(defaultColor)
  }, [defaultColor])

  useEffect(() => {
    if (showNoteComposer && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [showNoteComposer])

  // Global keydown: Escape dismisses, Ctrl+Enter saves note
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

  // Precision Viewport Clamping (Chrome PDF Floating Style)
  const barWidth = 330
  const barHalfWidth = barWidth / 2
  const clampedX = Math.max(barHalfWidth + 16, Math.min(window.innerWidth - barHalfWidth - 16, position.x))

  // Determine whether to show above or below selection based on available vertical clearance
  const isNearTop = position.y < 180
  const clampedY = isNearTop
    ? Math.min(window.innerHeight - 80, position.y + 24)
    : Math.max(48, position.y - 48)

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
    setShowNoteComposer(false)
    setNoteText('')
    onClose()
  }

  return (
    <>
      {/* Chrome PDF-Inspired Sleek Floating Action Bar */}
      <div
        ref={popupRef}
        style={{ left: `${clampedX}px`, top: `${clampedY}px` }}
        className="fixed z-50 transform -translate-x-1/2 flex flex-col items-center select-none app-no-drag animate-in fade-in zoom-in-95 duration-100"
      >
        {/* The Action Pill */}
        <div className="h-9 px-1.5 bg-[#171a21]/95 backdrop-blur-md border border-[#2d323f] rounded-full flex items-center gap-1 shadow-2xl">
          {/* 1-Click Highlight Color Palette */}
          <div className="flex items-center gap-1.5 px-1.5">
            {ICE_NOTE_COLOR_LIST.map((col) => (
              <button
                key={col.id}
                type="button"
                onClick={() => onHighlight(col.id)}
                className="w-4 h-4 rounded-full flex items-center justify-center hover:scale-125 transition-transform cursor-pointer shadow-sm"
                style={
                  col.isUnderline
                    ? {
                        backgroundColor: '#232732',
                        border: '1px solid #444c5e',
                        color: '#79c0ff'
                      }
                    : {
                        backgroundColor: col.hex,
                        border: '1px solid rgba(0,0,0,0.45)'
                      }
                }
                title={`Highlight in ${col.label}`}
              >
                {col.isUnderline && <Underline className="w-2.5 h-2.5 pointer-events-none" />}
              </button>
            ))}
          </div>

          <div className="w-[1px] h-4 bg-[#2d323f]" />

          {/* Copy Button */}
          <button
            type="button"
            onClick={handleCopy}
            className="h-7 px-2 rounded-full text-xs text-[#c9d1d9] hover:text-white hover:bg-[#282c37] flex items-center gap-1 transition-colors"
            title="Copy selection"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-[#8b949e]" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>

          {/* Note Button (Expands Inline Note Composer - No Blocking Modal) */}
          <button
            type="button"
            onClick={() => setShowNoteComposer((prev) => !prev)}
            className={`h-7 px-2 rounded-full text-xs flex items-center gap-1 transition-colors ${
              showNoteComposer
                ? 'bg-[#2a69df] text-white'
                : 'text-[#c9d1d9] hover:text-white hover:bg-[#282c37]'
            }`}
            title="Attach Note"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Note</span>
          </button>

          {/* Speak / Read Aloud */}
          <button
            type="button"
            onClick={handleSpeak}
            className="w-7 h-7 rounded-full text-[#8b949e] hover:text-white hover:bg-[#282c37] flex items-center justify-center transition-colors"
            title="Read selection aloud"
          >
            <Volume2 className="w-3.5 h-3.5" />
          </button>

          {/* Define */}
          <button
            type="button"
            onClick={handleLookupDefinition}
            className="w-7 h-7 rounded-full text-[#79c0ff] hover:text-white hover:bg-[#282c37] flex items-center justify-center transition-colors"
            title="Dictionary definition"
          >
            <BookMarked className="w-3.5 h-3.5" />
          </button>

          {/* Translate */}
          <button
            type="button"
            onClick={() => handleOpenExternalProvider('Google Translate')}
            className="w-7 h-7 rounded-full text-[#4cd964] hover:text-white hover:bg-[#282c37] flex items-center justify-center transition-colors"
            title="Translate selection"
          >
            <Languages className="w-3.5 h-3.5" />
          </button>

          {/* Close */}
          <button
            type="button"
            onClick={onClose}
            className="w-5 h-5 rounded-full text-[#6e7681] hover:text-white hover:bg-[#282c37] flex items-center justify-center transition-colors"
            title="Dismiss"
          >
            <X className="w-3 h-3" />
          </button>
        </div>

        {/* Anchored Inline Note Composer (Attached Dropdown - Never covers whole screen) */}
        {showNoteComposer && (
          <form
            onSubmit={handleSaveNote}
            className={`mt-2 w-[340px] bg-[#171a21]/95 backdrop-blur-md border border-[#2d323f] rounded-lg p-3 shadow-2xl space-y-2.5 text-xs text-[#c9d1d9] animate-in fade-in slide-in-from-top-1 duration-150 ${
              isNearTop ? 'mt-2' : 'mb-2 order-first'
            }`}
          >
            {/* Header & Quote snippet */}
            <div className="flex items-center justify-between pb-1 border-b border-[#232732]">
              <div className="flex items-center gap-1.5 text-white font-medium">
                <FileText className="w-3.5 h-3.5 text-[#2a69df]" />
                <span>Attach Note</span>
              </div>
              <div className="flex items-center gap-1">
                {ICE_NOTE_COLOR_LIST.map((col) => (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => setNoteColor(col.id)}
                    className={`w-3.5 h-3.5 rounded-full transition-transform ${
                      noteColor === col.id ? 'ring-2 ring-white scale-110' : 'opacity-60 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: col.hex }}
                    title={col.label}
                  />
                ))}
              </div>
            </div>

            <div
              className="text-[11px] text-[#8b949e] font-serif italic truncate bg-[#12141a] px-2 py-1 rounded border-l-2 border-[#2a69df]"
              style={{ borderLeftColor: (ICE_NOTE_COLORS[noteColor] || ICE_NOTE_COLORS.yellow).borderHex }}
            >
              &ldquo;{selectedText}&rdquo;
            </div>

            <textarea
              ref={textareaRef}
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                  e.preventDefault()
                  handleSaveNote()
                }
              }}
              placeholder="Write a note... (Ctrl+Enter to save)"
              rows={3}
              className="w-full bg-[#12141a] border border-[#2d323f] text-[#f2f2f2] placeholder-[#6e7681] p-2 text-xs rounded focus:outline-none focus:border-[#2a69df] resize-none"
            />

            <div className="flex items-center justify-between pt-1">
              <span className="text-[10px] text-[#6e7681]">Ctrl+Enter to save</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowNoteComposer(false)}
                  className="px-2.5 py-1 rounded text-xs text-[#8b949e] hover:text-white hover:bg-[#282c37] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1 rounded bg-[#2a69df] hover:bg-[#3291ff] text-white text-xs font-medium flex items-center gap-1 transition-colors"
                >
                  <span>Save</span>
                  <CornerDownLeft className="w-3 h-3" />
                </button>
              </div>
            </div>
          </form>
        )}
      </div>

      {/* Contextual Dictionary Modal (Anchored & Non-Blocking) */}
      {showDictModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#171a21] border border-[#2d323f] rounded-lg p-4 w-[460px] max-h-[80vh] shadow-2xl flex flex-col text-xs text-[#c9d1d9] space-y-3 animate-in fade-in zoom-in-95 duration-150">
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

      {/* Encyclopedic Wikipedia Modal */}
      {showWikiModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#171a21] border border-[#2d323f] rounded-lg p-4 w-[500px] max-h-[80vh] shadow-2xl flex flex-col text-xs text-[#c9d1d9] space-y-3 animate-in fade-in zoom-in-95 duration-150">
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
