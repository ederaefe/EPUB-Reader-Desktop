import { create } from 'zustand'
import type { Book, NoteColor, UserSettings } from '../db'

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
  pdfViewMode: 'original' | 'reflow'
  reflowEpubBuffer: ArrayBuffer | null
  isConvertingPdf: boolean
  pdfConvertProgress: { percent: number; stage: string } | null

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

  // Live reactive sync counters for Notes & Bookmarks
  annotationsVersion: number
  bookmarksVersion: number
  lastNoteColor: NoteColor

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
  setPdfViewMode: (mode: 'original' | 'reflow') => void
  setReflowEpubBuffer: (buffer: ArrayBuffer | null) => void
  setPdfConversionState: (
    converting: boolean,
    progress?: { percent: number; stage: string } | null
  ) => void
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
  bumpAnnotationsVersion: () => void
  bumpBookmarksVersion: () => void
  setLastNoteColor: (color: NoteColor) => void
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
  pdfViewMode: 'original',
  reflowEpubBuffer: null,
  isConvertingPdf: false,
  pdfConvertProgress: null,

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
  annotationsVersion: 0,
  bookmarksVersion: 0,
  lastNoteColor: 'yellow',

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
  setActiveBook: (book, buffer = null) =>
    set({
      activeBook: book,
      activeBookBuffer: buffer,
      pdfViewMode: 'original',
      reflowEpubBuffer: null
    }),
  setCurrentChapterTitle: (title) => set({ currentChapterTitle: title }),
  setPdfViewMode: (mode) => set({ pdfViewMode: mode }),
  setReflowEpubBuffer: (buffer) => set({ reflowEpubBuffer: buffer }),
  setPdfConversionState: (converting, progress = null) =>
    set({ isConvertingPdf: converting, pdfConvertProgress: progress }),
  toggleTOCDrawer: (open) =>
    set((s) => ({
      isTOCDrawerOpen: open ?? !s.isTOCDrawerOpen,
      isSettingsDrawerOpen: false,
      isNotesDrawerOpen: false,
      isBookmarksDrawerOpen: false,
      isSearchDrawerOpen: false
    })),
  toggleNotesDrawer: (open) =>
    set((s) => ({
      isNotesDrawerOpen: open ?? !s.isNotesDrawerOpen,
      isTOCDrawerOpen: false,
      isSettingsDrawerOpen: false,
      isBookmarksDrawerOpen: false,
      isSearchDrawerOpen: false
    })),
  toggleBookmarksDrawer: (open) =>
    set((s) => ({
      isBookmarksDrawerOpen: open ?? !s.isBookmarksDrawerOpen,
      isTOCDrawerOpen: false,
      isNotesDrawerOpen: false,
      isSettingsDrawerOpen: false,
      isSearchDrawerOpen: false
    })),
  toggleSearchDrawer: (open) =>
    set((s) => ({
      isSearchDrawerOpen: open ?? !s.isSearchDrawerOpen,
      isTOCDrawerOpen: false,
      isNotesDrawerOpen: false,
      isBookmarksDrawerOpen: false,
      isSettingsDrawerOpen: false
    })),
  toggleSettingsDrawer: (open) =>
    set((s) => ({
      isSettingsDrawerOpen: open ?? !s.isSettingsDrawerOpen,
      isTOCDrawerOpen: false,
      isNotesDrawerOpen: false,
      isBookmarksDrawerOpen: false,
      isSearchDrawerOpen: false
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
  bumpAnnotationsVersion: () => set((s) => ({ annotationsVersion: s.annotationsVersion + 1 })),
  bumpBookmarksVersion: () => set((s) => ({ bookmarksVersion: s.bookmarksVersion + 1 })),
  setLastNoteColor: (color) => set({ lastNoteColor: color }),
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
