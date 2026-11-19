import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import {
  X,
  Copy,
  Check,
  ImagePlus,
  RotateCcw,
  FolderOpen,
  AlertCircle,
  Loader2,
  HardDrive
} from 'lucide-react'
import { db, type Book } from '../../db'
import { useAppStore } from '../../stores/useAppStore'
import {
  extractEmbeddedBookMetadata,
  extractEpubCover,
  extractPdfCover,
  resizeCoverImageFile
} from '../../services/coverService'
import {
  formatFileSize,
  normalizeTags,
  type BookMetadataFields,
  type EmbeddedMetadataExtraEntry
} from '../../../../shared/bookMetadata'

function buildFormFromBook(book: Book): BookMetadataFields {
  return {
    title: book.title || '',
    author: book.author || '',
    tags: normalizeTags(book.tags),
    description: book.description || '',
    publisher: book.publisher || '',
    publishedDate: book.publishedDate || '',
    language: book.language || '',
    identifier: book.identifier || '',
    series: book.series || '',
    seriesIndex: book.seriesIndex || '',
    rights: book.rights || '',
    subject: book.subject || '',
    coverDataUrl: book.coverDataUrl ?? null
  }
}

function formsEqual(a: BookMetadataFields, b: BookMetadataFields): boolean {
  if (
    a.title !== b.title ||
    a.author !== b.author ||
    a.description !== b.description ||
    a.publisher !== b.publisher ||
    a.publishedDate !== b.publishedDate ||
    a.language !== b.language ||
    a.identifier !== b.identifier ||
    a.series !== b.series ||
    a.seriesIndex !== b.seriesIndex ||
    a.rights !== b.rights ||
    a.subject !== b.subject ||
    a.coverDataUrl !== b.coverDataUrl
  ) {
    return false
  }
  if (a.tags.length !== b.tags.length) return false
  for (let i = 0; i < a.tags.length; i++) {
    if (a.tags[i] !== b.tags[i]) return false
  }
  return true
}

interface CopyIconButtonProps {
  fieldKey: string
  value: string
  copiedKey: string | null
  onCopy: (key: string, value: string) => void
  label: string
}

/**
 * Subtle hover-revealed icon button (no visible text) for copying an individual metadata line.
 */
