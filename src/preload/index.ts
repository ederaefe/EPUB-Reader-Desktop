import { contextBridge, ipcRenderer, webFrame } from 'electron'
import type {
  CheckBookWritableResult,
  WriteBookMetadataRequest,
  WriteBookMetadataResult
} from '../shared/bookMetadata'
import type {
  ChooseVaultResult,
  DictionaryLookupResponse,
  SecurityBoundariesStatus,
  VaultImportBufferResult,
  WikipediaLookupResponse
} from '../shared/securityTypes'

export interface ScannedBookItem {
  path: string
  subfolder: string | null
}

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
  openExternal: (url: string) => Promise<boolean>
  onFullscreenChange: (callback: (isFullscreen: boolean) => void) => () => void
  onWindowMaximizedChange: (callback: (isMaximized: boolean) => void) => () => void
  onWindowFocusChange: (callback: (isFocused: boolean) => void) => () => void
  onContentZoom: (callback: (dir: 'in' | 'out' | 'reset') => void) => () => void
  onOpenExternalFile: (callback: (filePath: string) => void) => () => void
  openFiles: () => Promise<string[]>
  openFolder: () => Promise<string | null>
  scanFolder: (folderPath: string) => Promise<Array<ScannedBookItem | string>>
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
    cancelled?: boolean
  }>
  cancelPdfConversion: () => Promise<boolean>
  onPdfConvertProgress: (
    callback: (progress: { currentPage: number; totalPages: number; stage: string; percent: number }) => void
  ) => () => void
  clearPdfReflowCache: (pdfPath: string) => Promise<boolean>
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
  lookupDictionary: (query: string) => Promise<DictionaryLookupResponse>
  lookupWikipedia: (query: string) => Promise<WikipediaLookupResponse>
  getSecurityStatus: () => Promise<SecurityBoundariesStatus>
  setStrictOfflineMode: (enabled: boolean) => Promise<SecurityBoundariesStatus>
  chooseVaultFolder: () => Promise<ChooseVaultResult>
  clearVaultFolder: () => Promise<SecurityBoundariesStatus>
  setStrictVaultOnly: (enabled: boolean) => Promise<SecurityBoundariesStatus>
  setCopyImportsIntoVault: (enabled: boolean) => Promise<SecurityBoundariesStatus>
  addAuthorizedFolder: () => Promise<{
    canceled: boolean
    folderPath: string | null
    status: SecurityBoundariesStatus
    error?: string
  }>
  removeAuthorizedFolder: (folderPath: string) => Promise<SecurityBoundariesStatus>
  scanVault: () => Promise<string[]>
  importBufferToVault: (fileName: string, buffer: ArrayBuffer) => Promise<VaultImportBufferResult>
  openVaultInExplorer: () => Promise<boolean>
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
  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
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
  cancelPdfConversion: () => ipcRenderer.invoke('pdf:cancelConversion'),
  onPdfConvertProgress: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: any) => callback(progress)
    ipcRenderer.on('pdf:convertProgress', listener)
    return () => ipcRenderer.removeListener('pdf:convertProgress', listener)
  },
  clearPdfReflowCache: (pdfPath: string) => ipcRenderer.invoke('pdf:clearReflowCache', pdfPath),
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
  writeBookMetadata: (req: WriteBookMetadataRequest) => ipcRenderer.invoke('book:writeMetadata', req),
  lookupDictionary: (query: string) => ipcRenderer.invoke('dict:define', query),
  lookupWikipedia: (query: string) => ipcRenderer.invoke('dict:wiki', query),
  getSecurityStatus: () => ipcRenderer.invoke('security:getStatus'),
  setStrictOfflineMode: (enabled: boolean) => ipcRenderer.invoke('security:setStrictOfflineMode', enabled),
  chooseVaultFolder: () => ipcRenderer.invoke('security:chooseVaultFolder'),
  clearVaultFolder: () => ipcRenderer.invoke('security:clearVaultFolder'),
  setStrictVaultOnly: (enabled: boolean) => ipcRenderer.invoke('security:setStrictVaultOnly', enabled),
  setCopyImportsIntoVault: (enabled: boolean) => ipcRenderer.invoke('security:setCopyImportsIntoVault', enabled),
  addAuthorizedFolder: () => ipcRenderer.invoke('security:addAuthorizedFolder'),
  removeAuthorizedFolder: (folderPath: string) => ipcRenderer.invoke('security:removeAuthorizedFolder', folderPath),
  scanVault: () => ipcRenderer.invoke('security:scanVault'),
  importBufferToVault: (fileName: string, buffer: ArrayBuffer) =>
    ipcRenderer.invoke('security:importBufferToVault', fileName, buffer),
  openVaultInExplorer: () => ipcRenderer.invoke('security:openVaultInExplorer')
}

contextBridge.exposeInMainWorld('desktopAPI', api)
