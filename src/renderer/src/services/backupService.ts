// Additive Universal Library Backup & Sync Engine
// Implements non-destructive JSON & ZIP export and additive upsert merge

import JSZip from 'jszip'
import { db, type Book, type Category, type Annotation, type Bookmark, type UserSettings, type NoteColor } from '../db'
import { useAppStore } from '../stores/useAppStore'
import { normalizeTags } from '../../../shared/bookMetadata'

export interface LibraryBackupData {
  version: number
  exportedAt: number
  appName: string
  books: Book[]
  categories: Category[]
  annotations: Annotation[]
  bookmarks: Bookmark[]
  settings?: UserSettings
}

function isPlainObject(val: unknown): val is Record<string, any> {
  return typeof val === 'object' && val !== null && !Array.isArray(val)
}

function hasPrototypePollutionKey(obj: Record<string, any>): boolean {
  for (const key of Object.keys(obj)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      return true
    }
  }
  return false
}

function sanitizeString(val: any, maxLen = 256): string {
  return typeof val === 'string' ? val.trim().slice(0, maxLen) : ''
}

function sanitizeColor(color: any, fallback = '#2a69df'): string {
  return typeof color === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(color.trim()) ? color.trim() : fallback
}

function sanitizeNoteColor(color: any): NoteColor {
  const valid: NoteColor[] = ['blue', 'purple', 'red', 'yellow', 'green', 'underline']
  return valid.includes(color) ? color : 'yellow'
}

function sanitizeCoverDataUrl(url: any): string | null {
  if (typeof url !== 'string') return null
  const trimmed = url.trim()
  if (/^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/.test(trimmed)) {
    return trimmed
  }
  return null
}

export function validateBackupStructure(raw: unknown): raw is LibraryBackupData {
  if (!isPlainObject(raw)) return false
  if (hasPrototypePollutionKey(raw)) return false

  if (typeof raw.version !== 'number' || !Number.isFinite(raw.version)) return false
  if (!Array.isArray(raw.books)) return false

  for (const b of raw.books) {
    if (!isPlainObject(b) || hasPrototypePollutionKey(b)) return false
    if (typeof b.title !== 'string' || typeof b.filePath !== 'string') return false
  }

  if (raw.categories !== undefined) {
    if (!Array.isArray(raw.categories)) return false
    for (const c of raw.categories) {
      if (!isPlainObject(c) || hasPrototypePollutionKey(c)) return false
      if (typeof c.name !== 'string') return false
    }
  }

  if (raw.annotations !== undefined) {
    if (!Array.isArray(raw.annotations)) return false
    for (const a of raw.annotations) {
      if (!isPlainObject(a) || hasPrototypePollutionKey(a)) return false
      if (typeof a.bookId !== 'number' || typeof a.cfiRange !== 'string') return false
    }
  }

  if (raw.bookmarks !== undefined) {
    if (!Array.isArray(raw.bookmarks)) return false
    for (const bm of raw.bookmarks) {
      if (!isPlainObject(bm) || hasPrototypePollutionKey(bm)) return false
      if (typeof bm.bookId !== 'number' || typeof bm.cfi !== 'string') return false
    }
  }

  if (raw.settings !== undefined) {
    if (!isPlainObject(raw.settings) || hasPrototypePollutionKey(raw.settings)) return false
  }

  return true
}

export class BackupService {
  // Export library metadata & annotations to JSON string
  public async generateBackupData(): Promise<LibraryBackupData> {
    const books = await db.books.toArray()
    const categories = await db.categories.toArray()
    const annotations = await db.annotations.toArray()
    const bookmarks = await db.bookmarks.toArray()
    const settings = await db.settings.toCollection().first()

    return {
      version: 1,
      exportedAt: Date.now(),
      appName: 'Semply Ebook Reader',
      books,
      categories,
      annotations,
      bookmarks,
      settings
    }
  }

