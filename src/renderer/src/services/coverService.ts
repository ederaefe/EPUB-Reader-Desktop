import JSZip from 'jszip'
import * as pdfjsLib from 'pdfjs-dist'
import {
  formatPdfDate,
  normalizeTags,
  parseDelimitedTags,
  type EmbeddedBookMetadata,
  type EmbeddedMetadataExtraEntry
} from '../../../shared/bookMetadata'

// Configure local bundled pdf.js worker (100% offline, never relies on external CDN)
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString()
}

// ============================================================================
// PATH & IMAGE UTILITIES
// ============================================================================

function normalizeZipPath(baseDir: string, relHref: string): string {
  const cleanHref = relHref.split('#')[0].split('?')[0].trim()
  let decoded = cleanHref
  try {
    decoded = decodeURIComponent(cleanHref)
  } catch {
    // Keep raw href if malformed percent-encoding
  }

  const combined = decoded.startsWith('/') ? decoded.slice(1) : baseDir + decoded
  const parts = combined.split('/')
  const stack: string[] = []
  for (const part of parts) {
    if (!part || part === '.') continue
    if (part === '..') {
      stack.pop()
    } else {
      stack.push(part)
    }
  }
  return stack.join('/')
}

function findZipFile(zip: JSZip, baseDir: string, href: string): JSZip.JSZipObject | null {
  const normalized = normalizeZipPath(baseDir, href)
  const direct = zip.file(normalized) || zip.file(href) || zip.file(baseDir + href)
  if (direct) return direct

  // Case-insensitive fallback lookup across archive entries
  const targetLower = normalized.toLowerCase()
  const allNames = Object.keys(zip.files)
  const match = allNames.find((name) => name.toLowerCase() === targetLower && !zip.files[name].dir)
  return match ? zip.files[match] : null
}

function inferImageMime(href: string, explicitMime?: string | null): string {
  if (explicitMime && explicitMime.startsWith('image/')) return explicitMime
  const lower = href.toLowerCase()
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.gif')) return 'image/gif'
  if (lower.endsWith('.svg')) return 'image/svg+xml'
  return 'image/jpeg'
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  const chunkSize = 0x8000
  const chunks: string[] = []
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, i + chunkSize)
    chunks.push(String.fromCharCode.apply(null, Array.from(slice)))
  }
  return window.btoa(chunks.join(''))
}

async function zipImageToDataUrl(
  entry: JSZip.JSZipObject,
  href: string,
  explicitMime?: string | null
): Promise<string | null> {
  try {
    const buf = await entry.async('arraybuffer')
    if (!buf || buf.byteLength < 64) return null
    const mime = inferImageMime(href, explicitMime)
    return `data:${mime};base64,${arrayBufferToBase64(buf)}`
  } catch {
    return null
  }
}

/**
 * Inspects an XHTML/HTML page inside an EPUB for an embedded cover image
 * (`<img>`, `<svg><image>`, or inline `<svg>`).
 */
async function extractImageFromXhtml(
  zip: JSZip,
  xhtmlPath: string,
  xhtmlContent: string
): Promise<string | null> {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xhtmlContent, 'application/xhtml+xml')
  const fallbackDoc = doc.querySelector('parsererror')
    ? parser.parseFromString(xhtmlContent, 'text/html')
    : doc

  const pageDir = xhtmlPath.includes('/')
    ? xhtmlPath.substring(0, xhtmlPath.lastIndexOf('/') + 1)
    : ''

  // 1. Check <img> elements
  const imgs = Array.from(fallbackDoc.querySelectorAll('img'))
  for (const img of imgs) {
    const src = img.getAttribute('src')
    if (!src || src.startsWith('http://') || src.startsWith('https://')) continue
    if (src.startsWith('data:image/')) return src
    const file = findZipFile(zip, pageDir, src)
    if (file) {
      const url = await zipImageToDataUrl(file, src)
      if (url) return url
    }
  }

  // 2. Check <svg><image xlink:href="..." / href="...">
  const svgImages = Array.from(fallbackDoc.querySelectorAll('image'))
  for (const svgImg of svgImages) {
    const href =
      svgImg.getAttribute('xlink:href') ||
      svgImg.getAttributeNS('http://www.w3.org/1999/xlink', 'href') ||
      svgImg.getAttribute('href')
    if (!href) continue
    if (href.startsWith('data:image/')) return href
    const file = findZipFile(zip, pageDir, href)
    if (file) {
      const url = await zipImageToDataUrl(file, href)
      if (url) return url
    }
  }

  // 3. Check standalone inline <svg> vector cover
  const svgEl = fallbackDoc.querySelector('svg')
  if (svgEl && svgEl.outerHTML.length > 120) {
    const serializer = new XMLSerializer()
    const svgText = serializer.serializeToString(svgEl)
    const encoded = window.btoa(unescape(encodeURIComponent(svgText)))
    return `data:image/svg+xml;base64,${encoded}`
  }

  return null
}

// ============================================================================
// FIRST-PAGE DOCUMENT RENDERER (FALLBACK WHEN NO EMBEDDED THUMBNAIL EXISTS)
// ============================================================================

interface FirstPageBlock {
  kind: 'h1' | 'h2' | 'p'
  text: string
}

/**
 * Renders an authentic miniature First Page of a book (warm book paper,
 * real serif typography, headings, dividers, and opening body paragraphs)
 * onto a crisp 320x450 JPEG thumbnail when no cover image exists.
 */
