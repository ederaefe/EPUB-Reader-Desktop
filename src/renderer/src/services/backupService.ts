// Additive Universal Library Backup & Sync Engine
// Implements non-destructive JSON & ZIP export and additive upsert merge

import JSZip from 'jszip'
import { db, type Book, type Category, type Annotation, type Bookmark, type UserSettings, type NoteColor, type IceRangeAnchor } from '../db'
import { useAppStore } from '../stores/useAppStore'
import { normalizeTags } from '../../../shared/bookMetadata'
import { FONT_CATALOG } from '../../../shared/fontCatalog'

const VALID_FONT_IDS = new Set(FONT_CATALOG.map((f) => f.id))
const MAX_BACKUP_JSON_BYTES = 100 * 1024 * 1024 // 100 MB JSON payload ceiling (matches main fs:readFileText)
const MAX_BACKUP_COVER_BYTES = 5 * 1024 * 1024 // 5 MB per cover image ceiling
const MAX_BACKUP_TOTAL_COVER_BYTES = 150 * 1024 * 1024 // 150 MB cumulative cover decompression budget
const MAX_BACKUP_ZIP_ENTRIES = 5000 // Guard against Zip Bomb entry floods
const MAX_BACKUP_BOOKS = 10000
const MAX_BACKUP_ANNOTATIONS = 50000
const MAX_BACKUP_BOOKMARKS = 50000

async function readZipEntryBounded(entry: JSZip.JSZipObject, maxBytes: number): Promise<Uint8Array> {
  const declared = (entry as any)?._data?.uncompressedSize
  if (typeof declared === 'number' && declared > maxBytes) {
    throw new Error('Archive entry exceeds safe decompressed size limit')
  }
  return await new Promise<Uint8Array>((resolve, reject) => {
    const chunks: Uint8Array[] = []
    let total = 0
    let aborted = false
    const stream = (entry as any).internalStream('uint8array')
    stream
      .on('data', (chunk: Uint8Array) => {
        if (aborted) return
        total += chunk.byteLength
        if (total > maxBytes) {
          aborted = true
          try {
            stream.pause()
          } catch {}
          reject(new Error('Archive entry exceeds safe decompressed size limit'))
          return
        }
        chunks.push(chunk)
      })
      .on('error', (err: unknown) => {
        if (!aborted) reject(err)
      })
      .on('end', () => {
        if (aborted) return
        const out = new Uint8Array(total)
        let offset = 0
        for (const c of chunks) {
          out.set(c, offset)
          offset += c.byteLength
        }
        resolve(out)
      })
      .resume()
  })
}

function uint8ToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000
  const chunks: string[] = []
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, i + chunkSize)
    chunks.push(String.fromCharCode.apply(null, Array.from(slice)))
  }
  return window.btoa(chunks.join(''))
}

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
  if (trimmed.length > MAX_BACKUP_COVER_BYTES * 1.4) return null
  if (/^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/.test(trimmed)) {
    return trimmed
  }
  return null
}

function sanitizeBookFilePath(raw: any): string {
  const s = sanitizeString(raw, 1024).replace(/[\0\x01-\x1F\x7F]/g, '')
  if (!s) return ''
  // Reject UNC/device paths (including mixed slashes /\ and \/) and external/executable URI schemes
  if (/^[\\/]{2}/.test(s) || /^(https?|file|javascript|vbscript|data):/i.test(s)) {
    return ''
  }
  return s
}

function clampFinite(val: unknown, min: number, max: number): number | undefined {
  if (typeof val !== 'number' || !Number.isFinite(val)) return undefined
  return Math.max(min, Math.min(max, val))
}