  // Export as .json file
  public async exportToJson(): Promise<{ success: boolean; canceled?: boolean; filePath?: string }> {
    try {
      const data = await this.generateBackupData()
      const jsonStr = JSON.stringify(data, null, 2)
      const dateStr = new Date().toISOString().slice(0, 10)
      const defaultName = `Semply_Reader_Backup_${dateStr}.json`

      if (window.desktopAPI?.showSaveDialog && window.desktopAPI?.writeFileText) {
        const targetPath = await window.desktopAPI.showSaveDialog({
          title: 'Export Library Backup (JSON)',
          defaultPath: defaultName,
          filters: [{ name: 'JSON Backup', extensions: ['json'] }]
        })

        // Respect OS Save Dialog cancellation — never fall through to browser download
        if (!targetPath) {
          return { success: false, canceled: true }
        }

        await window.desktopAPI.writeFileText(targetPath, jsonStr)
        return { success: true, filePath: targetPath }
      }

      // Browser fallback (non-Electron preview only)
      const blob = new Blob([jsonStr], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = defaultName
      a.click()
      URL.revokeObjectURL(url)

      return { success: true }
    } catch (e) {
      console.error('Export JSON failed:', e)
      return { success: false }
    }
  }

  // Export as .zip archive (bundled with cover images & full metadata)
  public async exportToZip(): Promise<{ success: boolean; canceled?: boolean; filePath?: string }> {
    try {
      const data = await this.generateBackupData()
      const zip = new JSZip()

      // Add main metadata json
      zip.file('library_metadata.json', JSON.stringify(data, null, 2))

      // Add covers folder
      const coversFolder = zip.folder('covers')
      data.books.forEach((b, idx) => {
        if (b.coverDataUrl && b.coverDataUrl.startsWith('data:image')) {
          const parts = b.coverDataUrl.split(',')
          if (parts[1]) {
            coversFolder?.file(`book_${idx + 1}_cover.jpg`, parts[1], { base64: true })
          }
        }
      })

      const content = await zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' })
      const dateStr = new Date().toISOString().slice(0, 10)
      const defaultName = `Semply_Reader_Archive_${dateStr}.zip`

      if (window.desktopAPI?.showSaveDialog && window.desktopAPI?.writeFileBuffer) {
        const targetPath = await window.desktopAPI.showSaveDialog({
          title: 'Export Library Archive (ZIP)',
          defaultPath: defaultName,
          filters: [{ name: 'ZIP Archive', extensions: ['zip'] }]
        })

        // Respect OS Save Dialog cancellation — never fall through to browser download
        if (!targetPath) {
          return { success: false, canceled: true }
        }

        await window.desktopAPI.writeFileBuffer(targetPath, content)
        return { success: true, filePath: targetPath }
      }

      // Browser fallback (non-Electron preview only)
      const blob = new Blob([content], { type: 'application/zip' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = defaultName
      a.click()
      URL.revokeObjectURL(url)

      return { success: true }
    } catch (e) {
      console.error('Export ZIP failed:', e)
      return { success: false }
    }
  }

  // Non-destructive Additive Merge
  // Never overwrites local data—deduplicates books by filePath/Title, unions custom shelves, and appends new highlights
  public async importAdditiveBackup(
    backup: LibraryBackupData,
    zipInstance?: JSZip | null
  ): Promise<{ addedBooks: number; addedAnnotations: number; addedBookmarks: number; addedCategories: number }> {
    const existingBooks = await db.books.toArray()
    const existingCategories = await db.categories.toArray()
    const existingAnnotations = await db.annotations.toArray()
    const existingBookmarks = await db.bookmarks.toArray()

    let addedBooks = 0
    let addedCategories = 0
    let addedAnnotations = 0
    let addedBookmarks = 0

    // 1. Union Categories
    const categoryNameMap = new Map<string, number>()
    existingCategories.forEach((c) => {
      if (c.id) categoryNameMap.set(c.name.toLowerCase(), c.id)
    })

    const catIdMapping = new Map<number, number>()
    for (const remoteCat of backup.categories || []) {
      const safeCatName = sanitizeString(remoteCat.name, 64)
      if (!safeCatName) continue
      const key = safeCatName.toLowerCase()
      if (categoryNameMap.has(key)) {
        if (remoteCat.id) catIdMapping.set(remoteCat.id, categoryNameMap.get(key)!)
      } else {
        const newId = await db.categories.add({
          name: safeCatName,
          color: sanitizeColor(remoteCat.color, '#2a69df'),
          createdAt: typeof remoteCat.createdAt === 'number' && Number.isFinite(remoteCat.createdAt) ? remoteCat.createdAt : Date.now()
        })
        categoryNameMap.set(key, newId as number)
        if (remoteCat.id) catIdMapping.set(remoteCat.id, newId as number)
        addedCategories++
      }
    }

    // 2. Deduplicate Books by filePath or title+author
    const bookKeyMap = new Map<string, Book>()
    existingBooks.forEach((b) => {
      bookKeyMap.set(b.filePath, b)
      bookKeyMap.set(`${b.title}:::${b.author}`, b)
    })

    const bookIdMapping = new Map<number, number>()

    let bookIdx = 0
    for (const remoteBook of backup.books || []) {
      bookIdx++
      // Restore cover art from zip archive covers folder if missing or empty in JSON
      if ((!remoteBook.coverDataUrl || remoteBook.coverDataUrl.length === 0) && zipInstance) {
        const coverInZip = zipInstance.file(`covers/book_${bookIdx}_cover.jpg`)
        if (coverInZip) {
          try {
            const b64 = await coverInZip.async('base64')
            if (b64) remoteBook.coverDataUrl = `data:image/jpeg;base64,${b64}`
          } catch {}
        }
      }

      const safeTitle = sanitizeString(remoteBook.title, 256) || 'Untitled Book'
      const safeAuthor = sanitizeString(remoteBook.author, 128) || 'Unknown Author'
      const safeFilePath = sanitizeString(remoteBook.filePath, 1024)
      const safeCover = sanitizeCoverDataUrl(remoteBook.coverDataUrl)
      const safeFormat = (['epub', 'pdf', 'mobi', 'txt'] as const).includes(remoteBook.format)
        ? remoteBook.format
        : 'epub'
      const safeProgress = typeof remoteBook.progressPercent === 'number' && Number.isFinite(remoteBook.progressPercent)
        ? Math.max(0, Math.min(100, remoteBook.progressPercent))
        : 0

      const match =
        bookKeyMap.get(safeFilePath) ||
        bookKeyMap.get(`${safeTitle}:::${safeAuthor}`)

      if (match && match.id) {
        if (remoteBook.id) bookIdMapping.set(remoteBook.id, match.id)
        // Update reading progress if remote is further along
        if (safeProgress > (match.progressPercent || 0)) {
          await db.books.update(match.id, {
            progressPercent: safeProgress,
            progressCfi: typeof remoteBook.progressCfi === 'string' ? remoteBook.progressCfi : match.progressCfi,
            currentPage: typeof remoteBook.currentPage === 'number' && Number.isFinite(remoteBook.currentPage) ? remoteBook.currentPage : match.currentPage
          })
        }
      } else {
        const mappedCatId = remoteBook.categoryId
          ? catIdMapping.get(remoteBook.categoryId) || null
          : null

        const newBookId = await db.books.add({
          title: safeTitle,
          author: safeAuthor,
          filePath: safeFilePath,
          format: safeFormat,
          coverDataUrl: safeCover,
          fileSize: typeof remoteBook.fileSize === 'number' && Number.isFinite(remoteBook.fileSize) ? Math.max(0, remoteBook.fileSize) : 0,
          addedAt: typeof remoteBook.addedAt === 'number' && Number.isFinite(remoteBook.addedAt) ? remoteBook.addedAt : Date.now(),
          lastOpenedAt: typeof remoteBook.lastOpenedAt === 'number' && Number.isFinite(remoteBook.lastOpenedAt) ? remoteBook.lastOpenedAt : null,
          progressPercent: safeProgress,
          progressCfi: typeof remoteBook.progressCfi === 'string' ? remoteBook.progressCfi : null,
          currentPage: typeof remoteBook.currentPage === 'number' && Number.isFinite(remoteBook.currentPage) ? Math.max(1, remoteBook.currentPage) : 1,
          totalPages: typeof remoteBook.totalPages === 'number' && Number.isFinite(remoteBook.totalPages) ? Math.max(1, remoteBook.totalPages) : 1,
          categoryId: mappedCatId,
          isFavorite: Boolean(remoteBook.isFavorite),
          isRead: Boolean(remoteBook.isRead),
          isPinned: Boolean(remoteBook.isPinned),
          pinnedAt: typeof remoteBook.pinnedAt === 'number' && Number.isFinite(remoteBook.pinnedAt) ? remoteBook.pinnedAt : null,
          tags: normalizeTags(remoteBook.tags),
          description: sanitizeString(remoteBook.description, 4096) || undefined,
          publisher: sanitizeString(remoteBook.publisher, 256) || undefined,
          publishedDate: sanitizeString(remoteBook.publishedDate, 64) || undefined,
          language: sanitizeString(remoteBook.language, 32) || undefined,
          identifier: sanitizeString(remoteBook.identifier, 128) || undefined,
          series: sanitizeString(remoteBook.series, 256) || undefined,
          seriesIndex: sanitizeString(remoteBook.seriesIndex, 32) || undefined,
          rights: sanitizeString(remoteBook.rights, 512) || undefined,
          subject: sanitizeString(remoteBook.subject, 512) || undefined,
          creatorTool: sanitizeString(remoteBook.creatorTool, 256) || undefined,
          producer: sanitizeString(remoteBook.producer, 256) || undefined,
          formatVersion: sanitizeString(remoteBook.formatVersion, 32) || undefined,
          metadataHydrated: Boolean(remoteBook.metadataHydrated),
          climaxGlowTarget:
            typeof remoteBook.climaxGlowTarget === 'number' &&
            Number.isFinite(remoteBook.climaxGlowTarget) &&
            remoteBook.climaxGlowTarget >= 75 &&
            remoteBook.climaxGlowTarget <= 85
              ? Math.round(remoteBook.climaxGlowTarget)
              : undefined,
          climaxGlowTriggered: Boolean(remoteBook.climaxGlowTriggered)
        })
        if (remoteBook.id) bookIdMapping.set(remoteBook.id, newBookId as number)
        addedBooks++
      }
    }

    // 3. Append Annotations without duplicates (keyed by bookId + cfiRange)
    const annotationKeySet = new Set<string>()
    existingAnnotations.forEach((a) => {
      annotationKeySet.add(`${a.bookId}:::${a.cfiRange}`)
    })

    for (const remoteAnn of backup.annotations || []) {
      const localBookId = bookIdMapping.get(remoteAnn.bookId) || remoteAnn.bookId
      const safeCfiRange = sanitizeString(remoteAnn.cfiRange, 512)
      if (!safeCfiRange) continue
      const key = `${localBookId}:::${safeCfiRange}`
      if (!annotationKeySet.has(key)) {
        await db.annotations.add({
          bookId: localBookId,
          cfiRange: safeCfiRange,
          text: sanitizeString(remoteAnn.text, 2048),
          note: sanitizeString(remoteAnn.note, 4096),
          color: sanitizeNoteColor(remoteAnn.color),
          pageNumber: typeof remoteAnn.pageNumber === 'number' && Number.isFinite(remoteAnn.pageNumber) ? remoteAnn.pageNumber : undefined,
          chapterTitle: remoteAnn.chapterTitle ? sanitizeString(remoteAnn.chapterTitle, 128) : undefined,
          createdAt: typeof remoteAnn.createdAt === 'number' && Number.isFinite(remoteAnn.createdAt) ? remoteAnn.createdAt : Date.now()
        })
        annotationKeySet.add(key)
        addedAnnotations++
      }
    }

    // 4. Append Bookmarks without duplicates
    const bookmarkKeySet = new Set<string>()
    existingBookmarks.forEach((bm) => {
      bookmarkKeySet.add(`${bm.bookId}:::${bm.cfi}`)
    })

    for (const remoteBm of backup.bookmarks || []) {
      const localBookId = bookIdMapping.get(remoteBm.bookId) || remoteBm.bookId
      const safeCfi = sanitizeString(remoteBm.cfi, 512)
      if (!safeCfi) continue
      const key = `${localBookId}:::${safeCfi}`
      if (!bookmarkKeySet.has(key)) {
        await db.bookmarks.add({
          bookId: localBookId,
          cfi: safeCfi,
          label: sanitizeString(remoteBm.label, 128) || 'Bookmark',
          pageNumber: typeof remoteBm.pageNumber === 'number' && Number.isFinite(remoteBm.pageNumber) ? Math.max(1, remoteBm.pageNumber) : 1,
          progressPercent: typeof remoteBm.progressPercent === 'number' && Number.isFinite(remoteBm.progressPercent) ? Math.max(0, Math.min(100, remoteBm.progressPercent)) : undefined,
          chapterTitle: remoteBm.chapterTitle ? sanitizeString(remoteBm.chapterTitle, 128) : undefined,
          createdAt: typeof remoteBm.createdAt === 'number' && Number.isFinite(remoteBm.createdAt) ? remoteBm.createdAt : Date.now()
        })
        bookmarkKeySet.add(key)
        addedBookmarks++
      }
    }

    // 5. Restore persisted user settings if included in the backup
    if (backup.settings) {
      const { id: _ignoredId, ...restoredSettings } = backup.settings
      useAppStore.getState().updateSettings(restoredSettings)
    }

    return { addedBooks, addedAnnotations, addedBookmarks, addedCategories }
  }

  // Trigger file open dialog and run additive import
  public async promptImport(): Promise<{ success: boolean; message: string }> {
    try {
      let jsonContent = ''
      let loadedZip: JSZip | null = null

      if (window.desktopAPI?.showOpenDialog && window.desktopAPI?.readFileText) {
        const chosenPath = await window.desktopAPI.showOpenDialog({
          title: 'Select Semply Reader Backup File',
          filters: [
            { name: 'Backup Files (*.json, *.zip)', extensions: ['json', 'zip'] },
            { name: 'JSON Backup', extensions: ['json'] },
            { name: 'ZIP Archive', extensions: ['zip'] }
          ]
        })

        if (!chosenPath) return { success: false, message: 'Import cancelled' }

        if (chosenPath.endsWith('.zip')) {
          const buffer = await window.desktopAPI.readFileBuffer(chosenPath)
          loadedZip = await JSZip.loadAsync(buffer)
          const metaFile = loadedZip.file('library_metadata.json')
          if (!metaFile) throw new Error('Invalid archive: missing library_metadata.json')
          jsonContent = await metaFile.async('text')
        } else {
          jsonContent = await window.desktopAPI.readFileText(chosenPath)
        }
      } else {
        // Browser file input fallback
        const file = await new Promise<File | null>((resolve) => {
          const input = document.createElement('input')
          input.type = 'file'
          input.accept = '.json,.zip'
          input.onchange = () => resolve(input.files?.[0] || null)
          input.click()
        })

        if (!file) return { success: false, message: 'No file selected' }

        if (file.name.endsWith('.zip')) {
          loadedZip = await JSZip.loadAsync(await file.arrayBuffer())
          const metaFile = loadedZip.file('library_metadata.json')
          if (!metaFile) throw new Error('Invalid archive: missing library_metadata.json')
          jsonContent = await metaFile.async('text')
        } else {
          jsonContent = await file.text()
        }
      }

      const rawParsed: unknown = JSON.parse(jsonContent)
      if (!validateBackupStructure(rawParsed)) {
        return { success: false, message: 'Invalid or corrupted backup file structure.' }
      }
      const parsed: LibraryBackupData = rawParsed
      const res = await this.importAdditiveBackup(parsed, loadedZip)

      return {
        success: true,
        message: `Additive merge complete: Added ${res.addedBooks} new books, ${res.addedAnnotations} notes, ${res.addedBookmarks} bookmarks, and ${res.addedCategories} categories.`
      }
    } catch (e: any) {
      console.error('Import failed:', e)
      return { success: false, message: e?.message || 'Failed to import backup' }
    }
  }
}

export const backupService = new BackupService()
