// Additive Universal Library Backup & Sync Engine
// Implements non-destructive JSON & ZIP export and additive upsert merge

import JSZip from 'jszip'
import { db, type Book, type Category, type Annotation, type Bookmark, type UserSettings } from '../db'

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
  public async exportToJson(): Promise<{ success: boolean; filePath?: string }> {
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

        if (targetPath) {
          await window.desktopAPI.writeFileText(targetPath, jsonStr)
          return { success: true, filePath: targetPath }
        }
      }

      // Browser fallback
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
  public async exportToZip(): Promise<{ success: boolean; filePath?: string }> {
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

        if (targetPath) {
          await window.desktopAPI.writeFileBuffer(targetPath, content)
          return { success: true, filePath: targetPath }
        }
      }

      // Browser fallback
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
      const key = remoteCat.name.toLowerCase()
      if (categoryNameMap.has(key)) {
        if (remoteCat.id) catIdMapping.set(remoteCat.id, categoryNameMap.get(key)!)
      } else {
        const newId = await db.categories.add({
          name: remoteCat.name,
          color: remoteCat.color || '#2a69df',
          createdAt: remoteCat.createdAt || Date.now()
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

      const match =
        bookKeyMap.get(remoteBook.filePath) ||
        bookKeyMap.get(`${remoteBook.title}:::${remoteBook.author}`)

      if (match && match.id) {
        if (remoteBook.id) bookIdMapping.set(remoteBook.id, match.id)
        // Update reading progress if remote is further along
        if ((remoteBook.progressPercent || 0) > (match.progressPercent || 0)) {
          await db.books.update(match.id, {
            progressPercent: remoteBook.progressPercent,
            progressCfi: remoteBook.progressCfi || match.progressCfi,
            currentPage: remoteBook.currentPage || match.currentPage
          })
        }
      } else {
        const mappedCatId = remoteBook.categoryId
          ? catIdMapping.get(remoteBook.categoryId) || null
          : null

        const { id, ...bookData } = remoteBook
        const newBookId = await db.books.add({
          ...bookData,
          categoryId: mappedCatId,
          addedAt: bookData.addedAt || Date.now()
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
      const key = `${localBookId}:::${remoteAnn.cfiRange}`
      if (!annotationKeySet.has(key)) {
        const { id, ...annData } = remoteAnn
        await db.annotations.add({
          ...annData,
          bookId: localBookId
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
      const key = `${localBookId}:::${remoteBm.cfi}`
      if (!bookmarkKeySet.has(key)) {
        const { id, ...bmData } = remoteBm
        await db.bookmarks.add({
          ...bmData,
          bookId: localBookId
        })
        bookmarkKeySet.add(key)
        addedBookmarks++
      }
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

      const parsed: LibraryBackupData = JSON.parse(jsonContent)
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
