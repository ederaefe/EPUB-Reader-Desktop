import { readFile, writeFile, mkdir, stat, rename, unlink } from 'fs/promises'
import { existsSync } from 'fs'
import { basename, extname, dirname } from 'path'
import { createHash, randomBytes } from 'crypto'
import JSZip from 'jszip'

const MAX_PDF_BYTES = 250 * 1024 * 1024 // 250 MB safety limit
const MAX_PDF_PAGES = 5000 // Guard against malformed multi-ten-thousand-page PDFs exhausting memory

async function writeAtomicBuffer(targetPath: string, data: Buffer): Promise<void> {
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

export interface PdfConvertProgress {
  currentPage: number
  totalPages: number
  stage: string
  percent: number
}

export interface PdfConvertResult {
  success: boolean
  epubPath?: string
  title?: string
  author?: string
  pageCount?: number
  imageCount?: number
  error?: string
  cancelled?: boolean
}

interface ExtractedSpan {
  text: string
  fontSize: number
  bold: boolean
  italic: boolean
  mono: boolean
}

interface ExtractedLine {
  y0: number
  y1: number
  spans: ExtractedSpan[]
}

interface ExtractedBlock {
  type: 'text' | 'image'
  bbox: [number, number, number, number]
  lines?: ExtractedLine[]
  imageHref?: string
  imageWidth?: number
  imageHeight?: number
}

interface OutlineEntry {
  title: string
  page: number
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
}

function sanitizeTitle(raw: string): string {
  return raw
    .replace(/^d-pdf\.com\s*[-_]\s*/i, '')
    .replace(/\[[^\]]*z-lib[^\]]*\]/gi, '')
    .replace(/\(z-lib\.org\)/gi, '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeHeaderFooterCandidate(text: string): string {
  return text
    .replace(/\d+/g, '#')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function flattenOutline(items: any[], out: OutlineEntry[] = []): OutlineEntry[] {
  if (!Array.isArray(items)) return out
  for (const item of items) {
    if (item && typeof item.title === 'string' && typeof item.page === 'number' && item.page >= 0) {
      out.push({ title: item.title.trim(), page: item.page })
    }
    if (Array.isArray(item?.down) && item.down.length > 0) {
      flattenOutline(item.down, out)
    }
  }
  return out
}

const REFLOW_CSS = `/* Semply Ebook Reader - Librera-Inspired PDF Reflow Stylesheet */
html, body {
  margin: 0;
  padding: 0;
  line-height: 1.55;
  text-rendering: optimizeLegibility;
  word-wrap: break-word;
  overflow-wrap: break-word;
}
h1, h2, h3, h4 {
  line-height: 1.25;
  margin-top: 1.3em;
  margin-bottom: 0.55em;
  page-break-after: avoid;
  break-after: avoid;
}
h1 { font-size: 1.55em; font-weight: 700; }
h2 { font-size: 1.3em; font-weight: 600; }
h3 { font-size: 1.12em; font-weight: 600; }
p {
  margin-top: 0;
  margin-bottom: 0.85em;
  text-align: justify;
  hyphens: auto;
}
pre, code {
  font-family: Consolas, "Courier New", monospace;
  font-size: 0.88em;
}
pre {
  white-space: pre-wrap;
  padding: 0.7em 0.9em;
  border-left: 2px solid rgba(128, 128, 128, 0.35);
  margin: 0.9em 0;
}
figure.pdf-figure {
  margin: 1.1em auto;
  text-align: center;
  page-break-inside: avoid;
  break-inside: avoid;
}
figure.pdf-figure img {
  max-width: 100%;
  max-height: 88vh;
  width: auto;
  height: auto;
  display: block;
  margin: 0 auto;
}
figure.pdf-page-scan {
  margin: 0.5em auto;
  text-align: center;
  page-break-before: always;
  page-break-after: always;
}
figure.pdf-page-scan img {
  max-width: 100%;
  height: auto;
  display: block;
  margin: 0 auto;
}
.page-anchor {
  display: block;
  height: 0;
  margin: 0;
  padding: 0;
}
`

export async function convertPdfToEpub(
  pdfPath: string,
  targetEpubPath: string,
  onProgress?: (p: PdfConvertProgress) => void,
  signal?: AbortSignal
): Promise<PdfConvertResult> {
  // Dynamically load Artifex official MuPDF WASM package (ESM)
  const mupdf: any = await import('mupdf')

  if (signal?.aborted) {
    return { success: false, error: 'Reflow conversion cancelled by user', cancelled: true }
  }

  if (!existsSync(pdfPath)) {
    return { success: false, error: `PDF file not found: ${pdfPath}` }
  }

  const outDir = dirname(targetEpubPath)
  if (!existsSync(outDir)) {
    await mkdir(outDir, { recursive: true })
  }

  const pdfStat = await stat(pdfPath)
  if (pdfStat.size > MAX_PDF_BYTES) {
    return { success: false, error: 'PDF exceeds the 250 MB safety ceiling for reflow conversion.' }
  }

  const pdfBytes = await readFile(pdfPath)
  const doc = mupdf.Document.openDocument(pdfBytes, 'application/pdf')

  try {
    const totalPages: number = doc.countPages()
    if (totalPages === 0) {
      return { success: false, error: 'PDF contains no readable pages.' }
    }
    if (totalPages > MAX_PDF_PAGES) {
      return { success: false, error: `PDF exceeds the maximum supported page count (${MAX_PDF_PAGES} pages) for reflow conversion.` }
    }

    onProgress?.({ currentPage: 0, totalPages, stage: 'Analyzing PDF structure & typography...', percent: 5 })

    // Extract document metadata
    const fallbackTitle = sanitizeTitle(basename(pdfPath, extname(pdfPath)))
    const rawMetaTitle = doc.getMetaData?.('info:Title') || ''
    const rawMetaAuthor = doc.getMetaData?.('info:Author') || ''
    const title = sanitizeTitle(rawMetaTitle) || fallbackTitle
    const author = (rawMetaAuthor || '').trim() || 'Unknown Author'

    // Extract native PDF outline for chapter splitting
    let outlineEntries: OutlineEntry[] = []
    try {
      const rawOutline = doc.loadOutline?.()
      outlineEntries = flattenOutline(rawOutline)
    } catch {
      outlineEntries = []
    }

    // Deduplicate outline page boundaries and sort ascending
    const chapterStartMap = new Map<number, string>()
    for (const entry of outlineEntries) {
      if (entry.page >= 0 && entry.page < totalPages && !chapterStartMap.has(entry.page)) {
        chapterStartMap.set(entry.page, entry.title)
      }
    }

    // Extract Page 1 cover image
    const zip = new JSZip()
    zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' })

    const manifestImages: Array<{ id: string; href: string; mediaType: string; properties?: string }> = []
    let hasCover = false

    try {
      const firstPage = doc.loadPage(0)
      try {
        const coverMatrix = mupdf.Matrix.scale(1.5, 1.5)
        const coverPixmap = firstPage.toPixmap(coverMatrix, mupdf.ColorSpace.DeviceRGB, false)
        try {
          const coverJpg = coverPixmap.asJPEG(86)
          zip.file('OEBPS/images/cover.jpg', coverJpg)
          manifestImages.push({
            id: 'cover-image',
            href: 'images/cover.jpg',
            mediaType: 'image/jpeg',
            properties: 'cover-image'
          })
          hasCover = true
        } finally {
          coverPixmap.destroy()
        }
      } finally {
        firstPage.destroy()
      }
    } catch (coverErr) {
      console.warn('Could not rasterize PDF cover page:', coverErr)
    }

    // Pass 1: Sample font sizes & detect repetitive running headers/footers
    const fontSizeFreq = new Map<number, number>()
    const topBandFreq = new Map<string, number>()
    const bottomBandFreq = new Map<string, number>()
    const sampleStep = totalPages > 120 ? Math.ceil(totalPages / 80) : 1
    let sampledCount = 0

    for (let p = 0; p < totalPages; p += sampleStep) {
      if (signal?.aborted) {
        throw new Error('Reflow conversion cancelled by user')
      }
      if (p % 10 === 0) {
        await new Promise((resolve) => setImmediate(resolve))
      }
      sampledCount++
      const page = doc.loadPage(p)
      try {
        const bounds = page.getBounds()
        const pageHeight = Math.max(1, bounds[3] - bounds[1])
        const topCutoff = bounds[1] + pageHeight * 0.08
        const bottomCutoff = bounds[3] - pageHeight * 0.08
        const stext = page.toStructuredText('dehyphenate')
        try {
          let currentLineChars = ''
          let currentLineY0 = 0
          let currentLineY1 = 0
          stext.walk({
            beginLine(bbox: number[]) {
              currentLineChars = ''
              currentLineY0 = bbox[1]
              currentLineY1 = bbox[3]
            },
            onChar(c: string, _origin: number[], _font: any, size: number) {
              currentLineChars += c
              const rounded = Math.round(size * 2) / 2
              if (rounded >= 6 && rounded <= 48 && c.trim()) {
                fontSizeFreq.set(rounded, (fontSizeFreq.get(rounded) || 0) + 1)
              }
            },
            endLine() {
              const trimmed = currentLineChars.trim()
              if (trimmed.length > 0 && trimmed.length <= 90) {
                const norm = normalizeHeaderFooterCandidate(trimmed)
                if (currentLineY1 <= topCutoff) {
                  topBandFreq.set(norm, (topBandFreq.get(norm) || 0) + 1)
                } else if (currentLineY0 >= bottomCutoff) {
                  bottomBandFreq.set(norm, (bottomBandFreq.get(norm) || 0) + 1)
                }
              }
            }
          })
        } finally {
          stext.destroy()
        }
      } finally {
        page.destroy()
      }
    }

    // Determine dominant body font size
    let bodyFontSize = 11
    let maxFreq = 0
    for (const [sz, count] of fontSizeFreq.entries()) {
      if (count > maxFreq) {
        maxFreq = count
        bodyFontSize = sz
      }
    }

    // Build header/footer suppression sets (repeating across >=35% of sampled pages, min 3)
    const repeatThreshold = Math.max(3, Math.floor(sampledCount * 0.35))
    const repeatingHeaders = new Set<string>()
    const repeatingFooters = new Set<string>()
    for (const [norm, count] of topBandFreq.entries()) {
      if (count >= repeatThreshold || norm === '#') repeatingHeaders.add(norm)
    }
    for (const [norm, count] of bottomBandFreq.entries()) {
      if (count >= repeatThreshold || norm === '#') repeatingFooters.add(norm)
    }

    // Pass 2: Extract structured text + embedded images page by page
    const imageHashToHref = new Map<string, string>()
    let imageCounter = 0

    interface ChapterDoc {
      index: number
      title: string
      filename: string
      htmlChunks: string[]
    }

    const chapters: ChapterDoc[] = []
    const fallbackPagesPerChapter = 15

    const openChapter = (chapterTitle: string) => {
      const idx = chapters.length + 1
      const filename = `chapter_${String(idx).padStart(3, '0')}.xhtml`
      const ch: ChapterDoc = { index: idx, title: chapterTitle, filename, htmlChunks: [] }
      chapters.push(ch)
      return ch
    }

    let currentChapter = openChapter(chapterStartMap.get(0) || title)

    for (let p = 0; p < totalPages; p++) {
      if (signal?.aborted) {
        throw new Error('Reflow conversion cancelled by user')
      }
      // Cooperative event-loop yield so Electron main thread never hangs
      await new Promise((resolve) => setImmediate(resolve))

      if (p > 0) {
        if (chapterStartMap.has(p)) {
          currentChapter = openChapter(chapterStartMap.get(p)!)
        } else if (chapterStartMap.size <= 1 && p % fallbackPagesPerChapter === 0) {
          currentChapter = openChapter(`Section ${chapters.length + 1} (Page ${p + 1})`)
        }
      }

      if (p % 2 === 0 || p === totalPages - 1) {
        const pct = Math.min(92, 10 + Math.round(((p + 1) / totalPages) * 82))
        onProgress?.({
          currentPage: p + 1,
          totalPages,
          stage: `Reflowing page ${p + 1} of ${totalPages}...`,
          percent: pct
        })
      }

      const page = doc.loadPage(p)
      try {
        const bounds = page.getBounds()
        const pageHeight = Math.max(1, bounds[3] - bounds[1])
        const topCutoff = bounds[1] + pageHeight * 0.08
        const bottomCutoff = bounds[3] - pageHeight * 0.08

        const blocks: ExtractedBlock[] = []
        let pageTextCharCount = 0

        const stext = page.toStructuredText('preserve-images,dehyphenate')
        try {
          let activeBlock: ExtractedBlock | null = null
          let activeLine: ExtractedLine | null = null
          let activeSpan: ExtractedSpan | null = null

          stext.walk({
            beginTextBlock(bbox: [number, number, number, number]) {
              activeBlock = { type: 'text', bbox, lines: [] }
            },
            beginLine(bbox: [number, number, number, number]) {
              activeLine = { y0: bbox[1], y1: bbox[3], spans: [] }
              activeSpan = null
            },
            onChar(c: string, _origin: number[], font: any, size: number) {
              if (!activeLine) return
              if (c.trim()) pageTextCharCount++

              let bold = false
              let italic = false
              let mono = false
              try {
                bold = !!font?.isBold?.()
                italic = !!font?.isItalic?.()
                mono = !!font?.isMono?.()
              } catch {
                // ignore font flag query errors
              }

              const roundedSize = Math.round(size * 2) / 2
              if (
                activeSpan &&
                activeSpan.bold === bold &&
                activeSpan.italic === italic &&
                activeSpan.mono === mono &&
                Math.abs(activeSpan.fontSize - roundedSize) < 0.6
              ) {
                activeSpan.text += c
              } else {
                activeSpan = { text: c, fontSize: roundedSize, bold, italic, mono }
                activeLine.spans.push(activeSpan)
              }
            },
            endLine() {
              if (activeBlock && activeLine && activeLine.spans.length > 0) {
                activeBlock.lines?.push(activeLine)
              }
              activeLine = null
              activeSpan = null
            },
            endTextBlock() {
              if (activeBlock && activeBlock.lines && activeBlock.lines.length > 0) {
                blocks.push(activeBlock)
              }
              activeBlock = null
            },
            onImageBlock(bbox: [number, number, number, number], _matrix: number[], image: any) {
              if (signal?.aborted) return
              try {
                const pixmap = image.toPixmap()
                try {
                  const w = pixmap.getWidth()
                  const h = pixmap.getHeight()
                  // Skip tiny 1px spacer/tracking artifacts
                  if (w < 24 || h < 24) return

                  const useJpeg = pixmap.getAlpha?.() === 0 && w * h > 160000
                  const imgBytes: Uint8Array = useJpeg ? pixmap.asJPEG(86) : pixmap.asPNG()
                  const ext = useJpeg ? 'jpg' : 'png'
                  const mediaType = useJpeg ? 'image/jpeg' : 'image/png'

                  const hash = createHash('sha1').update(imgBytes).digest('hex').slice(0, 14)
                  let href = imageHashToHref.get(hash)
                  if (!href) {
                    imageCounter++
                    const filename = `img_${String(imageCounter).padStart(4, '0')}.${ext}`
                    href = `images/${filename}`
                    imageHashToHref.set(hash, href)
                    zip.file(`OEBPS/${href}`, imgBytes)
                    manifestImages.push({
                      id: `img-${imageCounter}`,
                      href,
                      mediaType
                    })
                  }

                  blocks.push({
                    type: 'image',
                    bbox,
                    imageHref: `../${href}`,
                    imageWidth: w,
                    imageHeight: h
                  })
                } finally {
                  pixmap.destroy()
                }
              } catch (imgErr) {
                console.warn(`Image block extraction skipped on page ${p + 1}:`, imgErr)
              }
            }
          })
        } finally {
          stext.destroy()
        }

        // Page anchor for navigation fidelity
        currentChapter.htmlChunks.push(`<span class="page-anchor" id="pdf-page-${p + 1}"></span>`)

        // Scanned / Image-Only / Full-Diagram Page Fallback: preserve 100% visually as crisp JPEG
        if (pageTextCharCount < 25 && blocks.filter((b) => b.type === 'image').length === 0) {
          if (signal?.aborted) {
            throw new Error('Reflow conversion cancelled by user')
          }
          await new Promise((resolve) => setImmediate(resolve))
          try {
            const scanMatrix = mupdf.Matrix.scale(1.8, 1.8)
            const scanPixmap = page.toPixmap(scanMatrix, mupdf.ColorSpace.DeviceRGB, false)
            try {
              const jpgBytes = scanPixmap.asJPEG(86)
              imageCounter++
              const filename = `page_scan_${String(p + 1).padStart(4, '0')}.jpg`
              const href = `images/${filename}`
              zip.file(`OEBPS/${href}`, jpgBytes)
              manifestImages.push({ id: `img-${imageCounter}`, href, mediaType: 'image/jpeg' })
              currentChapter.htmlChunks.push(
                `<figure class="pdf-page-scan"><img src="../${href}" alt="Page ${p + 1}" /></figure>`
              )
            } finally {
              scanPixmap.destroy()
            }
          } catch (scanErr) {
            console.warn(`Fallback scan raster failed for page ${p + 1}:`, scanErr)
          }
          continue
        }

        // Emit semantic HTML blocks in reading order
        for (const blk of blocks) {
          if (blk.type === 'image' && blk.imageHref) {
            currentChapter.htmlChunks.push(
              `<figure class="pdf-figure"><img src="${escapeXml(blk.imageHref)}" alt="Illustration on page ${p + 1}" /></figure>`
            )
            continue
          }

          if (!blk.lines || blk.lines.length === 0) continue

          // Filter out running headers & footers
          const keptLines = blk.lines.filter((line) => {
            const plain = line.spans.map((s) => s.text).join('').trim()
            if (!plain) return false
            const norm = normalizeHeaderFooterCandidate(plain)
            if (line.y1 <= topCutoff && (repeatingHeaders.has(norm) || /^\d{1,4}$/.test(plain))) {
              return false
            }
            if (line.y0 >= bottomCutoff && (repeatingFooters.has(norm) || /^\d{1,4}$/.test(plain))) {
              return false
            }
            return true
          })

          if (keptLines.length === 0) continue

          // Compute weighted average font size & monospace ratio for this block
          let weightedSize = 0
          let totalChars = 0
          let monoChars = 0
          let boldChars = 0
          for (const line of keptLines) {
            for (const sp of line.spans) {
              const len = sp.text.trim().length
              if (len === 0) continue
              weightedSize += sp.fontSize * len
              totalChars += len
              if (sp.mono) monoChars += len
              if (sp.bold) boldChars += len
            }
          }
          if (totalChars === 0) continue

          const avgSize = weightedSize / totalChars
          const isCodeBlock = monoChars / totalChars > 0.75
          const isShortHeadingCandidate = totalChars < 180 && keptLines.length <= 3

          if (isCodeBlock) {
            const codeText = keptLines
              .map((l) => l.spans.map((s) => s.text).join(''))
              .join('\n')
            currentChapter.htmlChunks.push(`<pre><code>${escapeXml(codeText)}</code></pre>`)
            continue
          }

          // Merge lines cleanly with de-hyphenation safeguard
          const lineHtmlParts: string[] = []
          for (let li = 0; li < keptLines.length; li++) {
            const line = keptLines[li]
            const spanHtml = line.spans
              .map((sp) => {
                const escaped = escapeXml(sp.text)
                if (!escaped.trim()) return escaped
                if (sp.bold && sp.italic) return `<strong><em>${escaped}</em></strong>`
                if (sp.bold) return `<strong>${escaped}</strong>`
                if (sp.italic) return `<em>${escaped}</em>`
                return escaped
              })
              .join('')
            lineHtmlParts.push(spanHtml.trim())
          }

          let mergedHtml = ''
          for (let i = 0; i < lineHtmlParts.length; i++) {
            const part = lineHtmlParts[i]
            if (!part) continue
            if (!mergedHtml) {
              mergedHtml = part
            } else if (mergedHtml.endsWith('-') && /^[a-z]/.test(part.replace(/<[^>]+>/g, ''))) {
              mergedHtml = mergedHtml.slice(0, -1) + part
            } else {
              mergedHtml += ' ' + part
            }
          }

          if (!mergedHtml.trim()) continue

          // Classify heading vs paragraph
          const ratio = avgSize / Math.max(8, bodyFontSize)
          if (isShortHeadingCandidate && ratio >= 1.5) {
            currentChapter.htmlChunks.push(`<h1>${mergedHtml}</h1>`)
          } else if (isShortHeadingCandidate && ratio >= 1.24) {
            currentChapter.htmlChunks.push(`<h2>${mergedHtml}</h2>`)
          } else if (isShortHeadingCandidate && (ratio >= 1.1 || (boldChars / totalChars > 0.85 && totalChars < 90))) {
            currentChapter.htmlChunks.push(`<h3>${mergedHtml}</h3>`)
          } else {
            currentChapter.htmlChunks.push(`<p>${mergedHtml}</p>`)
          }
        }
      } finally {
        page.destroy()
      }
    }

    onProgress?.({ currentPage: totalPages, totalPages, stage: 'Packaging EPUB archive...', percent: 95 })

    // Ensure at least one non-empty chapter exists
    const validChapters = chapters.filter((c) => c.htmlChunks.length > 0)
    if (validChapters.length === 0) {
      validChapters.push({
        index: 1,
        title,
        filename: 'chapter_001.xhtml',
        htmlChunks: [`<h1>${escapeXml(title)}</h1>`, `<p>No extractable text found in document.</p>`]
      })
    }

    // Write stylesheet
    zip.file('OEBPS/styles/reflow.css', REFLOW_CSS)

    // Write each chapter XHTML
    for (const ch of validChapters) {
      const xhtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${escapeXml(ch.title)}</title>
  <link rel="stylesheet" type="text/css" href="../styles/reflow.css" />
</head>
<body>
${ch.htmlChunks.join('\n')}
</body>
</html>`
      zip.file(`OEBPS/text/${ch.filename}`, xhtml)
    }

    // Write EPUB 3 Navigation Document (nav.xhtml)
    const navItems = validChapters
      .map((ch) => `      <li><a href="text/${ch.filename}">${escapeXml(ch.title)}</a></li>`)
      .join('\n')
    const navXhtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Table of Contents</title>
</head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>Table of Contents</h1>
    <ol>
${navItems}
    </ol>
  </nav>
</body>
</html>`
    zip.file('OEBPS/nav.xhtml', navXhtml)

    // Write EPUB 2 NCX for universal reader compatibility
    const uid = `urn:uuid:semply-${createHash('sha1').update(`${title}-${Date.now()}`).digest('hex').slice(0, 16)}`
    const ncxPoints = validChapters
      .map(
        (ch, i) => `    <navPoint id="navPoint-${i + 1}" playOrder="${i + 1}">
      <navLabel><text>${escapeXml(ch.title)}</text></navLabel>
      <content src="text/${ch.filename}" />
    </navPoint>`
      )
      .join('\n')
    const tocNcx = `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="${uid}" />
    <meta name="dtb:depth" content="1" />
    <meta name="dtb:totalPageCount" content="${totalPages}" />
    <meta name="dtb:maxPageNumber" content="${totalPages}" />
  </head>
  <docTitle><text>${escapeXml(title)}</text></docTitle>
  <navMap>
${ncxPoints}
  </navMap>
</ncx>`
    zip.file('OEBPS/toc.ncx', tocNcx)

    // Write META-INF/container.xml
    zip.file(
      'META-INF/container.xml',
      `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml" />
  </rootfiles>
</container>`
    )

    // Write OEBPS/content.opf
    const chapterManifest = validChapters
      .map((ch, i) => `    <item id="ch-${i + 1}" href="text/${ch.filename}" media-type="application/xhtml+xml" />`)
      .join('\n')
    const imageManifest = manifestImages
      .map(
        (img) =>
          `    <item id="${img.id}" href="${img.href}" media-type="${img.mediaType}"${
            img.properties ? ` properties="${img.properties}"` : ''
          } />`
      )
      .join('\n')
    const spineItems = validChapters
      .map((_, i) => `    <itemref idref="ch-${i + 1}" />`)
      .join('\n')

    const contentOpf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">${uid}</dc:identifier>
    <dc:title>${escapeXml(title)}</dc:title>
    <dc:creator>${escapeXml(author)}</dc:creator>
    <dc:language>en</dc:language>
    <meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')}</meta>
${hasCover ? '    <meta name="cover" content="cover-image" />' : ''}
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav" />
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml" />
    <item id="css" href="styles/reflow.css" media-type="text/css" />
${chapterManifest}
${imageManifest}
  </manifest>
  <spine toc="ncx">
${spineItems}
  </spine>
</package>`
    zip.file('OEBPS/content.opf', contentOpf)

    if (signal?.aborted) {
      throw new Error('Reflow conversion cancelled by user')
    }

    // Generate EPUB ZIP buffer and persist atomically to prevent partial files on crash
    const epubBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    })
    await writeAtomicBuffer(targetEpubPath, epubBuffer)

    onProgress?.({ currentPage: totalPages, totalPages, stage: 'Conversion complete', percent: 100 })

    return {
      success: true,
      epubPath: targetEpubPath,
      title,
      author,
      pageCount: totalPages,
      imageCount: imageCounter
    }
  } catch (err: any) {
    const isCancelled = Boolean(signal?.aborted || err?.message?.includes('cancelled'))
    return {
      success: false,
      error: isCancelled ? 'Reflow conversion cancelled by user' : err?.message || 'PDF to EPUB conversion failed.',
      cancelled: isCancelled
    }
  } finally {
    try {
      doc.destroy()
    } catch {
      // ignore destroy error
    }
  }
}
