import type { Book as EpubBook } from 'epubjs'
import type { TocItem } from '../components/drawers/TOCDrawer'

export interface ResolvedTocTarget {
  spineItem: any | null
  spineHref: string
  spineIndex: number
  hash: string
  displayTarget: string
}

/**
 * Safely decode URI segments without throwing on malformed percent-encoding.
 */
function safeDecodeUri(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

/**
 * Safely find an anchor element by id or name without fragile CSS selector escaping issues.
 */
export function findAnchorElement(doc: Document | null | undefined, hash: string): Element | null {
  if (!doc || !hash) return null
  const byId = doc.getElementById(hash)
  if (byId) return byId
  const escaped =
    typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
      ? CSS.escape(hash)
      : hash.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  try {
    return doc.querySelector(`[name="${escaped}"]`)
  } catch {
    return null
  }
}

/**
 * Normalize an EPUB internal path by resolving `.` / `..` segments, converting backslashes,
 * decoding URI escapes, and stripping leading slashes.
 */
export function normalizeEpubPath(rawPath: string): string {
  const cleaned = safeDecodeUri(String(rawPath || ''))
    .replace(/\\/g, '/')
    .replace(/^\.\/+/, '')
    .replace(/^\/+/, '')

  const parts = cleaned.split('/')
  const resolved: string[] = []
  for (const part of parts) {
    if (!part || part === '.') continue
    if (part === '..') {
      if (resolved.length > 0) resolved.pop()
    } else {
      resolved.push(part)
    }
  }
  return resolved.join('/')
}

/**
 * Split an EPUB href into its normalized path (without query/hash) and fragment identifier.
 */
export function splitHref(rawHref: string): { path: string; hash: string } {
  const str = String(rawHref || '').trim()
  const hashIdx = str.indexOf('#')
  const beforeHash = hashIdx >= 0 ? str.slice(0, hashIdx) : str
  const hash = hashIdx >= 0 ? safeDecodeUri(str.slice(hashIdx + 1)).trim() : ''
  const pathOnly = beforeHash.split('?')[0]
  return {
    path: normalizeEpubPath(pathOnly),
    hash
  }
}

/**
 * Join a base directory path (e.g. directory of toc.ncx or nav.xhtml) with a relative href.
 */
function resolveRelativePath(baseFilePath: string, relativePath: string): string {
  const cleanRel = String(relativePath || '').trim()
  if (!cleanRel) return ''
  if (cleanRel.startsWith('/')) {
    return normalizeEpubPath(cleanRel)
  }
  const cleanBase = normalizeEpubPath(baseFilePath)
  const lastSlash = cleanBase.lastIndexOf('/')
  const baseDir = lastSlash >= 0 ? cleanBase.slice(0, lastSlash + 1) : ''
  return normalizeEpubPath(`${baseDir}${cleanRel}`)
}

function getBasename(normalizedPath: string): string {
  const idx = normalizedPath.lastIndexOf('/')
  return idx >= 0 ? normalizedPath.slice(idx + 1) : normalizedPath
}

function getNavigationBasePath(epub: EpubBook | null | undefined): string {
  const pkg = (epub as any)?.packaging
  if (!pkg) return ''
  return pkg.navPath || pkg.ncxPath || ''
}

/**
 * Resolve any TOC href (relative, ../ prefixed, URL-encoded, or fragment-qualified)
 * to the exact spine item and canonical href expected by epub.js rendition.display().
 */
export function resolveTocHrefToSpine(
  epub: EpubBook | null | undefined,
  rawHref: string
): ResolvedTocTarget {
  const { path: rawPath, hash } = splitHref(rawHref)
  const spineItems: any[] = ((epub?.spine as any)?.spineItems || []).filter(Boolean)

  if (!rawPath || spineItems.length === 0) {
    return {
      spineItem: null,
      spineHref: rawHref,
      spineIndex: -1,
      hash,
      displayTarget: rawHref
    }
  }

  // Build candidate normalized paths: direct normalized + resolved against nav/ncx directory
  const navBase = getNavigationBasePath(epub)
  const candidates = Array.from(
    new Set(
      [
        rawPath,
        navBase ? resolveRelativePath(navBase, rawHref.split('#')[0].split('?')[0]) : ''
      ].filter(Boolean)
    )
  )

  const spineEntries = spineItems.map((item, idx) => ({
    item,
    idx: typeof item.index === 'number' ? item.index : idx,
    normHref: normalizeEpubPath(item.href || ''),
    normUrl: normalizeEpubPath(item.url || '')
  }))

  // Pass 1: Exact normalized path match against spine item href or url
  for (const cand of candidates) {
    const exact = spineEntries.find((s) => s.normHref === cand || s.normUrl === cand)
    if (exact) {
      const displayTarget = hash ? `${exact.item.href}#${hash}` : exact.item.href
      return {
        spineItem: exact.item,
        spineHref: exact.item.href,
        spineIndex: exact.idx,
        hash,
        displayTarget
      }
    }
  }

  // Pass 2: Path-boundary suffix match (handles OEBPS/ or OPS/ prefix differences)
  for (const cand of candidates) {
    const suffixMatch = spineEntries.find(
      (s) =>
        (s.normHref && (s.normHref.endsWith(`/${cand}`) || cand.endsWith(`/${s.normHref}`))) ||
        (s.normUrl && (s.normUrl.endsWith(`/${cand}`) || cand.endsWith(`/${s.normUrl}`)))
    )
    if (suffixMatch) {
      const displayTarget = hash ? `${suffixMatch.item.href}#${hash}` : suffixMatch.item.href
      return {
        spineItem: suffixMatch.item,
        spineHref: suffixMatch.item.href,
        spineIndex: suffixMatch.idx,
        hash,
        displayTarget
      }
    }
  }

  // Pass 3: Case-insensitive normalized path or suffix match
  for (const cand of candidates) {
    const lowerCand = cand.toLowerCase()
    const ciMatch = spineEntries.find((s) => {
      const lowerHref = s.normHref.toLowerCase()
      return (
        lowerHref === lowerCand ||
        lowerHref.endsWith(`/${lowerCand}`) ||
        lowerCand.endsWith(`/${lowerHref}`)
      )
    })
    if (ciMatch) {
      const displayTarget = hash ? `${ciMatch.item.href}#${hash}` : ciMatch.item.href
      return {
        spineItem: ciMatch.item,
        spineHref: ciMatch.item.href,
        spineIndex: ciMatch.idx,
        hash,
        displayTarget
      }
    }
  }

  // Pass 4: Exact filename (basename) match as last resort
  const targetBase = getBasename(rawPath).toLowerCase()
  if (targetBase) {
    const baseMatch = spineEntries.find((s) => getBasename(s.normHref).toLowerCase() === targetBase)
    if (baseMatch) {
      const displayTarget = hash ? `${baseMatch.item.href}#${hash}` : baseMatch.item.href
      return {
        spineItem: baseMatch.item,
        spineHref: baseMatch.item.href,
        spineIndex: baseMatch.idx,
        hash,
        displayTarget
      }
    }
  }

  return {
    spineItem: null,
    spineHref: rawHref,
    spineIndex: -1,
    hash,
    displayTarget: rawHref
  }
}

/**
 * Recursively flatten nested EPUB navigation items (preserving depth) and resolve every
 * chapter href to its canonical spine entry so tapping always jumps accurately.
 */
export function buildResolvedToc(epub: EpubBook | null | undefined, rawToc: any[]): TocItem[] {
  const result: TocItem[] = []
  let seq = 0

  const visit = (nodes: any[], depth: number) => {
    if (!Array.isArray(nodes)) return
    for (const node of nodes) {
      if (!node) continue
      const label = String(node.label || '')
        .replace(/\s+/g, ' ')
        .trim()
      const rawHref = String(node.href || '').trim()

      if (rawHref) {
        const resolved = resolveTocHrefToSpine(epub, rawHref)
        result.push({
          id: node.id ? `${node.id}_${seq}` : `toc_${seq}`,
          label: label || `Chapter ${seq + 1}`,
          href: resolved.displayTarget || rawHref,
          spineHref: resolved.spineHref || rawHref.split('#')[0],
          spineIndex: resolved.spineIndex,
          hash: resolved.hash || undefined,
          depth
        })
        seq++
      }

      if (Array.isArray(node.subitems) && node.subitems.length > 0) {
        visit(node.subitems, Math.min(depth + 1, 3))
      }
    }
  }

  visit(rawToc, 0)

  // Fallback to linear spine entries if the book ships without a populated TOC
  if (result.length === 0 && epub) {
    const spineItems: any[] = ((epub.spine as any)?.spineItems || []).filter(
      (s: any) => s && s.linear !== false && s.linear !== 'no'
    )
    spineItems.forEach((s, idx) => {
      result.push({
        id: `spine_toc_${idx}`,
        label: `Section ${idx + 1}`,
        href: s.href,
        spineHref: s.href,
        spineIndex: typeof s.index === 'number' ? s.index : idx,
        depth: 0
      })
    })
  }

  return result
}

/**
 * Accurately determine the active chapter from the current rendition location, handling:
 * - Exact spine index / normalized href matching (no `ch1` vs `ch10` substring collisions)
 * - Multiple chapters sharing one HTML file via `#anchor` fragments
 * - Multi-file chapters where intermediate files sit after the chapter's TOC entry
 */
export function findActiveTocItem(
  toc: TocItem[],
  location: any,
  iframeDoc?: Document | null,
  epub?: EpubBook | null
): TocItem | null {
  if (!toc.length || !location?.start) return null

  const startHref = String(location.start.href || '')
  const startNormPath = splitHref(startHref).path
  const startSpineIdx = typeof location.start.index === 'number' ? location.start.index : -1

  // 1. Collect all TOC entries that map to the currently displayed spine section
  const sameSectionEntries = toc.filter((item) => {
    if (startSpineIdx >= 0 && typeof item.spineIndex === 'number' && item.spineIndex >= 0) {
      return item.spineIndex === startSpineIdx
    }
    const itemNorm = splitHref(item.spineHref || item.href).path
    return Boolean(
      startNormPath &&
        itemNorm &&
        (itemNorm === startNormPath ||
          itemNorm.endsWith(`/${startNormPath}`) ||
          startNormPath.endsWith(`/${itemNorm}`))
    )
  })

  if (sameSectionEntries.length === 1) {
    return sameSectionEntries[0]
  }

  // 2. Multiple chapters live in this same spine file (anchored by `#hash`):
  // Compare each anchor's DOM position against the currently visible start range.
  if (sameSectionEntries.length > 1) {
    if (iframeDoc && location.start.cfi && epub) {
      try {
        const startRange = (epub as any)?.getRange?.(location.start.cfi) as Range | undefined
        if (startRange) {
          let best: TocItem = sameSectionEntries[0]
          for (const entry of sameSectionEntries) {
            if (!entry.hash) {
              best = entry
              continue
            }
            const anchorEl = findAnchorElement(iframeDoc, entry.hash)
            if (!anchorEl) continue
            const anchorRange = iframeDoc.createRange()
            anchorRange.selectNode(anchorEl)
            // Anchor is at or before the current visible start position
            if (anchorRange.compareBoundaryPoints(Range.START_TO_START, startRange) <= 0) {
              best = entry
            }
          }
          return best
        }
      } catch {
        // Fall through to first section entry
      }
    }
    return sameSectionEntries[0]
  }

  // 3. No TOC entry directly references this spine file (e.g. a multi-file chapter continuation):
  // Pick the most recent preceding TOC item in spine order.
  if (startSpineIdx >= 0) {
    let preceding: TocItem | null = null
    for (const item of toc) {
      if (typeof item.spineIndex === 'number' && item.spineIndex >= 0 && item.spineIndex <= startSpineIdx) {
        preceding = item
      }
    }
    if (preceding) return preceding
  }

  return null
}

/**
 * Recursively flatten a PDF.js outline tree (including nested sub-chapters) into TocItem[]
 * with resolved 1-based page numbers and hierarchy depth (clamped to 0..3).
 */
export async function buildPdfToc(
  pdfDoc: {
    getDestination: (id: string) => Promise<any>
    getPageIndex: (ref: any) => Promise<number>
  },
  outline: any[] | null | undefined
): Promise<TocItem[]> {
  if (!Array.isArray(outline) || outline.length === 0) return []

  const result: TocItem[] = []
  let seq = 0

  const visit = async (nodes: any[], depth: number) => {
    for (const item of nodes) {
      if (!item) continue
      let pageNum = 1
      let hasResolvedPage = false

      if (item.dest) {
        try {
          let dest = item.dest
          if (typeof dest === 'string') {
            dest = await pdfDoc.getDestination(dest)
          }
          if (Array.isArray(dest) && dest[0]) {
            const idx = await pdfDoc.getPageIndex(dest[0])
            if (typeof idx === 'number' && Number.isFinite(idx) && idx >= 0) {
              pageNum = idx + 1
              hasResolvedPage = true
            }
          }
        } catch {
          // Keep default page 1 if destination cannot be resolved
        }
      }

      const label = String(item.title || '')
        .replace(/\s+/g, ' ')
        .trim()

      if (label || hasResolvedPage) {
        result.push({
          id: `pdf-toc-${seq}`,
          label: label || `Section ${seq + 1}`,
          href: String(pageNum),
          pageNumber: pageNum,
          depth
        })
        seq++
      }

      if (Array.isArray(item.items) && item.items.length > 0) {
        await visit(item.items, Math.min(depth + 1, 3))
      }
    }
  }

  await visit(outline, 0)
  return result
}

/**
 * Determine the active PDF chapter for a given 1-based page number.
 * Picks the entry with the highest starting page <= currentPage (breaking ties by latest outline order).
 */
export function findActivePdfTocItem(toc: TocItem[], currentPage: number): TocItem | null {
  if (!toc.length || currentPage < 1) return null

  let best: TocItem | null = null
  let bestPage = -1

  for (const item of toc) {
    const itemPage =
      typeof item.pageNumber === 'number' && Number.isFinite(item.pageNumber)
        ? item.pageNumber
        : parseInt(item.href, 10)
    if (!Number.isFinite(itemPage) || itemPage < 1) continue
    if (itemPage <= currentPage && itemPage >= bestPage) {
      best = item
      bestPage = itemPage
    }
  }

  return best
}
