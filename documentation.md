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
