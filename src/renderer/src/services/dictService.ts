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

const dictInflight = new Map<string, Promise<InlineDefinition | null>>()
const wikiInflight = new Map<string, Promise<WikipediaSummary | null>>()

// Live inline definition lookup via Free Dictionary API with graceful fallback, timeout & dedup
export async function fetchInlineDefinition(query: string): Promise<InlineDefinition | null> {
  const cleanWord = query.trim().split(/\s+/)[0].replace(/[^a-zA-Z-]/g, '').slice(0, 48)
  if (!cleanWord) return null

  const cached = dictInflight.get(cleanWord)
  if (cached) return cached

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 6000)

  const request = (async () => {
    try {
      const resp = await fetch(
        `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(cleanWord)}`,
        { signal: controller.signal }
      )
      if (!resp.ok) return null
      const data = await resp.json()
      if (!Array.isArray(data) || data.length === 0) return null

      const entry = data[0]
      return {
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

// Live encyclopedic summary lookup via Wikipedia REST API with timeout & dedup
export async function fetchWikipediaSummary(query: string): Promise<WikipediaSummary | null> {
  const clean = query.trim().slice(0, 60).replace(/["'?!]/g, '')
  if (!clean) return null

  const cached = wikiInflight.get(clean)
  if (cached) return cached

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 6000)

  const request = (async () => {
    try {
      const resp = await fetch(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(clean)}`,
        { signal: controller.signal }
      )
      if (!resp.ok) return null
      const data = await resp.json()

      if (!data.extract) return null
      return {
        title: data.title,
        description: data.description,
        extract: data.extract,
        thumbnailUrl: data.thumbnail?.source,
        contentUrl: data.content_urls?.desktop?.page
      }
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
