<div align="center">

# Semply Ebook Reader & Desktop App Template

**A high-performance, distraction-free desktop e-book reader and modern desktop application template.**  
Built with Electron 34, React 19, TypeScript 5.8, Tailwind CSS, Dexie.js (IndexedDB), and offline WebAssembly engines.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](./LICENSE)
[![Electron 34](https://img.shields.io/badge/Electron-34.3.0-47848F.svg?style=flat-square&logo=electron&logoColor=white)](https://www.electronjs.org/)
[![React 19](https://img.shields.io/badge/React-19.0.0-61DAFB.svg?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript 5.8](https://img.shields.io/badge/TypeScript-5.8.2-3178C6.svg?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4.17-38B2AC.svg?style=flat-square&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20.0.0-339933.svg?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg?style=flat-square)]()

[Features](#key-features) &bull; [Quick Start](#quick-start--template-usage) &bull; [Architecture](#architecture--subsystems) &bull; [Keyboard Shortcuts](#keyboard-shortcuts) &bull; [Documentation](#documentation) &bull; [License](#license)

</div>

---

## Overview

**Semply Ebook Reader** is a zero-paywall, privacy-first desktop e-book and document reader that combines reflowable EPUB reading, native PDF canvas viewing, and offline PDF-to-EPUB conversion powered by Artifex MuPDF WebAssembly.

Beyond being a complete application, this repository is designed as a **production-ready GitHub Template** for engineering high-performance desktop apps on the modern JavaScript stack. It solves the hardest desktop challenges out of the box:
- Frameless native window chrome with custom titlebars and OS drag boundary protection.
- Secure, context-isolated Electron IPC with zero unsafe remote capabilities.
- Zero-native-compilation storage using Dexie.js on IndexedDB for frictionless cross-platform builds.
- Background WebAssembly execution in Electron Node.js runtime for CPU-heavy tasks.
- Sleek, monochrome Geist Obsidian design system with custom accessible controls.

---

## Why Use This Template?

| Feature | Semply Architecture | Traditional Boilerplates |
| --- | --- | --- |
| **Electron + UI Core** | Electron 34 + React 19 + TypeScript + Vite | Outdated Electron 20-25 + React 17/18 with Webpack |
| **Styling & Theme** | Tailwind CSS with Geist Obsidian dark tokens | Generic Bootstrap or heavy UI component libraries |
| **Local Persistence** | Zero-native-dependency Dexie.js IndexedDB | SQLite/better-sqlite3 requiring native Node GYP compilation |
| **Offline WASM** | Bundled Artifex MuPDF WASM + PDF.js workers | Dependent on cloud APIs or heavy native binaries |
| **Privacy & Storage** | 100% local-first, zero telemetry or accounts | Hard-coded analytics and vendor locks |
| **Developer Ergonomics** | Instant HMR via `electron-vite`, unified `tsc` checks | Slow reloads, fragmented build scripts |

---

## Key Features

### Universal Library Management
- **Multi-Format Ingestion**: Drag-and-drop or recursive folder import for `.epub`, `.pdf`, `.mobi`, and `.txt` files.
- **Dual Display Modes**: Toggle between Grid Card View and a 5-column sortable List View (`Title`, `Author`, `Date`, `Notes`, `Progress`).
- **Smart Cover Pipeline**: Automatically extracts embedded covers from EPUB 2/3 and MOBI PalmDB records, generates HiDPI first-page thumbnails for PDFs via offline PDF.js, and renders custom warm-paper typographic covers for plain text documents.
- **Shelves & Bulk Assignment**: User-defined color-coded shelves and categories with multi-book assignment and soft-delete trash with one-click restore.
- **Quick-Resume Bar**: Bottom dock showing recently opened documents with real-time reading progress indicators.

### Dual Reading Engines
- **Reflowable EPUB Reader (`EpubReaderView`)**:
  - Powered by `epub.js` with Librera CSS typography normalization.
  - Single-page and dual-page spreads with global CFI progress tracking.
  - 4 calibrated color themes: `Light`, `Paper`, `Dusk`, and `Obsidian`.
  - Customizable typography, font size, line spacing, margins, and screen dimming.
- **Native PDF Reader (`PdfReaderView`)**:
  - Offline `pdfjs-dist` HiDPI canvas rendering with aligned selectable text overlay for native text selection and copying.
  - Single and double page spreads with `50%` to `300%` continuous zoom.
  - PDF outline table of contents, bookmarks, and calibrated CSS dark mode filters.
- **Offline MuPDF PDF Reflow Engine**:
  - 100% offline conversion of fixed-layout PDFs into cached, reflowable EPUB 3 archives via Artifex MuPDF WebAssembly.
  - Strips repetitive running headers and footers, preserves headings, and unlocks every EPUB feature (custom fonts, themes, notes, text-to-speech, auto-scroll).

### Deep Reading & Annotation Tools
- **Annotations & Highlights**:
  - 6 theme-aware SVG highlight styles (`Yellow`, `Blue`, `Green`, `Purple`, `Red`, `Underline`) using blend modes (`screen` in dark mode, `multiply` in light mode).
  - Dual-anchor persistence (`EpubCFI` + `IceRange` XPath) ensuring highlights stay aligned even across layout adjustments.
  - Dedicated `NotesDrawer` with full search, chapter grouping, and export to HTML, Markdown, and Plain Text.
- **Full-Book Spine Search (`Ctrl+F`)**:
  - Asynchronous background spine scanning with 250ms debounced queries.
  - Live chapter attribution, inline excerpts, temporary in-page match highlights, and keyboard stepping (`Enter` / `Shift+Enter`).
- **Dual-Mode Auto-Scroll Engine**:
  - **Fixed Timer**: Deterministic countdown (`3s` to `600s`) for steady hands-free reading.
  - **Smart Pace**: Dynamic reading timer scaled to visible page word density with manual wheel nudges and exponential moving average (EMA) cadence adaptation.
  - Unobtrusive fullscreen countdown indicator with away-from-app pause protection.
- **Read Aloud (TTS) & Auxiliary Tools**:
  - Offline Web Speech Synthesis with pronunciation normalization for abbreviations, numbers, and Roman numerals.
  - Contextual text selection popup with inline Free Dictionary definitions and Wikipedia lookup.
  - Non-destructive floating footnote popover supporting cross-document references.
  - Hardware-independent Warm Night Blue Light Filter (`2000K` to `4500K`).

### Local-First Privacy & Backup
- **No Cloud Dependency**: All database tables, reading positions, notes, and preferences reside on the local filesystem in browser-backed IndexedDB.
- **Additive Backup & Sync**: Export complete library metadata and annotations to `.json` or `.zip` archives with non-destructive merge upon import.

---

## Architecture & Subsystems

```
+-----------------------------------------------------------------------+
|                    Electron Main Process (Node.js)                    |
|  - BrowserWindow lifecycle & frameless titlebar mechanics             |
|  - System font discovery service (Windows, macOS, Linux)              |
|  - Offline Artifex MuPDF WASM 2-Pass Reflow & EPUB Packager           |
|  - Safe IPC dispatch and file dialog handlers                         |
+-----------------------------------------------------------------------+
                                  |
                                  v
+-----------------------------------------------------------------------+
|                 Preload Bridge (contextBridge)                        |
|  - Strictly typed window.electronAPI contract                         |
|  - Isolated execution context preventing unsafe node access           |
+-----------------------------------------------------------------------+
                                  |
                                  v
+-----------------------------------------------------------------------+
|                 Renderer Process (React 19 + Vite)                    |
|  - State Management: Zustand store slices                             |
|  - Persistence: Dexie.js (IndexedDB wrapper)                          |
|  - EPUB Engine: epub.js with normalized iframe bridge                 |
|  - PDF Engine: pdfjs-dist canvas + selectable text layer              |
|  - Design System: Geist Obsidian Tailwind CSS monochrome tokens       |
+-----------------------------------------------------------------------+
```

---

## Project Structure

```
EPUB READER DESKTOP/
├── build/                        # Application icons and packaging assets
├── documentations/               # Interactive documentation web application
│   ├── index.html                # Standalone guide with live search & preview
│   ├── llms.txt                  # High-level context for AI agents
│   └── llms-full.txt             # Exhaustive architecture reference for AI
├── src/
│   ├── main/                     # Electron Main process
│   │   ├── fontService.ts        # OS font scanner without native dependencies
│   │   ├── index.ts              # Window lifecycle, IPC routing, menu handlers
│   │   └── pdfToEpubEngine.ts    # MuPDF WASM reflow and EPUB 3 packaging
│   ├── preload/                  # Secure context isolation scripts
│   │   └── index.ts              # window.electronAPI exposure
│   ├── shared/                   # Shared type definitions and constants
│   │   └── fontCatalog.ts        # System and web font metadata definitions
│   └── renderer/                 # React 19 user interface
│       ├── index.html            # Renderer entry HTML
│       └── src/
│           ├── assets/           # Static graphic assets and icons
│           ├── components/
│           │   ├── drawers/      # Slide-out drawers (Notes, Search, Settings, TOC)
│           │   ├── library/      # Book grid, list view, sidebar, shelf management
│           │   ├── modals/       # Dialogs (Settings, Import, Hotkeys, About)
│           │   ├── reader/       # EpubReaderView, PdfReaderView, SelectionPopup
│           │   └── ui/           # Custom titlebar, buttons, sliders, theme pickers
│           ├── db/               # Dexie.js database schema and migrations
│           ├── services/         # Backup, font management, annotation logic
│           ├── stores/           # Zustand state slices (app, reader, auto-scroll)
│           ├── App.tsx           # Top-level view router and keyboard orchestrator
│           ├── index.css         # Geist Obsidian design tokens and base styles
│           └── main.tsx          # React application root
├── DESIGN.md                     # Design system lock and UI anti-pattern rules
├── dev-documentations.md         # Exhaustive internal developer architecture guide
├── documentation.md              # High-level implementation-agnostic reference
├── electron-builder.config.ts    # Desktop installer and packaging configuration
├── electron.vite.config.ts       # Multi-target Vite bundling configuration
├── package.json                  # Dependencies and execution scripts
├── tailwind.config.ts            # Tailwind styling tokens and geometry
└── tsconfig.json                 # Unified TypeScript configuration
```

---

## Quick Start & Template Usage

### Prerequisites
- **Node.js**: Version `20.0.0` or higher
- **Package Manager**: `npm` (bundled with Node)

### 1. Initialize from Template
Click the green **"Use this template"** button at the top of the GitHub repository, or clone directly:

```bash
# Clone the repository
git clone https://github.com/ederaefe/semply-ebook-reader.git my-desktop-app

# Navigate to the workspace
cd my-desktop-app

# Install dependencies
npm install
```

### 2. Available Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Launch the app in development mode with Hot Module Replacement (HMR). |
| `npm run typecheck` | Run TypeScript validation across main, preload, and renderer targets. |
| `npm run build` | Compile and bundle production assets into `out/`. |
| `npm run package` | Package the desktop application installer via `electron-builder`. |
| `npm run release` | Run typecheck, build production bundles, and output release installers. |

### 3. Customizing the Template
To adapt this repository for a new desktop application:
1. **Update Identifiers**: Update `name`, `version`, `author`, and `description` in `package.json`.
2. **Configure App ID**: Modify `appId` (`com.yourcompany.appname`) and window titles in `electron-builder.config.ts` and `src/main/index.ts`.
3. **Database Adaptation**: Add or modify tables in `src/renderer/src/db/index.ts` using Dexie.js schema syntax.
4. **Window Mechanics**: Adjust frameless window dimensions, min-sizes, and system tray defaults in `src/main/index.ts`.
5. **Brand Tokens**: Tweak monochrome surfaces and accent colors in `src/renderer/src/index.css` and `tailwind.config.ts`.

---

## Keyboard Shortcuts

| Shortcut | Context | Action |
| --- | --- | --- |
| `Ctrl + O` | Library | Open Add Book / Folder / Shelf import modal |
| `Ctrl + F` | Reader | Open Full-Book Find drawer / re-focus search input |
| `Enter` / `Shift + Enter` | Search | Jump to next / previous in-book match |
| `Ctrl + B` | Reader | Toggle bookmark on active page with auto-excerpt |
| `Left` / `Up` / `Page Up` | Reader | Turn to previous page (or smooth scroll up) |
| `Right` / `Down` / `Page Down` | Reader | Turn to next page (or smooth scroll down) |
| `Space` | Reader | Advance page or scroll reading viewport |
| `Home` / `End` | Reader | Jump to the beginning / end of document |
| `F9` | Reader | Cycle reading theme (`Light`, `Obsidian`, `Paper`, `Dusk`) |
| `F10` | Reader | Toggle single-page / dual-page spread mode |
| `F11` | Global | Toggle True Immersive Fullscreen (zero chrome) |
| `F1` | Global | Open Hotkeys and Navigation help modal |
| `Esc` | Global | Dismiss modals, popovers, drawers, auto-scroll, or return to library |

---

## Documentation

This repository provides multiple tiers of documentation:
- **[Interactive Documentation Guide](./documentations/index.html)**: A zero-build, responsive web guide with live search, theme preview, and user walkthroughs, ready to host on GitHub Pages or Cloudflare Pages.
- **[Developer & Architecture Guide](./dev-documentations.md)**: Exhaustive technical manual detailing Electron IPC contracts, Dexie database structures, Zustand slices, and WASM pipeline internals.
- **[High-Level Technical Reference](./documentation.md)**: Implementation-agnostic technical documentation and system reference.
- **[Design System Specification](./DESIGN.md)**: Visual tokens, Geist Obsidian surface guidelines, and explicit UI anti-pattern rules.
- **[Machine Context (`llms.txt`)](./documentations/llms.txt)**: Structured overview optimized for AI coding assistants and LLM tooling.

---

## Contributing

Contributions, bug reports, and feature proposals are welcome:
1. Fork the repository.
2. Create your feature branch (`git checkout -b feat/your-feature-name`).
3. Ensure strict type-checking passes: `npm run typecheck`.
4. Commit your changes with clear messages (`git commit -m 'feat: add feature'`).
5. Push to the branch (`git push origin feat/your-feature-name`).
6. Open a Pull Request.

---

## License

This project is licensed under the [MIT License](./LICENSE). You are free to use, modify, and distribute this codebase for personal, academic, or commercial desktop software.
