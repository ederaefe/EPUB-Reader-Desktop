# Semply Ebook Reader

A fast, distraction-free desktop EPUB reader built with Electron, React, TypeScript, Tailwind CSS, and `epub.js`, engineered with native desktop UI ergonomics and zero paywall gates.

---

## Key Features

### Library & Reading Experience
- **Native Desktop Library**: Grid and List views with automatic cover art extraction (EPUB OPF + PDF first-page rendering), metadata/filename sanitization, reading progress overlays, custom color-coded shelves/categories, instant search, drag-and-drop or bulk recursive folder import (`.epub`, `.pdf`, `.mobi`, `.txt`), PDF-to-EPUB conversion, and a Resume Bar showing current page progress.
- **Multi-Mode Pagination**: Single-page and dual-page spread rendering powered by `epub.js` with Librera CSS typography normalization (`app-Librera.css`), custom fonts, font sizing, line spacing, 4 reading themes (Day, Night, Light Sepia, Dark Sepia), and dimming controls.
- **Full-Book Find (`Ctrl+F`)**: Left-docked Find side drawer (`SearchDrawer`) that searches across every spine section with debounced live queries, chapter labels, highlighted excerpts, temporary in-page match highlights, `Enter`/`Shift+Enter` match stepping, and dual-context `Ctrl+F` interception across both the host window and EPUB `<iframe>`.
- **True Immersive Fullscreen (`F11`)**: Hides all titlebar, toolbar, footer, and navigation chrome for pure text-only reading with a subtle hover exit control.
- **Right-Click Context Menus**: Native-style contextual actions for copying, 5-color highlights, notes, dictionary/translation lookups, bookmarks, and reading tools, plus native OS Cut/Copy/Paste menus on editable inputs.

### Minimalist Dual-Mode Auto-Scroll Countdown Engine
- **Settings-Housed, Icon-Only Controls**: Configured and toggled inside the quick Settings drawer and Full Settings modal (`Reading settings`), keeping the main reader top bar clean.
- **Two Modes (Manual Seconds Input `3–600s` in Both)**:
  - **Fixed Timer**: Deterministic fixed per-page timer (default `20s`, configurable manually in seconds).
  - **Smart Pace**: Dynamically scales your manual base seconds per page (default `25s`) to each page's **visible on-screen word density** (`epub.js` visible CFI range with proportional fallback), wheel nudges (`+15%` / `-10%`), and optional `300ms` cognitive micro-pauses on section breaks and blockquotes.
- **Muted Numeric Bottom-Right Indicator**: Quiet numeric countdown that remains visible even in immersive fullscreen mode. Tapping the number opens a compact settings popover and suspends the timer until dismissed.
- **Reliable Hands-Free Continuity**: Ignores false iframe-click blur events, recovers automatically across chapter/spread boundaries, and suspends only when genuinely leaving/minimizing the app or opening panels.

### Reading Tools & Accessibility
- **In-Book Full-Text Search (`Ctrl+F`)**: Spine-wide EPUB search drawer with live debounced results, chapter attribution, inline excerpt highlighting, Previous/Next match stepping (`Enter` / `Shift+Enter`), and temporary in-page match highlights.
- **Read Aloud (TTS)**: Web Speech Synthesis with Librera pronunciation normalization rules (decimals, abbreviations, Roman numerals), mute/pause toggle, and speed/pitch controls.
- **Non-Destructive Footnotes**: Intercepts footnote links inline and displays them in a floating popover without losing your reading position.
- **Warm Blue Light Night Filter**: Continuous color temperature (`2000K–4500K`) and intensity overlay for nighttime reading.
- **Universal Additive Backup & Sync**: Export library metadata, shelves, highlights, notes, bookmarks, and cover art to portable JSON or ZIP archives with non-destructive additive import merging.

---

## Keyboard Shortcuts

| Shortcut | Action |
| --- | --- |
| `Ctrl + F` | Open Find in Book drawer / re-focus search input |
| `Enter` / `Shift + Enter` | Jump to next / previous search match (inside Find) |
| `Ctrl + B` | Open Bookmarks drawer |
| `Up` / `Left` / `Page Up` / `Backspace` | Previous page (or smooth scroll up in PDF / Library) |
| `Down` / `Right` / `Page Down` / `Space` | Next page (or smooth scroll down in PDF / Library) |
| `Home` | Jump to start of book |
| `F9` | Cycle reading theme (Day / Night / Light Sepia / Dark Sepia) |
| `F10` | Toggle Single / Double page spread |
| `F11` | Toggle True Immersive Fullscreen |
| `F1` | Open Hotkeys & Navigation help modal |
| `Esc` | Close open drawers, exit fullscreen, or return to library |

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

# Package desktop installer via electron-builder
npm run package

# Full production build + installer packaging
npm run release
```

---

## Architecture Reference
For detailed incremental technical history, design system specifications, and component architecture, see [documentation.md](./documentation.md) and [DESIGN.md](./DESIGN.md).
