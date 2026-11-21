import { access, lstat, readFile, stat } from 'fs/promises'
import { constants as fsConstants, existsSync } from 'fs'
import { extname, resolve } from 'path'
import JSZip from 'jszip'
import {
  normalizeTags,
  type BookMetadataFields,
  type CheckBookWritableResult,
  type WriteBookMetadataResult
} from '../shared/bookMetadata'

const MAX_EDITABLE_FILE_SIZE = 250 * 1024 * 1024 // 250 MB ceiling
const MAX_COVER_IMAGE_BYTES = 10 * 1024 * 1024 // 10 MB ceiling for embedded cover image
const MAX_EPUB_ZIP_ENTRIES = 10000 // Guard against Zip Bomb entry floods
const MAX_EPUB_UNCOMPRESSED_BYTES = 500 * 1024 * 1024 // 500 MB cumulative decompression ceiling
const MAX_EPUB_XML_ENTRY_BYTES = 20 * 1024 * 1024 // 20 MB per XML/XHTML entry ceiling

/**
 * Streams a JSZip entry with a hard uncompressed byte ceiling so a single zip-bomb entry
 * aborts before exhausting RAM.
 */
async function readZipEntryBounded(entry: JSZip.JSZipObject, maxBytes: number): Promise<Uint8Array> {
  const declared = (entry as any)?._data?.uncompressedSize
  if (typeof declared === 'number' && declared > maxBytes) {
    throw new Error('EPUB archive entry exceeds safe decompressed size limit.')
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
          reject(new Error('EPUB archive entry exceeds safe decompressed size limit.'))
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

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
}

function normalizeZipPath(baseDir: string, relHref: string): string {
  const cleanHref = relHref.split('#')[0].split('?')[0].trim()
  let decoded = cleanHref
  try {
    decoded = decodeURIComponent(cleanHref)
  } catch {
    // Keep raw href when percent-encoding is malformed
  }
  const combined = decoded.startsWith('/') ? decoded.slice(1) : baseDir + decoded
  const parts = combined.split('/')
  const stack: string[] = []
  for (const part of parts) {
    if (!part || part === '.') continue
    if (part === '..') stack.pop()
    else stack.push(part)
  }
  return stack.join('/')
}

function findZipEntryKey(zip: JSZip, baseDir: string, href: string): string | null {
  const normalized = normalizeZipPath(baseDir, href)
  if (zip.files[normalized] && !zip.files[normalized].dir) return normalized
  if (zip.files[href] && !zip.files[href].dir) return href
  const combined = baseDir + href
  if (zip.files[combined] && !zip.files[combined].dir) return combined
  const targetLower = normalized.toLowerCase()
  const match = Object.keys(zip.files).find(
    (name) => name.toLowerCase() === targetLower && !zip.files[name].dir
  )
  return match || null
}

function parseDataUrlImage(
  dataUrl: string | null
): { mime: string; ext: string; bytes: Uint8Array } | null {
  if (!dataUrl || typeof dataUrl !== 'string') return null
  const match = dataUrl.trim().match(/^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=]+)$/i)
  if (!match) return null
  const rawSubtype = match[1].toLowerCase()
  const mime = rawSubtype === 'jpg' ? 'image/jpeg' : `image/${rawSubtype}`
  const ext = rawSubtype === 'png' ? 'png' : rawSubtype === 'webp' ? 'webp' : 'jpg'
  const buf = Buffer.from(match[2], 'base64')
  if (buf.byteLength < 64 || buf.byteLength > MAX_COVER_IMAGE_BYTES) return null
  return { mime, ext, bytes: new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength) }
}

