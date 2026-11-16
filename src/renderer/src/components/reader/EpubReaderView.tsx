import React, { useEffect, useRef, useState, useCallback } from 'react'
import ePub, { Book as EpubBook, Rendition } from 'epubjs'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useAppStore } from '../../stores/useAppStore'
import { db, type Book } from '../../db'
import { ReaderTopBar } from './ReaderTopBar'
import { TOCDrawer, type TocItem } from '../drawers/TOCDrawer'
import { SettingsDrawer } from '../drawers/SettingsDrawer'
import { SelectionPopup } from './SelectionPopup'

interface EpubReaderViewProps {
  book: Book
  onBack: () => void
}

export const EpubReaderView: React.FC<EpubReaderViewProps> = ({ book, onBack }) => {
  const viewerRef = useRef<HTMLDivElement>(null)
  const epubBookRef = useRef<EpubBook | null>(null)
  const renditionRef = useRef<Rendition | null>(null)

  const { settings, activeBookBuffer, isAutoscrollActive, setAutoscrollActive } = useAppStore()

  const [toc, setToc] = useState<TocItem[]>([])
  const [currentChapter, setCurrentChapter] = useState('')
  const [progressPercent, setProgressPercent] = useState(book.progressPercent || 0)
  const [selectedText, setSelectedText] = useState<string | null>(null)
  const [selectionPos, setSelectionPos] = useState({ x: 0, y: 0 })

  // Initialize ePub
  useEffect(() => {
    if (!viewerRef.current || !activeBookBuffer) return

    viewerRef.current.innerHTML = ''
    const epub = ePub(activeBookBuffer)
    epubBookRef.current = epub

    const isDouble = settings.pageSpread === 'double'
    const rendition = epub.renderTo(viewerRef.current, {
      width: '100%',
      height: '100%',
      spread: isDouble ? 'auto' : 'none',
      flow: 'paginated'
    })
    renditionRef.current = rendition

    // Register Themes
    rendition.themes.register('night', {
      body: { background: '#111827 !important', color: '#d1d5db !important' },
      'p, div, span': { color: '#d1d5db !important' },
      'h1, h2, h3, h4': { color: '#f3f4f6 !important' }
    })
    rendition.themes.register('day', {
      body: { background: '#f9f9f7 !important', color: '#1a1a1a !important' },
      'p, div, span': { color: '#1a1a1a !important' },
      'h1, h2, h3, h4': { color: '#000000 !important' }
    })
    rendition.themes.register('light-sepia', {
      body: { background: '#fbf0d9 !important', color: '#5f4b32 !important' },
      'p, div, span': { color: '#5f4b32 !important' },
      'h1, h2, h3, h4': { color: '#433422 !important' }
    })
    rendition.themes.register('dark-sepia', {
      body: { background: '#2b2621 !important', color: '#d5c7b3 !important' },
      'p, div, span': { color: '#d5c7b3 !important' },
      'h1, h2, h3, h4': { color: '#ede3d5 !important' }
    })

    rendition.themes.select(settings.theme)
    rendition.themes.fontSize(`${settings.fontSize}px`)

    // Load TOC
    epub.loaded.navigation.then((nav) => {
      const items: TocItem[] = nav.toc.map((item) => ({
        id: item.id,
        label: item.label,
        href: item.href
      }))
      setToc(items)
    })

    // Display initial position
    const startCfi = book.progressCfi || undefined
    rendition.display(startCfi).then(() => {
      // Apply Librera typography normalization CSS
      fetch('/src/assets/app-Librera.css')
        .then((res) => res.text())
        .then((css) => {
          ;(rendition.getContents() as any).forEach((contents: any) => {
            const style = contents.document.createElement('style')
            style.textContent = css
            contents.document.head.appendChild(style)
          })
        })
        .catch(() => {})
    })

    // Track Relocation & Progress
    rendition.on('relocated', (location: any) => {
      if (!location || !location.start) return
      const cfi = location.start.cfi
      const pct = Math.round((location.start.percentage || 0) * 100)
      setProgressPercent(pct)

      if (book.id) {
        db.books.update(book.id, {
          progressCfi: cfi,
          progressPercent: pct,
          lastOpenedAt: Date.now()
        })
      }

      // Find current chapter from TOC
      if (location.start.href) {
        const matching = toc.find((t) => location.start.href.includes(t.href))
        if (matching) setCurrentChapter(matching.label)
      }
    })

    // Text selection listener
    rendition.on('selected', (cfiRange: string, contents: any) => {
      const selection = contents.window.getSelection()
      const text = selection?.toString().trim()
      if (text) {
        setSelectedText(text)
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

    return () => {
      rendition.destroy()
    }
  }, [activeBookBuffer])

  // Update Settings in Rendition
  useEffect(() => {
    if (!renditionRef.current) return
    renditionRef.current.themes.select(settings.theme)
    renditionRef.current.themes.fontSize(`${settings.fontSize}px`)
    renditionRef.current.themes.default({
      'p, li, blockquote': {
        'line-height': `${settings.lineHeight} !important`,
        'font-family':
          settings.fontFamily === 'serif'
            ? 'Georgia, Cambria, serif !important'
            : settings.fontFamily === 'sans-serif'
            ? 'Inter, system-ui, sans-serif !important'
            : 'Consolas, monospace !important'
      }
    })
  }, [settings.theme, settings.fontSize, settings.lineHeight, settings.fontFamily])

  // Handle Autoscroll
  useEffect(() => {
    if (!isAutoscrollActive) return
    const interval = setInterval(() => {
      renditionRef.current?.next()
    }, Math.max(1000, 60000 / (settings.autoscrollSpeed || 40)))

    return () => clearInterval(interval)
  }, [isAutoscrollActive, settings.autoscrollSpeed])

  const handleNext = () => renditionRef.current?.next()
  const handlePrev = () => renditionRef.current?.prev()

  const handleSelectChapter = (href: string) => {
    renditionRef.current?.display(href)
  }

  const handleAddAnnotation = async (color: 'yellow' | 'green' | 'blue' | 'pink' | 'purple') => {
    if (!book.id || !selectedText) return
    await db.annotations.add({
      bookId: book.id,
      cfiRange: '',
      text: selectedText,
      note: '',
      color,
      createdAt: Date.now()
    })
    setSelectedText(null)
  }

  const handleAddNote = async (note: string) => {
    if (!book.id || !selectedText) return
    await db.annotations.add({
      bookId: book.id,
      cfiRange: '',
      text: selectedText,
      note,
      color: 'blue',
      createdAt: Date.now()
    })
    setSelectedText(null)
  }

  return (
    <div className="flex-1 flex flex-col h-full relative overflow-hidden bg-black/40">
      {/* Top Bar */}
      <ReaderTopBar onBack={onBack} currentChapter={currentChapter} />

      {/* Reader Container */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        {/* Previous page zone */}
        <button
          onClick={handlePrev}
          className="absolute left-2 z-30 p-2.5 rounded-full bg-black/40 hover:bg-black/80 text-white/50 hover:text-white backdrop-blur-md opacity-0 hover:opacity-100 transition-all duration-200"
          title="Previous Page (Left Arrow)"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {/* EPUB Mount Point */}
        <div ref={viewerRef} className="w-full h-full max-w-5xl mx-auto" />

        {/* Next page zone */}
        <button
          onClick={handleNext}
          className="absolute right-2 z-30 p-2.5 rounded-full bg-black/40 hover:bg-black/80 text-white/50 hover:text-white backdrop-blur-md opacity-0 hover:opacity-100 transition-all duration-200"
          title="Next Page (Right Arrow)"
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

      {/* Thin Bottom Progress Strip */}
      <div className="h-1 w-full bg-white/10 relative z-40">
        <div
          className="h-full bg-blue-500 transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Drawers & Selection Popup */}
      <TOCDrawer toc={toc} onSelectChapter={handleSelectChapter} />
      <SettingsDrawer />

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
