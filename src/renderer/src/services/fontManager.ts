import { getFontEntry, isBuiltinFont } from '../../../shared/fontCatalog'
import { useAppStore } from '../stores/useAppStore'

const cssCache = new Map<string, string>()

function upsertStyleElement(doc: Document, attrName: string, attrValue: string, css: string): void {
  if (!doc || !doc.head) return
  const existingStyles = Array.from(doc.head.querySelectorAll('style'))
  let styleEl =
    (existingStyles.find((el) => el.getAttribute(attrName) === attrValue) as HTMLStyleElement | undefined) || null
  if (!styleEl) {
    styleEl = doc.createElement('style')
    styleEl.setAttribute(attrName, attrValue)
    doc.head.appendChild(styleEl)
  }
  if (styleEl.textContent !== css) {
    styleEl.textContent = css
  }
}

export async function getCachedFontCss(fontId: string): Promise<string | null> {
  if (isBuiltinFont(fontId)) return null
  if (cssCache.has(fontId)) return cssCache.get(fontId)!

  if (window.desktopAPI?.getFontCss) {
    const css = await window.desktopAPI.getFontCss(fontId)
    if (css) {
      cssCache.set(fontId, css)
      return css
    }
  }
  return null
}

/**
 * Injects a downloaded font's @font-face stylesheet into a target Document
 * (either the main app window or an epub.js rendition iframe).
 */
export async function injectFontIntoDocument(doc: Document | null | undefined, fontId: string): Promise<void> {
  if (!doc || isBuiltinFont(fontId)) return
  const css = await getCachedFontCss(fontId)
  if (!css) return
  upsertStyleElement(doc, 'data-semply-font-id', fontId, css)
}

/**
 * Hydrate downloaded font IDs from Electron userData/fonts on app startup
 * and warm their @font-face rules in the main document so previews render natively.
 */
export async function hydrateDownloadedFonts(): Promise<void> {
  const store = useAppStore.getState()
  try {
    if (window.desktopAPI?.listDownloadedFonts) {
      const ids = await window.desktopAPI.listDownloadedFonts()
      store.setDownloadedFontIds(ids)

      // Inject active font immediately first, then warm remaining downloaded previews
      const activeId = store.settings.fontFamily
      if (activeId && ids.includes(activeId)) {
        await injectFontIntoDocument(document, activeId)
      }
      for (const id of ids) {
        if (id !== activeId) {
          injectFontIntoDocument(document, id).catch(() => {})
        }
      }
    }
    if (window.desktopAPI?.isOnline) {
      const online = await window.desktopAPI.isOnline()
      store.setIsOnline(online && navigator.onLine)
    } else {
      store.setIsOnline(navigator.onLine)
    }
  } catch {
    // Ignore init errors
  }
}

export interface FontSelectResult {
  ok: boolean
  offline?: boolean
  message?: string
}

/**
 * Activates a font if it is built-in or already downloaded offline.
 * If it is a cloud font not yet downloaded:
 *   - Online: downloads & caches .woff2 files to disk, adds to downloaded list, injects CSS, activates.
 *   - Offline: reports offline unavailability and keeps the current available font active.
 */
export async function selectOrDownloadFont(fontId: string): Promise<FontSelectResult> {
  const store = useAppStore.getState()
  const entry = getFontEntry(fontId)

  // 1. Always-available local/builtin font
  if (isBuiltinFont(entry.id)) {
    store.updateSettings({ fontFamily: entry.id })
    return { ok: true }
  }

  // 2. Already downloaded locally on disk -> immediate offline activation
  if (store.downloadedFontIds.includes(entry.id)) {
    await injectFontIntoDocument(document, entry.id)
    store.updateSettings({ fontFamily: entry.id })
    return { ok: true }
  }

  // 3. Needs download -> verify online status first
  const mainOnline = window.desktopAPI?.isOnline ? await window.desktopAPI.isOnline().catch(() => navigator.onLine) : navigator.onLine
  const effectivelyOnline = navigator.onLine && mainOnline
  store.setIsOnline(effectivelyOnline)

  if (!effectivelyOnline) {
    const msg = 'Offline — font not available. Remaining on current font.'
    store.showToast(msg, 'error')
    return { ok: false, offline: true, message: msg }
  }

  if (store.downloadingFontId === entry.id) {
    return { ok: false, message: 'Already downloading...' }
  }

  store.setDownloadingFontId(entry.id)
  try {
    if (window.desktopAPI?.downloadFont) {
      const res = await window.desktopAPI.downloadFont(entry.id)
      if (!res.success) {
        const offline = Boolean(res.offline)
        if (offline) store.setIsOnline(false)
        const msg = offline
          ? 'Offline — font not available. Remaining on current font.'
          : res.error || `Could not download ${entry.name}.`
        store.showToast(msg, 'error')
        return { ok: false, offline, message: msg }
      }

      // Freshly downloaded: add to top of downloaded list, inject CSS, and activate
      cssCache.delete(entry.id)
      store.addDownloadedFontId(entry.id)
      await injectFontIntoDocument(document, entry.id)
      store.updateSettings({ fontFamily: entry.id })
      return { ok: true }
    }

    // Web preview fallback when running without Electron preload
    if (entry.googleFamily) {
      const encoded = encodeURIComponent(entry.googleFamily).replace(/%20/g, '+')
      const linkId = `semply-gfont-${entry.id}`
      if (!document.getElementById(linkId)) {
        const link = document.createElement('link')
        link.id = linkId
        link.rel = 'stylesheet'
        link.href = `https://fonts.googleapis.com/css2?family=${encoded}:wght@400;700&display=swap`
        document.head.appendChild(link)
      }
      store.addDownloadedFontId(entry.id)
      store.updateSettings({ fontFamily: entry.id })
      return { ok: true }
    }

    return { ok: false, message: 'Font unavailable' }
  } catch {
    const offline = !navigator.onLine
    if (offline) store.setIsOnline(false)
    const msg = offline
      ? 'Offline — font not available. Remaining on current font.'
      : `Could not download ${entry.name}.`
    store.showToast(msg, 'error')
    return { ok: false, offline, message: msg }
  } finally {
    useAppStore.getState().setDownloadingFontId(null)
  }
}
