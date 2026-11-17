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
  isPinned?: boolean
  pinnedAt?: number | null
  /** @deprecated Soft-delete was removed in v3; retained optional for legacy backup compatibility. */
  isDeleted?: boolean
  notesCount?: number
}

export interface Category {
  id?: number
  name: string
  color: string
  createdAt: number
}

export type NoteColor = 'blue' | 'purple' | 'red' | 'yellow' | 'green' | 'underline'

export interface IceRangeAnchor {
  startXPath: string
  startOffset: number
  endXPath: string
  endOffset: number
  href?: string
}

export interface Annotation {
  id?: number
  bookId: number
  cfiRange: string
  text: string
  note: string
  color: NoteColor
  pageNumber?: number
  chapterTitle?: string
  href?: string
  iceRange?: IceRangeAnchor
  createdAt: number
  updatedAt?: number
}

export interface Bookmark {
  id?: number
  bookId: number
  cfi: string
  label: string
  excerpt?: string
  chapterTitle?: string
  href?: string
  xpath?: string
  pageNumber: number
  progressPercent?: number
  createdAt: number
}

export type AutoscrollMode = 'countdown' | 'adaptive'

export interface UserSettings {
  id?: number
  theme: 'night' | 'day' | 'light-sepia' | 'dark-sepia'
  fontFamily: string
  fontSize: number
  lineHeight: number
  marginWidth: number
  dimming: number
  pageSpread: 'single' | 'double'
  ttsSpeed: number
  ttsPitch: number
  ttsVoice: string | null
  autoscrollSpeed: number
  autoscrollMode?: AutoscrollMode
  autoscrollCountdownSec?: number
  autoscrollAdaptiveSec?: number
  autoscrollMicroPause?: boolean
  autoscrollAdaptive?: boolean
  targetWpm?: number
  observedWpm?: number
  warmFilterEnabled?: boolean
  warmFilterTemp?: number
  warmFilterIntensity?: number
  rsvpWpm?: number
  language?: string
  copyExternal?: boolean
  autoUpdate?: boolean
  sendStats?: boolean
  viewMode?: 'grid' | 'list'
  lastNoteColor?: NoteColor
  pdfZoom?: number
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
    this.version(2).stores({
      books: '++id, filePath, format, categoryId, isFavorite, isRead, isDeleted, lastOpenedAt',
      categories: '++id, name',
      annotations: '++id, bookId, cfiRange, color, pageNumber, createdAt',
      bookmarks: '++id, bookId, cfi, pageNumber, createdAt',
      settings: '++id'
    })
    this.version(3)
      .stores({
        books: '++id, filePath, format, categoryId, isFavorite, isRead, isPinned, pinnedAt, lastOpenedAt',
        categories: '++id, name',
        annotations: '++id, bookId, cfiRange, color, pageNumber, createdAt',
        bookmarks: '++id, bookId, cfi, pageNumber, createdAt',
        settings: '++id'
      })
      .upgrade(async (tx) => {
        const booksTable = tx.table('books')
        const annotationsTable = tx.table('annotations')
        const bookmarksTable = tx.table('bookmarks')
        const all = await booksTable.toArray()
        const legacyDeletedIds: number[] = []

        for (const b of all) {
          if (b.isDeleted && b.id !== undefined) {
            legacyDeletedIds.push(b.id)
          } else if (b.id !== undefined) {
            await booksTable.update(b.id, {
              isPinned: Boolean(b.isPinned),
              pinnedAt: b.pinnedAt ?? null,
              isDeleted: undefined
            })
          }
        }

        if (legacyDeletedIds.length > 0) {
          await annotationsTable.where('bookId').anyOf(legacyDeletedIds).delete()
          await bookmarksTable.where('bookId').anyOf(legacyDeletedIds).delete()
          await booksTable.bulkDelete(legacyDeletedIds)
        }
      })
  }
}

export const db = new ReaderDatabase()

/**
 * Permanently deletes one or more books along with all associated annotations and bookmarks
 * inside a single atomic IndexedDB transaction.
 */
export async function permanentlyDeleteBooks(bookIds: number[]): Promise<void> {
  const uniqueIds = Array.from(new Set(bookIds.filter((id) => typeof id === 'number')))
  if (uniqueIds.length === 0) return
  await db.transaction('rw', [db.books, db.annotations, db.bookmarks], async () => {
    await db.annotations.where('bookId').anyOf(uniqueIds).delete()
    await db.bookmarks.where('bookId').anyOf(uniqueIds).delete()
    await db.books.bulkDelete(uniqueIds)
  })
}
