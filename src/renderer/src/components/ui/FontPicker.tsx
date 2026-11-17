import React, { useMemo, useState } from 'react'
import { Check, Download, Loader2, Search, WifiOff, X } from 'lucide-react'
import {
  FONT_CATALOG,
  FONT_CATEGORY_LABELS,
  isBuiltinFont,
  type FontCategory,
  type FontEntry
} from '../../../../shared/fontCatalog'
import { useAppStore } from '../../stores/useAppStore'
import { selectOrDownloadFont } from '../../services/fontManager'

interface FontPickerProps {
  compact?: boolean
}

const FILTER_CATEGORIES: Array<FontCategory | 'all'> = [
  'all',
  'serif',
  'sans',
  'accessible',
  'slab',
  'mono'
]

export const FontPicker: React.FC<FontPickerProps> = ({ compact = false }) => {
  const { settings, downloadedFontIds, downloadingFontId, isOnline } = useAppStore()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<FontCategory | 'all'>('all')
  const [offlineNotice, setOfflineNotice] = useState<string | null>(null)

  const downloadedSet = useMemo(() => new Set(downloadedFontIds), [downloadedFontIds])

  const { availableFonts, downloadableFonts } = useMemo(() => {
    const q = search.trim().toLowerCase()
    const matchesFilter = (f: FontEntry) => {
      if (category !== 'all') {
        // Keep Publisher Original visible only under 'all' unless searched directly
        if (f.category !== category) return false
      }
      if (q && !f.name.toLowerCase().includes(q) && !f.category.toLowerCase().includes(q)) {
        return false
      }
      return true
    }

    // 1. Downloaded cloud fonts FIRST (in user's download order, newest on top)
    const downloadedEntries: FontEntry[] = []
    for (const id of downloadedFontIds) {
      const entry = FONT_CATALOG.find((f) => f.id === id)
      if (entry && matchesFilter(entry)) {
        downloadedEntries.push(entry)
      }
    }

    // 2. Built-in / always-offline fonts right after downloaded fonts in the top Available section
    const builtinEntries = FONT_CATALOG.filter(
      (f) => isBuiltinFont(f.id) && matchesFilter(f)
    )

    // 3. Undownloaded cloud fonts below, with subtle download button on the right
    const cloudEntries = FONT_CATALOG.filter(
      (f) => !isBuiltinFont(f.id) && !downloadedSet.has(f.id) && matchesFilter(f)
    )

    return {
      availableFonts: [...downloadedEntries, ...builtinEntries],
      downloadableFonts: cloudEntries
    }
  }, [search, category, downloadedFontIds, downloadedSet])

  const handleSelect = async (font: FontEntry) => {
    setOfflineNotice(null)
    const res = await selectOrDownloadFont(font.id)
    if (!res.ok && res.offline) {
      setOfflineNotice('Offline — fonts not available. Remaining on current font.')
    }
  }

  const activeEntry = useMemo(
    () => FONT_CATALOG.find((f) => f.id === settings.fontFamily) || FONT_CATALOG[0],
    [settings.fontFamily]
  )

  const renderFontRow = (font: FontEntry, isAvailableOffline: boolean) => {
    const isActive = settings.fontFamily === font.id
    const isDownloading = downloadingFontId === font.id
    const isDownloadedCloud = !isBuiltinFont(font.id) && downloadedSet.has(font.id)

    return (
      <div
        key={font.id}
        role="option"
        aria-selected={isActive}
        onClick={() => handleSelect(font)}
        className={`group h-8 px-2.5 rounded-md flex items-center justify-between gap-2 transition-colors cursor-pointer ${
          isActive
            ? 'bg-[var(--app-accent-soft)] text-[var(--app-text-strong)] border border-[var(--app-accent)]/40'
            : 'border border-transparent hover:bg-[var(--app-surface-hover)] text-[var(--app-text)]'
        } ${!isAvailableOffline && !isOnline ? 'opacity-60' : ''}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="text-[12px] truncate"
            style={{
              fontFamily: isAvailableOffline ? font.cssFamily : font.fallback
            }}
          >
            {font.name}
          </span>
          {isDownloadedCloud && (
            <span className="text-[9px] uppercase tracking-wider px-1 py-0.5 rounded bg-[var(--app-surface-2)] text-[var(--app-text-muted)] shrink-0">
              Saved
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className="text-[11px] text-[var(--app-text-subtle)]"
            style={{
              fontFamily: isAvailableOffline ? font.cssFamily : font.fallback
            }}
          >
            Aa
          </span>

          {isActive ? (
            <span className="w-5 h-5 flex items-center justify-center text-[var(--app-accent)]">
              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
            </span>
          ) : isDownloading ? (
            <span className="w-5 h-5 flex items-center justify-center text-[var(--app-accent)]">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            </span>
          ) : !isAvailableOffline ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                handleSelect(font)
              }}
              title={isOnline ? `Download ${font.name}` : 'Offline — font not available'}
              aria-label={`Download ${font.name}`}
              className="w-5 h-5 flex items-center justify-center rounded text-[var(--app-text-subtle)] hover:text-[var(--app-text-strong)] hover:bg-[var(--app-surface-2)] transition-colors cursor-pointer"
            >
              <Download className="w-3 h-3" />
            </button>
          ) : (
            <span className="w-5 h-5" aria-hidden="true" />
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {/* Header summary + offline indicator */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-[var(--app-text-muted)]">
          Typeface · <span className="text-[var(--app-text-strong)]">{activeEntry.name}</span>
        </span>
        {!isOnline && (
          <span className="inline-flex items-center gap-1 text-[10px] text-[#f59e0b]">
            <WifiOff className="w-3 h-3" />
            <span>Offline</span>
          </span>
        )}
      </div>

      {/* Inline offline warning banner when user clicks an un-downloaded font offline */}
      {offlineNotice && (
        <div
          role="alert"
          className="px-2.5 py-1.5 rounded-md bg-[#2a1517] border border-[#5c262d] text-[#f87171] text-[11px] flex items-center justify-between gap-2"
          data-preserve-theme="true"
        >
          <span className="flex items-center gap-1.5 min-w-0">
            <WifiOff className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{offlineNotice}</span>
          </span>
          <button
            type="button"
            onClick={() => setOfflineNotice(null)}
            className="p-0.5 hover:text-white shrink-0 cursor-pointer"
            aria-label="Dismiss offline notice"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Search + Category Pills */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 text-[var(--app-text-subtle)] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Search ${FONT_CATALOG.length} fonts...`}
          className="ice-input w-full h-7 pl-8 pr-7 text-[11.5px]"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--app-text-subtle)] hover:text-[var(--app-text-strong)] cursor-pointer"
            aria-label="Clear font search"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-1 flex-wrap">
        {FILTER_CATEGORIES.map((cat) => {
          const active = category === cat
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`h-6 px-2 rounded text-[10.5px] font-medium transition-colors cursor-pointer ${
                active
                  ? 'bg-[var(--app-btn-primary-bg)] text-[var(--app-btn-primary-fg)]'
                  : 'bg-[var(--app-surface-2)] text-[var(--app-text-muted)] hover:text-[var(--app-text-strong)]'
              }`}
            >
              {FONT_CATEGORY_LABELS[cat]}
            </button>
          )
        })}
      </div>

      {/* Scrollable Two-Section Font List: Available/Downloaded First, Cloud Fonts Below */}
      <div
        role="listbox"
        aria-label="Font library"
        className={`rounded-lg border border-[var(--app-border)] bg-[var(--app-input-bg)] overflow-y-auto p-1 space-y-1 ${
          compact ? 'max-h-[210px]' : 'max-h-[260px]'
        }`}
      >
        {availableFonts.length > 0 && (
          <div className="space-y-0.5">
            <div className="px-2 pt-1 pb-0.5 flex items-center justify-between text-[10px] font-medium uppercase tracking-wider text-[var(--app-text-subtle)]">
              <span>Available ({availableFonts.length})</span>
              <span>Offline ready</span>
            </div>
            {availableFonts.map((f) => renderFontRow(f, true))}
          </div>
        )}

        {downloadableFonts.length > 0 && (
          <div className="space-y-0.5 pt-1 border-t border-[var(--app-border)]">
            <div className="px-2 pt-1 pb-0.5 flex items-center justify-between text-[10px] font-medium uppercase tracking-wider text-[var(--app-text-subtle)]">
              <span>More Fonts ({downloadableFonts.length})</span>
              <span>{isOnline ? 'Tap to download' : 'Offline'}</span>
            </div>
            {downloadableFonts.map((f) => renderFontRow(f, false))}
          </div>
        )}

        {availableFonts.length === 0 && downloadableFonts.length === 0 && (
          <div className="py-6 text-center text-[11px] text-[var(--app-text-subtle)]">
            No fonts match "{search.trim()}".
          </div>
        )}
      </div>
    </div>
  )
}
