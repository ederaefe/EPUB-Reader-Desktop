import React, { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertCircle, RotateCcw, BookOpen } from 'lucide-react'

interface Props {
  children: ReactNode
  fallbackTitle?: string
  onReset?: () => void
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught renderer component error:', error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
    if (this.props.onReset) {
      this.props.onReset()
    }
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 w-full h-full min-h-[300px] flex items-center justify-center p-6 bg-[#0a0a0a] text-[#ededed] select-none">
          <div className="max-w-md w-full bg-[#141414] border border-white/[0.08] rounded-xl p-6 shadow-2xl flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mb-4">
              <AlertCircle className="w-6 h-6" />
            </div>

            <h2 className="text-[16px] font-semibold text-white tracking-[-0.01em] mb-1.5">
              {this.props.fallbackTitle || 'Something interrupted the reader'}
            </h2>

            <p className="text-[12.5px] text-[#888888] leading-relaxed mb-4">
              An unexpected interface error occurred. Your reading position and library data are safely stored.
            </p>

            {this.state.error && (
              <div className="w-full bg-[#0a0a0a] border border-white/[0.06] rounded-md p-2.5 mb-5 text-left overflow-x-auto text-[11px] font-mono text-[#aaaaaa]">
                {this.state.error.message || 'Unknown error'}
              </div>
            )}

            <div className="flex items-center gap-2.5 w-full">
              <button
                type="button"
                onClick={this.handleReset}
                className="flex-1 h-8 rounded-lg bg-white/[0.08] hover:bg-white/[0.12] text-white text-[12px] font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Try again</span>
              </button>

              <button
                type="button"
                onClick={this.handleReload}
                className="flex-1 h-8 rounded-lg bg-white text-black hover:bg-white/90 text-[12px] font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reload app</span>
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
