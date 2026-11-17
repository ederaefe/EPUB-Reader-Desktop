import { app, BrowserWindow, ipcMain, dialog, shell, Menu } from 'electron'
import { join, extname, basename } from 'path'
import { readFile, readdir, writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { createHash } from 'crypto'
import { convertPdfToEpub } from './pdfToEpubEngine'

let mainWindow: BrowserWindow | null = null

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

  mainWindow = new BrowserWindow({
    title: 'Semply Ebook Reader',
    ...(iconPath ? { icon: iconPath } : {}),
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 600,
    frame: false,
    backgroundColor: '#171a21',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('enter-full-screen', () => {
    mainWindow?.webContents.send('window:fullscreenChanged', true)
  })

  mainWindow.on('leave-full-screen', () => {
    mainWindow?.webContents.send('window:fullscreenChanged', false)
  })

  // Global zoom hotkeys: handles Ctrl + - (shrink) and Ctrl + = / Ctrl + + (unshrink) reliably
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return

    if (input.control || input.meta) {
      if (input.key === '=' || input.key === '+' || input.code === 'Equal' || input.code === 'NumpadAdd') {
        event.preventDefault()
        if (mainWindow) {
          const currentFactor = mainWindow.webContents.getZoomFactor()
          const nextFactor = Math.min(3.0, Math.round((currentFactor + 0.1) * 10) / 10)
          mainWindow.webContents.setZoomFactor(nextFactor)
        }
      } else if (input.key === '-' || input.key === '_' || input.code === 'Minus' || input.code === 'NumpadSubtract') {
        event.preventDefault()
        if (mainWindow) {
          const currentFactor = mainWindow.webContents.getZoomFactor()
          const nextFactor = Math.max(0.5, Math.round((currentFactor - 0.1) * 10) / 10)
          mainWindow.webContents.setZoomFactor(nextFactor)
        }
      } else if (input.key === '0' || input.code === 'Digit0' || input.code === 'Numpad0') {
        event.preventDefault()
        mainWindow?.webContents.setZoomFactor(1.0)
      }
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
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

// Recursive Folder Scanner
ipcMain.handle('fs:scanFolder', async (_, folderPath: string) => {
  const allowed = new Set(['.epub', '.pdf', '.mobi', '.txt'])
  const results: string[] = []

  async function scan(dir: string): Promise<void> {
    try {
      const entries = await readdir(dir, { withFileTypes: true })
      for (const entry of entries) {
        const full = join(dir, entry.name)
        if (entry.isDirectory()) {
          await scan(full)
        } else if (allowed.has(extname(entry.name).toLowerCase())) {
          results.push(full)
        }
      }
    } catch (e) {
      console.error('Scan error on folder:', dir, e)
    }
  }

  await scan(folderPath)
  return results
})

// Read binary file buffer
ipcMain.handle('fs:readFileBuffer', async (_, filePath: string) => {
  const buffer = await readFile(filePath)
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
})

// Read text file
ipcMain.handle('fs:readFileText', async (_, filePath: string) => {
  return await readFile(filePath, 'utf-8')
})

// Write text file
ipcMain.handle('fs:writeFileText', async (_, filePath: string, content: string) => {
  await writeFile(filePath, content, 'utf-8')
  return true
})

// Write binary buffer
ipcMain.handle('fs:writeFileBuffer', async (_, filePath: string, buffer: ArrayBuffer) => {
  await writeFile(filePath, Buffer.from(buffer))
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

if (process.platform === 'win32') {
  app.setAppUserModelId('com.ederaefe.semple-ebook-reader')
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
