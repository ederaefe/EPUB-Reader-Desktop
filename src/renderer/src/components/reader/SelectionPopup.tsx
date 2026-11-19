import React, { useState, useEffect, useRef } from 'react'
import {
  Copy,
  Volume2,
  BookMarked,
  Globe,
  Check,
  Underline,
  ExternalLink,
  X,
  Languages,
  MoreHorizontal
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
  const [showMoreMenu, setShowMoreMenu] = useState(false)
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

  // Global dismissal: Escape key or clicking outside the popup (Standard in Adobe/Edge/Chrome/Apple)
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    const handleMouseDown = (e: MouseEvent) => {
      if (showDictModal || showWikiModal) return
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKey)
    document.addEventListener('mousedown', handleMouseDown)
    return () => {
      window.removeEventListener('keydown', handleKey)
      document.removeEventListener('mousedown', handleMouseDown)
    }
  }, [onClose, showDictModal, showWikiModal])

  // Precision Viewport Clamping (Subtle Micro-Pill Positioning)
  const barWidth = 240
  const barHalfWidth = barWidth / 2
  const clampedX = Math.max(barHalfWidth + 12, Math.min(window.innerWidth - barHalfWidth - 12, position.x))

  // Determine whether to show above or below selection based on clearance
  const isNearTop = position.y < 160
  const clampedY = isNearTop
    ? Math.min(window.innerHeight - 80, position.y + 22)
    : Math.max(48, position.y - 44)

  const handleCopy = () => {
    navigator.clipboard.writeText(selectedText)
    setCopied(true)
    setTimeout(() => {
      setCopied(false)
      onClose()
    }, 600)
  }

  const handleSpeak = () => {
    ttsService.speak(selectedText)
    setShowMoreMenu(false)
    onClose()
  }

  const handleLookupDefinition = async () => {
    setShowMoreMenu(false)
    setShowDictModal(true)
    setDictLoading(true)
    const res = await fetchInlineDefinition(selectedText)
    setDefinition(res)
    setDictLoading(false)
  }

  const handleLookupWikipedia = async () => {
    setShowMoreMenu(false)
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
      {/* Sleek Minimalist Literary Floating Micro-Pill */}
      <div
        ref={popupRef}
        style={{ left: `${clampedX}px`, top: `${clampedY}px` }}
        className="fixed z-50 transform -translate-x-1/2 flex flex-col items-center select-none app-no-drag animate-in fade-in zoom-in-95 duration-100"
      >
        {/* The Action Pill */}
        <div className="h-8 px-2 bg-[var(--app-chrome)]/92 backdrop-blur-xl border border-[var(--app-border-strong)] rounded-full flex items-center gap-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.32)]">
          {/* Subtle Watercolor Color Palette */}
          <div className="flex items-center gap-1.5 px-0.5">
            {ICE_NOTE_COLOR_LIST.map((col) => (
              <button
                key={col.id}
                type="button"
                onClick={() => onHighlight(col.id)}
                className="w-3.5 h-3.5 rounded-full flex items-center justify-center hover:scale-125 transition-transform cursor-pointer shadow-xs"
                style={
                  col.isUnderline
                    ? {
                        backgroundColor: 'var(--app-surface-2)',
                        border: '1px solid var(--app-border-strong)',
                        color: 'var(--app-accent-text)'
                      }
                    : {
                        backgroundColor: col.hex,
                        border: '1px solid rgba(0,0,0,0.3)'
                      }
                }
                title={`Highlight in ${col.label}`}
              >
                {col.isUnderline && <Underline className="w-2 h-2 pointer-events-none" />}
              </button>
            ))}
          </div>

          <div className="w-px h-3 bg-[var(--app-border)]" />

          {/* Note Toggle */}
          <button
            type="button"
            onClick={() => {
              setShowNoteComposer((prev) => !prev)
              setShowMoreMenu(false)
            }}
            className={`h-6 px-2 rounded-full text-[11.5px] font-medium tracking-tight transition-all cursor-pointer ${
              showNoteComposer
                ? 'bg-[var(--app-accent)] text-white'
                : 'text-[var(--app-text-muted)] hover:text-[var(--app-text-strong)] hover:bg-[var(--app-surface-hover)]'
            }`}
            title="Attach Note"
          >
            Note
          </button>

          {/* Copy Button */}
          <button
            type="button"
            onClick={handleCopy}
            className="h-6 px-2 rounded-full text-[11.5px] font-medium tracking-tight text-[var(--app-text-muted)] hover:text-[var(--app-text-strong)] hover:bg-[var(--app-surface-hover)] flex items-center gap-1 transition-all cursor-pointer"
            title="Copy selection"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : null}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>

          <div className="w-px h-3 bg-[var(--app-border)]" />

          {/* Progressive Disclosure: Secondary Actions Overflow Menu (•••) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowMoreMenu((prev) => !prev)}
              className={`w-6 h-6 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                showMoreMenu
                  ? 'bg-[var(--app-surface-hover)] text-[var(--app-text-strong)]'
                  : 'text-[var(--app-text-subtle)] hover:text-[var(--app-text-strong)] hover:bg-[var(--app-surface-hover)]'
              }`}
              title="More actions"
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>

            {/* Subtle Dropdown Card for Secondary Actions */}
            {showMoreMenu && (
              <div className="absolute right-0 top-full mt-1.5 w-36 bg-[var(--app-chrome)] border border-[var(--app-border-strong)] rounded-lg py-1 shadow-2xl backdrop-blur-xl z-50 text-xs animate-in fade-in slide-in-from-top-1 duration-100">
                <button
                  type="button"
                  onClick={handleSpeak}
                  className="w-full px-3 py-1.5 text-left text-[var(--app-text)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--app-text-strong)] flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <Volume2 className="w-3.5 h-3.5 text-[var(--app-text-subtle)]" />
                  <span>Read aloud</span>
                </button>
                <button
                  type="button"
                  onClick={handleLookupDefinition}
                  className="w-full px-3 py-1.5 text-left text-[var(--app-text)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--app-text-strong)] flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <BookMarked className="w-3.5 h-3.5 text-[var(--app-accent-text)]" />
                  <span>Dictionary</span>
                </button>
                <button
                  type="button"
                  onClick={handleLookupWikipedia}
                  className="w-full px-3 py-1.5 text-left text-[var(--app-text)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--app-text-strong)] flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <Globe className="w-3.5 h-3.5 text-[var(--app-text-subtle)]" />
                  <span>Wikipedia</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenExternalProvider('Google Translate')}
                  className="w-full px-3 py-1.5 text-left text-[var(--app-text)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--app-text-strong)] flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <Languages className="w-3.5 h-3.5 text-[var(--app-text-subtle)]" />
                  <span>Translate</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Anchored Marginalia Note Composer (Gentle Slip of Paper, Never Full Modal) */}
        {showNoteComposer && (
          <form
            onSubmit={handleSaveNote}
            className={`w-[310px] bg-[var(--app-chrome)]/96 backdrop-blur-xl border border-[var(--app-border-strong)] rounded-xl p-3 shadow-2xl space-y-2 text-xs text-[var(--app-text)] animate-in fade-in duration-150 ${
              isNearTop ? 'mt-2' : 'mb-2 order-first'
            }`}
          >
            {/* Quote Excerpt */}
            <div
              className="text-[11.5px] leading-relaxed text-[var(--app-text-muted)] font-serif italic line-clamp-2 px-2 py-1 rounded bg-[var(--app-surface-2)]/60 border-l-2"
              style={{ borderLeftColor: (ICE_NOTE_COLORS[noteColor] || ICE_NOTE_COLORS.yellow).borderHex }}
            >
              &ldquo;{selectedText}&rdquo;
            </div>

            {/* Seamless Writing Area */}
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
              placeholder="Write a thought in the margin... (Ctrl+Enter)"
              rows={3}
              className="w-full bg-[var(--app-surface-2)]/40 border border-[var(--app-border)] text-[var(--app-text-strong)] placeholder-[var(--app-text-subtle)] p-2 text-xs rounded-lg focus:outline-none focus:border-[var(--app-accent)] resize-none transition-colors"
            />

            <div className="flex items-center justify-between pt-0.5">
              <span className="text-[10.5px] text-[var(--app-text-subtle)] font-mono">
                Ctrl+Enter
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowNoteComposer(false)}
                  className="px-2 py-1 rounded-md text-[11px] text-[var(--app-text-subtle)] hover:text-[var(--app-text-strong)] hover:bg-[var(--app-surface-hover)] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1 rounded-md text-[11px] font-medium bg-[var(--app-accent)] hover:brightness-110 text-white shadow-xs transition-all cursor-pointer"
                >
                  Save Note
                </button>
              </div>
            </div>
          </form>
        )}
      </div>

      {/* Contextual Dictionary Modal (Anchored & Non-Blocking) */}
      {showDictModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--app-chrome)] border border-[var(--app-border-strong)] rounded-xl p-4 w-[460px] max-h-[80vh] shadow-2xl flex flex-col text-xs text-[var(--app-text)] space-y-3 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-2">
              <div className="flex items-center gap-2">
                <BookMarked className="w-4 h-4 text-[var(--app-accent)]" />
                <span className="text-[13px] font-semibold text-[var(--app-text-strong)]">Dictionary: {selectedText.slice(0, 30)}</span>
              </div>
              <button
                onClick={() => {
                  setShowDictModal(false)
                  onClose()
                }}
                className="w-5 h-5 flex items-center justify-center text-[var(--app-text-subtle)] hover:text-[var(--app-text-strong)] hover:bg-[var(--app-surface-hover)] rounded-md cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 space-y-3">
              {dictLoading ? (
                <div className="py-6 text-center text-[var(--app-text-subtle)]">Looking up definition...</div>
              ) : definition ? (
                <div className="space-y-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-base font-bold text-[var(--app-text-strong)]">{definition.word}</span>
                    {definition.phonetic && (
                      <span className="text-[11px] font-mono text-[var(--app-accent-text)]">{definition.phonetic}</span>
                    )}
                  </div>
                  {definition.meanings.map((m, mi) => (
                    <div key={mi} className="bg-[var(--app-surface-2)]/60 p-2.5 rounded-lg border border-[var(--app-border)] space-y-1">
                      <span className="text-[11px] font-semibold uppercase text-amber-500 tracking-wider font-mono">
                        {m.partOfSpeech}
                      </span>
                      {m.definitions.map((def, di) => (
                        <div key={di} className="text-[12px] leading-relaxed text-[var(--app-text)] pl-1 border-l border-[var(--app-border-strong)]">
                          <p>{def.definition}</p>
                          {def.example && (
                            <p className="text-[11px] text-[var(--app-text-subtle)] italic mt-0.5">&ldquo;{def.example}&rdquo;</p>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-4 text-[var(--app-text-subtle)]">
                  No instant offline definition found for &ldquo;{selectedText}&rdquo;. Choose a web dictionary provider below:
                </div>
              )}

              {/* Web Providers List */}
              <div className="pt-2 border-t border-[var(--app-border)] space-y-1">
                <div className="text-[10px] text-[var(--app-text-subtle)] uppercase tracking-wider font-mono mb-1">
                  External Dictionaries & Deep Translation
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {DICT_PROVIDERS.map((provider) => (
                    <button
                      key={provider.name}
                      onClick={() => handleOpenExternalProvider(provider.name)}
                      className="px-2.5 py-1.5 bg-[var(--app-surface)] hover:bg-[var(--app-surface-hover)] border border-[var(--app-border)] rounded-md text-xs text-[var(--app-text)] flex items-center justify-between transition-colors cursor-pointer"
                    >
                      <span className="truncate">{provider.name}</span>
                      <ExternalLink className="w-3 h-3 text-[var(--app-text-subtle)]" />
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
          <div className="bg-[var(--app-chrome)] border border-[var(--app-border-strong)] rounded-xl p-4 w-[500px] max-h-[80vh] shadow-2xl flex flex-col text-xs text-[var(--app-text)] space-y-3 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-2">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-amber-500" />
                <span className="text-[13px] font-semibold text-[var(--app-text-strong)]">Wikipedia: {selectedText.slice(0, 30)}</span>
              </div>
              <button
                onClick={() => {
                  setShowWikiModal(false)
                  onClose()
                }}
                className="w-5 h-5 flex items-center justify-center text-[var(--app-text-subtle)] hover:text-[var(--app-text-strong)] hover:bg-[var(--app-surface-hover)] rounded-md cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-1">
              {wikiLoading ? (
                <div className="py-8 text-center text-[var(--app-text-subtle)]">Fetching encyclopedic summary...</div>
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
                        className="w-20 h-24 object-cover rounded-md border border-[var(--app-border)] shrink-0"
                      />
                    )}
                    <div className="flex flex-col">
                      <h3 className="text-sm font-bold text-[var(--app-text-strong)]">{wikiSummary.title}</h3>
                      {wikiSummary.description && (
                        <p className="text-[11px] text-[var(--app-accent-text)]">{wikiSummary.description}</p>
                      )}
                    </div>
                  </div>
                  <p className="text-[12px] leading-relaxed text-[var(--app-text)] bg-[var(--app-surface-2)]/60 p-3 rounded-lg border border-[var(--app-border)]">
                    {wikiSummary.extract}
                  </p>
                  {wikiSummary.contentUrl && wikiSummary.contentUrl.startsWith('https://') && (
                    <a
                      href={wikiSummary.contentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-[var(--app-accent-text)] hover:underline pt-1"
                    >
                      <span>Read full Wikipedia article</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              ) : (
                <div className="py-6 text-center text-[var(--app-text-subtle)] space-y-2">
                  <p>No instant summary found on Wikipedia for &ldquo;{selectedText}&rdquo;.</p>
                  <button
                    onClick={() => handleOpenExternalProvider('Wikipedia')}
                    className="ice-btn-blue px-3 py-1 rounded-md inline-flex items-center gap-1.5 text-xs cursor-pointer"
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
