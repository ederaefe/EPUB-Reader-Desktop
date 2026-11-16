import React, { useEffect, useRef, useState, useCallback } from 'react'
import ePub, { Book as EpubBook, Rendition } from 'epubjs'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useAppStore } from '../../stores/useAppStore'
import { db, type Book } from '../../db'
import { ReaderTopBar } from './ReaderTopBar'
import { TOCDrawer, type TocItem } from '../drawers/TOCDrawer'
import { NotesDrawer } from '../drawers/NotesDrawer'
import { BookmarksDrawer } from '../drawers/BookmarksDrawer'
import { SettingsDrawer } from '../drawers/SettingsDrawer'
import { SelectionPopup } from './SelectionPopup'
import { FootnotePopover } from './FootnotePopover'
import { AdaptiveScrollOverlay } from './AdaptiveScrollOverlay'
import { RSVPSpeedReaderModal } from './RSVPSpeedReaderModal'
import { adaptiveScrollEngine } from '../../services/adaptiveScrollService'
import { getWarmFilterOverlay } from '../../services/colorTempService'
import { splitIntoSentences } from '../../services/ttsService'

interface EpubReaderViewProps {
  book: Book
  onBack: () => void
}

export const EpubReaderView: React.FC<EpubReaderViewProps> = ({ book, onBack }) => {
  const viewerRef = useRef<HTMLDivElement>(null)
  const epubBookRef = useRef<EpubBook | null>(null)
  const renditionRef = useRef<Rendition | null>(null)

  const {
    settings,
    updateSettings,
    activeBookBuffer,
    isTTSActive,
    setTTSActive,
    isAutoscrollActive,
    setAutoscrollActive,
    isRSVPActive,
    toggleRSVP,
    activeFootnote,
    setActiveFootnote,
    toggleBookmarksDrawer
  } = useAppStore()

  const [toc, setToc] = useState<TocItem[]>([])
  const [currentChapter, setCurrentChapter] = useState('')
  const [currentHref, setCurrentHref] = useState('')
  const [currentCfi, setCurrentCfi] = useState<string>(book.progressCfi || '')
  const [currentPage, setCurrentPage] = useState<number>(book.currentPage || 13)
  const [totalPages, setTotalPages] = useState<number>(book.totalPages || 416)
  const [progressPercent, setProgressPercent] = useState<number>(book.progressPercent || 3)

  const [selectedText, setSelectedText] = useState<string | null>(null)
  const [selectedCfiRange, setSelectedCfiRange] = useState<string>('')
  const [selectionPos, setSelectionPos] = useState({ x: 0, y: 0 })
  const [isBottomHovered, setIsBottomHovered] = useState(false)
  const [chapterFullText, setChapterFullText] = useState('')

  // Theme palettes matching Semply Reader
  const themeStyles = {
    day: { bg: '#ffffff', text: '#202020', link: '#2a69df', bottomBg: '#f2f2f2', border: '#e1e4e8' },
    night: { bg: '#1c1f26', text: '#d8d8d8', link: '#79c0ff', bottomBg: '#14161c', border: '#232732' },
    'light-sepia': { bg: '#fbf0d9', text: '#5f4b32', link: '#8b5a2b', bottomBg: '#f2e5cb', border: '#e2d3b5' },
    'dark-sepia': { bg: '#2d261e', text: '#d5c7b3', link: '#e6c8a5', bottomBg: '#211c16', border: '#3d3429' }
  }

  const currentTheme = themeStyles[settings.theme] || themeStyles.night

  // Feature 5: Warm Blue Light Night Filter style
  const warmFilter = getWarmFilterOverlay(
    settings.warmFilterEnabled || false,
    settings.warmFilterTemp || 3200,
    settings.warmFilterIntensity || 40
  )

  // Attach smart footnote click interception and cadence wheel listener to iframe
  const attachIframeHooks = useCallback((contents: any) => {
    const doc = contents.document
    if (!doc) return

    // Feature 4: Smart footnote interception
    const noteLinks = doc.querySelectorAll(
      'a[epub\\:type~="noteref"], a[href*="#fn"], a[href*="#footnote"], a[role="doc-noteref"], sup a'
    )

    noteLinks.forEach((link: any) => {
      link.addEventListener('click', (e: MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        const href = link.getAttribute('href') || ''
        const hash = href.includes('#') ? href.split('#')[1] : ''
        let noteText = ''
        if (hash) {
          const targetElem = doc.getElementById(hash)
          if (targetElem) {
            noteText = targetElem.innerText.trim()
          }
        }
        if (!noteText) {
          noteText = link.getAttribute('title') || link.innerText || 'Footnote reference.'
        }
        setActiveFootnote({
          id: hash || 'fn',
          index: link.innerText.trim() || 'fn',
          text: noteText,
          href
        })
      })
    })

    // Feature 1: Cadence Behavioral Correction Wheel Listener
    let lastWheelTime = 0
    contents.window.addEventListener('wheel', (e: WheelEvent) => {
      const now = Date.now()
      if (now - lastWheelTime < 200) return
      lastWheelTime = now

      if (e.deltaY < -25) {
        // Back-scroll detected: User scrolled up -> decrease WPM (-15%)
        adaptiveScrollEngine.onBackScrollDetected()
      } else if (e.deltaY > 25) {
        // Forward nudge detected: User scrolling forward -> increase WPM (+10%)
        adaptiveScrollEngine.onForwardNudgeDetected()
      }
    }, { passive: true })

    // Idle suspension on blur or hovering over active links
    contents.window.addEventListener('blur', () => {
      adaptiveScrollEngine.setPaused(true)
    })
    contents.window.addEventListener('focus', () => {
      adaptiveScrollEngine.setPaused(false)
    })
  }, [setActiveFootnote])

  // Initialize ePub reader engine
  useEffect(() => {
    let isCancelled = false
    let epubInstance: EpubBook | null = null
    let renditionInstance: Rendition | null = null

    async function initReader() {
      if (!viewerRef.current) return
      viewerRef.current.innerHTML = ''

      let sourceData: any = activeBookBuffer
      if (!sourceData) {
        try {
          const resp = await fetch(book.filePath)
          sourceData = await resp.arrayBuffer()
        } catch {
          sourceData = book.filePath
        }
      }

      epubInstance = ePub(sourceData)
      epubBookRef.current = epubInstance

      // 1:1 Dual page spread support
      const isDouble = settings.pageSpread === 'double'
      renditionInstance = epubInstance.renderTo(viewerRef.current, {
        width: '100%',
        height: '100%',
        spread: isDouble ? 'always' : 'none',
        flow: 'paginated',
        minSpreadWidth: 800
      })
      renditionRef.current = renditionInstance

      // Register themes with exact CSS injection
      const registerThemes = () => {
        const fontFam =
          settings.fontFamily === 'serif'
            ? 'Georgia, serif'
            : settings.fontFamily === 'sans-serif'
            ? '"Segoe UI", sans-serif'
            : settings.fontFamily === 'monospace'
            ? 'Consolas, monospace'
            : 'inherit'

        const baseRules = {
          'html, body': {
            'font-family': `${fontFam} !important`,
            'font-size': `${settings.fontSize}px !important`,
            margin: '0 auto !important',
            padding: '24px 32px !important'
          },
          p: {
            'line-height': `${Math.round(settings.lineHeight * 100)}% !important`,
            'margin-bottom': '1em !important'
          },
          'span.bluenote': { 'background-color': '#aed9f1 !important', color: '#111 !important' },
          'span.purplenote': { 'background-color': '#ccb8e4 !important', color: '#111 !important' },
          'span.rednote': { 'background-color': '#f3a2a2 !important', color: '#111 !important' },
          'span.yellownote': { 'background-color': '#f3e3a2 !important', color: '#111 !important' },
          'span.greennote': { 'background-color': '#b1f3a4 !important', color: '#111 !important' },
          'span.underlinenote': { 'text-decoration': 'underline !important' },
          'span.speechActive': { 'background-color': '#f3e3a2 !important', color: '#111 !important' }
        }

        renditionInstance!.themes.register('night', {
          ...baseRules,
          body: { background: '#1c1f26 !important', color: '#d8d8d8 !important' },
          'p, div, span, li, blockquote': { color: '#d8d8d8 !important' },
          'h1, h2, h3, h4, h5': { color: '#f0f6fc !important' },
          a: { color: '#79c0ff !important' }
        })

        renditionInstance!.themes.register('day', {
          ...baseRules,
          body: { background: '#ffffff !important', color: '#202020 !important' },
          'p, div, span, li, blockquote': { color: '#202020 !important' },
          'h1, h2, h3, h4, h5': { color: '#000000 !important' },
          a: { color: '#2a69df !important' }
        })

        renditionInstance!.themes.register('light-sepia', {
          ...baseRules,
          body: { background: '#fbf0d9 !important', color: '#5f4b32 !important' },
          'p, div, span, li, blockquote': { color: '#5f4b32 !important' },
          'h1, h2, h3, h4, h5': { color: '#433422 !important' },
          a: { color: '#8b5a2b !important' }
        })

        renditionInstance!.themes.register('dark-sepia', {
          ...baseRules,
          body: { background: '#2d261e !important', color: '#d5c7b3 !important' },
          'p, div, span, li, blockquote': { color: '#d5c7b3 !important' },
          'h1, h2, h3, h4, h5': { color: '#ede3d5 !important' },
          a: { color: '#e6c8a5 !important' }
        })

        renditionInstance!.themes.select(settings.theme)
      }

      registerThemes()

      // Hook iframe rendered content
      renditionInstance.hooks.content.register((contents: any) => {
        attachIframeHooks(contents)
      })

      // Load Navigation TOC
      epubInstance.loaded.navigation.then((nav) => {
        if (isCancelled) return
        const items: TocItem[] = nav.toc.map((item, i) => ({
          id: item.id || `toc_${i}`,
          label: item.label,
          href: item.href
        }))
        setToc(items)
      })

      // Generate spine locations
      epubInstance.ready.then(() => {
        if (isCancelled) return
        return epubInstance?.locations.generate(1000)
      }).then(() => {
        if (isCancelled) return
        const total = (epubInstance?.locations as any)?.total || 416
        setTotalPages(total)
      }).catch(() => {})

      // Display initial position
      const startLocation = book.progressCfi || undefined
      await renditionInstance.display(startLocation)

      // Inject Librera CSS normalization layer
      fetch('/src/assets/app-Librera.css')
        .then((res) => res.text())
        .then((css) => {
          if (isCancelled) return
          ;(renditionInstance?.getContents() as any)?.forEach?.((contents: any) => {
            const style = contents.document.createElement('style')
            style.textContent = css
            contents.document.head.appendChild(style)
          })
        })
        .catch(() => {})

      // Relocation listener
      renditionInstance.on('relocated', (location: any) => {
        if (isCancelled || !location || !location.start) return
        const cfi = location.start.cfi
        setCurrentCfi(cfi)

        const pct = Math.round((location.start.percentage || 0) * 100)
        setProgressPercent(pct)

        const displayedPage = location.start.displayed?.page || Math.max(1, Math.round((pct / 100) * totalPages))
        setCurrentPage(displayedPage)

        if (location.start.href) {
          setCurrentHref(location.start.href)
          const matching = toc.find((t) => location.start.href.includes(t.href))
          if (matching) setCurrentChapter(matching.label)
        }

        // Cache chapter full text for RSVP speed reader
        const iframeDoc = (renditionInstance?.getContents()?.[0] as any)?.document
        if (iframeDoc?.body?.innerText) {
          setChapterFullText(iframeDoc.body.innerText)
        }

        if (book.id) {
          db.books.update(book.id, {
            progressCfi: cfi,
            progressPercent: pct,
            currentPage: displayedPage,
            lastOpenedAt: Date.now()
          })
        }
      })

      // Selection listener for notes & highlights
      renditionInstance.on('selected', (cfiRange: string, contents: any) => {
        if (isCancelled) return
        const selection = contents.window.getSelection()
        const text = selection?.toString().trim()
        if (text) {
          setSelectedText(text)
          setSelectedCfiRange(cfiRange)
          const range = selection?.getRangeAt(0)
          const rect = range?.getBoundingClientRect()
          const iframeRect = viewerRef.current?.getBoundingClientRect()
          if (rect && iframeRect) {
            setSelectionPos({
              x: iframeRect.left + rect.left + rect.width / 2,
              y: iframeRect.top + rect.top
            })
          }
        }
      })
    }

    initReader()

    return () => {
      isCancelled = true
      renditionInstance?.destroy()
    }
  }, [book, activeBookBuffer, settings.pageSpread, attachIframeHooks])

  // Synchronize dynamic settings
  useEffect(() => {
    if (!renditionRef.current) return
    renditionRef.current.themes.select(settings.theme)
    renditionRef.current.themes.fontSize(`${settings.fontSize}px`)
    renditionRef.current.themes.default({
      'html, body': {
        'font-family':
          settings.fontFamily === 'serif'
            ? 'Georgia, serif !important'
            : settings.fontFamily === 'sans-serif'
            ? '"Segoe UI", sans-serif !important'
            : settings.fontFamily === 'monospace'
            ? 'Consolas, monospace !important'
            : 'inherit'
      },
      p: {
        'line-height': `${Math.round(settings.lineHeight * 100)}% !important`
      }
    })
  }, [settings.theme, settings.fontSize, settings.lineHeight, settings.fontFamily])

  const handleNext = useCallback(() => renditionRef.current?.next(), [])
  const handlePrev = useCallback(() => renditionRef.current?.prev(), [])

  // Feature 1: Adaptive Auto-Scroll Engine Loop
  useEffect(() => {
    if (!isAutoscrollActive) return

    let cancelled = false
    let timerId: any = null

    const schedulePageTurn = () => {
      if (cancelled) return
      const iframeDoc = (renditionRef.current?.getContents()?.[0] as any)?.document
      const bodyText = iframeDoc?.body?.innerText || ''
      const wordCount = bodyText.split(/\s+/).filter(Boolean).length || 180

      const durationMs = adaptiveScrollEngine.calculateBlockDurationMs(wordCount)
      const hasBreak = !!iframeDoc?.querySelector('hr, .section-break, .break')

      timerId = setTimeout(() => {
        if (cancelled) return
        if (hasBreak) {
          adaptiveScrollEngine.triggerMicroPause(() => {
            if (!cancelled) handleNext()
          })
        } else {
          handleNext()
        }
      }, durationMs)
    }

    schedulePageTurn()

    return () => {
      cancelled = true
      if (timerId) clearTimeout(timerId)
    }
  }, [isAutoscrollActive, currentCfi, handleNext])

  // Keyboard Navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault()
        handleNext()
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp' || e.key === 'Backspace') {
        e.preventDefault()
        handlePrev()
      } else if (e.key === 'Home') {
        e.preventDefault()
        renditionRef.current?.display(0)
      } else if (e.key === 'F9') {
        e.preventDefault()
        const themes: Array<'day' | 'night' | 'light-sepia' | 'dark-sepia'> = [
          'day',
          'night',
          'light-sepia',
          'dark-sepia'
        ]
        const nextTheme = themes[(themes.indexOf(settings.theme) + 1) % themes.length]
        updateSettings({ theme: nextTheme })
      } else if (e.key === 'F10') {
        e.preventDefault()
        updateSettings({
          pageSpread: settings.pageSpread === 'double' ? 'single' : 'double'
        })
      } else if (e.ctrlKey && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        toggleBookmarksDrawer(true)
      } else if (e.key === 'Escape') {
        e.preventDefault()
        if (activeFootnote) {
          setActiveFootnote(null)
        } else if (isAutoscrollActive) {
          setAutoscrollActive(false)
        } else {
          onBack()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleNext, handlePrev, settings.theme, settings.pageSpread, updateSettings, toggleBookmarksDrawer, activeFootnote, isAutoscrollActive, setAutoscrollActive, setActiveFootnote, onBack])

  const handleSelectChapter = (href: string) => {
    renditionRef.current?.display(href)
  }

  const handleJumpToCfi = (cfi: string) => {
    renditionRef.current?.display(cfi)
  }

  const handleAddAnnotation = async (color: 'blue' | 'purple' | 'red' | 'yellow' | 'green' | 'underline') => {
    if (!book.id || !selectedText) return
    await db.annotations.add({
      bookId: book.id,
      cfiRange: selectedCfiRange,
      text: selectedText,
      note: '',
      color,
      createdAt: Date.now()
    })
    renditionRef.current?.annotations?.highlight(
      selectedCfiRange,
      {},
      () => {},
      `${color}note`
    )
    setSelectedText(null)
  }

  const handleAddNote = async (note: string) => {
    if (!book.id || !selectedText) return
    await db.annotations.add({
      bookId: book.id,
      cfiRange: selectedCfiRange,
      text: selectedText,
      note,
      color: 'blue',
      createdAt: Date.now()
    })
    renditionRef.current?.annotations?.highlight(
      selectedCfiRange,
      {},
      () => {},
      'bluenote'
    )
    setSelectedText(null)
  }

  return (
    <div
      style={{ backgroundColor: currentTheme.bg }}
      className="flex-1 flex flex-col h-full relative overflow-hidden select-none transition-colors duration-200"
    >
      {/* Top Docked Header */}
      <ReaderTopBar onBack={onBack} currentChapter={currentChapter} />

      {/* Main Reading Viewport */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        {/* Subtle Left Prev Page button */}
        <button
          onClick={handlePrev}
          className="absolute left-2 z-30 w-8 h-12 rounded flex items-center justify-center bg-black/20 hover:bg-black/40 text-white/50 hover:text-white transition-opacity opacity-0 hover:opacity-100"
          title="Previous Page (Left Arrow / Page Up)"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {/* EPUB Mount Point */}
        <div
          ref={viewerRef}
          className="w-full h-full max-w-6xl mx-auto relative"
        />

        {/* Center Gutter Divider for Double Page Spread */}
        {settings.pageSpread === 'double' && (
          <div
            style={{ backgroundColor: currentTheme.border }}
            className="absolute left-1/2 top-4 bottom-4 w-px pointer-events-none opacity-40"
          />
        )}

        {/* Subtle Right Next Page button */}
        <button
          onClick={handleNext}
          className="absolute right-2 z-30 w-8 h-12 rounded flex items-center justify-center bg-black/20 hover:bg-black/40 text-white/50 hover:text-white transition-opacity opacity-0 hover:opacity-100"
          title="Next Page (Right Arrow / Space / Page Down)"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Dimming Overlay */}
      {settings.dimming > 0 && (
        <div
          style={{ opacity: settings.dimming / 100 }}
          className="fixed inset-0 bg-black pointer-events-none z-30 transition-opacity"
        />
      )}

      {/* Feature 5: Warm Blue Light Night Filter Overlay (isEnableBlueFilterNight) */}
      {warmFilter && (
        <div
          style={{
            backgroundColor: warmFilter.backgroundColor,
            opacity: warmFilter.opacity
          }}
          className="fixed inset-0 pointer-events-none z-30 transition-opacity duration-300 mix-blend-multiply"
        />
      )}

      {/* Feature 1: Adaptive Auto-Scroll HUD Overlay */}
      <AdaptiveScrollOverlay
        isActive={isAutoscrollActive}
        onToggle={() => adaptiveScrollEngine.setPaused(!adaptiveScrollEngine.getMetrics().isPaused)}
        onClose={() => setAutoscrollActive(false)}
      />

      {/* Bottom Floating Progress Area */}
      <footer
        onMouseEnter={() => setIsBottomHovered(true)}
        onMouseLeave={() => setIsBottomHovered(false)}
        className="h-10 px-6 flex flex-col justify-end pb-2 relative z-30 select-none transition-all duration-200"
      >
        {isBottomHovered ? (
          <div className="w-full flex flex-col gap-1 animate-fadeIn">
            <div className="text-[12px] text-white font-medium pl-0.5">
              {currentPage || 15} / {totalPages || 507}
            </div>
            <div className="w-full relative flex items-center h-4">
              <input
                type="range"
                min="0"
                max="100"
                value={progressPercent || 3}
                onChange={(e) => {
                  const val = Number(e.target.value)
                  setProgressPercent(val)
                  const cfi = epubBookRef.current?.locations.cfiFromPercentage(val / 100)
                  if (cfi) renditionRef.current?.display(cfi)
                }}
                className="w-full accent-[#2a69df] h-1 bg-[#323744] rounded-full cursor-pointer appearance-none"
              />
            </div>
          </div>
        ) : (
          <div className="w-full flex items-center justify-center pb-1 gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#383d4a]" />
            <span className="w-1.5 h-1.5 rounded-full bg-[#383d4a]" />
            <span className="w-1.5 h-1.5 rounded-full bg-[#6e7681]" />
            <span className="w-1.5 h-1.5 rounded-full bg-[#383d4a]" />
            <span className="w-1.5 h-1.5 rounded-full bg-[#383d4a]" />
          </div>
        )}
      </footer>

      {/* Sliding Drawers */}
      <TOCDrawer
        toc={toc}
        currentHref={currentHref}
        onSelectChapter={handleSelectChapter}
      />
      <NotesDrawer onJumpToCfi={handleJumpToCfi} />
      <BookmarksDrawer
        currentPage={currentPage}
        currentCfi={currentCfi}
        onJumpToCfi={handleJumpToCfi}
      />
      <SettingsDrawer />

      {/* Feature 4: Footnote Popover Modal */}
      {activeFootnote && (
        <FootnotePopover
          footnote={activeFootnote}
          onClose={() => setActiveFootnote(null)}
          onJumpToNote={(href) => handleSelectChapter(href)}
        />
      )}

      {/* Feature 3: RSVP Speed Reading Modal (Optimal Recognition Point) */}
      <RSVPSpeedReaderModal
        isOpen={isRSVPActive}
        onClose={() => toggleRSVP(false)}
        initialText={chapterFullText || book.title}
        title={currentChapter || book.title}
      />

      {/* Inline Selection & Dictionary Popup */}
      {selectedText && (
        <SelectionPopup
          selectedText={selectedText}
          position={selectionPos}
          onClose={() => setSelectedText(null)}
          onHighlight={handleAddAnnotation}
          onAddNote={handleAddNote}
        />
      )}
    </div>
  )
}
