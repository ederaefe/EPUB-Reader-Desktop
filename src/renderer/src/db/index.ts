import Dexie, { Table } from 'dexie'

export interface Book {
  id?: number
  filePath: string
  title: string
  author: string
  coverDataUrl: string | null
  format: 'epub' | 'pdf' | 'mobi' | 'txt'
  fileSize: number
  addedAt: number
  lastOpenedAt: number | null
  progressCfi: string | null
  progressPercent: number
  currentPage: number
  totalPages: number
  categoryId: number | null
  isFavorite: boolean
  isRead: boolean
  isDeleted: boolean
}

export interface Category {
  id?: number
  name: string
  color: string
  createdAt: number
}

export interface Annotation {
  id?: number
  bookId: number
  cfiRange: string
  text: string
  note: string
  color: 'blue' | 'purple' | 'red' | 'yellow' | 'green' | 'underline'
  createdAt: number
}

export interface Bookmark {
  id?: number
  bookId: number
  cfi: string
  label: string
  pageNumber: number
  createdAt: number
}

export interface UserSettings {
  id?: number
  theme: 'night' | 'day' | 'light-sepia' | 'dark-sepia'
  fontFamily: 'original' | 'serif' | 'sans-serif' | 'monospace'
  fontSize: number
  lineHeight: number
  marginWidth: number
  dimming: number
  pageSpread: 'single' | 'double'
  ttsSpeed: number
  ttsPitch: number
  ttsVoice: string | null
  autoscrollSpeed: number
  autoscrollAdaptive?: boolean
  targetWpm?: number
  observedWpm?: number
  warmFilterEnabled?: boolean
  warmFilterTemp?: number
  warmFilterIntensity?: number
  rsvpWpm?: number
}

class ReaderDatabase extends Dexie {
  books!: Table<Book>
  categories!: Table<Category>
  annotations!: Table<Annotation>
  bookmarks!: Table<Bookmark>
  settings!: Table<UserSettings>

  constructor() {
    super('EpubReaderDesktopDB')
    this.version(1).stores({
      books: '++id, filePath, format, categoryId, isFavorite, isRead, isDeleted, lastOpenedAt',
      categories: '++id, name',
      annotations: '++id, bookId, cfiRange',
      bookmarks: '++id, bookId',
      settings: '++id'
    })
  }
}

export const db = new ReaderDatabase()
