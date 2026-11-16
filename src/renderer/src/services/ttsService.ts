// Librera Reader TTS Pronunciation Rules Matrix
// Extracted from assets/dict/TTS_Librera_Rules.txt
const RULES: [RegExp, string][] = [
  [/(\p{Alpha})\.(\p{Alpha})\.(\p{Alpha})\.(\p{Alpha})\./gu, '$1 $2 $3 $4 '],
  [/(\p{Alpha}{1,3})\.(\p{Alpha}{1,3})\.(\p{Alpha}{1,3})\./gu, '$1 $2 $3 '],
  [/(\p{Alpha}{1,3})\.(\p{Alpha}{1,4})\./gu, '$1 $2 '],
  [/(\p{Alpha}{1,2})\. (\p{Alpha}{1,2})\./gu, '$1 $2 '],
  [/(\p{Alpha}{1,2})\./gu, '$1 '],
  [/(\d+)\.(\d+)/gu, '$1 point $2 ']
]

export function normalizeTTSText(raw: string): string {
  let text = raw
  for (const [pattern, replacement] of RULES) {
    text = text.replace(pattern, replacement)
  }
  return text
}

class TTSService {
  private utterance: SpeechSynthesisUtterance | null = null
  private onBoundaryCallback: ((word: string, charIndex: number) => void) | null = null

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

    window.speechSynthesis.speak(this.utterance)
  }

  public pause(): void {
    window.speechSynthesis.pause()
  }

  public resume(): void {
    window.speechSynthesis.resume()
  }

  public stop(): void {
    window.speechSynthesis.cancel()
  }

  public getVoices(): SpeechSynthesisVoice[] {
    return window.speechSynthesis.getVoices()
  }
}

export const ttsService = new TTSService()
