export interface DictProvider {
  name: string
  url: string
}

// Extracted from Librera Reader APK assets/app-WebDict.json
export const DICT_PROVIDERS: DictProvider[] = [
  { name: 'Merriam-Webster', url: 'https://www.merriam-webster.com/dictionary/%s' },
  { name: 'Oxford Learners', url: 'https://www.oxfordlearnersdictionaries.com/definition/english/%s' },
  { name: 'Cambridge Dictionary', url: 'https://dictionary.cambridge.org/dictionary/english/%s' },
  { name: 'Collins Dictionary', url: 'https://www.collinsdictionary.com/dictionary/english/%s' },
  { name: 'Google Translate', url: 'https://translate.google.com/#auto/en/%s' },
  { name: 'DeepL Translate', url: 'https://www.deepl.com/translator#auto/en/%s' },
  { name: 'Vocabulary.com', url: 'https://www.vocabulary.com/dictionary/%s' },
  { name: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/%s' },
  { name: 'Wiktionary', url: 'https://en.wiktionary.org/wiki/%s' }
]

export function getDefinitionUrl(providerName: string, query: string): string {
  const provider = DICT_PROVIDERS.find((p) => p.name === providerName) || DICT_PROVIDERS[0]
  return provider.url.replace(/%s/g, encodeURIComponent(query.trim()))
}

export interface InlineDefinition {
  word: string
  phonetic?: string
  meanings: Array<{
    partOfSpeech: string
    definitions: Array<{
      definition: string
      example?: string
    }>
  }>
}

export interface WikipediaSummary {
  title: string
  extract: string
  description?: string
  thumbnailUrl?: string
  contentUrl?: string
}

interface CacheEntry<T> {
  data: T
  expiresAt: number
}

const CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutes
const MAX_CACHE_ENTRIES = 200

const dictResolvedCache = new Map<string, CacheEntry<InlineDefinition>>()
const wikiResolvedCache = new Map<string, CacheEntry<WikipediaSummary>>()

export interface DictHistoryEntry {
  word: string
  definition: InlineDefinition
  timestamp: number
}

const DICT_HISTORY_KEY = 'semply_dict_history'
const MAX_HISTORY_ENTRIES = 100

export function getDictionaryHistory(): DictHistoryEntry[] {
  try {
    const raw = localStorage.getItem(DICT_HISTORY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveToDictionaryHistory(word: string, definition: InlineDefinition): void {
  try {
    const cleanWord = word.trim()
    if (!cleanWord || !definition) return
    const current = getDictionaryHistory()
    const filtered = current.filter((item) => item.word.toLowerCase() !== cleanWord.toLowerCase())
    filtered.unshift({
      word: cleanWord,
      definition,
      timestamp: Date.now()
    })
    const trimmed = filtered.slice(0, MAX_HISTORY_ENTRIES)
    localStorage.setItem(DICT_HISTORY_KEY, JSON.stringify(trimmed))
  } catch (err) {
    console.warn('Failed to save dictionary history:', err)
  }
}

export function clearDictionaryHistory(): void {
  try {
    localStorage.removeItem(DICT_HISTORY_KEY)
  } catch {}
}

function getFromCache<T>(cache: Map<string, CacheEntry<T>>, key: string): T | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    cache.delete(key)
    return null
  }
  return entry.data
}

function setInCache<T>(cache: Map<string, CacheEntry<T>>, key: string, data: T): void {
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const firstKey = cache.keys().next().value
    if (firstKey) cache.delete(firstKey)
  }
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS })
}

const dictInflight = new Map<string, Promise<InlineDefinition | null>>()
const wikiInflight = new Map<string, Promise<WikipediaSummary | null>>()

