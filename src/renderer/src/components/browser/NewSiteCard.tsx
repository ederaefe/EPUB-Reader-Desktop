import React, { useState } from 'react'
import { Plus, X, Globe, Loader2, AlertCircle } from 'lucide-react'

interface NewSiteCardProps {
  onAddSite: (site: { id: string; name: string; url: string; hostname: string }) => void
  disabled?: boolean
}

/**
 * Theme-adaptive "New Site" slot rendered in the Get Books directory.
 * Matches the geometry, squircle borders, and medallion of AddBookCard.
 */
export const NewSiteCard: React.FC<NewSiteCardProps> = ({ onAddSite, disabled = false }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [urlInput, setUrlInput] = useState('')
  const [nameInput, setNameInput] = useState('')
  const [isValidating, setIsValidating] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleOpenModal = () => {
    setUrlInput('')
    setNameInput('')
    setErrorMessage(null)
    setIsOpen(true)
  }

  const handleCloseModal = () => {
    if (isValidating) return
    setIsOpen(false)
    setErrorMessage(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedUrl = urlInput.trim()
    if (!trimmedUrl) return

    setIsValidating(true)
    setErrorMessage(null)

    try {
      if (window.desktopAPI?.bookBrowser?.validateBookSite) {
        const result = await window.desktopAPI.bookBrowser.validateBookSite(trimmedUrl)
        if (!result.valid) {
          setErrorMessage(result.error || 'Only e-book archives, digital libraries, and reading portals can be added.')
          setIsValidating(false)
          return
        }

        const siteName = nameInput.trim() || result.title || result.hostname || 'Custom Book Portal'
        const fullUrl = trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')
          ? trimmedUrl
          : `https://${trimmedUrl}`

        onAddSite({
          id: `custom-${Date.now()}`,
          name: siteName,
          url: fullUrl,
          hostname: result.hostname || new URL(fullUrl).hostname
        })
        setIsOpen(false)
      } else {
        // Fallback for web preview testing
        const parsed = new URL(trimmedUrl.includes('://') ? trimmedUrl : `https://${trimmedUrl}`)
        onAddSite({
          id: `custom-${Date.now()}`,
          name: nameInput.trim() || parsed.hostname,
          url: parsed.href,
          hostname: parsed.hostname
        })
        setIsOpen(false)
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Invalid web address format.')
    } finally {
      setIsValidating(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpenModal}
        disabled={disabled}
        aria-label="Add custom book website"
        className="w-36 flex flex-col cursor-pointer group select-none transition-transform duration-150 hover:-translate-y-0.5 text-left focus:outline-none disabled:opacity-50"
      >
        {/* Theme-adaptive squircle dashed slot matching AddBookCard */}
        <div className="w-full aspect-[3/4.4] rounded-xl bg-[var(--app-surface)] group-hover:bg-[var(--app-surface-hover)] border-2 border-dashed border-[var(--app-border-strong)] group-hover:border-[var(--app-accent)] relative overflow-hidden flex flex-col items-center justify-center transition-all duration-150">
          <div className="w-11 h-11 rounded-full bg-[var(--app-surface-2)] border border-[var(--app-border)] group-hover:bg-[var(--app-accent-soft)] group-hover:border-[var(--app-accent)]/40 flex items-center justify-center transition-all duration-150">
            <Plus
              className="w-5 h-5 text-[var(--app-text-muted)] group-hover:text-[var(--app-accent-text)] transition-colors"
              strokeWidth={2.25}
            />
          </div>
          <span className="mt-3 text-[12px] font-semibold text-[var(--app-text-muted)] group-hover:text-[var(--app-text-strong)] transition-colors">
            New Site
          </span>
        </div>
      </button>

      {/* Accessible Modal Dialog */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150"
          onClick={handleCloseModal}
        >
          <div
            className="w-full max-w-md bg-[var(--app-surface)] border border-[var(--app-border)] rounded-xl shadow-2xl p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[var(--app-border)]">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[var(--app-surface-2)] border border-[var(--app-border)] flex items-center justify-center text-[var(--app-accent)]">
                  <Globe className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[var(--app-text-strong)] leading-tight">
                    Add Book Website
                  </h3>
                  <p className="text-[11px] text-[var(--app-text-muted)]">
                    Connect an e-book archive, digital library, or personal server
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                disabled={isValidating}
                className="w-7 h-7 rounded-md flex items-center justify-center text-[var(--app-text-muted)] hover:text-[var(--app-text-strong)] hover:bg-[var(--app-surface-hover)] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-semibold text-[var(--app-text-muted)] mb-1 uppercase tracking-wider font-mono">
                  Website URL
                </label>
                <input
                  type="text"
                  autoFocus
                  required
                  placeholder="e.g. https://archive.org or calibre server"
                  value={urlInput}
                  onChange={(e) => {
                    setUrlInput(e.target.value)
                    if (errorMessage) setErrorMessage(null)
                  }}
                  disabled={isValidating}
                  className="w-full h-9 px-3 text-xs bg-[var(--app-surface-2)] border border-[var(--app-border)] rounded-md text-[var(--app-text-strong)] placeholder:text-[var(--app-text-muted)]/60 focus:outline-none focus:border-[var(--app-accent)] transition-colors"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[var(--app-text-muted)] mb-1 uppercase tracking-wider font-mono">
                  Custom Title (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Auto-detected from website if empty"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  disabled={isValidating}
                  className="w-full h-9 px-3 text-xs bg-[var(--app-surface-2)] border border-[var(--app-border)] rounded-md text-[var(--app-text-strong)] placeholder:text-[var(--app-text-muted)]/60 focus:outline-none focus:border-[var(--app-accent)] transition-colors"
                />
              </div>

              {/* Error feedback */}
              {errorMessage && (
                <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 flex items-start gap-2 text-red-400 text-[11px] leading-relaxed">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--app-border)]">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  disabled={isValidating}
                  className="px-3 py-1.5 text-xs text-[var(--app-text-muted)] hover:text-[var(--app-text-strong)] rounded-md hover:bg-[var(--app-surface-hover)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!urlInput.trim() || isValidating}
                  className="px-4 py-1.5 text-xs font-semibold rounded-md bg-[var(--app-accent)] text-white hover:brightness-110 disabled:opacity-50 transition-all flex items-center gap-1.5"
                >
                  {isValidating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isValidating ? 'Verifying Portal...' : 'Test & Add'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