function parseXmlAttr(tag: string, attrName: string): string | null {
  const re = new RegExp(`\\b${attrName}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i')
  const m = tag.match(re)
  return m ? (m[1] ?? m[2] ?? '') : null
}

function replaceOrAddXmlAttr(tag: string, attrName: string, value: string): string {
  const escaped = escapeXml(value)
  const re = new RegExp(`(\\b${attrName}\\s*=\\s*)(?:"[^"]*"|'[^']*')`, 'i')
  if (re.test(tag)) {
    return tag.replace(re, `$1"${escaped}"`)
  }
  return tag.replace(/(\s*\/?>)$/, ` ${attrName}="${escaped}"$1`)
}

function formatCurrentPdfDate(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `D:${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}` +
    `${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`
  )
}

/**
 * Checks whether a book file path points to a real, local, writable .epub or .pdf file.
 */
export async function checkBookFileWritable(
  rawFilePath: string,
  assertSafePath: (p: string, mode: 'read' | 'write') => string
): Promise<CheckBookWritableResult> {
  if (!rawFilePath || typeof rawFilePath !== 'string') {
    return { writable: false, reason: 'No local file path' }
  }
  if (/^(https?:|data:|blob:|\/assets\/|assets\/)/i.test(rawFilePath.trim())) {
    return { writable: false, reason: 'Bundled sample book — saved to Semply library only' }
  }
  try {
    const safePath = assertSafePath(rawFilePath, 'read')
    const ext = extname(safePath).toLowerCase()
    if (ext !== '.epub' && ext !== '.pdf') {
      return { writable: false, reason: `Direct file write-back is supported for EPUB and PDF only` }
    }
    if (!existsSync(safePath)) {
      return { writable: false, reason: 'Source file not found on disk' }
    }
    // Check lstat on the user-supplied path (post-assertSafePath validation) so symlinks are refused cleanly
    const rawResolved = resolve(rawFilePath)
    if (existsSync(rawResolved) && (await lstat(rawResolved)).isSymbolicLink()) {
      return { writable: false, reason: 'Direct file write-back is disabled for symbolic links' }
    }
    await access(safePath, fsConstants.W_OK)
    return { writable: true }
  } catch (err: any) {
    return { writable: false, reason: err?.message || 'File is read-only or restricted' }
  }
}

/**
 * Surgically updates OPF <metadata> (and optionally cover image in <manifest>)
 * while preserving namespaces, <spine>, <guide>, and unknown <meta> entries.
 */
