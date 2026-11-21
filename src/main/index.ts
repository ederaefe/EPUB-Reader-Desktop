import { app, BrowserWindow, ipcMain, dialog, shell, Menu, screen, session, type IpcMainInvokeEvent } from 'electron'
import { autoUpdater } from 'electron-updater'
import { join, extname, basename, resolve, normalize, dirname } from 'path'
import { readFile, readdir, writeFile, mkdir, stat, rename, unlink } from 'fs/promises'
import { existsSync, readFileSync, writeFileSync, realpathSync, renameSync, unlinkSync } from 'fs'
import { createHash, randomBytes } from 'crypto'
import { fileURLToPath } from 'url'
import { convertPdfToEpub } from './pdfToEpubEngine'
import { checkBookFileWritable, writeBookMetadataToFile } from './metadataService'
import type { WriteBookMetadataRequest } from '../shared/bookMetadata'
import {
  checkIsOnline,
  downloadFont,
  getFontFaceCss,
  listDownloadedFontIds
} from './fontService'
import {
  approveSessionReadPath,
  assertWithinAuthorizedBoundary,
  authorizeFile,
  authorizeFolder,
  clearVaultFolder,
  copyFileIntoVaultIfConfigured,
  getSecurityStatus,
  importBufferIntoVault,
  removeAuthorizedFolder,
  setCopyImportsIntoVault,
  setStrictOfflineMode,
  setStrictVaultOnly,
  setVaultFolder
} from './securityBoundaryService'
import {
  getMainEgressSession,
  lookupDictionaryInMain,
  lookupWikipediaInMain
} from './networkService'

const ALLOWED_EXTERNAL_BROWSER_HOSTS = [
  'github.com',
  'wikipedia.org',
  'wiktionary.org',
  'merriam-webster.com',
  'oxfordlearnersdictionaries.com',
  'dictionary.cambridge.org',
  'collinsdictionary.com',
  'translate.google.com',
  'deepl.com',
  'vocabulary.com'
]

function isAllowedExternalBrowserHost(hostname: string): boolean {
  const host = hostname.toLowerCase()
  return ALLOWED_EXTERNAL_BROWSER_HOSTS.some((suffix) => host === suffix || host.endsWith(`.${suffix}`))
}

let mainWindow: BrowserWindow | null = null
let pendingExternalFile: string | null = null

const SUPPORTED_EXTS = new Set(['.epub', '.pdf'])
const ALLOWED_READ_EXTS = new Set(['.epub', '.pdf', '.mobi', '.txt', '.json', '.zip'])
const ALLOWED_WRITE_EXTS = new Set(['.json', '.zip', '.epub', '.txt', '.md', '.html'])
const MAX_BUFFER_READ_SIZE = 250 * 1024 * 1024 // 250 MB ceiling to prevent main process memory exhaustion
const MAX_TEXT_READ_SIZE = 100 * 1024 * 1024 // 100 MB ceiling for UTF-8 text reads (supports large JSON backups)
const MAX_WRITE_SIZE = 250 * 1024 * 1024 // 250 MB ceiling for file writes

// Capability set tracking canonical paths explicitly chosen by the user via OS Save Dialog
const approvedSavePaths = new Set<string>()

function canonicalKey(p: string): string {
  const norm = normalize(resolve(p))
  return process.platform === 'win32' ? norm.toLowerCase() : norm
}

function resolveNearestRealPath(targetPath: string): string {
  let cursor = normalize(resolve(targetPath))
  const trailingSegments: string[] = []
  while (!existsSync(cursor)) {
    const parent = dirname(cursor)
    if (parent === cursor) break
    trailingSegments.unshift(basename(cursor))
    cursor = parent
  }
  try {
    const realBase = realpathSync(cursor)
    return trailingSegments.length > 0 ? normalize(join(realBase, ...trailingSegments)) : normalize(realBase)
  } catch {
    return normalize(resolve(targetPath))
  }
}

function assertNotRestrictedPath(candidatePath: string): void {
  const forbiddenPatterns = [
    /^[a-z]:\\windows([\\/]|$)/i,
    /^[a-z]:\\program files/i,
    /\\system32([\\/]|$)/i,
    /\\syswow64([\\/]|$)/i,
    /\\start menu\\programs\\startup/i,
    /[\\/]\.ssh([\\/]|$)/i,
    /[\\/]\.aws([\\/]|$)/i,
    /[\\/]\.gnupg([\\/]|$)/i,
    /[\\/]\.git([\\/]|$)/i,
    /^\/etc([\\/]|$)/i,
    // Restrict /var system dirs while permitting /var/home used on immutable Linux (ostree/Silverblue)
    /^\/var(?:\/(?!home(?:\/|$)).*)?$/i,
    /^\/proc([\\/]|$)/i,
    /^\/sys([\\/]|$)/i
  ]

  for (const pattern of forbiddenPatterns) {
    if (pattern.test(candidatePath)) {
      throw new Error('Access denied: restricted system directory access')
    }
  }
}

function assertNoUncOrDevicePrefix(rawPath: string): void {
  const trimmed = rawPath.trim()
  // Block UNC network paths (including mixed-slash /\ and \/) and Windows device paths (\\?\, \\.\)
  if (/^[\\/]{2}/.test(trimmed)) {
    throw new Error('Access denied: UNC and device paths are not permitted')
  }
  // Block Windows Alternate Data Streams (ADS) e.g. file.txt:evil.exe or :stream.txt (Windows only; colons are valid on macOS/Linux)
  if (process.platform === 'win32') {
    const withoutDrive = /^[a-zA-Z]:[\\/]/.test(trimmed) ? trimmed.slice(2) : trimmed
    if (withoutDrive.includes(':')) {
      throw new Error('Access denied: alternate data streams are not permitted')
    }
  }
}

function sanitizeFilenameStem(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9._ -]/g, '_').replace(/\.+$/, '').trim().slice(0, 80)
  // Avoid Windows reserved device names (CON, PRN, AUX, NUL, COM1-9, LPT1-9)
  if (!cleaned || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(cleaned)) {
    return 'document'
  }
  return cleaned
}

