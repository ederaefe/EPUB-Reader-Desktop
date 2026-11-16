# EPUB Reader Desktop - Developer Reference & Architecture Documentation

## Project Overview
A cross-platform desktop ebook and document reader designed with the **Encapsulated Obsidian Glassmorphism** design methodology, replicating the sleek dark aesthetic of Icecream Ebook Reader while delivering the full, unrestricted feature set inspired by Librera Reader (Android APK).

## Technology Stack
- **Desktop Runtime**: Electron
- **Frontend Architecture**: React 19 + TypeScript + Tailwind CSS + Vite
- **Design System**: Encapsulated Obsidian Glassmorphism (`DESIGN.md`)
  - Deep charcoal/obsidian surfaces with alpha transparency
  - Dynamic radial mesh gradient backdrop (`#0d1117` base, `#1a2744`, `#1f1b3a`, `#123328` blur blobs)
  - Translucent hairline borders (`rgba(255,255,255,0.08)`) with specular edge highlights (`rgba(255,255,255,0.14)`)
  - Mathematical radius rules: $\text{Outer Radius} = \text{Inner Radius} + \text{Padding}$
- **EPUB Engine**: `epubjs` with Librera CSS typography normalization
- **Document Engine**: Custom PDF-to-EPUB engine using `pdfjs-dist` and `jszip`
- **Speech Engine**: Web Speech API bridge with Librera pronunciation regex normalization rules (`TTS_Librera_Rules.txt`)
- **Dictionary & Translation**: 9 web dictionary providers mapped from Librera's `app-WebDict.json`
- **Persistence**: IndexedDB via Dexie.js (zero native C++ compilation dependencies)

## Core Architecture & Modules
- **Main Process (`src/main/index.ts`)**: Manages frameless window lifecycle, safe IPC handlers, native file dialogs, recursive directory scanner, and PDF-to-EPUB conversion.
- **Preload Bridge (`src/preload/index.ts`)**: Exposes typed `window.desktopAPI` via `contextBridge`.
- **Renderer UI (`src/renderer/src/`)**:
  - `components/ui/`: `AppBackground`, `TitleBar`.
  - `components/library/`: `Sidebar`, `BookCard`, `ResumeBar`, `LibraryView`.
  - `components/reader/`: `ReaderTopBar`, `EpubReaderView`, `SelectionPopup`.
  - `components/drawers/`: `TOCDrawer`, `SettingsDrawer`.
  - `services/`: `ttsService`, `dictService`.
  - `db/`: Dexie schema for books, categories, annotations, bookmarks, and user settings.
  - `stores/`: Zustand global state store (`useAppStore`).
  - `assets/`: Extracted APK assets (`app-Librera.css`, `app-Librera-Tables.css`, `app-WebDict.json`, `TTS_Librera_Rules.txt`, starter books).

## Increments & Revision Log
- **Increment 0**: Project inception, requirements alignment via `/grill-me`, architecture planning, and reference asset analysis.
- **Increment 1**: Project scaffolding, Encapsulated Obsidian Glassmorphism design system (`DESIGN.md`), Dexie DB schema, Librera APK asset integration, full library view, reading engine view, TOC drawer, settings flyout, TTS with pronunciation rules, and CI/CD workflow.

- **Increment 2**: 1:1 Icecream Desktop UI Redesign & Engine Extraction
  - **Design System Purge**: Eradicated all generic web capsule pills and floating bubbles. Rebuilt UI with native Windows Segoe UI typography, solid dark slate surfaces (`#171a21` sidebar, `#1c1f26` catalog, `#14161c` docked bars), and crisp 4px rectangular controls (`.ice-btn-dark`, `.ice-btn-blue`, `.ice-icon-btn`, `.ice-input`).
  - **Reverse-Engineered Icecream Engine Extraction**: Decompressed and analyzed Qt5 RCC resources from `icebookreader.exe`, extracting the complete 43KB JavaScript reading engine (`jsengine.js`) and 77 core reader functions, including pagination, dual-page layout rules, DOM XPath position resolution (`icepath`), and exact highlight color styling (`span.bluenote`, `span.purplenote`, `span.rednote`, `span.yellownote`, `span.greennote`, `span.underlinenote`).
  - **Real Book & Cover Integration**: Pre-seeded the user's authentic book *The Fifth Season* by N. K. Jemisin with its authentic cover art from Icecream's database (`9780316229302.jpg`) and progress (`p.13 / 416`, 3%).
  - **Thumbnail Extraction Service (`coverService.ts`)**: Automatic extraction of embedded covers from EPUB archives via JSZip and OPF parsing, plus high-resolution first-page canvas rendering for PDFs via `pdfjs-dist`.
  - **Sidebar & Catalog Overhaul**: Reconstructed 1:1 Icecream sidebar with right-aligned counts (`All 1`, `Recently Read 1`, `Favorites 0`, `Formats v`, `+ Add new category`, `Read 0`, `Deleted 0`, `Settings`, `Help`). Implemented top action bar with `+ Add book`, `Add folder`, search, and grid/list view switcher.
  - **Reader Workstation Overhaul**: Docked rectangular header, left-sliding TOC drawer with page numbers, right-sliding Settings drawer with 4 theme tiles (`Day`, `Night`, `Light sepia`, `Dark sepia`), dimming slider, double/single page switcher, font selector with `Original font`, 21px font slider, line spacing controls, and full keyboard shortcuts (Left/Right/Space/PgUp/PgDn, F1, F7, F8, F9, F10, F11, Ctrl+B).

