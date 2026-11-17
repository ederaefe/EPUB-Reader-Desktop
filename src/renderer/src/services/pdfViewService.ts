import { db, type Book } from '../db'
import { useAppStore } from '../stores/useAppStore'

/**
 * Resolves the cached reflow EPUB buffer for a PDF book (converting once into
 * persistent `<userData>/reflow_cache` if not already cached).
 */
export async function loadCachedReflowEpub(
  pdfPath: string,
  showProgressOverlay = true
): Promise<ArrayBuffer | null> {
  if (!window.desktopAPI?.convertToEpub || !window.desktopAPI?.readFileBuffer) {
    return null
  }
  const store = useAppStore.getState()
  if (showProgressOverlay) {
    store.setPdfConversionState(true, { percent: 8, stage: 'Preparing EPUB view...' })
  }
  try {
    const res = await window.desktopAPI.convertToEpub({
      pdfPath,
      mode: 'reflow-cache'
    })
    if (res.success && res.epubPath) {
      return await window.desktopAPI.readFileBuffer(res.epubPath)
    }
    if (showProgressOverlay) {
      store.showToast(res.error || 'Could not convert PDF to EPUB view.', 'error')
    }
    return null
  } catch (err: any) {
    if (showProgressOverlay) {
      store.showToast(err?.message || 'Could not convert PDF to EPUB view.', 'error')
    }
    return null
  } finally {
    if (showProgressOverlay) {
      store.setPdfConversionState(false, null)
    }
  }
}

/**
 * Switches the active PDF book cleanly between original PDF layout and persistent
 * cached reflowable EPUB, preserving proportional reading distance in both directions.
 * No-ops safely if already in the requested mode.
 */
export async function switchActivePdfViewMode(targetMode: 'original' | 'reflow'): Promise<void> {
  const store = useAppStore.getState()
  const book = store.activeBook
  if (!book || book.format !== 'pdf') return
  if (store.pdfViewMode === targetMode) return
  if (store.isConvertingPdf) return

  // Compute current proportional reading progress (0..100) before switching
  const currentPercent =
    typeof book.progressPercent === 'number' && Number.isFinite(book.progressPercent)
      ? Math.max(0, Math.min(100, book.progressPercent))
      : book.totalPages > 1
      ? Math.max(0, Math.min(100, ((Math.max(1, book.currentPage || 1) - 1) / (book.totalPages - 1)) * 100))
      : 0

  if (targetMode === 'original') {
    const pdfTotal = Math.max(1, book.pdfOriginalTotalPages || book.totalPages || 1)
    const targetPage =
      currentPercent >= 99.5
        ? pdfTotal
        : Math.max(1, Math.min(pdfTotal, Math.round((currentPercent / 100) * (pdfTotal - 1)) + 1))

    const patch: Partial<Book> = {
      preferredPdfMode: 'original',
      currentPage: targetPage,
      totalPages: pdfTotal,
      progressPercent: Math.round(currentPercent)
    }
    if (book.id) {
      await db.books.update(book.id, patch)
    }
    store.updateActiveBook(patch)
    store.setPendingSeekPercent(null)
    store.setPdfViewMode('original')
    return
  }

  // targetMode === 'reflow' (PDF -> cached EPUB)
  const pdfTotal = Math.max(1, book.pdfOriginalTotalPages || book.totalPages || 1)
  let epubBuf = store.reflowEpubBuffer
  if (!epubBuf) {
    epubBuf = await loadCachedReflowEpub(book.filePath, true)
    if (!epubBuf) return
    store.setReflowEpubBuffer(epubBuf)
  }

  const patch: Partial<Book> = {
    preferredPdfMode: 'reflow',
    pdfOriginalTotalPages: pdfTotal,
    progressPercent: Math.round(currentPercent)
  }
  if (book.id) {
    await db.books.update(book.id, patch)
  }
  store.updateActiveBook(patch)
  // Carry exact proportional percentage into EpubReaderView when beyond start
  store.setPendingSeekPercent(currentPercent > 0.5 ? currentPercent : null)
  store.setPdfViewMode('reflow')
}