function assertTrustedIpcSender(event: IpcMainInvokeEvent): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    throw new Error('Access denied: main window is unavailable')
  }
  if (event.sender !== mainWindow.webContents) {
    throw new Error('Access denied: untrusted IPC sender')
  }
  const frame = event.senderFrame
  if (!frame || frame !== mainWindow.webContents.mainFrame) {
    throw new Error('Access denied: IPC calls are only permitted from the primary application frame')
  }

  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) {
    try {
      if (new URL(frame.url).origin === new URL(devUrl).origin) {
        return
      }
    } catch {
      // Fall through to rejection
    }
    throw new Error('Access denied: IPC sender origin mismatch')
  }

  try {
    const parsed = new URL(frame.url)
    if (parsed.protocol !== 'file:') {
      throw new Error('Access denied: unexpected renderer protocol')
    }
    const senderPath = canonicalKey(fileURLToPath(parsed))
    const expectedPath = canonicalKey(join(__dirname, '../renderer/index.html'))
    if (senderPath !== expectedPath) {
      throw new Error('Access denied: unexpected renderer entry path')
    }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('Access denied:')) {
      throw err
    }
    throw new Error('Access denied: could not verify IPC sender frame')
  }
}

function handleTrusted<TArgs extends any[], TResult>(
  channel: string,
  handler: (event: IpcMainInvokeEvent, ...args: TArgs) => TResult | Promise<TResult>
): void {
  ipcMain.handle(channel, (event, ...args: TArgs) => {
    assertTrustedIpcSender(event)
    return handler(event, ...args)
  })
}

function assertApprovedWritePath(safePath: string): void {
  const key = canonicalKey(safePath)
  if (approvedSavePaths.has(key)) {
    return
  }
  throw new Error('Access denied: write target was not authorized by a save dialog')
}

async function renameWithWindowsRetry(tempPath: string, targetPath: string): Promise<void> {
  const retryableCodes = new Set(['EPERM', 'EBUSY', 'EACCES'])
  let lastErr: unknown
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await rename(tempPath, targetPath)
      return
    } catch (err: any) {
      lastErr = err
      if (process.platform !== 'win32' || !retryableCodes.has(err?.code) || attempt === 4) {
        throw err
      }
      await new Promise((res) => setTimeout(res, 25 * (attempt + 1)))
    }
  }
  throw lastErr
}

async function writeAtomic(targetPath: string, data: string | Buffer): Promise<void> {
  const tempPath = `${targetPath}.${randomBytes(6).toString('hex')}.tmp`
  try {
    await writeFile(tempPath, data, { flag: 'wx' })
    await renameWithWindowsRetry(tempPath, targetPath)
  } catch (err) {
    await unlink(tempPath).catch(() => {})
    throw err
  }
}

function assertSafePath(targetPath: string, mode: 'read' | 'write'): string {
  if (typeof targetPath !== 'string' || !targetPath.trim()) {
    throw new Error('Invalid path: path must be a non-empty string')
  }

  // Block null bytes and control characters
  if (/[\0\x01-\x1F\x7F]/.test(targetPath)) {
    throw new Error('Invalid path: contains illegal control characters')
  }

  assertNoUncOrDevicePrefix(targetPath)

  const normalized = normalize(resolve(targetPath))
  // Re-check UNC/device prefix after normalization BEFORE any filesystem call (blocks mixed-slash /\ UNC)
  assertNoUncOrDevicePrefix(normalized)

  const ext = extname(normalized).toLowerCase()
  const allowedExts = mode === 'read' ? ALLOWED_READ_EXTS : ALLOWED_WRITE_EXTS
  if (!allowedExts.has(ext)) {
    throw new Error(`Access denied: file extension '${ext}' is not permitted for ${mode} operations`)
  }

  assertNotRestrictedPath(normalized)

  // Resolve symlinks on the file or nearest existing parent directory and re-check extension + restrictions
  const canonical = resolveNearestRealPath(normalized)
  assertNoUncOrDevicePrefix(canonical)
  const canonicalExt = extname(canonical).toLowerCase()
  if (!allowedExts.has(canonicalExt)) {
    throw new Error(`Access denied: resolved file extension '${canonicalExt}' is not permitted for ${mode} operations`)
  }
  assertNotRestrictedPath(canonical)

  return canonical
}

function assertSafeFolderPath(folderPath: string): string {
  if (typeof folderPath !== 'string' || !folderPath.trim()) {
    throw new Error('Invalid folder: must be a non-empty string')
  }
  if (/[\0\x01-\x1F\x7F]/.test(folderPath)) {
    throw new Error('Invalid folder: contains illegal control characters')
  }
  assertNoUncOrDevicePrefix(folderPath)

  const normalized = normalize(resolve(folderPath))
  // Re-check UNC/device prefix after normalization BEFORE any filesystem call
  assertNoUncOrDevicePrefix(normalized)

  if (/^[a-z]:\\?$/i.test(normalized) || normalized === '/' || normalized === '\\') {
    throw new Error('Scanning root drive directly is not permitted')
  }

  assertNotRestrictedPath(normalized)

  const canonical = resolveNearestRealPath(normalized)
  assertNoUncOrDevicePrefix(canonical)
  assertNotRestrictedPath(canonical)

  return canonical
}

interface SavedWindowState {
  x?: number
  y?: number
  width: number
  height: number
  isMaximized?: boolean
}

function getWindowStatePath(): string {
  return join(app.getPath('userData'), 'window-state.json')
}

