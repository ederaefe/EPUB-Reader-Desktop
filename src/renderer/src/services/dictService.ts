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

// Live inline definition lookup via Free Dictionary API with graceful fallback
export async function fetchInlineDefinition(query: string): Promise<InlineDefinition | null> {
  try {
    const cleanWord = query.trim().split(/\s+/)[0].replace(/[^a-zA-Z-]/g, '')
    if (!cleanWord) return null

    const resp = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(cleanWord)}`)
    if (!resp.ok) return null
    const data = await resp.json()
    if (!Array.isArray(data) || data.length === 0) return null

    const entry = data[0]
    return {
      word: entry.word,
      phonetic: entry.phonetic || entry.phonetics?.[0]?.text,
      meanings: entry.meanings.slice(0, 3).map((m: any) => ({
        partOfSpeech: m.partOfSpeech,
        definitions: m.definitions.slice(0, 2).map((d: any) => ({
          definition: d.definition,
          example: d.example
        }))
      }))
    }
  } catch (e) {
    console.warn('Inline definition fetch failed:', e)
    return null
  }
}

// Live encyclopedic summary lookup via Wikipedia REST API
export async function fetchWikipediaSummary(query: string): Promise<WikipediaSummary | null> {
  try {
    const clean = query.trim().slice(0, 60).replace(/["'?!]/g, '')
    if (!clean) return null

    const resp = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(clean)}`)
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
  } catch (e) {
    console.warn('Wikipedia summary fetch failed:', e)
    return null
  }
}
