import React, { useEffect } from 'react'
import { X, Info } from 'lucide-react'
import { useAppStore } from '../../stores/useAppStore'
import semplyLogo from '../../assets/icons/semply_logo.png'

export const AboutModal: React.FC = () => {
  const { isAboutModalOpen, toggleAboutModal } = useAppStore()

  useEffect(() => {
    if (!isAboutModalOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') toggleAboutModal(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isAboutModalOpen, toggleAboutModal])

  if (!isAboutModalOpen) return null

  return (
    <div
      onClick={() => toggleAboutModal(false)}
      className="fixed inset-0 z-[120] bg-black/60 flex items-center justify-center p-4 select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[var(--app-surface)] border border-[var(--app-border-strong)] rounded-lg w-full max-w-sm shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100"
      >
        <div className="h-10 bg-[var(--app-chrome)] border-b border-[var(--app-border)] px-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[var(--app-text-strong)]">
            <Info className="w-4 h-4 text-[var(--app-accent)]" />
            <span className="text-[13px] font-semibold">About Semply</span>
          </div>
          <button
            type="button"
            onClick={() => toggleAboutModal(false)}
            className="settings-close-btn w-6 h-6 flex items-center justify-center rounded cursor-pointer"
            title="Close (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 text-center space-y-4">
          <img
            src={semplyLogo}
            alt="Semply Logo"
            draggable={false}
            className="w-16 h-16 mx-auto rounded-xl object-cover"
          />
          <div>
            <h2 className="text-lg font-semibold text-[var(--app-text-strong)]">Semply Reader</h2>
            <p className="text-xs text-[var(--app-text-muted)]">Version 1.0.0</p>
          </div>
          <p className="text-xs text-[var(--app-text)] leading-relaxed">
            Pure reading. Native speed. <br />
            100% local-first, privacy-focused, and open source under the MIT License.
          </p>
        </div>
        <div className="bg-[var(--app-chrome)] border-t border-[var(--app-border)] p-4 flex justify-center gap-4">
          <a
            href="https://github.com/ederaefe/EPUB-Reader-Desktop"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[var(--app-accent-text)] hover:underline"
          >
            GitHub
          </a>
          <a
            href="https://github.com/ederaefe/EPUB-Reader-Desktop/blob/main/documentation.md"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[var(--app-accent-text)] hover:underline"
          >
            User Manual
          </a>
          <a
            href="https://github.com/ederaefe/EPUB-Reader-Desktop#readme"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[var(--app-accent-text)] hover:underline"
          >
            Website
          </a>
        </div>
      </div>
    </div>
  )
}