export function sanitizeSettings(raw: unknown): Partial<UserSettings> {
  if (!isPlainObject(raw) || hasPrototypePollutionKey(raw)) return {}
  const out: Partial<UserSettings> = {}

  if (raw.theme === 'night' || raw.theme === 'day' || raw.theme === 'light-sepia' || raw.theme === 'dark-sepia') {
    out.theme = raw.theme
  }
  if (typeof raw.fontFamily === 'string' && VALID_FONT_IDS.has(raw.fontFamily)) {
    out.fontFamily = raw.fontFamily
  }
  const fontSize = clampFinite(raw.fontSize, 12, 42)
  if (fontSize !== undefined) out.fontSize = Math.round(fontSize)
  const fontWeight = clampFinite(raw.fontWeight, 300, 700)
  if (fontWeight !== undefined) out.fontWeight = Math.round(fontWeight / 100) * 100
  const lineHeight = clampFinite(raw.lineHeight, 1.0, 2.5)
  if (lineHeight !== undefined) out.lineHeight = Number(lineHeight.toFixed(2))
  const marginWidth = clampFinite(raw.marginWidth, 0, 160)
  if (marginWidth !== undefined) out.marginWidth = Math.round(marginWidth)
  const dimming = clampFinite(raw.dimming, 0, 80)
  if (dimming !== undefined) out.dimming = Math.round(dimming)
  if (raw.pageLayout === 'single' || raw.pageLayout === 'dual') {
    out.pageLayout = raw.pageLayout
    out.pageSpread = raw.pageLayout === 'dual' ? 'double' : 'single'
  } else if (raw.pageSpread === 'single' || raw.pageSpread === 'double') {
    out.pageSpread = raw.pageSpread
    out.pageLayout = raw.pageSpread === 'double' ? 'dual' : 'single'
  }
  const ttsSpeed = clampFinite(raw.ttsSpeed, 0.5, 2.5)
  if (ttsSpeed !== undefined) out.ttsSpeed = Number(ttsSpeed.toFixed(2))
  const ttsPitch = clampFinite(raw.ttsPitch, 0.5, 2.0)
  if (ttsPitch !== undefined) out.ttsPitch = Number(ttsPitch.toFixed(2))
  if (raw.ttsVoice === null || typeof raw.ttsVoice === 'string') {
    out.ttsVoice = raw.ttsVoice === null ? null : sanitizeString(raw.ttsVoice, 128) || null
  }
  const autoscrollSpeed = clampFinite(raw.autoscrollSpeed, 5, 200)
  if (autoscrollSpeed !== undefined) out.autoscrollSpeed = Math.round(autoscrollSpeed)
  if (raw.autoscrollMode === 'adaptive' || raw.autoscrollMode === 'countdown') {
    out.autoscrollMode = raw.autoscrollMode
  }
  const autoscrollCountdownSec = clampFinite(raw.autoscrollCountdownSec, 2, 600)
  if (autoscrollCountdownSec !== undefined) out.autoscrollCountdownSec = Math.round(autoscrollCountdownSec)
  const autoscrollAdaptiveSec = clampFinite(raw.autoscrollAdaptiveSec, 3, 600)
  if (autoscrollAdaptiveSec !== undefined) out.autoscrollAdaptiveSec = Math.round(autoscrollAdaptiveSec)
  if (typeof raw.autoscrollMicroPause === 'boolean') out.autoscrollMicroPause = raw.autoscrollMicroPause
  if (typeof raw.autoscrollAdaptive === 'boolean') out.autoscrollAdaptive = raw.autoscrollAdaptive
  const targetWpm = clampFinite(raw.targetWpm, 80, 1000)
  if (targetWpm !== undefined) out.targetWpm = Math.round(targetWpm)
  const observedWpm = clampFinite(raw.observedWpm, 80, 1000)
  if (observedWpm !== undefined) out.observedWpm = Math.round(observedWpm)
  if (typeof raw.warmFilterEnabled === 'boolean') out.warmFilterEnabled = raw.warmFilterEnabled
  const warmFilterTemp = clampFinite(raw.warmFilterTemp, 1500, 6500)
  if (warmFilterTemp !== undefined) out.warmFilterTemp = Math.round(warmFilterTemp)
  const warmFilterIntensity = clampFinite(raw.warmFilterIntensity, 0, 100)
  if (warmFilterIntensity !== undefined) out.warmFilterIntensity = Math.round(warmFilterIntensity)
  const rsvpWpm = clampFinite(raw.rsvpWpm, 100, 1200)
  if (rsvpWpm !== undefined) out.rsvpWpm = Math.round(rsvpWpm)
  if (typeof raw.copyExternal === 'boolean') out.copyExternal = raw.copyExternal
  if (typeof raw.autoUpdate === 'boolean') out.autoUpdate = raw.autoUpdate
  if (typeof raw.sendStats === 'boolean') out.sendStats = raw.sendStats
  if (raw.viewMode === 'grid' || raw.viewMode === 'list') out.viewMode = raw.viewMode
  if (['blue', 'purple', 'red', 'yellow', 'green', 'underline'].includes(raw.lastNoteColor)) {
    out.lastNoteColor = raw.lastNoteColor as NoteColor
  }
  const pdfZoom = clampFinite(raw.pdfZoom, 0.5, 3.0)
  if (pdfZoom !== undefined) out.pdfZoom = Number(pdfZoom.toFixed(2))
  if (raw.scrollMode === 'horizontal' || raw.scrollMode === 'vertical') {
    out.scrollMode = raw.scrollMode
  }

  return out
}