export function renderFirstPageCanvas(
  blocks: FirstPageBlock[],
  fallbackTitle: string,
  fallbackAuthor: string
): string {
  const width = 320
  const height = 450
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return generateCoverCanvas(fallbackTitle, fallbackAuthor)

  // Warm book-paper backdrop
  ctx.fillStyle = '#faf8f3'
  ctx.fillRect(0, 0, width, height)

  // Subtle book spine shadow along left edge
  const spineGrad = ctx.createLinearGradient(0, 0, 18, 0)
  spineGrad.addColorStop(0, 'rgba(0, 0, 0, 0.14)')
  spineGrad.addColorStop(1, 'rgba(0, 0, 0, 0)')
  ctx.fillStyle = spineGrad
  ctx.fillRect(0, 0, 18, height)

  // Subtle outer page frame
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)'
  ctx.lineWidth = 1
  ctx.strokeRect(0.5, 0.5, width - 1, height - 1)

  const padX = 28
  const maxWidth = width - padX * 2
  let y = 42

  const effectiveBlocks: FirstPageBlock[] =
    blocks.length > 0
      ? blocks
      : [
          { kind: 'h1', text: fallbackTitle },
          ...(fallbackAuthor && fallbackAuthor !== 'Unknown Author'
            ? [{ kind: 'h2' as const, text: fallbackAuthor }]
            : [])
        ]

  // Check if this looks like a short title page (only headings / very short lines)
  const totalChars = effectiveBlocks.reduce((acc, b) => acc + b.text.length, 0)
  const isTitlePage = totalChars < 180 && effectiveBlocks.length <= 5

  if (isTitlePage) {
    // Classic centered title-page composition
    y = 120
    ctx.textAlign = 'center'
    const centerX = width / 2

    for (let i = 0; i < effectiveBlocks.length; i++) {
      const b = effectiveBlocks[i]
      if (y > height - 48) break
      if (b.kind === 'h1' || i === 0) {
        ctx.fillStyle = '#181a1f'
        ctx.font = 'bold 20px Georgia, "Times New Roman", serif'
        y = drawWrappedText(ctx, b.text, centerX, y, maxWidth, 26, 4)
        y += 14
        // Decorative rule under main title
        ctx.strokeStyle = '#c8c0b0'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(centerX - 36, y - 4)
        ctx.lineTo(centerX + 36, y - 4)
        ctx.stroke()
        y += 18
      } else if (b.kind === 'h2') {
        ctx.fillStyle = '#484f58'
        ctx.font = 'italic 13px Georgia, "Times New Roman", serif'
        y = drawWrappedText(ctx, b.text, centerX, y, maxWidth, 18, 3)
        y += 12
      } else {
        ctx.fillStyle = '#333840'
        ctx.font = '12px Georgia, "Times New Roman", serif'
        y = drawWrappedText(ctx, b.text, centerX, y, maxWidth, 17, 6)
        y += 10
      }
    }
  } else {
    // Authentic first-page prose layout
    for (const b of effectiveBlocks) {
      if (y > height - 30) break

      if (b.kind === 'h1') {
        ctx.textAlign = 'center'
        ctx.fillStyle = '#181a1f'
        ctx.font = 'bold 16px Georgia, "Times New Roman", serif'
        y = drawWrappedText(ctx, b.text, width / 2, y, maxWidth, 21, 3)
        y += 12
      } else if (b.kind === 'h2') {
        ctx.textAlign = 'left'
        ctx.fillStyle = '#2d333b'
        ctx.font = 'bold 12px Georgia, "Times New Roman", serif'
        y = drawWrappedText(ctx, b.text, padX, y, maxWidth, 16, 2)
        y += 8
      } else {
        ctx.textAlign = 'left'
        ctx.fillStyle = '#24292f'
        ctx.font = '11px Georgia, "Times New Roman", serif'
        y = drawWrappedText(ctx, b.text, padX, y, maxWidth, 15.5, 18, height - 28)
        y += 8
      }
    }
  }

  // Page 1 folio footer
  ctx.textAlign = 'center'
  ctx.fillStyle = '#9aa1a9'
  ctx.font = '9px Georgia, serif'
  ctx.fillText('1', width / 2, height - 14)

  return canvas.toDataURL('image/jpeg', 0.88)
}

function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  startY: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
  maxY = 420
): number {
  const words = text.replace(/\s+/g, ' ').trim().split(' ')
  let line = ''
  let y = startY
  let linesDrawn = 0

  for (let i = 0; i < words.length; i++) {
    const candidate = line ? `${line} ${words[i]}` : words[i]
    if (ctx.measureText(candidate).width > maxWidth && line) {
      ctx.fillText(line, x, y)
      y += lineHeight
      linesDrawn++
      line = words[i]
      if (linesDrawn >= maxLines || y > maxY) {
        return y
      }
    } else {
      line = candidate
    }
  }

  if (line && linesDrawn < maxLines && y <= maxY) {
    ctx.fillText(line, x, y)
    y += lineHeight
  }
  return y
}

