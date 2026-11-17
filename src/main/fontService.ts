import { app, net } from 'electron'
import { join } from 'path'
import { mkdir, readdir, readFile, rm, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import { createHash } from 'crypto'
import { getFontEntry, isBuiltinFont } from '../shared/fontCatalog'

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
  const safeId = fontId.replace(/[^a-z0-9_-]/gi, '')
  return join(getFontsRootDir(), safeId)
}

export function checkIsOnline(): boolean {
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
          meta.id &&
          Array.isArray(meta.faces) &&
          meta.faces.length > 0 &&
          meta.faces.every((f) => existsSync(join(root, entry.name, f.fileName)))
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

async function fetchWithTimeout(url: string, timeoutMs = 10000): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await net.fetch(url, {
      headers: {
        'User-Agent': MODERN_CHROME_UA,
        Accept: 'text/css,*/*;q=0.1'
      },
      signal: controller.signal
    })
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
  if (isBuiltinFont(fontId)) {
    return { success: true, alreadyAvailable: true }
  }

  const entry = getFontEntry(fontId)
  if (!entry || !entry.googleFamily) {
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
        existing.faces.every((f) => existsSync(join(fontDir, f.fileName)))
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
      let fileName = downloadedFiles.get(face.url)
      if (!fileName) {
        const resp = await fetchWithTimeout(face.url, 15000)
        if (!resp.ok) {
          throw new Error(`Failed to download font asset (${resp.status})`)
        }
        const buf = Buffer.from(await resp.arrayBuffer())
        const hash = createHash('sha1').update(face.url).digest('hex').slice(0, 12)
        const ext = face.url.includes('.woff2') ? 'woff2' : face.url.includes('.woff') ? 'woff' : 'ttf'
        fileName = `${hash}.${ext}`
        await writeFile(join(fontDir, fileName), buf)
        downloadedFiles.set(face.url, fileName)
      }

      cachedFaces.push({
        fontFamily: entry.googleFamily,
        fontStyle: face.fontStyle,
        fontWeight: face.fontWeight,
        unicodeRange: face.unicodeRange,
        fileName
      })
    }

    const meta: FontCacheMeta = {
      id: entry.id,
      name: entry.name,
      downloadedAt: Date.now(),
      faces: cachedFaces
    }
    await writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf-8')
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
  if (isBuiltinFont(fontId)) return null

  const fontDir = getFontDir(fontId)
  const metaPath = join(fontDir, 'meta.json')
  if (!existsSync(metaPath)) return null

  try {
    const meta = JSON.parse(await readFile(metaPath, 'utf-8')) as FontCacheMeta
    if (!meta.faces || meta.faces.length === 0) return null

    const fileCache = new Map<string, string>()
    const rules: string[] = []

    for (const face of meta.faces) {
      let dataUri = fileCache.get(face.fileName)
      if (!dataUri) {
        const filePath = join(fontDir, face.fileName)
        if (!existsSync(filePath)) return null
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
      const rangeLine = face.unicodeRange ? `\n  unicode-range: ${face.unicodeRange};` : ''
      rules.push(
        `@font-face {\n  font-family: '${face.fontFamily}';\n  font-style: ${face.fontStyle};\n  font-weight: ${face.fontWeight};\n  font-display: swap;\n  src: url('${dataUri}') format('${format}');${rangeLine}\n}`
      )
    }

    return rules.join('\n')
  } catch {
    return null
  }
}
