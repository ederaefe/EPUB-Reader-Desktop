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
  MoreHorizontal,
  StickyNote,
  Search
} from 'lucide-react'
import {
  DICT_PROVIDERS,
  getDefinitionUrl,
  fetchInlineDefinition,
  fetchWikipediaSummary,
  getDictionaryHistory,
  clearDictionaryHistory,
  type InlineDefinition,
  type WikipediaSummary,
  type DictHistoryEntry
} from '../../services/dictService'
import { ttsService } from '../../services/ttsService'
import { useAppStore } from '../../stores/useAppStore'
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
  const [showDictHistory, setShowDictHistory] = useState(false)
  const [dictHistory, setDictHistory] = useState<DictHistoryEntry[]>([])
  const [historySearchQuery, setHistorySearchQuery] = useState('')

  const normalizedSearch = historySearchQuery.trim().toLowerCase()
  const filteredHistory = dictHistory.filter((item) => {
    if (!normalizedSearch) return true
    if (item.word.toLowerCase().includes(normalizedSearch)) return true
    if (item.definition.phonetic?.toLowerCase().includes(normalizedSearch)) return true
    return item.definition.meanings?.some((m) =>
      m.definitions?.some((d) => d.definition?.toLowerCase().includes(normalizedSearch))
    )
  })

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
  // Direct pixel coordinate calculation without CSS transform -translate-x-1/2 to prevent animation & clipping conflicts
  const [measuredWidth, setMeasuredWidth] = useState(showNoteComposer ? 310 : 270)

  useEffect(() => {
    if (popupRef.current) {
      const rect = popupRef.current.getBoundingClientRect()
      if (rect.width > 0) {
        setMeasuredWidth(rect.width)
      }
    }
  }, [showNoteComposer, showMoreMenu, selectedText])

  const effectiveWidth = Math.max(measuredWidth, showNoteComposer ? 310 : 270)
  const paddingX = 16
  const maxLeft = Math.max(paddingX, window.innerWidth - effectiveWidth - paddingX)
  const leftPos = Math.max(paddingX, Math.min(maxLeft, position.x - effectiveWidth / 2))

  // Determine whether to show above or below selection based on clearance
  const isNearTop = position.y < (showNoteComposer ? 220 : 120)
  const clampedY = isNearTop
    ? Math.min(window.innerHeight - (showNoteComposer ? 240 : 60), position.y + 22)
    : Math.max(48, position.y - 44)

  const handleCopy = () => {
    navigator.clipboard.writeText(selectedText)
    setCopied(true)
    setTimeout(() => {
      setCopied(false)
      onClose()
    }, 600)
  }

  const isSingleWord = selectedText.trim().split(/\s+/).filter(Boolean).length === 1

  const handleSpeak = () => {
    const st = useAppStore.getState()
    st.setTTSActive(true)
    st.setTTSMuted(false)
    ttsService.speak(selectedText, {
      rate: st.settings.ttsSpeed,
      pitch: st.settings.ttsPitch,
      voiceURI: st.settings.ttsVoice,
      onEnd: () => {
        const cur = useAppStore.getState()
        cur.setTTSActive(false)
        cur.setTTSMuted(false)
      }
    })
    setShowMoreMenu(false)
    onClose()
  }

  const handleLookupDefinition = async () => {
    setShowMoreMenu(false)
    setShowDictHistory(false)
    setDictHistory(getDictionaryHistory())
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
        style={{ left: `${leftPos}px`, top: `${clampedY}px` }}
        className="fixed z-50 flex flex-col items-center select-none app-no-drag animate-in fade-in duration-100"
      >
        {/* The Action Pill (Antigravity UI Translucent Dual-Hairline Floating Pill) */}
        <div className="h-8 px-2 w-max whitespace-nowrap bg-[rgba(18,20,24,0.85)] dark:bg-[rgba(14,16,20,0.88)] backdrop-blur-2xl border border-white/[0.10] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05),0_12px_40px_rgba(0,0,0,0.55)] rounded-full flex items-center gap-1.5">
          {/* Subtle Watercolor Color Palette */}
          <div className="flex items-center gap-1.5 px-0.5">
            {ICE_NOTE_COLOR_LIST.map((col) => (
              <button
                key={col.id}
                type="button"
                onClick={() => onHighlight(col.id)}
                className="w-3.5 h-3.5 rounded-full flex items-center justify-center hover:scale-125 transition-transform cursor-pointer shadow-xs ring-1 ring-black/25"
                style={
                  col.isUnderline
                    ? {
                        backgroundColor: 'rgba(255,255,255,0.08)',
                        border: '1px solid rgba(255,255,255,0.16)',
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

          <div className="w-px h-3 bg-white/[0.10]" />

          {/* Note Toggle Icon Button */}
          <button
            type="button"
            onClick={() => {
              setShowNoteComposer((prev) => !prev)
              setShowMoreMenu(false)
            }}
            className={`w-6 h-6 rounded-full flex items-center justify-center transition-all cursor-pointer ${
              showNoteComposer
                ? 'bg-[var(--app-accent)] text-white shadow-xs'
                : 'text-neutral-400 hover:text-white hover:bg-white/[0.08]'
            }`}
            title="Attach Note"
            aria-label="Attach Note"
          >
            <StickyNote className="w-3.5 h-3.5" />
          </button>

          {/* Copy Icon Button */}
          <button
            type="button"
            onClick={handleCopy}
            className="w-6 h-6 rounded-full flex items-center justify-center text-neutral-400 hover:text-white hover:bg-white/[0.08] transition-all cursor-pointer"
            title={copied ? 'Copied' : 'Copy selection'}
            aria-label="Copy selection"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>

          <div className="w-px h-3 bg-white/[0.10]" />

          {/* Progressive Disclosure: Secondary Actions Overflow Menu (•••) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowMoreMenu((prev) => !prev)}
              className={`w-6 h-6 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                showMoreMenu
                  ? 'bg-white/[0.15] text-white shadow-xs'
                  : 'text-neutral-400 hover:text-white hover:bg-white/[0.08]'
              }`}
              title="More actions"
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>

            {/* Antigravity Translucent Dropdown Menu for Secondary Actions */}
            {showMoreMenu && (
              <div className="absolute right-0 top-full mt-1.5 w-36 bg-[rgba(18,20,24,0.95)] backdrop-blur-2xl border border-white/[0.10] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05),0_16px_48px_rgba(0,0,0,0.6)] rounded-xl py-1 z-50 text-xs animate-in fade-in slide-in-from-top-1 duration-100">
                <button
                  type="button"
                  onClick={handleSpeak}
                  className="w-full px-3 py-1.5 text-left text-neutral-200 hover:bg-white/[0.08] hover:text-white flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <Volume2 className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Read aloud</span>
                </button>

                {/* Dictionary & Wikipedia only shown for single-word selections */}
                {isSingleWord && (
                  <>
                    <button
                      type="button"
                      onClick={handleLookupDefinition}
                      className="w-full px-3 py-1.5 text-left text-neutral-200 hover:bg-white/[0.08] hover:text-white flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <BookMarked className="w-3.5 h-3.5 text-[var(--app-accent-text)]" />
                      <span>Dictionary</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleLookupWikipedia}
                      className="w-full px-3 py-1.5 text-left text-neutral-200 hover:bg-white/[0.08] hover:text-white flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <Globe className="w-3.5 h-3.5 text-neutral-400" />
                      <span>Wikipedia</span>
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => handleOpenExternalProvider('Google Translate')}
                  className="w-full px-3 py-1.5 text-left text-neutral-200 hover:bg-white/[0.08] hover:text-white flex items-center gap-2 transition-colors cursor-pointer"
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
                <span className="text-[13px] font-semibold text-[var(--app-text-strong)]">
                  {showDictHistory ? 'Dictionary History' : `Dictionary: ${definition?.word || selectedText.slice(0, 30)}`}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (!showDictHistory) {
                      setDictHistory(getDictionaryHistory())
                      setHistorySearchQuery('')
                    }
                    setShowDictHistory((prev) => !prev)
                  }}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                    showDictHistory
                      ? 'bg-[var(--app-accent)] text-white'
                      : 'text-[var(--app-text-muted)] hover:text-[var(--app-text-strong)] hover:bg-[var(--app-surface-hover)]'
                  }`}
                >
                  {showDictHistory ? 'Definition' : 'History'}
                </button>
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
            </div>

            {showDictHistory ? (
              <div className="flex-1 overflow-y-auto pr-1 space-y-2.5 max-h-[50vh]">
                {/* Real-time Vocabulary Search Bar */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--app-text-subtle)] pointer-events-none" />
                  <input
                    type="text"
                    value={historySearchQuery}
                    onChange={(e) => setHistorySearchQuery(e.target.value)}
                    onKeyDown={async (e) => {
                      if (e.key === 'Enter' && historySearchQuery.trim()) {
                        e.preventDefault()
                        const term = historySearchQuery.trim()
                        setDictLoading(true)
                        setShowDictHistory(false)
                        const res = await fetchInlineDefinition(term)
                        setDefinition(res)
                        setDictHistory(getDictionaryHistory())
                        setDictLoading(false)
                      }
                    }}
                    placeholder="Search history or look up a word..."
                    className="w-full bg-[var(--app-surface-2)] border border-[var(--app-border)] focus:border-[var(--app-accent)] focus:outline-none rounded-lg pl-8 pr-7 py-1.5 text-xs text-[var(--app-text-strong)] placeholder-[var(--app-text-subtle)] transition-colors"
                    autoFocus
                  />
                  {historySearchQuery && (
                    <button
                      type="button"
                      onClick={() => setHistorySearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--app-text-subtle)] hover:text-[var(--app-text-strong)] p-0.5 rounded cursor-pointer"
                      title="Clear search"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {dictHistory.length === 0 ? (
                  <div className="py-8 text-center text-[var(--app-text-subtle)]">
                    No past lookups in dictionary history yet.
                  </div>
                ) : filteredHistory.length === 0 ? (
                  <div className="py-6 text-center space-y-2">
                    <p className="text-[var(--app-text-subtle)] text-xs">
                      No history matches for &ldquo;{historySearchQuery}&rdquo;
                    </p>
                    <button
                      type="button"
                      onClick={async () => {
                        const term = historySearchQuery.trim()
                        setDictLoading(true)
                        setShowDictHistory(false)
                        const res = await fetchInlineDefinition(term)
                        setDefinition(res)
                        setDictHistory(getDictionaryHistory())
                        setDictLoading(false)
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--app-surface-2)] hover:bg-[var(--app-surface-hover)] border border-[var(--app-border)] text-xs font-medium text-[var(--app-accent-text)] transition-colors cursor-pointer"
                    >
                      <Search className="w-3 h-3" />
                      <span>Look up &ldquo;{historySearchQuery.trim()}&rdquo;</span>
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="space-y-1.5">
                      {filteredHistory.map((item) => (
                        <button
                          key={item.word + item.timestamp}
                          type="button"
                          onClick={() => {
                            setDefinition(item.definition)
                            setShowDictHistory(false)
                          }}
                          className="w-full text-left p-2.5 rounded-lg bg-[var(--app-surface-2)]/60 hover:bg-[var(--app-surface-hover)] border border-[var(--app-border)] transition-colors flex items-center justify-between group cursor-pointer"
                        >
                          <div className="min-w-0 flex-1 pr-2">
                            <div className="flex items-baseline gap-2">
                              <span className="font-bold text-[13px] text-[var(--app-text-strong)] group-hover:text-[var(--app-accent-text)]">
                                {item.word}
                              </span>
                              {item.definition.phonetic && (
                                <span className="text-[10.5px] font-mono text-[var(--app-text-subtle)]">
                                  {item.definition.phonetic}
                                </span>
                              )}
                            </div>
                            <p className="text-[11.5px] text-[var(--app-text-muted)] line-clamp-1 mt-0.5">
                              {item.definition.meanings?.[0]?.definitions?.[0]?.definition || 'Cached definition'}
                            </p>
                          </div>
                          <span className="text-[10px] text-[var(--app-text-subtle)] font-mono shrink-0">
                            {new Date(item.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          </span>
                        </button>
                      ))}
                    </div>
                    <div className="pt-2 flex items-center justify-between">
                      <span className="text-[10px] text-[var(--app-text-subtle)] font-mono">
                        {filteredHistory.length} of {dictHistory.length} {dictHistory.length === 1 ? 'word' : 'words'}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          clearDictionaryHistory()
                          setDictHistory([])
                        }}
                        className="text-[11px] text-[var(--app-text-subtle)] hover:text-red-400 transition-colors cursor-pointer"
                      >
                        Clear history
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
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
            )}
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
