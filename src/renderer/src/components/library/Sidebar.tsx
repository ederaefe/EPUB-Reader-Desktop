import React, { useState } from 'react'
import {
  BookOpen,
  Clock,
  Star,
  FileText,
  Plus,
  CheckCircle2,
  Trash2,
  Settings,
  HelpCircle,
  ChevronDown,
  ChevronRight
} from 'lucide-react'
import { useAppStore } from '../../stores/useAppStore'
import { db, type Category } from '../../db'

interface SidebarProps {
  counts: {
    all: number
    recent: number
    favorites: number
    read: number
    epub: number
    pdf: number
    other: number
  }
  categories: Category[]
  categoryCounts?: Record<number, number>
  onRefresh: () => void
}

const COLOR_PALETTE = [
  '#2a69df', // Classic Blue
  '#8b5cf6', // Violet
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#f97316', // Orange
  '#ef4444', // Red
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#64748b'  // Slate
]

export const Sidebar: React.FC<SidebarProps> = ({ counts, categories, categoryCounts, onRefresh }) => {
  const {
    selectedCategory,
    setSelectedCategory,
    formatFilter,
    setFormatFilter,
    toggleSettingsDrawer,
    toggleFullSettingsModal,
    toggleHelpModal
  } = useAppStore()

  const [formatsExpanded, setFormatsExpanded] = useState(false)
  const [showAddCat, setShowAddCat] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [newCatColor, setNewCatColor] = useState('#2a69df')

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCatName.trim()) return
    await db.categories.add({
      name: newCatName.trim(),
      color: newCatColor,
      createdAt: Date.now()
    })
    setNewCatName('')
    setNewCatColor('#2a69df')
    setShowAddCat(false)
    onRefresh()
  }

  const handleDeleteCategory = async (e: React.MouseEvent, catId: number) => {
    e.stopPropagation()
    await db.categories.delete(catId)
    await db.books.where('categoryId').equals(catId).modify({ categoryId: null })
    if (selectedCategory === String(catId)) {
      setSelectedCategory('all')
    }
    onRefresh()
  }

  const isNavActive = (cat: string, fmt: string | null = null) => {
    if (fmt !== null) {
      return formatFilter === fmt
    }
    return selectedCategory === cat && !formatFilter
  }

  return (
    <aside className="w-56 h-full bg-[#0d0d0d] border-r border-white/[0.07] flex flex-col justify-between select-none shrink-0">
      {/* Top Section */}
      <div className="flex flex-col flex-1 overflow-y-auto">
        {/* Navigation list */}
        <nav className="p-2 space-y-0.5 text-[12px]">
          {/* All */}
          <button
            onClick={() => {
              setSelectedCategory('all')
              setFormatFilter(null)
            }}
            className={`w-full h-8 flex items-center justify-between px-2.5 rounded transition-colors relative ${
              isNavActive('all')
                ? 'bg-[#232732] text-white font-medium'
                : 'text-[#9da7b3] hover:bg-[#1f232c] hover:text-white'
            }`}
          >
            {isNavActive('all') && (
              <span className="absolute left-0 top-1 bottom-1 w-0.5 bg-[#2a69df] rounded-r" />
            )}
            <span className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[#8b949e]" />
              <span>All</span>
            </span>
            <span className="text-[11px] text-[#6e7681]">{counts.all}</span>
          </button>

          {/* Recently Read */}
          <button
            onClick={() => {
              setSelectedCategory('recent')
              setFormatFilter(null)
            }}
            className={`w-full h-8 flex items-center justify-between px-2.5 rounded transition-colors relative ${
              isNavActive('recent')
                ? 'bg-[#232732] text-white font-medium'
                : 'text-[#9da7b3] hover:bg-[#1f232c] hover:text-white'
            }`}
          >
            {isNavActive('recent') && (
              <span className="absolute left-0 top-1 bottom-1 w-0.5 bg-[#2a69df] rounded-r" />
            )}
            <span className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#8b949e]" />
              <span>Recently Read</span>
            </span>
            <span className="text-[11px] text-[#6e7681]">{counts.recent}</span>
          </button>

          {/* Favorites */}
          <button
            onClick={() => {
              setSelectedCategory('favorites')
              setFormatFilter(null)
            }}
            className={`w-full h-8 flex items-center justify-between px-2.5 rounded transition-colors relative ${
              isNavActive('favorites')
                ? 'bg-[#232732] text-white font-medium'
                : 'text-[#9da7b3] hover:bg-[#1f232c] hover:text-white'
            }`}
          >
            {isNavActive('favorites') && (
              <span className="absolute left-0 top-1 bottom-1 w-0.5 bg-[#2a69df] rounded-r" />
            )}
            <span className="flex items-center gap-2">
              <Star className="w-4 h-4 text-[#8b949e]" />
              <span>Favorites</span>
            </span>
            <span className="text-[11px] text-[#6e7681]">{counts.favorites}</span>
          </button>

          {/* Formats dropdown */}
          <div>
            <button
              onClick={() => setFormatsExpanded(!formatsExpanded)}
              className="w-full h-8 flex items-center justify-between px-2.5 rounded text-[#9da7b3] hover:bg-[#1f232c] hover:text-white transition-colors"
            >
              <span className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#8b949e]" />
                <span>Formats</span>
              </span>
              {formatsExpanded ? (
                <ChevronDown className="w-3.5 h-3.5 text-[#6e7681]" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-[#6e7681]" />
              )}
            </button>

            {formatsExpanded && (
              <div className="pl-6 pr-1 py-1 space-y-0.5">
                <button
                  onClick={() => setFormatFilter('epub')}
                  className={`w-full h-7 flex items-center justify-between px-2 rounded text-[11px] transition-colors ${
                    formatFilter === 'epub'
                      ? 'bg-[#232732] text-white font-medium'
                      : 'text-[#8b949e] hover:bg-[#1f232c] hover:text-white'
                  }`}
                >
                  <span>EPUB</span>
                  <span className="text-[#6e7681]">{counts.epub}</span>
                </button>
                <button
                  onClick={() => setFormatFilter('pdf')}
                  className={`w-full h-7 flex items-center justify-between px-2 rounded text-[11px] transition-colors ${
                    formatFilter === 'pdf'
                      ? 'bg-[#232732] text-white font-medium'
                      : 'text-[#8b949e] hover:bg-[#1f232c] hover:text-white'
                  }`}
                >
                  <span>PDF</span>
                  <span className="text-[#6e7681]">{counts.pdf}</span>
                </button>
              </div>
            )}
          </div>

          {/* Custom Categories created by user */}
          {categories.map((cat) => {
            const count = categoryCounts?.[cat.id!] ?? 0
            const isSelected = selectedCategory === String(cat.id)
            return (
              <div
                key={cat.id}
                onClick={() => {
                  setSelectedCategory(String(cat.id))
                  setFormatFilter(null)
                }}
                className={`group w-full h-8 flex items-center justify-between px-2.5 rounded-[2px] transition-colors cursor-pointer relative ${
                  isSelected
                    ? 'bg-[#232732] text-white font-medium'
                    : 'text-[#9da7b3] hover:bg-[#1f232c] hover:text-white'
                }`}
              >
                {isSelected && (
                  <span className="absolute left-0 top-1 bottom-1 w-0.5 bg-[#2a69df] rounded-r" />
                )}
                <span className="flex items-center gap-2 truncate">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                  <span className="truncate">{cat.name}</span>
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[11px] text-[#6e7681] group-hover:hidden">{count}</span>
                  <button
                    onClick={(e) => handleDeleteCategory(e, cat.id!)}
                    className="hidden group-hover:flex w-4 h-4 items-center justify-center text-[#8b949e] hover:text-[#f85149] rounded transition-colors"
                    title="Delete category"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )
          })}

          {/* Add new category form with color picker */}
          {showAddCat ? (
            <form onSubmit={handleCreateCategory} className="p-2 bg-[#1c1f26] border border-[#2d323f] rounded-[2px] space-y-2 my-1.5">
              <div className="text-[11px] font-medium text-[#c8d1dc]">New Category</div>
              <input
                type="text"
                autoFocus
                placeholder="Category name..."
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                className="ice-input w-full px-2 py-1 text-xs rounded-[2px]"
              />
              <div>
                <div className="text-[10px] text-[#8b949e] mb-1">Color:</div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {COLOR_PALETTE.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewCatColor(c)}
                      className={`w-3.5 h-3.5 rounded-full transition-transform ${
                        newCatColor === c ? 'ring-2 ring-white scale-110' : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                  <label className="relative cursor-pointer" title="Custom color">
                    <input
                      type="color"
                      value={newCatColor}
                      onChange={(e) => setNewCatColor(e.target.value)}
                      className="w-3.5 h-3.5 opacity-0 absolute inset-0 cursor-pointer"
                    />
                    <div
                      className="w-3.5 h-3.5 rounded-full border border-dashed border-[#8b949e] flex items-center justify-center text-[8px] text-[#8b949e] hover:border-white hover:text-white"
                      style={{ backgroundColor: COLOR_PALETTE.includes(newCatColor) ? 'transparent' : newCatColor }}
                    >
                      +
                    </div>
                  </label>
                </div>
              </div>

              {/* Preview */}
              <div className="flex items-center gap-1.5 pt-1 border-t border-[#232732]">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: newCatColor }} />
                <span className="text-[11px] text-[#9da7b3] truncate">{newCatName.trim() || 'Preview'}</span>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddCat(false)
                    setNewCatName('')
                    setNewCatColor('#2a69df')
                  }}
                  className="px-2 py-0.5 text-[11px] bg-[#282c37] hover:bg-[#323744] text-[#8b949e] hover:text-white rounded-[2px] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newCatName.trim()}
                  className="px-2.5 py-0.5 text-[11px] bg-[#2a69df] hover:bg-[#387bf0] disabled:opacity-50 text-white font-medium rounded-[2px] transition-colors"
                >
                  Add
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setShowAddCat(true)}
              className="w-full h-7 flex items-center gap-2 px-2.5 text-[11px] text-[#6e7681] hover:text-[#9da7b3] transition-colors rounded-[2px]"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add new category</span>
            </button>
          )}

          <div className="h-px bg-[#232732] my-2" />

          {/* Read */}
          <button
            onClick={() => {
              setSelectedCategory('read')
              setFormatFilter(null)
            }}
            className={`w-full h-8 flex items-center justify-between px-2.5 rounded transition-colors relative ${
              isNavActive('read')
                ? 'bg-[#232732] text-white font-medium'
                : 'text-[#9da7b3] hover:bg-[#1f232c] hover:text-white'
            }`}
          >
            {isNavActive('read') && (
              <span className="absolute left-0 top-1 bottom-1 w-0.5 bg-[#2a69df] rounded-r" />
            )}
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#8b949e]" />
              <span>Read</span>
            </span>
            <span className="text-[11px] text-[#6e7681]">{counts.read}</span>
          </button>
        </nav>
      </div>

      {/* Bottom Docked Settings & Help */}
      <div className="p-2 border-t border-[#232732] space-y-1 text-[12px]">
        <button
          onClick={() => toggleFullSettingsModal(true)}
          className="w-full h-8 flex items-center gap-2 px-2.5 rounded text-[#9da7b3] hover:bg-[#1f232c] hover:text-white transition-colors"
        >
          <Settings className="w-4 h-4 text-[#8b949e]" />
          <span>Settings</span>
        </button>
        <button
          onClick={() => toggleHelpModal(true)}
          className="w-full h-8 flex items-center gap-2 px-2.5 rounded text-[#9da7b3] hover:bg-[#1f232c] hover:text-white transition-colors"
        >
          <HelpCircle className="w-4 h-4 text-[#8b949e]" />
          <span>Help</span>
        </button>
      </div>
    </aside>
  )
}