function loadWindowState(): SavedWindowState {
  const fallback: SavedWindowState = { width: 1280, height: 820, isMaximized: false }
  try {
    const p = getWindowStatePath()
    if (!existsSync(p)) return fallback
    const parsed = JSON.parse(readFileSync(p, 'utf-8')) as SavedWindowState
    const width = typeof parsed.width === 'number' && Number.isFinite(parsed.width) && parsed.width >= 960 ? Math.round(parsed.width) : 1280
    const height = typeof parsed.height === 'number' && Number.isFinite(parsed.height) && parsed.height >= 600 ? Math.round(parsed.height) : 820
    let x = typeof parsed.x === 'number' && Number.isFinite(parsed.x) ? Math.round(parsed.x) : undefined
    let y = typeof parsed.y === 'number' && Number.isFinite(parsed.y) ? Math.round(parsed.y) : undefined

    // Validate coordinates against currently attached displays so window never spawns off-screen
    if (x !== undefined && y !== undefined) {
      const displays = screen.getAllDisplays()
      const visible = displays.some((d) => {
        const b = d.workArea
        return x! + 80 >= b.x && x! < b.x + b.width - 80 && y! >= b.y && y! < b.y + b.height - 60
      })
      if (!visible) {
        x = undefined
        y = undefined
      }
    }
    const isMaximized = parsed.isMaximized === true
    return { x, y, width, height, isMaximized }
  } catch {
    return fallback
  }
}

function saveWindowState(win: BrowserWindow): void {
  if (win.isDestroyed() || win.isMinimized()) return
  const targetPath = getWindowStatePath()
  const tempPath = `${targetPath}.${randomBytes(6).toString('hex')}.tmp`
  try {
    const isMaximized = win.isMaximized()
    const bounds = isMaximized ? win.getNormalBounds() : win.getBounds()
    // Reject Win32 minimized off-screen coordinates (-32000, -32000)
    if (bounds.x <= -10000 || bounds.y <= -10000) return
    const payload: SavedWindowState = {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      isMaximized
    }
    writeFileSync(tempPath, JSON.stringify(payload, null, 2), { encoding: 'utf-8', flag: 'wx' })
    renameSync(tempPath, targetPath)
  } catch {
    try {
      if (existsSync(tempPath)) unlinkSync(tempPath)
    } catch {
      // ignore temp cleanup errors during shutdown
    }
  }
}

function extractBookArg(argv: string[]): string | null {
  for (const arg of argv.slice(1)) {
    if (!arg || arg.startsWith('-')) continue
    const ext = extname(arg).toLowerCase()
    if (SUPPORTED_EXTS.has(ext) && existsSync(arg)) {
      return arg
    }
  }
  return null
}

async function dispatchExternalFile(filePath: string): Promise<void> {
  let targetPath = filePath
  try {
    const safePath = assertSafePath(filePath, 'read')
    targetPath = await copyFileIntoVaultIfConfigured(safePath)
    authorizeFile(targetPath)
  } catch {
    return
  }

  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
    mainWindow.webContents.send('app:openExternalFile', targetPath)
  } else {
    pendingExternalFile = targetPath
  }
}

// Enforce single-instance desktop behavior and forward Explorer double-clicks to the active window
const gotSingleInstanceLock = app.requestSingleInstanceLock()
if (!gotSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', (_event, argv) => {
    const fileArg = extractBookArg(argv)
    if (fileArg) {
      dispatchExternalFile(fileArg)
    } else if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })
}

app.on('open-file', (event, filePath) => {
  event.preventDefault()
  if (SUPPORTED_EXTS.has(extname(filePath).toLowerCase()) && existsSync(filePath)) {
    dispatchExternalFile(filePath)
  }
})

function resolveAppIconPath(): string | undefined {
  const iconFile = process.platform === 'win32' ? 'icon.ico' : 'icon.png'
  const candidates = [
    join(process.resourcesPath, iconFile),
    join(app.getAppPath(), 'resources', iconFile),
    join(__dirname, '../../resources', iconFile),
    join(app.getAppPath(), 'build', iconFile)
  ]
  return candidates.find((p) => existsSync(p))
}

