import React, { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertCircle, RotateCcw, BookOpen, Copy, Check, ExternalLink, Mail } from 'lucide-react'

interface Props {
  children: ReactNode
  fallbackTitle?: string
  onReset?: () => void
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  copied: boolean
  copiedEmail: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  private copyTimeout: ReturnType<typeof setTimeout> | null = null
  private emailTimeout: ReturnType<typeof setTimeout> | null = null

  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false,
      copiedEmail: false
    }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught renderer component error:', error, errorInfo)
    this.setState({ errorInfo })
  }

  componentWillUnmount() {
    if (this.copyTimeout) clearTimeout(this.copyTimeout)
    if (this.emailTimeout) clearTimeout(this.emailTimeout)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null, copied: false, copiedEmail: false })
    if (this.props.onReset) {
      this.props.onReset()
    }
  }

  handleReload = () => {
    window.location.reload()
  }

  handleCopyLogs = async () => {
    const err = this.state.error
    const info = this.state.errorInfo

    const reportLines = [
      '### Semply Error Diagnostic Log',
      `- **App Version**: 1.0.3`,
      `- **Environment**: ${navigator.userAgent}`,
      `- **Timestamp**: ${new Date().toISOString()}`,
      `- **Error**: ${err?.name || 'Error'}: ${err?.message || 'Unknown error'}`,
      '',
      '#### Stack Trace',
      '```',
      err?.stack || 'No stack trace available',
      '```',
      ''
    ]

    if (info?.componentStack) {
      reportLines.push('#### Component Hierarchy', '```', info.componentStack.trim(), '```')
    }

    const payload = reportLines.join('\n')

    try {
      await navigator.clipboard.writeText(payload)
      this.setState({ copied: true })
      if (this.copyTimeout) clearTimeout(this.copyTimeout)
      this.copyTimeout = setTimeout(() => this.setState({ copied: false }), 2500)
    } catch (e) {
      console.warn('Failed to copy to clipboard:', e)
    }
  }

  handleOpenGitHubIssues = () => {
    const issuesUrl = 'https://github.com/ederaefe/EPUB-Reader-Desktop/issues/new'
    if (window.desktopAPI?.openExternal) {
      window.desktopAPI.openExternal(issuesUrl)
    } else {
      window.open(issuesUrl, '_blank', 'noopener,noreferrer')
    }
  }

  handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText('efeoghene@proton.me')
      this.setState({ copiedEmail: true })
      if (this.emailTimeout) clearTimeout(this.emailTimeout)
      this.emailTimeout = setTimeout(() => this.setState({ copiedEmail: false }), 2500)
    } catch (e) {
      console.warn('Failed to copy email to clipboard:', e)
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 w-full h-full min-h-[300px] flex items-center justify-center p-6 bg-[#0a0a0a] text-[#ededed] select-none">
          <div className="max-w-md w-full bg-[#141414] border border-white/[0.08] rounded-xl p-6 shadow-2xl flex flex-col items-center text-center">
            {/* Warning Icon Medallion */}
            <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mb-3.5">
              <AlertCircle className="w-6 h-6" />
            </div>

            {/* Error Heading & Assurance */}
            <h2 className="text-[16px] font-semibold text-white tracking-[-0.01em] mb-1.5">
              {this.props.fallbackTitle || 'Something interrupted the reader'}
            </h2>

            <p className="text-[12.5px] text-[#888888] leading-relaxed mb-3.5">
              An unexpected interface error occurred. Your reading position and library data remain safely stored.
            </p>

            {/* Error Message Box */}
            {this.state.error && (
              <div className="w-full bg-[#0a0a0a] border border-white/[0.06] rounded-md p-2.5 mb-4 text-left overflow-x-auto text-[11px] font-mono text-[#aaaaaa] max-h-24 select-text">
                {this.state.error.message || 'Unknown error'}
              </div>
            )}

            {/* Diagnostic Logs & GitHub Issue Actions */}
            <div className="grid grid-cols-2 gap-2 w-full mb-2">
              <button
                type="button"
                onClick={this.handleCopyLogs}
                className={`h-8 rounded-lg text-[11.5px] font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer border ${
                  this.state.copied
                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                    : 'bg-white/[0.05] border-white/[0.08] hover:bg-white/[0.1] text-white'
                }`}
                title="Copy error details and system environment to clipboard"
              >
                {this.state.copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Logs copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy error logs</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={this.handleOpenGitHubIssues}
                className="h-8 rounded-lg bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.1] text-white text-[11.5px] font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                title="Open GitHub Issues page to submit bug report"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Report on GitHub</span>
              </button>
            </div>

            {/* Email Developer Support Bar */}
            <div className="flex items-center justify-between w-full px-2.5 py-1.5 bg-[#0a0a0a] border border-white/[0.06] rounded-lg mb-3 text-[11px] text-[#aaaaaa]">
              <a
                href="mailto:efeoghene@proton.me?subject=Semply%20Error%20Report"
                className="inline-flex items-center gap-1.5 text-white/90 hover:text-white transition-colors"
                title="Send error report email to efeoghene@proton.me"
              >
                <Mail className="w-3.5 h-3.5 text-blue-400" />
                <span>efeoghene@proton.me</span>
              </a>
              <button
                type="button"
                onClick={this.handleCopyEmail}
                className={`px-2 py-0.5 rounded text-[10.5px] font-medium transition-all cursor-pointer border ${
                  this.state.copiedEmail
                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                    : 'bg-white/[0.05] border-white/[0.08] hover:bg-white/[0.1] text-white/80'
                }`}
                title="Copy developer email to clipboard"
              >
                {this.state.copiedEmail ? 'Copied!' : 'Copy email'}
              </button>
            </div>

            {/* Primary Recovery Actions */}
            <div className="flex items-center gap-2 w-full pt-1">
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
                className="flex-1 h-8 rounded-lg bg-white text-black hover:bg-white/90 text-[12px] font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
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