function sanitizeIceRange(raw: any): IceRangeAnchor | undefined {
  if (!isPlainObject(raw) || hasPrototypePollutionKey(raw)) return undefined
  if (typeof raw.startXPath !== 'string' || typeof raw.endXPath !== 'string') return undefined
  return {
    startXPath: sanitizeString(raw.startXPath, 256),
    startOffset:
      typeof raw.startOffset === 'number' && Number.isFinite(raw.startOffset)
        ? Math.max(0, raw.startOffset)
        : 0,
    endXPath: sanitizeString(raw.endXPath, 256),
    endOffset:
      typeof raw.endOffset === 'number' && Number.isFinite(raw.endOffset)
        ? Math.max(0, raw.endOffset)
        : 0,
    href: raw.href ? sanitizeString(raw.href, 256) : undefined
  }
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
    let cumulativeCoverBytes = 0
    for (const remoteBook of (backup.books || []).slice(0, MAX_BACKUP_BOOKS)) {
      bookIdx++
      // Restore cover art from zip archive covers folder if missing or empty in JSON
      if ((!remoteBook.coverDataUrl || remoteBook.coverDataUrl.length === 0) && zipInstance) {
        const coverInZip = zipInstance.file(`covers/book_${bookIdx}_cover.jpg`)
        if (coverInZip && cumulativeCoverBytes < MAX_BACKUP_TOTAL_COVER_BYTES) {
          try {
            const remaining = Math.min(MAX_BACKUP_COVER_BYTES, MAX_BACKUP_TOTAL_COVER_BYTES - cumulativeCoverBytes)
            const bytes = await readZipEntryBounded(coverInZip, remaining)
            if (bytes.byteLength >= 64) {
              cumulativeCoverBytes += bytes.byteLength
              remoteBook.coverDataUrl = `data:image/jpeg;base64,${uint8ToBase64(bytes)}`
            }
          } catch {}
        }
      }

      const safeTitle = sanitizeString(remoteBook.title, 256) || 'Untitled Book'
      const safeAuthor = sanitizeString(remoteBook.author, 128) || 'Unknown Author'
      const safeFilePath = sanitizeBookFilePath(remoteBook.filePath)
      if (!safeFilePath) continue
      const safeCover = sanitizeCoverDataUrl(remoteBook.coverDataUrl)
      const safeProgressCfi =
        typeof remoteBook.progressCfi === 'string' ? sanitizeString(remoteBook.progressCfi, 512) || null : null
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
            progressCfi: safeProgressCfi ?? match.progressCfi,
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
          progressCfi: safeProgressCfi,
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
    const affectedBookIds = new Set<number>()

    for (const remoteAnn of (backup.annotations || []).slice(0, MAX_BACKUP_ANNOTATIONS)) {
      const localBookId = bookIdMapping.get(remoteAnn.bookId)
      if (!localBookId) {
        // Drop orphaned annotation referencing an omitted or unmapped book to prevent cross-book contamination
        continue
      }
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
          href: remoteAnn.href ? sanitizeString(remoteAnn.href, 256) : undefined,
          iceRange: sanitizeIceRange(remoteAnn.iceRange),
          createdAt: typeof remoteAnn.createdAt === 'number' && Number.isFinite(remoteAnn.createdAt) ? remoteAnn.createdAt : Date.now(),
          updatedAt: typeof remoteAnn.updatedAt === 'number' && Number.isFinite(remoteAnn.updatedAt) ? remoteAnn.updatedAt : undefined
        })
        annotationKeySet.add(key)
        affectedBookIds.add(localBookId)
        addedAnnotations++
      }
    }

    // 4. Append Bookmarks without duplicates
    const bookmarkKeySet = new Set<string>()
    existingBookmarks.forEach((bm) => {
      bookmarkKeySet.add(`${bm.bookId}:::${bm.cfi}`)
    })

    for (const remoteBm of (backup.bookmarks || []).slice(0, MAX_BACKUP_BOOKMARKS)) {
      const localBookId = bookIdMapping.get(remoteBm.bookId)
      if (!localBookId) {
        // Drop orphaned bookmark referencing an omitted or unmapped book to prevent cross-book contamination
        continue
      }
      const safeCfi = sanitizeString(remoteBm.cfi, 512)
      if (!safeCfi) continue
      const key = `${localBookId}:::${safeCfi}`
      if (!bookmarkKeySet.has(key)) {
        await db.bookmarks.add({
          bookId: localBookId,
          cfi: safeCfi,
          label: sanitizeString(remoteBm.label, 128) || 'Bookmark',
          excerpt: remoteBm.excerpt ? sanitizeString(remoteBm.excerpt, 512) : undefined,
          href: remoteBm.href ? sanitizeString(remoteBm.href, 256) : undefined,
          xpath: remoteBm.xpath ? sanitizeString(remoteBm.xpath, 256) : undefined,
          pageNumber: typeof remoteBm.pageNumber === 'number' && Number.isFinite(remoteBm.pageNumber) ? Math.max(1, remoteBm.pageNumber) : 1,
          progressPercent: typeof remoteBm.progressPercent === 'number' && Number.isFinite(remoteBm.progressPercent) ? Math.max(0, Math.min(100, remoteBm.progressPercent)) : undefined,
          chapterTitle: remoteBm.chapterTitle ? sanitizeString(remoteBm.chapterTitle, 128) : undefined,
          createdAt: typeof remoteBm.createdAt === 'number' && Number.isFinite(remoteBm.createdAt) ? remoteBm.createdAt : Date.now()
        })
        bookmarkKeySet.add(key)
        addedBookmarks++
      }
    }

    // 5. Synchronize notesCount on all affected books in Dexie
    for (const bookId of affectedBookIds) {
      const count = await db.annotations.where('bookId').equals(bookId).count()
      await db.books.update(bookId, { notesCount: count })
    }

    // 6. Restore validated, bounds-clamped user settings if included in the backup
    if (backup.settings) {
      const safeSettings = sanitizeSettings(backup.settings)
      if (Object.keys(safeSettings).length > 0) {
        useAppStore.getState().updateSettings(safeSettings)
      }
    }

    if (addedAnnotations > 0) {
      useAppStore.getState().bumpAnnotationsVersion()
    }
    if (addedBookmarks > 0) {
      useAppStore.getState().bumpBookmarksVersion()
    }
    if (addedBooks > 0 || affectedBookIds.size > 0 || addedCategories > 0) {
      useAppStore.getState().bumpLibraryVersion()
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

        if (chosenPath.toLowerCase().endsWith('.zip')) {
          const buffer = await window.desktopAPI.readFileBuffer(chosenPath)
          loadedZip = await JSZip.loadAsync(buffer)
          if (Object.keys(loadedZip.files).length > MAX_BACKUP_ZIP_ENTRIES) {
            throw new Error('Invalid archive: exceeds maximum safe entry count')
          }
          const metaFile = loadedZip.file('library_metadata.json')
          if (!metaFile) throw new Error('Invalid archive: missing library_metadata.json')
          const metaBytes = await readZipEntryBounded(metaFile, MAX_BACKUP_JSON_BYTES)
          jsonContent = new TextDecoder('utf-8').decode(metaBytes)
        } else {
          jsonContent = await window.desktopAPI.readFileText(chosenPath)
          if (jsonContent.length > MAX_BACKUP_JSON_BYTES) {
            throw new Error('Backup JSON exceeds 100 MB safety limit')
          }
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

        if (file.name.toLowerCase().endsWith('.zip')) {
          loadedZip = await JSZip.loadAsync(await file.arrayBuffer())
          if (Object.keys(loadedZip.files).length > MAX_BACKUP_ZIP_ENTRIES) {
            throw new Error('Invalid archive: exceeds maximum safe entry count')
          }
          const metaFile = loadedZip.file('library_metadata.json')
          if (!metaFile) throw new Error('Invalid archive: missing library_metadata.json')
          const metaBytes = await readZipEntryBounded(metaFile, MAX_BACKUP_JSON_BYTES)
          jsonContent = new TextDecoder('utf-8').decode(metaBytes)
        } else {
          if (file.size > MAX_BACKUP_JSON_BYTES) {
            throw new Error('Backup JSON exceeds 100 MB safety limit')
          }
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