function createWindow(): void {
  const iconPath = resolveAppIconPath()
  const saved = loadWindowState()

  mainWindow = new BrowserWindow({
    title: 'Semply Ebook Reader - Efedera',
    ...(iconPath ? { icon: iconPath } : {}),
    ...(saved.x !== undefined && saved.y !== undefined ? { x: saved.x, y: saved.y } : {}),
    width: saved.width,
    height: saved.height,
    minWidth: 960,
    minHeight: 600,
    frame: false,
    backgroundColor: '#0a0a0a',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true
    }
  })

  // Strip Electron's default application menu so Ctrl+R (Reload/Reset), Ctrl+W, and Ctrl+0/+/- accelerators never fire
  Menu.setApplicationMenu(null)

  mainWindow.on('ready-to-show', () => {
    mainWindow?.webContents.setVisualZoomLevelLimits(1, 1).catch(() => {})
    if (saved.isMaximized) {
      mainWindow?.maximize()
    }
    mainWindow?.show()
  })

  // Persist window geometry across launches (debounced)
  let saveBoundsTimer: NodeJS.Timeout | null = null
  const scheduleBoundsSave = () => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    if (saveBoundsTimer) clearTimeout(saveBoundsTimer)
    saveBoundsTimer = setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) saveWindowState(mainWindow)
    }, 250)
  }
  mainWindow.on('resize', scheduleBoundsSave)
  mainWindow.on('move', scheduleBoundsSave)
  mainWindow.on('close', () => {
    if (saveBoundsTimer) {
      clearTimeout(saveBoundsTimer)
      saveBoundsTimer = null
    }
    if (mainWindow && !mainWindow.isDestroyed()) saveWindowState(mainWindow)
  })

  // Broadcast native window chrome state (maximize, focus, fullscreen)
  mainWindow.on('maximize', () => {
    mainWindow?.webContents.send('window:maximizedChanged', true)
    scheduleBoundsSave()
  })
  mainWindow.on('unmaximize', () => {
    mainWindow?.webContents.send('window:maximizedChanged', false)
    scheduleBoundsSave()
  })
  mainWindow.on('focus', () => {
    mainWindow?.webContents.send('window:focusChanged', true)
    mainWindow?.webContents.send('app:resume')
  })
  mainWindow.on('blur', () => {
    mainWindow?.webContents.send('window:focusChanged', false)
  })
  mainWindow.on('enter-full-screen', () => {
    mainWindow?.webContents.send('window:fullscreenChanged', true)
  })
  mainWindow.on('leave-full-screen', () => {
    mainWindow?.webContents.send('window:fullscreenChanged', false)
  })

  // Deliver any file opened via Explorer double-click on initial launch once renderer is ready
  const initialArg = extractBookArg(process.argv)
  if (initialArg) {
    try {
      const safeInitial = assertSafePath(initialArg, 'read')
      authorizeFile(safeInitial)
      pendingExternalFile = safeInitial
    } catch {
      pendingExternalFile = null
    }
  }
  mainWindow.webContents.on('did-finish-load', () => {
    if (pendingExternalFile && mainWindow && !mainWindow.isDestroyed()) {
      const target = pendingExternalFile
      pendingExternalFile = null
      mainWindow.webContents.send('app:openExternalFile', target)
    }
  })

  // Block accidental Chromium file/URL navigation (e.g. dropping an unsupported file onto window)
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const devUrl = process.env['ELECTRON_RENDERER_URL']
    if (devUrl) {
      try {
        if (new URL(url).origin === new URL(devUrl).origin) return
      } catch {
        // Fall through to preventDefault
      }
    }
    event.preventDefault()
  })

  // Block untrusted subframe navigations (while permitting EPUB srcdoc/blob and internal #anchor links)
  mainWindow.webContents.on('will-frame-navigate', (details) => {
    const url = details.url || ''
    if (
      url === 'about:blank' ||
      url.startsWith('about:blank#') ||
      url === 'about:srcdoc' ||
      url.startsWith('about:srcdoc#') ||
      url.startsWith('blob:')
    ) {
      return
    }
    const devUrl = process.env['ELECTRON_RENDERER_URL']
    if (devUrl) {
      try {
        if (new URL(url).origin === new URL(devUrl).origin) return
      } catch {
        // Fall through to preventDefault
      }
    } else if (url.startsWith('file:')) {
      try {
        const targetPath = canonicalKey(fileURLToPath(new URL(url)))
        const expectedPath = canonicalKey(join(__dirname, '../renderer/index.html'))
        if (targetPath === expectedPath) return
      } catch {
        // Fall through to preventDefault
      }
    }
    details.preventDefault()
  })

  // Guard against browser reload/history shortcuts; route Ctrl+/Ctrl-/Ctrl+0 strictly to content zoom
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return

    // Block F5 reload, Alt+Left / Alt+Right browser history, and bare Control side effects
    if (input.key === 'F5' || input.key === 'Control') {
      event.preventDefault()
      return
    }
    if (input.alt && (input.key === 'ArrowLeft' || input.key === 'ArrowRight')) {
      event.preventDefault()
      return
    }

    if (input.control || input.meta) {
      const k = input.key.toLowerCase()
      if (k === '=' || k === '+' || input.code === 'Equal' || input.code === 'NumpadAdd') {
        event.preventDefault()
        mainWindow?.webContents.send('window:contentZoom', 'in')
        return
      }
      if (k === '-' || k === '_' || input.code === 'Minus' || input.code === 'NumpadSubtract') {
        event.preventDefault()
        mainWindow?.webContents.send('window:contentZoom', 'out')
        return
      }
      if (k === '0' || input.code === 'Digit0' || input.code === 'Numpad0') {
        event.preventDefault()
        mainWindow?.webContents.send('window:contentZoom', 'reset')
        return
      }
      // Prevent browser reload (Ctrl+R) and accidental tab-close (Ctrl+W)
      if (k === 'r' || k === 'w') {
        event.preventDefault()
      }
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    try {
      const parsed = new URL(details.url)
      if (
        parsed.protocol === 'https:' &&
        !parsed.username &&
        !parsed.password &&
        isAllowedExternalBrowserHost(parsed.hostname)
      ) {
        shell.openExternal(parsed.toString())
      }
    } catch {
      // Ignore invalid or disallowed URLs
    }
    return { action: 'deny' }
  })

  // Native Cut/Copy/Paste context menu for editable input fields
  mainWindow.webContents.on('context-menu', (_event, params) => {
    if (params.isEditable) {
      const editMenu = Menu.buildFromTemplate([
        { role: 'undo', enabled: params.editFlags.canUndo },
        { role: 'redo', enabled: params.editFlags.canRedo },
        { type: 'separator' },
        { role: 'cut', enabled: params.editFlags.canCut },
        { role: 'copy', enabled: params.editFlags.canCopy },
        { role: 'paste', enabled: params.editFlags.canPaste },
        { type: 'separator' },
        { role: 'selectAll', enabled: params.editFlags.canSelectAll }
      ])
      editMenu.popup({ window: mainWindow || undefined })
    }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// Window Controls
handleTrusted('window:minimize', () => mainWindow?.minimize())
handleTrusted('window:maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize()
  } else {
    mainWindow?.maximize()
  }
})
handleTrusted('window:close', () => mainWindow?.close())
handleTrusted('window:isMaximized', () => mainWindow?.isMaximized() || false)
handleTrusted('window:toggleFullscreen', () => {
  if (mainWindow) {
    const next = !mainWindow.isFullScreen()
    mainWindow.setFullScreen(next)
    return next
  }
  return false
})
handleTrusted('window:setFullscreen', (_, active: boolean) => {
  if (mainWindow && typeof active === 'boolean') {
    mainWindow.setFullScreen(active)
  }
})
handleTrusted('window:setTitle', (_, title: string) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    const safeTitle = typeof title === 'string' ? title.replace(/[\0\x01-\x1F\x7F]/g, '').slice(0, 200) : ''
    mainWindow.setTitle(safeTitle || 'Semply Ebook Reader')
  }
})
handleTrusted('shell:showItemInFolder', (_, filePath: string) => {
  try {
    const safePath = assertSafePath(filePath, 'read')
    assertWithinAuthorizedBoundary(safePath, 'file')
    if (existsSync(safePath)) {
      shell.showItemInFolder(safePath)
      return true
    }
    return false
  } catch {
    return false
  }
})
handleTrusted('window:setBackgroundColor', (_, color: string) => {
  if (mainWindow && typeof color === 'string' && /^#[0-9a-fA-F]{6}$/.test(color)) {
    mainWindow.setBackgroundColor(color)
  }
})
handleTrusted('window:setZoomFactor', (_, factor: number) => {
  const safeFactor = typeof factor === 'number' && Number.isFinite(factor)
    ? Math.max(0.25, Math.min(5.0, factor))
    : 1.0
  mainWindow?.webContents.setZoomFactor(safeFactor)
})
handleTrusted('window:getZoomFactor', () => {
  return mainWindow?.webContents.getZoomFactor() ?? 1.0
})

