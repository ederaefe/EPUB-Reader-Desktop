import { create } from 'zustand'
import { db, type Book, type NoteColor, type UserSettings } from '../db'
import { adaptiveScrollEngine } from '../services/adaptiveScrollService'

const SETTINGS_STORAGE_KEY = 'semply_user_settings_v1'

export const THEME_WINDOW_BG: Record<UserSettings['theme'], string> = {
  night: '#0a0a0a',
  day: '#f6f7f9',
  'light-sepia': '#f5ecd8',
  'dark-sepia': '#1f1914'
}

export const DEFAULT_SETTINGS: UserSettings = {
  id: 1,
  theme: 'night',
  fontFamily: 'original',
  fontSize: 21,
  fontWeight: 400,
  lineHeight: 1.5,
  marginWidth: 40,
  dimming: 0,
  pageLayout: 'dual',
  pageSpread: 'double',
  ttsSpeed: 1.0,
  ttsPitch: 1.0,
  ttsVoice: null,
  autoscrollSpeed: 40,
  autoscrollMode: 'adaptive',
  autoscrollCountdownSec: 20,
  autoscrollAdaptiveSec: 25,
  autoscrollMicroPause: true,
  autoscrollAdaptive: true,
  targetWpm: 250,
  observedWpm: 250,
  warmFilterEnabled: false,
  warmFilterTemp: 3200,
  warmFilterIntensity: 40,
  rsvpWpm: 350,
  copyExternal: false,
  autoUpdate: true,
  sendStats: false,
  viewMode: 'grid',
  lastNoteColor: 'yellow',
  pdfZoom: 1.2,
  scrollMode: 'horizontal',
  showProgressBar: true,
  resumeBarDismissedAt: null
}

export function applyDocumentTheme(theme: UserSettings['theme']): void {
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme =
      theme === 'day' || theme === 'light-sepia' ? 'light' : 'dark'
  }
  try {
    if (typeof window !== 'undefined' && (window as any).desktopAPI?.setBackgroundColor) {
      ;(window as any).desktopAPI.setBackgroundColor(THEME_WINDOW_BG[theme] || '#0a0a0a')
    }
  } catch {
    // Ignore if preload bridge isn't available (e.g. web preview)
  }
}

function loadSyncSettings(): UserSettings {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<UserSettings>
        const merged: UserSettings = { ...DEFAULT_SETTINGS, ...parsed, id: 1 }
        applyDocumentTheme(merged.theme)
        return merged
      }
    }
  } catch {
    // Ignore malformed localStorage
  }
  applyDocumentTheme(DEFAULT_SETTINGS.theme)
  return { ...DEFAULT_SETTINGS }
}

function persistSettings(merged: UserSettings): void {
  const payload: UserSettings = { ...merged, id: 1 }
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(payload))
    }
  } catch {
    // Ignore storage quota errors
  }
  // Mirror durably into Dexie IndexedDB for full backup/restore persistence
  db.settings.put(payload).catch(() => {})
}

const initialSettings = loadSyncSettings()

interface AppState {
  // Navigation & views
  currentView: 'library' | 'reader'
  selectedCategory: string // 'all', 'recent', 'favorites', 'read', or category id
  searchQuery: string
  formatFilter: string | null
  viewMode: 'grid' | 'list'

  // Font library download & offline connectivity state
  downloadedFontIds: string[]
  downloadingFontId: string | null
  isOnline: boolean

  // Active book
  activeBook: Book | null
  activeBookBuffer: ArrayBuffer | null
  currentChapterTitle: string
  pdfViewMode: 'original' | 'reflow'
  reflowEpubBuffer: ArrayBuffer | null
  pendingSeekPercent: number | null
  isConvertingPdf: boolean
  pdfConvertProgress: { percent: number; stage: string } | null

