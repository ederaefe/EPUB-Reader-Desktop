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
    deleted: number
    epub: number
    pdf: number
    other: number
  }
  categories: Category[]
  onRefresh: () => void
}

export const Sidebar: React.FC<SidebarProps> = ({ counts, categories, onRefresh }) => {
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

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCatName.trim()) return
    await db.categories.add({
      name: newCatName.trim(),
      color: '#2a69df',
      createdAt: Date.now()
    })
    setNewCatName('')
    setShowAddCat(false)
    onRefresh()
  }

  const isNavActive = (cat: string, fmt: string | null = null) => {
    if (fmt !== null) {
      return formatFilter === fmt
    }
    return selectedCategory === cat && !formatFilter
  }

  return (
    <aside className="w-56 h-full bg-[#171a21] border-r border-[#232732] flex flex-col justify-between select-none shrink-0">
      {/* Top Header */}
      <div className="h-11 px-3 flex items-center gap-2.5 border-b border-[#232732] shrink-0">
        <div className="w-5 h-5 rounded-[2px] bg-[#2a69df] flex items-center justify-center text-white shrink-0">
          <BookOpen className="w-3 h-3" />
        </div>
        <div className="flex items-center">
          <span className="text-[13px] font-semibold text-white leading-tight">Ebook Reader</span>
        </div>
      </div>

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

          {/* Custom Categories */}
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => {
                setSelectedCategory(String(cat.id))
                setFormatFilter(null)
              }}
              className={`w-full h-8 flex items-center justify-between px-2.5 rounded transition-colors relative ${
                selectedCategory === String(cat.id)
                  ? 'bg-[#232732] text-white font-medium'
                  : 'text-[#9da7b3] hover:bg-[#1f232c] hover:text-white'
              }`}
            >
              {selectedCategory === String(cat.id) && (
                <span className="absolute left-0 top-1 bottom-1 w-0.5 bg-[#2a69df] rounded-r" />
              )}
              <span className="flex items-center gap-2 truncate">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                <span className="truncate">{cat.name}</span>
              </span>
            </button>
          ))}

          {/* Add new category */}
          {showAddCat ? (
            <form onSubmit={handleCreateCategory} className="px-2 pt-1 pb-2">
              <input
                type="text"
                autoFocus
                placeholder="Category name..."
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                onBlur={() => setShowAddCat(false)}
                className="ice-input w-full px-2 py-1 text-xs"
              />
            </form>
          ) : (
            <button
              onClick={() => setShowAddCat(true)}
              className="w-full h-7 flex items-center gap-2 px-2.5 text-[11px] text-[#6e7681] hover:text-[#9da7b3] transition-colors"
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

          {/* Deleted */}
          <button
            onClick={() => {
              setSelectedCategory('deleted')
              setFormatFilter(null)
            }}
            className={`w-full h-8 flex items-center justify-between px-2.5 rounded transition-colors relative ${
              isNavActive('deleted')
                ? 'bg-[#232732] text-white font-medium'
                : 'text-[#9da7b3] hover:bg-[#1f232c] hover:text-white'
            }`}
          >
            {isNavActive('deleted') && (
              <span className="absolute left-0 top-1 bottom-1 w-0.5 bg-[#2a69df] rounded-r" />
            )}
            <span className="flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-[#8b949e]" />
              <span>Deleted</span>
            </span>
            <span className="text-[11px] text-[#6e7681]">{counts.deleted}</span>
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
        <button
          onClick={() => toggleFullSettingsModal(true)}
          className="w-full h-8 flex items-center justify-center gap-1.5 px-2.5 rounded-[2px] bg-[#2a69df] hover:bg-[#387bf0] text-white text-[12px] font-medium transition-colors shadow-sm mt-1"
        >
          <Star className="w-3.5 h-3.5 fill-current" />
          <span>Upgrade to PRO</span>
        </button>
      </div>
    </aside>
  )
}