async function scanBookFolderInternal(
  safeRoot: string
): Promise<Array<{ path: string; subfolder: string | null }>> {
  const allowed = new Set(['.epub', '.pdf', '.mobi', '.txt'])
  const results: Array<{ path: string; subfolder: string | null }> = []
  const MAX_DEPTH = 6
  const MAX_FILES = 2500

  if (!existsSync(safeRoot)) return []

  async function scan(dir: string, depth: number, currentSubfolder: string | null): Promise<void> {
    if (depth > MAX_DEPTH || results.length >= MAX_FILES) return
    try {
      const entries = await readdir(dir, { withFileTypes: true })
      for (const entry of entries) {
        if (results.length >= MAX_FILES) return
        if (entry.isSymbolicLink()) continue

        const full = join(dir, entry.name)
        if (entry.isDirectory()) {
          const nextSubfolder = currentSubfolder ?? entry.name
          await scan(full, depth + 1, nextSubfolder)
        } else if (allowed.has(extname(entry.name).toLowerCase())) {
          results.push({ path: full, subfolder: currentSubfolder })
        }
      }
    } catch {
      // Ignore directory access errors
    }
  }

  await scan(safeRoot, 0, null)
  return results
}

// File System & Dialogs
handleTrusted('dialog:openFiles', async () => {
  if (!mainWindow) return []
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Import eBooks or Documents',
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'eBooks & Documents', extensions: ['epub', 'pdf', 'mobi', 'txt'] },
      { name: 'EPUB Files', extensions: ['epub'] },
      { name: 'PDF Files', extensions: ['pdf'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  })
  if (result.canceled || result.filePaths.length === 0) return []

  const authorizedPaths: string[] = []
  for (const rawPath of result.filePaths) {
    try {
      const safePath = assertSafePath(rawPath, 'read')
      const finalPath = await copyFileIntoVaultIfConfigured(safePath)
      authorizeFile(finalPath)
      authorizedPaths.push(finalPath)
    } catch {
      // Skip restricted or unsafe files
    }
  }
  return authorizedPaths
})

handleTrusted('dialog:openFolder', async () => {
  if (!mainWindow) return null
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Folder with eBooks',
    properties: ['openDirectory']
  })
  if (result.canceled || !result.filePaths[0]) return null
  try {
    const safeFolder = assertSafeFolderPath(result.filePaths[0])
    authorizeFolder(safeFolder)
    return safeFolder
  } catch {
    return null
  }
})

// Recursive Folder Scanner with security bounding (boundary lock, depth cap, file cap, symlink ignore)
handleTrusted('fs:scanFolder', async (_, folderPath: string) => {
  let safeRoot: string
  try {
    safeRoot = assertSafeFolderPath(folderPath)
    assertWithinAuthorizedBoundary(safeRoot, 'folder')
  } catch (err: any) {
    console.warn('Folder scan rejected by security policy:', err?.message)
    return []
  }

  const rawFiles = await scanBookFolderInternal(safeRoot)
  const cfg = getSecurityStatus()
  if (cfg.vaultPath && cfg.copyImportsIntoVault) {
    const vaultFiles: Array<{ path: string; subfolder: string | null }> = []
    for (const item of rawFiles) {
      try {
        const safeFile = assertSafePath(item.path, 'read')
        const finalPath = await copyFileIntoVaultIfConfigured(safeFile)
        vaultFiles.push({ path: finalPath, subfolder: item.subfolder })
      } catch {
        // Skip unreadable or oversized entries
      }
    }
    return vaultFiles
  }
  return rawFiles
})

// Read binary file buffer with path validation, boundary lock, and safe size ceiling
handleTrusted('fs:readFileBuffer', async (_, filePath: string) => {
  const safePath = assertSafePath(filePath, 'read')
  assertWithinAuthorizedBoundary(safePath, 'file')
  const st = await stat(safePath)
  if (st.size > MAX_BUFFER_READ_SIZE) {
    throw new Error(`File size (${Math.round(st.size / 1024 / 1024)}MB) exceeds safe buffer limit (250MB)`)
  }
  const buffer = await readFile(safePath)
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
})

// Read text file with path validation, boundary lock, and safe size ceiling
handleTrusted('fs:readFileText', async (_, filePath: string) => {
  const safePath = assertSafePath(filePath, 'read')
  assertWithinAuthorizedBoundary(safePath, 'file')
  const st = await stat(safePath)
  if (st.size > MAX_TEXT_READ_SIZE) {
    throw new Error(`File size (${Math.round(st.size / 1024 / 1024)}MB) exceeds safe text limit (100MB)`)
  }
  return await readFile(safePath, 'utf-8')
})

// Write text file with path validation, save-dialog authorization, size cap, and atomic replacement
handleTrusted('fs:writeFileText', async (_, filePath: string, content: string) => {
  if (typeof content !== 'string') {
    throw new Error('Invalid write payload: content must be a string')
  }
  const byteLen = Buffer.byteLength(content, 'utf-8')
  if (byteLen > MAX_WRITE_SIZE) {
    throw new Error('Write payload exceeds maximum allowed size (250MB)')
  }
  const safePath = assertSafePath(filePath, 'write')
  assertApprovedWritePath(safePath)
  await writeAtomic(safePath, content)
  approvedSavePaths.delete(canonicalKey(safePath))
  return true
})

