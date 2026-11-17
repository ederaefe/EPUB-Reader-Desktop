import { app, net } from 'electron'
import { join, basename } from 'path'
import { mkdir, readdir, readFile, rm, stat, writeFile, rename, unlink } from 'fs/promises'
import { existsSync } from 'fs'
import { createHash, randomBytes } from 'crypto'
import { getFontEntry, isBuiltinFont } from '../shared/fontCatalog'
import { isStrictOfflineMode } from './securityBoundaryService'
import { mainEgressFetch } from './networkService'

const MAX_FONT_FACE_SIZE = 10 * 1024 * 1024 // 10 MB per font face file
const SAFE_CACHED_FILENAME_RE = /^[a-f0-9]{12}\.(woff2|woff|ttf|otf)$/i

function isSafeCachedFileName(fileName: unknown): fileName is string {
  return typeof fileName === 'string' && basename(fileName) === fileName && SAFE_CACHED_FILENAME_RE.test(fileName)
}

function sanitizeFontFamilyCss(raw: string): string {
  return raw.replace(/['"\\;\r\n{}()]/g, '').trim().slice(0, 80) || 'serif'
}

function sanitizeFontStyleCss(raw: unknown): string {
  if (typeof raw !== 'string') return 'normal'
  const lower = raw.trim().toLowerCase()
  return lower === 'normal' || lower === 'italic' || lower === 'oblique' ? lower : 'normal'
}

function sanitizeFontWeightCss(raw: unknown): string {
  if (typeof raw !== 'string') return '400'
  const cleaned = raw.trim().replace(/\s+/g, ' ')
  return /^\d{3}(?:\s\d{3})?$/.test(cleaned) ? cleaned : '400'
}

function sanitizeUnicodeRangeCss(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined
  const cleaned = raw.trim()
  if (!cleaned || cleaned.length > 512) return undefined
  return /^[U+0-9A-Fa-f,\s?-]+$/.test(cleaned) ? cleaned : undefined
}

async function writeAtomic(targetPath: string, data: string | Buffer): Promise<void> {
  const tempPath = `${targetPath}.${randomBytes(6).toString('hex')}.tmp`
  const retryable = new Set(['EPERM', 'EBUSY', 'EACCES'])
  try {
    await writeFile(tempPath, data, { flag: 'wx' })
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        await rename(tempPath, targetPath)
        return
      } catch (err: any) {
        if (process.platform !== 'win32' || !retryable.has(err?.code) || attempt === 4) {
          throw err
        }
        await new Promise((res) => setTimeout(res, 25 * (attempt + 1)))
      }
    }
  } catch (err) {
    await unlink(tempPath).catch(() => {})
    throw err
  }
}

interface CachedFace {
  fontFamily: string
  fontStyle: string
  fontWeight: string
  unicodeRange?: string
  fileName: string
}

interface FontCacheMeta {
  id: string
  name: string
  downloadedAt: number
  faces: CachedFace[]
}

const MODERN_CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

function getFontsRootDir(): string {
  return join(app.getPath('userData'), 'fonts')
}

function getFontDir(fontId: string): string {
  if (typeof fontId !== 'string') {
    throw new Error('Invalid font ID')
  }
  const safeId = fontId.replace(/[^a-z0-9_-]/gi, '')
  if (!safeId || safeId !== fontId) {
    throw new Error('Invalid font ID')
  }
  return join(getFontsRootDir(), safeId)
}

export function checkIsOnline(): boolean {
  if (isStrictOfflineMode()) return false
  try {
    return net.isOnline()
  } catch {
    return true
  }
}

/**
 * Scan userData/fonts for validly downloaded font directories.
 */
