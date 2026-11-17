import React, { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { useAppStore } from '../../stores/useAppStore'

export interface TocItem {
  id: string
  label: string
  href: string
  spineHref?: string
  spineIndex?: number
  hash?: string
  depth?: number
  pageNumber?: number
  subitems?: TocItem[]
}

interface TOCDrawerProps {
  toc: TocItem[]
  currentHref?: string
  activeTocId?: string
  onSelectChapter: (href: string, item?: TocItem) => void
}

function normalizeSimpleHref(href: string): string {
  return String(href || '')
    .split('#')[0]
    .split('?')[0]
    .replace(/\\/g, '/')
    .replace(/^\.\/+/, '')
    .replace(/^\/+/, '')
}

export const TOCDrawer: React.FC<TOCDrawerProps> = ({
  toc,
  currentHref = '',
  activeTocId = '',
  onSelectChapter
}) => {
  const { isTOCDrawerOpen, toggleTOCDrawer } = useAppStore()
  const activeItemRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (isTOCDrawerOpen && activeItemRef.current) {
      activeItemRef.current.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior })
    }
  }, [isTOCDrawerOpen, activeTocId])

  if (!isTOCDrawerOpen) return null

  const normalizedCurrent = normalizeSimpleHref(currentHref)

  return (
    <>
      {/* Backdrop for click-outside dismissal */}
      <div
        className="fixed inset-0 top-8 bg-black/40 z-40 transition-opacity"
        onClick={() => toggleTOCDrawer(false)}
      />

      <aside className="fixed top-8 bottom-0 left-0 w-72 bg-[var(--app-surface)] border-r border-[var(--app-border)] z-50 flex flex-col justify-between shadow-2xl select-none app-no-drag animate-in slide-in-from-left duration-150">
        <div className="flex flex-col h-full overflow-hidden">
          {/* Header */}
          <div className="h-10 bg-[var(--app-chrome)] border-b border-[var(--app-border)] px-3 flex items-center justify-between app-no-drag">
            <span className="text-[13px] font-semibold text-[var(--app-text-strong)]">Table of contents</span>
            <button
              type="button"
              onClick={() => toggleTOCDrawer(false)}
              className="app-no-drag w-6 h-6 flex items-center justify-center text-[var(--app-text-muted)] hover:text-[var(--app-text-strong)] hover:bg-[var(--app-surface-hover)] rounded transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-4 h-4 pointer-events-none" />
            </button>
          </div>

          {/* Chapter List */}
          <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5 text-[12px]">
            {toc.length === 0 ? (
              <div className="text-xs text-[var(--app-text-subtle)] text-center py-8">No chapters found</div>
            ) : (
              toc.map((item, idx) => {
                const isActive = activeTocId
                  ? item.id === activeTocId
                  : Boolean(
                      normalizedCurrent &&
                        normalizeSimpleHref(item.spineHref || item.href) === normalizedCurrent
                    )
                const depth = Math.max(0, Math.min(3, item.depth || 0))
                const label = item.label?.trim() || `Chapter ${idx + 1}`

                return (
                  <button
                    key={item.id || idx}
                    ref={isActive ? activeItemRef : undefined}
                    type="button"
                    onClick={() => {
                      onSelectChapter(item.href, item)
                      toggleTOCDrawer(false)
                    }}
                    style={{ paddingLeft: `${8 + depth * 14}px` }}
                    title={label}
                    className={`w-full min-h-[32px] py-1.5 pr-2.5 rounded text-left flex items-center gap-1.5 transition-colors group ${
                      isActive
                        ? 'bg-[var(--app-accent)] text-white font-semibold'
                        : 'text-[var(--app-text)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--app-text-strong)]'
                    }`}
                  >
                    <span
                      className={`text-base leading-none shrink-0 ${
                        isActive
                          ? 'text-white'
                          : 'text-[var(--app-text-subtle)] group-hover:text-[var(--app-text-muted)]'
                      }`}
                    >
                      ·
                    </span>
                    <span className="truncate">{label}</span>
                  </button>
                )
              })
            )}
          </div>
        </div>
      </aside>
    </>
  )
}
