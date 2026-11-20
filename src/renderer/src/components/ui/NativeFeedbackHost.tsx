import React, { useEffect } from 'react'
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react'
import { useAppStore } from '../../stores/useAppStore'

export const NativeFeedbackHost: React.FC = () => {
  const { toast, clearToast, confirmDialog, closeConfirmDialog } = useAppStore()

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
