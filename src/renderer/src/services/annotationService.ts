import type { Book as EpubBook, Rendition } from 'epubjs'
import { db, type Annotation, type Book, type IceRangeAnchor, type NoteColor, type UserSettings } from '../db'

export interface NoteColorMeta {
  id: NoteColor
  label: string
  hex: string
  darkHex: string
  borderHex: string
  isUnderline?: boolean
}

// Authentic Icecream Ebook Reader note palette (extracted from icebookreader.exe styles.css)
export const ICE_NOTE_COLORS: Record<NoteColor, NoteColorMeta> = {
  yellow: {
    id: 'yellow',
    label: 'Yellow',
    hex: '#f3e3a2',
    darkHex: '#f5d76e',
    borderHex: '#d4b84a'
  },
  blue: {
    id: 'blue',
    label: 'Blue',
    hex: '#aed9f1',
    darkHex: '#6cbcf0',
    borderHex: '#4f9fd6'
  },
  green: {
    id: 'green',
    label: 'Green',
    hex: '#b1f3a4',
    darkHex: '#6ee787',
    borderHex: '#4ec968'
  },
  purple: {
    id: 'purple',
    label: 'Purple',
    hex: '#ccb8e4',
    darkHex: '#b894f6',
    borderHex: '#9872d8'
  },
  red: {
    id: 'red',
    label: 'Red',
    hex: '#f3a2a2',
    darkHex: '#f47c7c',
    borderHex: '#d95b5b'
  },
  underline: {
    id: 'underline',
    label: 'Underline',
    hex: '#79c0ff',
    darkHex: '#79c0ff',
    borderHex: '#2a69df',
    isUnderline: true
  }
}

export const ICE_NOTE_COLOR_LIST: NoteColorMeta[] = [
  ICE_NOTE_COLORS.yellow,
  ICE_NOTE_COLORS.blue,
  ICE_NOTE_COLORS.green,
  ICE_NOTE_COLORS.purple,
  ICE_NOTE_COLORS.red,
  ICE_NOTE_COLORS.underline
]

/**
 * Returns theme-aware SVG attributes for epub.js marks-pane overlays.
 * Fixes the dark-mode invisibility bug caused by epub.js's default
 * `{ fill: 'yellow', 'fill-opacity': '0.3', 'mix-blend-mode': 'multiply' }`.
 */
export function getSvgAnnotationStyle(
  color: NoteColor,
  theme: UserSettings['theme'],
  hasComment = false
): Record<string, string> {
  const isDark = theme === 'night' || theme === 'dark-sepia'
  const meta = ICE_NOTE_COLORS[color] || ICE_NOTE_COLORS.yellow

  if (color === 'underline') {
    return {
      stroke: isDark ? '#79c0ff' : '#2a69df',
      'stroke-opacity': hasComment ? '1' : '0.85',
      'stroke-width': hasComment ? '2.5px' : '2px',
      'mix-blend-mode': 'normal',
      cursor: 'pointer'
    }
  }

  if (isDark) {
    // On dark backgrounds (#1c1f26 / #2d261e), multiply makes pastel ink black.
    // Screen blend with tuned opacity keeps light serif text crisp and readable.
    return {
      fill: meta.darkHex,
      'fill-opacity': hasComment ? '0.38' : '0.28',
      'mix-blend-mode': 'screen',
      ...(hasComment ? { stroke: meta.darkHex, 'stroke-opacity': '0.65', 'stroke-width': '0.8px' } : {}),
      cursor: 'pointer'
    }
  }

  return {
    fill: meta.hex,
    'fill-opacity': hasComment ? '0.58' : '0.45',
    'mix-blend-mode': 'multiply',
    ...(hasComment ? { stroke: meta.borderHex, 'stroke-opacity': '0.6', 'stroke-width': '0.75px' } : {}),
    cursor: 'pointer'
  }
}

/**
 * Direct port of Icecream jsengine.js makeXPath() for durable DOM anchoring.
 */
export function makeXPath(node: Node | null, doc: Document): string {
  if (!node) return ''
  let target: Node | null = node
  if (target.nodeType === Node.TEXT_NODE || target.nodeType === Node.CDATA_SECTION_NODE) {
    target = target.parentElement
  }

  const segments: string[] = []
  while (target && target.nodeType === Node.ELEMENT_NODE) {
    const el = target as Element
    let index = 1
    let sibling = el.previousElementSibling
    while (sibling) {
      if (sibling.tagName.toLowerCase() === el.tagName.toLowerCase()) {
        index++
      }
      sibling = sibling.previousElementSibling
    }
    segments.unshift(`${el.tagName.toLowerCase()}[${index}]`)
    target = el.parentNode
    if (target === doc) break
  }

  return segments.length > 0 ? '/' + segments.join('/') : ''
}