// Write binary buffer with path validation, save-dialog authorization, size cap, and atomic replacement
handleTrusted('fs:writeFileBuffer', async (_, filePath: string, buffer: ArrayBuffer | ArrayBufferView) => {
  if (!(buffer instanceof ArrayBuffer) && !ArrayBuffer.isView(buffer)) {
    throw new Error('Invalid write payload: buffer must be binary data')
  }
  const nodeBuf =
    buffer instanceof ArrayBuffer
      ? Buffer.from(buffer)
      : Buffer.from(buffer.buffer, buffer.byteOffset, buffer.byteLength)
  if (nodeBuf.byteLength > MAX_WRITE_SIZE) {
    throw new Error('Write payload exceeds maximum allowed size (250MB)')
  }
  const safePath = assertSafePath(filePath, 'write')
  assertApprovedWritePath(safePath)
  await writeAtomic(safePath, nodeBuf)
  approvedSavePaths.delete(canonicalKey(safePath))
  return true
})

// Dialog to save file (registers the user-selected destination in the write capability set)
handleTrusted('dialog:showSaveDialog', async (_, options: { title?: string; defaultPath?: string; filters?: Array<{ name: string; extensions: string[] }> }) => {
  if (!mainWindow) return null
  const result = await dialog.showSaveDialog(mainWindow, {
    title: typeof options?.title === 'string' ? options.title.slice(0, 120) : 'Save File',
    defaultPath: typeof options?.defaultPath === 'string' ? basename(options.defaultPath) : undefined,
    filters: Array.isArray(options?.filters) ? options.filters : undefined
  })
  if (result.canceled || !result.filePath) return null
  try {
    const safeTarget = assertSafePath(result.filePath, 'write')
    approvedSavePaths.add(canonicalKey(safeTarget))
    return safeTarget
  } catch {
    return null
  }
})

// Dialog to open backup file (grants session-scoped read capability to the user-selected file)
handleTrusted('dialog:showOpenDialog', async (_, options: { title?: string; filters?: Array<{ name: string; extensions: string[] }> }) => {
  if (!mainWindow) return null
  const result = await dialog.showOpenDialog(mainWindow, {
    title: typeof options?.title === 'string' ? options.title.slice(0, 120) : 'Open File',
    filters: Array.isArray(options?.filters) ? options.filters : undefined,
    properties: ['openFile']
  })
  if (result.canceled || !result.filePaths[0]) return null
  try {
    const safePath = assertSafePath(result.filePaths[0], 'read')
    approveSessionReadPath(safePath)
    return safePath
  } catch {
    return null
  }
})

// Offline MuPDF WASM PDF-to-EPUB Conversion Engine (Librera Reflow Architecture)
let activePdfConversionController: AbortController | null = null

handleTrusted(
  'pdf:convertToEpub',
  async (
    _,
    input:
      | string
      | {
          pdfPath: string
          outputPath?: string
          mode?: 'reflow-cache' | 'library' | 'export'
        }
  ) => {
    // Abort any prior in-flight reflow before initiating a new one
    if (activePdfConversionController) {
      activePdfConversionController.abort()
      activePdfConversionController = null
    }
    const currentController = new AbortController()
    activePdfConversionController = currentController
    const signal = currentController.signal

    try {
      const rawPdfPath = typeof input === 'string' ? input : input?.pdfPath
      const safePdfPath = assertSafePath(rawPdfPath, 'read')
      assertWithinAuthorizedBoundary(safePdfPath, 'file')
      const mode = typeof input === 'string' ? 'library' : input?.mode || 'library'
      const customOutputPath = typeof input === 'string' ? undefined : input?.outputPath
      const safeCustomOutputPath = customOutputPath ? assertSafePath(customOutputPath, 'write') : undefined
      if (safeCustomOutputPath) {
        assertApprovedWritePath(safeCustomOutputPath)
      }

      const pdfName = sanitizeFilenameStem(basename(safePdfPath, extname(safePdfPath)))
      const userData = app.getPath('userData')
      const subDir = mode === 'reflow-cache' ? 'reflow_cache' : 'converted_epubs'
      const outDir = join(userData, subDir)
      if (!existsSync(outDir)) {
        await mkdir(outDir, { recursive: true })
      }

      let targetEpubPath = safeCustomOutputPath
      if (!targetEpubPath) {
        if (mode === 'reflow-cache') {
          const pathHash = createHash('sha1').update(safePdfPath).digest('hex').slice(0, 12)
          targetEpubPath = join(outDir, `${pdfName}_${pathHash}-reflow.epub`)
          if (existsSync(targetEpubPath)) {
            mainWindow?.webContents.send('pdf:convertProgress', {
              currentPage: 1,
              totalPages: 1,
              stage: 'Loaded cached reflow EPUB',
              percent: 100
            })
            return { success: true, epubPath: targetEpubPath }
          }
        } else {
          targetEpubPath = join(outDir, `${pdfName}.epub`)
        }
      }

      const result = await convertPdfToEpub(
        safePdfPath,
        targetEpubPath,
        (progress) => {
          if (!signal.aborted) {
            mainWindow?.webContents.send('pdf:convertProgress', progress)
          }
        },
        signal
      )
      if (safeCustomOutputPath && result.success) {
        approvedSavePaths.delete(canonicalKey(safeCustomOutputPath))
      }
      return result
    } catch (error: any) {
      const isCancelled = signal.aborted || error?.message?.includes('cancelled')
      return {
        success: false,
        error: isCancelled ? 'Reflow conversion cancelled by user' : error?.message || 'PDF to EPUB conversion failed',
        cancelled: isCancelled
      }
    } finally {
      if (activePdfConversionController === currentController) {
        activePdfConversionController = null
      }
    }
  }
)

handleTrusted('pdf:cancelConversion', async () => {
  if (activePdfConversionController) {
    activePdfConversionController.abort()
    activePdfConversionController = null
    return true
  }
  return false
})

// Font Library Cache & Downloader IPC
handleTrusted('pdf:clearReflowCache', async (_, rawPdfPath: string) => {
  try {
    const safePdfPath = assertSafePath(rawPdfPath, 'read')
    assertWithinAuthorizedBoundary(safePdfPath, 'file')
    const pdfName = sanitizeFilenameStem(basename(safePdfPath, extname(safePdfPath)))
    const pathHash = createHash('sha1').update(safePdfPath).digest('hex').slice(0, 12)
    const cachedPath = join(app.getPath('userData'), 'reflow_cache', `${pdfName}_${pathHash}-reflow.epub`)
    if (existsSync(cachedPath)) {
      await unlink(cachedPath)
      return true
    }
    return false
  } catch {
    return false
  }
})

