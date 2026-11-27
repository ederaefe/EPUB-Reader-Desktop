import React, { useEffect } from 'react'
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X, Download } from 'lucide-react'
import { useAppStore } from '../../stores/useAppStore'

export const NativeFeedbackHost: React.FC = () => {
  const {
    toast,
    clearToast,
    confirmDialog,
    closeConfirmDialog,
    availableUpdate,
    showUpdateToast,
    setShowUpdateToast,
    setPendingUpdateBadge
  } = useAppStore()

  // Keyboard shortcuts for native confirmation dialog (Escape cancels, Enter confirms)
  useEffect(() => {
    if (!confirmDialog) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        closeConfirmDialog()
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const action = confirmDialog.onConfirm
        closeConfirmDialog()
        Promise.resolve(action()).catch(() => {})
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [confirmDialog, closeConfirmDialog])

  return (
    <>
      {/* Global Contextual Toast */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-12 right-5 z-[120] max-w-sm flex items-center gap-2.5 px-3.5 py-2.5 bg-[#121316]/95 backdrop-blur-md border border-white/10 text-[#ededed] text-xs rounded-lg shadow-[0_16px_48px_rgba(0,0,0,0.75)] select-none animate-in fade-in slide-in-from-bottom-2 duration-200"
        >
          {toast.variant === 'error' ? (
            <AlertCircle className="w-4 h-4 text-[#f85149] shrink-0" />
          ) : toast.variant === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-[#4cd964] shrink-0" />
          ) : (
            <Info className="w-4 h-4 text-[#66b2ff] shrink-0" />
          )}
          <span className="leading-snug flex-1 font-normal tracking-wide">{toast.message}</span>
          <button
            type="button"
            onClick={clearToast}
            className="w-5 h-5 flex items-center justify-center rounded text-[#888888] hover:text-white hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
            aria-label="Dismiss notification"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Global Interactive Update Notification Card */}
      {availableUpdate && showUpdateToast && (
        <aside
          role="region"
          aria-label="App update available"
          className="fixed bottom-5 right-5 z-[125] w-[360px] max-w-[92vw] bg-[#121316]/98 backdrop-blur-md border border-white/15 rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.85)] p-4 select-none animate-in fade-in slide-in-from-bottom-3 duration-200"
        >
          <div className="flex items-start justify-between gap-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
                <Download className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-[13px] font-semibold text-white truncate">
                    Update Available
                  </h4>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-medium">
                    v{availableUpdate.latestVersion}
                  </span>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowUpdateToast(false)
                setPendingUpdateBadge(true)
              }}
              className="text-[#888888] hover:text-white p-1 rounded hover:bg-white/10 transition-colors cursor-pointer"
              title="Remind me later"
              aria-label="Close update notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {availableUpdate.releaseNotes && (
            <div className="mt-2.5 pt-2 border-t border-white/[0.08] text-[11.5px] text-[#a0a0a0] leading-relaxed max-h-24 overflow-y-auto space-y-1">
              <span className="text-[10.5px] font-semibold uppercase tracking-wider text-[#d0d0d0] block">
                What's New:
              </span>
              <p className="whitespace-pre-line text-[#b0b0b0]">
                {availableUpdate.releaseNotes}
              </p>
            </div>
          )}

          <div className="mt-3.5 pt-2.5 border-t border-white/[0.08] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setShowUpdateToast(false)
                setPendingUpdateBadge(true)
              }}
              className="h-7 px-3 rounded-md text-[11.5px] font-medium text-[#a0a0a0] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              Later
            </button>
            <button
              type="button"
              onClick={() => {
                setShowUpdateToast(false)
                setPendingUpdateBadge(false)
                const target =
                  availableUpdate.downloadUrl ||
                  availableUpdate.releaseUrl ||
                  'https://github.com/ederaefe/EPUB-Reader-Desktop/releases/latest'
                if (window.desktopAPI?.openExternal) {
                  window.desktopAPI.openExternal(target)
                } else {
                  window.open(target, '_blank', 'noopener,noreferrer')
                }
              }}
              className="h-7 px-3.5 rounded-md text-[11.5px] font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer shadow-sm"
            >
              Update Now
            </button>
          </div>
        </aside>
      )}

      {/* Global Native-Style In-App Confirmation Dialog (replaces window.confirm) */}
      {confirmDialog && (
        <div
          onClick={closeConfirmDialog}
          className="fixed inset-0 z-[130] flex items-center justify-center bg-black/65 backdrop-blur-[2px] select-none p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-[380px] max-w-[92vw] bg-[#111111] border border-white/[0.12] rounded-xl shadow-[0_24px_72px_rgba(0,0,0,0.85)] overflow-hidden animate-in fade-in zoom-in-95 duration-100"
          >
            <div className="p-5 space-y-2.5">
              <div className="flex items-start gap-3">
                {confirmDialog.danger && (
                  <div
                    className="w-8 h-8 rounded-lg bg-[#e5484d]/15 border border-[#e5484d]/30 flex items-center justify-center shrink-0 mt-0.5"
                    data-preserve-theme="true"
                  >
                    <AlertTriangle className="w-4 h-4 text-[#e5484d]" />
                  </div>
                )}
                <div className="space-y-1.5 min-w-0">
                  <h3 className="text-[14px] font-semibold tracking-[-0.015em] text-white">
                    {confirmDialog.title}
                  </h3>
                  <p className="text-[12px] text-[#888888] leading-relaxed">
                    {confirmDialog.message}
                  </p>
                </div>
              </div>
            </div>
            <div className="px-5 py-3 bg-[#0a0a0a] border-t border-white/[0.07] flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeConfirmDialog}
                className="ice-btn-dark h-8 px-3.5 text-xs cursor-pointer"
              >
                {confirmDialog.cancelLabel || 'Cancel'}
              </button>
              <button
                type="button"
                data-preserve-theme={confirmDialog.danger ? 'true' : undefined}
                onClick={() => {
                  const action = confirmDialog.onConfirm
                  closeConfirmDialog()
                  Promise.resolve(action()).catch(() => {})
                }}
                className={`h-8 px-3.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                  confirmDialog.danger
                    ? 'bg-[#e5484d] hover:bg-[#f2555a] text-white'
                    : 'bg-[var(--app-btn-primary-bg)] hover:bg-[var(--app-btn-primary-hover)] text-[var(--app-btn-primary-fg)]'
                }`}
              >
                {confirmDialog.confirmLabel || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
