import { contextBridge, ipcRenderer } from 'electron'

export interface DesktopAPI {
  minimize: () => Promise<void>
  maximize: () => Promise<void>
  close: () => Promise<void>
  isMaximized: () => Promise<boolean>
  openFiles: () => Promise<string[]>
  openFolder: () => Promise<string | null>
  scanFolder: (folderPath: string) => Promise<string[]>
  readFileBuffer: (filePath: string) => Promise<ArrayBuffer>
  convertToEpub: (pdfPath: string) => Promise<{ success: boolean; epubPath?: string; error?: string }>
}

const api: DesktopAPI = {
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  openFiles: () => ipcRenderer.invoke('dialog:openFiles'),
  openFolder: () => ipcRenderer.invoke('dialog:openFolder'),
  scanFolder: (p) => ipcRenderer.invoke('fs:scanFolder', p),
  readFileBuffer: (p) => ipcRenderer.invoke('fs:readFileBuffer', p),
  convertToEpub: (p) => ipcRenderer.invoke('pdf:convertToEpub', p)
}

contextBridge.exposeInMainWorld('desktopAPI', api)
