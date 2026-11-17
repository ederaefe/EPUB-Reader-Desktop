import React, { useEffect, useMemo, useState } from 'react'
import {
  X,
  Trash2,
  FileText,
  Search,
  Edit3,
  Copy,
  Check,
  Download,
  Underline,
  Layers,
  MessageSquare,
  Save,
  ArrowUpDown
} from 'lucide-react'
import { useAppStore } from '../../stores/useAppStore'
import { db, type Annotation, type NoteColor } from '../../db'
import {
  ICE_NOTE_COLORS,
  ICE_NOTE_COLOR_LIST,
  downloadTextFile,
  exportNotesToHtml,
  exportNotesToMarkdown,
  exportNotesToPlainText
} from '../../services/annotationService'

interface NotesDrawerProps {
  onJumpToCfi: (cfi: string, pageNumber?: number) => void
  onDeleteAnnotation?: (annotation: Annotation) => Promise<void>
  onUpdateAnnotation?: (id: number, updates: { color?: NoteColor; note?: string }) => Promise<void>
  onClearAllAnnotations?: () => Promise<void>
}

type SortMode = 'position' | 'newest' | 'oldest' | 'color'

export const NotesDrawer: React.FC<NotesDrawerProps> = ({
  onJumpToCfi,
  onDeleteAnnotation: onDeleteAnnotationProp,
  onUpdateAnnotation: onUpdateAnnotationProp,
  onClearAllAnnotations: onClearAllAnnotationsProp
}) => {
  const { isNotesDrawerOpen, toggleNotesDrawer, activeBook, annotationsVersion } = useAppStore()
  const [annotations, setAnnotations] = useState<Annotation[]>([])

  const onDeleteAnnotation = async (annotation: Annotation) => {
    if (onDeleteAnnotationProp) {
      await onDeleteAnnotationProp(annotation)
    } else if (annotation.id) {
      await db.annotations.delete(annotation.id)
    }
    await loadNotes()
  }

  const onUpdateAnnotation = async (id: number, updates: { color?: NoteColor; note?: string }) => {
    if (onUpdateAnnotationProp) {
      await onUpdateAnnotationProp(id, updates)
    } else {
      await db.annotations.update(id, updates)
    }
    await loadNotes()
  }

  const onClearAllAnnotations = async () => {
    if (onClearAllAnnotationsProp) {
      await onClearAllAnnotationsProp()
    } else if (activeBook?.id) {
      await db.annotations.where('bookId').equals(activeBook.id).delete()
    }
    await loadNotes()
  }
  const [selectedColor, setSelectedColor] = useState<string>('all')
  const [onlyCommented, setOnlyCommented] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('position')
  const [groupByChapter, setGroupByChapter] = useState(false)

  // Inline editing state
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editNoteDraft, setEditNoteDraft] = useState('')
  const [editColorDraft, setEditColorDraft] = useState<NoteColor>('yellow')

  // UI feedback states
  const [copiedId, setCopiedId] = useState<number | null>(null)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [confirmClearAll, setConfirmClearAll] = useState(false)
  const [drawerNotice, setDrawerNotice] = useState<string | null>(null)

  const showNotice = (msg: string) => {
    setDrawerNotice(msg)
    setTimeout(() => setDrawerNotice(null), 2200)
  }

  const loadNotes = async () => {
    if (!activeBook?.id) return
    const items = await db.annotations.where('bookId').equals(activeBook.id).toArray()
    setAnnotations(items)
  }

  useEffect(() => {
    if (isNotesDrawerOpen) {
      loadNotes()
    }
  }, [isNotesDrawerOpen, activeBook?.id, annotationsVersion])

  const filteredAndSorted = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const list = annotations.filter((a) => {
      if (selectedColor !== 'all' && a.color !== selectedColor) return false
      if (onlyCommented && !a.note?.trim()) return false
      if (q) {
        const hay = `${a.text} ${a.note || ''} ${a.chapterTitle || ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })

    const colorOrder: Record<NoteColor, number> = {
      yellow: 0,
      blue: 1,
      green: 2,
      purple: 3,
      red: 4,
      underline: 5
    }

    list.sort((a, b) => {
      if (sortMode === 'position') {
        const pa = a.pageNumber ?? Number.MAX_SAFE_INTEGER
        const pb = b.pageNumber ?? Number.MAX_SAFE_INTEGER
        if (pa !== pb) return pa - pb
        return a.createdAt - b.createdAt
      }
      if (sortMode === 'newest') return b.createdAt - a.createdAt
      if (sortMode === 'oldest') return a.createdAt - b.createdAt
      if (sortMode === 'color') {
        const ca = colorOrder[a.color] ?? 99
        const cb = colorOrder[b.color] ?? 99
        if (ca !== cb) return ca - cb
        return (a.pageNumber || 0) - (b.pageNumber || 0)
      }
      return 0
    })

    return list
  }, [annotations, selectedColor, onlyCommented, searchQuery, sortMode])

  const groupedByChapter = useMemo(() => {
    if (!groupByChapter) return null
    const groups = new Map<string, Annotation[]>()
    for (const ann of filteredAndSorted) {
      const key = ann.chapterTitle?.trim() || 'General'
      const arr = groups.get(key) || []
      arr.push(ann)
      groups.set(key, arr)
    }
    return Array.from(groups.entries())
  }, [filteredAndSorted, groupByChapter])

  const colorCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const ann of annotations) {
      counts[ann.color] = (counts[ann.color] || 0) + 1
    }
    return counts
  }, [annotations])

  const commentedCount = useMemo(
    () => annotations.filter((a) => Boolean(a.note?.trim())).length,
    [annotations]
  )

  if (!isNotesDrawerOpen) return null

  const startEditing = (ann: Annotation) => {
    if (!ann.id) return
    setEditingId(ann.id)
    setEditNoteDraft(ann.note || '')
    setEditColorDraft(ann.color)
  }

  const saveEdit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (editingId == null) return
    await onUpdateAnnotation(editingId, {
      note: editNoteDraft.trim(),
      color: editColorDraft
    })
    setEditingId(null)
    showNotice('Note updated')
  }

  const handleCopyCard = (ann: Annotation) => {
    const payload = ann.note?.trim()
      ? `"${ann.text}"\nNote: ${ann.note.trim()}`
      : ann.text
    navigator.clipboard.writeText(payload)
    if (ann.id) {
      setCopiedId(ann.id)
      setTimeout(() => setCopiedId(null), 1200)
    }
  }

  const handleExportHtml = () => {
    if (!activeBook) return
    const html = exportNotesToHtml(activeBook, filteredAndSorted)
    const safeName = activeBook.title.replace(/[^a-z0-9-_]+/gi, '_')
    downloadTextFile(`${safeName}_notes.html`, html, 'text/html;charset=utf-8')
    setShowExportMenu(false)
    showNotice('Exported notes as HTML')
  }

  const handleExportMarkdown = () => {
    if (!activeBook) return
    const md = exportNotesToMarkdown(activeBook, filteredAndSorted)
    const safeName = activeBook.title.replace(/[^a-z0-9-_]+/gi, '_')
    downloadTextFile(`${safeName}_notes.md`, md, 'text/markdown;charset=utf-8')
    setShowExportMenu(false)
    showNotice('Exported notes as Markdown')
  }

  const handleCopyAll = () => {
    if (!activeBook) return
    const text = exportNotesToPlainText(activeBook, filteredAndSorted)
    navigator.clipboard.writeText(text)
    setShowExportMenu(false)
    showNotice(`Copied ${filteredAndSorted.length} notes to clipboard`)
  }

  const renderCard = (ann: Annotation) => {
    const meta = ICE_NOTE_COLORS[ann.color] || ICE_NOTE_COLORS.yellow
    const isEditing = editingId === ann.id

    return (
      <div
        key={ann.id}
        onClick={() => {
          if (isEditing) return
          onJumpToCfi(ann.cfiRange, ann.pageNumber)
          toggleNotesDrawer(false)
        }}
        style={{ borderLeftColor: meta.borderHex }}
        className="p-2.5 bg-[#1c202a] hover:bg-[#232836] border border-[#282c38] border-l-[3px] rounded-[2px] cursor-pointer transition-colors space-y-2 group"
      >
        {/* Top Row: Location + Actions */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className="px-1.5 py-0.5 rounded-[2px] text-[10px] font-mono font-medium shrink-0"
              style={
                meta.isUnderline
                  ? { backgroundColor: '#232732', color: '#79c0ff', borderBottom: '1px solid #2a69df' }
                  : { backgroundColor: '#14161c', color: meta.hex }
              }
            >
              {ann.pageNumber ? `p.${ann.pageNumber}` : meta.label}
            </span>
            {ann.chapterTitle && (
              <span className="text-[10px] text-[#8b949e] truncate" title={ann.chapterTitle}>
                {ann.chapterTitle}
              </span>
            )}
          </div>

          <div
            className="flex items-center gap-0.5 shrink-0 opacity-75 group-hover:opacity-100 transition-opacity"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => startEditing(ann)}
              className="w-6 h-6 flex items-center justify-center rounded-[2px] text-[#8b949e] hover:text-white hover:bg-[#2d3343] cursor-pointer"
              title="Edit note or color"
            >
              <Edit3 className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => handleCopyCard(ann)}
              className="w-6 h-6 flex items-center justify-center rounded-[2px] text-[#8b949e] hover:text-white hover:bg-[#2d3343] cursor-pointer"
              title="Copy quote and note"
            >
              {copiedId === ann.id ? (
                <Check className="w-3 h-3 text-emerald-400" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
            </button>
            <button
              type="button"
              onClick={async () => {
                await onDeleteAnnotation(ann)
                showNotice('Note deleted')
              }}
              className="w-6 h-6 flex items-center justify-center rounded-[2px] text-[#8b949e] hover:text-[#f85149] hover:bg-[#2d3343] cursor-pointer"
              title="Delete note"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Quoted Passage */}
        <div className="text-[#e6edf3] font-serif italic text-[12px] leading-relaxed line-clamp-4 bg-[#14161c] px-2.5 py-2 rounded-[2px] border border-[#232732]">
          &ldquo;{ann.text}&rdquo;
        </div>

        {/* Comment Display or Inline Editor */}
        {isEditing ? (
          <form
            onSubmit={saveEdit}
            onClick={(e) => e.stopPropagation()}
            className="space-y-2 pt-1"
          >
            <div className="flex items-center gap-1.5">
              {ICE_NOTE_COLOR_LIST.map((col) => (
                <button
                  key={col.id}
                  type="button"
                  onClick={() => setEditColorDraft(col.id)}
                  className={`w-4 h-4 rounded-[2px] flex items-center justify-center cursor-pointer ${
                    editColorDraft === col.id ? 'ring-1 ring-white scale-110' : 'opacity-70 hover:opacity-100'
                  }`}
                  style={
                    col.isUnderline
                      ? { backgroundColor: '#232732', border: '1px solid #353b4c', color: '#79c0ff' }
                      : { backgroundColor: col.hex, border: '1px solid rgba(0,0,0,0.35)' }
                  }
                  title={col.label}
                >
                  {col.isUnderline && <Underline className="w-2.5 h-2.5 pointer-events-none" />}
                </button>
              ))}
            </div>
            <textarea
              autoFocus
              value={editNoteDraft}
              onChange={(e) => setEditNoteDraft(e.target.value)}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                  e.preventDefault()
                  saveEdit()
                }
              }}
              placeholder="Write a comment... (Ctrl+Enter to save)"
              rows={3}
              className="ice-input w-full p-2 text-[11px] rounded-[2px] resize-none"
            />
            <div className="flex items-center justify-end gap-1.5">
              <button
                type="button"
                onClick={() => setEditingId(null)}
                className="ice-btn-dark px-2.5 h-6 text-[11px] rounded-[2px]"
              >
                Cancel
              </button>
              <button type="submit" className="ice-btn-blue px-2.5 h-6 text-[11px] gap-1 rounded-[2px]">
                <Save className="w-3 h-3" />
                <span>Save</span>
              </button>
            </div>
          </form>
        ) : (
          ann.note?.trim() && (
            <div
              onClick={(e) => {
                e.stopPropagation()
                startEditing(ann)
              }}
              className="text-[#79c0ff] text-[11.5px] leading-snug bg-[#151a24] border border-[#232b3b] px-2 py-1.5 rounded-[2px] whitespace-pre-wrap hover:border-[#2a69df]/60 transition-colors"
              title="Click to edit comment"
            >
              {ann.note}
            </div>
          )
        )}

        {/* Footer Date */}
        <div className="flex items-center justify-between text-[10px] text-[#6e7681]">
          <span>{meta.label}</span>
          <span>{new Date(ann.updatedAt || ann.createdAt).toLocaleDateString()}</span>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Backdrop for click-outside dismissal */}
      <div
        className="fixed inset-0 top-8 bg-black/40 z-40 transition-opacity"
        onClick={() => toggleNotesDrawer(false)}
      />

      <aside className="fixed top-8 bottom-0 left-0 w-[360px] bg-[#171a21] border-r border-[#232732] z-50 flex flex-col justify-between shadow-2xl select-none app-no-drag animate-in slide-in-from-left duration-150">
        <div className="flex flex-col h-full overflow-hidden">
          {/* Header */}
          <div className="h-10 bg-[#14161c] border-b border-[#232732] px-3 flex items-center justify-between shrink-0 app-no-drag">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#2a69df]" />
              <span className="text-[13px] font-semibold text-white">
                Notes ({annotations.length})
              </span>
            </div>
            <div className="flex items-center gap-1 relative">
              <button
                type="button"
                onClick={() => setGroupByChapter((v) => !v)}
                className={`app-no-drag w-6 h-6 flex items-center justify-center rounded-[2px] transition-colors cursor-pointer ${
                  groupByChapter ? 'bg-[#2a69df] text-white' : 'text-[#8b949e] hover:text-white hover:bg-[#282c37]'
                }`}
                title={groupByChapter ? 'Show flat list' : 'Group by chapter'}
              >
                <Layers className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                disabled={filteredAndSorted.length === 0}
                onClick={() => setShowExportMenu((v) => !v)}
                className="app-no-drag w-6 h-6 flex items-center justify-center rounded-[2px] text-[#8b949e] hover:text-white hover:bg-[#282c37] disabled:opacity-40 transition-colors cursor-pointer"
                title="Export notes"
              >
                <Download className="w-3.5 h-3.5" />
              </button>

              {showExportMenu && (
                <div className="absolute right-7 top-8 w-44 bg-[#171a21] border border-[#2d323f] rounded-[3px] shadow-2xl py-1 z-50 text-xs">
                  <button
                    type="button"
                    onClick={handleExportHtml}
                    className="w-full px-3 py-1.5 text-left text-[#c9d1d9] hover:bg-[#232836] hover:text-white transition-colors"
                  >
                    Export as HTML (.html)
                  </button>
                  <button
                    type="button"
                    onClick={handleExportMarkdown}
                    className="w-full px-3 py-1.5 text-left text-[#c9d1d9] hover:bg-[#232836] hover:text-white transition-colors"
                  >
                    Export as Markdown (.md)
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyAll}
                    className="w-full px-3 py-1.5 text-left text-[#c9d1d9] hover:bg-[#232836] hover:text-white transition-colors border-t border-[#232732]"
                  >
                    Copy All as Text
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => toggleNotesDrawer(false)}
                className="app-no-drag w-6 h-6 flex items-center justify-center text-[#8b949e] hover:text-white hover:bg-[#282c37] rounded-[2px] transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-4 h-4 pointer-events-none" />
              </button>
            </div>
          </div>

          {/* Search & Sort Controls */}
          <div className="p-2 border-b border-[#232732] space-y-2 shrink-0 bg-[#15181f]">
            <div className="flex items-center gap-1.5">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-[#6e7681] absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search quotes or comments..."
                  className="ice-input w-full h-7 pl-7 pr-6 text-[11px] rounded-[2px]"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[#6e7681] hover:text-white"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              <div className="relative flex items-center">
                <ArrowUpDown className="w-3 h-3 text-[#6e7681] absolute left-2 pointer-events-none" />
                <select
                  value={sortMode}
                  onChange={(e) => setSortMode(e.target.value as SortMode)}
                  className="ice-input h-7 pl-6 pr-2 text-[11px] rounded-[2px] cursor-pointer"
                  title="Sort notes"
                >
                  <option value="position">Page order</option>
                  <option value="newest">Newest</option>
                  <option value="oldest">Oldest</option>
                  <option value="color">Color</option>
                </select>
              </div>
            </div>

            {/* Color & Comment Filter Bar */}
            <div className="flex items-center justify-between gap-1 text-[11px]">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setSelectedColor('all')}
                  className={`px-2 h-6 rounded-[2px] transition-colors cursor-pointer ${
                    selectedColor === 'all'
                      ? 'bg-[#2a69df] text-white font-medium'
                      : 'text-[#8b949e] hover:bg-[#232732] hover:text-white'
                  }`}
                >
                  All
                </button>
                {ICE_NOTE_COLOR_LIST.map((col) => {
                  const active = selectedColor === col.id
                  const count = colorCounts[col.id] || 0
                  return (
                    <button
                      key={col.id}
                      type="button"
                      onClick={() => setSelectedColor(active ? 'all' : col.id)}
                      className={`w-6 h-6 rounded-[2px] flex items-center justify-center border transition-all cursor-pointer ${
                        active ? 'border-white bg-[#232732] scale-105' : 'border-transparent hover:bg-[#232732]'
                      }`}
                      title={`${col.label} (${count})`}
                    >
                      {col.isUnderline ? (
                        <Underline className="w-3 h-3 text-[#79c0ff]" />
                      ) : (
                        <span
                          className="w-3 h-3 rounded-[2px]"
                          style={{ backgroundColor: col.hex, opacity: count > 0 || active ? 1 : 0.45 }}
                        />
                      )}
                    </button>
                  )
                })}
              </div>

              <button
                type="button"
                onClick={() => setOnlyCommented((v) => !v)}
                className={`h-6 px-1.5 rounded-[2px] flex items-center gap-1 text-[10px] transition-colors cursor-pointer ${
                  onlyCommented
                    ? 'bg-[#2a69df] text-white'
                    : 'text-[#8b949e] hover:text-white hover:bg-[#232732]'
                }`}
                title={`Only notes with comments (${commentedCount})`}
              >
                <MessageSquare className="w-3 h-3" />
                <span>{commentedCount}</span>
              </button>
            </div>
          </div>

          {/* Inline Drawer Notice */}
          {drawerNotice && (
            <div className="px-3 py-1.5 bg-[#1b2b48] border-b border-[#2a69df]/40 text-[#79c0ff] text-[11px] shrink-0">
              {drawerNotice}
            </div>
          )}

          {/* Notes List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-2 text-[12px]">
            {filteredAndSorted.length === 0 ? (
              <div className="text-center py-12 px-4 text-[#6e7681]">
                <FileText className="w-8 h-8 mx-auto mb-2.5 opacity-30" />
                <p className="text-[#9da7b3] font-medium">
                  {annotations.length === 0 ? 'No notes yet' : 'No matching notes'}
                </p>
                <p className="text-[11px] mt-1 text-[#6e7681]">
                  {annotations.length === 0
                    ? 'Select any passage in the book to highlight or attach a note.'
                    : 'Try clearing your search or color filter.'}
                </p>
              </div>
            ) : groupedByChapter ? (
              groupedByChapter.map(([chapter, items]) => (
                <div key={chapter} className="space-y-1.5">
                  <div className="sticky top-0 z-10 bg-[#171a21]/95 backdrop-blur-sm py-1 px-1 text-[10px] font-semibold uppercase tracking-wider text-[#8b949e] border-b border-[#232732] flex items-center justify-between">
                    <span className="truncate">{chapter}</span>
                    <span className="text-[#6e7681] shrink-0">{items.length}</span>
                  </div>
                  <div className="space-y-2">{items.map(renderCard)}</div>
                </div>
              ))
            ) : (
              filteredAndSorted.map(renderCard)
            )}
          </div>

          {/* Footer: Clear All with Inline Confirmation */}
          {annotations.length > 0 && (
            <div className="p-2 border-t border-[#232732] bg-[#14161c] shrink-0">
              {confirmClearAll ? (
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="text-[#f85149] font-medium">Delete all {annotations.length} notes?</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setConfirmClearAll(false)}
                      className="ice-btn-dark px-2 h-6 text-[11px] rounded-[2px]"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await onClearAllAnnotations()
                        setConfirmClearAll(false)
                        showNotice('All notes cleared')
                      }}
                      className="px-2.5 h-6 text-[11px] rounded-[2px] bg-[#c42b1c] hover:bg-[#d93829] text-white font-medium transition-colors"
                    >
                      Confirm
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmClearAll(true)}
                  className="ice-btn-dark w-full h-7 text-[11px] gap-1.5 text-[#8b949e] hover:text-[#f85149] rounded-[2px]"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Clear all notes</span>
                </button>
              )}
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
