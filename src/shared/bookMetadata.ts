export interface BookMetadataFields {
  title: string
  author: string
  tags: string[]
  description: string
  publisher: string
  publishedDate: string
  language: string
  identifier: string
  series: string
  seriesIndex: string
  rights: string
  subject: string
  coverDataUrl: string | null
}

export interface EmbeddedMetadataExtraEntry {
  key: string
  value: string
}

export interface EmbeddedBookMetadata extends Partial<BookMetadataFields> {
  creatorTool?: string
  producer?: string
  creationDate?: string
  modificationDate?: string
  formatVersion?: string
  extraEntries?: EmbeddedMetadataExtraEntry[]
}

export interface CheckBookWritableResult {
  writable: boolean
  reason?: string
}

export interface WriteBookMetadataRequest {
  filePath: string
  format: 'epub' | 'pdf'
  metadata: BookMetadataFields
  updateCover?: boolean
}

export interface WriteBookMetadataResult {
  success: boolean
  fileSize?: number
  coverWritten?: boolean
  warning?: string
  error?: string
}

/**
 * Normalizes a list of tags: trims whitespace, drops blanks, and deduplicates
 * case-insensitively while preserving first-seen casing.
 */
export function normalizeTags(rawTags: string[] | undefined | null): string[] {
  if (!Array.isArray(rawTags)) return []
  const seen = new Set<string>()
  const result: string[] = []
  for (const raw of rawTags) {
    if (typeof raw !== 'string') continue
    const clean = raw.replace(/\s+/g, ' ').trim().slice(0, 48)
    if (!clean) continue
    const key = clean.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(clean)
    if (result.length >= 32) break
  }
  return result
}

/**
 * Parses a comma- or semicolon-delimited keyword string (such as PDF Keywords)
 * into normalized unique tags.
 */
export function parseDelimitedTags(raw: string | undefined | null): string[] {
  if (!raw || typeof raw !== 'string') return []
  return normalizeTags(raw.split(/[,;]+/))
}

/**
 * Formats a PDF date string (e.g. D:20240512143000+02'00') into a readable date.
 */
export function formatPdfDate(raw: string | undefined | null): string {
  if (!raw || typeof raw !== 'string') return ''
  const trimmed = raw.trim()
  const match = trimmed.match(/^D:(\d{4})(\d{2})?(\d{2})?(\d{2})?(\d{2})?/)
  if (!match) return trimmed
  const [, year, month, day] = match
  if (year && month && day) return `${year}-${month}-${day}`
  if (year && month) return `${year}-${month}`
  return year
}

/**
 * Formats byte size into a compact tabular-friendly string (e.g. "3.2 MB").
 */
export function formatFileSize(bytes: number | undefined | null): string {
  if (!bytes || !Number.isFinite(bytes) || bytes <= 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(1)} KB`
  const mb = kb / 1024
  if (mb < 1024) return `${mb.toFixed(1)} MB`
  return `${(mb / 1024).toFixed(2)} GB`
}
