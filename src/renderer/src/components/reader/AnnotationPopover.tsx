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
  const width = 320
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
    setTimeout(() => setCopied(false), 1100)
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
        className="fixed z-50 bg-[#171a21] border border-[#2d323f] rounded-lg shadow-2xl overflow-hidden text-xs text-[#c9d1d9] select-none app-no-drag animate-in fade-in duration-100"
      >
        {/* Top Bar: Color Switcher + Quick Actions */}
        <div className="h-9 bg-[#14161c] border-b border-[#232732] px-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            {ICE_NOTE_COLOR_LIST.map((col) => {
              const isSelected = annotation.color === col.id
              return (
                <button
                  key={col.id}
                  type="button"
                  onClick={() => handleColorSwitch(col.id)}
                  title={`Change to ${col.label}`}
                  className={`w-4 h-4 rounded-[2px] flex items-center justify-center transition-transform cursor-pointer ${
                    isSelected ? 'ring-1 ring-[var(--app-text-strong)] scale-110' : 'opacity-80 hover:opacity-100 hover:scale-105'
                  }`}
                  style={
                    col.isUnderline
                      ? { backgroundColor: 'var(--app-surface-2)', border: '1px solid var(--app-border-strong)', color: 'var(--app-accent-text)' }
                      : { backgroundColor: col.hex, border: '1px solid rgba(0,0,0,0.35)' }
                  }
                >
                  {col.isUnderline && <Underline className="w-2.5 h-2.5 pointer-events-none" />}
                </button>
              )
            })}
          </div>

          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={handleCopy}
              className="w-6 h-6 flex items-center justify-center rounded-[2px] text-[#8b949e] hover:text-white hover:bg-[#282c37] transition-colors cursor-pointer"
              title="Copy quote and note"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
            <button
              type="button"
              onClick={handleSpeak}
              className="w-6 h-6 flex items-center justify-center rounded-[2px] text-[#8b949e] hover:text-white hover:bg-[#282c37] transition-colors cursor-pointer"
              title="Read aloud"
            >
              <Volume2 className="w-3.5 h-3.5" />
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
              className="w-6 h-6 flex items-center justify-center rounded-[2px] text-[#8b949e] hover:text-[#f85149] hover:bg-[#282c37] transition-colors cursor-pointer"
              title="Delete highlight"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-6 h-6 flex items-center justify-center rounded-[2px] text-[#8b949e] hover:text-white hover:bg-[#282c37] transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-3.5 h-3.5 pointer-events-none" />
            </button>
          </div>
        </div>

        {/* Body: Quote + Note Comment */}
        <div className="p-3 space-y-2.5">
          <div
            className="text-[11px] font-serif italic text-[#e6edf3] bg-[#12141a] px-2.5 py-2 rounded-[2px] line-clamp-3 border-l-2"
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
                placeholder="Write a comment... (Ctrl+Enter to save)"
                rows={3}
                className="ice-input w-full p-2 text-xs rounded-[2px] resize-none"
              />
              <div className="flex items-center justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setNoteDraft(annotation.note || '')
                    setIsEditingNote(false)
                  }}
                  className="ice-btn-dark px-2.5 h-7 text-[11px] rounded-[2px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="ice-btn-blue px-2.5 h-7 text-[11px] gap-1 rounded-[2px]"
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
                  className="text-[12px] text-[#79c0ff] bg-[#141822] hover:bg-[#1a2030] border border-[#232732] rounded-[2px] p-2 cursor-pointer transition-colors whitespace-pre-wrap"
                  title="Click to edit comment"
                >
                  {annotation.note}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsEditingNote(true)}
                  className="ice-btn-dark w-full h-7 text-[11px] gap-1.5 rounded-[2px] text-[#9da7b3] hover:text-white"
                >
                  <FileText className="w-3 h-3 text-[#2a69df]" />
                  <span>Add a comment to this highlight...</span>
                </button>
              )}

              <div className="flex items-center justify-between text-[10px] text-[#6e7681] pt-0.5">
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
