import React, { useState, useEffect, useRef } from 'react'
import { Copy, Check, Trash2, Volume2, Underline, X, FileText, Save } from 'lucide-react'
import type { Annotation, NoteColor } from '../../db'
import { ICE_NOTE_COLOR_LIST, ICE_NOTE_COLORS } from '../../services/annotationService'
import { ttsService } from '../../services/ttsService'
import { useAppStore } from '../../stores/useAppStore'

interface AnnotationPopoverProps {
  annotation: Annotation
  position: { x: number; y: number }
  onClose: () => void
  onUpdate: (id: number, updates: { color?: NoteColor; note?: string }) => Promise<void>
  onDelete: (annotation: Annotation) => Promise<void>
}

export const AnnotationPopover: React.FC<AnnotationPopoverProps> = ({
  annotation,
  position,
  onClose,
  onUpdate,
  onDelete
}) => {
  const { openConfirmDialog } = useAppStore()
  const [noteDraft, setNoteDraft] = useState(annotation.note || '')
  const [isEditingNote, setIsEditingNote] = useState(false)
  const [copied, setCopied] = useState(false)
  const [saving, setSaving] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setNoteDraft(annotation.note || '')
    setIsEditingNote(false)
  }, [annotation.id, annotation.note])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onClose])

  // Clamp popover inside viewport so it never clips off edges
  const width = 310
  const halfW = width / 2
  const clampedX = Math.max(halfW + 12, Math.min(window.innerWidth - halfW - 12, position.x))
  const showBelow = position.y < 230
  const clampedY = showBelow
    ? Math.min(window.innerHeight - 240, position.y + 18)
    : Math.max(48, position.y - 12)

  const handleColorSwitch = async (color: NoteColor) => {
    if (!annotation.id || color === annotation.color) return
    await onUpdate(annotation.id, { color })
  }

  const handleSaveComment = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!annotation.id) return
    setSaving(true)
    await onUpdate(annotation.id, { note: noteDraft.trim() })
    setSaving(false)
    setIsEditingNote(false)
  }

  const handleCopy = () => {
    const payload = annotation.note?.trim()
      ? `"${annotation.text}"\n\nNote: ${annotation.note.trim()}`
      : annotation.text
    navigator.clipboard.writeText(payload)
    setCopied(true)
    setTimeout(() => setCopied(false), 900)
  }

  const handleSpeak = () => {
    ttsService.speak(annotation.text)
    onClose()
  }

  const activeMeta = ICE_NOTE_COLORS[annotation.color] || ICE_NOTE_COLORS.yellow

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
        onContextMenu={(e) => {
          e.preventDefault()
          onClose()
        }}
      />
      <div
        ref={popoverRef}
        style={{
          left: `${clampedX}px`,
          top: `${clampedY}px`,
          width: `${width}px`,
          transform: showBelow ? 'translate(-50%, 0)' : 'translate(-50%, -100%)'
        }}
        className="fixed z-50 bg-[var(--app-chrome)]/96 backdrop-blur-xl border border-[var(--app-border-strong)] rounded-xl shadow-2xl overflow-hidden text-xs text-[var(--app-text)] select-none app-no-drag animate-in fade-in duration-100"
      >
        {/* Top Bar: Color Switcher + Quick Actions */}
        <div className="h-8 bg-[var(--app-surface-2)]/50 border-b border-[var(--app-border)] px-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            {ICE_NOTE_COLOR_LIST.map((col) => {
              const isSelected = annotation.color === col.id
              return (
                <button
                  key={col.id}
                  type="button"
                  onClick={() => handleColorSwitch(col.id)}
                  title={`Change to ${col.label}`}
                  className={`w-3.5 h-3.5 rounded-full flex items-center justify-center transition-transform cursor-pointer ${
                    isSelected ? 'ring-2 ring-[var(--app-text-strong)] scale-110 shadow-xs' : 'opacity-70 hover:opacity-100 hover:scale-105'
                  }`}
                  style={
                    col.isUnderline
                      ? { backgroundColor: 'var(--app-surface)', border: '1px solid var(--app-border-strong)', color: 'var(--app-accent-text)' }
                      : { backgroundColor: col.hex, border: '1px solid rgba(0,0,0,0.3)' }
                  }
                >
                  {col.isUnderline && <Underline className="w-2 h-2 pointer-events-none" />}
                </button>
              )
            })}
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleCopy}
              className="w-5 h-5 flex items-center justify-center rounded-md text-[var(--app-text-subtle)] hover:text-[var(--app-text-strong)] hover:bg-[var(--app-surface-hover)] transition-colors cursor-pointer"
              title="Copy quote and note"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            </button>
            <button
              type="button"
              onClick={handleSpeak}
              className="w-5 h-5 flex items-center justify-center rounded-md text-[var(--app-text-subtle)] hover:text-[var(--app-text-strong)] hover:bg-[var(--app-surface-hover)] transition-colors cursor-pointer"
              title="Read aloud"
            >
              <Volume2 className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => {
                const snippet = annotation.text
                  ? `"${annotation.text.slice(0, 50)}${annotation.text.length > 50 ? '...' : ''}"`
                  : 'this highlight'
                openConfirmDialog({
                  title: 'Delete Highlight?',
                  message: `Are you sure you want to delete ${snippet}? This action cannot be undone.`,
                  confirmLabel: 'Delete Highlight',
                  cancelLabel: 'Cancel',
                  danger: true,
                  onConfirm: async () => {
                    await onDelete(annotation)
                    onClose()
                  }
                })
              }}
              className="w-5 h-5 flex items-center justify-center rounded-md text-[var(--app-text-subtle)] hover:text-red-400 hover:bg-[var(--app-surface-hover)] transition-colors cursor-pointer"
              title="Delete highlight"
            >
              <Trash2 className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-5 h-5 flex items-center justify-center rounded-md text-[var(--app-text-subtle)] hover:text-[var(--app-text-strong)] hover:bg-[var(--app-surface-hover)] transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-3 h-3 pointer-events-none" />
            </button>
          </div>
        </div>

        {/* Body: Quote + Note Comment */}
        <div className="p-3 space-y-2">
          <div
            className="text-[11.5px] font-serif italic text-[var(--app-text-muted)] bg-[var(--app-surface-2)]/50 px-2.5 py-1.5 rounded-lg line-clamp-3 border-l-2 leading-relaxed"
            style={{ borderLeftColor: activeMeta.borderHex }}
          >
            &ldquo;{annotation.text}&rdquo;
          </div>

          {isEditingNote ? (
            <form onSubmit={handleSaveComment} className="space-y-2">
              <textarea
                autoFocus
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                    e.preventDefault()
                    handleSaveComment()
                  }
                }}
                placeholder="Write a reflection... (Ctrl+Enter to save)"
                rows={3}
                className="w-full bg-[var(--app-surface-2)]/40 border border-[var(--app-border)] text-[var(--app-text-strong)] placeholder-[var(--app-text-subtle)] p-2 text-xs rounded-lg focus:outline-none focus:border-[var(--app-accent)] resize-none transition-colors"
              />
              <div className="flex items-center justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setNoteDraft(annotation.note || '')
                    setIsEditingNote(false)
                  }}
                  className="px-2 py-1 rounded-md text-[11px] text-[var(--app-text-subtle)] hover:text-[var(--app-text-strong)] hover:bg-[var(--app-surface-hover)] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-3 py-1 rounded-md text-[11px] font-medium bg-[var(--app-accent)] hover:brightness-110 text-white shadow-xs transition-all cursor-pointer flex items-center gap-1"
                >
                  <Save className="w-3 h-3" />
                  <span>Save</span>
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-2">
              {annotation.note?.trim() ? (
                <div
                  onClick={() => setIsEditingNote(true)}
                  className="text-[12px] text-[var(--app-accent-text)] bg-[var(--app-surface-2)]/40 hover:bg-[var(--app-surface-hover)] border border-[var(--app-border)] rounded-lg p-2 cursor-pointer transition-colors whitespace-pre-wrap leading-relaxed"
                  title="Click to edit thought"
                >
                  {annotation.note}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsEditingNote(true)}
                  className="w-full h-7 text-[11px] rounded-lg border border-dashed border-[var(--app-border-strong)] text-[var(--app-text-subtle)] hover:text-[var(--app-text-strong)] hover:bg-[var(--app-surface-hover)] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <FileText className="w-3 h-3 text-[var(--app-accent)]" />
                  <span>Add a thought to this highlight...</span>
                </button>
              )}

              <div className="flex items-center justify-between text-[10.5px] text-[var(--app-text-subtle)] font-mono pt-0.5">
                <span className="truncate max-w-[190px]">
                  {annotation.pageNumber ? `p.${annotation.pageNumber}` : ''}
                  {annotation.chapterTitle ? ` · ${annotation.chapterTitle}` : ''}
                </span>
                <span>{new Date(annotation.updatedAt || annotation.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
