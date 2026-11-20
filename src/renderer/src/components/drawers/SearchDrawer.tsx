import React, { useEffect, useRef, useState, useCallback } from 'react'
import { X, Search, ChevronUp, ChevronDown, Loader2 } from 'lucide-react'
import { useAppStore } from '../../stores/useAppStore'

export interface SearchMatch {
  cfi: string
  excerpt: string
  chapter: string
}

interface SearchDrawerProps {
  onSearch: (query: string) => Promise<SearchMatch[]>
  onSelectMatch: (cfi: string) => void
  onClearHighlight: () => void
  focusNonce?: number
}

function renderHighlightedExcerpt(excerpt: string, query: string): React.ReactNode {
  const trimmed = query.trim()
  if (!trimmed) return excerpt

  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const parts = excerpt.split(new RegExp(`(${escaped})`, 'gi'))
  return parts.map((part, idx) =>
    part.toLowerCase() === trimmed.toLowerCase() ? (
      <mark
        key={idx}
        className="bg-[#f59e0b]/30 text-[var(--app-text-strong)] font-semibold px-0.5 rounded-[2px]"
      >
        {part}
      </mark>
    ) : (
      <React.Fragment key={idx}>{part}</React.Fragment>
    )
  )
}

export const SearchDrawer: React.FC<SearchDrawerProps> = ({
  onSearch,
  onSelectMatch,
  onClearHighlight,
  focusNonce = 0
}) => {
  const { isSearchDrawerOpen, toggleSearchDrawer, isImmersiveFullscreen, activeBook } = useAppStore()
  const [query, setQuery] = useState('')
  const [searchedQuery, setSearchedQuery] = useState('')
  const [results, setResults] = useState<SearchMatch[]>([])
  const [activeIndex, setActiveIndex] = useState<number>(-1)
  const [isSearching, setIsSearching] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  const runIdRef = useRef(0)
  const activeItemRef = useRef<HTMLButtonElement>(null)

  // Reset search state when switching books
  useEffect(() => {
    runIdRef.current++
    setQuery('')
    setSearchedQuery('')
    setResults([])
    setActiveIndex(-1)
    setIsSearching(false)
    onClearHighlight()
  }, [activeBook?.id, onClearHighlight])

  const focusInput = useCallback(() => {
    requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    })
  }, [])

  // Auto-focus when opened or when Ctrl+F is pressed while already open
  useEffect(() => {
    if (isSearchDrawerOpen) {
      focusInput()
    } else {
      onClearHighlight()
    }
  }, [isSearchDrawerOpen, focusNonce, focusInput, onClearHighlight])

  const executeSearch = useCallback(
    async (rawQuery: string, autoJump = false) => {
      const trimmed = rawQuery.trim()
      const currentRun = ++runIdRef.current

      if (!trimmed) {
        setResults([])
        setSearchedQuery('')
        setActiveIndex(-1)
        setIsSearching(false)
        onClearHighlight()
        return
      }

      setIsSearching(true)
      try {
        const matches = await onSearch(trimmed)
        if (currentRun !== runIdRef.current) return
        setResults(matches)
        setSearchedQuery(trimmed)
        if (matches.length > 0 && autoJump) {
          setActiveIndex(0)
          onSelectMatch(matches[0].cfi)
        } else {
          setActiveIndex(-1)
        }
      } catch {
        if (currentRun !== runIdRef.current) return
        setResults([])
        setSearchedQuery(trimmed)
        setActiveIndex(-1)
      } finally {
        if (currentRun === runIdRef.current) {
          setIsSearching(false)
        }
      }
    },
    [onSearch, onSelectMatch, onClearHighlight]
  )

  // Debounced live search when typing >= 2 characters
  useEffect(() => {
    if (!isSearchDrawerOpen) return
    const trimmed = query.trim()
    if (!trimmed) {
      runIdRef.current++
      setResults([])
      setSearchedQuery('')
      setActiveIndex(-1)
      setIsSearching(false)
      onClearHighlight()
      return
    }
    if (trimmed.length < 2) return

    const timer = setTimeout(() => {
      executeSearch(trimmed, false)
    }, 250)
    return () => clearTimeout(timer)
  }, [query, isSearchDrawerOpen, executeSearch, onClearHighlight])

  // Keep active result scrolled into view
  useEffect(() => {
    activeItemRef.current?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  const jumpToIndex = useCallback(
    (index: number) => {
      if (results.length === 0) return
      const wrapped = ((index % results.length) + results.length) % results.length
      setActiveIndex(wrapped)
      onSelectMatch(results[wrapped].cfi)
    },
    [results, onSelectMatch]
  )

  const handleClose = () => {
    onClearHighlight()
    toggleSearchDrawer(false)
  }

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const isClose =
      e.key === 'Escape' ||
      (e.altKey && !e.ctrlKey && !e.metaKey && (
        e.key === 'ArrowLeft' || e.key === '<' || e.key === ',' || e.code === 'Comma' || e.code === 'IntlBackslash' || e.key.toLowerCase() === 'x' || e.code === 'KeyX'
      ))
    if (isClose) {
      e.preventDefault()
      e.stopPropagation()
      handleClose()
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const trimmed = query.trim()
      if (!trimmed) return
      if (trimmed !== searchedQuery) {
        executeSearch(trimmed, true)
      } else if (results.length > 0) {
        const delta = e.shiftKey ? -1 : 1
        const nextIdx = activeIndex === -1 ? (e.shiftKey ? results.length - 1 : 0) : activeIndex + delta
        jumpToIndex(nextIdx)
      }
    }
  }

  if (!isSearchDrawerOpen) return null

  const topOffset = isImmersiveFullscreen ? 'top-0' : 'top-8'

  return (
    <>
      {/* Backdrop for click-outside dismissal */}
      <div
        className={`fixed inset-0 ${topOffset} bg-black/30 z-40 transition-opacity`}
        onClick={handleClose}
      />

      <aside
        className={`fixed ${topOffset} bottom-0 left-0 w-80 bg-[#171a21] border-r border-[#232732] z-50 flex flex-col shadow-2xl select-none app-no-drag animate-in slide-in-from-left duration-150`}
      >
        {/* Header */}
        <div className="h-10 bg-[#14161c] border-b border-[#232732] px-3 flex items-center justify-between shrink-0 app-no-drag">
          <div className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-[#2a69df]" />
            <span className="text-[13px] font-semibold text-white">Find in Book</span>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="app-no-drag w-6 h-6 flex items-center justify-center text-[#8b949e] hover:text-white hover:bg-[#282c37] rounded-[2px] transition-colors cursor-pointer"
            title="Close (Esc)"
          >
            <X className="w-4 h-4 pointer-events-none" />
          </button>
        </div>

        {/* Search Input & Match Stepper */}
        <div className="p-2.5 border-b border-[#232732] space-y-2 shrink-0">
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 text-[#6e7681] absolute left-2.5 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder="Search text in book..."
              className="ice-input w-full h-7 pl-8 pr-7 text-[12px] rounded-[2px] select-text"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery('')
                  focusInput()
                }}
                className="absolute right-1.5 w-5 h-5 flex items-center justify-center text-[#6e7681] hover:text-white rounded-[2px]"
                title="Clear search"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="flex items-center justify-between text-[11px] text-[#8b949e]">
            <div className="flex items-center gap-1.5">
              {isSearching ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin text-[#2a69df]" />
                  <span>Searching chapters...</span>
                </>
              ) : searchedQuery ? (
                <span>
                  {results.length === 0
                    ? 'No matches'
                    : activeIndex >= 0
                    ? `${activeIndex + 1} / ${results.length} matches`
                    : `${results.length} ${results.length === 1 ? 'match' : 'matches'}`}
                </span>
              ) : (
                <span className="text-[#6e7681]">Press Enter to find</span>
              )}
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={results.length === 0}
                onClick={() => jumpToIndex(activeIndex === -1 ? results.length - 1 : activeIndex - 1)}
                className="w-6 h-6 flex items-center justify-center rounded-[2px] bg-[#232732] hover:bg-[#2d323f] text-[#c8d1dc] disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
                title="Previous match (Shift+Enter)"
              >
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                disabled={results.length === 0}
                onClick={() => jumpToIndex(activeIndex === -1 ? 0 : activeIndex + 1)}
                className="w-6 h-6 flex items-center justify-center rounded-[2px] bg-[#232732] hover:bg-[#2d323f] text-[#c8d1dc] disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
                title="Next match (Enter)"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-1.5 space-y-1 text-[12px]">
          {!searchedQuery && !isSearching ? (
            <div className="text-center py-10 px-4 text-[#6e7681]">
              <p>Type a word or phrase to search across the entire book.</p>
              <p className="text-[11px] mt-1.5 text-[#484f58]">
                Enter: next match &middot; Shift+Enter: previous
              </p>
            </div>
          ) : results.length === 0 && !isSearching ? (
            <div className="text-center py-10 px-4 text-[#6e7681]">
              <p>No matches for &ldquo;{searchedQuery}&rdquo;</p>
            </div>
          ) : (
            results.map((item, idx) => {
              const isActive = idx === activeIndex
              return (
                <button
                  key={`${item.cfi}_${idx}`}
                  ref={isActive ? activeItemRef : null}
                  type="button"
                  onClick={() => jumpToIndex(idx)}
                  className={`w-full text-left p-2 rounded-[2px] border transition-colors space-y-1 cursor-pointer ${
                    isActive
                      ? 'bg-[#2a69df]/20 border-[#2a69df] text-white'
                      : 'bg-[#1f232d] hover:bg-[#252a36] border-[#2b2f3a] text-[#d8dee9]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-[10px] text-[#8b949e]">
                    <span className="truncate font-medium">{item.chapter}</span>
                    <span className="shrink-0 font-mono text-[#6e7681]">#{idx + 1}</span>
                  </div>
                  <div className="text-[12px] leading-snug line-clamp-3 font-serif text-[#e6edf3]">
                    {renderHighlightedExcerpt(item.excerpt.trim(), searchedQuery)}
                  </div>
                </button>
              )
            })
          )}
        </div>
      </aside>
    </>
  )
}
