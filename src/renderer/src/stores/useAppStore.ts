import { create } from 'zustand'
import type { Book, UserSettings } from '../db'

interface AppState {
  // Navigation & views
  currentView: 'library' | 'reader'
  selectedCategory: string // 'all', 'recent', 'favorites', or category id
  searchQuery: string
  formatFilter: string | null

  // Active book
  activeBook: Book | null
  activeBookBuffer: ArrayBuffer | null

  // Reader state
  isTOCDrawerOpen: boolean
  isSettingsDrawerOpen: boolean
  isTTSActive: boolean
  isAutoscrollActive: boolean
  activeTTSWord: string | null

  // User Settings
  settings: UserSettings

  // Actions
  setView: (view: 'library' | 'reader') => void
  setSelectedCategory: (cat: string) => void
  setSearchQuery: (q: string) => void
  setFormatFilter: (fmt: string | null) => void
  setActiveBook: (book: Book | null, buffer?: ArrayBuffer | null) => void
  toggleTOCDrawer: (open?: boolean) => void
  toggleSettingsDrawer: (open?: boolean) => void
  setTTSActive: (active: boolean) => void
  setAutoscrollActive: (active: boolean) => void
  setActiveTTSWord: (word: string | null) => void
  updateSettings: (newSettings: Partial<UserSettings>) => void
}

export const useAppStore = create<AppState>((set) => ({
  currentView: 'library',
  selectedCategory: 'all',
  searchQuery: '',
  formatFilter: null,

  activeBook: null,
  activeBookBuffer: null,

  isTOCDrawerOpen: false,
  isSettingsDrawerOpen: false,
  isTTSActive: false,
  isAutoscrollActive: false,
  activeTTSWord: null,

  settings: {
    theme: 'night',
    fontFamily: 'serif',
    fontSize: 18,
    lineHeight: 1.6,
    marginWidth: 40,
    dimming: 0,
    pageSpread: 'single',
    ttsSpeed: 1.0,
    ttsPitch: 1.0,
    ttsVoice: null,
    autoscrollSpeed: 40
  },

  setView: (view) => set({ currentView: view }),
  setSelectedCategory: (cat) => set({ selectedCategory: cat }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setFormatFilter: (fmt) => set({ formatFilter: fmt }),
  setActiveBook: (book, buffer = null) => set({ activeBook: book, activeBookBuffer: buffer }),
  toggleTOCDrawer: (open) => set((s) => ({ isTOCDrawerOpen: open ?? !s.isTOCDrawerOpen })),
  toggleSettingsDrawer: (open) => set((s) => ({ isSettingsDrawerOpen: open ?? !s.isSettingsDrawerOpen })),
  setTTSActive: (active) => set({ isTTSActive: active }),
  setAutoscrollActive: (active) => set({ isAutoscrollActive: active }),
  setActiveTTSWord: (word) => set({ activeTTSWord: word }),
  updateSettings: (newSettings) =>
    set((s) => ({ settings: { ...s.settings, ...newSettings } }))
}))
