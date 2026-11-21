import { app } from 'electron'
import { join, normalize, resolve, sep, extname, basename } from 'path'
import { existsSync, readFileSync, writeFileSync, renameSync, unlinkSync, mkdirSync } from 'fs'
import { copyFile, mkdir, rename, stat, unlink, writeFile } from 'fs/promises'
import { randomBytes } from 'crypto'
import type { SecurityBoundariesStatus } from '../shared/securityTypes'

export const BOUNDARY_ERROR_VAULT = '[OUTSIDE_VAULT_BOUNDARY]'
export const BOUNDARY_ERROR_AUTH = '[OUTSIDE_AUTHORIZED_BOUNDARY]'

export const ALLOWED_NETWORK_HOSTS = [
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'api.dictionaryapi.dev',
  'en.wikipedia.org',
  'upload.wikimedia.org'
]

interface PersistedSecurityConfig {
  version: 1
  vaultPath: string | null
  strictVaultOnly: boolean
  copyImportsIntoVault: boolean
  strictOfflineMode: boolean
  authorizedFolders: string[]
  authorizedFiles: string[]
}

const DEFAULT_CONFIG: PersistedSecurityConfig = {
  version: 1,
  vaultPath: null,
  strictVaultOnly: false,
  copyImportsIntoVault: true,
  strictOfflineMode: false,
  authorizedFolders: [],
  authorizedFiles: []
}

const VAULT_BOOK_EXTS = new Set(['.epub', '.pdf', '.mobi', '.txt'])
const MAX_VAULT_IMPORT_BYTES = 250 * 1024 * 1024

let cachedConfig: PersistedSecurityConfig | null = null

// Session-scoped read paths explicitly chosen via OS Open Dialog (e.g., backup JSON/ZIP files)
const sessionApprovedReadPaths = new Set<string>()

function canonicalKey(p: string): string {
  const norm = normalize(resolve(p))
  return process.platform === 'win32' ? norm.toLowerCase() : norm
}

function isPathInsideDir(candidatePath: string, rootDir: string): boolean {
  const candKey = canonicalKey(candidatePath)
  const rootKey = canonicalKey(rootDir).replace(/[\\/]+$/, '')
  if (!rootKey) return false
  return candKey === rootKey || candKey.startsWith(rootKey + sep)
}

function getConfigPath(): string {
  return join(app.getPath('userData'), 'security-boundaries.json')
}

function dedupePaths(list: unknown): string[] {
  if (!Array.isArray(list)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of list) {
    if (typeof item !== 'string' || !item.trim()) continue
    const norm = normalize(resolve(item))
    const key = canonicalKey(norm)
    if (!seen.has(key)) {
      seen.add(key)
      out.push(norm)
    }
  }
  return out
}

function loadConfig(): PersistedSecurityConfig {
  if (cachedConfig) return cachedConfig
  const cfgPath = getConfigPath()
  try {
    if (existsSync(cfgPath)) {
      const raw = JSON.parse(readFileSync(cfgPath, 'utf-8'))
      if (raw && typeof raw === 'object') {
        const vaultPath =
          typeof raw.vaultPath === 'string' && raw.vaultPath.trim()
            ? normalize(resolve(raw.vaultPath))
            : null
        const strictVaultOnly = Boolean(raw.strictVaultOnly && vaultPath)
        cachedConfig = {
          version: 1,
          vaultPath,
          strictVaultOnly,
          copyImportsIntoVault: raw.copyImportsIntoVault !== false,
          strictOfflineMode: Boolean(raw.strictOfflineMode),
          authorizedFolders: dedupePaths(raw.authorizedFolders),
          authorizedFiles: dedupePaths(raw.authorizedFiles)
        }
        return cachedConfig
      }
    }
  } catch {
    // Fall back safely to defaults on corrupted config
  }
  cachedConfig = { ...DEFAULT_CONFIG, authorizedFolders: [], authorizedFiles: [] }
  return cachedConfig
}

function saveConfig(next: PersistedSecurityConfig): void {
  cachedConfig = next
  const targetPath = getConfigPath()
  const dir = join(app.getPath('userData'))
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  const tempPath = `${targetPath}.${randomBytes(6).toString('hex')}.tmp`
  try {
    writeFileSync(tempPath, JSON.stringify(next, null, 2), { encoding: 'utf-8', flag: 'wx' })
    renameSync(tempPath, targetPath)
  } catch {
    try {
      if (existsSync(tempPath)) unlinkSync(tempPath)
    } catch {
      // ignore temp cleanup errors
    }
  }
}

