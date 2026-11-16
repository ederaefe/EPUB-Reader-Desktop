import React, { useState } from 'react'
import {
  BookOpen,
  Clock,
  Heart,
  FolderPlus,
  BookmarkCheck,
  Trash2,
  Settings,
  HelpCircle,
  FolderOpen
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
  const { selectedCategory, setSelectedCategory, formatFilter, setFormatFilter, toggleSettingsDrawer } =
    useAppStore()
  const [newCatName, setNewCatName] = useState('')
  const [showAddCat, setShowAddCat] = useState(false)

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCatName.trim()) return
    await db.categories.add({
      name: newCatName.trim(),
      color: '#3b82f6',
      createdAt: Date.now()
    })
    setNewCatName('')
    setShowAddCat(false)
    onRefresh()
  }

  return (
    <aside className="w-60 h-full glass-panel rounded-r-3xl p-4 flex flex-col justify-between select-none">
      <div className="space-y-6 overflow-y-auto pr-1">
        {/* Main Shelves */}
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2.5 px-2">
            Library
          </div>
          <nav className="space-y-1">
            <button
              onClick={() => {
                setSelectedCategory('all')
                setFormatFilter(null)
              }}
              className={`btn-press w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                selectedCategory === 'all' && !formatFilter
                  ? 'bg-blue-600/25 text-blue-300 border border-blue-400/25 shadow-sm'
                  : 'text-slate-300 hover:bg-white/5 hover:text-white'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <BookOpen className="w-4 h-4 text-blue-400" />
                All Books
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/10 text-slate-300 font-semibold">
                {counts.all}
              </span>
            </button>

            <button
              onClick={() => {
                setSelectedCategory('recent')
                setFormatFilter(null)
              }}
              className={`btn-press w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                selectedCategory === 'recent'
                  ? 'bg-blue-600/25 text-blue-300 border border-blue-400/25 shadow-sm'
                  : 'text-slate-300 hover:bg-white/5 hover:text-white'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <Clock className="w-4 h-4 text-amber-400" />
                Recently Read
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/10 text-slate-300 font-semibold">
                {counts.recent}
              </span>
            </button>

            <button
              onClick={() => {
                setSelectedCategory('favorites')
                setFormatFilter(null)
              }}
              className={`btn-press w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                selectedCategory === 'favorites'
                  ? 'bg-blue-600/25 text-blue-300 border border-blue-400/25 shadow-sm'
                  : 'text-slate-300 hover:bg-white/5 hover:text-white'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <Heart className="w-4 h-4 text-rose-400" />
                Favorites
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/10 text-slate-300 font-semibold">
                {counts.favorites}
              </span>
            </button>
          </nav>
        </div>

        {/* Formats Filter */}
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2 px-2">
            Formats
          </div>
          <div className="space-y-1">
            <button
              onClick={() => setFormatFilter(formatFilter === 'epub' ? null : 'epub')}
              className={`btn-press w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                formatFilter === 'epub'
                  ? 'bg-blue-600/25 text-blue-300 border border-blue-400/25'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
              }`}
            >
              <span>EPUB</span>
              <span className="text-[11px] text-slate-500">{counts.epub}</span>
            </button>
            <button
              onClick={() => setFormatFilter(formatFilter === 'pdf' ? null : 'pdf')}
              className={`btn-press w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                formatFilter === 'pdf'
                  ? 'bg-blue-600/25 text-blue-300 border border-blue-400/25'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
              }`}
            >
              <span>PDF (Converted)</span>
              <span className="text-[11px] text-slate-500">{counts.pdf}</span>
            </button>
            <button
              onClick={() => setFormatFilter(formatFilter === 'mobi' ? null : 'mobi')}
              className={`btn-press w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                formatFilter === 'mobi'
                  ? 'bg-blue-600/25 text-blue-300 border border-blue-400/25'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
              }`}
            >
              <span>MOBI / TXT</span>
              <span className="text-[11px] text-slate-500">{counts.other}</span>
            </button>
          </div>
        </div>

        {/* Custom Categories */}
        <div>
          <div className="flex items-center justify-between mb-2 px-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Categories
            </span>
            <button
              onClick={() => setShowAddCat(!showAddCat)}
              className="text-blue-400 hover:text-blue-300 text-xs font-semibold p-1"
              title="Add Category"
            >
              <FolderPlus className="w-3.5 h-3.5" />
            </button>
          </div>

          {showAddCat && (
            <form onSubmit={handleCreateCategory} className="mb-2 px-1">
              <input
                type="text"
                autoFocus
                placeholder="Category name..."
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                className="w-full bg-white/10 border border-white/15 rounded-lg px-2.5 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-400"
              />
            </form>
          )}

          <div className="space-y-1">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => {
                  setSelectedCategory(String(cat.id))
                  setFormatFilter(null)
                }}
                className={`btn-press w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                  selectedCategory === String(cat.id)
                    ? 'bg-blue-600/25 text-blue-300 border border-blue-400/25'
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                }`}
              >
                <span className="flex items-center gap-2 truncate">
                  <FolderOpen className="w-3.5 h-3.5 text-blue-400/80" />
                  {cat.name}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Finished / Deleted */}
        <div className="space-y-1 pt-2 border-t border-white/5">
          <button
            onClick={() => {
              setSelectedCategory('read')
              setFormatFilter(null)
            }}
            className={`btn-press w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
              selectedCategory === 'read'
                ? 'bg-blue-600/25 text-blue-300 border border-blue-400/25'
                : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <BookmarkCheck className="w-3.5 h-3.5 text-emerald-400" />
              Finished
            </span>
            <span className="text-[11px] text-slate-500">{counts.read}</span>
          </button>
          <button
            onClick={() => {
              setSelectedCategory('deleted')
              setFormatFilter(null)
            }}
            className={`btn-press w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
              selectedCategory === 'deleted'
                ? 'bg-rose-600/25 text-rose-300 border border-rose-400/25'
                : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              Trash
            </span>
            <span className="text-[11px] text-slate-500">{counts.deleted}</span>
          </button>
        </div>
      </div>

      {/* Footer Settings */}
      <div className="pt-3 border-t border-white/5 flex items-center justify-between text-slate-400 text-xs">
        <button
          onClick={() => toggleSettingsDrawer(true)}
          className="btn-press flex items-center gap-2 hover:text-white transition-colors"
        >
          <Settings className="w-4 h-4" />
          <span>Settings</span>
        </button>
        <span className="text-[10px] text-slate-600">v1.0.0</span>
      </div>
    </aside>
  )
}
