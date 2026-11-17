export type FontCategory = 'builtin' | 'serif' | 'sans' | 'accessible' | 'slab' | 'mono'

export interface FontEntry {
  id: string
  name: string
  cssFamily: string
  /** Google Fonts family name. Undefined means the font is always available offline locally. */
  googleFamily?: string
  category: FontCategory
  fallback: string
  hasItalic?: boolean
}

export const FONT_CATEGORY_LABELS: Record<FontCategory | 'all', string> = {
  all: 'All',
  builtin: 'Built-in',
  serif: 'Serif',
  sans: 'Sans',
  accessible: 'Accessible',
  slab: 'Slab',
  mono: 'Mono'
}

export const FONT_CATALOG: FontEntry[] = [
  // =========================================================================
  // 1. Always-Available Offline / Built-in System & Publisher Fonts (12)
  // =========================================================================
  {
    id: 'original',
    name: 'Publisher Original',
    cssFamily: 'inherit',
    category: 'builtin',
    fallback: 'inherit'
  },
  {
    id: 'serif',
    name: 'Georgia',
    cssFamily: 'Georgia, "Times New Roman", serif',
    category: 'serif',
    fallback: 'serif'
  },
  {
    id: 'sans-serif',
    name: 'Segoe UI (System Sans)',
    cssFamily: '"Segoe UI", -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif',
    category: 'sans',
    fallback: 'sans-serif'
  },
  {
    id: 'monospace',
    name: 'Consolas (System Mono)',
    cssFamily: 'Consolas, "Cascadia Mono", ui-monospace, monospace',
    category: 'mono',
    fallback: 'monospace'
  },
  {
    id: 'palatino',
    name: 'Palatino Linotype',
    cssFamily: '"Palatino Linotype", "Book Antiqua", Palatino, serif',
    category: 'serif',
    fallback: 'serif'
  },
  {
    id: 'book-antiqua',
    name: 'Book Antiqua',
    cssFamily: '"Book Antiqua", Palatino, Georgia, serif',
    category: 'serif',
    fallback: 'serif'
  },
  {
    id: 'garamond-sys',
    name: 'Garamond',
    cssFamily: 'Garamond, "EB Garamond", Georgia, serif',
    category: 'serif',
    fallback: 'serif'
  },
  {
    id: 'times-new-roman',
    name: 'Times New Roman',
    cssFamily: '"Times New Roman", Times, serif',
    category: 'serif',
    fallback: 'serif'
  },
  {
    id: 'cambria',
    name: 'Cambria',
    cssFamily: 'Cambria, Georgia, serif',
    category: 'serif',
    fallback: 'serif'
  },
  {
    id: 'calibri',
    name: 'Calibri',
    cssFamily: 'Calibri, "Segoe UI", sans-serif',
    category: 'sans',
    fallback: 'sans-serif'
  },
  {
    id: 'verdana',
    name: 'Verdana',
    cssFamily: 'Verdana, Geneva, sans-serif',
    category: 'accessible',
    fallback: 'sans-serif'
  },
  {
    id: 'trebuchet-ms',
    name: 'Trebuchet MS',
    cssFamily: '"Trebuchet MS", Helvetica, sans-serif',
    category: 'sans',
    fallback: 'sans-serif'
  },

  // =========================================================================
  // 2. Book & Literary Serifs — Downloadable Google Fonts (22)
  // =========================================================================
  {
    id: 'literata',
    name: 'Literata',
    cssFamily: '"Literata", Georgia, serif',
    googleFamily: 'Literata',
    category: 'serif',
    fallback: 'Georgia, serif',
    hasItalic: true
  },
  {
    id: 'merriweather',
    name: 'Merriweather',
    cssFamily: '"Merriweather", Georgia, serif',
    googleFamily: 'Merriweather',
    category: 'serif',
    fallback: 'Georgia, serif',
    hasItalic: true
  },
  {
    id: 'lora',
    name: 'Lora',
    cssFamily: '"Lora", Georgia, serif',
    googleFamily: 'Lora',
    category: 'serif',
    fallback: 'Georgia, serif',
    hasItalic: true
  },
  {
    id: 'eb-garamond',
    name: 'EB Garamond',
    cssFamily: '"EB Garamond", Garamond, serif',
    googleFamily: 'EB Garamond',
    category: 'serif',
    fallback: 'Georgia, serif',
    hasItalic: true
  },
  {
    id: 'crimson-pro',
    name: 'Crimson Pro',
    cssFamily: '"Crimson Pro", Georgia, serif',
    googleFamily: 'Crimson Pro',
    category: 'serif',
    fallback: 'Georgia, serif',
    hasItalic: true
  },
  {
    id: 'libre-baskerville',
    name: 'Libre Baskerville',
    cssFamily: '"Libre Baskerville", Baskerville, Georgia, serif',
    googleFamily: 'Libre Baskerville',
    category: 'serif',
    fallback: 'Georgia, serif',
    hasItalic: true
  },
  {
    id: 'source-serif-4',
    name: 'Source Serif 4',
    cssFamily: '"Source Serif 4", Georgia, serif',
    googleFamily: 'Source Serif 4',
    category: 'serif',
    fallback: 'Georgia, serif',
    hasItalic: true
  },
  {
    id: 'newsreader',
    name: 'Newsreader',
    cssFamily: '"Newsreader", Georgia, serif',
    googleFamily: 'Newsreader',
    category: 'serif',
    fallback: 'Georgia, serif',
    hasItalic: true
  },
  {
    id: 'spectral',
    name: 'Spectral',
    cssFamily: '"Spectral", Georgia, serif',
    googleFamily: 'Spectral',
    category: 'serif',
    fallback: 'Georgia, serif',
    hasItalic: true
  },
  {
    id: 'cormorant-garamond',
    name: 'Cormorant Garamond',
    cssFamily: '"Cormorant Garamond", Garamond, serif',
    googleFamily: 'Cormorant Garamond',
    category: 'serif',
    fallback: 'Georgia, serif',
    hasItalic: true
  },
  {
    id: 'vollkorn',
    name: 'Vollkorn',
    cssFamily: '"Vollkorn", Georgia, serif',
    googleFamily: 'Vollkorn',
    category: 'serif',
    fallback: 'Georgia, serif',
    hasItalic: true
  },
  {
    id: 'alegreya',
    name: 'Alegreya',
    cssFamily: '"Alegreya", Georgia, serif',
    googleFamily: 'Alegreya',
    category: 'serif',
    fallback: 'Georgia, serif',
    hasItalic: true
  },
  {
    id: 'noto-serif',
    name: 'Noto Serif',
    cssFamily: '"Noto Serif", Georgia, serif',
    googleFamily: 'Noto Serif',
    category: 'serif',
    fallback: 'Georgia, serif',
    hasItalic: true
  },
  {
    id: 'pt-serif',
    name: 'PT Serif',
    cssFamily: '"PT Serif", Georgia, serif',
    googleFamily: 'PT Serif',
    category: 'serif',
    fallback: 'Georgia, serif',
    hasItalic: true
  },
  {
    id: 'cardo',
    name: 'Cardo',
    cssFamily: '"Cardo", Georgia, serif',
    googleFamily: 'Cardo',
    category: 'serif',
    fallback: 'Georgia, serif',
    hasItalic: true
  },
  {
    id: 'gentium-plus',
    name: 'Gentium Plus',
    cssFamily: '"Gentium Plus", Georgia, serif',
    googleFamily: 'Gentium Plus',
    category: 'serif',
    fallback: 'Georgia, serif',
    hasItalic: true
  },
  {
    id: 'playfair-display',
    name: 'Playfair Display',
    cssFamily: '"Playfair Display", Georgia, serif',
    googleFamily: 'Playfair Display',
    category: 'serif',
    fallback: 'Georgia, serif',
    hasItalic: true
  },
  {
    id: 'bodoni-moda',
    name: 'Bodoni Moda',
    cssFamily: '"Bodoni Moda", Georgia, serif',
    googleFamily: 'Bodoni Moda',
    category: 'serif',
    fallback: 'Georgia, serif',
    hasItalic: true
  },
  {
    id: 'domine',
    name: 'Domine',
    cssFamily: '"Domine", Georgia, serif',
    googleFamily: 'Domine',
    category: 'serif',
    fallback: 'Georgia, serif',
    hasItalic: false
  },
  {
    id: 'bitter',
    name: 'Bitter',
    cssFamily: '"Bitter", Georgia, serif',
    googleFamily: 'Bitter',
    category: 'serif',
    fallback: 'Georgia, serif',
    hasItalic: true
  },
  {
    id: 'gelasio',
    name: 'Gelasio',
    cssFamily: '"Gelasio", Georgia, serif',
    googleFamily: 'Gelasio',
    category: 'serif',
    fallback: 'Georgia, serif',
    hasItalic: true
  },
  {
    id: 'fraunces',
    name: 'Fraunces',
    cssFamily: '"Fraunces", Georgia, serif',
    googleFamily: 'Fraunces',
    category: 'serif',
    fallback: 'Georgia, serif',
    hasItalic: true
  },

  // =========================================================================
  // 3. Clean Sans-Serif — Downloadable Google Fonts (20)
  // =========================================================================
  {
    id: 'inter',
    name: 'Inter',
    cssFamily: '"Inter", "Segoe UI", sans-serif',
    googleFamily: 'Inter',
    category: 'sans',
    fallback: 'sans-serif',
    hasItalic: true
  },
  {
    id: 'roboto',
    name: 'Roboto',
    cssFamily: '"Roboto", "Segoe UI", sans-serif',
    googleFamily: 'Roboto',
    category: 'sans',
    fallback: 'sans-serif',
    hasItalic: true
  },
  {
    id: 'open-sans',
    name: 'Open Sans',
    cssFamily: '"Open Sans", "Segoe UI", sans-serif',
    googleFamily: 'Open Sans',
    category: 'sans',
    fallback: 'sans-serif',
    hasItalic: true
  },
  {
    id: 'lato',
    name: 'Lato',
    cssFamily: '"Lato", "Segoe UI", sans-serif',
    googleFamily: 'Lato',
    category: 'sans',
    fallback: 'sans-serif',
    hasItalic: true
  },
  {
    id: 'nunito',
    name: 'Nunito',
    cssFamily: '"Nunito", "Segoe UI", sans-serif',
    googleFamily: 'Nunito',
    category: 'sans',
    fallback: 'sans-serif',
    hasItalic: true
  },
  {
    id: 'source-sans-3',
    name: 'Source Sans 3',
    cssFamily: '"Source Sans 3", "Segoe UI", sans-serif',
    googleFamily: 'Source Sans 3',
    category: 'sans',
    fallback: 'sans-serif',
    hasItalic: true
  },
  {
    id: 'work-sans',
    name: 'Work Sans',
    cssFamily: '"Work Sans", "Segoe UI", sans-serif',
    googleFamily: 'Work Sans',
    category: 'sans',
    fallback: 'sans-serif',
    hasItalic: true
  },
  {
    id: 'plus-jakarta-sans',
    name: 'Plus Jakarta Sans',
    cssFamily: '"Plus Jakarta Sans", "Segoe UI", sans-serif',
    googleFamily: 'Plus Jakarta Sans',
    category: 'sans',
    fallback: 'sans-serif',
    hasItalic: true
  },
  {
    id: 'dm-sans',
    name: 'DM Sans',
    cssFamily: '"DM Sans", "Segoe UI", sans-serif',
    googleFamily: 'DM Sans',
    category: 'sans',
    fallback: 'sans-serif',
    hasItalic: true
  },
  {
    id: 'ibm-plex-sans',
    name: 'IBM Plex Sans',
    cssFamily: '"IBM Plex Sans", "Segoe UI", sans-serif',
    googleFamily: 'IBM Plex Sans',
    category: 'sans',
    fallback: 'sans-serif',
    hasItalic: true
  },
  {
    id: 'outfit',
    name: 'Outfit',
    cssFamily: '"Outfit", "Segoe UI", sans-serif',
    googleFamily: 'Outfit',
    category: 'sans',
    fallback: 'sans-serif',
    hasItalic: false
  },
  {
    id: 'manrope',
    name: 'Manrope',
    cssFamily: '"Manrope", "Segoe UI", sans-serif',
    googleFamily: 'Manrope',
    category: 'sans',
    fallback: 'sans-serif',
    hasItalic: false
  },
  {
    id: 'public-sans',
    name: 'Public Sans',
    cssFamily: '"Public Sans", "Segoe UI", sans-serif',
    googleFamily: 'Public Sans',
    category: 'sans',
    fallback: 'sans-serif',
    hasItalic: true
  },
  {
    id: 'karla',
    name: 'Karla',
    cssFamily: '"Karla", "Segoe UI", sans-serif',
    googleFamily: 'Karla',
    category: 'sans',
    fallback: 'sans-serif',
    hasItalic: true
  },
  {
    id: 'rubik',
    name: 'Rubik',
    cssFamily: '"Rubik", "Segoe UI", sans-serif',
    googleFamily: 'Rubik',
    category: 'sans',
    fallback: 'sans-serif',
    hasItalic: true
  },
  {
    id: 'mulish',
    name: 'Mulish',
    cssFamily: '"Mulish", "Segoe UI", sans-serif',
    googleFamily: 'Mulish',
    category: 'sans',
    fallback: 'sans-serif',
    hasItalic: true
  },
  {
    id: 'fira-sans',
    name: 'Fira Sans',
    cssFamily: '"Fira Sans", "Segoe UI", sans-serif',
    googleFamily: 'Fira Sans',
    category: 'sans',
    fallback: 'sans-serif',
    hasItalic: true
  },
  {
    id: 'pt-sans',
    name: 'PT Sans',
    cssFamily: '"PT Sans", "Segoe UI", sans-serif',
    googleFamily: 'PT Sans',
    category: 'sans',
    fallback: 'sans-serif',
    hasItalic: true
  },
  {
    id: 'noto-sans',
    name: 'Noto Sans',
    cssFamily: '"Noto Sans", "Segoe UI", sans-serif',
    googleFamily: 'Noto Sans',
    category: 'sans',
    fallback: 'sans-serif',
    hasItalic: true
  },
  {
    id: 'figtree',
    name: 'Figtree',
    cssFamily: '"Figtree", "Segoe UI", sans-serif',
    googleFamily: 'Figtree',
    category: 'sans',
    fallback: 'sans-serif',
    hasItalic: true
  },

  // =========================================================================
  // 4. Reading & Accessibility Focused — Downloadable Google Fonts (8)
  // =========================================================================
  {
    id: 'atkinson-hyperlegible',
    name: 'Atkinson Hyperlegible',
    cssFamily: '"Atkinson Hyperlegible", Verdana, sans-serif',
    googleFamily: 'Atkinson Hyperlegible',
    category: 'accessible',
    fallback: 'sans-serif',
    hasItalic: true
  },
  {
    id: 'lexend',
    name: 'Lexend',
    cssFamily: '"Lexend", Verdana, sans-serif',
    googleFamily: 'Lexend',
    category: 'accessible',
    fallback: 'sans-serif',
    hasItalic: false
  },
  {
    id: 'lexend-deca',
    name: 'Lexend Deca',
    cssFamily: '"Lexend Deca", Verdana, sans-serif',
    googleFamily: 'Lexend Deca',
    category: 'accessible',
    fallback: 'sans-serif',
    hasItalic: false
  },
  {
    id: 'andika',
    name: 'Andika',
    cssFamily: '"Andika", Verdana, sans-serif',
    googleFamily: 'Andika',
    category: 'accessible',
    fallback: 'sans-serif',
    hasItalic: true
  },
  {
    id: 'comic-neue',
    name: 'Comic Neue',
    cssFamily: '"Comic Neue", Verdana, sans-serif',
    googleFamily: 'Comic Neue',
    category: 'accessible',
    fallback: 'sans-serif',
    hasItalic: true
  },
  {
    id: 'inclusive-sans',
    name: 'Inclusive Sans',
    cssFamily: '"Inclusive Sans", Verdana, sans-serif',
    googleFamily: 'Inclusive Sans',
    category: 'accessible',
    fallback: 'sans-serif',
    hasItalic: true
  },
  {
    id: 'readex-pro',
    name: 'Readex Pro',
    cssFamily: '"Readex Pro", Verdana, sans-serif',
    googleFamily: 'Readex Pro',
    category: 'accessible',
    fallback: 'sans-serif',
    hasItalic: false
  },
  {
    id: 'radio-canada',
    name: 'Radio Canada',
    cssFamily: '"Radio Canada", Verdana, sans-serif',
    googleFamily: 'Radio Canada',
    category: 'accessible',
    fallback: 'sans-serif',
    hasItalic: true
  },

  // =========================================================================
  // 5. Slab & Editorial — Downloadable Google Fonts (7)
  // =========================================================================
  {
    id: 'roboto-slab',
    name: 'Roboto Slab',
    cssFamily: '"Roboto Slab", Georgia, serif',
    googleFamily: 'Roboto Slab',
    category: 'slab',
    fallback: 'serif',
    hasItalic: false
  },
  {
    id: 'arvo',
    name: 'Arvo',
    cssFamily: '"Arvo", Georgia, serif',
    googleFamily: 'Arvo',
    category: 'slab',
    fallback: 'serif',
    hasItalic: true
  },
  {
    id: 'zilla-slab',
    name: 'Zilla Slab',
    cssFamily: '"Zilla Slab", Georgia, serif',
    googleFamily: 'Zilla Slab',
    category: 'slab',
    fallback: 'serif',
    hasItalic: true
  },
  {
    id: 'josefin-slab',
    name: 'Josefin Slab',
    cssFamily: '"Josefin Slab", Georgia, serif',
    googleFamily: 'Josefin Slab',
    category: 'slab',
    fallback: 'serif',
    hasItalic: true
  },
  {
    id: 'kreon',
    name: 'Kreon',
    cssFamily: '"Kreon", Georgia, serif',
    googleFamily: 'Kreon',
    category: 'slab',
    fallback: 'serif',
    hasItalic: false
  },
  {
    id: 'crete-round',
    name: 'Crete Round',
    cssFamily: '"Crete Round", Georgia, serif',
    googleFamily: 'Crete Round',
    category: 'slab',
    fallback: 'serif',
    hasItalic: true
  },
  {
    id: 'rokkitt',
    name: 'Rokkitt',
    cssFamily: '"Rokkitt", Georgia, serif',
    googleFamily: 'Rokkitt',
    category: 'slab',
    fallback: 'serif',
    hasItalic: true
  },

  // =========================================================================
  // 6. Monospace & Technical — Downloadable Google Fonts (8)
  // =========================================================================
  {
    id: 'jetbrains-mono',
    name: 'JetBrains Mono',
    cssFamily: '"JetBrains Mono", Consolas, monospace',
    googleFamily: 'JetBrains Mono',
    category: 'mono',
    fallback: 'monospace',
    hasItalic: true
  },
  {
    id: 'fira-code',
    name: 'Fira Code',
    cssFamily: '"Fira Code", Consolas, monospace',
    googleFamily: 'Fira Code',
    category: 'mono',
    fallback: 'monospace',
    hasItalic: false
  },
  {
    id: 'ibm-plex-mono',
    name: 'IBM Plex Mono',
    cssFamily: '"IBM Plex Mono", Consolas, monospace',
    googleFamily: 'IBM Plex Mono',
    category: 'mono',
    fallback: 'monospace',
    hasItalic: true
  },
  {
    id: 'source-code-pro',
    name: 'Source Code Pro',
    cssFamily: '"Source Code Pro", Consolas, monospace',
    googleFamily: 'Source Code Pro',
    category: 'mono',
    fallback: 'monospace',
    hasItalic: true
  },
  {
    id: 'roboto-mono',
    name: 'Roboto Mono',
    cssFamily: '"Roboto Mono", Consolas, monospace',
    googleFamily: 'Roboto Mono',
    category: 'mono',
    fallback: 'monospace',
    hasItalic: true
  },
  {
    id: 'space-mono',
    name: 'Space Mono',
    cssFamily: '"Space Mono", Consolas, monospace',
    googleFamily: 'Space Mono',
    category: 'mono',
    fallback: 'monospace',
    hasItalic: true
  },
  {
    id: 'inconsolata',
    name: 'Inconsolata',
    cssFamily: '"Inconsolata", Consolas, monospace',
    googleFamily: 'Inconsolata',
    category: 'mono',
    fallback: 'monospace',
    hasItalic: false
  },
  {
    id: 'ubuntu-mono',
    name: 'Ubuntu Mono',
    cssFamily: '"Ubuntu Mono", Consolas, monospace',
    googleFamily: 'Ubuntu Mono',
    category: 'mono',
    fallback: 'monospace',
    hasItalic: true
  }
]

const FONT_MAP = new Map<string, FontEntry>(FONT_CATALOG.map((f) => [f.id, f]))

export function getFontEntry(fontId: string): FontEntry {
  return FONT_MAP.get(fontId) || FONT_CATALOG[0]
}

export function isBuiltinFont(fontId: string): boolean {
  const entry = FONT_MAP.get(fontId)
  return Boolean(entry && !entry.googleFamily)
}

export function getFontCssFamily(fontId: string): string {
  return getFontEntry(fontId).cssFamily
}