// Live inline definition lookup via Free Dictionary API with TTL cache, timeout & dedup
export async function fetchInlineDefinition(query: string): Promise<InlineDefinition | null> {
  const cleanWord = query.trim().split(/\s+/)[0].replace(/[^a-zA-Z-]/g, '').slice(0, 48)
  if (!cleanWord) return null

  const cachedResult = getFromCache(dictResolvedCache, cleanWord)
  if (cachedResult) return cachedResult

  // Check persistent history cache for instant offline definitions
  const history = getDictionaryHistory()
  const historyMatch = history.find((h) => h.word.toLowerCase() === cleanWord.toLowerCase())
  if (historyMatch?.definition) {
    setInCache(dictResolvedCache, cleanWord, historyMatch.definition)
    return historyMatch.definition
  }

  const cachedPromise = dictInflight.get(cleanWord)
  if (cachedPromise) return cachedPromise

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 6000)

  const request = (async () => {
    try {
      // Desktop mode: route strictly through air-gapped Main-process allowlisted IPC gateway
      if (window.desktopAPI?.lookupDictionary) {
        const res = await window.desktopAPI.lookupDictionary(cleanWord)
        if (!res?.ok || !res.data) return null
        setInCache(dictResolvedCache, cleanWord, res.data)
        saveToDictionaryHistory(cleanWord, res.data)
        return res.data
      }

      const resp = await fetch(
        `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(cleanWord)}`,
        { signal: controller.signal }
      )
      if (!resp.ok) return null
      const contentType = resp.headers.get('content-type') || ''
      if (!contentType.includes('application/json')) return null

      const data = await resp.json()
      if (!Array.isArray(data) || data.length === 0) return null

      const entry = data[0]
      if (!entry || typeof entry !== 'object') return null
      const result: InlineDefinition = {
        word: typeof entry.word === 'string' ? entry.word : cleanWord,
        phonetic:
          typeof entry.phonetic === 'string'
            ? entry.phonetic
            : typeof entry.phonetics?.[0]?.text === 'string'
            ? entry.phonetics[0].text
            : undefined,
        meanings: Array.isArray(entry.meanings)
          ? entry.meanings
              .filter((m: any) => m && typeof m.partOfSpeech === 'string')
              .slice(0, 3)
              .map((m: any) => ({
                partOfSpeech: m.partOfSpeech,
                definitions: Array.isArray(m.definitions)
                  ? m.definitions
                      .filter((d: any) => d && typeof d.definition === 'string')
                      .slice(0, 2)
                      .map((d: any) => ({
                        definition: d.definition,
                        example: typeof d.example === 'string' ? d.example : undefined
                      }))
                  : []
              }))
          : []
      }
      setInCache(dictResolvedCache, cleanWord, result)
      saveToDictionaryHistory(cleanWord, result)
      return result
    } catch {
      return null
    } finally {
      clearTimeout(timer)
      dictInflight.delete(cleanWord)
    }
  })()

  dictInflight.set(cleanWord, request)
  return request
}

function sanitizeTrustedHttpsUrl(
  rawUrl: unknown,
  allowedHostSuffixes: string[]
): string | undefined {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) return undefined
  try {
    const parsed = new URL(rawUrl.trim())
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return undefined
    const host = parsed.hostname.toLowerCase()
    const allowed = allowedHostSuffixes.some((suffix) => host === suffix || host.endsWith(`.${suffix}`))
    return allowed ? parsed.toString() : undefined
  } catch {
    return undefined
  }
}

// Live encyclopedic summary lookup via Wikipedia REST API with TTL cache, timeout & dedup
export async function fetchWikipediaSummary(query: string): Promise<WikipediaSummary | null> {
  const clean = query.trim().slice(0, 60).replace(/["'?!]/g, '')
  if (!clean) return null

  const cachedResult = getFromCache(wikiResolvedCache, clean)
  if (cachedResult) return cachedResult

  const cachedPromise = wikiInflight.get(clean)
  if (cachedPromise) return cachedPromise

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 6000)

  const request = (async () => {
    try {
      // Desktop mode: route strictly through air-gapped Main-process allowlisted IPC gateway
      if (window.desktopAPI?.lookupWikipedia) {
        const res = await window.desktopAPI.lookupWikipedia(clean)
        if (!res?.ok || !res.data) return null
        setInCache(wikiResolvedCache, clean, res.data)
        return res.data
      }

      const resp = await fetch(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(clean)}`,
        { signal: controller.signal }
      )
      if (!resp.ok) return null
      const contentType = resp.headers.get('content-type') || ''
      if (!contentType.includes('application/json')) return null

      const data = await resp.json()
      if (!data.extract) return null

      const result: WikipediaSummary = {
        title: typeof data.title === 'string' ? data.title : clean,
        description: typeof data.description === 'string' ? data.description : undefined,
        extract: typeof data.extract === 'string' ? data.extract : '',
        thumbnailUrl: sanitizeTrustedHttpsUrl(data.thumbnail?.source, ['wikimedia.org', 'wikipedia.org']),
        contentUrl: sanitizeTrustedHttpsUrl(data.content_urls?.desktop?.page, ['wikipedia.org'])
      }
      setInCache(wikiResolvedCache, clean, result)
      return result
    } catch {
      return null
    } finally {
      clearTimeout(timer)
      wikiInflight.delete(clean)
    }
  })()

  wikiInflight.set(clean, request)
  return request
}