export function getSecurityStatus(): SecurityBoundariesStatus {
  const cfg = loadConfig()
  return {
    vaultPath: cfg.vaultPath,
    strictVaultOnly: cfg.strictVaultOnly && Boolean(cfg.vaultPath),
    copyImportsIntoVault: cfg.copyImportsIntoVault,
    strictOfflineMode: cfg.strictOfflineMode,
    authorizedFolders: [...cfg.authorizedFolders],
    authorizedFileCount: cfg.authorizedFiles.length,
    allowedNetworkHosts: [...ALLOWED_NETWORK_HOSTS]
  }
}

export function isStrictOfflineMode(): boolean {
  return loadConfig().strictOfflineMode
}

export function setStrictOfflineMode(enabled: boolean): SecurityBoundariesStatus {
  const cfg = loadConfig()
  saveConfig({ ...cfg, strictOfflineMode: Boolean(enabled) })
  return getSecurityStatus()
}

export function setVaultFolder(canonicalVaultDir: string): SecurityBoundariesStatus {
  const cfg = loadConfig()
  const norm = normalize(resolve(canonicalVaultDir))
  const nextFolders = dedupePaths([...cfg.authorizedFolders, norm])
  saveConfig({
    ...cfg,
    vaultPath: norm,
    authorizedFolders: nextFolders
  })
  return getSecurityStatus()
}

export function clearVaultFolder(): SecurityBoundariesStatus {
  const cfg = loadConfig()
  saveConfig({
    ...cfg,
    vaultPath: null,
    strictVaultOnly: false
  })
  return getSecurityStatus()
}

export function setStrictVaultOnly(enabled: boolean): SecurityBoundariesStatus {
  const cfg = loadConfig()
  if (enabled && !cfg.vaultPath) {
    throw new Error('Choose a Library Vault folder before enabling Strict Vault Lock.')
  }
  saveConfig({ ...cfg, strictVaultOnly: Boolean(enabled && cfg.vaultPath) })
  return getSecurityStatus()
}

export function setCopyImportsIntoVault(enabled: boolean): SecurityBoundariesStatus {
  const cfg = loadConfig()
  saveConfig({ ...cfg, copyImportsIntoVault: Boolean(enabled) })
  return getSecurityStatus()
}

export function authorizeFolder(canonicalFolder: string): SecurityBoundariesStatus {
  const cfg = loadConfig()
  const nextFolders = dedupePaths([...cfg.authorizedFolders, canonicalFolder])
  saveConfig({ ...cfg, authorizedFolders: nextFolders })
  return getSecurityStatus()
}

export function removeAuthorizedFolder(folderPath: string): SecurityBoundariesStatus {
  const cfg = loadConfig()
  const targetKey = canonicalKey(folderPath)
  const nextFolders = cfg.authorizedFolders.filter((f) => canonicalKey(f) !== targetKey)
  saveConfig({ ...cfg, authorizedFolders: nextFolders })
  return getSecurityStatus()
}

export function authorizeFile(canonicalFile: string): void {
  const cfg = loadConfig()
  const key = canonicalKey(canonicalFile)
  if (cfg.authorizedFiles.some((f) => canonicalKey(f) === key)) return
  const nextFiles = [...cfg.authorizedFiles, normalize(resolve(canonicalFile))]
  // Cap persisted individual file grants at 5000 oldest-evicted entries to prevent unbounded growth
  const trimmed = nextFiles.length > 5000 ? nextFiles.slice(nextFiles.length - 5000) : nextFiles
  saveConfig({ ...cfg, authorizedFiles: trimmed })
}

export function approveSessionReadPath(canonicalFile: string): void {
  sessionApprovedReadPaths.add(canonicalKey(canonicalFile))
}

/**
 * Enforces the active filesystem boundary (Obsidian-style Vault Lock or Authorized Folders/Files Allowlist).
 * Must be called with a canonical (realpath-resolved) path from assertSafePath / assertSafeFolderPath.
 */
export function assertWithinAuthorizedBoundary(
  canonicalTarget: string,
  kind: 'file' | 'folder'
): void {
  const cfg = loadConfig()
  const userDataDir = app.getPath('userData')

  // App's own private userData storage (reflow_cache, converted_epubs, fonts) is always permitted
  if (isPathInsideDir(canonicalTarget, userDataDir)) {
    return
  }

  // One-time OS Open Dialog picks (e.g., JSON/ZIP backup import) are always permitted for reading
  if (kind === 'file' && sessionApprovedReadPaths.has(canonicalKey(canonicalTarget))) {
    return
  }

  // Vault directory itself or anything inside it is always permitted
  if (cfg.vaultPath && isPathInsideDir(canonicalTarget, cfg.vaultPath)) {
    return
  }

  // Strict Obsidian-style Single-Folder Vault Lock: refuse everything outside vaultPath + userData
  if (cfg.strictVaultOnly && cfg.vaultPath) {
    throw new Error(
      `${BOUNDARY_ERROR_VAULT} Access denied: path is outside the locked Library Vault (${cfg.vaultPath}).`
    )
  }

  // Authorized Folders allowlist
  for (const root of cfg.authorizedFolders) {
    if (isPathInsideDir(canonicalTarget, root)) {
      return
    }
  }

  // Authorized individual files allowlist (exact file match only)
  if (kind === 'file') {
    const targetKey = canonicalKey(canonicalTarget)
    if (cfg.authorizedFiles.some((f) => canonicalKey(f) === targetKey)) {
      return
    }
  }

  throw new Error(
    `${BOUNDARY_ERROR_AUTH} Access denied: path is outside your authorized library folders.`
  )
}