export async function listDownloadedFontIds(): Promise<string[]> {
  const root = getFontsRootDir()
  if (!existsSync(root)) return []

  try {
    const entries = await readdir(root, { withFileTypes: true })
    const validIds: string[] = []
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const metaPath = join(root, entry.name, 'meta.json')
      if (!existsSync(metaPath)) continue
      try {
        const raw = await readFile(metaPath, 'utf-8')
        const meta = JSON.parse(raw) as FontCacheMeta
        if (
          meta &&
          typeof meta.id === 'string' &&
          meta.id === entry.name &&
          getFontEntry(meta.id).id === meta.id &&
          Array.isArray(meta.faces) &&
          meta.faces.length > 0 &&
          meta.faces.every((f) => isSafeCachedFileName(f?.fileName) && existsSync(join(root, entry.name, f.fileName)))
        ) {
          validIds.push(meta.id)
        }
      } catch {
        // Ignore corrupted cache directory
      }
    }
    return validIds
  } catch {
    return []
  }
}

const ALLOWED_FONT_EXTS = new Set(['woff2', 'woff', 'ttf', 'otf'])

function assertGoogleFontUrl(url: string): void {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:') {
      throw new Error(`Insecure protocol: ${parsed.protocol}`)
    }
    const hostname = parsed.hostname.toLowerCase()
    const isGoogle =
      hostname === 'fonts.gstatic.com' ||
      hostname === 'fonts.googleapis.com' ||
      hostname.endsWith('.fonts.gstatic.com') ||
      hostname.endsWith('.fonts.googleapis.com')
    if (!isGoogle) {
      throw new Error(`Untrusted font host: ${hostname}`)
    }
  } catch (e: any) {
    throw new Error(`Invalid or disallowed font URL: ${e?.message}`)
  }
}

function resolveSafeFontExtension(url: string): string {
  try {
    const pathname = new URL(url).pathname
    const match = pathname.match(/\.(woff2|woff|ttf|otf)$/i)
    if (match && ALLOWED_FONT_EXTS.has(match[1].toLowerCase())) {
      return match[1].toLowerCase()
    }
  } catch {}
  return 'woff2'
}

async function fetchWithTimeout(url: string, timeoutMs = 10000): Promise<Response> {
  if (!url || typeof url !== 'string' || !url.startsWith('https://')) {
    throw new Error(`Security violation: font requests must use HTTPS: ${url}`)
  }
  assertGoogleFontUrl(url)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const resp = await mainEgressFetch(url, {
      headers: {
        'User-Agent': MODERN_CHROME_UA,
        Accept: 'text/css,*/*;q=0.1'
      },
      signal: controller.signal
    })
    // Ensure final redirected URL is still on an authorized HTTPS Google origin
    if (resp.url) {
      assertGoogleFontUrl(resp.url)
    }
    return resp
  } finally {
    clearTimeout(timer)
  }
}

async function fetchGoogleFontsCss(googleFamily: string, hasItalic?: boolean): Promise<string> {
  const encoded = encodeURIComponent(googleFamily).replace(/%20/g, '+')
  const candidateUrls: string[] = []
  if (hasItalic !== false) {
    candidateUrls.push(
      `https://fonts.googleapis.com/css2?family=${encoded}:ital,wght@0,400;0,700;1,400;1,700&display=swap`
    )
  }
  candidateUrls.push(
    `https://fonts.googleapis.com/css2?family=${encoded}:wght@400;700&display=swap`,
    `https://fonts.googleapis.com/css2?family=${encoded}&display=swap`
  )

  let lastError: Error | null = null
  for (const url of candidateUrls) {
    try {
      const resp = await fetchWithTimeout(url, 10000)
      if (resp.ok) {
        const css = await resp.text()
        if (css.includes('@font-face')) return css
      } else if (resp.status >= 500) {
        lastError = new Error(`Font server returned HTTP ${resp.status}`)
      }
    } catch (err: any) {
      lastError = err instanceof Error ? err : new Error(String(err))
      // Network error / abort — no need to retry alternate axis URLs if offline
      if (!checkIsOnline()) break
    }
  }

  throw lastError || new Error(`Could not fetch stylesheet for ${googleFamily}`)
}