  // Modals & drawers
  isTOCDrawerOpen: boolean
  isNotesDrawerOpen: boolean
  isBookmarksDrawerOpen: boolean
  isSearchDrawerOpen: boolean
  isSettingsDrawerOpen: boolean
  isFullSettingsModalOpen: boolean
  isBookMetadataModalOpen: boolean
  isHelpModalOpen: boolean
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
  libraryVersion: number
  lastNoteColor: NoteColor
  pdfZoom: number
  scrollMode: 'horizontal' | 'vertical'

  // Native in-app feedback (replaces window.alert / window.confirm)
  toast: { message: string; variant?: 'info' | 'success' | 'error' } | null
  confirmDialog: {
    title: string
    message: string
    confirmLabel?: string
    cancelLabel?: string
    danger?: boolean
    onConfirm: () => void | Promise<void>
  } | null

  // User Settings (aligned with Semply Reader defaults)
  settings: UserSettings

  // Actions
  setView: (view: 'library' | 'reader') => void
  setSelectedCategory: (cat: string) => void
  setSearchQuery: (q: string) => void
  setFormatFilter: (fmt: string | null) => void
  setViewMode: (mode: 'grid' | 'list') => void
  setActiveBook: (
    book: Book | null,
    buffer?: ArrayBuffer | null,
    options?: { pdfViewMode?: 'original' | 'reflow'; reflowEpubBuffer?: ArrayBuffer | null }
  ) => void
  updateActiveBook: (patch: Partial<Book>) => void
  syncActiveBookProgress: (patch: Partial<Book>) => void
  setCurrentChapterTitle: (title: string) => void
  setPdfViewMode: (mode: 'original' | 'reflow') => void
  setReflowEpubBuffer: (buffer: ArrayBuffer | null) => void
  setPendingSeekPercent: (pct: number | null) => void
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
  toggleBookMetadataModal: (open?: boolean) => void
  toggleHelpModal: (open?: boolean) => void
  setActiveFootnote: (fn: { id: string; index?: string; text: string; href?: string } | null) => void
  setTTSActive: (active: boolean) => void
  setTTSMuted: (muted: boolean) => void
  setAutoscrollActive: (active: boolean) => void
  setActiveTTSWord: (word: string | null) => void
  setAdaptiveWpm: (wpm: number) => void
  setImmersiveFullscreen: (active: boolean) => void
  bumpAnnotationsVersion: () => void
  bumpBookmarksVersion: () => void
  bumpLibraryVersion: () => void
  setLastNoteColor: (color: NoteColor) => void
  setPdfZoom: (zoom: number) => void
  setScrollMode: (mode: 'horizontal' | 'vertical') => void
  showToast: (message: string, variant?: 'info' | 'success' | 'error') => void
  clearToast: () => void
  openConfirmDialog: (dialog: {
    title: string
    message: string
    confirmLabel?: string
    cancelLabel?: string
    danger?: boolean
    onConfirm: () => void | Promise<void>
  }) => void
  closeConfirmDialog: () => void
  updateSettings: (newSettings: Partial<UserSettings>) => void
  hydrateSettingsFromDb: () => Promise<void>
  setDownloadedFontIds: (ids: string[]) => void
  addDownloadedFontId: (id: string) => void
  setDownloadingFontId: (id: string | null) => void
  setIsOnline: (online: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  currentView: 'library',
  selectedCategory: 'all',
  searchQuery: '',
  formatFilter: null,
  viewMode: initialSettings.viewMode || 'grid',

  downloadedFontIds: [],
  downloadingFontId: null,
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,

  activeBook: null,
  activeBookBuffer: null,
  currentChapterTitle: '',
  pdfViewMode: 'original',
  reflowEpubBuffer: null,
  pendingSeekPercent: null,
  isConvertingPdf: false,
  pdfConvertProgress: null,

  isTOCDrawerOpen: false,
  isNotesDrawerOpen: false,
  isBookmarksDrawerOpen: false,
  isSearchDrawerOpen: false,
  isSettingsDrawerOpen: false,
  isFullSettingsModalOpen: false,
  isBookMetadataModalOpen: false,
  isHelpModalOpen: false,
  activeFootnote: null,

  isTTSActive: false,
  isTTSMuted: false,
  isAutoscrollActive: false,
  activeTTSWord: null,
  adaptiveWpm: initialSettings.observedWpm || initialSettings.targetWpm || 250,
  isImmersiveFullscreen: false,
  annotationsVersion: 0,
  bookmarksVersion: 0,
  libraryVersion: 0,
  lastNoteColor: initialSettings.lastNoteColor || 'yellow',
  pdfZoom: initialSettings.pdfZoom || 1.2,
  scrollMode: initialSettings.scrollMode || 'horizontal',
  toast: null,
  confirmDialog: null,

  settings: initialSettings,

  setView: (view) => set({ currentView: view }),
  setSelectedCategory: (cat) => set({ selectedCategory: cat }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setFormatFilter: (fmt) => set({ formatFilter: fmt }),
  setViewMode: (mode) =>
    set((s) => {
      const merged: UserSettings = { ...s.settings, viewMode: mode }
      persistSettings(merged)
      return { viewMode: mode, settings: merged }
    }),
  setActiveBook: (book, buffer = null, options) => {
    const isPdf = book?.format === 'pdf'
    if (isPdf) {
      adaptiveScrollEngine.stop()
    }
    set({
      activeBook: book,
      activeBookBuffer: buffer,
      pdfViewMode: options?.pdfViewMode ?? 'original',
      reflowEpubBuffer: options?.reflowEpubBuffer ?? null,
      pendingSeekPercent: null,
      ...(isPdf ? { isAutoscrollActive: false } : {})
    })
  },
  updateActiveBook: (patch) =>
    set((s) =>
      s.activeBook
        ? {
            activeBook: { ...s.activeBook, ...patch },
            libraryVersion: s.libraryVersion + 1
          }
        : s
    ),
  syncActiveBookProgress: (patch) =>
    set((s) =>
      s.activeBook
        ? {
            activeBook: { ...s.activeBook, ...patch }
          }
        : s
    ),
  setCurrentChapterTitle: (title) => set({ currentChapterTitle: title }),
  setPdfViewMode: (mode) => set({ pdfViewMode: mode }),
  setReflowEpubBuffer: (buffer) => set({ reflowEpubBuffer: buffer }),
  setPendingSeekPercent: (pct) => set({ pendingSeekPercent: pct }),
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
  toggleBookMetadataModal: (open) =>
    set((s) => ({
      isBookMetadataModalOpen: open ?? !s.isBookMetadataModalOpen,
      isSettingsDrawerOpen: false
    })),
  toggleHelpModal: (open) =>
    set((s) => ({
      isHelpModalOpen: open ?? !s.isHelpModalOpen
    })),
  setActiveFootnote: (fn) => set({ activeFootnote: fn }),
  setTTSActive: (active) => set({ isTTSActive: active }),
  setTTSMuted: (muted) => set({ isTTSMuted: muted }),
  setAutoscrollActive: (active) =>
    set((s) => {
      if (active && s.activeBook?.format === 'pdf') {
        adaptiveScrollEngine.stop()
        return { isAutoscrollActive: false }
      }
      return { isAutoscrollActive: active }
    }),
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
  bumpLibraryVersion: () => set((s) => ({ libraryVersion: s.libraryVersion + 1 })),
  setPdfZoom: (zoom) =>
    set((s) => {
      const clamped = Math.max(0.5, Math.min(3.0, Number(zoom.toFixed(2))))
      const merged: UserSettings = { ...s.settings, pdfZoom: clamped }
      persistSettings(merged)
      return { pdfZoom: clamped, settings: merged }
    }),
  setScrollMode: (mode) =>
    set((s) => {
      const merged: UserSettings = { ...s.settings, scrollMode: mode }
      persistSettings(merged)
      return { scrollMode: mode, settings: merged }
    }),
  showToast: (message, variant = 'info') => {
    set({ toast: { message, variant } })
    const w = window as any
    if (w.__semplyToastTimer) clearTimeout(w.__semplyToastTimer)
    w.__semplyToastTimer = setTimeout(() => {
      set((s) => (s.toast?.message === message ? { toast: null } : s))
    }, 3200)
  },
  clearToast: () => set({ toast: null }),
  openConfirmDialog: (dialog) => set({ confirmDialog: dialog }),
  closeConfirmDialog: () => set({ confirmDialog: null }),
  setLastNoteColor: (color) =>
    set((s) => {
      const merged: UserSettings = { ...s.settings, lastNoteColor: color }
      persistSettings(merged)
      return { lastNoteColor: color, settings: merged }
    }),
  updateSettings: (newSettings) =>
    set((s) => {
      const merged: UserSettings = { ...s.settings, ...newSettings, id: 1 }
      // Synchronize pageLayout and legacy pageSpread
      if (newSettings.pageLayout !== undefined) {
        merged.pageSpread = newSettings.pageLayout === 'dual' ? 'double' : 'single'
      } else if (newSettings.pageSpread !== undefined) {
        merged.pageLayout = newSettings.pageSpread === 'double' ? 'dual' : 'single'
      }
      // Always enforce horizontal mode in settings
      merged.scrollMode = 'horizontal'
      // Keep legacy autoscrollAdaptive flag synchronized with autoscrollMode
      if (newSettings.autoscrollMode !== undefined) {
        merged.autoscrollAdaptive = newSettings.autoscrollMode === 'adaptive'
      } else if (newSettings.autoscrollAdaptive !== undefined) {
        merged.autoscrollMode = newSettings.autoscrollAdaptive ? 'adaptive' : 'countdown'
      }
      if (newSettings.theme !== undefined) {
        applyDocumentTheme(merged.theme)
      }
      persistSettings(merged)
      return {
        settings: merged,
        ...(newSettings.viewMode ? { viewMode: newSettings.viewMode } : {}),
        ...(newSettings.lastNoteColor ? { lastNoteColor: newSettings.lastNoteColor } : {}),
        ...(newSettings.pdfZoom ? { pdfZoom: newSettings.pdfZoom } : {})
      }
    }),
  hydrateSettingsFromDb: async () => {
    try {
      const saved = await db.settings.get(1)
      if (saved) {
        const hasLocal = Boolean(
          typeof window !== 'undefined' && window.localStorage?.getItem(SETTINGS_STORAGE_KEY)
        )
        // Prefer localStorage if present (always newest sync write), otherwise restore from Dexie DB
        if (!hasLocal) {
          const merged: UserSettings = { ...DEFAULT_SETTINGS, ...saved, id: 1 }
          applyDocumentTheme(merged.theme)
          persistSettings(merged)
          set({
            settings: merged,
            viewMode: merged.viewMode || 'grid',
            lastNoteColor: merged.lastNoteColor || 'yellow',
            pdfZoom: merged.pdfZoom || 1.2,
            adaptiveWpm: merged.observedWpm || merged.targetWpm || 250
          })
          return
        }
      }
      // Ensure Dexie always mirrors the current active settings row (id = 1)
      const current = useAppStore.getState().settings
      applyDocumentTheme(current.theme)
      await db.settings.put({ ...current, id: 1 })
    } catch {
      // Ignore DB init race
    }
  },
  setDownloadedFontIds: (ids) => set({ downloadedFontIds: Array.from(new Set(ids)) }),
  addDownloadedFontId: (id) =>
    set((s) => ({
      downloadedFontIds: s.downloadedFontIds.includes(id)
        ? s.downloadedFontIds
        : [id, ...s.downloadedFontIds]
    })),
  setDownloadingFontId: (id) => set({ downloadingFontId: id }),
  setIsOnline: (online) => set({ isOnline: online })
}))
