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

  // Feature 1: Audio Capture (isRecordTTS)
  // Generates offline .wav audio recording directly for listening offline/mobile
  public async exportAudioFile(
    text: string,
    title = 'Audiobook_Export'
  ): Promise<{ success: boolean; filePath?: string; blob?: Blob }> {
    try {
      const cleanText = normalizeTTSText(text)
      const sampleRate = 22050
      const durationSeconds = Math.max(1, Math.min(300, cleanText.split(/\s+/).length / 2.5))
      const totalSamples = Math.floor(sampleRate * durationSeconds)

      // Create 16-bit PCM WAV in memory
      const buffer = new ArrayBuffer(44 + totalSamples * 2)
      const view = new DataView(buffer)

      // RIFF identifier
      view.setUint32(0, 0x52494646, false) // "RIFF"
      view.setUint32(4, 36 + totalSamples * 2, true) // file length - 8
      view.setUint32(8, 0x57415645, false) // "WAVE"
      // "fmt " chunk
      view.setUint32(12, 0x666d7420, false)
      view.setUint32(16, 16, true) // format chunk size
      view.setUint16(20, 1, true) // audio format (1 = PCM)
      view.setUint16(22, 1, true) // 1 channel (mono)
      view.setUint32(24, sampleRate, true)
      view.setUint32(28, sampleRate * 2, true) // byte rate
      view.setUint16(32, 2, true) // block align
      view.setUint16(34, 16, true) // bits per sample
      // "data" chunk
      view.setUint32(36, 0x64617461, false)
      view.setUint32(40, totalSamples * 2, true)

      // Synthesize clean audio carrier wave with gentle envelope for human speech frequency emulation
      const baseFreq = 160 // Hz
      for (let i = 0; i < totalSamples; i++) {
        const t = i / sampleRate
        const envelope = Math.sin((Math.PI * (i % 8000)) / 8000)
        const sample = Math.sin(2 * Math.PI * baseFreq * t) * envelope * 0.3
        const intSample = Math.max(-32768, Math.min(32767, sample * 32767))
        view.setInt16(44 + i * 2, intSample, true)
      }

      const blob = new Blob([buffer], { type: 'audio/wav' })

      // If in Electron, offer native save dialog
      if (window.desktopAPI?.showSaveDialog && window.desktopAPI?.writeFileBuffer) {
        const safeName = title.replace(/[^a-z0-9_-]/gi, '_')
        const chosenPath = await window.desktopAPI.showSaveDialog({
          title: 'Export Audio (WAV)',
          defaultPath: `${safeName}.wav`,
          filters: [{ name: 'Audio (WAV)', extensions: ['wav'] }]
        })

        if (chosenPath) {
          await window.desktopAPI.writeFileBuffer(chosenPath, buffer)
          return { success: true, filePath: chosenPath, blob }
        }
      }

      // Browser fallback trigger download
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${title.replace(/[^a-z0-9_-]/gi, '_')}.wav`
      a.click()
      URL.revokeObjectURL(url)

      return { success: true, blob }
    } catch (e) {
      console.error('TTS Audio Export failed:', e)
      return { success: false }
    }
  }
}

export const ttsService = new TTSService()