interface ParsedFace {
  fontFamily: string
  fontStyle: string
  fontWeight: string
  unicodeRange?: string
  url: string
}

function parseFontFaces(css: string, fallbackName: string): ParsedFace[] {
  const faces: ParsedFace[] = []
  const blockRegex = /@font-face\s*\{([^}]+)\}/g
  let match: RegExpExecArray | null

  while ((match = blockRegex.exec(css)) !== null) {
    const body = match[1]
    const urlMatch = body.match(/url\((['"]?)(https?:\/\/[^)'"]+)\1\)/i)
    if (!urlMatch) continue

    const familyMatch = body.match(/font-family:\s*(['"]?)([^;'"]+)\1/i)
    const styleMatch = body.match(/font-style:\s*([^;]+)/i)
    const weightMatch = body.match(/font-weight:\s*([^;]+)/i)
    const rangeMatch = body.match(/unicode-range:\s*([^;]+)/i)

    faces.push({
      fontFamily: familyMatch ? familyMatch[2].trim() : fallbackName,
      fontStyle: styleMatch ? styleMatch[1].trim() : 'normal',
      fontWeight: weightMatch ? weightMatch[1].trim() : '400',
      unicodeRange: rangeMatch ? rangeMatch[1].trim() : undefined,
      url: urlMatch[2].trim()
    })
  }

  return faces
}

/**
 * Download a Google Font's woff2 weights to userData/fonts/<fontId>/ for permanent offline use.
 */
export async function downloadFont(fontId: string): Promise<{
  success: boolean
  offline?: boolean
  alreadyAvailable?: boolean
  error?: string
}> {
  if (typeof fontId !== 'string' || !fontId.trim()) {
    return { success: false, error: 'Unknown font' }
  }
  if (isBuiltinFont(fontId)) {
    return { success: true, alreadyAvailable: true }
  }

  const entry = getFontEntry(fontId)
  if (!entry || entry.id !== fontId || !entry.googleFamily) {
    return { success: false, error: 'Unknown font' }
  }

  const fontDir = getFontDir(entry.id)
  const metaPath = join(fontDir, 'meta.json')

  // Check if already cached and intact
  if (existsSync(metaPath)) {
    try {
      const existing = JSON.parse(await readFile(metaPath, 'utf-8')) as FontCacheMeta
      if (
        existing.faces?.length > 0 &&
        existing.faces.every((f) => isSafeCachedFileName(f?.fileName) && existsSync(join(fontDir, f.fileName)))
      ) {
        return { success: true, alreadyAvailable: true }
      }
    } catch {
      // Proceed to re-download
    }
  }

  if (!checkIsOnline()) {
    return {
      success: false,
      offline: true,
      error: 'Offline — fonts not available for download.'
    }
  }

  try {
    const css = await fetchGoogleFontsCss(entry.googleFamily, entry.hasItalic)
    const parsedFaces = parseFontFaces(css, entry.googleFamily)
    if (parsedFaces.length === 0) {
      return { success: false, error: 'No font files found for this typeface.' }
    }

    await mkdir(fontDir, { recursive: true })

    // Deduplicate identical woff2 URLs across faces
    const downloadedFiles = new Map<string, string>()
    const cachedFaces: CachedFace[] = []

    for (const face of parsedFaces) {
      assertGoogleFontUrl(face.url)
      let fileName = downloadedFiles.get(face.url)
      if (!fileName) {
        const resp = await fetchWithTimeout(face.url, 15000)
        if (!resp.ok) {
          throw new Error(`Failed to download font asset (${resp.status})`)
        }
        const arrayBuf = await resp.arrayBuffer()
        if (arrayBuf.byteLength > MAX_FONT_FACE_SIZE) {
          throw new Error('Font file exceeds maximum allowable size (10MB)')
        }
        const buf = Buffer.from(arrayBuf)
        const hash = createHash('sha1').update(face.url).digest('hex').slice(0, 12)
        const ext = resolveSafeFontExtension(face.url)
        fileName = `${hash}.${ext}`
        await writeAtomic(join(fontDir, fileName), buf)
        downloadedFiles.set(face.url, fileName)
      }

      cachedFaces.push({
        fontFamily: sanitizeFontFamilyCss(entry.googleFamily),
        fontStyle: sanitizeFontStyleCss(face.fontStyle),
        fontWeight: sanitizeFontWeightCss(face.fontWeight),
        unicodeRange: sanitizeUnicodeRangeCss(face.unicodeRange),
        fileName
      })
    }

    const meta: FontCacheMeta = {
      id: entry.id,
      name: entry.name,
      downloadedAt: Date.now(),
      faces: cachedFaces
    }
    await writeAtomic(metaPath, JSON.stringify(meta, null, 2))
    return { success: true }
  } catch (err: any) {
    // Clean up any partial files
    await rm(fontDir, { recursive: true, force: true }).catch(() => {})
    const offline = !checkIsOnline() || /ERR_INTERNET_DISCONNECTED|ERR_NAME_NOT_RESOLVED|ENOTFOUND|EAI_AGAIN|fetch failed|aborted/i.test(String(err?.message || err))
    return {
      success: false,
      offline,
      error: offline
        ? 'Offline — fonts not available for download.'
        : err?.message || 'Failed to download font.'
    }
  }
}

/**
 * Build a self-contained @font-face stylesheet with embedded base64 data URIs from local disk cache.
 * Embedding data URIs ensures 100% offline reliability inside epub.js sandboxed/blob iframes.
 */
export async function getFontFaceCss(fontId: string): Promise<string | null> {
  if (typeof fontId !== 'string' || !fontId.trim() || isBuiltinFont(fontId)) return null

  const entry = getFontEntry(fontId)
  if (!entry || entry.id !== fontId || !entry.googleFamily) return null

  const fontDir = getFontDir(entry.id)
  const metaPath = join(fontDir, 'meta.json')
  if (!existsSync(metaPath)) return null

  try {
    const meta = JSON.parse(await readFile(metaPath, 'utf-8')) as FontCacheMeta
    if (!meta.faces || meta.faces.length === 0) return null

    const safeFamily = sanitizeFontFamilyCss(entry.googleFamily)
    const fileCache = new Map<string, string>()
    const rules: string[] = []

    for (const face of meta.faces) {
      if (!isSafeCachedFileName(face?.fileName)) return null
      let dataUri = fileCache.get(face.fileName)
      if (!dataUri) {
        const filePath = join(fontDir, face.fileName)
        if (!existsSync(filePath)) return null
        const fileStat = await stat(filePath)
        if (fileStat.size > MAX_FONT_FACE_SIZE) return null
        const buf = await readFile(filePath)
        const mime = face.fileName.endsWith('.woff2')
          ? 'font/woff2'
          : face.fileName.endsWith('.woff')
          ? 'font/woff'
          : 'font/ttf'
        dataUri = `data:${mime};base64,${buf.toString('base64')}`
        fileCache.set(face.fileName, dataUri)
      }

      const format = face.fileName.endsWith('.woff2')
        ? 'woff2'
        : face.fileName.endsWith('.woff')
        ? 'woff'
        : 'truetype'
      const safeStyle = sanitizeFontStyleCss(face.fontStyle)
      const safeWeight = sanitizeFontWeightCss(face.fontWeight)
      const safeRange = sanitizeUnicodeRangeCss(face.unicodeRange)
      const rangeLine = safeRange ? `\n  unicode-range: ${safeRange};` : ''
      rules.push(
        `@font-face {\n  font-family: '${safeFamily}';\n  font-style: ${safeStyle};\n  font-weight: ${safeWeight};\n  font-display: swap;\n  src: url('${dataUri}') format('${format}');${rangeLine}\n}`
      )
    }

    return rules.join('\n')
  } catch {
    return null
  }
}
