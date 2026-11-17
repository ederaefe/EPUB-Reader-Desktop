# Semply Ebook Reader

A fast, distraction-free desktop EPUB reader built with Electron, React, TypeScript, Tailwind CSS, and `epub.js`, engineered with native desktop UI ergonomics and zero paywall gates.

---

## Key Features

### Library & Reading Experience
- **Native Desktop Library**: Grid and List views with cover art rendering, reading progress overlays, custom color-coded shelves/categories, instant search, and a Resume Bar showing current page progress.
- **Multi-Mode Pagination**: Single-page and dual-page spread rendering powered by `epub.js` with Librera CSS typography normalization (`app-Librera.css`), custom fonts, font sizing, line spacing, and dimming controls.
- **True Immersive Fullscreen (`F11`)**: Hides all titlebar, toolbar, footer, and navigation chrome for pure text-only reading with a subtle hover exit control.
- **Right-Click Context Menus**: Native-style contextual actions for copying, color-coded highlights, notes, dictionary/translation lookups, bookmarks, and reading tools.

### Minimalist Dual-Mode Auto-Scroll Countdown Engine
- **Settings-Housed, Icon-Only Controls**: Configured and toggled inside the quick Settings drawer and Full Settings modal (`Reading settings`), keeping the main reader top bar clean.
- **Two Modes**:
  - **Countdown Only**: Deterministic fixed per-page timer (default `20s`, configurable `5s–120s`).
  - **Adaptive Countdown**: Dynamically computes page duration from **visible on-screen word counts** (`epub.js` visible CFI range with proportional fallback, clamped `[3s, 180s]`), rolling Exponential Moving Average reading speed ($\alpha = 0.15$), wheel nudges (`-15%` / `+10%`), and optional `300ms` cognitive micro-pauses on section breaks and blockquotes.
- **Muted Numeric Bottom-Right Indicator**: Quiet numeric countdown that remains visible even in immersive fullscreen mode. Tapping the number opens an icon-only settings popover and suspends the timer until dismissed.
- **Abandonment & Inactivity Protection**: Automatically suspends when leaving/minimizing the app or opening panels, and auto-pauses cleanly after 5 minutes of reader inactivity.

### Reading Tools & Accessibility
- **Read Aloud (TTS)**: Web Speech Synthesis with Librera pronunciation normalization rules (decimals, abbreviations, Roman numerals), mute/pause toggle, and speed/pitch controls.
- **RSVP Speed Reader**: Rapid Serial Visual Presentation modal with Optimal Recognition Point (ORP) alignment.
- **Non-Destructive Footnotes**: Intercepts footnote links inline and displays them in a floating popover without losing your reading position.
- **Warm Blue Light Night Filter**: Continuous color temperature (`2000K–4500K`) and intensity overlay for nighttime reading.
- **Universal Additive Backup & Sync**: Export library metadata, shelves, highlights, notes, bookmarks, and cover art to portable JSON or ZIP archives with non-destructive additive import merging.

---

## Development

### Prerequisites
- Node.js 20+
- npm

### Commands
```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Type-check all targets (main, preload, renderer)
npm run typecheck

# Build production bundles
npm run build
```

---

## Architecture Reference
For detailed incremental technical history and component architecture, see [documentation.md](./documentation.md).
