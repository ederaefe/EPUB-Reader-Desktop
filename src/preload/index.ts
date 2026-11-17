import { contextBridge, ipcRenderer, webFrame } from 'electron'
import type {
  CheckBookWritableResult,
  WriteBookMetadataRequest,
  WriteBookMetadataResult
} from '../shared/bookMetadata'

export interface DesktopAPI {
  minimize: () => Promise<void>
  maximize: () => Promise<void>
  close: () => Promise<void>
  isMaximized: () => Promise<boolean>
  toggleFullscreen: () => Promise<boolean>
  setFullscreen: (active: boolean) => Promise<void>
  setBackgroundColor: (color: string) => Promise<void>
  setWindowTitle: (title: string) => Promise<void>
  showItemInFolder: (filePath: string) => Promise<boolean>
  onFullscreenChange: (callback: (isFullscreen: boolean) => void) => () => void
  onWindowMaximizedChange: (callback: (isMaximized: boolean) => void) => () => void
  onWindowFocusChange: (callback: (isFocused: boolean) => void) => () => void
  onContentZoom: (callback: (dir: 'in' | 'out' | 'reset') => void) => () => void
  onOpenExternalFile: (callback: (filePath: string) => void) => () => void
  openFiles: () => Promise<string[]>
  openFolder: () => Promise<string | null>
  scanFolder: (folderPath: string) => Promise<string[]>
  readFileBuffer: (filePath: string) => Promise<ArrayBuffer>
  readFileText: (filePath: string) => Promise<string>
  writeFileText: (filePath: string, content: string) => Promise<boolean>
  writeFileBuffer: (filePath: string, buffer: ArrayBuffer) => Promise<boolean>
  showSaveDialog: (options: { title?: string; defaultPath?: string; filters?: Array<{ name: string; extensions: string[] }> }) => Promise<string | null>
  showOpenDialog: (options: { title?: string; filters?: Array<{ name: string; extensions: string[] }> }) => Promise<string | null>
  convertToEpub: (
    input:
      | string
      | {
          pdfPath: string
          outputPath?: string
          mode?: 'reflow-cache' | 'library' | 'export'
        }
  ) => Promise<{
    success: boolean
    epubPath?: string
    title?: string
    author?: string
    pageCount?: number
    imageCount?: number
    error?: string
  }>
  onPdfConvertProgress: (
    callback: (progress: { currentPage: number; totalPages: number; stage: string; percent: number }) => void
  ) => () => void
  setZoomFactor: (factor: number) => void
  getZoomFactor: () => number
  listDownloadedFonts: () => Promise<string[]>
  downloadFont: (fontId: string) => Promise<{
    success: boolean
    offline?: boolean
    alreadyAvailable?: boolean
    error?: string
  }>
  getFontCss: (fontId: string) => Promise<string | null>
  isOnline: () => Promise<boolean>
  checkBookWritable: (filePath: string) => Promise<CheckBookWritableResult>
  writeBookMetadata: (req: WriteBookMetadataRequest) => Promise<WriteBookMetadataResult>
}

const api: DesktopAPI = {
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  toggleFullscreen: () => ipcRenderer.invoke('window:toggleFullscreen'),
  setFullscreen: (active: boolean) => ipcRenderer.invoke('window:setFullscreen', active),
  setBackgroundColor: (color: string) => ipcRenderer.invoke('window:setBackgroundColor', color),
  setWindowTitle: (title: string) => ipcRenderer.invoke('window:setTitle', title),
  showItemInFolder: (filePath: string) => ipcRenderer.invoke('shell:showItemInFolder', filePath),
  onFullscreenChange: (callback: (isFullscreen: boolean) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, isFullscreen: boolean) => callback(isFullscreen)
    ipcRenderer.on('window:fullscreenChanged', listener)
    return () => ipcRenderer.removeListener('window:fullscreenChanged', listener)
  },
  onWindowMaximizedChange: (callback: (isMaximized: boolean) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, isMax: boolean) => callback(isMax)
    ipcRenderer.on('window:maximizedChanged', listener)
    return () => ipcRenderer.removeListener('window:maximizedChanged', listener)
  },
  onWindowFocusChange: (callback: (isFocused: boolean) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, isFocused: boolean) => callback(isFocused)
    ipcRenderer.on('window:focusChanged', listener)
    return () => ipcRenderer.removeListener('window:focusChanged', listener)
  },
  onContentZoom: (callback: (dir: 'in' | 'out' | 'reset') => void) => {
    const listener = (_event: Electron.IpcRendererEvent, dir: 'in' | 'out' | 'reset') => callback(dir)
    ipcRenderer.on('window:contentZoom', listener)
    return () => ipcRenderer.removeListener('window:contentZoom', listener)
  },
  onOpenExternalFile: (callback: (filePath: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, filePath: string) => callback(filePath)
    ipcRenderer.on('app:openExternalFile', listener)
    return () => ipcRenderer.removeListener('app:openExternalFile', listener)
  },
  openFiles: () => ipcRenderer.invoke('dialog:openFiles'),
  openFolder: () => ipcRenderer.invoke('dialog:openFolder'),
  scanFolder: (p) => ipcRenderer.invoke('fs:scanFolder', p),
  readFileBuffer: (p) => ipcRenderer.invoke('fs:readFileBuffer', p),
  readFileText: (p) => ipcRenderer.invoke('fs:readFileText', p),
  writeFileText: (p, content) => ipcRenderer.invoke('fs:writeFileText', p, content),
  writeFileBuffer: (p, buffer) => ipcRenderer.invoke('fs:writeFileBuffer', p, buffer),
  showSaveDialog: (opts) => ipcRenderer.invoke('dialog:showSaveDialog', opts),
  showOpenDialog: (opts) => ipcRenderer.invoke('dialog:showOpenDialog', opts),
  convertToEpub: (input) => ipcRenderer.invoke('pdf:convertToEpub', input),
  onPdfConvertProgress: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: any) => callback(progress)
    ipcRenderer.on('pdf:convertProgress', listener)
    return () => ipcRenderer.removeListener('pdf:convertProgress', listener)
  },
  setZoomFactor: (factor: number) => {
    try {
      webFrame.setZoomFactor(factor)
      ipcRenderer.invoke('window:setZoomFactor', factor)
    } catch (e) {
      console.error('Zoom error', e)
    }
  },
  getZoomFactor: () => {
    try {
      return webFrame.getZoomFactor()
    } catch {
      return 1.0
    }
  },
  listDownloadedFonts: () => ipcRenderer.invoke('fonts:listDownloaded'),
  downloadFont: (fontId: string) => ipcRenderer.invoke('fonts:download', fontId),
  getFontCss: (fontId: string) => ipcRenderer.invoke('fonts:getCss', fontId),
  isOnline: () => ipcRenderer.invoke('fonts:isOnline'),
  checkBookWritable: (filePath: string) => ipcRenderer.invoke('book:checkWritable', filePath),
  writeBookMetadata: (req: WriteBookMetadataRequest) => ipcRenderer.invoke('book:writeMetadata', req)
}

contextBridge.exposeInMainWorld('desktopAPI', api)
