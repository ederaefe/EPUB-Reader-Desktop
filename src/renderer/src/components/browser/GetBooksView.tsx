import React, { useState, useEffect, useRef } from 'react'
import {
  Globe,
  Home,
  ChevronLeft,
  ChevronRight,
  RotateCw,
  ExternalLink,
  Lock,
  Download,
  Trash2,
  WifiOff,
  Search,
  CheckCircle2,
  ShieldCheck,
  BookOpen
} from 'lucide-react'
import { NewSiteCard } from './NewSiteCard'
import { db } from '../../db'
import { extractBookMetadata } from '../../services/coverService'
import { useAppStore } from '../../stores/useAppStore'

export interface BookPortal {
  id: string
  name: string
  url: string
  hostname: string
  description: string
  formats: string[]
  tags: string[]
  rank?: number
  isCustom?: boolean
}

const VERIFIED_PORTALS: BookPortal[] = [
  {
    id: 'standard-ebooks',
    name: 'Standard Ebooks',
    url: 'https://standardebooks.org/',
    hostname: 'standardebooks.org',
    description: 'Carefully formatted public domain ebooks with professional typography and high-resolution historical covers.',
    formats: ['EPUB', 'Kindle'],
    tags: ['Public Domain', 'Crafted'],
    rank: 1
  },
  {
    id: 'project-gutenberg',
    name: 'Project Gutenberg',
    url: 'https://www.gutenberg.org/',
    hostname: 'gutenberg.org',
    description: 'The world’s oldest digital library featuring over 75,000 free public domain ebooks and literature.',
    formats: ['EPUB', 'PDF', 'Kindle'],
    tags: ['Classics', '75k+ Books'],
    rank: 2
  },
  {
    id: 'open-library',
    name: 'Open Library',
    url: 'https://openlibrary.org/',
    hostname: 'openlibrary.org',
    description: 'Internet Archive’s universal digital catalog offering classic downloads and digital lending.',
    formats: ['EPUB', 'PDF'],
    tags: ['Universal Catalog', 'Archive'],
    rank: 3
  },
  {
    id: 'librivox',
    name: 'LibriVox',
    url: 'https://librivox.org/',
    hostname: 'librivox.org',
    description: 'Free public domain audiobooks and digitized texts recorded and cataloged by volunteers worldwide.',
    formats: ['Audio', 'Text'],
    tags: ['Community', 'Audiobooks'],
    rank: 4
  },
  {
    id: 'manybooks',
    name: 'ManyBooks',
    url: 'https://manybooks.net/',
    hostname: 'manybooks.net',
    description: 'Extensive library of over 50,000 free digital books spanning classic fiction, romance, and non-fiction.',
    formats: ['EPUB', 'PDF'],
    tags: ['Multi-Genre', '50k+ Books'],
    rank: 5
  },
  {
    id: 'ocean-of-pdf',
    name: 'Ocean of PDF',
    url: 'https://oceanofpdf.com/',
    hostname: 'oceanofpdf.com',
    description: 'Vast digital catalog of contemporary publications, web fiction, and non-fiction ebooks.',
    formats: ['EPUB', 'PDF'],
    tags: ['Community Index'],
    rank: 6
  },
  {
    id: 'pdf-drive',
    name: 'PDF Drive',
    url: 'https://pdfdrive.com/',
    hostname: 'pdfdrive.com',
    description: 'Large search engine for PDF documents, manuals, tutorials, and literature.',
    formats: ['PDF'],
    tags: ['Documents & Guides'],
    rank: 7
  },
  {
    id: 'd-pdf',
    name: 'D-PDF',
    url: 'https://d-pdf.com/',
    hostname: 'd-pdf.com',
    description: 'Direct digital PDF downloads for academic papers, literature, guides, and ebooks.',
    formats: ['PDF'],
    tags: ['Direct PDF'],
    rank: 8
  },
  {
    id: 'read-any-book',
    name: 'ReadAnyBook',
    url: 'https://lib.readanybook.com/en/ebook/',
    hostname: 'lib.readanybook.com',
    description: 'Read popular literature online in your browser or download digital copies.',
    formats: ['Web', 'EPUB'],
    tags: ['Web & EPUB'],
    rank: 9
  },
  {
    id: 'bdebooks',
    name: 'BDEBooks',
    url: 'https://bdebooks.com/en/ebooks/',
    hostname: 'bdebooks.com',
    description: 'Curated collection of regional literature, international fiction, and educational ebooks.',
    formats: ['PDF', 'EPUB'],
    tags: ['Regional & World'],
    rank: 10
  }
]

