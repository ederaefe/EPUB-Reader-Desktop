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
