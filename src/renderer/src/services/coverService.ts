import JSZip from 'jszip'
import * as pdfjsLib from 'pdfjs-dist'

// Set up pdf.js worker URL
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`
}

/**
 * Extracts embedded cover image from an EPUB ArrayBuffer or file.
 */
export async function extractEpubCover(data: ArrayBuffer): Promise<string | null> {
  try {
    const zip = await JSZip.loadAsync(data)

    // 1. Locate container.xml to find root OPF file path
    const containerXml = await zip.file('META-INF/container.xml')?.async('string')
    if (!containerXml) return null

    const parser = new DOMParser()
    const containerDoc = parser.parseFromString(containerXml, 'application/xml')
    const rootfileElem = containerDoc.querySelector('rootfile')
    const opfPath = rootfileElem?.getAttribute('full-path') || 'OEBPS/package.opf'

    const opfDir = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/') + 1) : ''
    const opfXml = await zip.file(opfPath)?.async('string')
    if (!opfXml) return null

    const opfDoc = parser.parseFromString(opfXml, 'application/xml')

    // 2. Search for cover-image item in manifest
    let coverHref: string | null = null

    // Check properties="cover-image"
    const coverPropElem = opfDoc.querySelector('item[properties~="cover-image"]')
    if (coverPropElem) {
      coverHref = coverPropElem.getAttribute('href')
    }

    // Check meta name="cover"
    if (!coverHref) {
      const metaCoverElem = opfDoc.querySelector('meta[name="cover"]')
      const coverId = metaCoverElem?.getAttribute('content')
      if (coverId) {
        const itemElem = opfDoc.querySelector(`item[id="${coverId}"]`)
        coverHref = itemElem?.getAttribute('href') || null
      }
    }

    // Check id="cover" or id="cover-image"
    if (!coverHref) {
      const coverIdElem = opfDoc.querySelector('item[id="cover"], item[id="cover-image"], item[id="cover_image"]')
      coverHref = coverIdElem?.getAttribute('href') || null
    }

    // Check any image item with "cover" in href or filename
    if (!coverHref) {
      const items = Array.from(opfDoc.querySelectorAll('item[media-type^="image/"]'))
      for (const item of items) {
        const href = item.getAttribute('href') || ''
        if (href.toLowerCase().includes('cover')) {
          coverHref = href
          break
        }
      }
    }

    if (!coverHref) return null

    // Resolve relative path
    const fullCoverPath = opfDir + coverHref
    const coverFile = zip.file(fullCoverPath) || zip.file(coverHref)
    if (!coverFile) return null

    const coverBuffer = await coverFile.async('arraybuffer')
    const mime = coverHref.endsWith('.png') ? 'image/png' : 'image/jpeg'
    const base64 = arrayBufferToBase64(coverBuffer)
    return `data:${mime};base64,${base64}`
  } catch (err) {
    console.warn('Failed to extract EPUB cover:', err)
    return null
  }
}

/**
 * Renders the first page of a PDF file to a base64 JPEG thumbnail.
 */
export async function extractPdfCover(data: ArrayBuffer): Promise<string | null> {
  try {
    const loadingTask = pdfjsLib.getDocument({ data })
    const pdf = await loadingTask.promise
    if (pdf.numPages === 0) return null

    const page = await pdf.getPage(1)
    const viewport = page.getViewport({ scale: 0.8 })

    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    if (!context) return null

    canvas.width = viewport.width
    canvas.height = viewport.height

    await page.render({
      canvasContext: context,
      viewport: viewport
    }).promise

    return canvas.toDataURL('image/jpeg', 0.85)
  } catch (err) {
    console.warn('Failed to render PDF thumbnail:', err)
    return null
  }
}

/**
 * Generates an authentic fallback book thumbnail canvas.
 */
export function generateCoverCanvas(title: string, author: string): string {
  const canvas = document.createElement('canvas')
  canvas.width = 300
  canvas.height = 420
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''

  // Dark slate gradient
  const grad = ctx.createLinearGradient(0, 0, 300, 420)
  grad.addColorStop(0, '#232834')
  grad.addColorStop(1, '#151820')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 300, 420)

  // Border
  ctx.strokeStyle = '#3c404d'
  ctx.lineWidth = 2
  ctx.strokeRect(4, 4, 292, 412)

  // Inner decorative border
  ctx.strokeStyle = '#2b2f3a'
  ctx.lineWidth = 1
  ctx.strokeRect(14, 14, 272, 392)

  // Spine hint
  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)'
  ctx.fillRect(4, 4, 16, 412)

  // Title
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 20px "Segoe UI", sans-serif'
  ctx.textAlign = 'center'
  wrapText(ctx, title, 150, 160, 240, 26)

  // Author
  ctx.fillStyle = '#8b949e'
  ctx.font = '14px "Segoe UI", sans-serif'
  ctx.fillText(author || 'Unknown Author', 150, 290)

  return canvas.toDataURL('image/jpeg', 0.85)
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
) {
  const words = text.split(' ')
  let line = ''
  let currentY = y

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' '
    const metrics = ctx.measureText(testLine)
    const testWidth = metrics.width
    if (testWidth > maxWidth && n > 0) {
      ctx.fillText(line.trim(), x, currentY)
      line = words[n] + ' '
      currentY += lineHeight
    } else {
      line = testLine
    }
  }
  ctx.fillText(line.trim(), x, currentY)
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = ''
  const bytes = new Uint8Array(buffer)
  const len = bytes.byteLength
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return window.btoa(binary)
}
