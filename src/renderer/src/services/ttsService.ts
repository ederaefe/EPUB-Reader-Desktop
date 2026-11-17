// Librera Reader TTS Pronunciation Rules Matrix
// Enhanced with full regex translation matrix from assets/dict/TTS_Librera_Rules.txt & advanced_feature_plan.md

const ROMAN_NUMERALS: Record<string, string> = {
  I: '1',
  II: '2',
  III: '3',
  IV: '4',
  V: '5',
  VI: '6',
  VII: '7',
  VIII: '8',
  IX: '9',
  X: '10',
  XI: '11',
  XII: '12',
  XIII: '13',
  XIV: '14',
  XV: '15',
  XVI: '16',
  XVII: '17',
  XVIII: '18',
  XIX: '19',
  XX: '20'
}

const RULES: [RegExp, string | ((...args: any[]) => string)][] = [
  // Acronyms and letter dots
  [/(\p{Alpha})\.(\p{Alpha})\.(\p{Alpha})\.(\p{Alpha})\./gu, '$1 $2 $3 $4 '],
  [/(\p{Alpha}{1,3})\.(\p{Alpha}{1,3})\.(\p{Alpha}{1,3})\./gu, '$1 $2 $3 '],
  [/(\p{Alpha}{1,3})\.(\p{Alpha}{1,4})\./gu, '$1 $2 '],
  [/(\p{Alpha}{1,2})\. (\p{Alpha}{1,2})\./gu, '$1 $2 '],
  [/(\p{Alpha}{1,2})\./gu, '$1 '],

  // Decimals (e.g. 3.14 -> 3 point 14)
  [/(\d+)\.(\d+)/gu, '$1 point $2 '],

  // Common reading abbreviations
  [/\be\.g\.,?/gi, 'for example, '],
  [/\bi\.e\.,?/gi, 'that is, '],
  [/\betc\./gi, 'etcetera.'],
  [/\bvs\./gi, 'versus'],
  [/\bDr\./g, 'Doctor '],
  [/\bMr\./g, 'Mister '],
  [/\bMrs\./g, 'Missus '],
  [/\bMs\./g, 'Miz '],
  [/\bProf\./g, 'Professor '],
  [/\bpp?\.\s*(\d+)/gi, 'page $1'],
  [/\bch\.\s*(\d+)/gi, 'chapter $1'],
  [/\bvol\.\s*(\d+)/gi, 'volume $1'],

  // Roman Numerals in headers (Chapter IV -> Chapter 4, Part III -> Part 3)
  [/\b(Chapter|Part|Book|Act|Scene|Section)\s+([IVXLCDM]+)\b/gi, (_: string, prefix: string, roman: string) => {
    const upper = roman.toUpperCase()
    const converted = ROMAN_NUMERALS[upper] || roman
    return `${prefix} ${converted}`
  }]
]

export function normalizeTTSText(raw: string): string {
  let text = raw
  for (const [pattern, replacement] of RULES) {
    if (typeof replacement === 'string') {
      text = text.replace(pattern, replacement)
    } else {
      text = text.replace(pattern, replacement as any)
    }
  }
  return text
}

export function splitIntoSentences(text: string): string[] {
  // Regex to split text into sentences while respecting abbreviations
  const normalized = normalizeTTSText(text)
  const matches = normalized.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g)
  if (!matches) return [text]
  return matches.map((s) => s.trim()).filter((s) => s.length > 0)
}

class TTSService {
  private utterance: SpeechSynthesisUtterance | null = null
  private onBoundaryCallback: ((word: string, charIndex: number) => void) | null = null
  private isSynthesizing = false

  public speak(
    text: string,
    options: {
      rate?: number
      pitch?: number
      voiceURI?: string | null
      onEnd?: () => void
      onBoundary?: (word: string, charIndex: number) => void
    } = {}
  ): void {
    if (!('speechSynthesis' in window)) return

    window.speechSynthesis.cancel()
    const cleanText = normalizeTTSText(text)
    this.utterance = new SpeechSynthesisUtterance(cleanText)
    this.utterance.rate = options.rate ?? 1.0
    this.utterance.pitch = options.pitch ?? 1.0

    if (options.voiceURI) {
      const voice = window.speechSynthesis.getVoices().find((v) => v.voiceURI === options.voiceURI)
      if (voice) this.utterance.voice = voice
    }

    if (options.onBoundary) {
      this.onBoundaryCallback = options.onBoundary
      this.utterance.onboundary = (e) => {
        if (e.name === 'word') {
          const word = cleanText.slice(e.charIndex, e.charIndex + (e.charLength || 6))
          this.onBoundaryCallback?.(word, e.charIndex)
        }
      }
    }

    if (options.onEnd) {
      this.utterance.onend = options.onEnd
    }

    this.isSynthesizing = true
    window.speechSynthesis.speak(this.utterance)
  }

  public pause(): void {
    window.speechSynthesis.pause()
  }

  public resume(): void {
    window.speechSynthesis.resume()
  }

  public stop(): void {
    this.isSynthesizing = false
    window.speechSynthesis.cancel()
  }

  public getVoices(): SpeechSynthesisVoice[] {
    return window.speechSynthesis.getVoices()
  }
}

export const ttsService = new TTSService()