/**
 * Direct port of Icecream jsengine.js IceRange(range) for dual-anchor persistence
 * alongside EpubCFI.
 */
export function captureIceRange(range: Range, doc: Document, href?: string): IceRangeAnchor {
  let startOffset = range.startOffset
  let prev = range.startContainer.previousSibling
  while (prev) {
    startOffset += prev.textContent?.length || 0
    prev = prev.previousSibling
  }

  let endOffset = range.endOffset
  prev = range.endContainer.previousSibling
  while (prev) {
    endOffset += prev.textContent?.length || 0
    prev = prev.previousSibling
  }

  return {
    startXPath: makeXPath(range.startContainer, doc),
    startOffset,
    endXPath: makeXPath(range.endContainer, doc),
    endOffset,
    href
  }
}

export function getAnnotationMarkType(color: NoteColor): 'highlight' | 'underline' {
  return color === 'underline' ? 'underline' : 'highlight'
}

/**
 * Removes an annotation mark (both highlight and underline types defensively)
 * from an epub.js Rendition.
 */
export function removeAnnotationFromRendition(
  rendition: Rendition | null,
  cfiRange: string
): void {
  if (!rendition || !cfiRange) return
  try {
    rendition.annotations.remove(cfiRange, 'highlight')
  } catch {
    // Ignore if not registered as highlight
  }
  try {
    rendition.annotations.remove(cfiRange, 'underline')
  } catch {
    // Ignore if not registered as underline
  }
}

/**
 * Applies a single saved Annotation onto an epub.js Rendition with theme-aware
 * SVG styling and click callback so clicking the mark opens the edit popover.
 */
export function applyAnnotationToRendition(
  rendition: Rendition | null,
  annotation: Annotation,
  theme: UserSettings['theme'],
  onMarkClick?: (annotation: Annotation, event: MouseEvent) => void
): void {
  if (!rendition || !annotation.cfiRange) return

  // Remove any stale mark on the same CFI before re-adding (supports live recoloring)
  removeAnnotationFromRendition(rendition, annotation.cfiRange)

  const styles = getSvgAnnotationStyle(annotation.color, theme, Boolean(annotation.note?.trim()))
  const className = `${annotation.color}note`
  const data = {
    annotationId: annotation.id,
    color: annotation.color,
    hasNote: Boolean(annotation.note?.trim())
  }
  const cb = (e: MouseEvent) => {
    e?.stopPropagation?.()
    onMarkClick?.(annotation, e)
  }

  try {
    if (annotation.color === 'underline') {
      rendition.annotations.underline(annotation.cfiRange, data, cb, className, styles)
    } else {
      rendition.annotations.highlight(annotation.cfiRange, data, cb, className, styles)
    }
  } catch (err) {
    console.warn('Failed to attach annotation mark:', annotation.cfiRange, err)
  }
}

/**
 * Hydrates all saved annotations for a book onto the active Rendition.
 */
export function hydrateRenditionAnnotations(
  rendition: Rendition | null,
  annotations: Annotation[],
  theme: UserSettings['theme'],
  onMarkClick?: (annotation: Annotation, event: MouseEvent) => void
): void {
  if (!rendition) return
  for (const ann of annotations) {
    applyAnnotationToRendition(rendition, ann, theme, onMarkClick)
  }
}

/**
 * Direct port of Icecream jsengine.js getFirstVisibleElement() + getBookmarkData().
 * Extracts the first visible sentence/excerpt on the current reading spread plus its XPath.
 */
