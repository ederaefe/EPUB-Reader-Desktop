import { create } from 'zustand'
import type { Book, UserSettings } from '../db'

interface AppState {
  // Navigation & views
  currentView: 'library' | 'reader'
  selectedCategory: string // 'all', 'recent', 'favorites', 'read', 'deleted', or category id
  searchQuery: string
  formatFilter: string | null
  viewMode: 'grid' | 'list'

  // Active book
  activeBook: Book | null
  activeBookBuffer: ArrayBuffer | null

  // Reader drawers & modal state
  isTOCDrawerOpen: boolean
  isNotesDrawerOpen: boolean
  isBookmarksDrawerOpen: boolean
  isSearchDrawerOpen: boolean
  isSettingsDrawerOpen: boolean
  isFullSettingsModalOpen: boolean
  isHelpModalOpen: boolean

  // TTS & Autoscroll
  isTTSActive: boolean
  isAutoscrollActive: boolean
  activeTTSWord: string | null

  // User Settings (aligned with Icecream settings defaults)
  settings: UserSettings

  // Actions
  setView: (view: 'library' | 'reader') => void
  setSelectedCategory: (cat: string) => void
  setSearchQuery: (q: string) => void
  setFormatFilter: (fmt: string | null) => void
  setViewMode: (mode: 'grid' | 'list') => void
  setActiveBook: (book: Book | null, buffer?: ArrayBuffer | null) => void
  toggleTOCDrawer: (open?: boolean) => void
  toggleNotesDrawer: (open?: boolean) => void
  toggleBookmarksDrawer: (open?: boolean) => void
  toggleSearchDrawer: (open?: boolean) => void
  toggleSettingsDrawer: (open?: boolean) => void
  toggleFullSettingsModal: (open?: boolean) => void
  toggleHelpModal: (open?: boolean) => void
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
  viewMode: 'grid',

  activeBook: null,
  activeBookBuffer: null,

  isTOCDrawerOpen: false,
  isNotesDrawerOpen: false,
  isBookmarksDrawerOpen: false,
  isSearchDrawerOpen: false,
  isSettingsDrawerOpen: false,
  isFullSettingsModalOpen: false,
  isHelpModalOpen: false,

  isTTSActive: false,
  isAutoscrollActive: false,
  activeTTSWord: null,

  settings: {
    theme: 'night',
    fontFamily: 'original',
    fontSize: 21,
    lineHeight: 1.5,
    marginWidth: 40,
    dimming: 0,
    pageSpread: 'double',
    ttsSpeed: 1.0,
    ttsPitch: 1.0,
    ttsVoice: null,
    autoscrollSpeed: 40
  },

  setView: (view) => set({ currentView: view }),
  setSelectedCategory: (cat) => set({ selectedCategory: cat }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setFormatFilter: (fmt) => set({ formatFilter: fmt }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setActiveBook: (book, buffer = null) => set({ activeBook: book, activeBookBuffer: buffer }),
  toggleTOCDrawer: (open) =>
    set((s) => ({
      isTOCDrawerOpen: open ?? !s.isTOCDrawerOpen,
      isSettingsDrawerOpen: false,
      isNotesDrawerOpen: false,
      isBookmarksDrawerOpen: false
    })),
  toggleNotesDrawer: (open) =>
    set((s) => ({
      isNotesDrawerOpen: open ?? !s.isNotesDrawerOpen,
      isTOCDrawerOpen: false,
      isSettingsDrawerOpen: false,
      isBookmarksDrawerOpen: false
    })),
  toggleBookmarksDrawer: (open) =>
    set((s) => ({
      isBookmarksDrawerOpen: open ?? !s.isBookmarksDrawerOpen,
      isTOCDrawerOpen: false,
      isNotesDrawerOpen: false,
      isSettingsDrawerOpen: false
    })),
  toggleSearchDrawer: (open) =>
    set((s) => ({
      isSearchDrawerOpen: open ?? !s.isSearchDrawerOpen
    })),
  toggleSettingsDrawer: (open) =>
    set((s) => ({
      isSettingsDrawerOpen: open ?? !s.isSettingsDrawerOpen,
      isTOCDrawerOpen: false,
      isNotesDrawerOpen: false,
      isBookmarksDrawerOpen: false
    })),
  toggleFullSettingsModal: (open) =>
    set((s) => ({
      isFullSettingsModalOpen: open ?? !s.isFullSettingsModalOpen,
      isSettingsDrawerOpen: false
    })),
  toggleHelpModal: (open) =>
    set((s) => ({
      isHelpModalOpen: open ?? !s.isHelpModalOpen
    })),
  setTTSActive: (active) => set({ isTTSActive: active }),
  setAutoscrollActive: (active) => set({ isAutoscrollActive: active }),
  setActiveTTSWord: (word) => set({ activeTTSWord: word }),
  updateSettings: (newSettings) =>
    set((s) => ({ settings: { ...s.settings, ...newSettings } }))
}))