const CUSTOM_SITES_STORAGE_KEY = 'semply_custom_book_sites'

interface GetBooksViewProps {
  onBookImported?: () => void
}

export const GetBooksView: React.FC<GetBooksViewProps> = ({ onBookImported }) => {
  const showToast = useAppStore((s) => s.showToast)
  const openConfirmDialog = useAppStore((s) => s.openConfirmDialog)

  const [customSites, setCustomSites] = useState<BookPortal[]>([])
  const [activeUrl, setActiveUrl] = useState<string | null>(null)
  const [currentDomain, setCurrentDomain] = useState<string>('')
  const [canGoBack, setCanGoBack] = useState(false)
  const [canGoForward, setCanGoForward] = useState(false)
  const [isLoadingWeb, setIsLoadingWeb] = useState(false)
  const [isOfflineError, setIsOfflineError] = useState(false)
  const [searchFilter, setSearchFilter] = useState('')

  // Live download indicator state
  const [activeDownload, setActiveDownload] = useState<{
    id: string
    filename: string
    percent: number
    state: string
  } | null>(null)

  const webviewRef = useRef<any>(null)

  // Hydrate custom sites from localStorage and sync to main process domain allowlist
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CUSTOM_SITES_STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as BookPortal[]
        setCustomSites(parsed)
        syncCustomDomainsToMain(parsed)
      }
    } catch {
      // Ignore parse errors
    }
  }, [])

  const syncCustomDomainsToMain = (sites: BookPortal[]) => {
    const hostnames = sites.map((s) => s.hostname).filter(Boolean)
    if (window.desktopAPI?.bookBrowser?.setCustomDomains) {
      window.desktopAPI.bookBrowser.setCustomDomains(hostnames).catch(() => {})
    }
  }

  const handleAddCustomSite = (site: { id: string; name: string; url: string; hostname: string }) => {
    const newPortal: BookPortal = {
      id: site.id,
      name: site.name,
      url: site.url,
      hostname: site.hostname,
      description: 'Personal verified book archive or server.',
      formats: ['EPUB', 'PDF'],
      tags: ['Custom Server'],
      isCustom: true
    }
    const updated = [newPortal, ...customSites]
    setCustomSites(updated)
    try {
      localStorage.setItem(CUSTOM_SITES_STORAGE_KEY, JSON.stringify(updated))
    } catch {}
    syncCustomDomainsToMain(updated)
    showToast(`Added "${site.name}" to Book Sites`, 'success')
  }

  const handleDeleteCustomSite = (e: React.MouseEvent, siteId: string) => {
    e.stopPropagation()
    const target = customSites.find((s) => s.id === siteId)
    openConfirmDialog({
      title: `Remove "${target?.name || 'Site'}"?`,
      message: 'Are you sure you want to remove this website from your book sources list?',
      confirmLabel: 'Remove',
      cancelLabel: 'Cancel',
      danger: true,
      onConfirm: () => {
        const updated = customSites.filter((s) => s.id !== siteId)
        setCustomSites(updated)
        try {
          localStorage.setItem(CUSTOM_SITES_STORAGE_KEY, JSON.stringify(updated))
        } catch {}
        syncCustomDomainsToMain(updated)
        showToast('Website removed from sources', 'info')
      }
    })
  }

  // Download listeners & auto-import directly into Semply Library
  useEffect(() => {
    if (!window.desktopAPI?.bookBrowser) return

    const unsubProgress = window.desktopAPI.bookBrowser.onDownloadProgress((data) => {
      setActiveDownload({
        id: data.id,
        filename: data.filename,
        percent: data.percent,
        state: data.state
      })
    })

    const unsubCompleted = window.desktopAPI.bookBrowser.onDownloadCompleted(async (data) => {
      setActiveDownload(null)
      try {
        const ext = data.filename.split('.').pop()?.toLowerCase() || 'epub'
        const format = ext === 'pdf' ? 'pdf' : ext === 'mobi' ? 'mobi' : 'epub'

        let buffer: ArrayBuffer | null = null
        if (window.desktopAPI.readFileBuffer) {
          buffer = await window.desktopAPI.readFileBuffer(data.filePath)
        }

        const rawName = data.filename.replace(/\.[^/.]+$/, '')
        const meta = buffer
          ? await extractBookMetadata(buffer, ext, rawName)
          : { title: rawName, author: 'Unknown Author', coverDataUrl: null, totalPages: 100 }

        // Automatically index into library with isNewDownload flag for green dot
        await db.books.add({
          filePath: data.filePath,
          title: meta.title,
          author: meta.author,
          coverDataUrl: meta.coverDataUrl,
          format,
          fileSize: data.fileSize || 0,
          addedAt: Date.now(), // Floats naturally to the top of "All Books"
          lastOpenedAt: null,
          progressCfi: null,
          progressPercent: 0,
          currentPage: 1,
          totalPages: meta.totalPages || 100,
          categoryId: null,
          isFavorite: false,
          isRead: false,
          isNewDownload: true, // WhatsApp-style green unread badge!
          isPinned: false,
          pinnedAt: null,
          metadataHydrated: true
        })

        if (onBookImported) onBookImported()
        showToast(`Downloaded "${meta.title}" to Downloads folder. Added to library.`, 'success')
      } catch (err: any) {
        showToast(`Book downloaded, but auto-import encountered an error: ${err?.message}`, 'error')
      }
    })

    const unsubFailed = window.desktopAPI.bookBrowser.onDownloadFailed((data) => {
      setActiveDownload(null)
      showToast(`Download failed for "${data.filename}": ${data.error}`, 'error')
    })

    const unsubBlocked = window.desktopAPI.bookBrowser.onNavigationBlocked((data) => {
      showToast(`Navigation blocked: "${data.hostname}" is not on the verified book sources list.`, 'info')
    })

    return () => {
      unsubProgress?.()
      unsubCompleted?.()
      unsubFailed?.()
      unsubBlocked?.()
    }
  }, [onBookImported, showToast])

  // Attach webview DOM listeners
  useEffect(() => {
    const webview = webviewRef.current
    if (!webview) return

    const handleStartLoading = () => {
      setIsLoadingWeb(true)
      setIsOfflineError(false)
    }

    const handleStopLoading = () => {
      setIsLoadingWeb(false)
      try {
        setCanGoBack(webview.canGoBack?.() || false)
        setCanGoForward(webview.canGoForward?.() || false)
        const currentUrl = webview.getURL?.() || ''
        if (currentUrl) {
          const parsed = new URL(currentUrl)
          setCurrentDomain(parsed.hostname)
        }
      } catch {}
    }

    const handleFailLoad = (e: any) => {
      setIsLoadingWeb(false)
      // Disregard aborted navigations (code -3) e.g. when initiating file downloads or redirects
      if (e.errorCode !== -3) {
        setIsOfflineError(true)
      }
    }

    webview.addEventListener('did-start-loading', handleStartLoading)
    webview.addEventListener('did-stop-loading', handleStopLoading)
    webview.addEventListener('did-fail-load', handleFailLoad)

    return () => {
      webview.removeEventListener('did-start-loading', handleStartLoading)
      webview.removeEventListener('did-stop-loading', handleStopLoading)
      webview.removeEventListener('did-fail-load', handleFailLoad)
    }
  }, [activeUrl])

  const handleOpenPortal = (portal: BookPortal) => {
    setActiveUrl(portal.url)
    setCurrentDomain(portal.hostname)
    setIsOfflineError(false)
  }

  const handleReturnHome = () => {
    setActiveUrl(null)
    setCurrentDomain('')
    setIsOfflineError(false)
  }

  const handleWebBack = () => {
    if (webviewRef.current?.canGoBack?.()) webviewRef.current.goBack()
  }

  const handleWebForward = () => {
    if (webviewRef.current?.canGoForward?.()) webviewRef.current.goForward()
  }

  const handleWebReload = () => {
    setIsOfflineError(false)
    if (webviewRef.current?.reload) webviewRef.current.reload()
  }

  const handleOpenExternal = () => {
    if (activeUrl && window.desktopAPI?.openExternal) {
      window.desktopAPI.openExternal(activeUrl)
    }
  }

  // Combined Directory List (Custom sites first, then Ranked #1..#10)
  const allPortals = [...customSites, ...VERIFIED_PORTALS]
  const filteredPortals = allPortals.filter((p) => {
    if (!searchFilter.trim()) return true
    const q = searchFilter.toLowerCase()
    return (
      p.name.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.tags.some((t) => t.toLowerCase().includes(q))
    )
  })

  return (
    <div className="flex-1 flex flex-col h-full bg-[var(--app-bg)] overflow-hidden select-none relative">
      {/* ----------------------------------------------------------------- */}
      {/* Mode A: In-App Browser View                                       */}
      {/* ----------------------------------------------------------------- */}
      {activeUrl ? (
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          {/* Top Browser Chrome Bar */}
          <div className="h-10 bg-[var(--app-chrome)] border-b border-[var(--app-border)] px-3 flex items-center justify-between gap-3 shrink-0">
            {/* Left Controls: Home, Back, Forward, Reload */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={handleReturnHome}
                title="Return to Directory Hub"
                className="w-7 h-7 rounded flex items-center justify-center text-[var(--app-text-muted)] hover:text-[var(--app-text-strong)] hover:bg-[var(--app-surface-hover)] transition-colors"
              >
                <Home className="w-4 h-4" />
              </button>
              <div className="h-4 w-px bg-[var(--app-border)] mx-1" />
              <button
                type="button"
                onClick={handleWebBack}
                disabled={!canGoBack}
                title="Back"
                className="w-7 h-7 rounded flex items-center justify-center text-[var(--app-text-muted)] hover:text-[var(--app-text-strong)] hover:bg-[var(--app-surface-hover)] disabled:opacity-30 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleWebForward}
                disabled={!canGoForward}
                title="Forward"
                className="w-7 h-7 rounded flex items-center justify-center text-[var(--app-text-muted)] hover:text-[var(--app-text-strong)] hover:bg-[var(--app-surface-hover)] disabled:opacity-30 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleWebReload}
                title="Reload"
                className={`w-7 h-7 rounded flex items-center justify-center text-[var(--app-text-muted)] hover:text-[var(--app-text-strong)] hover:bg-[var(--app-surface-hover)] transition-colors ${
                  isLoadingWeb ? 'animate-spin text-[var(--app-accent)]' : ''
                }`}
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Center Domain Badge & Sandboxed Lock */}
            <div className="flex items-center gap-1.5 px-3 py-1 bg-[var(--app-surface)] border border-[var(--app-border)] rounded-full text-xs max-w-sm truncate">
              <Lock className="w-3 h-3 text-emerald-400 shrink-0" />
              <span className="font-mono text-[11px] text-[var(--app-text-strong)] truncate">
                {currentDomain || 'Sandboxed Book Portal'}
              </span>
              <span className="text-[10px] text-[var(--app-text-muted)] font-sans hidden sm:inline">
                • Safe Egress
              </span>
            </div>

            {/* Right Controls: Open Externally & Download Pill */}
            <div className="flex items-center gap-2 shrink-0">
              {activeDownload && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--app-accent)]/15 border border-[var(--app-accent)]/30 text-[11px] text-[var(--app-accent-text)] animate-pulse">
                  <Download className="w-3.5 h-3.5 animate-bounce" />
                  <span className="tabular-nums font-mono font-medium">
                    {activeDownload.percent}%
                  </span>
                </div>
              )}
              <button
                type="button"
                onClick={handleOpenExternal}
                title="Open in System Browser"
                className="w-7 h-7 rounded flex items-center justify-center text-[var(--app-text-muted)] hover:text-[var(--app-text-strong)] hover:bg-[var(--app-surface-hover)] transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Webview Canvas or Custom Offline Screen */}
          <div className="flex-1 w-full relative bg-[var(--app-bg)]">
            {isOfflineError ? (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 text-center bg-[var(--app-bg)] animate-in fade-in duration-200">
                <div className="w-14 h-14 rounded-full bg-[var(--app-surface)] border border-[var(--app-border)] flex items-center justify-center text-[var(--app-text-muted)] mb-3">
                  <WifiOff className="w-7 h-7" />
                </div>
                <h3 className="text-sm font-bold text-[var(--app-text-strong)] mb-1">
                  Website Unavailable Offline
                </h3>
                <p className="text-xs text-[var(--app-text-muted)] max-w-sm mb-4 leading-relaxed">
                  You appear to be offline or this website could not be reached. You can read your saved books in your library anytime without an internet connection.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleReturnHome}
                    className="px-3.5 py-1.5 text-xs rounded-md bg-[var(--app-surface)] border border-[var(--app-border)] text-[var(--app-text)] hover:bg-[var(--app-surface-hover)] transition-colors"
                  >
                    Directory Hub
                  </button>
                  <button
                    type="button"
                    onClick={handleWebReload}
                    className="px-3.5 py-1.5 text-xs font-semibold rounded-md bg-[var(--app-accent)] text-white hover:brightness-110 transition-all flex items-center gap-1.5"
                  >
                    <RotateCw className="w-3 h-3" />
                    <span>Retry</span>
                  </button>
                </div>
              </div>
            ) : null}

            <webview
              ref={webviewRef}
              src={activeUrl}
              partition="persist:bookbrowser"
              className="w-full h-full border-0"
              style={{ visibility: isOfflineError ? 'hidden' : 'visible' }}
            />
          </div>
        </div>
      ) : (
        /* ----------------------------------------------------------------- */
        /* Mode B: Curated Directory Hub                                     */
        /* ----------------------------------------------------------------- */
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          {/* Top Header Bar */}
          <div className="h-11 bg-[var(--app-chrome)] border-b border-[var(--app-border)] px-6 flex items-center justify-between gap-4 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <Globe className="w-4 h-4 text-[var(--app-accent)] shrink-0" />
              <h2 className="text-xs font-bold text-[var(--app-text-strong)] uppercase tracking-wider font-mono">
                Get Books
              </h2>
              <span className="text-[11px] text-[var(--app-text-muted)] hidden sm:inline">
                • Verified Free E-book Portals & Digital Archives
              </span>
            </div>

            {/* Subtle Search / Filter input */}
            <div className="relative w-56">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--app-text-muted)] pointer-events-none" />
              <input
                type="text"
                placeholder="Filter portals..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full h-7 pl-8 pr-2.5 text-xs bg-[var(--app-surface-2)] border border-[var(--app-border)] rounded-md text-[var(--app-text-strong)] placeholder:text-[var(--app-text-muted)]/60 focus:outline-none focus:border-[var(--app-accent)] transition-colors"
              />
            </div>
          </div>

          {/* Directory Grid View */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-6xl mx-auto">
              <div className="flex flex-wrap gap-5 items-start">
                {/* 1. "New Site" Card matching AddBookCard geometry */}
                <NewSiteCard onAddSite={handleAddCustomSite} />

                {/* 2. Portal Cards (Custom & Verified Ranked #1..#10) */}
                {filteredPortals.map((portal) => (
                  <div
                    key={portal.id}
                    onClick={() => handleOpenPortal(portal)}
                    className="w-36 flex flex-col cursor-pointer group select-none transition-transform duration-150 hover:-translate-y-0.5 text-left focus:outline-none relative"
                  >
                    {/* Card Body */}
                    <div className="w-full aspect-[3/4.4] rounded-xl bg-[var(--app-surface)] group-hover:bg-[var(--app-surface-hover)] border border-[var(--app-border)] group-hover:border-[var(--app-accent)]/60 relative overflow-hidden flex flex-col justify-between p-3 transition-all duration-150 shadow-sm">
                      {/* Top Badges */}
                      <div className="flex items-center justify-between gap-1 w-full">
                        {portal.isCustom ? (
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 font-semibold border border-blue-500/20">
                            Custom
                          </span>
                        ) : (
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[var(--app-surface-2)] text-[var(--app-text-muted)] font-medium border border-[var(--app-border)]">
                            #{portal.rank}
                          </span>
                        )}

                        {portal.isCustom && (
                          <button
                            type="button"
                            onClick={(e) => handleDeleteCustomSite(e, portal.id)}
                            title="Remove custom site"
                            className="w-5 h-5 rounded flex items-center justify-center text-[var(--app-text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      {/* Icon & Title */}
                      <div className="flex flex-col items-center text-center my-auto py-2">
                        <div className="w-10 h-10 rounded-full bg-[var(--app-surface-2)] border border-[var(--app-border)] group-hover:border-[var(--app-accent)]/40 flex items-center justify-center text-[var(--app-accent)] mb-2 transition-colors">
                          <BookOpen className="w-5 h-5" />
                        </div>
                        <h4 className="text-xs font-bold text-[var(--app-text-strong)] leading-snug line-clamp-2">
                          {portal.name}
                        </h4>
                      </div>

                      {/* Bottom Formats Tag */}
                      <div className="flex items-center justify-center gap-1 w-full pt-1.5 border-t border-[var(--app-border)]">
                        {portal.formats.slice(0, 2).map((fmt) => (
                          <span
                            key={fmt}
                            className="text-[8.5px] uppercase font-mono px-1 py-0.5 rounded bg-[var(--app-surface-2)] text-[var(--app-text-muted)] group-hover:text-[var(--app-text-strong)] transition-colors"
                          >
                            {fmt}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Subtitle / Hostname below card */}
                    <div className="mt-1.5 px-0.5 truncate text-[11px] text-[var(--app-text-muted)]">
                      {portal.hostname}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
