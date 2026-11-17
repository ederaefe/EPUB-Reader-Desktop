export interface SecurityBoundariesStatus {
  vaultPath: string | null
  strictVaultOnly: boolean
  copyImportsIntoVault: boolean
  strictOfflineMode: boolean
  authorizedFolders: string[]
  authorizedFileCount: number
  allowedNetworkHosts: string[]
}

export interface VaultImportBufferResult {
  success: boolean
  filePath?: string
  error?: string
}

export interface ChooseVaultResult {
  canceled: boolean
  status: SecurityBoundariesStatus
  scannedFiles: string[]
  error?: string
}

export interface DictionaryLookupResponse {
  ok: boolean
  offline?: boolean
  data?: {
    word: string
    phonetic?: string
    meanings: Array<{
      partOfSpeech: string
      definitions: Array<{
        definition: string
        example?: string
      }>
    }>
  } | null
}

export interface WikipediaLookupResponse {
  ok: boolean
  offline?: boolean
  data?: {
    title: string
    extract: string
    description?: string
    thumbnailUrl?: string
    contentUrl?: string
  } | null
}