const CopyIconButton: React.FC<CopyIconButtonProps> = ({
  fieldKey,
  value,
  copiedKey,
  onCopy,
  label
}) => {
  if (!value.trim()) return null
  const isCopied = copiedKey === fieldKey
  return (
    <button
      type="button"
      onClick={() => onCopy(fieldKey, value)}
      aria-label={`Copy ${label}`}
      title={isCopied ? 'Copied' : `Copy ${label}`}
      className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 transition-all ${
        isCopied
          ? 'opacity-100 text-[var(--app-accent-text)]'
          : 'opacity-0 group-hover/row:opacity-100 group-focus-within/row:opacity-100 focus-visible:opacity-100 text-[var(--app-text-subtle)] hover:text-[var(--app-text-strong)] hover:bg-[var(--app-surface-hover)]'
      }`}
    >
      {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  )
}

export const BookMetadataModal: React.FC = () => {
  const {
    activeBook,
    activeBookBuffer,
    isBookMetadataModalOpen,
    toggleBookMetadataModal,
    updateActiveBook,
    showToast
  } = useAppStore()

  if (!isBookMetadataModalOpen || !activeBook) return null

  return (
    <BookMetadataModalContent
      book={activeBook}
      activeBookBuffer={activeBookBuffer}
      onClose={() => toggleBookMetadataModal(false)}
      updateActiveBook={updateActiveBook}
      showToast={showToast}
    />
  )
}

interface BookMetadataModalContentProps {
  book: Book
  activeBookBuffer: ArrayBuffer | null
  onClose: () => void
  updateActiveBook: (patch: Partial<Book>) => void
  showToast: (message: string, variant?: 'info' | 'success' | 'error') => void
}

const BookMetadataModalContent: React.FC<BookMetadataModalContentProps> = ({
  book,
  activeBookBuffer,
  onClose,
  updateActiveBook,
  showToast
}) => {
  const isPdf = book.format === 'pdf'
  const isEpub = book.format === 'epub'

  const [initialForm, setInitialForm] = useState<BookMetadataFields>(() => buildFormFromBook(book))
  const [form, setForm] = useState<BookMetadataFields>(() => buildFormFromBook(book))
  const [tagDraft, setTagDraft] = useState('')
  const [libraryTags, setLibraryTags] = useState<string[]>([])
  const [isTagInputFocused, setIsTagInputFocused] = useState(false)

  const [isHydrating, setIsHydrating] = useState(false)
  const [isResettingCover, setIsResettingCover] = useState(false)
  const [isDraggingCover, setIsDraggingCover] = useState(false)
  const [coverDimensions, setCoverDimensions] = useState<{ w: number; h: number } | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const [readOnlyInfo, setReadOnlyInfo] = useState<{
    creatorTool?: string
    producer?: string
    creationDate?: string
    modificationDate?: string
    formatVersion?: string
    extraEntries?: EmbeddedMetadataExtraEntry[]
  }>({
    creatorTool: book.creatorTool,
    producer: book.producer,
    formatVersion: book.formatVersion
  })

  const [writeToFile, setWriteToFile] = useState(false)
  const [writableStatus, setWritableStatus] = useState<{ writable: boolean; reason?: string }>({
    writable: false
  })
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const tagInputRef = useRef<HTMLInputElement>(null)
  const hasUserEditedRef = useRef(false)
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const updateFormField = useCallback(
    (updater: (prev: BookMetadataFields) => BookMetadataFields) => {
      hasUserEditedRef.current = true
      setForm(updater)
    },
    []
  )

  const handleCopyField = useCallback(async (key: string, value: string) => {
    const text = value.trim()
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKey(key)
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
      copyTimerRef.current = setTimeout(() => {
        setCopiedKey((curr) => (curr === key ? null : curr))
      }, 1500)
    } catch {
      // Fallback copy via hidden textarea
      try {
        const ta = document.createElement('textarea')
        ta.value = text
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
        setCopiedKey(key)
        if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
        copyTimerRef.current = setTimeout(() => {
          setCopiedKey((curr) => (curr === key ? null : curr))
        }, 1500)
      } catch {
        // Ignore clipboard unavailability
      }
    }
  }, [])

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
    }
  }, [])

  // Load existing tags across the library for quiet autocomplete suggestions
  useEffect(() => {
    let cancelled = false
    db.books
      .toArray()
      .then((allBooks) => {
        if (cancelled) return
        const freq = new Map<string, { label: string; count: number }>()
        for (const b of allBooks) {
          if (!Array.isArray(b.tags)) continue
          for (const raw of b.tags) {
            const clean = raw.trim()
            if (!clean) continue
            const key = clean.toLowerCase()
            const prev = freq.get(key)
            if (prev) prev.count += 1
            else freq.set(key, { label: clean, count: 1 })
          }
        }
        setLibraryTags(
          Array.from(freq.values())
            .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
            .map((item) => item.label)
        )
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  // Check whether source file on disk supports opt-in atomic write-back
  useEffect(() => {
    let cancelled = false
    if ((isEpub || isPdf) && window.desktopAPI?.checkBookWritable) {
      window.desktopAPI
        .checkBookWritable(book.filePath)
        .then((res) => {
          if (!cancelled) setWritableStatus(res)
        })
        .catch(() => {
          if (!cancelled) {
            setWritableStatus({ writable: false, reason: 'Could not verify file permissions' })
          }
        })
    } else {
      setWritableStatus({
        writable: false,
        reason: isEpub || isPdf ? 'Desktop file bridge unavailable' : 'Supported for EPUB and PDF only'
      })
    }
    return () => {
      cancelled = true
    }
  }, [book.filePath, isEpub, isPdf])

  const loadBookBuffer = useCallback(async (): Promise<ArrayBuffer | null> => {
    if (activeBookBuffer) return activeBookBuffer.slice(0)
    try {
      if (
        window.desktopAPI?.readFileBuffer &&
        !/^(https?:|data:|blob:|\/assets\/|assets\/)/i.test(book.filePath)
      ) {
        return await window.desktopAPI.readFileBuffer(book.filePath)
      }
      const resp = await fetch(book.filePath)
      if (resp.ok) return await resp.arrayBuffer()
    } catch {
      // Ignore buffer read failures
    }
    return null
  }, [activeBookBuffer, book.filePath])

  // Lazy-hydrate full embedded EPUB/PDF metadata on open
  useEffect(() => {
    if (!isEpub && !isPdf) return
    let cancelled = false

    async function hydrate() {
      setIsHydrating(true)
      try {
        const buffer = await loadBookBuffer()
        if (!buffer || cancelled) return
        const embedded = await extractEmbeddedBookMetadata(buffer, book.format)
        if (cancelled) return

        setReadOnlyInfo({
          creatorTool: embedded.creatorTool || book.creatorTool,
          producer: embedded.producer || book.producer,
          creationDate: embedded.creationDate,
          modificationDate: embedded.modificationDate,
          formatVersion: embedded.formatVersion || book.formatVersion,
          extraEntries: embedded.extraEntries
        })

        if (!book.metadataHydrated) {
          const mergedTags =
            book.tags && book.tags.length > 0 ? normalizeTags(book.tags) : normalizeTags(embedded.tags)
          const mergedPatch: Partial<Book> = {
            tags: mergedTags,
            description: book.description || embedded.description || undefined,
            publisher: book.publisher || embedded.publisher || undefined,
            publishedDate: book.publishedDate || embedded.publishedDate || undefined,
            language: book.language || embedded.language || undefined,
            identifier: book.identifier || embedded.identifier || undefined,
            series: book.series || embedded.series || undefined,
            seriesIndex: book.seriesIndex || embedded.seriesIndex || undefined,
            rights: book.rights || embedded.rights || undefined,
            subject: book.subject || embedded.subject || undefined,
            creatorTool: embedded.creatorTool || book.creatorTool || undefined,
            producer: embedded.producer || book.producer || undefined,
            formatVersion: embedded.formatVersion || book.formatVersion || undefined,
            metadataHydrated: true
          }

          if (book.id) {
            await db.books.update(book.id, mergedPatch)
          }
          if (!cancelled) {
            updateActiveBook(mergedPatch)
            const hydratedForm = buildFormFromBook({ ...book, ...mergedPatch })
            if (!hasUserEditedRef.current) {
              setInitialForm(hydratedForm)
              setForm(hydratedForm)
            }
          }
        }
      } catch {
        // Fall back quietly to Dexie fields
      } finally {
        if (!cancelled) setIsHydrating(false)
      }
    }

    hydrate()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book.id, book.filePath, isEpub, isPdf])

  const hasPendingTag = tagDraft.trim().length > 0
  const isDirty = useMemo(
    () => !formsEqual(form, initialForm) || hasPendingTag,
    [form, initialForm, hasPendingTag]
  )
  const coverChanged = form.coverDataUrl !== initialForm.coverDataUrl

  const tagSuggestions = useMemo(() => {
    const existingKeys = new Set(form.tags.map((t) => t.toLowerCase()))
    const q = tagDraft.trim().toLowerCase()
    return libraryTags
      .filter((t) => !existingKeys.has(t.toLowerCase()) && (!q || t.toLowerCase().includes(q)))
      .slice(0, 5)
  }, [libraryTags, form.tags, tagDraft])

  const commitTagDraft = useCallback(
    (rawText?: string) => {
      const source = rawText ?? tagDraft
      const pieces = source
        .split(/[,;]+/)
        .map((s) => s.trim())
        .filter(Boolean)
      if (pieces.length === 0) {
        setTagDraft('')
        return
      }
      updateFormField((prev) => ({
        ...prev,
        tags: normalizeTags([...prev.tags, ...pieces])
      }))
      setTagDraft('')
    },
    [tagDraft, updateFormField]
  )

  const removeTag = (tagToRemove: string) => {
    updateFormField((prev) => ({
      ...prev,
      tags: prev.tags.filter((t) => t !== tagToRemove)
    }))
  }

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      commitTagDraft()
    } else if (e.key === 'Backspace' && !tagDraft && form.tags.length > 0) {
      e.preventDefault()
      updateFormField((prev) => ({ ...prev, tags: prev.tags.slice(0, -1) }))
    }
  }

  const handleCoverFile = async (file: File | null | undefined) => {
    if (!file) return
    setErrorMessage(null)
    try {
      const resized = await resizeCoverImageFile(file)
      updateFormField((prev) => ({ ...prev, coverDataUrl: resized.dataUrl }))
      setCoverDimensions({ w: resized.width, h: resized.height })
    } catch (err: any) {
      setErrorMessage(err?.message || 'Could not load cover image.')
    }
  }

  const handleResetOriginalCover = async () => {
    setErrorMessage(null)
    setIsResettingCover(true)
    try {
      const buffer = await loadBookBuffer()
      if (!buffer) {
        setErrorMessage('Source file buffer unavailable to re-extract cover.')
        return
      }
      const extracted = isPdf
        ? await extractPdfCover(buffer)
        : isEpub
        ? await extractEpubCover(buffer, form.title || book.title, form.author || book.author)
        : null

      if (extracted) {
        updateFormField((prev) => ({ ...prev, coverDataUrl: extracted }))
        setCoverDimensions(null)
      } else {
        setErrorMessage('No embedded cover or first-page preview could be extracted.')
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to extract original cover.')
    } finally {
      setIsResettingCover(false)
    }
  }

  const handleDiscard = () => {
    hasUserEditedRef.current = false
    setForm(initialForm)
    setTagDraft('')
    setErrorMessage(null)
  }

  const handleSave = useCallback(async () => {
    if (isSaving) return
    setErrorMessage(null)

    const pendingPieces = tagDraft
      .split(/[,;]+/)
      .map((s) => s.trim())
      .filter(Boolean)
    const finalTags = normalizeTags([...form.tags, ...pendingPieces])
    const finalTitle = form.title.trim()

    if (!finalTitle) {
      setErrorMessage('Title cannot be empty.')
      return
    }

    const finalAuthor = form.author.trim() || 'Unknown Author'
    const normalizedPayload: BookMetadataFields = {
      title: finalTitle,
      author: finalAuthor,
      tags: finalTags,
      description: form.description.trim(),
      publisher: form.publisher.trim(),
      publishedDate: form.publishedDate.trim(),
      language: form.language.trim(),
      identifier: form.identifier.trim(),
      series: form.series.trim(),
      seriesIndex: form.seriesIndex.trim(),
      rights: form.rights.trim(),
      subject: form.subject.trim(),
      coverDataUrl: form.coverDataUrl
    }

    setIsSaving(true)
    try {
      const dbPatch: Partial<Book> = {
        title: normalizedPayload.title,
        author: normalizedPayload.author,
        tags: normalizedPayload.tags,
        description: normalizedPayload.description || undefined,
        publisher: normalizedPayload.publisher || undefined,
        publishedDate: normalizedPayload.publishedDate || undefined,
        language: normalizedPayload.language || undefined,
        identifier: normalizedPayload.identifier || undefined,
        series: normalizedPayload.series || undefined,
        seriesIndex: normalizedPayload.seriesIndex || undefined,
        rights: normalizedPayload.rights || undefined,
        subject: normalizedPayload.subject || undefined,
        coverDataUrl: normalizedPayload.coverDataUrl,
        metadataHydrated: true
      }

      if (book.id) {
        await db.books.update(book.id, dbPatch)
      }
      updateActiveBook(dbPatch)

      setTagDraft('')
      hasUserEditedRef.current = false
      setForm(normalizedPayload)
      setInitialForm(normalizedPayload)

      if (
        writeToFile &&
        writableStatus.writable &&
        (isEpub || isPdf) &&
        window.desktopAPI?.writeBookMetadata
      ) {
        const res = await window.desktopAPI.writeBookMetadata({
          filePath: book.filePath,
          format: isPdf ? 'pdf' : 'epub',
          metadata: normalizedPayload,
          updateCover: coverChanged
        })

        if (res.success) {
          if (typeof res.fileSize === 'number' && res.fileSize > 0) {
            if (book.id) await db.books.update(book.id, { fileSize: res.fileSize })
            updateActiveBook({ fileSize: res.fileSize })
          }
        } else {
          const msg = res.error || 'Could not write changes to source file.'
          setErrorMessage(`Saved to Semply library, but file write failed: ${msg}`)
          showToast('Saved to library; file write failed', 'error')
        }
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Could not save metadata.')
    } finally {
      setIsSaving(false)
    }
  }, [
    isSaving,
    tagDraft,
    form,
    book.id,
    book.filePath,
    book.format,
    updateActiveBook,
    writeToFile,
    writableStatus.writable,
    isEpub,
    isPdf,
    coverChanged,
    showToast
  ])

  // Escape closes modal; Ctrl/Cmd+S saves changes
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        if (isDirty && !isSaving) {
          handleSave()
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose, isDirty, isSaving, handleSave])

  const fileName = useMemo(() => {
    const clean = book.filePath.split(/[\\/]/).pop() || book.filePath
    return clean.split('?')[0]
  }, [book.filePath])

  const canRevealInFolder =
    Boolean(window.desktopAPI?.showItemInFolder) &&
    !/^(https?:|data:|blob:|\/assets\/|assets\/)/i.test(book.filePath)

  const stopReaderKeyLeak = (e: React.KeyboardEvent) => {
    if (e.key !== 'Escape' && !((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's')) {
      e.stopPropagation()
    }
  }

  return (
    <div
      onClick={onClose}
      onKeyDown={stopReaderKeyLeak}
      className="fixed inset-0 z-[70] bg-black/55 backdrop-blur-[2px] flex items-center justify-center p-4 select-none app-no-drag animate-in fade-in duration-150"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Book metadata"
        onClick={(e) => e.stopPropagation()}
        className="w-[640px] max-w-[94vw] max-h-[86vh] bg-[var(--app-surface)] border border-[var(--app-border)] rounded-xl shadow-[0_28px_80px_rgba(0,0,0,0.65)] flex flex-col overflow-hidden animate-in zoom-in-95 fade-in duration-150"
      >
        {/* Minimal Modal Header */}
        <div className="px-5 py-3.5 border-b border-[var(--app-border)] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="text-[14px] font-semibold tracking-[-0.015em] text-[var(--app-text-strong)]">
              Metadata
            </h2>
            <span
              data-preserve-theme="true"
              className={`px-1.5 py-0.5 rounded-[3px] text-[9.5px] font-mono font-semibold uppercase tracking-wider ${
                isPdf
                  ? 'bg-[#d9534f]/15 text-[#d9534f]'
                  : isEpub
                  ? 'bg-[#2a69df]/15 text-[#4d8bf5]'
                  : 'bg-[var(--app-surface-2)] text-[var(--app-text-muted)]'
              }`}
            >
              {book.format}
            </span>
            {isHydrating && (
              <Loader2 className="w-3.5 h-3.5 text-[var(--app-text-subtle)] animate-spin" />
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-md flex items-center justify-center text-[var(--app-text-subtle)] hover:text-[var(--app-text-strong)] hover:bg-[var(--app-surface-hover)] transition-colors"
            title="Close (Esc)"
            aria-label="Close metadata modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Two-Column Content Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          <div className="grid grid-cols-1 sm:grid-cols-[176px_1fr] gap-6 items-start">
            {/* Left Column: Cover Thumbnail + Quiet File Details */}
            <div className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  handleCoverFile(e.target.files?.[0])
                  e.target.value = ''
                }}
              />

              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    if (!isDraggingCover) setIsDraggingCover(true)
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setIsDraggingCover(false)
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setIsDraggingCover(false)
                    handleCoverFile(e.dataTransfer.files?.[0])
                  }}
                  data-preserve-theme="true"
                  className={`relative w-[144px] h-[208px] mx-auto sm:mx-0 rounded-[6px] overflow-hidden border transition-all group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)] ${
                    isDraggingCover
                      ? 'border-[var(--app-accent)] ring-2 ring-[var(--app-accent-soft)]'
                      : 'border-[var(--app-border-strong)] bg-[#141414]'
                  }`}
                  title="Click or drop an image to replace cover"
                  aria-label="Book cover thumbnail — click or drop image to replace"
                >
                  {form.coverDataUrl ? (
                    <img
                      src={form.coverDataUrl}
                      alt={`Cover for ${form.title || book.title}`}
                      onLoad={(e) => {
                        const img = e.currentTarget
                        if (img.naturalWidth && img.naturalHeight) {
                          setCoverDimensions({ w: img.naturalWidth, h: img.naturalHeight })
                        }
                      }}
                      className="w-full h-full object-cover block"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center bg-[#18181b] text-[#888888]">
                      <ImagePlus className="w-5 h-5 mb-1.5 opacity-70" />
                      <span className="text-[11px]">No cover</span>
                    </div>
                  )}

                  <div
                    className={`absolute inset-0 bg-black/65 flex items-center justify-center transition-opacity ${
                      isDraggingCover ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                    }`}
                  >
                    <span className="text-[11px] font-medium text-white px-2 py-1 rounded bg-black/50 border border-white/15">
                      {isDraggingCover ? 'Drop image' : 'Replace cover'}
                    </span>
                  </div>
                </button>

                {/* Quiet borderless cover actions */}
                <div className="flex items-center gap-3 text-[11px] text-[var(--app-text-muted)]">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="hover:text-[var(--app-text-strong)] transition-colors"
                  >
                    Change
                  </button>
                  {(isEpub || isPdf) && (
                    <button
                      type="button"
                      disabled={isResettingCover}
                      onClick={handleResetOriginalCover}
                      className="inline-flex items-center gap-1 hover:text-[var(--app-text-strong)] transition-colors disabled:opacity-45"
                    >
                      {isResettingCover && <Loader2 className="w-3 h-3 animate-spin" />}
                      <span>Original</span>
                    </button>
                  )}
                  {form.coverDataUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        updateFormField((prev) => ({ ...prev, coverDataUrl: null }))
                        setCoverDimensions(null)
                      }}
                      className="hover:text-[#e5484d] transition-colors"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>

              {/* Quiet File Summary */}
              <div className="pt-3 border-t border-[var(--app-border)] space-y-2 text-[11px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[var(--app-text-subtle)]">Format</span>
                  <span className="font-mono text-[var(--app-text-muted)]">
                    {readOnlyInfo.formatVersion || book.format.toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[var(--app-text-subtle)]">Pages</span>
                  <span className="font-mono tabular-nums text-[var(--app-text-muted)]">
                    {book.pdfOriginalTotalPages || book.totalPages}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[var(--app-text-subtle)]">Size</span>
                  <span className="font-mono tabular-nums text-[var(--app-text-muted)]">
                    {formatFileSize(book.fileSize)}
                  </span>
                </div>
                {coverDimensions && form.coverDataUrl && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[var(--app-text-subtle)]">Cover</span>
                    <span className="font-mono tabular-nums text-[var(--app-text-muted)]">
                      {coverDimensions.w}×{coverDimensions.h}
                    </span>
                  </div>
                )}

                <div className="group/row pt-2 border-t border-[var(--app-border)] flex items-center justify-between gap-1">
                  <span
                    className="font-mono text-[10.5px] text-[var(--app-text-muted)] truncate select-text"
                    title={book.filePath}
                  >
                    {fileName}
                  </span>
                  <div className="flex items-center shrink-0">
                    <CopyIconButton
                      fieldKey="filePath"
                      value={book.filePath}
                      copiedKey={copiedKey}
                      onCopy={handleCopyField}
                      label="file path"
                    />
                    {canRevealInFolder && (
                      <button
                        type="button"
                        onClick={() => window.desktopAPI?.showItemInFolder?.(book.filePath)}
                        className="w-6 h-6 rounded-md flex items-center justify-center text-[var(--app-text-subtle)] hover:text-[var(--app-text-strong)] hover:bg-[var(--app-surface-hover)] transition-colors"
                        title="Reveal in folder"
                        aria-label="Reveal in folder"
                      >
                        <FolderOpen className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Editable Metadata Details (Hover-Revealed Copy Icon Per Line) */}
            <div className="space-y-4 min-w-0">
              {/* Title */}
              <div className="group/row space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="modal-meta-title"
                    className="text-[11px] font-semibold text-[var(--app-text-muted)]"
                  >
                    Title
                  </label>
                  <CopyIconButton
                    fieldKey="title"
                    value={form.title}
                    copiedKey={copiedKey}
                    onCopy={handleCopyField}
                    label="title"
                  />
                </div>
                <input
                  id="modal-meta-title"
                  type="text"
                  value={form.title}
                  onChange={(e) => updateFormField((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="Book title"
                  className="ice-input w-full h-8 px-2.5 text-[12.5px] select-text"
                />
              </div>

              {/* Author */}
              <div className="group/row space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="modal-meta-author"
                    className="text-[11px] font-semibold text-[var(--app-text-muted)]"
                  >
                    Author
                  </label>
                  <CopyIconButton
                    fieldKey="author"
                    value={form.author}
                    copiedKey={copiedKey}
                    onCopy={handleCopyField}
                    label="author"
                  />
                </div>
                <input
                  id="modal-meta-author"
                  type="text"
                  value={form.author}
                  onChange={(e) => updateFormField((prev) => ({ ...prev, author: e.target.value }))}
                  placeholder="Unknown Author"
                  className="ice-input w-full h-8 px-2.5 text-[12.5px] select-text"
                />
              </div>

              {/* Tags */}
              <div className="group/row space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="modal-meta-tags"
                    className="text-[11px] font-semibold text-[var(--app-text-muted)]"
                  >
                    Tags
                  </label>
                  <CopyIconButton
                    fieldKey="tags"
                    value={form.tags.join(', ')}
                    copiedKey={copiedKey}
                    onCopy={handleCopyField}
                    label="tags"
                  />
                </div>

                <div
                  onClick={() => tagInputRef.current?.focus()}
                  className={`min-h-[36px] px-2.5 py-1.5 rounded-[6px] bg-[var(--app-input-bg)] border transition-all flex flex-wrap items-center gap-1.5 ${
                    isTagInputFocused
                      ? 'border-[var(--app-accent)] shadow-[0_0_0_2px_var(--app-accent-soft)]'
                      : 'border-[var(--app-border)]'
                  }`}
                >
                  {form.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-[4px] bg-[var(--app-surface-2)] text-[11px] text-[var(--app-text-strong)] max-w-full"
                    >
                      <span className="truncate max-w-[180px]">{tag}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          removeTag(tag)
                        }}
                        className="w-3.5 h-3.5 rounded-[3px] flex items-center justify-center text-[var(--app-text-subtle)] hover:text-[var(--app-text-strong)] hover:bg-[var(--app-surface-hover)] transition-colors"
                        aria-label={`Remove tag ${tag}`}
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  ))}

                  <input
                    ref={tagInputRef}
                    id="modal-meta-tags"
                    type="text"
                    value={tagDraft}
                    onFocus={() => setIsTagInputFocused(true)}
                    onBlur={() => {
                      setIsTagInputFocused(false)
                      if (tagDraft.trim()) commitTagDraft()
                    }}
                    onChange={(e) => setTagDraft(e.target.value)}
                    onKeyDown={handleTagKeyDown}
                    onPaste={(e) => {
                      const pasted = e.clipboardData.getData('text')
                      if (/[,;]/.test(pasted)) {
                        e.preventDefault()
                        commitTagDraft(`${tagDraft} ${pasted}`)
                      }
                    }}
                    placeholder={form.tags.length === 0 ? 'Add tags, press Enter...' : 'Add tag...'}
                    className="flex-1 min-w-[90px] bg-transparent border-none outline-none text-[12px] text-[var(--app-text)] placeholder:text-[var(--app-text-subtle)] select-text py-0.5"
                  />
                </div>

                {tagSuggestions.length > 0 && (isTagInputFocused || tagDraft.trim().length > 0) && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    {tagSuggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault()
                          updateFormField((prev) => ({
                            ...prev,
                            tags: normalizeTags([...prev.tags, suggestion])
                          }))
                          setTagDraft('')
                        }}
                        className="px-2 py-0.5 rounded-[4px] bg-[var(--app-surface-2)] hover:bg-[var(--app-surface-hover)] text-[10.5px] text-[var(--app-text-muted)] hover:text-[var(--app-text-strong)] transition-colors"
                      >
                        + {suggestion}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Description / PDF Subject */}
              {isPdf ? (
                <div className="group/row space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <label
                      htmlFor="modal-meta-subject"
                      className="text-[11px] font-semibold text-[var(--app-text-muted)]"
                    >
                      Subject
                    </label>
                    <CopyIconButton
                      fieldKey="subject"
                      value={form.subject}
                      copiedKey={copiedKey}
                      onCopy={handleCopyField}
                      label="subject"
                    />
                  </div>
                  <textarea
                    id="modal-meta-subject"
                    rows={2}
                    value={form.subject}
                    onChange={(e) =>
                      updateFormField((prev) => ({ ...prev, subject: e.target.value }))
                    }
                    placeholder="Document subject or summary"
                    className="ice-input w-full px-2.5 py-2 text-[12px] leading-relaxed resize-y min-h-[58px] select-text"
                  />
                </div>
              ) : (
                <div className="group/row space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <label
                      htmlFor="modal-meta-desc"
                      className="text-[11px] font-semibold text-[var(--app-text-muted)]"
                    >
                      Description
                    </label>
                    <CopyIconButton
                      fieldKey="description"
                      value={form.description}
                      copiedKey={copiedKey}
                      onCopy={handleCopyField}
                      label="description"
                    />
                  </div>
                  <textarea
                    id="modal-meta-desc"
                    rows={3}
                    value={form.description}
                    onChange={(e) =>
                      updateFormField((prev) => ({ ...prev, description: e.target.value }))
                    }
                    placeholder="Synopsis or notes"
                    className="ice-input w-full px-2.5 py-2 text-[12px] leading-relaxed resize-y min-h-[72px] select-text"
                  />
                </div>
              )}

              {/* Publisher & Published Date */}
              <div className="grid grid-cols-2 gap-3.5">
                <div className="group/row space-y-1">
                  <div className="flex items-center justify-between gap-1">
                    <label
                      htmlFor="modal-meta-publisher"
                      className="text-[11px] font-semibold text-[var(--app-text-muted)]"
                    >
                      Publisher
                    </label>
                    <CopyIconButton
                      fieldKey="publisher"
                      value={form.publisher}
                      copiedKey={copiedKey}
                      onCopy={handleCopyField}
                      label="publisher"
                    />
                  </div>
                  <input
                    id="modal-meta-publisher"
                    type="text"
                    value={form.publisher}
                    onChange={(e) =>
                      updateFormField((prev) => ({ ...prev, publisher: e.target.value }))
                    }
                    placeholder="Publisher"
                    className="ice-input w-full h-8 px-2.5 text-[12px] select-text"
                  />
                </div>

                <div className="group/row space-y-1">
                  <div className="flex items-center justify-between gap-1">
                    <label
                      htmlFor="modal-meta-date"
                      className="text-[11px] font-semibold text-[var(--app-text-muted)]"
                    >
                      Published
                    </label>
                    <CopyIconButton
                      fieldKey="publishedDate"
                      value={form.publishedDate}
                      copiedKey={copiedKey}
                      onCopy={handleCopyField}
                      label="published date"
                    />
                  </div>
                  <input
                    id="modal-meta-date"
                    type="text"
                    value={form.publishedDate}
                    onChange={(e) =>
                      updateFormField((prev) => ({ ...prev, publishedDate: e.target.value }))
                    }
                    placeholder="YYYY-MM-DD"
                    className="ice-input w-full h-8 px-2.5 text-[12px] font-mono tabular-nums select-text"
                  />
                </div>
              </div>

              {/* Language & ISBN/ID */}
              <div className="grid grid-cols-2 gap-3.5">
                <div className="group/row space-y-1">
                  <div className="flex items-center justify-between gap-1">
                    <label
                      htmlFor="modal-meta-lang"
                      className="text-[11px] font-semibold text-[var(--app-text-muted)]"
                    >
                      Language
                    </label>
                    <CopyIconButton
                      fieldKey="language"
                      value={form.language}
                      copiedKey={copiedKey}
                      onCopy={handleCopyField}
                      label="language"
                    />
                  </div>
                  <input
                    id="modal-meta-lang"
                    type="text"
                    value={form.language}
                    onChange={(e) =>
                      updateFormField((prev) => ({ ...prev, language: e.target.value }))
                    }
                    placeholder="en"
                    className="ice-input w-full h-8 px-2.5 text-[12px] select-text"
                  />
                </div>

                <div className="group/row space-y-1">
                  <div className="flex items-center justify-between gap-1">
                    <label
                      htmlFor="modal-meta-id"
                      className="text-[11px] font-semibold text-[var(--app-text-muted)]"
                    >
                      ISBN / ID
                    </label>
                    <CopyIconButton
                      fieldKey="identifier"
                      value={form.identifier}
                      copiedKey={copiedKey}
                      onCopy={handleCopyField}
                      label="identifier"
                    />
                  </div>
                  <input
                    id="modal-meta-id"
                    type="text"
                    value={form.identifier}
                    onChange={(e) =>
                      updateFormField((prev) => ({ ...prev, identifier: e.target.value }))
                    }
                    placeholder="978-..."
                    className="ice-input w-full h-8 px-2.5 text-[12px] font-mono tabular-nums select-text"
                  />
                </div>
              </div>

              {/* EPUB Series + Rights OR PDF Library Notes */}
              {isEpub && (
                <>
                  <div className="grid grid-cols-3 gap-3.5">
                    <div className="col-span-2 group/row space-y-1">
                      <div className="flex items-center justify-between gap-1">
                        <label
                          htmlFor="modal-meta-series"
                          className="text-[11px] font-semibold text-[var(--app-text-muted)]"
                        >
                          Series
                        </label>
                        <CopyIconButton
                          fieldKey="series"
                          value={
                            form.seriesIndex
                              ? `${form.series} #${form.seriesIndex}`
                              : form.series
                          }
                          copiedKey={copiedKey}
                          onCopy={handleCopyField}
                          label="series"
                        />
                      </div>
                      <input
                        id="modal-meta-series"
                        type="text"
                        value={form.series}
                        onChange={(e) =>
                          updateFormField((prev) => ({ ...prev, series: e.target.value }))
                        }
                        placeholder="Series name"
                        className="ice-input w-full h-8 px-2.5 text-[12px] select-text"
                      />
                    </div>

                    <div className="space-y-1">
                      <label
                        htmlFor="modal-meta-series-idx"
                        className="block text-[11px] font-semibold text-[var(--app-text-muted)] leading-6"
                      >
                        Book #
                      </label>
                      <input
                        id="modal-meta-series-idx"
                        type="text"
                        value={form.seriesIndex}
                        onChange={(e) =>
                          updateFormField((prev) => ({ ...prev, seriesIndex: e.target.value }))
                        }
                        placeholder="1"
                        className="ice-input w-full h-8 px-2.5 text-[12px] font-mono tabular-nums select-text"
                      />
                    </div>
                  </div>

                  <div className="group/row space-y-1">
                    <div className="flex items-center justify-between gap-1">
                      <label
                        htmlFor="modal-meta-rights"
                        className="text-[11px] font-semibold text-[var(--app-text-muted)]"
                      >
                        Rights
                      </label>
                      <CopyIconButton
                        fieldKey="rights"
                        value={form.rights}
                        copiedKey={copiedKey}
                        onCopy={handleCopyField}
                        label="rights"
                      />
                    </div>
                    <input
                      id="modal-meta-rights"
                      type="text"
                      value={form.rights}
                      onChange={(e) =>
                        updateFormField((prev) => ({ ...prev, rights: e.target.value }))
                      }
                      placeholder="Copyright or license"
                      className="ice-input w-full h-8 px-2.5 text-[12px] select-text"
                    />
                  </div>
                </>
              )}

              {isPdf && (
                <div className="group/row space-y-1">
                  <div className="flex items-center justify-between gap-1">
                    <label
                      htmlFor="modal-meta-notes"
                      className="text-[11px] font-semibold text-[var(--app-text-muted)]"
                    >
                      Notes
                    </label>
                    <CopyIconButton
                      fieldKey="description"
                      value={form.description}
                      copiedKey={copiedKey}
                      onCopy={handleCopyField}
                      label="notes"
                    />
                  </div>
                  <textarea
                    id="modal-meta-notes"
                    rows={2}
                    value={form.description}
                    onChange={(e) =>
                      updateFormField((prev) => ({ ...prev, description: e.target.value }))
                    }
                    placeholder="Personal synopsis stored in Semply"
                    className="ice-input w-full px-2.5 py-2 text-[12px] resize-y select-text"
                  />
                </div>
              )}

              {/* Read-Only Embedded Document Properties (each row hover-copyable) */}
              {(readOnlyInfo.creatorTool ||
                readOnlyInfo.producer ||
                readOnlyInfo.modificationDate ||
                (readOnlyInfo.extraEntries && readOnlyInfo.extraEntries.length > 0)) && (
                <div className="pt-3 border-t border-[var(--app-border)] space-y-1.5">
                  <div className="text-[10.5px] font-semibold text-[var(--app-text-subtle)]">
                    Embedded properties
                  </div>
                  <div className="space-y-1 text-[11.5px]">
                    {readOnlyInfo.creatorTool && (
                      <div className="group/row flex items-center justify-between gap-2 py-0.5">
                        <span className="text-[var(--app-text-subtle)] shrink-0">Creator</span>
                        <div className="flex items-center gap-1 min-w-0">
                          <span className="text-[var(--app-text-muted)] truncate select-text">
                            {readOnlyInfo.creatorTool}
                          </span>
                          <CopyIconButton
                            fieldKey="creatorTool"
                            value={readOnlyInfo.creatorTool}
                            copiedKey={copiedKey}
                            onCopy={handleCopyField}
                            label="creator"
                          />
                        </div>
                      </div>
                    )}
                    {readOnlyInfo.producer && (
                      <div className="group/row flex items-center justify-between gap-2 py-0.5">
                        <span className="text-[var(--app-text-subtle)] shrink-0">Producer</span>
                        <div className="flex items-center gap-1 min-w-0">
                          <span className="text-[var(--app-text-muted)] truncate select-text">
                            {readOnlyInfo.producer}
                          </span>
                          <CopyIconButton
                            fieldKey="producer"
                            value={readOnlyInfo.producer}
                            copiedKey={copiedKey}
                            onCopy={handleCopyField}
                            label="producer"
                          />
                        </div>
                      </div>
                    )}
                    {readOnlyInfo.modificationDate && (
                      <div className="group/row flex items-center justify-between gap-2 py-0.5">
                        <span className="text-[var(--app-text-subtle)] shrink-0">Modified</span>
                        <div className="flex items-center gap-1 min-w-0">
                          <span className="text-[var(--app-text-muted)] font-mono tabular-nums truncate select-text">
                            {readOnlyInfo.modificationDate}
                          </span>
                          <CopyIconButton
                            fieldKey="modificationDate"
                            value={readOnlyInfo.modificationDate}
                            copiedKey={copiedKey}
                            onCopy={handleCopyField}
                            label="modified date"
                          />
                        </div>
                      </div>
                    )}
                    {readOnlyInfo.extraEntries?.map((entry) => (
                      <div
                        key={entry.key}
                        className="group/row flex items-center justify-between gap-2 py-0.5"
                      >
                        <span
                          className="text-[var(--app-text-subtle)] truncate max-w-[140px]"
                          title={entry.key}
                        >
                          {entry.key}
                        </span>
                        <div className="flex items-center gap-1 min-w-0">
                          <span
                            className="text-[var(--app-text-muted)] truncate select-text"
                            title={entry.value}
                          >
                            {entry.value}
                          </span>
                          <CopyIconButton
                            fieldKey={`extra-${entry.key}`}
                            value={entry.value}
                            copiedKey={copiedKey}
                            onCopy={handleCopyField}
                            label={entry.key}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {errorMessage && (
                <div
                  role="alert"
                  className="p-2.5 rounded-lg bg-[#e5484d]/10 border border-[#e5484d]/30 text-[#f47c7c] text-[11.5px] flex items-start gap-2 leading-snug"
                >
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Clean Modal Footer */}
        <div className="px-5 py-3 border-t border-[var(--app-border)] bg-[var(--app-chrome)] flex flex-wrap items-center justify-between gap-3 shrink-0">
          {writableStatus.writable ? (
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                type="button"
                role="switch"
                aria-checked={writeToFile}
                data-preserve-theme="true"
                onClick={() => setWriteToFile((v) => !v)}
                style={{
                  backgroundColor: writeToFile ? 'var(--app-accent)' : 'var(--app-border-strong)'
                }}
                className="w-8 h-4 rounded-full p-0.5 flex items-center transition-colors shrink-0"
                title={`Also write metadata into the source .${book.format} file on disk`}
              >
                <span
                  className={`w-3 h-3 rounded-full bg-white shadow-sm block transition-transform duration-150 ${
                    writeToFile ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-[11.5px] font-medium text-[var(--app-text-muted)]">
                  <HardDrive className="w-3 h-3 text-[var(--app-text-subtle)] shrink-0" />
                  <span>Write to .{book.format} file</span>
                </div>
                {writeToFile && isPdf && coverChanged && (
                  <div className="text-[10px] font-normal text-[var(--app-text-subtle)]">
                    PDF metadata updates on disk; custom cover stays in Semply.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <span
              className="text-[11px] font-normal text-[var(--app-text-subtle)] truncate"
              title={writableStatus.reason}
            >
              {writableStatus.reason || 'Saved to Semply library'}
            </span>
          )}

          <div className="flex items-center gap-2 ml-auto">
            {isDirty && (
              <button
                type="button"
                disabled={isSaving}
                onClick={handleDiscard}
                className="h-8 px-3 rounded-md text-[11.5px] font-medium text-[var(--app-text-muted)] hover:text-[var(--app-text-strong)] hover:bg-[var(--app-surface-hover)] transition-colors inline-flex items-center gap-1.5"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Discard</span>
              </button>
            )}
            <button
              type="button"
              disabled={!isDirty || isSaving}
              onClick={handleSave}
              className="ice-btn-blue h-8 px-4 gap-1.5 text-[12px] disabled:opacity-40 disabled:pointer-events-none"
              title="Save changes (Ctrl+S)"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save changes</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