handleTrusted('fonts:listDownloaded', async () => {
  return await listDownloadedFontIds()
})
handleTrusted('fonts:download', async (_, fontId: string) => {
  return await downloadFont(fontId)
})
handleTrusted('fonts:getCss', async (_, fontId: string) => {
  return await getFontFaceCss(fontId)
})
handleTrusted('fonts:isOnline', () => {
  return checkIsOnline()
})

// Air-Gapped Main-Process Reference Lookups (Dictionary & Wikipedia)
handleTrusted('dict:define', async (_, query: string) => {
  return await lookupDictionaryInMain(query)
})
handleTrusted('dict:wiki', async (_, query: string) => {
  return await lookupWikipediaInMain(query)
})

// Obsidian-Style Vault, Folder Lock & Network Seal IPC
handleTrusted('security:getStatus', () => {
  return getSecurityStatus()
})
handleTrusted('security:setStrictOfflineMode', (_, enabled: boolean) => {
  return setStrictOfflineMode(Boolean(enabled))
})
handleTrusted('security:chooseVaultFolder', async () => {
  if (!mainWindow) {
    return { canceled: true, status: getSecurityStatus(), scannedFiles: [] }
  }
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Choose or Create Semply Library Vault Folder',
    properties: ['openDirectory', 'createDirectory']
  })
  if (result.canceled || !result.filePaths[0]) {
    return { canceled: true, status: getSecurityStatus(), scannedFiles: [] }
  }
  try {
    const safeDir = assertSafeFolderPath(result.filePaths[0])
    const status = setVaultFolder(safeDir)
    const scannedRaw = await scanBookFolderInternal(safeDir)
    const scannedFiles = scannedRaw.map((f) => f.path)
    return { canceled: false, status, scannedFiles }
  } catch (err: any) {
    return {
      canceled: true,
      status: getSecurityStatus(),
      scannedFiles: [],
      error: err?.message || 'Selected folder is not allowed as a Library Vault.'
    }
  }
})
handleTrusted('security:clearVaultFolder', () => {
  return clearVaultFolder()
})
handleTrusted('security:setStrictVaultOnly', (_, enabled: boolean) => {
  return setStrictVaultOnly(Boolean(enabled))
})
handleTrusted('security:setCopyImportsIntoVault', (_, enabled: boolean) => {
  return setCopyImportsIntoVault(Boolean(enabled))
})
handleTrusted('security:addAuthorizedFolder', async () => {
  if (!mainWindow) {
    return { canceled: true, folderPath: null, status: getSecurityStatus() }
  }
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Authorize Library Folder',
    properties: ['openDirectory']
  })
  if (result.canceled || !result.filePaths[0]) {
    return { canceled: true, folderPath: null, status: getSecurityStatus() }
  }
  try {
    const safeDir = assertSafeFolderPath(result.filePaths[0])
    const status = authorizeFolder(safeDir)
    return { canceled: false, folderPath: safeDir, status }
  } catch (err: any) {
    return {
      canceled: true,
      folderPath: null,
      status: getSecurityStatus(),
      error: err?.message || 'Selected folder is restricted by security policy.'
    }
  }
})
handleTrusted('security:removeAuthorizedFolder', (_, folderPath: string) => {
  if (typeof folderPath !== 'string' || !folderPath.trim()) {
    return getSecurityStatus()
  }
  return removeAuthorizedFolder(folderPath)
})
handleTrusted('security:scanVault', async () => {
  const status = getSecurityStatus()
  if (!status.vaultPath) return []
  try {
    const safeRoot = assertSafeFolderPath(status.vaultPath)
    assertWithinAuthorizedBoundary(safeRoot, 'folder')
    const scanned = await scanBookFolderInternal(safeRoot)
    return scanned.map((f) => f.path)
  } catch {
    return []
  }
})
handleTrusted('security:importBufferToVault', async (_, fileName: string, buffer: ArrayBuffer | ArrayBufferView) => {
  try {
    if (typeof fileName !== 'string' || !fileName.trim()) {
      return { success: false, error: 'Invalid filename for Vault import.' }
    }
    if (!(buffer instanceof ArrayBuffer) && !ArrayBuffer.isView(buffer)) {
      return { success: false, error: 'Invalid binary payload for Vault import.' }
    }
    const savedPath = await importBufferIntoVault(fileName, buffer)
    return { success: true, filePath: savedPath }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Could not copy book into Library Vault.' }
  }
})
handleTrusted('security:openVaultInExplorer', async () => {
  const status = getSecurityStatus()
  if (!status.vaultPath || !existsSync(status.vaultPath)) return false
  try {
    const safeDir = assertSafeFolderPath(status.vaultPath)
    assertWithinAuthorizedBoundary(safeDir, 'folder')
    const errMsg = await shell.openPath(safeDir)
    return errMsg === ''
  } catch {
    return false
  }
})

// Book Metadata Check & Atomic File Write-Back IPC
handleTrusted('book:checkWritable', async (_, filePath: string) => {
  return await checkBookFileWritable(filePath, (p, mode) => {
    const safe = assertSafePath(p, mode)
    assertWithinAuthorizedBoundary(safe, 'file')
    return safe
  })
})
handleTrusted('book:writeMetadata', async (_, req: WriteBookMetadataRequest) => {
  if (!req || typeof req.filePath !== 'string' || !req.metadata) {
    return { success: false, error: 'Invalid metadata write request.' }
  }
  return await writeBookMetadataToFile(
    req.filePath,
    req.format,
    req.metadata,
    Boolean(req.updateCover),
    (p, mode) => {
      const safe = assertSafePath(p, mode)
      assertWithinAuthorizedBoundary(safe, 'file')
      return safe
    },
    writeAtomic
  )
})