function sanitizeVaultFileName(rawName: string): { stem: string; ext: string } {
  const base = basename(rawName || 'book.epub')
  const ext = extname(base).toLowerCase()
  if (!VAULT_BOOK_EXTS.has(ext)) {
    throw new Error(`Unsupported book format for Vault import: '${ext || 'unknown'}'`)
  }
  const rawStem = basename(base, ext)
  const cleaned = rawStem
    .replace(/[<>:"/\\|?*\x00-\x1F\x7F]/g, '_')
    .replace(/\.+$/, '')
    .trim()
    .slice(0, 120)
  const safeStem =
    !cleaned || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(cleaned) ? 'book' : cleaned
  return { stem: safeStem, ext }
}

function pickUniqueVaultDestination(vaultDir: string, stem: string, ext: string): string {
  let candidate = join(vaultDir, `${stem}${ext}`)
  let counter = 2
  while (existsSync(candidate) && counter < 500) {
    candidate = join(vaultDir, `${stem} (${counter})${ext}`)
    counter++
  }
  if (existsSync(candidate)) {
    candidate = join(vaultDir, `${stem}_${randomBytes(3).toString('hex')}${ext}`)
  }
  return candidate
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

/**
 * Copies an OS-approved local book file into the configured Obsidian-style Vault folder.
 * If the file is already inside the Vault, returns its canonical path without duplicating.
 */
export async function copyFileIntoVaultIfConfigured(canonicalSource: string): Promise<string> {
  const cfg = loadConfig()
  if (!cfg.vaultPath || !cfg.copyImportsIntoVault) {
    return canonicalSource
  }
  if (isPathInsideDir(canonicalSource, cfg.vaultPath)) {
    return canonicalSource
  }

  const ext = extname(canonicalSource).toLowerCase()
  if (!VAULT_BOOK_EXTS.has(ext)) {
    return canonicalSource
  }

  const st = await stat(canonicalSource)
  if (st.size > MAX_VAULT_IMPORT_BYTES) {
    throw new Error('File exceeds the 250 MB safety limit for Vault import.')
  }

  if (!existsSync(cfg.vaultPath)) {
    await mkdir(cfg.vaultPath, { recursive: true })
  }

  const { stem } = sanitizeVaultFileName(basename(canonicalSource))
  const dest = pickUniqueVaultDestination(cfg.vaultPath, stem, ext)
  const tempDest = `${dest}.${randomBytes(6).toString('hex')}.tmp`
  try {
    await copyFile(canonicalSource, tempDest)
    await renameWithWindowsRetry(tempDest, dest)
    return normalize(resolve(dest))
  } catch (err) {
    await unlink(tempDest).catch(() => {})
    throw err
  }
}

/**
 * Writes a dropped book buffer atomically into the configured Obsidian-style Vault folder.
 */
export async function importBufferIntoVault(
  rawFileName: string,
  buffer: ArrayBuffer | ArrayBufferView
): Promise<string> {
  const cfg = loadConfig()
  if (!cfg.vaultPath) {
    throw new Error('No Library Vault folder is configured.')
  }

  const nodeBuf =
    buffer instanceof ArrayBuffer
      ? Buffer.from(buffer)
      : Buffer.from(buffer.buffer, buffer.byteOffset, buffer.byteLength)

  if (nodeBuf.byteLength === 0) {
    throw new Error('Cannot import an empty book file.')
  }
  if (nodeBuf.byteLength > MAX_VAULT_IMPORT_BYTES) {
    throw new Error('Dropped file exceeds the 250 MB safety limit.')
  }

  if (!existsSync(cfg.vaultPath)) {
    await mkdir(cfg.vaultPath, { recursive: true })
  }

  const { stem, ext } = sanitizeVaultFileName(rawFileName)
  const dest = pickUniqueVaultDestination(cfg.vaultPath, stem, ext)
  const tempDest = `${dest}.${randomBytes(6).toString('hex')}.tmp`
  try {
    await writeFile(tempDest, nodeBuf, { flag: 'wx' })
    await renameWithWindowsRetry(tempDest, dest)
    return normalize(resolve(dest))
  } catch (err) {
    await unlink(tempDest).catch(() => {})
    throw err
  }
}
