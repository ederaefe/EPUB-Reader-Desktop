import { app, BrowserWindow, ipcMain, dialog, shell, Menu, screen } from 'electron'
import { join, extname, basename, resolve, normalize } from 'path'
import { readFile, readdir, writeFile, mkdir } from 'fs/promises'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { createHash } from 'crypto'
import { convertPdfToEpub } from './pdfToEpubEngine'
import {
  checkIsOnline,
  downloadFont,
  getFontFaceCss,
  listDownloadedFontIds
} from './fontService'

let mainWindow: BrowserWindow | null = null
let pendingExternalFile: string | null = null

const SUPPORTED_EXTS = new Set(['.epub', '.pdf'])
const ALLOWED_READ_EXTS = new Set(['.epub', '.pdf', '.mobi', '.txt', '.json', '.zip'])
const ALLOWED_WRITE_EXTS = new Set(['.json', '.zip', '.epub', '.txt'])

function assertSafePath(targetPath: string, mode: 'read' | 'write'): string {
  if (typeof targetPath !== 'string' || !targetPath.trim()) {
    throw new Error('Invalid path: path must be a non-empty string')
  }

  if (/[\0\x01-\x1F\x7F]/.test(targetPath)) {
    throw new Error('Invalid path: contains illegal control characters')
  }

  const normalized = normalize(resolve(targetPath))

  const ext = extname(normalized).toLowerCase()
  const allowedExts = mode === 'read' ? ALLOWED_READ_EXTS : ALLOWED_WRITE_EXTS
  if (!allowedExts.has(ext)) {
    throw new Error(`Access denied: file extension '${ext}' is not permitted for ${mode} operations`)
  }

  const forbiddenPatterns = [
    /^[a-z]:\\windows\\/i,
    /^[a-z]:\\program files/i,
    /\\system32\\/i,
    /\\syswow64\\/i,
    /\\start menu\\programs\\startup/i,
    /[\\/]\.ssh([\\/]|$)/i,
    /[\\/]\.aws([\\/]|$)/i,
    /[\\/]\.gnupg([\\/]|$)/i,
    /[\\/]\.git([\\/]|$)/i,
    /^\/etc([\\/]|$)/i,
    /^\/var([\\/]|$)/i,
    /^\/proc([\\/]|$)/i,
    /^\/sys([\\/]|$)/i
  ]

  for (const pattern of forbiddenPatterns) {
    if (pattern.test(normalized)) {
      throw new Error('Access denied: restricted system directory access')
    }
  }

  return normalized
}

function assertSafeFolderPath(folderPath: string): string {
  if (typeof folderPath !== 'string' || !folderPath.trim()) {
    throw new Error('Invalid folder: must be a non-empty string')
  }
  if (/[\0\x01-\x1F\x7F]/.test(folderPath)) {
    throw new Error('Invalid folder: contains illegal control characters')
  }
  const normalized = normalize(resolve(folderPath))

  if (/^[a-z]:\\?$/i.test(normalized) || normalized === '/' || normalized === '\\') {
    throw new Error('Scanning root drive directly is not permitted')
  }

  const forbiddenPatterns = [
    /^[a-z]:\\windows([\\/]|$)/i,
    /^[a-z]:\\program files/i,
    /[\\/]\.ssh([\\/]|$)/i,
    /[\\/]\.aws([\\/]|$)/i,
    /[\\/]\.git([\\/]|$)/i,
    /^\/etc([\\/]|$)/i,
    /^\/var([\\/]|$)/i,
    /^\/proc([\\/]|$)/i,
    /^\/sys([\\/]|$)/i
  ]

  for (const pattern of forbiddenPatterns) {
    if (pattern.test(normalized)) {
      throw new Error('Access denied: restricted system directory')
    }
  }

  return normalized
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
  try {
    const isMaximized = win.isMaximized()
    const bounds = isMaximized ? win.getNormalBounds() : win.getBounds()
    const payload: SavedWindowState = {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      isMaximized
    }
    writeFileSync(getWindowStatePath(), JSON.stringify(payload, null, 2), 'utf-8')
  } catch {
    // ignore persistence errors during shutdown
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

function dispatchExternalFile(filePath: string): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
    mainWindow.webContents.send('app:openExternalFile', filePath)
  } else {
    pendingExternalFile = filePath
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
    title: 'Semply Ebook Reader',
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
  if (initialArg) pendingExternalFile = initialArg
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
    if (devUrl && url.startsWith(devUrl)) return
    event.preventDefault()
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
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        shell.openExternal(details.url)
      }
    } catch {
      // Ignore invalid or unsafe URLs
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
ipcMain.handle('window:minimize', () => mainWindow?.minimize())
ipcMain.handle('window:maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize()
  } else {
    mainWindow?.maximize()
  }
})
ipcMain.handle('window:close', () => mainWindow?.close())
ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized() || false)
ipcMain.handle('window:toggleFullscreen', () => {
  if (mainWindow) {
    const next = !mainWindow.isFullScreen()
    mainWindow.setFullScreen(next)
    return next
  }
  return false
})
ipcMain.handle('window:setFullscreen', (_, active: boolean) => {
  if (mainWindow) {
    mainWindow.setFullScreen(active)
  }
})
ipcMain.handle('window:setTitle', (_, title: string) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setTitle(title || 'Semply Ebook Reader')
  }
})
ipcMain.handle('shell:showItemInFolder', (_, filePath: string) => {
  if (filePath && existsSync(filePath)) {
    shell.showItemInFolder(filePath)
    return true
  }
  return false
})
ipcMain.handle('window:setBackgroundColor', (_, color: string) => {
  if (mainWindow && typeof color === 'string' && /^#[0-9a-fA-F]{6}$/.test(color)) {
    mainWindow.setBackgroundColor(color)
  }
})
ipcMain.handle('window:setZoomFactor', (_, factor: number) => {
  mainWindow?.webContents.setZoomFactor(factor)
})
ipcMain.handle('window:getZoomFactor', () => {
  return mainWindow?.webContents.getZoomFactor() ?? 1.0
})

