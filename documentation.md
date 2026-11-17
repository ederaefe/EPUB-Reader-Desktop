# Semply Ebook Reader (EPUB Reader Desktop) - Developer Reference & Architecture Documentation

> **Permanent Technical Reference** — Verified against the live Electron + React 19 + TypeScript + MuPDF WASM codebase. Every IPC channel, database schema, state slice, algorithmic threshold, design token, and invariant documented below reflects the current production architecture.

## Table of Contents
1. [Product Overview & System Topology](#1-product-overview--system-topology)
2. [Technology Stack & Dependency Matrix](#2-technology-stack--dependency-matrix)
3. [Repository & Module Directory](#3-repository--module-directory)
4. [Electron Multi-Process Architecture & IPC Contract](#4-electron-multi-process-architecture--ipc-contract)
5. [Data Persistence & State Management](#5-data-persistence--state-management)
6. [Core Subsystems & Algorithmic Deep Dives](#6-core-subsystems--algorithmic-deep-dives)
   - [6.1 EPUB Rendering, Global Pagination & Iframe Bridging](#61-epub-rendering-global-pagination--iframe-bridging)
   - [6.2 Native PDF Reader (`PdfReaderView`)](#62-native-pdf-reader-pdfreaderview)
   - [6.3 Offline MuPDF WASM PDF-to-EPUB & Reflow Engine](#63-offline-mupdf-wasm-pdf-to-epub--reflow-engine)
   - [6.4 Dual-Mode Auto-Scroll Countdown Engine](#64-dual-mode-auto-scroll-countdown-engine)
   - [6.5 Annotations, Highlights & Bookmarks Engine](#65-annotations-highlights--bookmarks-engine)
   - [6.6 Full-Book Spine Search (`SearchDrawer`)](#66-full-book-spine-search-searchdrawer)
   - [6.7 Universal Cover, First-Page & Metadata Extraction Pipeline](#67-universal-cover-first-page--metadata-extraction-pipeline)
   - [6.8 Read Aloud (TTS), Contextual Dictionary, Footnotes & Warm Night Filter](#68-read-aloud-tts-contextual-dictionary-footnotes--warm-night-filter)
   - [6.9 Universal Additive Backup & Sync Engine](#69-universal-additive-backup--sync-engine)
7. [UI Architecture, Component Inventory & Design System](#7-ui-architecture-component-inventory--design-system)
8. [Keyboard Shortcuts, Mouse & Context Menu Matrix](#8-keyboard-shortcuts-mouse--context-menu-matrix)
9. [Build, Packaging, Release & CI/CD Pipeline](#9-build-packaging-release--cicd-pipeline)
10. [Architectural Invariants, Edge Cases & Maintainer Notes](#10-architectural-invariants-edge-cases--maintainer-notes)
11. [Increments & Revision Log](#11-increments--revision-log)

---

## 1. Product Overview & System Topology

**Semply Ebook Reader** (`semply-ebook-reader`, App ID `com.ederaefe.semple-ebook-reader`) is a cross-platform desktop ebook and document reader built on Electron, React 19, TypeScript, Tailwind CSS, `epub.js`, `pdfjs-dist`, and Artifex's official `mupdf` WebAssembly engine.

### Core Product Capabilities
- **Multi-Format Library Management**: Supports `.epub`, `.pdf`, `.mobi`, and `.txt` imports via file picker, recursive directory scan, or drag-and-drop; Grid and List views; 5-column sortable catalog (`Title`, `Author`, `Date`, `Notes`, `Progress`); custom color-coded categories/shelves; bulk library-to-category assignment; soft-delete Trash & Restore; and a bottom Quick-Resume bar.
- **Dual Reading Engines**:
  - **Reflowable EPUB Engine (`EpubReaderView`)**: Paginated single-page and dual-page spreads via `epub.js`, Librera CSS typography normalization, 4 reading themes, global CFI pagination, cross-document footnote popovers, full-book spine search, dual-anchor highlights/notes, Read Aloud TTS, and Dual-Mode Auto-Scroll.
  - **Native PDF Engine (`PdfReaderView`) + Offline MuPDF Reflow**: HiDPI canvas rendering with aligned selectable text overlays, single/double spread, 50%–300% zoom, PDF outline TOC, CSS theme adaptation, and one-click offline conversion to cached reflowable EPUB via MuPDF WASM (`pdfToEpubEngine.ts`) to unlock every EPUB reading tool.
- **Zero-Paywall Desktop Ergonomics**: Frameless native window chrome styled in the **Vercel Geist Obsidian** monochrome design system, true text-only Immersive Fullscreen (`F11`), dual-layer context menus, accidental `Ctrl` reload/zoom neutralization, and zero licensing or upgrade nags.
- **Zero-Native-Dependency Local Storage**: All library metadata, custom shelves, annotations, bookmarks, and preferences live locally in IndexedDB via Dexie.js (`EpubReaderDesktopDB`), backed by non-destructive additive JSON/ZIP export and import.

### High-Level Process & Data Flow Topology

*(Architectural topology and process flow diagrams are documented in `dev-documentations.md`.)*

---

## 2. Technology Stack & Dependency Matrix

### UI Refinements
- **AddBookCard**: Modernized to a sleek squircle card (`rounded-xl`) with a dashed border (`border-dashed border-white/[0.12]`) that becomes more prominent on hover (`border-white/30`). The "+" icon now resides in a circular container that provides a soft accent glow on hover.