export function extractVisiblePageData(
  rendition: Rendition | null,
  epubBook: EpubBook | null,
  startCfi?: string,
  endCfi?: string
): { excerpt: string; xpath: string } {
  // Tier 1: Exact text inside visible [startCfi, endCfi] range
  try {
    if (epubBook && startCfi && endCfi) {
      const range = (epubBook as any).getRange?.(startCfi, endCfi) as Range | undefined
      if (range) {
        const cleaned = (range.toString() || '').replace(/\s+/g, ' ').trim()
        if (cleaned.length >= 12) {
          const doc = range.startContainer?.ownerDocument
          const xpath = doc ? makeXPath(range.startContainer, doc) : ''
          return {
            excerpt: truncateExcerpt(cleaned, 150),
            xpath
          }
        }
      }
    }
  } catch {
    // Fall through to DOM visibility scan
  }

  // Tier 2: Icecream NodeIterator visibility scan inside the active iframe
  try {
    const contents = (rendition?.getContents() as any)?.[0]
    const doc: Document | undefined = contents?.document
    const win: Window | undefined = contents?.window
    if (doc && win && doc.body) {
      const scrollLeft = win.scrollX || doc.documentElement.scrollLeft || 0
      const viewWidth = win.innerWidth || doc.documentElement.clientWidth || 800
      const iter = doc.createNodeIterator(doc.body, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          return node.nodeValue && node.nodeValue.trim().length > 2
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_SKIP
        }
      })

      let current: Node | null = iter.nextNode()
      while (current) {
        const range = doc.createRange()
        const len = Math.min(current.nodeValue?.length || 1, 1)
        range.setStart(current, 0)
        range.setEnd(current, len)
        const rect = range.getBoundingClientRect()
        if (rect.width > 0 && rect.height > 0 && rect.left >= -4 && rect.left < viewWidth) {
          const parentText = (current.parentElement?.innerText || current.nodeValue || '')
            .replace(/\s+/g, ' ')
            .trim()
          if (parentText.length > 0) {
            return {
              excerpt: truncateExcerpt(parentText, 150),
              xpath: makeXPath(current, doc)
            }
          }
        }
        // Fallback check if viewport coordinates are scrolled
        if (rect.width > 0 && rect.height > 0 && rect.left >= scrollLeft && rect.left < scrollLeft + viewWidth) {
          const parentText = (current.parentElement?.innerText || current.nodeValue || '')
            .replace(/\s+/g, ' ')
            .trim()
          if (parentText.length > 0) {
            return {
              excerpt: truncateExcerpt(parentText, 150),
              xpath: makeXPath(current, doc)
            }
          }
        }
        current = iter.nextNode()
      }
    }
  } catch {
    // Fall through to empty excerpt
  }

  return { excerpt: '', xpath: '' }
}

