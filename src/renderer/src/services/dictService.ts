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

  const cachedPromise = dictInflight.get(cleanWord)
  if (cachedPromise) return cachedPromise

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 6000)

  const request = (async () => {
    try {
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
      const result: InlineDefinition = {
        word: entry.word,
        phonetic: entry.phonetic || entry.phonetics?.[0]?.text,
        meanings: Array.isArray(entry.meanings)
          ? entry.meanings.slice(0, 3).map((m: any) => ({
              partOfSpeech: m.partOfSpeech,
              definitions: Array.isArray(m.definitions)
                ? m.definitions.slice(0, 2).map((d: any) => ({
                    definition: d.definition,
                    example: d.example
                  }))
                : []
            }))
          : []
      }
      setInCache(dictResolvedCache, cleanWord, result)
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
        title: data.title,
        description: data.description,
        extract: data.extract,
        thumbnailUrl: data.thumbnail?.source,
        contentUrl: data.content_urls?.desktop?.page
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