function extractFirstPageBlocksFromXhtml(xhtml: string): FirstPageBlock[] {
  const parser = new DOMParser()
  const parsed = parser.parseFromString(xhtml, 'application/xhtml+xml')
  const doc = parsed.querySelector('parsererror')
    ? parser.parseFromString(xhtml, 'text/html')
    : parsed

  const body = doc.body || doc.documentElement
  if (!body) return []

  const blocks: FirstPageBlock[] = []
  const nodes = body.querySelectorAll('h1, h2, h3, h4, p, blockquote, li')

  if (nodes.length > 0) {
    for (const node of Array.from(nodes)) {
      const txt = (node.textContent || '').replace(/\s+/g, ' ').trim()
      if (!txt) continue
      const tag = node.tagName.toLowerCase()
      const kind: FirstPageBlock['kind'] =
        tag === 'h1' ? 'h1' : tag === 'h2' || tag === 'h3' || tag === 'h4' ? 'h2' : 'p'
      blocks.push({ kind, text: txt })
      if (blocks.length >= 16) break
    }
  } else {
    const rawText = (body.textContent || '').replace(/\r\n/g, '\n').trim()
    const paras = rawText
      .split(/\n{2,}/)
      .map((s) => s.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
    for (const p of paras.slice(0, 12)) {
      blocks.push({ kind: 'p', text: p })
    }
  }

  return blocks
}

// ============================================================================
// EPUB COVER + FIRST-PAGE EXTRACTOR
// ============================================================================

/**
 * Stage 1: Checks all standard and non-standard EPUB cover/thumbnail sources.
 * Stage 2: If no embedded cover exists, renders the book's actual first page.
 */
export async function extractEpubCover(
  data: ArrayBuffer,
  fallbackTitle = '',
  fallbackAuthor = ''
): Promise<string | null> {
  try {
    const zip = await JSZip.loadAsync(data)
    return await extractEpubCoverFromZip(zip, fallbackTitle, fallbackAuthor)
  } catch (err) {
    console.warn('Failed to extract EPUB cover:', err)
    return null
  }
}

async function extractEpubCoverFromZip(
  zip: JSZip,
  fallbackTitle: string,
  fallbackAuthor: string
): Promise<string | null> {
  const parser = new DOMParser()

  // 1. Locate OPF rootfile via META-INF/container.xml (or scan for *.opf)
  let opfPath: string | null = null
  const containerXml = await zip.file('META-INF/container.xml')?.async('string')
  if (containerXml) {
    const containerDoc = parser.parseFromString(containerXml, 'application/xml')
    opfPath = containerDoc.querySelector('rootfile')?.getAttribute('full-path') || null
  }
  if (!opfPath) {
    opfPath = Object.keys(zip.files).find((f) => f.toLowerCase().endsWith('.opf')) || null
  }
  if (!opfPath) return null

  const opfDir = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/') + 1) : ''
  const opfFile = findZipFile(zip, '', opfPath)
  const opfXml = await opfFile?.async('string')
  if (!opfXml) return null

  const opfDoc = parser.parseFromString(opfXml, 'application/xml')
  const manifestItems = Array.from(opfDoc.querySelectorAll('manifest > item, item'))

  const findManifestItemById = (id: string) =>
    manifestItems.find((item) => item.getAttribute('id') === id) || null

  const tryManifestImageItem = async (item: Element | null): Promise<string | null> => {
    if (!item) return null
    const href = item.getAttribute('href')
    const mediaType = item.getAttribute('media-type') || ''
    if (!href) return null

    const entry = findZipFile(zip, opfDir, href)
    if (!entry) return null

    if (mediaType.startsWith('image/') || /\.(jpe?g|png|webp|gif|svg)$/i.test(href)) {
      return await zipImageToDataUrl(entry, href, mediaType)
    }
    if (mediaType.includes('html') || /\.(x?html?|htm)$/i.test(href)) {
      const html = await entry.async('string')
      const resolvedPath = normalizeZipPath(opfDir, href)
      return await extractImageFromXhtml(zip, resolvedPath, html)
    }
    return null
  }

  // ---- STAGE 1: CHECK FOR EMBEDDED THUMBNAIL / COVER IMAGE ----

  // 1a. EPUB 3: item[properties~="cover-image"]
  const propCover = manifestItems.find((it) =>
    (it.getAttribute('properties') || '').split(/\s+/).includes('cover-image')
  )
  const propResult = await tryManifestImageItem(propCover || null)
  if (propResult) return propResult

  // 1b. EPUB 2: <meta name="cover" content="id-or-href">
  const metaElems = Array.from(opfDoc.querySelectorAll('meta'))
  const metaCover = metaElems.find(
    (m) => (m.getAttribute('name') || '').toLowerCase() === 'cover'
  )
  const metaCoverVal = metaCover?.getAttribute('content')?.trim()
  if (metaCoverVal) {
    const byId = findManifestItemById(metaCoverVal)
    const byHref = manifestItems.find(
      (it) =>
        it.getAttribute('href') === metaCoverVal ||
        (it.getAttribute('href') || '').endsWith('/' + metaCoverVal)
    )
    const metaResult = await tryManifestImageItem(byId || byHref || null)
    if (metaResult) return metaResult

    // Direct archive lookup if meta content is a filename
    const directEntry = findZipFile(zip, opfDir, metaCoverVal)
    if (directEntry) {
      const url = await zipImageToDataUrl(directEntry, metaCoverVal)
      if (url) return url
    }
  }

  // 1c. Manifest item with cover-like id
  const coverIdItem = manifestItems.find((it) => {
    const id = (it.getAttribute('id') || '').toLowerCase()
    const mt = (it.getAttribute('media-type') || '').toLowerCase()
    return (
      (id === 'cover' || id === 'cover-image' || id === 'cover_image' || id === 'coverimage' || id === 'bookcover') &&
      (mt.startsWith('image/') || mt.includes('html'))
    )
  })
  const coverIdResult = await tryManifestImageItem(coverIdItem || null)
  if (coverIdResult) return coverIdResult

  // 1d. OPF <guide><reference type="cover" href="..."> (covers XHTML wrappers like cover.xhtml)
  const guideRefs = Array.from(opfDoc.querySelectorAll('guide > reference, reference'))
  const coverRef = guideRefs.find((r) => (r.getAttribute('type') || '').toLowerCase() === 'cover')
  const coverRefHref = coverRef?.getAttribute('href')
  if (coverRefHref) {
    const refEntry = findZipFile(zip, opfDir, coverRefHref)
    if (refEntry) {
      if (/\.(jpe?g|png|webp|gif|svg)$/i.test(coverRefHref)) {
        const url = await zipImageToDataUrl(refEntry, coverRefHref)
        if (url) return url
      } else {
        const html = await refEntry.async('string')
        const resolvedPath = normalizeZipPath(opfDir, coverRefHref)
        const imgUrl = await extractImageFromXhtml(zip, resolvedPath, html)
        if (imgUrl) return imgUrl
      }
    }
  }

  // 1e. Inspect the FIRST spine item for an embedded cover image / title artwork
  const spineItemRefs = Array.from(opfDoc.querySelectorAll('spine > itemref'))
  if (spineItemRefs.length > 0) {
    const firstIdRef = spineItemRefs[0].getAttribute('idref')
    const firstItem = firstIdRef ? findManifestItemById(firstIdRef) : null
    const firstHref = firstItem?.getAttribute('href')
    if (firstHref) {
      const firstEntry = findZipFile(zip, opfDir, firstHref)
      if (firstEntry) {
        const html = await firstEntry.async('string')
        const resolvedPath = normalizeZipPath(opfDir, firstHref)
        const firstPageImg = await extractImageFromXhtml(zip, resolvedPath, html)
        if (firstPageImg) return firstPageImg
      }
    }
  }

  // 1f. Any image item in manifest whose href/id mentions "cover" or "front"
  const namedCoverItem = manifestItems.find((it) => {
    const mt = (it.getAttribute('media-type') || '').toLowerCase()
    if (!mt.startsWith('image/')) return false
    const href = (it.getAttribute('href') || '').toLowerCase()
    const id = (it.getAttribute('id') || '').toLowerCase()
    return href.includes('cover') || id.includes('cover') || href.includes('front')
  })
  const namedCoverResult = await tryManifestImageItem(namedCoverItem || null)
  if (namedCoverResult) return namedCoverResult

  // ---- STAGE 2: NO EMBEDDED COVER -> RENDER ACTUAL FIRST PAGE OF THE EPUB ----
  for (const ref of spineItemRefs.slice(0, 3)) {
    const idref = ref.getAttribute('idref')
    const item = idref ? findManifestItemById(idref) : null
    const href = item?.getAttribute('href')
    if (!href) continue
    const entry = findZipFile(zip, opfDir, href)
    if (!entry) continue
    const html = await entry.async('string')
    const blocks = extractFirstPageBlocksFromXhtml(html)
    if (blocks.length > 0) {
      return renderFirstPageCanvas(blocks, fallbackTitle, fallbackAuthor)
    }
  }

  return null
}

// ============================================================================
// PDF COVER / FIRST-PAGE RENDERER
// ============================================================================

/**
 * Renders the front page (Page 1) of a PDF to a crisp ~360px wide JPEG thumbnail
 * on a white paper background using the local bundled PDF.js worker.
 */
export async function extractPdfCover(data: ArrayBuffer): Promise<string | null> {
  const { coverDataUrl } = await extractPdfCoverAndMeta(data)
  return coverDataUrl
}

async function extractPdfCoverAndMeta(
  data: ArrayBuffer
): Promise<{
  coverDataUrl: string | null
  totalPages: number
  title: string | null
  author: string | null
  embedded: EmbeddedBookMetadata
}> {
  let pdf: pdfjsLib.PDFDocumentProxy | null = null
  try {
    // Always copy bytes so transferring into PDF.js worker never detaches caller's ArrayBuffer
    const bytes = new Uint8Array(data.slice(0))
    const loadingTask = pdfjsLib.getDocument({ data: bytes })
    pdf = await loadingTask.promise

    const totalPages = pdf.numPages || 1
    let title: string | null = null
    let author: string | null = null
    const embedded: EmbeddedBookMetadata = {}

    try {
      const meta = await pdf.getMetadata()
      const info = (meta?.info as Record<string, any>) || {}
      if (info.Title && typeof info.Title === 'string' && info.Title.trim().length > 0) {
        title = info.Title.trim()
        embedded.title = title
      }
      if (info.Author && typeof info.Author === 'string' && info.Author.trim().length > 0) {
        author = info.Author.trim()
        embedded.author = author
      }
      if (typeof info.Subject === 'string' && info.Subject.trim()) {
        embedded.subject = info.Subject.trim()
      }
      if (typeof info.Keywords === 'string' && info.Keywords.trim()) {
        embedded.tags = parseDelimitedTags(info.Keywords)
      }
      if (typeof info.Creator === 'string' && info.Creator.trim()) {
        embedded.creatorTool = info.Creator.trim()
      }
      if (typeof info.Producer === 'string' && info.Producer.trim()) {
        embedded.producer = info.Producer.trim()
      }
      if (typeof info.CreationDate === 'string' && info.CreationDate.trim()) {
        embedded.creationDate = formatPdfDate(info.CreationDate)
        embedded.publishedDate = embedded.creationDate
      }
      if (typeof info.ModDate === 'string' && info.ModDate.trim()) {
        embedded.modificationDate = formatPdfDate(info.ModDate)
      }
      if (typeof info.PDFFormatVersion === 'string' && info.PDFFormatVersion.trim()) {
        embedded.formatVersion = `PDF ${info.PDFFormatVersion.trim()}`
      }
      if (typeof info.Language === 'string' && info.Language.trim()) {
        embedded.language = info.Language.trim()
      }
      // Capture any custom PDF info keys beyond standard properties
      const standardPdfKeys = new Set([
        'Title',
        'Author',
        'Subject',
        'Keywords',
        'Creator',
        'Producer',
        'CreationDate',
        'ModDate',
        'PDFFormatVersion',
        'Language',
        'IsAcroFormPresent',
        'IsXFAPresent',
        'IsCollectionPresent',
        'IsLinearized',
        'IsSignaturesPresent',
        'EncryptFilterName',
        'Trapped',
        'Custom'
      ])
      const extraEntries: EmbeddedMetadataExtraEntry[] = []
      for (const [k, v] of Object.entries(info)) {
        if (standardPdfKeys.has(k)) continue
        if (typeof v === 'string' && v.trim()) {
          extraEntries.push({ key: k, value: v.trim() })
        }
      }
      if (info.Custom && typeof info.Custom === 'object') {
        for (const [k, v] of Object.entries(info.Custom)) {
          if (typeof v === 'string' && v.trim()) {
            extraEntries.push({ key: k, value: v.trim() })
          }
        }
      }
      if (extraEntries.length > 0) {
        embedded.extraEntries = extraEntries
      }
    } catch {
      // Metadata dictionary optional
    }

    let coverDataUrl: string | null = null
    if (totalPages > 0) {
      const page = await pdf.getPage(1)
      const baseViewport = page.getViewport({ scale: 1.0 })
      // Dynamically scale so the rendered thumbnail is always crisp (~360px wide)
      const targetWidth = 360
      const scale = Math.min(2.0, Math.max(0.35, targetWidth / Math.max(1, baseViewport.width)))
      const viewport = page.getViewport({ scale })

      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')
      if (context) {
        canvas.width = Math.round(viewport.width)
        canvas.height = Math.round(viewport.height)

        // Paint crisp white paper backdrop before rendering so transparent PDFs stay legible
        context.fillStyle = '#ffffff'
        context.fillRect(0, 0, canvas.width, canvas.height)

        await page.render({
          canvasContext: context,
          viewport
        }).promise

        coverDataUrl = canvas.toDataURL('image/jpeg', 0.88)
      }
    }

    return { coverDataUrl, totalPages, title, author, embedded }
  } catch (err) {
    console.warn('Failed to render PDF first-page thumbnail:', err)
    return { coverDataUrl: null, totalPages: 100, title: null, author: null, embedded: {} }
  } finally {
    try {
      await pdf?.destroy()
    } catch {
      // Ignore cleanup errors
    }
  }
}

// ============================================================================
// MOBI & TXT COVER / FIRST-PAGE EXTRACTORS
// ============================================================================

/**
 * Extracts embedded JPEG/PNG cover image record from a MOBI/AZW PalmDB file.
 * If none is found, renders a miniature first-page preview.
 */
function extractMobiCover(data: ArrayBuffer, title: string, author: string): string | null {
  try {
    const view = new DataView(data)
    const bytes = new Uint8Array(data)
    if (bytes.byteLength < 86) return null

    const numRecords = view.getUint16(76, false)
    if (numRecords < 2 || 78 + numRecords * 8 > bytes.byteLength) return null

    const offsets: number[] = []
    for (let i = 0; i < numRecords; i++) {
      offsets.push(view.getUint32(78 + i * 8, false))
    }

    // Scan PalmDB records for embedded JPEG (FF D8 FF) or PNG (89 50 4E 47) cover
    for (let i = 1; i < offsets.length; i++) {
      const start = offsets[i]
      const end = i + 1 < offsets.length ? offsets[i + 1] : bytes.byteLength
      const size = end - start
      if (size < 512 || start < 0 || end > bytes.byteLength) continue

      const isJpeg = bytes[start] === 0xff && bytes[start + 1] === 0xd8 && bytes[start + 2] === 0xff
      const isPng =
        bytes[start] === 0x89 &&
        bytes[start + 1] === 0x50 &&
        bytes[start + 2] === 0x4e &&
        bytes[start + 3] === 0x47

      if (isJpeg || isPng) {
        const imgBuf = data.slice(start, end)
        const mime = isPng ? 'image/png' : 'image/jpeg'
        return `data:${mime};base64,${arrayBufferToBase64(imgBuf)}`
      }
    }
  } catch (err) {
    console.warn('MOBI cover scan failed:', err)
  }

  return renderFirstPageCanvas([], title, author)
}

/**
 * Renders the opening text of a plain TXT book as an authentic miniature First Page.
 */
function extractTxtFirstPage(data: ArrayBuffer, title: string, author: string): string {
  try {
    const sample = new TextDecoder('utf-8', { fatal: false }).decode(
      new Uint8Array(data, 0, Math.min(data.byteLength, 3000))
    )
    const paragraphs = sample
      .replace(/\r\n/g, '\n')
      .split(/\n{2,}/)
      .map((s) => s.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .slice(0, 14)

    const blocks: FirstPageBlock[] = paragraphs.map((text, idx) => ({
      kind: idx === 0 && text.length < 70 ? 'h1' : 'p',
      text
    }))
    return renderFirstPageCanvas(blocks, title, author)
  } catch {
    return renderFirstPageCanvas([], title, author)
  }
}

// ============================================================================
// METADATA & UNIFIED IMPORT PIPELINE
// ============================================================================

/**
 * Sanitizes book filename, stripping website scrape prefixes and resolving Title/Author.
 */
export function parseBookTitleAndAuthor(filename: string): { title: string; author: string } {
  let clean = filename.replace(/\.[^/.]+$/, '') // remove extension
  clean = clean
    .replace(/^(d-pdf\.com\s*-\s*|oceanofpdf\.com_\s*|\[z-lib\.org\]\s*|z-lib\.org_\s*)/i, '')
    .trim()

  // Match "Title by Author" (e.g. "City of Stairs by Robert Jackson Bennett")
  const byMatch = clean.match(/^(.+?)\s+by\s+(.+)$/i)
  if (byMatch) {
    return { title: byMatch[1].trim(), author: byMatch[2].trim() }
  }

  // Match "Author - Title"
  const dashMatch = clean.match(/^([^-]+)\s*-\s*(.+)$/)
  if (dashMatch) {
    return { author: dashMatch[1].trim(), title: dashMatch[2].trim() }
  }

  return { title: clean, author: 'Unknown Author' }
}

/**
 * Strips inline HTML markup that some publishers embed inside EPUB <dc:description>.
 */
function stripHtmlToPlainText(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  if (!/<[a-z][\s\S]*>/i.test(trimmed)) return trimmed
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(trimmed, 'text/html')
    return (doc.body?.textContent || trimmed).replace(/\s+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  } catch {
    return trimmed.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  }
}

/**
 * Extracts rich Dublin Core, EPUB 2/3 series, and custom <meta> entries from an OPF Document.
 */
function parseOpfMetadataFromDoc(opfDoc: Document): EmbeddedBookMetadata {
  const result: EmbeddedBookMetadata = {}
  const packageEl = opfDoc.querySelector('package')
  const pkgVersion = packageEl?.getAttribute('version')?.trim()
  if (pkgVersion) {
    result.formatVersion = `EPUB ${pkgVersion}`
  }

  const metadataRoot =
    opfDoc.querySelector('metadata') ||
    Array.from(opfDoc.getElementsByTagName('*')).find((el) => el.localName === 'metadata') ||
    opfDoc.documentElement

  const allChildren = metadataRoot ? Array.from(metadataRoot.getElementsByTagName('*')) : []
  const getByLocal = (name: string) =>
    allChildren.filter((el) => el.localName.toLowerCase() === name.toLowerCase())

  const firstText = (name: string): string => {
    const el = getByLocal(name).find((n) => n.textContent?.trim())
    return el?.textContent?.trim() || ''
  }

  const title = firstText('title')
  if (title) result.title = title

  const creators = getByLocal('creator')
    .map((n) => n.textContent?.trim() || '')
    .filter(Boolean)
  if (creators.length > 0) {
    result.author = Array.from(new Set(creators)).join(', ')
  }

  const subjects = normalizeTags(
    getByLocal('subject').flatMap((n) =>
      (n.textContent || '')
        .split(/[,;]+/)
        .map((s) => s.trim())
        .filter(Boolean)
    )
  )
  if (subjects.length > 0) result.tags = subjects

  const descRaw = firstText('description')
  if (descRaw) result.description = stripHtmlToPlainText(descRaw)

  const publisher = firstText('publisher')
  if (publisher) result.publisher = publisher

  const date = firstText('date')
  if (date) result.publishedDate = date.length > 10 && /^\d{4}-\d{2}-\d{2}T/.test(date) ? date.slice(0, 10) : date

  const language = firstText('language')
  if (language) result.language = language

  // Prefer an ISBN identifier if multiple <dc:identifier> nodes exist
  const identifiers = getByLocal('identifier').filter((n) => n.textContent?.trim())
  const isbnNode = identifiers.find((n) => {
    const scheme = (n.getAttribute('opf:scheme') || n.getAttribute('scheme') || '').toLowerCase()
    const val = (n.textContent || '').toLowerCase()
    return scheme.includes('isbn') || val.includes('isbn')
  })
  const chosenId = (isbnNode || identifiers[0])?.textContent?.trim()
  if (chosenId) result.identifier = chosenId

  const rights = firstText('rights')
  if (rights) result.rights = rights

  // Parse <meta> elements for series, modified date, generator, and extra read-only properties
  const metaNodes = getByLocal('meta')
  const extraEntries: EmbeddedMetadataExtraEntry[] = []
  let seriesRefId: string | null = null

  for (const m of metaNodes) {
    const prop = (m.getAttribute('property') || '').trim()
    const name = (m.getAttribute('name') || '').trim()
    const content = (m.getAttribute('content') || m.textContent || '').trim()
    if (!content) continue

    if (prop === 'belongs-to-collection') {
      result.series = content
      seriesRefId = m.getAttribute('id')
    } else if (prop === 'group-position') {
      const refines = (m.getAttribute('refines') || '').replace(/^#/, '')
      if (!seriesRefId || !refines || refines === seriesRefId) {
        result.seriesIndex = content
      }
    } else if (name.toLowerCase() === 'calibre:series' && !result.series) {
      result.series = content
    } else if (name.toLowerCase() === 'calibre:series_index' && !result.seriesIndex) {
      result.seriesIndex = content
    } else if (prop === 'dcterms:modified') {
      result.modificationDate = content.length > 10 ? content.slice(0, 10) : content
    } else if (name.toLowerCase() === 'generator' || name.toLowerCase() === 'sigil version') {
      result.creatorTool = content
    } else if (
      name.toLowerCase() !== 'cover' &&
      prop !== 'collection-type' &&
      prop !== 'role' &&
      prop !== 'file-as' &&
      prop !== 'title-type' &&
      prop !== 'display-seq' &&
      !name.startsWith('calibre:timestamp') &&
      !name.startsWith('calibre:title_sort')
    ) {
      const label = prop || name
      if (label && extraEntries.length < 12) {
        extraEntries.push({ key: label, value: content })
      }
    }
  }

  if (extraEntries.length > 0) {
    result.extraEntries = extraEntries
  }

  return result
}

/**
 * Extracts full embedded metadata from an already-loaded EPUB or PDF file buffer.
 * Used on-demand by the Reading Settings Metadata Editor to hydrate existing library books.
 */
export async function extractEmbeddedBookMetadata(
  buffer: ArrayBuffer,
  format: 'epub' | 'pdf' | 'mobi' | 'txt'
): Promise<EmbeddedBookMetadata> {
  try {
    if (format === 'epub') {
      const zip = await JSZip.loadAsync(buffer)
      let opfPath: string | null = null
      const containerXml = await zip.file('META-INF/container.xml')?.async('string')
      if (containerXml) {
        const parser = new DOMParser()
        const containerDoc = parser.parseFromString(containerXml, 'application/xml')
        opfPath = containerDoc.querySelector('rootfile')?.getAttribute('full-path') || null
      }
      if (!opfPath) {
        opfPath = Object.keys(zip.files).find((f) => f.toLowerCase().endsWith('.opf')) || null
      }
      if (!opfPath) return {}
      const opfXml = await findZipFile(zip, '', opfPath)?.async('string')
      if (!opfXml) return {}
      const parser = new DOMParser()
      const opfDoc = parser.parseFromString(opfXml, 'application/xml')
      return parseOpfMetadataFromDoc(opfDoc)
    }

    if (format === 'pdf') {
      let pdf: pdfjsLib.PDFDocumentProxy | null = null
      try {
        const bytes = new Uint8Array(buffer.slice(0))
        pdf = await pdfjsLib.getDocument({ data: bytes }).promise
        const meta = await pdf.getMetadata()
        const info = (meta?.info as Record<string, any>) || {}
        const embedded: EmbeddedBookMetadata = {}
        if (typeof info.Title === 'string' && info.Title.trim()) embedded.title = info.Title.trim()
        if (typeof info.Author === 'string' && info.Author.trim()) embedded.author = info.Author.trim()
        if (typeof info.Subject === 'string' && info.Subject.trim()) embedded.subject = info.Subject.trim()
        if (typeof info.Keywords === 'string' && info.Keywords.trim()) {
          embedded.tags = parseDelimitedTags(info.Keywords)
        }
        if (typeof info.Creator === 'string' && info.Creator.trim()) embedded.creatorTool = info.Creator.trim()
        if (typeof info.Producer === 'string' && info.Producer.trim()) embedded.producer = info.Producer.trim()
        if (typeof info.CreationDate === 'string' && info.CreationDate.trim()) {
          embedded.creationDate = formatPdfDate(info.CreationDate)
          embedded.publishedDate = embedded.creationDate
        }
        if (typeof info.ModDate === 'string' && info.ModDate.trim()) {
          embedded.modificationDate = formatPdfDate(info.ModDate)
        }
        if (typeof info.PDFFormatVersion === 'string' && info.PDFFormatVersion.trim()) {
          embedded.formatVersion = `PDF ${info.PDFFormatVersion.trim()}`
        }
        if (typeof info.Language === 'string' && info.Language.trim()) {
          embedded.language = info.Language.trim()
        }
        return embedded
      } finally {
        try {
          await pdf?.destroy()
        } catch {
          // ignore cleanup errors
        }
      }
    }
  } catch (err) {
    console.warn('Embedded metadata extraction error:', err)
  }
  return {}
}

/**
 * Validates and proportionally resizes a user-selected cover image file (PNG/JPG/WebP)
 * so custom thumbnails remain crisp while keeping IndexedDB and EPUB archives lightweight.
 */
export async function resizeCoverImageFile(
  file: File
): Promise<{ dataUrl: string; width: number; height: number }> {
  const MAX_FILE_BYTES = 15 * 1024 * 1024 // 15 MB guard
  if (!file.type.startsWith('image/') && !/\.(jpe?g|png|webp)$/i.test(file.name)) {
    throw new Error('Please choose a PNG, JPG, or WebP image.')
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error('Cover image must be smaller than 15 MB.')
  }

  const objectUrl = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('Could not decode selected image.'))
      el.src = objectUrl
    })

    const maxW = 600
    const maxH = 900
    const ratio = Math.min(1, maxW / Math.max(1, img.naturalWidth), maxH / Math.max(1, img.naturalHeight))
    const width = Math.max(1, Math.round(img.naturalWidth * ratio))
    const height = Math.max(1, Math.round(img.naturalHeight * ratio))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D context unavailable.')

    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, 0, 0, width, height)

    const isPng = file.type === 'image/png' || file.name.toLowerCase().endsWith('.png')
    const dataUrl = isPng ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.88)
    return { dataUrl, width, height }
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

