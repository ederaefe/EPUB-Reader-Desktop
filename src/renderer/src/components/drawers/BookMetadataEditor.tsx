import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import {
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  X,
  ImagePlus,
  RotateCcw,
  Trash2,
  FolderOpen,
  AlertCircle,
  Loader2,
  Check,
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

interface BookMetadataEditorProps {
  book: Book
  onBack: () => void
  onClose: () => void
}

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

export const BookMetadataEditor: React.FC<BookMetadataEditorProps> = ({
  book,
  onBack,
  onClose
}) => {
  const { activeBookBuffer, updateActiveBook, showToast } = useAppStore()

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

  const [showDetails, setShowDetails] = useState<boolean>(() =>
    Boolean(
      book.publisher ||
        book.publishedDate ||
        book.language ||
        book.identifier ||
        book.series ||
        book.rights
    )
  )

  const [writeToFile, setWriteToFile] = useState(false)
  const [writableStatus, setWritableStatus] = useState<{ writable: boolean; reason?: string }>({
    writable: false
  })
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const tagInputRef = useRef<HTMLInputElement>(null)
  const hasUserEditedRef = useRef(false)

  const updateFormField = useCallback(
    (updater: (prev: BookMetadataFields) => BookMetadataFields) => {
      hasUserEditedRef.current = true
      setForm(updater)
    },
    []
  )

  // Reset form snapshot if active book identity changes
  useEffect(() => {
    hasUserEditedRef.current = false
    const next = buildFormFromBook(book)
    setInitialForm(next)
    setForm(next)
    setTagDraft('')
    setErrorMessage(null)
    setWriteToFile(false)
    setCoverDimensions(null)
    setReadOnlyInfo({
      creatorTool: book.creatorTool,
      producer: book.producer,
      formatVersion: book.formatVersion
    })
  }, [book.id, book.filePath])

  // Load existing tags across the library for subtle autocomplete suggestions
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
        const sorted = Array.from(freq.values())
          .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
          .map((item) => item.label)
        setLibraryTags(sorted)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  // Check whether the source file on disk is eligible for opt-in write-back
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

  // Resolve active file buffer helper (reuses activeBookBuffer when available)
  const loadBookBuffer = useCallback(async (): Promise<ArrayBuffer | null> => {
    if (activeBookBuffer) return activeBookBuffer.slice(0)
    try {
      if (window.desktopAPI?.readFileBuffer && !/^(https?:|data:|blob:|\/assets\/|assets\/)/i.test(book.filePath)) {
        return await window.desktopAPI.readFileBuffer(book.filePath)
      }
      const resp = await fetch(book.filePath)
      if (resp.ok) return await resp.arrayBuffer()
    } catch {
      // Ignore buffer read failures
    }
    return null
  }, [activeBookBuffer, book.filePath])

  // Lazy-hydrate full embedded EPUB/PDF metadata (and read-only extra properties) on open
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

        // For books imported before metadata extraction existed, backfill empty fields non-destructively
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
            if (
              mergedPatch.publisher ||
              mergedPatch.publishedDate ||
              mergedPatch.language ||
              mergedPatch.identifier ||
              mergedPatch.series ||
              mergedPatch.rights
            ) {
              setShowDetails(true)
            }
          }
        }
      } catch {
        // Non-fatal: fall back to Dexie fields
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

  const populatedDetailsCount = useMemo(() => {
    const fields = [
      form.publisher,
      form.publishedDate,
      form.language,
      form.identifier,
      ...(isEpub ? [form.series, form.rights] : [])
    ]
    return fields.filter((v) => v.trim().length > 0).length
  }, [form.publisher, form.publishedDate, form.language, form.identifier, form.series, form.rights, isEpub])

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
        showToast('Restored original cover', 'info')
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

      // Opt-in atomic write-back to .epub or .pdf file on disk
      if (writeToFile && writableStatus.writable && (isEpub || isPdf) && window.desktopAPI?.writeBookMetadata) {
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
          showToast(
            res.warning || `Metadata saved to library and .${book.format} file`,
            'success'
          )
        } else {
          const msg = res.error || 'Could not write changes to source file.'
          setErrorMessage(`Saved to Semply library, but file write failed: ${msg}`)
          showToast('Saved to library; file write failed', 'error')
        }
      } else {
        showToast('Metadata saved', 'success')
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Could not save metadata.')
      showToast('Failed to save metadata', 'error')
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

  // Keyboard shortcut: Ctrl/Cmd+S saves while editor is active
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        if (isDirty && !isSaving) {
          handleSave()
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isDirty, isSaving, handleSave])

  const fileName = useMemo(() => {
    const clean = book.filePath.split(/[\\/]/).pop() || book.filePath
    return clean.split('?')[0]
  }, [book.filePath])

  const canRevealInFolder =
    Boolean(window.desktopAPI?.showItemInFolder) &&
    !/^(https?:|data:|blob:|\/assets\/|assets\/)/i.test(book.filePath)

  // Isolate printable/navigation keystrokes inside form controls from reader page-turn hotkeys
  const stopReaderKeyLeak = (e: React.KeyboardEvent) => {
    if (e.key !== 'Escape' && !((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's')) {
      e.stopPropagation()
    }
  }

  return (
    <div
      onKeyDown={stopReaderKeyLeak}
      className="flex flex-col h-full min-h-0 animate-in slide-in-from-right-2 fade-in duration-150"
    >
      {/* Drill-In Header */}
      <div className="px-3 py-2.5 border-b border-[var(--app-border)] flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="app-no-drag w-6 h-6 rounded-md flex items-center justify-center text-[var(--app-text-muted)] hover:text-[var(--app-text-strong)] hover:bg-[var(--app-surface-hover)] transition-colors"
            title="Back to More (Esc)"
            aria-label="Back to More settings"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-[13px] font-semibold tracking-[-0.015em] text-[var(--app-text-strong)] truncate">
            Metadata
          </span>
          <span className="px-1.5 py-0.5 rounded-[4px] bg-[var(--app-surface-2)] border border-[var(--app-border)] text-[9.5px] font-mono uppercase tracking-wider text-[var(--app-text-muted)] shrink-0">
            {book.format}
          </span>
          {isHydrating && (
            <Loader2 className="w-3 h-3 text-[var(--app-text-subtle)] animate-spin shrink-0" />
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="app-no-drag w-6 h-6 flex items-center justify-center text-[var(--app-text-muted)] hover:text-[var(--app-text-strong)] hover:bg-[var(--app-surface-hover)] rounded-md transition-colors"
          title="Close Reader Settings"
          aria-label="Close Reader Settings"
        >
          <X className="w-3.5 h-3.5 pointer-events-none" />
        </button>
      </div>

      {/* Scrollable Inspector Body */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3.5">
        {/* 1. Thumbnail & Cover Controls */}
        <section className="p-2.5 rounded-lg bg-[var(--app-surface)] border border-[var(--app-border)] flex items-start gap-3">
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
            className={`relative w-[68px] h-[98px] rounded-[6px] overflow-hidden shrink-0 border transition-all group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)] ${
              isDraggingCover
                ? 'border-[var(--app-accent)] ring-2 ring-[var(--app-accent-soft)]'
                : 'border-[var(--app-border-strong)] bg-[#141414]'
            }`}
            title="Click or drop an image to replace cover"
            aria-label="Book cover thumbnail — click or drop an image to replace"
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
              <div className="w-full h-full flex flex-col items-center justify-center p-1.5 text-center bg-[#18181b] text-[#888888]">
                <ImagePlus className="w-4 h-4 mb-1 opacity-70" />
                <span className="text-[9px] leading-tight">No cover</span>
              </div>
            )}

            {/* Hover / Drag Overlay */}
            <div
              className={`absolute inset-0 bg-black/65 flex items-center justify-center transition-opacity ${
                isDraggingCover ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              }`}
            >
              <span className="text-[10px] font-medium text-white px-1.5 py-0.5 rounded bg-black/50 border border-white/15">
                {isDraggingCover ? 'Drop' : 'Replace'}
              </span>
            </div>
          </button>

          <div className="flex-1 min-w-0 space-y-1.5 pt-0.5">
            <div className="flex items-center justify-between">
              <span className="text-[11.5px] font-semibold text-[var(--app-text-strong)]">
                Cover thumbnail
              </span>
              {coverDimensions && form.coverDataUrl && (
                <span className="text-[10px] font-mono tabular-nums text-[var(--app-text-subtle)]">
                  {coverDimensions.w}×{coverDimensions.h}
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="ice-btn-dark h-7 px-2.5 gap-1.5 text-[11px]"
              >
                <ImagePlus className="w-3 h-3" />
                <span>Change</span>
              </button>

              {(isEpub || isPdf) && (
                <button
                  type="button"
                  disabled={isResettingCover}
                  onClick={handleResetOriginalCover}
                  className="ice-btn-dark h-7 px-2 gap-1 text-[11px] disabled:opacity-50"
                  title={isPdf ? 'Re-render cover from PDF page 1' : 'Re-extract embedded EPUB cover'}
                >
                  {isResettingCover ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <RotateCcw className="w-3 h-3" />
                  )}
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
                  className="h-7 w-7 rounded-md border border-[var(--app-border)] bg-[var(--app-surface-2)] text-[var(--app-text-subtle)] hover:text-[#e5484d] hover:border-[#e5484d]/40 flex items-center justify-center transition-colors"
                  title="Remove thumbnail"
                  aria-label="Remove cover thumbnail"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>

            <p className="text-[10px] font-normal text-[var(--app-text-subtle)] leading-snug">
              Drop PNG, JPG, or WebP onto the thumbnail.
            </p>
          </div>
        </section>

        {/* 2. Core Identity & Tags */}
        <section className="space-y-2.5">
          <div className="space-y-1">
            <label
              htmlFor="meta-title"
              className="block text-[11px] font-semibold text-[var(--app-text-muted)]"
            >
              Title
            </label>
            <input
              id="meta-title"
              type="text"
              value={form.title}
              onChange={(e) => updateFormField((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="Book title"
              className="ice-input w-full h-8 px-2.5 text-[12px] select-text"
            />
          </div>

          <div className="space-y-1">
            <label
              htmlFor="meta-author"
              className="block text-[11px] font-semibold text-[var(--app-text-muted)]"
            >
              Author
            </label>
            <input
              id="meta-author"
              type="text"
              value={form.author}
              onChange={(e) => updateFormField((prev) => ({ ...prev, author: e.target.value }))}
              placeholder="Unknown Author"
              className="ice-input w-full h-8 px-2.5 text-[12px] select-text"
            />
          </div>

          {/* Geist Tag Token Input */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label
                htmlFor="meta-tags-input"
                className="text-[11px] font-semibold text-[var(--app-text-muted)]"
              >
                Tags
              </label>
              {form.tags.length > 0 && (
                <span className="text-[10px] font-mono tabular-nums text-[var(--app-text-subtle)]">
                  {form.tags.length}
                </span>
              )}
            </div>

            <div
              onClick={() => tagInputRef.current?.focus()}
              className={`min-h-[34px] px-2 py-1.5 rounded-[6px] bg-[var(--app-input-bg)] border transition-all flex flex-wrap items-center gap-1.5 ${
                isTagInputFocused
                  ? 'border-[var(--app-accent)] shadow-[0_0_0_2px_var(--app-accent-soft)]'
                  : 'border-[var(--app-border)]'
              }`}
            >
              {form.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-[4px] bg-[var(--app-surface-2)] border border-[var(--app-border)] text-[11px] text-[var(--app-text-strong)] max-w-full"
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
                id="meta-tags-input"
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
                className="flex-1 min-w-[84px] bg-transparent border-none outline-none text-[11.5px] text-[var(--app-text)] placeholder:text-[var(--app-text-subtle)] select-text py-0.5"
              />
            </div>

            {tagSuggestions.length > 0 && (isTagInputFocused || tagDraft.trim().length > 0) && (
              <div className="flex flex-wrap items-center gap-1 pt-0.5">
                <span className="text-[10px] text-[var(--app-text-subtle)] mr-0.5">Library:</span>
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
                    className="px-1.5 py-0.5 rounded-[4px] bg-[var(--app-surface)] hover:bg-[var(--app-surface-hover)] border border-[var(--app-border)] text-[10px] text-[var(--app-text-muted)] hover:text-[var(--app-text-strong)] transition-colors"
                  >
                    + {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Primary Synopsis / PDF Subject */}
          {isPdf ? (
            <div className="space-y-1">
              <label
                htmlFor="meta-subject"
                className="block text-[11px] font-semibold text-[var(--app-text-muted)]"
              >
                Subject
              </label>
              <textarea
                id="meta-subject"
                rows={2}
                value={form.subject}
                onChange={(e) => updateFormField((prev) => ({ ...prev, subject: e.target.value }))}
                placeholder="Document subject or summary"
                className="ice-input w-full px-2.5 py-1.5 text-[11.5px] leading-relaxed resize-y min-h-[54px] select-text"
              />
            </div>
          ) : (
            <div className="space-y-1">
              <label
                htmlFor="meta-description"
                className="block text-[11px] font-semibold text-[var(--app-text-muted)]"
              >
                Description
              </label>
              <textarea
                id="meta-description"
                rows={3}
                value={form.description}
                onChange={(e) =>
                  updateFormField((prev) => ({ ...prev, description: e.target.value }))
                }
                placeholder="Synopsis or notes about this book"
                className="ice-input w-full px-2.5 py-1.5 text-[11.5px] leading-relaxed resize-y min-h-[68px] select-text"
              />
            </div>
          )}
        </section>

        {/* 3. Collapsible Extended Metadata */}
        <section className="rounded-lg bg-[var(--app-surface)] border border-[var(--app-border)] overflow-hidden">
          <button
            type="button"
            onClick={() => setShowDetails((v) => !v)}
            className="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-[var(--app-surface-hover)] transition-colors"
            aria-expanded={showDetails}
          >
            <div className="flex items-center gap-1.5">
              {showDetails ? (
                <ChevronDown className="w-3.5 h-3.5 text-[var(--app-text-subtle)]" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-[var(--app-text-subtle)]" />
              )}
              <span className="text-[11.5px] font-semibold text-[var(--app-text-strong)]">
                Publishing &amp; details
              </span>
            </div>
            <span className="text-[10px] font-mono tabular-nums text-[var(--app-text-subtle)]">
              {populatedDetailsCount > 0 ? `${populatedDetailsCount} set` : 'Optional'}
            </span>
          </button>

          {showDetails && (
            <div className="px-3 pb-3 pt-2 border-t border-[var(--app-border)] space-y-2.5">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label
                    htmlFor="meta-publisher"
                    className="block text-[10.5px] font-semibold text-[var(--app-text-muted)]"
                  >
                    Publisher
                  </label>
                  <input
                    id="meta-publisher"
                    type="text"
                    value={form.publisher}
                    onChange={(e) =>
                      updateFormField((prev) => ({ ...prev, publisher: e.target.value }))
                    }
                    placeholder="Publisher"
                    className="ice-input w-full h-7 px-2 text-[11.5px] select-text"
                  />
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="meta-date"
                    className="block text-[10.5px] font-semibold text-[var(--app-text-muted)]"
                  >
                    Published
                  </label>
                  <input
                    id="meta-date"
                    type="text"
                    value={form.publishedDate}
                    onChange={(e) =>
                      updateFormField((prev) => ({ ...prev, publishedDate: e.target.value }))
                    }
                    placeholder="YYYY-MM-DD"
                    className="ice-input w-full h-7 px-2 text-[11.5px] font-mono tabular-nums select-text"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label
                    htmlFor="meta-language"
                    className="block text-[10.5px] font-semibold text-[var(--app-text-muted)]"
                  >
                    Language
                  </label>
                  <input
                    id="meta-language"
                    type="text"
                    value={form.language}
                    onChange={(e) =>
                      updateFormField((prev) => ({ ...prev, language: e.target.value }))
                    }
                    placeholder="en"
                    className="ice-input w-full h-7 px-2 text-[11.5px] select-text"
                  />
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="meta-identifier"
                    className="block text-[10.5px] font-semibold text-[var(--app-text-muted)]"
                  >
                    ISBN / ID
                  </label>
                  <input
                    id="meta-identifier"
                    type="text"
                    value={form.identifier}
                    onChange={(e) =>
                      updateFormField((prev) => ({ ...prev, identifier: e.target.value }))
                    }
                    placeholder="978-..."
                    className="ice-input w-full h-7 px-2 text-[11.5px] font-mono tabular-nums select-text"
                  />
                </div>
              </div>

              {isEpub && (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2 space-y-1">
                      <label
                        htmlFor="meta-series"
                        className="block text-[10.5px] font-semibold text-[var(--app-text-muted)]"
                      >
                        Series
                      </label>
                      <input
                        id="meta-series"
                        type="text"
                        value={form.series}
                        onChange={(e) =>
                          updateFormField((prev) => ({ ...prev, series: e.target.value }))
                        }
                        placeholder="Series name"
                        className="ice-input w-full h-7 px-2 text-[11.5px] select-text"
                      />
                    </div>

                    <div className="space-y-1">
                      <label
                        htmlFor="meta-series-index"
                        className="block text-[10.5px] font-semibold text-[var(--app-text-muted)]"
                      >
                        Book #
                      </label>
                      <input
                        id="meta-series-index"
                        type="text"
                        value={form.seriesIndex}
                        onChange={(e) =>
                          updateFormField((prev) => ({ ...prev, seriesIndex: e.target.value }))
                        }
                        placeholder="1"
                        className="ice-input w-full h-7 px-2 text-[11.5px] font-mono tabular-nums select-text"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label
                      htmlFor="meta-rights"
                      className="block text-[10.5px] font-semibold text-[var(--app-text-muted)]"
                    >
                      Rights
                    </label>
                    <input
                      id="meta-rights"
                      type="text"
                      value={form.rights}
                      onChange={(e) =>
                        updateFormField((prev) => ({ ...prev, rights: e.target.value }))
                      }
                      placeholder="Copyright or license"
                      className="ice-input w-full h-7 px-2 text-[11.5px] select-text"
                    />
                  </div>
                </>
              )}

              {isPdf && (
                <div className="space-y-1">
                  <label
                    htmlFor="meta-notes"
                    className="block text-[10.5px] font-semibold text-[var(--app-text-muted)]"
                  >
                    Library notes
                  </label>
                  <textarea
                    id="meta-notes"
                    rows={2}
                    value={form.description}
                    onChange={(e) =>
                      updateFormField((prev) => ({ ...prev, description: e.target.value }))
                    }
                    placeholder="Personal synopsis stored in Semply"
                    className="ice-input w-full px-2 py-1.5 text-[11.5px] resize-y select-text"
                  />
                </div>
              )}

              {/* Embedded Read-Only Document Properties (Creator, Producer, Extra XML/PDF keys) */}
              {(readOnlyInfo.creatorTool ||
                readOnlyInfo.producer ||
                readOnlyInfo.modificationDate ||
                (readOnlyInfo.extraEntries && readOnlyInfo.extraEntries.length > 0)) && (
                <div className="pt-2 border-t border-[var(--app-border)] space-y-1">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--app-text-subtle)]">
                    Embedded properties
                  </div>
                  <dl className="space-y-1 text-[10.5px]">
                    {readOnlyInfo.creatorTool && (
                      <div className="flex items-baseline justify-between gap-2">
                        <dt className="text-[var(--app-text-subtle)] shrink-0">Creator</dt>
                        <dd className="text-[var(--app-text-muted)] truncate text-right select-text">
                          {readOnlyInfo.creatorTool}
                        </dd>
                      </div>
                    )}
                    {readOnlyInfo.producer && (
                      <div className="flex items-baseline justify-between gap-2">
                        <dt className="text-[var(--app-text-subtle)] shrink-0">Producer</dt>
                        <dd className="text-[var(--app-text-muted)] truncate text-right select-text">
                          {readOnlyInfo.producer}
                        </dd>
                      </div>
                    )}
                    {readOnlyInfo.modificationDate && (
                      <div className="flex items-baseline justify-between gap-2">
                        <dt className="text-[var(--app-text-subtle)] shrink-0">Modified</dt>
                        <dd className="text-[var(--app-text-muted)] font-mono tabular-nums truncate text-right">
                          {readOnlyInfo.modificationDate}
                        </dd>
                      </div>
                    )}
                    {readOnlyInfo.extraEntries?.map((entry) => (
                      <div key={entry.key} className="flex items-baseline justify-between gap-2">
                        <dt className="text-[var(--app-text-subtle)] truncate max-w-[110px]" title={entry.key}>
                          {entry.key}
                        </dt>
                        <dd className="text-[var(--app-text-muted)] truncate text-right select-text" title={entry.value}>
                          {entry.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
            </div>
          )}
        </section>

        {/* 4. Quiet File Info Card */}
        <section className="px-3 py-2 rounded-lg bg-[var(--app-surface)] border border-[var(--app-border)] space-y-1.5">
          <div className="flex items-center justify-between text-[10.5px]">
            <span className="text-[var(--app-text-subtle)]">Document</span>
            <span className="font-mono tabular-nums text-[var(--app-text-muted)]">
              {readOnlyInfo.formatVersion || book.format.toUpperCase()} · {book.totalPages} pp ·{' '}
              {formatFileSize(book.fileSize)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-[var(--app-border)]">
            <span
              className="text-[10.5px] font-mono text-[var(--app-text-muted)] truncate select-text"
              title={book.filePath}
            >
              {fileName}
            </span>
            {canRevealInFolder && (
              <button
                type="button"
                onClick={() => window.desktopAPI?.showItemInFolder?.(book.filePath)}
                className="w-6 h-6 rounded-md flex items-center justify-center text-[var(--app-text-subtle)] hover:text-[var(--app-text-strong)] hover:bg-[var(--app-surface-hover)] transition-colors shrink-0"
                title="Reveal file in folder"
                aria-label="Reveal file in folder"
              >
                <FolderOpen className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </section>

        {errorMessage && (
          <div
            role="alert"
            className="p-2.5 rounded-lg bg-[#e5484d]/10 border border-[#e5484d]/30 text-[#f47c7c] text-[11px] flex items-start gap-2 leading-snug"
          >
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>

      {/* Sticky Footer: Opt-In Write-To-File + Discard/Save */}
      <div className="px-3 py-2.5 border-t border-[var(--app-border)] bg-[var(--app-chrome)] space-y-2.5 shrink-0">
        {writableStatus.writable ? (
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <HardDrive className="w-3 h-3 text-[var(--app-text-subtle)] shrink-0" />
                <span className="text-[11px] font-medium text-[var(--app-text-muted)] truncate">
                  Write to .{book.format} file
                </span>
              </div>
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
                title={`Also update metadata inside the source .${book.format} file on disk`}
              >
                <span
                  className={`w-3 h-3 rounded-full bg-white shadow-sm block transition-transform duration-150 ${
                    writeToFile ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
            {writeToFile && isPdf && coverChanged && (
              <p className="text-[10px] font-normal text-[var(--app-text-subtle)] leading-snug">
                PDF info updates on disk; custom cover stays in Semply.
              </p>
            )}
          </div>
        ) : (
          <div
            className="text-[10px] font-normal text-[var(--app-text-subtle)] truncate"
            title={writableStatus.reason}
          >
            {writableStatus.reason || 'Saved to Semply library'}
          </div>
        )}

        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            disabled={!isDirty || isSaving}
            onClick={handleDiscard}
            className="ice-btn-dark h-8 px-3 text-[11.5px] disabled:opacity-40 disabled:pointer-events-none"
          >
            Discard
          </button>

          <button
            type="button"
            disabled={!isDirty || isSaving}
            onClick={handleSave}
            className="ice-btn-blue h-8 px-3.5 gap-1.5 text-[11.5px] disabled:opacity-40 disabled:pointer-events-none"
            title="Save changes (Ctrl+S)"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Save changes</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
