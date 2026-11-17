import { contextBridge, ipcRenderer, webFrame } from 'electron'

export interface DesktopAPI {
  minimize: () => Promise<void>
  maximize: () => Promise<void>
  close: () => Promise<void>
  isMaximized: () => Promise<boolean>
  toggleFullscreen: () => Promise<boolean>
  setFullscreen: (active: boolean) => Promise<void>
  onFullscreenChange: (callback: (isFullscreen: boolean) => void) => () => void
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
}

const api: DesktopAPI = {
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  toggleFullscreen: () => ipcRenderer.invoke('window:toggleFullscreen'),
  setFullscreen: (active: boolean) => ipcRenderer.invoke('window:setFullscreen', active),
  onFullscreenChange: (callback: (isFullscreen: boolean) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, isFullscreen: boolean) => callback(isFullscreen)
    ipcRenderer.on('window:fullscreenChanged', listener)
    return () => ipcRenderer.removeListener('window:fullscreenChanged', listener)
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
  }
}

contextBridge.exposeInMainWorld('desktopAPI', api)
