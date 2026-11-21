import { db, type Annotation, type Bookmark as BookmarkItem, type UserSettings } from '../db'
import {
  applyAnnotationToRendition,
  removeAnnotationFromRendition,
  syncBookNotesCount
} from './annotationService'

export type HistoryEntry =
  | { type: 'add_annotation'; annotation: Annotation }
  | { type: 'delete_annotation'; annotation: Annotation }
  | { type: 'add_bookmark'; bookmark: BookmarkItem }
  | { type: 'delete_bookmark'; bookmark: BookmarkItem }

class ReaderHistoryService {
  private undoStack: HistoryEntry[] = []
  private redoStack: HistoryEntry[] = []
  private maxDepth = 40

  public pushAction(entry: HistoryEntry) {
    this.undoStack.push(entry)
    if (this.undoStack.length > this.maxDepth) {
      this.undoStack.shift()
    }
    this.redoStack = []
  }

  public canUndo(): boolean {
    return this.undoStack.length > 0
  }

  public canRedo(): boolean {
    return this.redoStack.length > 0
  }

  public clear() {
    this.undoStack = []
    this.redoStack = []
  }

  public async undo(
    rendition: any,
    theme: UserSettings['theme'],
    onAnnotationClick: (ann: Annotation, ev: MouseEvent) => void
  ): Promise<boolean> {
    const entry = this.undoStack.pop()
    if (!entry) return false

    try {
      if (entry.type === 'add_annotation') {
        const ann = entry.annotation
        if (ann.id) {
          await db.annotations.delete(ann.id)
          if (rendition && ann.cfiRange) {
            try {
              removeAnnotationFromRendition(rendition, ann.cfiRange)
            } catch {
              // Annotation may not be currently rendered in viewport
            }
          }
          await syncBookNotesCount(ann.bookId)
        }
        // Redo will re-add this undone annotation
        this.redoStack.push({ type: 'add_annotation', annotation: ann })
        return true
      }

      if (entry.type === 'delete_annotation') {
        const { id: _oldId, ...rest } = entry.annotation
        const newId = await db.annotations.add(rest)
        const restored: Annotation = { ...rest, id: Number(newId) }
        if (rendition && restored.cfiRange) {
          try {
            applyAnnotationToRendition(rendition, restored, theme, (a, ev) => onAnnotationClick(a, ev))
          } catch {
            // Annotation may be in a different unmounted chapter
          }
        }
        await syncBookNotesCount(restored.bookId)
        // Redo will re-delete this restored annotation
        this.redoStack.push({ type: 'delete_annotation', annotation: restored })
        return true
      }

      if (entry.type === 'add_bookmark') {
        const bm = entry.bookmark
        if (bm.id) {
          await db.bookmarks.delete(bm.id)
        }
        // Redo will re-add this undone bookmark
        this.redoStack.push({ type: 'add_bookmark', bookmark: bm })
        return true
      }

      if (entry.type === 'delete_bookmark') {
        const { id: _oldId, ...rest } = entry.bookmark
        const newId = await db.bookmarks.add(rest)
        const restored: BookmarkItem = { ...rest, id: Number(newId) }
        // Redo will re-delete this restored bookmark
        this.redoStack.push({ type: 'delete_bookmark', bookmark: restored })
        return true
      }
    } catch {
      return false
    }

    return false
  }

  public async redo(
    rendition: any,
    theme: UserSettings['theme'],
    onAnnotationClick: (ann: Annotation, ev: MouseEvent) => void
  ): Promise<boolean> {
    const entry = this.redoStack.pop()
    if (!entry) return false

    try {
      if (entry.type === 'add_annotation') {
        const { id: _oldId, ...rest } = entry.annotation
        const newId = await db.annotations.add(rest)
        const restored: Annotation = { ...rest, id: Number(newId) }
        if (rendition && restored.cfiRange) {
          try {
            applyAnnotationToRendition(rendition, restored, theme, (a, ev) => onAnnotationClick(a, ev))
          } catch {
            // Annotation may be in a different unmounted chapter
          }
        }
        await syncBookNotesCount(restored.bookId)
        this.undoStack.push({ type: 'add_annotation', annotation: restored })
        return true
      }

      if (entry.type === 'delete_annotation') {
        const ann = entry.annotation
        if (ann.id) {
          await db.annotations.delete(ann.id)
          if (rendition && ann.cfiRange) {
            try {
              removeAnnotationFromRendition(rendition, ann.cfiRange)
            } catch {
              // Annotation may not be currently rendered in viewport
            }
          }
          await syncBookNotesCount(ann.bookId)
        }
        this.undoStack.push({ type: 'delete_annotation', annotation: ann })
        return true
      }

      if (entry.type === 'add_bookmark') {
        const { id: _oldId, ...rest } = entry.bookmark
        const newId = await db.bookmarks.add(rest)
        const restored: BookmarkItem = { ...rest, id: Number(newId) }
        this.undoStack.push({ type: 'add_bookmark', bookmark: restored })
        return true
      }

      if (entry.type === 'delete_bookmark') {
        const bm = entry.bookmark
        if (bm.id) {
          await db.bookmarks.delete(bm.id)
        }
        this.undoStack.push({ type: 'delete_bookmark', bookmark: bm })
        return true
      }
    } catch {
      return false
    }

    return false
  }
}

export const readerHistoryService = new ReaderHistoryService()