function truncateExcerpt(text: string, maxLen: number): string {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (normalized.length <= maxLen) return normalized
  const cut = normalized.slice(0, maxLen)
  const lastSpace = cut.lastIndexOf(' ')
  return (lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trim() + '...'
}

/**
 * Synchronizes the cached notesCount field on the books table
 * (port of Icecream BookModel::updateNotesCount).
 */
export async function syncBookNotesCount(bookId: number): Promise<number> {
  const count = await db.annotations.where('bookId').equals(bookId).count()
  await db.books.update(bookId, { notesCount: count })
  return count
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Exports all book notes and highlights into an Icecream-styled standalone HTML document.
 */
export function exportNotesToHtml(book: Book, annotations: Annotation[]): string {
  const sorted = [...annotations].sort(
    (a, b) => (a.pageNumber || 0) - (b.pageNumber || 0) || a.createdAt - b.createdAt
  )
  const rows = sorted
    .map((ann) => {
      const meta = ICE_NOTE_COLORS[ann.color] || ICE_NOTE_COLORS.yellow
      const badgeStyle = ann.color === 'underline'
        ? 'border-bottom: 2px solid #2a69df; color: #2a69df; background: #eef4ff;'
        : `background: ${meta.hex}; color: #1a1a1a;`
      const pageLabel = ann.pageNumber ? `p.${ann.pageNumber}` : 'Page -'
      const chapter = ann.chapterTitle ? ` &middot; ${escapeHtml(ann.chapterTitle)}` : ''
      const dateStr = new Date(ann.createdAt).toLocaleString()
      const commentHtml = ann.note?.trim()
        ? `<div class="comment"><strong>Note:</strong> ${escapeHtml(ann.note.trim())}</div>`
        : ''
      return `
      <div class="note-card" style="border-left: 4px solid ${meta.borderHex};">
        <div class="meta">
          <span class="tag" style="${badgeStyle}">${escapeHtml(meta.label)}</span>
          <span class="loc">${pageLabel}${chapter}</span>
          <span class="date">${escapeHtml(dateStr)}</span>
        </div>
        <blockquote class="quote">&ldquo;${escapeHtml(ann.text)}&rdquo;</blockquote>
        ${commentHtml}
      </div>`
    })
    .join('\n')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Notes - ${escapeHtml(book.title)}</title>
  <style>
    body { font-family: "Segoe UI", system-ui, -apple-system, sans-serif; background: #f6f7f9; color: #1f2328; max-width: 820px; margin: 32px auto; padding: 0 20px; }
    .header { background: #171a21; color: #e6edf3; padding: 20px 24px; border-radius: 4px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: baseline; }
    .header h1 { margin: 0 0 4px 0; font-size: 20px; }
    .header .author { color: #9da7b3; font-size: 13px; }
    .header .count { font-size: 12px; background: #2a69df; color: #fff; padding: 4px 10px; border-radius: 3px; }
    .note-card { background: #ffffff; border: 1px solid #dfe3e8; border-radius: 4px; padding: 14px 16px; margin-bottom: 12px; }
    .meta { display: flex; align-items: center; gap: 10px; font-size: 12px; color: #57606a; margin-bottom: 8px; }
    .tag { font-size: 11px; font-weight: 600; padding: 2px 7px; border-radius: 2px; }
    .date { margin-left: auto; color: #8b949e; font-size: 11px; }
    .quote { margin: 0; font-family: Georgia, serif; font-size: 14px; line-height: 1.6; color: #1f2328; background: #f8f9fb; padding: 10px 12px; border-radius: 3px; }
    .comment { margin-top: 10px; font-size: 13px; line-height: 1.5; color: #0969da; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>${escapeHtml(book.title)}</h1>
      <div class="author">${escapeHtml(book.author || 'Unknown Author')}</div>
    </div>
    <div class="count">Notes: ${sorted.length}</div>
  </div>
  ${rows || '<p>No notes recorded for this book.</p>'}
</body>
</html>`
}

export function exportNotesToMarkdown(book: Book, annotations: Annotation[]): string {
  const sorted = [...annotations].sort(
    (a, b) => (a.pageNumber || 0) - (b.pageNumber || 0) || a.createdAt - b.createdAt
  )
  const lines: string[] = [
    `# ${book.title}`,
    `**Author:** ${book.author || 'Unknown'}  `,
    `**Notes:** ${sorted.length}`,
    '',
    '---',
    ''
  ]

  for (const ann of sorted) {
    const meta = ICE_NOTE_COLORS[ann.color] || ICE_NOTE_COLORS.yellow
    const loc = [ann.pageNumber ? `p.${ann.pageNumber}` : null, ann.chapterTitle || null]
      .filter(Boolean)
      .join(' - ')
    lines.push(`### [${meta.label}]${loc ? ` ${loc}` : ''}`)
    lines.push(`> ${ann.text.replace(/\n/g, '\n> ')}`)
    if (ann.note?.trim()) {
      lines.push('')
      lines.push(`**Note:** ${ann.note.trim()}`)
    }
    lines.push('')
    lines.push(`*${new Date(ann.createdAt).toLocaleString()}*`)
    lines.push('')
  }

  return lines.join('\n')
}

export function exportNotesToPlainText(book: Book, annotations: Annotation[]): string {
  const sorted = [...annotations].sort(
    (a, b) => (a.pageNumber || 0) - (b.pageNumber || 0) || a.createdAt - b.createdAt
  )
  const header = `${book.title} - ${book.author || 'Unknown'} (${sorted.length} notes)\n${'='.repeat(50)}\n\n`
  const body = sorted
    .map((ann, idx) => {
      const meta = ICE_NOTE_COLORS[ann.color] || ICE_NOTE_COLORS.yellow
      const loc = [ann.pageNumber ? `p.${ann.pageNumber}` : '', ann.chapterTitle || '']
        .filter(Boolean)
        .join(' | ')
      const comment = ann.note?.trim() ? `\nNote: ${ann.note.trim()}` : ''
      return `${idx + 1}. [${meta.label}]${loc ? ` (${loc})` : ''}\n"${ann.text}"${comment}`
    })
    .join('\n\n')
  return header + body
}

export async function downloadTextFile(filename: string, content: string, mimeType: string): Promise<boolean> {
  try {
    if (window.desktopAPI?.showSaveDialog && window.desktopAPI?.writeFileText) {
      const ext = filename.split('.').pop()?.toLowerCase() || 'txt'
      const filterName =
        ext === 'md' ? 'Markdown Document' : ext === 'html' ? 'HTML Document' : 'Plain Text'
      const chosenPath = await window.desktopAPI.showSaveDialog({
        title: 'Export Notes & Highlights',
        defaultPath: filename,
        filters: [{ name: filterName, extensions: [ext] }]
      })
      if (!chosenPath) return false
      await window.desktopAPI.writeFileText(chosenPath, content)
      return true
    }
  } catch {
    // Fall back to browser download when outside Electron
  }

  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return true
}
