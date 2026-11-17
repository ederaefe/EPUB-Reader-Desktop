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
  currentChapterTitle: string

  // Modals & drawers
  isTOCDrawerOpen: boolean
  isNotesDrawerOpen: boolean
  isBookmarksDrawerOpen: boolean
  isSearchDrawerOpen: boolean
  isSettingsDrawerOpen: boolean
  isFullSettingsModalOpen: boolean
  isHelpModalOpen: boolean
  isRSVPActive: boolean
  activeFootnote: { id: string; index?: string; text: string; href?: string } | null

  // TTS & Autoscroll
  isTTSActive: boolean
  isTTSMuted: boolean
  isAutoscrollActive: boolean
  activeTTSWord: string | null
  adaptiveWpm: number
  isImmersiveFullscreen: boolean

  // User Settings (aligned with Semply Reader defaults)
  settings: UserSettings

  // Actions
  setView: (view: 'library' | 'reader') => void
  setSelectedCategory: (cat: string) => void
  setSearchQuery: (q: string) => void
  setFormatFilter: (fmt: string | null) => void
  setViewMode: (mode: 'grid' | 'list') => void
  setActiveBook: (book: Book | null, buffer?: ArrayBuffer | null) => void
  setCurrentChapterTitle: (title: string) => void
  toggleTOCDrawer: (open?: boolean) => void
  toggleNotesDrawer: (open?: boolean) => void
  toggleBookmarksDrawer: (open?: boolean) => void
  toggleSearchDrawer: (open?: boolean) => void
  toggleSettingsDrawer: (open?: boolean) => void
  toggleFullSettingsModal: (open?: boolean) => void
  toggleHelpModal: (open?: boolean) => void
  toggleRSVP: (open?: boolean) => void
  setActiveFootnote: (fn: { id: string; index?: string; text: string; href?: string } | null) => void
  setTTSActive: (active: boolean) => void
  setTTSMuted: (muted: boolean) => void
  setAutoscrollActive: (active: boolean) => void
  setActiveTTSWord: (word: string | null) => void
  setAdaptiveWpm: (wpm: number) => void
  setImmersiveFullscreen: (active: boolean) => void
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
  currentChapterTitle: '',

  isTOCDrawerOpen: false,
  isNotesDrawerOpen: false,
  isBookmarksDrawerOpen: false,
  isSearchDrawerOpen: false,
  isSettingsDrawerOpen: false,
  isFullSettingsModalOpen: false,
  isHelpModalOpen: false,
  isRSVPActive: false,
  activeFootnote: null,

  isTTSActive: false,
  isTTSMuted: false,
  isAutoscrollActive: false,
  activeTTSWord: null,
  adaptiveWpm: 250,
  isImmersiveFullscreen: false,

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
    autoscrollSpeed: 40,
    autoscrollMode: 'adaptive',
    autoscrollCountdownSec: 20,
    autoscrollMicroPause: true,
    autoscrollAdaptive: true,
    targetWpm: 250,
    observedWpm: 250,
    warmFilterEnabled: false,
    warmFilterTemp: 3200,
    warmFilterIntensity: 40,
    rsvpWpm: 350
  },

  setView: (view) => set({ currentView: view }),
  setSelectedCategory: (cat) => set({ selectedCategory: cat }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setFormatFilter: (fmt) => set({ formatFilter: fmt }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setActiveBook: (book, buffer = null) => set({ activeBook: book, activeBookBuffer: buffer }),
  setCurrentChapterTitle: (title) => set({ currentChapterTitle: title }),
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
  toggleRSVP: (open) =>
    set((s) => ({
      isRSVPActive: open ?? !s.isRSVPActive
    })),
  setActiveFootnote: (fn) => set({ activeFootnote: fn }),
  setTTSActive: (active) => set({ isTTSActive: active }),
  setTTSMuted: (muted) => set({ isTTSMuted: muted }),
  setAutoscrollActive: (active) => set({ isAutoscrollActive: active }),
  setActiveTTSWord: (word) => set({ activeTTSWord: word }),
  setAdaptiveWpm: (wpm) => set({ adaptiveWpm: wpm }),
  setImmersiveFullscreen: (active) =>
    set((s) => ({
      isImmersiveFullscreen: active,
      ...(active
        ? {
            isTOCDrawerOpen: false,
            isNotesDrawerOpen: false,
            isBookmarksDrawerOpen: false,
            isSettingsDrawerOpen: false,
            isSearchDrawerOpen: false
          }
        : {}),
      currentView: s.currentView
    })),
  updateSettings: (newSettings) =>
    set((s) => {
      const merged: UserSettings = { ...s.settings, ...newSettings }
      // Keep legacy autoscrollAdaptive flag synchronized with autoscrollMode
      if (newSettings.autoscrollMode !== undefined) {
        merged.autoscrollAdaptive = newSettings.autoscrollMode === 'adaptive'
      } else if (newSettings.autoscrollAdaptive !== undefined) {
        merged.autoscrollMode = newSettings.autoscrollAdaptive ? 'adaptive' : 'countdown'
      }
      return { settings: merged }
    })
}))