function configureSessionSecurity(): void {
  const defaultSes = session.defaultSession

  // Deny all unneeded browser permissions; allow only clipboard writes from our trusted primary frame
  defaultSes.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const isMain = Boolean(mainWindow && !mainWindow.isDestroyed() && webContents === mainWindow.webContents)
    const isTopFrame = !details?.isMainFrame ? false : details.isMainFrame
    if (isMain && isTopFrame && permission === 'clipboard-sanitized-write') {
      callback(true)
      return
    }
    callback(false)
  })

  defaultSes.setPermissionCheckHandler((webContents, permission, _requestingOrigin, details) => {
    const isMain = Boolean(mainWindow && !mainWindow.isDestroyed() && webContents === mainWindow.webContents)
    if (isMain && details.isMainFrame && permission === 'clipboard-sanitized-write') {
      return true
    }
    return false
  })

  // Enforce Content-Security-Policy on our own app frames (dev-aware so Vite HMR & React Fast Refresh work cleanly)
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  let devOrigin: string | null = null
  let devWsOrigin: string | null = null
  if (devUrl) {
    try {
      const parsed = new URL(devUrl)
      devOrigin = parsed.origin
      devWsOrigin = `${parsed.protocol === 'https:' ? 'wss:' : 'ws:'}//${parsed.host}`
    } catch {
      devOrigin = null
    }
  }

  // Pre-initialize dedicated Main-only egress session (strictly allowlisted to Google Fonts, Dictionary & Wikipedia)
  getMainEgressSession()

  // Hard default-deny network egress gate on the Renderer session:
  // Blocks 100% of external internet requests (HTTP/HTTPS/WS/FTP/external file://) from the renderer,
  // EPUB iframes, CSS, images, and workers — only allowlisted Main-process IPC services can access the internet.
  const rendererBundleRoot = canonicalKey(join(__dirname, '../renderer'))
  defaultSes.webRequest.onBeforeRequest((details, callback) => {
    const url = details.url || ''
    if (
      url.startsWith('blob:') ||
      url.startsWith('data:') ||
      url === 'about:blank' ||
      url.startsWith('about:blank#') ||
      url === 'about:srcdoc' ||
      url.startsWith('about:srcdoc#')
    ) {
      callback({ cancel: false })
      return
    }

    if (devOrigin) {
      if (url.startsWith('devtools://')) {
        callback({ cancel: false })
        return
      }
      try {
        const parsed = new URL(url)
        if (parsed.origin === devOrigin || (devWsOrigin && `${parsed.protocol}//${parsed.host}` === devWsOrigin)) {
          callback({ cancel: false })
          return
        }
      } catch {
        // Fall through to cancel
      }
      callback({ cancel: true })
      return
    }

    // Production: permit ONLY file:// assets strictly inside our bundled out/renderer directory
    if (url.startsWith('file://')) {
      try {
        const targetPath = canonicalKey(fileURLToPath(new URL(url)))
        const rootPrefix = rendererBundleRoot.endsWith('\\') || rendererBundleRoot.endsWith('/')
          ? rendererBundleRoot
          : `${rendererBundleRoot}${process.platform === 'win32' ? '\\' : '/'}`
        if (targetPath === rendererBundleRoot || targetPath.startsWith(rootPrefix)) {
          callback({ cancel: false })
          return
        }
      } catch {
        // Fall through to cancel
      }
    }

    callback({ cancel: true })
  })

  const cspHeader = devOrigin
    ? [
        `default-src 'self' ${devOrigin}`,
        `script-src 'self' 'unsafe-inline' ${devOrigin}`,
        `style-src 'self' 'unsafe-inline' blob: ${devOrigin}`,
        `img-src 'self' data: blob: ${devOrigin}`,
        `font-src 'self' data: blob: ${devOrigin}`,
        `connect-src 'self' blob: data: ${devOrigin} ${devWsOrigin || ''}`,
        `worker-src 'self' blob: ${devOrigin}`,
        `frame-src 'self' blob: ${devOrigin}`,
        `media-src 'self' blob: data: ${devOrigin}`,
        `object-src 'none'`,
        `base-uri 'self' ${devOrigin}`,
        `form-action 'none'`
      ].join('; ')
    : [
        `default-src 'self'`,
        `script-src 'self'`,
        `style-src 'self' 'unsafe-inline' blob:`,
        `img-src 'self' data: blob:`,
        `font-src 'self' data: blob:`,
        `connect-src 'self' blob: data:`,
        `worker-src 'self' blob:`,
        `frame-src 'self' blob:`,
        `media-src 'self' blob: data:`,
        `object-src 'none'`,
        `base-uri 'self'`,
        `form-action 'none'`
      ].join('; ')

  defaultSes.webRequest.onHeadersReceived((details, callback) => {
    let isAppResource = false
    if (devOrigin) {
      try {
        isAppResource = new URL(details.url).origin === devOrigin
      } catch {
        isAppResource = false
      }
    } else {
      isAppResource = details.url.startsWith('file://')
    }
    if (!isAppResource) {
      callback({ responseHeaders: details.responseHeaders })
      return
    }
    const headers: Record<string, string[]> = { ...(details.responseHeaders || {}) }
    for (const key of Object.keys(headers)) {
      if (key.toLowerCase() === 'content-security-policy') {
        delete headers[key]
      }
    }
    headers['Content-Security-Policy'] = [cspHeader]
    callback({ responseHeaders: headers })
  })
}

// Harden all WebContents instances against unexpected webviews and child windows
app.on('web-contents-created', (_event, contents) => {
  contents.on('will-attach-webview', (event) => {
    event.preventDefault()
  })
})

if (process.platform === 'win32') {
  app.setAppUserModelId('com.ederaefe.semply-ebook-reader')
}

if (gotSingleInstanceLock) {
  app.whenReady().then(() => {
    configureSessionSecurity()
    createWindow()
    if (app.isPackaged) {
      autoUpdater.checkForUpdatesAndNotify().catch((err) => {
        console.warn('[AutoUpdater] Failed to check for updates:', err)
      })
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