function updateOpfXml(
  opfXml: string,
  payload: BookMetadataFields,
  coverUpdate: {
    action: 'replace-existing'
    existingTag: string
    updatedTag: string
  } | {
    action: 'add-new'
    itemId: string
    href: string
    mime: string
  } | null
): string {
  let xml = opfXml

  // Detect unique-identifier attribute on <package> so we never orphan it
  const packageTagMatch = xml.match(/<package\b[^>]*>/i)
  const uniqueIdAttr = packageTagMatch ? parseXmlAttr(packageTagMatch[0], 'unique-identifier') : null

  // Locate <metadata> block (supports optional namespace prefix such as opf:metadata)
  const metaRegex = /<([a-zA-Z0-9_-]+:)?metadata(\b[^>]*)>([\s\S]*?)<\/\1metadata>/i
  const metaMatch = xml.match(metaRegex)
  if (!metaMatch) {
    throw new Error('EPUB OPF file is missing a <metadata> section.')
  }

  const metaPrefix = metaMatch[1] || ''
  let metaAttrs = metaMatch[2] || ''
  let metaBody = metaMatch[3] || ''

  // Ensure Dublin Core namespace is declared on either <package> or <metadata>
  const hasDcNs =
    /\bxmlns:dc\s*=/i.test(packageTagMatch?.[0] || '') || /\bxmlns:dc\s*=/i.test(metaAttrs)
  if (!hasDcNs) {
    metaAttrs += ' xmlns:dc="http://purl.org/dc/elements/1.1/"'
  }

  // Helper to replace or insert a single Dublin Core element inside <metadata>
  const upsertSingleDcElement = (
    localName: string,
    newValue: string,
    preserveUniqueId = false
  ) => {
    const trimmed = newValue.trim()
    const tagRe = new RegExp(
      `<([a-zA-Z0-9_-]+:)?${localName}(\\b[^>]*)>[\\s\\S]*?<\\/\\1${localName}>`,
      'gi'
    )
    const matches = Array.from(metaBody.matchAll(tagRe))

    if (!trimmed) {
      // Remove elements unless preserving required unique-identifier
      if (preserveUniqueId && uniqueIdAttr) {
        metaBody = metaBody.replace(tagRe, (full, _pfx, attrs) => {
          const id = parseXmlAttr(`<x${attrs}>`, 'id')
          return id === uniqueIdAttr ? full : ''
        })
      } else {
        metaBody = metaBody.replace(tagRe, '')
      }
      return
    }

    if (matches.length > 0) {
      let replaced = false
      metaBody = metaBody.replace(tagRe, (full, pfx, attrs) => {
        const id = parseXmlAttr(`<x${attrs}>`, 'id')
        if (preserveUniqueId && uniqueIdAttr) {
          if (id === uniqueIdAttr) {
            replaced = true
            return `<${pfx || 'dc:'}${localName}${attrs}>${escapeXml(trimmed)}</${pfx || 'dc:'}${localName}>`
          }
          return full
        }
        if (!replaced) {
          replaced = true
          return `<${pfx || 'dc:'}${localName}${attrs}>${escapeXml(trimmed)}</${pfx || 'dc:'}${localName}>`
        }
        return ''
      })
      if (!replaced) {
        metaBody += `\n    <dc:${localName}>${escapeXml(trimmed)}</dc:${localName}>`
      }
    } else {
      metaBody += `\n    <dc:${localName}>${escapeXml(trimmed)}</dc:${localName}>`
    }
  }

  upsertSingleDcElement('title', payload.title || 'Untitled Book')
  upsertSingleDcElement('creator', payload.author)
  upsertSingleDcElement('description', payload.description)
  upsertSingleDcElement('publisher', payload.publisher)
  upsertSingleDcElement('date', payload.publishedDate)

  // Mandatory Dublin Core element: W3C/IDPF EPUB specifications strictly require <dc:language>.
  // If payload.language is provided, apply it. If empty or cleared, preserve existing or fallback to 'en'.
  const existingLangMatch = metaBody.match(
    /<([a-zA-Z0-9_-]+:)?language(\b[^>]*)>([\s\S]*?)<\/\1language>/i
  )
  const existingLanguage = existingLangMatch?.[3]?.trim()
  const safeLanguage = (payload.language && payload.language.trim()) || existingLanguage || 'en'
  upsertSingleDcElement('language', safeLanguage)

  upsertSingleDcElement('identifier', payload.identifier, true)
  upsertSingleDcElement('rights', payload.rights)

  // Replace all <dc:subject> tags with normalized tags
  const subjectRe = /<([a-zA-Z0-9_-]+:)?subject(\b[^>]*)>[\s\S]*?<\/\1subject>\s*/gi
  metaBody = metaBody.replace(subjectRe, '')
  const cleanTags = normalizeTags(payload.tags)
  if (cleanTags.length > 0) {
    const subjectLines = cleanTags
      .map((tag) => `    <dc:subject>${escapeXml(tag)}</dc:subject>`)
      .join('\n')
    metaBody += `\n${subjectLines}`
  }

  // Replace series metadata (EPUB 3 belongs-to-collection + EPUB 2 calibre:series)
  metaBody = metaBody
    .replace(/<meta\b[^>]*\bname\s*=\s*["']calibre:series(?:_index)?["'][^>]*\/?>\s*/gi, '')
    .replace(
      /<meta\b[^>]*\bproperty\s*=\s*["']belongs-to-collection["'][^>]*>[\s\S]*?<\/meta>\s*/gi,
      ''
    )
    .replace(
      /<meta\b[^>]*\brefines\s*=\s*["']#semply-series["'][^>]*>[\s\S]*?<\/meta>\s*/gi,
      ''
    )

  const cleanSeries = payload.series.trim()
  const cleanSeriesIndex = payload.seriesIndex.trim()
  if (cleanSeries) {
    metaBody += `\n    <meta property="belongs-to-collection" id="semply-series">${escapeXml(cleanSeries)}</meta>`
    metaBody += `\n    <meta refines="#semply-series" property="collection-type">series</meta>`
    metaBody += `\n    <meta name="calibre:series" content="${escapeXml(cleanSeries)}"/>`
    if (cleanSeriesIndex) {
      metaBody += `\n    <meta refines="#semply-series" property="group-position">${escapeXml(cleanSeriesIndex)}</meta>`
      metaBody += `\n    <meta name="calibre:series_index" content="${escapeXml(cleanSeriesIndex)}"/>`
    }
  }

  // If adding a brand-new cover item, register EPUB 2 <meta name="cover">
  if (coverUpdate?.action === 'add-new') {
    metaBody = metaBody.replace(/<meta\b[^>]*\bname\s*=\s*["']cover["'][^>]*\/?>\s*/gi, '')
    metaBody += `\n    <meta name="cover" content="${escapeXml(coverUpdate.itemId)}"/>`
  }

  // Clean up excessive blank lines inside <metadata>
  metaBody = metaBody.replace(/\n{3,}/g, '\n\n')
  const updatedMetadataBlock = `<${metaPrefix}metadata${metaAttrs}>${metaBody}\n  </${metaPrefix}metadata>`
  xml = xml.replace(metaRegex, () => updatedMetadataBlock)

  // Update <manifest> if cover image was modified or inserted
  if (coverUpdate?.action === 'replace-existing') {
    xml = xml.replace(coverUpdate.existingTag, () => coverUpdate.updatedTag)
  } else if (coverUpdate?.action === 'add-new') {
    const manifestCloseRe = /<\/([a-zA-Z0-9_-]+:)?manifest>/i
    const newItem = `    <item id="${escapeXml(coverUpdate.itemId)}" href="${escapeXml(coverUpdate.href)}" media-type="${escapeXml(coverUpdate.mime)}" properties="cover-image"/>\n  `
    xml = xml.replace(manifestCloseRe, (m) => `${newItem}${m}`)
  }

  return xml
}

/**
 * Updates metadata (and optionally cover art) inside a local EPUB archive atomically.
 * Guarantees EPUB spec compliance with uncompressed `mimetype` as the first entry.
 */
async function writeEpubMetadata(
  safePath: string,
  payload: BookMetadataFields,
  updateCover: boolean,
  writeAtomic: (targetPath: string, data: string | Buffer) => Promise<void>
): Promise<WriteBookMetadataResult> {
  const originalBuf = await readFile(safePath)
  const sourceZip = await JSZip.loadAsync(originalBuf)

  const entryList = Object.entries(sourceZip.files)
  if (entryList.length > MAX_EPUB_ZIP_ENTRIES) {
    return { success: false, error: 'EPUB archive exceeds maximum safe entry count.' }
  }

  // Locate OPF path
  let opfPath: string | null = null
  const containerEntry = sourceZip.file('META-INF/container.xml')
  if (containerEntry) {
    const containerBytes = await readZipEntryBounded(containerEntry, MAX_EPUB_XML_ENTRY_BYTES)
    const containerXml = Buffer.from(containerBytes).toString('utf-8')
    const rootMatch = containerXml.match(/<rootfile\b[^>]*\bfull-path\s*=\s*(?:"([^"]+)"|'([^']+)')/i)
    opfPath = rootMatch ? (rootMatch[1] || rootMatch[2] || null) : null
  }
  if (!opfPath) {
    opfPath = Object.keys(sourceZip.files).find((f) => f.toLowerCase().endsWith('.opf')) || null
  }
  if (!opfPath) {
    return { success: false, error: 'Could not locate OPF package file inside EPUB.' }
  }

  const resolvedOpfKey = findZipEntryKey(sourceZip, '', opfPath)
  if (!resolvedOpfKey) {
    return { success: false, error: 'OPF package entry referenced by container.xml was not found.' }
  }
  const opfDir = resolvedOpfKey.includes('/')
    ? resolvedOpfKey.substring(0, resolvedOpfKey.lastIndexOf('/') + 1)
    : ''
  const opfBytes = await readZipEntryBounded(sourceZip.files[resolvedOpfKey], MAX_EPUB_XML_ENTRY_BYTES)
  const opfXml = Buffer.from(opfBytes).toString('utf-8')

  // Optional cover replacement logic
  let coverWritten = false
  let coverZipEntryKeyToWrite: string | null = null
  let coverZipEntryKeyToRemove: string | null = null
  let coverBytesToWrite: Uint8Array | null = null
  let coverXmlUpdate:
    | { action: 'replace-existing'; existingTag: string; updatedTag: string }
    | { action: 'add-new'; itemId: string; href: string; mime: string }
    | null = null

  if (updateCover && payload.coverDataUrl) {
    const parsedImg = parseDataUrlImage(payload.coverDataUrl)
    if (parsedImg) {
      const itemTags = opfXml.match(/<item\b[^>]*\/?>/gi) || []

      // 1. EPUB 3 properties="cover-image"
      let coverItemTag = itemTags.find((tag) => {
        const props = parseXmlAttr(tag, 'properties') || ''
        return props.split(/\s+/).includes('cover-image')
      })

      // 2. EPUB 2 <meta name="cover" content="id-or-href">
      if (!coverItemTag) {
        const metaCoverMatch = opfXml.match(/<meta\b[^>]*\bname\s*=\s*["']cover["'][^>]*\/?>/i)
        const coverVal = metaCoverMatch ? parseXmlAttr(metaCoverMatch[0], 'content') : null
        if (coverVal) {
          coverItemTag = itemTags.find((tag) => {
            const id = parseXmlAttr(tag, 'id')
            const href = parseXmlAttr(tag, 'href') || ''
            const mt = (parseXmlAttr(tag, 'media-type') || '').toLowerCase()
            return (
              mt.startsWith('image/') &&
              (id === coverVal || href === coverVal || href.endsWith('/' + coverVal))
            )
          })
        }
      }

      // 3. Fallback: manifest image item with cover-like id
      if (!coverItemTag) {
        coverItemTag = itemTags.find((tag) => {
          const id = (parseXmlAttr(tag, 'id') || '').toLowerCase()
          const mt = (parseXmlAttr(tag, 'media-type') || '').toLowerCase()
          return (
            (id === 'cover' || id === 'cover-image' || id === 'cover_image' || id === 'coverimage') &&
            mt.startsWith('image/')
          )
        })
      }

      if (coverItemTag) {
        const existingHref = parseXmlAttr(coverItemTag, 'href')
        if (existingHref) {
          const existingZipKey = findZipEntryKey(sourceZip, opfDir, existingHref)
          const newHref = existingHref.replace(/\.[^/.]+$/, `.${parsedImg.ext}`)
          const targetHref = newHref === existingHref ? existingHref : newHref
          const targetZipKey = normalizeZipPath(opfDir, targetHref)

          let updatedTag = replaceOrAddXmlAttr(coverItemTag, 'media-type', parsedImg.mime)
          if (targetHref !== existingHref) {
            updatedTag = replaceOrAddXmlAttr(updatedTag, 'href', targetHref)
            if (existingZipKey && existingZipKey !== targetZipKey) {
              coverZipEntryKeyToRemove = existingZipKey
            }
          }
          coverXmlUpdate = {
            action: 'replace-existing',
            existingTag: coverItemTag,
            updatedTag
          }
          coverZipEntryKeyToWrite = targetZipKey
          coverBytesToWrite = parsedImg.bytes
          coverWritten = true
        }
      } else {
        const newHref = `semply-cover.${parsedImg.ext}`
        coverXmlUpdate = {
          action: 'add-new',
          itemId: 'semply-cover-image',
          href: newHref,
          mime: parsedImg.mime
        }
        coverZipEntryKeyToWrite = normalizeZipPath(opfDir, newHref)
        coverBytesToWrite = parsedImg.bytes
        coverWritten = true
      }
    }
  }

  const nextOpfXml = updateOpfXml(opfXml, payload, coverXmlUpdate)

  // Rebuild EPUB archive with uncompressed `mimetype` as entry #1
  const outZip = new JSZip()
  outZip.file('mimetype', 'application/epub+zip', { compression: 'STORE' })

  const oldCoverBase =
    coverZipEntryKeyToRemove ? coverZipEntryKeyToRemove.split('/').pop() || null : null
  const newCoverBase =
    coverZipEntryKeyToWrite ? coverZipEntryKeyToWrite.split('/').pop() || null : null

  let cumulativeBytes = 0
  const trackBytes = (byteLen: number) => {
    cumulativeBytes += byteLen
    if (cumulativeBytes > MAX_EPUB_UNCOMPRESSED_BYTES) {
      throw new Error('EPUB archive exceeds safe decompressed size limit (500 MB).')
    }
  }

  for (const [entryName, entryObj] of entryList) {
    if (entryObj.dir) continue
    if (entryName === 'mimetype') continue
    if (coverZipEntryKeyToRemove && entryName === coverZipEntryKeyToRemove) continue

    if (entryName === resolvedOpfKey) {
      trackBytes(Buffer.byteLength(nextOpfXml, 'utf-8'))
      outZip.file(entryName, nextOpfXml, { compression: 'DEFLATE' })
    } else if (coverZipEntryKeyToWrite && entryName === coverZipEntryKeyToWrite && coverBytesToWrite) {
      trackBytes(coverBytesToWrite.byteLength)
      outZip.file(entryName, coverBytesToWrite, { compression: 'DEFLATE' })
    } else if (
      oldCoverBase &&
      newCoverBase &&
      oldCoverBase !== newCoverBase &&
      /\.(x?html?|htm|svg)$/i.test(entryName)
    ) {
      // Keep any cover wrapper XHTML/SVG in sync if the cover image extension changed
      const remaining = Math.max(0, MAX_EPUB_UNCOMPRESSED_BYTES - cumulativeBytes)
      const entryBytes = await readZipEntryBounded(entryObj, Math.min(MAX_EPUB_XML_ENTRY_BYTES, remaining))
      trackBytes(entryBytes.byteLength)
      const text = Buffer.from(entryBytes).toString('utf-8')
      const patched = text.includes(oldCoverBase)
        ? text.split(oldCoverBase).join(newCoverBase)
        : text
      outZip.file(entryName, patched, { compression: 'DEFLATE' })
    } else {
      const remaining = Math.max(0, MAX_EPUB_UNCOMPRESSED_BYTES - cumulativeBytes)
      const rawBytes = await readZipEntryBounded(entryObj, remaining)
      trackBytes(rawBytes.byteLength)
      outZip.file(entryName, rawBytes, { compression: 'DEFLATE' })
    }
  }

  // If cover is a newly added file (not replacing an existing zip entry name), add it now
  if (
    coverZipEntryKeyToWrite &&
    coverBytesToWrite &&
    !outZip.files[coverZipEntryKeyToWrite]
  ) {
    outZip.file(coverZipEntryKeyToWrite, coverBytesToWrite, { compression: 'DEFLATE' })
  }

  const outNodeBuffer = await outZip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  })

  await writeAtomic(safePath, outNodeBuffer)
  return {
    success: true,
    fileSize: outNodeBuffer.byteLength,
    coverWritten
  }
}

/**
 * Updates embedded PDF Info dictionary metadata atomically using Artifex MuPDF WASM.
 * Never alters document pages; custom cover art remains stored in Semply's library DB.
 */
async function writePdfMetadata(
  safePath: string,
  payload: BookMetadataFields,
  updateCover: boolean,
  writeAtomic: (targetPath: string, data: string | Buffer) => Promise<void>
): Promise<WriteBookMetadataResult> {
  const mupdf: any = await import('mupdf')
  const pdfBytes = await readFile(safePath)

  let doc: any = null
  let outBuf: any = null
  try {
    doc = mupdf.Document.openDocument(pdfBytes, 'application/pdf')
    if (doc.needsPassword()) {
      return {
        success: false,
        error: 'Cannot write metadata to a password-protected PDF file.'
      }
    }
    const pdfDoc = doc.asPDF()
    if (!pdfDoc) {
      return { success: false, error: 'File is not a valid PDF document.' }
    }

    const cleanTags = normalizeTags(payload.tags)
    pdfDoc.setMetaData('info:Title', payload.title.trim())
    pdfDoc.setMetaData('info:Author', payload.author.trim())
    pdfDoc.setMetaData('info:Subject', (payload.subject || payload.description || '').trim())
    pdfDoc.setMetaData('info:Keywords', cleanTags.join(', '))
    pdfDoc.setMetaData('info:ModDate', formatCurrentPdfDate())

    const saveOpts = pdfDoc.canBeSavedIncrementally?.()
      ? 'incremental'
      : 'garbage=compact,compress'
    outBuf = pdfDoc.saveToBuffer(saveOpts)
    const uint8 = outBuf.asUint8Array()
    // Copy bytes into an independent Node Buffer before freeing WASM buffer
    const nodeBuf = Buffer.from(uint8.slice())

    await writeAtomic(safePath, nodeBuf)
    return {
      success: true,
      fileSize: nodeBuf.byteLength,
      coverWritten: false,
      warning: updateCover
        ? 'PDF metadata saved to file; custom thumbnail is stored in Semply library.'
        : undefined
    }
  } finally {
    try {
      outBuf?.destroy?.()
    } catch {
      // ignore WASM cleanup errors
    }
    try {
      doc?.destroy?.()
    } catch {
      // ignore WASM cleanup errors
    }
  }
}

/**
 * Unified main-process entry point for writing EPUB or PDF metadata atomically to disk.
 */
export async function writeBookMetadataToFile(
  rawFilePath: string,
  format: 'epub' | 'pdf',
  payload: BookMetadataFields,
  updateCover: boolean,
  assertSafePath: (p: string, mode: 'read' | 'write') => string,
  writeAtomic: (targetPath: string, data: string | Buffer) => Promise<void>
): Promise<WriteBookMetadataResult> {
  try {
    const safePath = assertSafePath(rawFilePath, 'read')
    const ext = extname(safePath).toLowerCase()
    if (ext !== '.epub' && ext !== '.pdf') {
      return {
        success: false,
        error: `Writing metadata is only supported for .epub and .pdf files (got '${ext}').`
      }
    }
    if (!existsSync(safePath)) {
      return { success: false, error: 'Book file no longer exists on disk.' }
    }
    const rawResolved = resolve(rawFilePath)
    if (existsSync(rawResolved) && (await lstat(rawResolved)).isSymbolicLink()) {
      return { success: false, error: 'Refusing to write metadata directly through a symbolic link.' }
    }
    const st = await stat(safePath)
    if (st.size > MAX_EDITABLE_FILE_SIZE) {
      return {
        success: false,
        error: 'File exceeds the 250 MB safety limit for in-place metadata editing.'
      }
    }
    await access(safePath, fsConstants.W_OK)

    if (ext === '.epub' || format === 'epub') {
      return await writeEpubMetadata(safePath, payload, updateCover, writeAtomic)
    }
    return await writePdfMetadata(safePath, payload, updateCover, writeAtomic)
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Failed to write metadata to file.'
    }
  }
}