- **Increment 3**: Adaptive Auto-Scroll Engine & Advanced Features Architecture
  - **Adaptive Auto-Scroll Engine**: Dynamic velocity modeling based on word density per upcoming DOM block, paired with an Exponential Moving Average (EMA, $\alpha = 0.15$) reading cadence profiler that automatically learns the reader's real-time words-per-minute (WPM) speed. Integrates behavioral feedback signals: auto-decelerating by 15% on backward scroll adjustments, accelerating by 10% on forward nudges, and introducing subtle 300ms cognitive pauses at section dividers.
  - **Universal Additive Backup**: Non-destructive export and import engine supporting JSON, YAML, and complete ZIP archive bundles. Guarantees zero data loss on restore via additive upsert: deduplicating by ISBN/file path, merging categories via set union, and appending highlights without overwriting existing local data.
  - **Librera APK Feature Roadmap**: Integrated specifications for RSVP Speed Reading (Optimal Recognition Point), inline footnote popovers (`ext/FooterNote`), hardware-independent warm blue light filter (2000K-4500K), and speech recording to offline audio files (`isRecordTTS`).

- **Increment 4**: Pixel-Perfect Reference Video Alignment & Vision Verification
  - **Complete Elimination of Web Pills**: Eradicated all remaining rounded capsule pills and floating bubbles across the application, strictly replacing them with native desktop 2px-radius rectangular controls.
  - **Authentic Native Window Titlebar**: Implemented the dual-badge header with green `Update available!` (`#152e1c`, border `#235d30`, text `#4cd964`) and blue `Upgrade to PRO` (`#2a69df`) buttons. In Reader mode, centers the authentic book and chapter status string (`The Fifth Season: Prologue: you are here`) and displays the left-aligned `Ebook Reader` desktop brand.
  - **Sidebar Two-Line Branding & PRO Access**: Added the stacked `Icecream` (bold white) and `Ebook Reader` (muted gray) header next to the solid blue book icon, and docked the bottom `Upgrade to PRO` star button.
  - **Library Header & Column Sorting**: Replaced generic placeholders with `Search in Library`, added both `+ Add book` and `Add folder` rectangular buttons with text labels, and introduced the five column sorting headers (`Title`, `Author`, `Date ▼`, `Notes`, `Progress`).
  - **Book Card & Selection State**: Styled selected cards with a 2px blue border (`#2a69df`) and embedded a 16px bottom progress bar overlay with centered white percentage text (`3%`). Updated the bottom resume bar to stack book title and author vertically (`The Fifth Season` over `N. K. Jemisin`) alongside page metrics (`p.15 / 507`).
  - **Dual-State Reading Progress Indicator**: Replicated the screen recording's pagination UX with a 5-dot subtle cluster (`•••••`) in the bottom center during idle reading, which fluidly expands on hover into a left-aligned page counter (`15 / 507`) and a full-width continuous slider track.
  - **Quick Settings & 5-Tab Full Settings Modal**: Upgraded the quick settings drawer with a 2x2 theme grid (`Day`, `Night`, `Light sepia`, `Dark sepia`), line spacing buttons, and navigation links. Implemented the complete 5-tab desktop settings modal (`System`, `Reading settings`, `Text to speech`, `Hotkeys`, `License`) matching `rec_05.jpg` and `rec_07.jpg`.
  - **Multimodal Vision Verification**: Executed automated Playwright Chrome captures and verified 1:1 visual identity against extracted reference frames (`rec_01.jpg` through `rec_21.jpg`).