/**
 * Unified book import extractor:
 * 1. Parses Title, Author, rich embedded metadata, and Page Count.
 * 2. Checks for an embedded thumbnail/cover image first.
 * 3. If none exists, renders the book's actual First Page (PDF Page 1, EPUB first spine page, or TXT page 1).
 */
export async function extractBookMetadata(
  buffer: ArrayBuffer,
  ext: string,
  rawName: string
): Promise<{
  title: string
  author: string
  coverDataUrl: string | null
  totalPages: number
  embedded: EmbeddedBookMetadata
}> {
  const parsed = parseBookTitleAndAuthor(rawName)
  let title = parsed.title
  let author = parsed.author
  let coverDataUrl: string | null = null
  let totalPages = 100
  let embedded: EmbeddedBookMetadata = {}
  const normalizedExt = ext.toLowerCase()

  try {
    if (normalizedExt === 'epub') {
      const zip = await JSZip.loadAsync(buffer)

      // Parse OPF metadata first so fallback title/author and tags are accurate
      let opfPath: string | null = null
      const containerXml = await zip.file('META-INF/container.xml')?.async('string')
      if (containerXml) {
        const parser = new DOMParser()
        const containerDoc = parser.parseFromString(containerXml, 'application/xml')
        opfPath = containerDoc.querySelector('rootfile')?.getAttribute('full-path') || null
      }
      if (!opfPath) {
        opfPath = Object.keys(zip.files).find((f) => f.toLowerCase().endsWith('.opf')) || null
      }

      if (opfPath) {
        const opfXml = await findZipFile(zip, '', opfPath)?.async('string')
        if (opfXml) {
          const parser = new DOMParser()
          const opfDoc = parser.parseFromString(opfXml, 'application/xml')
          embedded = parseOpfMetadataFromDoc(opfDoc)
          if (embedded.title) title = embedded.title
          if (embedded.author) author = embedded.author
          const spineItems = opfDoc.querySelectorAll('spine > itemref')
          if (spineItems.length > 0) {
            totalPages = Math.max(1, spineItems.length * 8)
          }
        }
      }

      // Stage 1 (embedded cover) -> Stage 2 (actual first-page render)
      coverDataUrl = await extractEpubCoverFromZip(zip, title, author)
    } else if (normalizedExt === 'pdf') {
      const pdfRes = await extractPdfCoverAndMeta(buffer)
      coverDataUrl = pdfRes.coverDataUrl
      totalPages = pdfRes.totalPages || 100
      embedded = pdfRes.embedded
      if (pdfRes.title) title = pdfRes.title
      if (pdfRes.author) author = pdfRes.author
    } else if (normalizedExt === 'mobi' || normalizedExt === 'azw' || normalizedExt === 'azw3') {
      coverDataUrl = extractMobiCover(buffer, title, author)
    } else if (normalizedExt === 'txt') {
      coverDataUrl = extractTxtFirstPage(buffer, title, author)
      totalPages = Math.max(1, Math.ceil(buffer.byteLength / 2200))
    }
  } catch (e) {
    console.warn('Metadata & cover extraction error:', e)
  }

  // Last-resort fallback: clean first-page title sheet
  if (!coverDataUrl) {
    coverDataUrl = renderFirstPageCanvas([], title, author)
  }

  return { title, author, coverDataUrl, totalPages, embedded }
}

/**
 * Generates a stylized dark fallback book cover canvas (retained for compatibility).
 */
export function generateCoverCanvas(title: string, author: string): string {
  const canvas = document.createElement('canvas')
  canvas.width = 300
  canvas.height = 420
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''

  const grad = ctx.createLinearGradient(0, 0, 300, 420)
  grad.addColorStop(0, '#232834')
  grad.addColorStop(1, '#151820')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 300, 420)

  ctx.strokeStyle = '#3c404d'
  ctx.lineWidth = 2
  ctx.strokeRect(4, 4, 292, 412)

  ctx.strokeStyle = '#2b2f3a'
  ctx.lineWidth = 1
  ctx.strokeRect(14, 14, 272, 392)

  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)'
  ctx.fillRect(4, 4, 16, 412)

  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 20px "Segoe UI", sans-serif'
  ctx.textAlign = 'center'
  drawWrappedText(ctx, title, 150, 160, 240, 26, 5)

  if (author && author !== 'Unknown Author' && author !== 'Unknown') {
    ctx.fillStyle = '#8b949e'
    ctx.font = '14px "Segoe UI", sans-serif'
    ctx.fillText(author, 150, 290)
  }

  return canvas.toDataURL('image/jpeg', 0.85)
}