// File System & Dialogs
ipcMain.handle('dialog:openFiles', async () => {
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
  return result.canceled ? [] : result.filePaths
})

ipcMain.handle('dialog:openFolder', async () => {
  if (!mainWindow) return null
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Folder with eBooks',
    properties: ['openDirectory']
  })
  return result.canceled ? null : result.filePaths[0]
})

// Recursive Folder Scanner with security bounding (depth cap, file cap, symlink ignore)
ipcMain.handle('fs:scanFolder', async (_, folderPath: string) => {
  const allowed = new Set(['.epub', '.pdf', '.mobi', '.txt'])
  const results: string[] = []
  const MAX_DEPTH = 6
  const MAX_FILES = 2500

  let safeRoot: string
  try {
    safeRoot = assertSafeFolderPath(folderPath)
    if (!existsSync(safeRoot)) return []
  } catch (err: any) {
    console.warn('Folder scan rejected by security policy:', err?.message)
    return []
  }

  async function scan(dir: string, depth: number): Promise<void> {
    if (depth > MAX_DEPTH || results.length >= MAX_FILES) return
    try {
      const entries = await readdir(dir, { withFileTypes: true })
      for (const entry of entries) {
        if (results.length >= MAX_FILES) return
        if (entry.isSymbolicLink()) continue

        const full = join(dir, entry.name)
        if (entry.isDirectory()) {
          await scan(full, depth + 1)
        } else if (allowed.has(extname(entry.name).toLowerCase())) {
          results.push(full)
        }
      }
    } catch {
      // Ignore directory access errors
    }
  }

  await scan(safeRoot, 0)
  return results
})

// Read binary file buffer with path validation
ipcMain.handle('fs:readFileBuffer', async (_, filePath: string) => {
  const safePath = assertSafePath(filePath, 'read')
  const buffer = await readFile(safePath)
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
})

// Read text file with path validation
ipcMain.handle('fs:readFileText', async (_, filePath: string) => {
  const safePath = assertSafePath(filePath, 'read')
  return await readFile(safePath, 'utf-8')
})

// Write text file with path validation
ipcMain.handle('fs:writeFileText', async (_, filePath: string, content: string) => {
  const safePath = assertSafePath(filePath, 'write')
  await writeFile(safePath, content, 'utf-8')
  return true
})

// Write binary buffer with path validation
ipcMain.handle('fs:writeFileBuffer', async (_, filePath: string, buffer: ArrayBuffer) => {
  const safePath = assertSafePath(filePath, 'write')
  await writeFile(safePath, Buffer.from(buffer))
  return true
})

// Dialog to save file
ipcMain.handle('dialog:showSaveDialog', async (_, options: { title?: string; defaultPath?: string; filters?: Array<{ name: string; extensions: string[] }> }) => {
  if (!mainWindow) return null
  const result = await dialog.showSaveDialog(mainWindow, options)
  return result.canceled ? null : result.filePath
})

// Dialog to open backup file
ipcMain.handle('dialog:showOpenDialog', async (_, options: { title?: string; filters?: Array<{ name: string; extensions: string[] }> }) => {
  if (!mainWindow) return null
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    ...options
  })
  return result.canceled ? null : result.filePaths[0]
})

// Offline MuPDF WASM PDF-to-EPUB Conversion Engine (Librera Reflow Architecture)
ipcMain.handle(
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
    try {
      const pdfPath = typeof input === 'string' ? input : input.pdfPath
      const mode = typeof input === 'string' ? 'library' : input.mode || 'library'
      const customOutputPath = typeof input === 'string' ? undefined : input.outputPath

      const pdfName = basename(pdfPath, extname(pdfPath))
      const userData = app.getPath('userData')
      const subDir = mode === 'reflow-cache' ? 'reflow_cache' : 'converted_epubs'
      const outDir = join(userData, subDir)
      if (!existsSync(outDir)) {
        await mkdir(outDir, { recursive: true })
      }

      let targetEpubPath = customOutputPath
      if (!targetEpubPath) {
        if (mode === 'reflow-cache') {
          const pathHash = createHash('sha1').update(pdfPath).digest('hex').slice(0, 12)
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

      const result = await convertPdfToEpub(pdfPath, targetEpubPath, (progress) => {
        mainWindow?.webContents.send('pdf:convertProgress', progress)
      })
      return result
    } catch (error: any) {
      return { success: false, error: error?.message || 'PDF to EPUB conversion failed' }
    }
  }
)

// Font Library Cache & Downloader IPC
ipcMain.handle('fonts:listDownloaded', async () => {
  return await listDownloadedFontIds()
})
ipcMain.handle('fonts:download', async (_, fontId: string) => {
  return await downloadFont(fontId)
})
ipcMain.handle('fonts:getCss', async (_, fontId: string) => {
  return await getFontFaceCss(fontId)
})
ipcMain.handle('fonts:isOnline', () => {
  return checkIsOnline()
})

if (process.platform === 'win32') {
  app.setAppUserModelId('com.ederaefe.semple-ebook-reader')
}

if (gotSingleInstanceLock) {
  app.whenReady().then(() => {
    createWindow()

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
