import React, { useEffect, useState } from 'react'
import { X, Trash2, FileText } from 'lucide-react'
import { useAppStore } from '../../stores/useAppStore'
import { db, type Annotation } from '../../db'

interface NotesDrawerProps {
  onJumpToCfi: (cfi: string) => void
}

export const NotesDrawer: React.FC<NotesDrawerProps> = ({ onJumpToCfi }) => {
  const { isNotesDrawerOpen, toggleNotesDrawer, activeBook } = useAppStore()
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [selectedColor, setSelectedColor] = useState<string>('all')

  const loadNotes = async () => {
    if (!activeBook?.id) return
    const items = await db.annotations.where('bookId').equals(activeBook.id).toArray()
    setAnnotations(items)
  }

  useEffect(() => {
    if (isNotesDrawerOpen) {
      loadNotes()
    }
  }, [isNotesDrawerOpen, activeBook])

  const handleDelete = async (id: number) => {
    await db.annotations.delete(id)
    loadNotes()
  }

  if (!isNotesDrawerOpen) return null

  const colorMap: Record<string, string> = {
    blue: '#aed9f1',
    purple: '#ccb8e4',
    red: '#f3a2a2',
    yellow: '#f3e3a2',
    green: '#b1f3a4'
  }

  const filtered = annotations.filter((a) => (selectedColor === 'all' ? true : a.color === selectedColor))

  return (
    <aside className="fixed inset-y-0 left-0 w-80 bg-[#171a21] border-r border-[#232732] z-50 flex flex-col justify-between shadow-2xl select-none animate-in slide-in-from-left duration-150">
      <div className="flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="h-10 bg-[#14161c] border-b border-[#232732] px-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#2a69df]" />
            <span className="text-[13px] font-semibold text-white">Notes & Highlights</span>
          </div>
          <button
            onClick={() => toggleNotesDrawer(false)}
            className="w-6 h-6 flex items-center justify-center text-[#8b949e] hover:text-white hover:bg-[#282c37] rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Color filter */}
        <div className="p-2 border-b border-[#232732] flex items-center gap-1 text-[11px]">
          <button
            onClick={() => setSelectedColor('all')}
            className={`px-2 py-0.5 rounded ${selectedColor === 'all' ? 'bg-[#2a69df] text-white' : 'text-[#8b949e] hover:bg-[#232732]'}`}
          >
            All ({annotations.length})
          </button>
          {Object.entries(colorMap).map(([col, hex]) => (
            <button
              key={col}
              onClick={() => setSelectedColor(col)}
              className={`w-5 h-5 rounded flex items-center justify-center border ${
                selectedColor === col ? 'border-white scale-110' : 'border-transparent'
              }`}
            >
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: hex }} />
            </button>
          ))}
        </div>

        {/* Notes list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-2 text-[12px]">
          {filtered.length === 0 ? (
            <div className="text-center py-10 text-[#6e7681]">
              <p>No notes found</p>
              <p className="text-[11px] mt-1 text-[#484f58]">
                Select text in the reader to highlight or add a note.
              </p>
            </div>
          ) : (
            filtered.map((note) => (
              <div
                key={note.id}
                onClick={() => {
                  onJumpToCfi(note.cfiRange)
                  toggleNotesDrawer(false)
                }}
                className="p-2.5 bg-[#1f232d] hover:bg-[#252a36] border border-[#2b2f3a] rounded cursor-pointer transition-colors space-y-1 group"
              >
                <div className="flex items-center justify-between">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: colorMap[note.color] || '#f3e3a2' }}
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      if (note.id) handleDelete(note.id)
                    }}
                    className="text-[#6e7681] hover:text-[#f85149] p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="text-[#e6edf3] font-serif italic text-[12px] line-clamp-3 bg-[#171a21]/50 p-1.5 rounded border border-[#232732]">
                  "{note.text}"
                </div>
                {note.note && (
                  <div className="text-[#79c0ff] text-[11px] font-sans">
                    {note.note}
                  </div>
                )}
                <div className="text-[10px] text-[#6e7681]">
                  {new Date(note.createdAt).toLocaleDateString()}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </aside>
  )
}
