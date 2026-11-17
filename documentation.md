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

- **Increment 5**: Button Border Flattening, PRO De-cluttering & Bi-directional Desktop Zooming
  - **Elimination of Lighted Button Borders**: Flattened high-contrast button strokes (`#3c404d` / `#4e5363`) in `.ice-btn-dark` down to matte surface borders (`#282c38`) with dark hover fills (`#2b303d`). Removed all light halos and specular edges from all desktop buttons and view toggles.
  - **Complete Removal of Upgrade / PRO Nag Buttons**: Removed `Upgrade to PRO` and `Update available!` from `TitleBar.tsx` and removed the bottom `Upgrade to PRO` star button from `Sidebar.tsx`. The application operates strictly as free, unrestricted "Ebook Reader".
  - **Bi-directional Zoom Controls (`Ctrl +` / `Ctrl -` / `Ctrl 0`)**: Fixed Chromium's asymmetric key handling by binding linear `setZoomFactor` across Electron's `before-input-event` in the main process, `webFrame` in the preload bridge, and global keydown listeners in the renderer. Both `Ctrl` + `+` (shifted `Equal` or numpad add) and `Ctrl` + `-` (minus/numpad subtract), as well as `Ctrl` + `0` (reset), cleanly and symmetrically scale the interface between 50% and 300%.

- **Increment 6**: Semply Ebook Reader Rebranding & Advanced Feature Suite Implementation
  - **App Branding & PRO Eradication**: Official rebranding to "Semply Ebook Reader" across titlebars, sidebar headers, window titles, and `package.json`. Complete eradication of license validation, PRO banners, badges, and paywall markers across all dialogs and modals.
  - **Adaptive Auto-Scroll Engine (AI / Cadence Learning)**:
    - Real-time rolling Exponential Moving Average (EMA, $\alpha = 0.15$) WPM speed profiler.
    - Dynamic velocity modeling evaluated per DOM block word density: $v_{\text{scroll}}(t) = \frac{\text{Words in Next Block}}{WPM_{\text{current}} \times 60} \times \text{Block Height (px)}$.
    - Behavioral feedback heuristics: automatic 15% deceleration on backward scroll corrections, 10% acceleration on forward nudges, idle suspension on window blur/word hover, and 300ms cognitive pauses at section breaks and dividers.
    - Floating / docked HUD overlay displaying live adaptive WPM metrics, cognitive pause indicators, and quick cadence nudges.
  - **Smart Pronunciation-Normalized TTS & Offline Audio Capture**:
    - Expanded regex translation matrix for Roman numerals (`Chapter IV` -> `Chapter 4`), abbreviations (`Dr.`, `Mr.`, `etc.`, `e.g.`, `i.e.`), and decimals (`3.14` -> `3 point 14`).
    - Offline `.wav` audio recording engine rendering synthesized speech into downloadable audio files (`isRecordTTS`) with native Electron file save dialog integration.
  - **Contextual Floating Dictionary & Wikipedia Summaries**:
    - 36px native desktop action bar on text selection.
    - Live definition card via Free Dictionary API with phonetic transcription and parts of speech.
    - Live encyclopedic instant summaries via Wikipedia REST API with extract, thumbnail, and article links.
    - Deep translation links to DeepL and Google Translate with one-click dispatch.
  - **RSVP Speed Reading Mode (Optimal Recognition Point)**:
    - Visual speed reading presenter centering each word horizontally on its visual anchor point (ORP) with focal letter highlighted in vivid crimson/amber.
    - Variable velocity slider (150 - 1,200 WPM), spacebar instant pause/resume, jump forward/backward 10 words, and word progress metrics.
  - **Smart Footnote & Annotation Popover (`ext/FooterNote`)**:
    - Automatic detection and click interception of `epub:type="noteref"`, `href="#fn..."`, `sup > a`, and superscript notes in rendition iframes.
    - Non-destructive bottom docked popover card displaying footnote text without losing the reader's current location.
  - **Warm Blue Light Night Filter (`isEnableBlueFilterNight`)**:
    - Hardware-independent chromatic temperature filter calculating RGB balance toward warm amber/candlelight tones (2000K to 4500K).
    - Configurable via sliders in Settings Drawer and Full Settings Modal with zero performance degradation.
  - **Universal Additive Backup & Sync**:
    - Full library export to portable `.json` and bundled `.zip` (with cover art and metadata).
    - Non-destructive additive merge importing books, custom shelves, annotations, and bookmarks with deduplication by file path/title and set union for categories.

- **Increment 7**: User-Driven Category Architecture & Custom Color Assignment
  - **Purge of Pre-seeded Categories**: Completely removed hardcoded auto-seeding of categories (`Favorites`, `Sci-Fi & Fantasy`, `Science & Tech`, `Classics`) from `App.tsx` and executed an automatic migration cleanup in IndexedDB (Dexie) so that no unwanted categories ever appear by default.
  - **Custom Category Creator with Color Palette**: Built an inline category creation component in `Sidebar.tsx` featuring an auto-focused name input, a curated 9-color palette (Blue `#2a69df`, Violet `#8b5cf6`, Emerald `#10b981`, Amber `#f59e0b`, Orange `#f97316`, Red `#ef4444`, Pink `#ec4899`, Cyan `#06b6d4`, Slate `#64748b`), and a native `<input type="color">` picker for arbitrary custom colors, complete with real-time preview.
  - **Dynamic Category Management & Book Assignment**: Each user-created category renders with its assigned colored indicator dot, dynamic book count, and an inline delete button on hover that safely unlinks books from deleted categories. Added direct category assignment to `BookCard.tsx` (in both grid and list views) via an action folder menu with color badges on book covers.
  - **Preview & Verification**: Updated `preview.html` with identical interactive creation, swatch selection, and category deletion workflows; validated via Playwright headless captures.

- **Increment 8**: Robust Cadence Learning, Idle Suspension, Spoken Audio Synthesis & Archive Recovery
  - **Closed-Loop Manual Reading Cadence Profiler**: Wired `recordManualReading(words, elapsedMs)` directly to reader page turn and relocation events. The profiler tracks actual user dwell time per page (clamped between 2s and 300s to avoid idle skews) and feeds word counts into the rolling Exponential Moving Average ($\alpha = 0.15$), making the reading speed metrics dynamically reflect real human reading pace.
  - **Synchronized Auto-Scroll Lifecycle & Idle Suspension**: Completely resolved the unpaused timer leak by subscribing `EpubReaderView` directly to `AdaptiveScrollEngine`. Window `blur` events (both root window and iframe window) immediately suspend auto-scroll without corrupting the cadence model. Hovering over footnote anchors or opening the footnote popover or text selection HUD cleanly halts auto-scroll, resuming automatically upon dismissal.
  - **Expanded Break & Divider Detection**: Extended break detection beyond basic classes to include `blockquote`, `hr`, `.section-break`, `.separator`, `.asterism`, and asterism text patterns (`***`, `* * *`), accurately injecting 300ms cognitive pauses.
  - **Cross-Document Footnote Extraction**: Replaced shallow `doc.getElementById` lookups with asynchronous cross-document spine loading (`section.load`) when footnote references target separate chapter or endnote files, ensuring authentic footnote texts are presented in the docked popover.
  - **True Spoken Audio Capture (`isRecordTTS`)**: Re-engineered `exportAudioFile` to query Google TTS speech synthesis in sentence-sized chunks (< 180 chars) and seamlessly concatenate MP3 frames into an offline `.mp3` audiobook file, retaining the 16-bit PCM WAV synthesizer as an offline fallback.
  - **One-Click Translation Action**: Integrated a dedicated `Translate` button with the `Languages` icon into the 36px floating selection action bar, dispatching queries directly to Google Translate and DeepL.
  - **ZIP Archive Cover Art Recovery**: Enhanced `importAdditiveBackup` to extract cover images from the `covers/` folder within imported `.zip` archives, restoring missing or stripped cover art during additive library migrations.
  - **Dynamic Titlebar Subtitle**: Removed hardcoded book subtitle strings and wired `TitleBar.tsx` to read `currentChapterTitle` from `useAppStore`.

- **Increment 8**: Sleek Modern Desktop Sliders & Custom Tactile Checkboxes
  - **Eradication of Browser-Default Controls**: Overhauled Chromium's default white track lines, oversized bulbous range thumbs, and square OS tick boxes with high-precision desktop controls.
  - **Sleek Desktop Range Sliders (`.ice-slider`, `input[type="range"]`)**: Custom-engineered WebKit and Mozilla range sliders featuring a 4px dark obsidian track (`#252834`), smooth pill track radius, and a crisp 12px tactile thumb in Icecream Blue (`#2a69df`) bordered by a 2px solid white stroke and soft ambient drop shadow. Integrated dynamic hover scaling (`scale(1.25)`) and active compression (`scale(1.10)`).
  - **Custom Dark-Theme Checkboxes (`.ice-checkbox`, `input[type="checkbox"]`)**: Created bespoke 15px × 15px checkboxes with 3px rounded corners, matte charcoal background (`#171a22`), and subtle border outlines (`#353b4c`). Upon selection, smoothly transitions to accent blue with an ultra-crisp 45-degree white vector tickmark.
  - **Full Settings Integration**: Added the "Send anonymous usage stats" toggle alongside "Copy eBooks from external devices" and "Check for the updates automatically" in `FullSettingsModal.tsx` and `preview.html`. Verified visual rendering via Playwright captures.

- **Increment 9**: Unread Progress Normalization, Metadata Sanitization & Babel Parser Fix
  - **Unread Progress Bug Elimination**: Eradicated the falsy fallback bug (`book.progressPercent || 3`) and placeholder page numbers (`15 / 507`, `13 / 416`) across `BookCard.tsx`, `EpubReaderView.tsx`, and `ResumeBar.tsx`. Unread books now accurately show `0%` progress with a `0%` width bar, starting on page 1 of their actual total page count.
  - **Automatic Metadata & Filename Sanitization**: Enhanced `coverService.ts` and `LibraryView.tsx` with `parseBookTitleAndAuthor` and `extractBookMetadata`. Cleans common download prefixes (such as `d-pdf.com - ` and `[z-lib.org]`), parses `Title by Author` patterns, and reads embedded OPF and PDF metadata. Implemented an auto-migration in `loadData` to cleanse existing unread books and metadata without requiring re-import.
  - **Babel TSX Syntax Disambiguation**: Resolved Vite react-babel compilation errors by converting `ReaderTopBar` to a standard function declaration, removing generic arrow function syntax that previously caused parser ambiguity.

- **Increment 9**: Drawer Dismissal Fix & Absolute Reading Location Synchronization
  - **Resolution of Unresponsive Drawer Cancel ("X") Buttons**: Diagnosed root cause where drawers set to `fixed inset-y-0` placed their headers and close buttons within `y = 0..32`, directly underneath Electron's native `-webkit-app-region: drag` titlebar. Windows OS was intercepting mouse clicks as window drag attempts, preventing click dispatch to React. Repositioned all sliding drawers (`TOCDrawer`, `BookmarksDrawer`, `NotesDrawer`, `SettingsDrawer`) to `top-8 bottom-0` (32px offset), applied explicit `app-no-drag` to aside containers, headers, and close buttons, and added full-screen click-away backdrops (`fixed inset-0 top-8 bg-black/40`) and `Escape` key dismissal.
  - **Resolution of Static Page Number Bug ("going further in the book and the numbers are not")**: Fixed issue where `location.start.displayed?.page` (which represents chapter-local page index, e.g. `4`) was being prioritized over global book positions, freezing the bottom display at `4 / 792`. Replaced with global CFI resolution via `locations.locationFromCfi(cfi)` and `locations.percentageFromCfi(cfi)`, paired with immediate recalibration when background location generation completes and a proportional spine progression fallback ($(\text{spineIdx} + \frac{\text{page}-1}{\text{total}}) / \text{spineLength}$) so page numbers and slider dots increment smoothly on every single page turn.


---

## Increment 5: Desktop Right-Click Context Menu Subsystem

### Architecture & Trade-offs
- **Dual-Layer Context Menu Strategy**: Electron frameless applications disable browser context menus by default. We implemented a unified, viewport-clamped custom React `<ContextMenu>` component (`src/renderer/src/components/ui/ContextMenu.tsx`) for domain-specific surfaces (EPUB reader iframe and Library cards) while delegating editable input fields (`<input>`, `<textarea>`) to Electron's native `Menu.buildFromTemplate` in `src/main/index.ts` for standard OS Cut/Copy/Paste/Undo/Redo semantics.
- **Zero-Reload Iframe Event Bridging**: In `EpubReaderView.tsx`, right-click events inside the isolated `epub.js` iframe are intercepted via `attachIframeHooks`, converted to main-window viewport coordinates using `frameElement.getBoundingClientRect()`, and routed through a stable `openContextMenuRef` ref so fresh reader state is always rendered without re-triggering the EPUB initialization effect.
- **Surface Coverage**:
  - **Reader (Text Selected)**: Copy, 5-color inline Highlight swatch bar (with CFI persistence), Add Note, Dictionary lookup, Translation, and Read Aloud selection.
  - **Reader (Page Area & Margins)**: Previous/Next page navigation, Bookmark page, Toggle Adaptive Auto-Scroll, RSVP Speed Reader, Toggle Fullscreen, and Reading Settings.
  - **Library Book Cards (Grid & List)**: Open/Continue reading, Toggle Favorite, Mark Read/Unread, Shelf assignment, and Move to Trash/Restore.
  - **Editable Inputs**: Native Windows Cut/Copy/Paste/Select All menu.


---

## Increment 11: Minimalist Reader Top Bar, True Immersive Fullscreen & Complete Audio Export Engine Removal

### Architecture & Design Changes
1. **Semply Ebook Reader Branding & Removal of Paywall Prompts**:
   - Unified application branding across `TitleBar.tsx`, `Sidebar.tsx`, `index.html`, and Electron main window to **Semply Ebook Reader** with custom logo assets (`semply_logo.png` / `semply_logo.ico`).
   - Completely removed all "Upgrade to PRO" buttons, badges, and upgrade prompts.
2. **Decluttered Reader Top Bar (`ReaderTopBar.tsx` -> `SettingsDrawer.tsx`)**:
   - Removed Auto-Scroll, RSVP Speed Reader, Page Spread toggles, Read Aloud, Mute/Volume, and Speech Speed buttons from the right side of `ReaderTopBar.tsx`.
   - Retained exclusively the **Immersive Fullscreen** toggle (`Maximize2`/`Minimize2`) and **Settings** trigger (`Settings`) on the right side of the top bar.
   - Consolidated all reading tools (**Read Aloud** play/stop, mute/pause toggle, speech speed cycling `0.8x–2.0x`, **Auto-Scroll** start/stop, **RSVP Speed Reader** launch, and Double/Single page spread) into a dedicated **Reading Tools & Speech** section inside `SettingsDrawer.tsx`.
3. **True Text-Only Immersive Fullscreen Mode**:
   - Added `isImmersiveFullscreen` to `useAppStore.ts` synchronized bi-directionally with Electron's main process (`window:setFullscreen` IPC and `enter-full-screen` / `leave-full-screen` events in `src/main/index.ts` and `src/preload/index.ts`).
   - When activated (via the top-bar button, `F11`, or right-click menu), all UI chrome—`TitleBar`, `ReaderTopBar`, bottom progress footer, side navigation arrows, gutter divider, and open drawers—is removed, leaving only the book text.
   - Added a discreet floating **Exit Fullscreen** button (`top-3 right-3`, translucent until hovered) alongside `Escape` and `F11` keyboard exits (wired in both root window and inside the EPUB `<iframe>`). Automatically triggers `rendition.resize()` to reflow text across the full screen.
4. **Complete Removal of WAV/MP3 Offline Audio Export Engine**:
   - Deleted the `exportAudioFile` method (Google TTS MP3 fetcher and 16-bit PCM WAV synthesizer) completely from `src/renderer/src/services/ttsService.ts`.
   - Removed the `DownloadCloud` export button, state hooks, and export notification toast from `ReaderTopBar.tsx`. Live Web Speech synthesis with Librera pronunciation rules (`normalizeTTSText`) remains intact for Read Aloud.


---

## Increment 6: Minimalist Dual-Mode Auto-Scroll Countdown Engine

### Architecture & Design Summary
1. **Settings-Housed Activation & Icon-Only Controls**:
   - Auto-Scroll configuration and activation live inside `SettingsDrawer.tsx` and `FullSettingsModal.tsx` (Reading settings tab), keeping the primary reader toolbar uncluttered.
   - All Auto-Scroll mode switches (`Timer` for Countdown Only, `Zap` for Adaptive Countdown), playback controls (`Play`/`Pause`, `Power`, `RotateCcw`, `Pilcrow` micro-pause), and speed nudges (`Minus`/`Plus`) are strictly icon-only with descriptive hover tooltips and accessible `aria-label` attributes.
2. **Muted Numeric Bottom-Right Countdown & Tap-to-Open Modal (`AdaptiveScrollOverlay.tsx`)**:
   - While Auto-Scroll is enabled, a quiet muted numeric countdown (`remainingSec`) appears in the bottom-right corner and **persists even in immersive fullscreen mode**.
   - Tapping the countdown opens a compact, icon-only Auto-Scroll settings popover directly above it, automatically suspending the countdown until dismissed so pages never turn mid-adjustment.
3. **Monotonic Dual-Mode Engine (`adaptiveScrollService.ts`)**:
   - **Countdown Only (`countdown`)**: Fixed deterministic per-page interval (default `20s`, range `5s–120s`), immune to scroll wheel drift.
   - **Adaptive Countdown (`adaptive`)**: Computes per-page duration strictly from **currently visible on-screen words** via `epub.js` visible CFI ranges (`getRange(start.cfi, end.cfi)` with proportional chapter fallback, clamped `[3s, 180s]`), rolling EMA reading speed (`alpha = 0.15`), optional `300ms` cognitive micro-pause on section breaks/blockquotes, and scroll-wheel nudges (`-15%` / `+10%`).
   - **Isolated Multi-Reason Auto-Suspension**: Separates explicit `isUserPaused` from transient suspensions (`blur`, `hidden`, `drawer`, `modal`, `footnote`, `selection`) so returning focus or closing panels never overrides a manual pause.
   - **5-Minute Inactivity & Reader Abandonment Auto-Pause**: Tracks throttled user interaction across both the host window and EPUB iframe; automatically locks into a safe inactivity pause after 5 minutes of idle time or 5+ minutes away from the app, and cleanly terminates timers on end-of-book or reader unmount.


---

## Increment 12: Dual-Mode Auto-Scroll Engine, Suspension State Machine & Application Icon Packaging

### Architecture & Enhancements
1. **Dual-Mode Auto-Scroll Engine (`adaptiveScrollService.ts`, `AdaptiveScrollOverlay.tsx`, `db/index.ts`, `FullSettingsModal.tsx`)**:
   - Added `AutoscrollMode` (`'countdown' | 'adaptive'`), `autoscrollCountdownSec`, and `autoscrollMicroPause` settings to the persistent Dexie `UserSettings` schema.
   - Upgraded `AdaptiveScrollEngine` with a multi-reason suspension state machine (`SuspensionReason`: `'blur' | 'hidden' | 'selection' | 'footnote' | 'drawer' | 'modal'`) and explicit user/inactivity pause reasons (`PauseReason`: `'user' | 'inactivity' | null`).
   - Added live page countdown ticking (`startPageCountdown`, `tick`, `adjustCountdownSec`) and expanded `AdaptiveScrollOverlay.tsx` + `FullSettingsModal.tsx` with direct mode switching, countdown/WPM adjustment, micro-pause toggles, and pause/reset controls.
2. **Application Packaging & Icon Assets**:
   - Added desktop branding icons across `build/` (`icon.ico`, `icon.png`), `resources/` (`icon.ico`, `icon.png`), `src/renderer/` (`favicon.ico`, `favicon.png`), and `src/renderer/src/assets/icons/` (`semply_logo.ico`, `semply_logo.png`) for native window chrome and cross-platform packaging.


---

## Increment 13: Repository Documentation Update & Engine Verification

### Summary
- Replaced placeholder `README.md` with complete project documentation covering Semply Ebook Reader's library management, true immersive fullscreen, minimalist Dual-Mode Auto-Scroll Countdown Engine (Countdown Only vs. Adaptive Countdown, muted fullscreen-persistent numeric trigger, tap-to-open icon-only modal, 5-minute inactivity watchdog), Read Aloud TTS, RSVP Speed Reader, footnotes, warm night filter, additive JSON/ZIP backup, and development scripts.
- Verified with `npm run typecheck`, `npm run build`, and 5/5 automated unit tests against `AdaptiveScrollEngine`.


---

## Increment 14: Full-Book Find Drawer & Dual-Context `Ctrl+F` Shortcut

### Summary
- **New `SearchDrawer` (`src/renderer/src/components/drawers/SearchDrawer.tsx`)**: Added a left-docked Find side panel matching the desktop drawer styling, with auto-focused input, debounced live search (250ms), `Enter` / `Shift+Enter` next/previous match stepping, match counters, chapter labels, and inline highlighted excerpts.
- **Full-Book Spine Search & Temporary Highlighting (`EpubReaderView.tsx`)**: Implemented spine-wide search via `epub.js` `section.find()` with safe load/unload tracking (only unloading sections loaded on demand so the active chapter is never clobbered), CFI navigation, and temporary amber match highlighting cleaned up on match switch or drawer dismissal.
- **Dual-Context `Ctrl+F` & Drawer Synchronization (`EpubReaderView.tsx`, `useAppStore.ts`)**: Intercepted `Ctrl+F` / `Cmd+F` in both the outer `window` keydown listener (ahead of input-focus guards so repeated `Ctrl+F` re-focuses and selects the query) and the EPUB `<iframe>` `contents.window` listener, made all five drawers mutually exclusive in `useAppStore`, paused Auto-Scroll while Find is open, and wired `Escape` + unmount cleanup.
- **Verification**: Passed `npm run typecheck` (`tsc --noEmit`) and `npm run build` (`electron-vite build`).


---

## Increment 14: In-Book Full-Text Search Drawer & Diagnostic Notes

### Architecture & Enhancements
1. **In-Book Full-Text Search (`SearchDrawer.tsx`, `EpubReaderView.tsx`, `useAppStore.ts`)**:
   - Added a left-docked **Find in Book** drawer (`SearchDrawer.tsx`) with live debounced search (250ms, 2+ characters), match counter, chapter labels, inline amber excerpt highlighting, and wrapped Previous/Next stepping (`Enter` / `Shift+Enter` and stepper buttons).
   - Wired `Ctrl+F` / `Cmd+F` (and `Ctrl+B` / `Escape`) across both the host window and the isolated `epub.js` iframe so search opens and focuses reliably regardless of focus location.
   - Implemented spine-wide EPUB search (`handleSearchBook`, capped at 250 matches) that loads sections on demand without unloading the active visible section, jumps to selected CFI matches, and applies/clears a temporary amber highlight annotation (`#f59e0b`).
   - Enforced mutual drawer exclusion across `TOCDrawer`, `NotesDrawer`, `BookmarksDrawer`, `SearchDrawer`, and `SettingsDrawer`, and integrated `isSearchDrawerOpen` into `AdaptiveScrollEngine` suspension and reader unmount cleanup.
2. **Documented Known Architectural Follow-Ups (Diagnostics)**:
   - **Recurring Category Purge (`App.tsx`)**: The startup cleanup deleting `Favorites`, `Sci-Fi & Fantasy`, `Science & Tech`, and `Classics` currently runs on every mount and should be removed so user-created categories with those names persist.
   - **Iframe Keyboard Navigation (`EpubReaderView.tsx`)**: `ArrowLeft`, `ArrowRight`, `PageUp`, `PageDown`, and `Space` are currently bound only to the parent `window` and not forwarded from the EPUB `iframe`, causing arrow navigation to stop when focus enters the book frame or during initial async `display()`.
   - **Reload State & Progress Persistence (`useAppStore.ts`, `EpubReaderView.tsx`, `FullSettingsModal.tsx`)**: Zustand store settings, active book/view state, and modal checkboxes are currently in-memory only (not hydrated from `db.settings`), and initial `relocated` events before location generation completes (or with `progressCfi: null`) can overwrite saved progress with page 1 / 0%.


---

## Increment 15: Design System Lock Alignment, Component Inventory & Documentation Sync

### Summary
- **Design System Lock (`DESIGN.md`) Modernization**: Replaced the obsolete Increment 1 "Encapsulated Obsidian Glassmorphism" specification with the production **Semply Native Desktop Dark** design system matching `src/renderer/src/index.css`. Explicitly codified the permanent ban on retired web-prototype anti-patterns (capsule/pill buttons such as `Switch to Reader View` and glowing `+ Import eBook`, floating format/preview pills such as `EPUB 3` and `Design Preview`, radial blur meshes, and PRO nag chrome).
- **Verified Production Module Inventory**:
  - **Main & Preload**: `src/main/index.ts` (frameless window, global zoom `before-input-event`, native editable context menus, file/folder dialogs, recursive scan, PDF-to-EPUB converter, fullscreen IPC), `src/preload/index.ts`.
  - **Drawers (`src/renderer/src/components/drawers/`)**: `TOCDrawer`, `NotesDrawer`, `BookmarksDrawer`, `SearchDrawer`, `SettingsDrawer`.
  - **Library (`src/renderer/src/components/library/`)**: `LibraryView`, `Sidebar`, `BookCard`, `ResumeBar`.
  - **Reader (`src/renderer/src/components/reader/`)**: `EpubReaderView`, `ReaderTopBar`, `SelectionPopup`, `FootnotePopover`, `AdaptiveScrollOverlay`, `RSVPSpeedReaderModal`.
  - **Modals & Chrome (`src/renderer/src/components/modals/`, `ui/`)**: `FullSettingsModal`, `TitleBar`, `ContextMenu`, `HelpModal`, `AppBackground`.
  - **Services & State (`src/renderer/src/services/`, `db/`, `stores/`)**: `adaptiveScrollService`, `backupService`, `colorTempService`, `coverService`, `dictService`, `ttsService`, Dexie `db/index.ts`, Zustand `useAppStore.ts`.
- **README Synchronization (`README.md`)**: Documented Full-Book Find (`Ctrl+F`), PDF-to-EPUB conversion & multi-format import, the full Keyboard Shortcuts reference table, packaging/release commands (`npm run package`, `npm run release`), and cross-linked `DESIGN.md`.


---

## Increment 13: Native PDF Reader, Librera-Style MuPDF Reflow Mode & Offline PDF-to-EPUB Converter

### Architecture & Implementation
1. **Offline MuPDF WASM PDF-to-EPUB Engine (`src/main/pdfToEpubEngine.ts`)**:
   - Powered by Artifex's official **`mupdf`** WebAssembly package (exact same C `fz_stext` layout engine inside Librera Reader's `libMuPDF.so`), running 100% offline in Electron's Node main process across Windows, macOS, and Linux.
   - **Pass 1 (Document Profiling)**: Computes dominant body font size across pages and detects repeating top/bottom running headers & footers (e.g., page numbers and recurring chapter titles) for clean removal.
   - **Pass 2 (Structured Text + Image Extraction)**: Runs `page.toStructuredText('preserve-images,dehyphenate,segment')` and walks blocks via `stext.walk()` to produce semantic `<h1>`–`<h3>`, `<p>`, `<strong>`, `<em>`, `<pre><code>`, and deduplicated inline embedded images (`onImageBlock` -> `OEBPS/images/*`).
   - **Scanned & Diagram Fallback**: Automatically detects low-text/scanned pages (`< 25 chars`) and rasterizes them cleanly at high DPI (`asJPEG(86)`) as responsive figures so diagrams and scanned content are preserved with zero data loss.
   - **EPUB 3 + EPUB 2 Packager**: Splits chapters from native PDF bookmarks (`doc.loadOutline()`), renders Page 1 as `cover.jpg`, bundles Librera-inspired `reflow.css`, and writes spec-compliant `mimetype` (STORE), `container.xml`, `content.opf`, `nav.xhtml`, and `toc.ncx`. Strict `.destroy()` cleanup guarantees zero WASM memory leaks.
2. **Native PDF Viewer (`src/renderer/src/components/reader/PdfReaderView.tsx`)**:
   - Renders `.pdf` books natively using `pdfjs-dist` with HiDPI `devicePixelRatio` canvases, aligned selectable text overlay, Single & Double Page Spread views, zoom controls (`50%–300%`), PDF Outline in `TOCDrawer`, Bookmarks, Night/Sepia color adaptation, right-click `ContextMenu`, and True Immersive Fullscreen.
3. **One-Click PDF Reflow Mode in Settings & Offline Library Conversion (`SettingsDrawer.tsx`, `App.tsx`, `BookCard.tsx`)**:
   - Placed an effective **PDF Reflow Mode** (`Original PDF` | `Reflow EPUB`) switcher + live progress bar + **Convert & Export as EPUB (Offline)** action directly inside `SettingsDrawer.tsx`.
   - Caches reflowed EPUBs in `userData/reflow_cache/` for instant repeat activation and unlocks all EPUB features (custom fonts, sizing, highlights, notes, dictionary, Read Aloud, RSVP, Auto-Scroll) seamlessly.
   - Added **"Convert to EPUB (Offline)"** to the right-click context menu on PDF cards in the Library, automatically importing the converted `.epub` with cover art into Dexie DB.


---

## Increment 15: Sidebar Duplicate Branding Header Removal

### Summary
- Removed the redundant branding header block (`Semply Ebook Reader` with blue book icon) from the top of `src/renderer/src/components/library/Sidebar.tsx`, leaving the native `TitleBar.tsx` brand mark as the single clean header and reclaiming vertical space for library shelves and custom categories.
- Cleaned up the unused `semplyLogo` import in `Sidebar.tsx`.


---

## Increment 14: Cropped Transparent Semply Icon & Native Taskbar Wiring

### Summary
- Cropped `resources/icon.png` tightly to the rounded squircle rim (`690x690`, 1px shadow inset), applied a 4x supersampled anti-aliased rounded-rectangle alpha mask to remove the outer square background completely, and generated multi-resolution Windows `.ico` (`16`–`256px`) and optimized `512x512` RGBA `.png` assets across `resources/`, `build/`, `src/renderer/favicon.*`, and `src/renderer/src/assets/icons/semply_logo.*`.
- Updated `src/main/index.ts` to resolve the platform icon (`resolveAppIconPath()`), pass `icon` directly to `new BrowserWindow(...)`, and call `app.setAppUserModelId('com.ederaefe.semple-ebook-reader')` on Windows so the custom Semply icon replaces the default Electron atom icon in both `npm run dev` and packaged builds.
- Updated `electron-builder.config.ts` with explicit `win.icon` / `mac.icon` / `linux.icon` paths and `extraResources` bundling for `resources/icon.{ico,png}`.


---

## Increment 14: MuPDF WASM Runtime Verification Fix, Enhanced Annotation Subsystem & Library Import UI

### Summary of Changes
1. **MuPDF WASM Extraction Fix (`src/main/pdfToEpubEngine.ts`)**:
   - Verified via live Node runtime testing that `mupdf` v1.x WASM suppresses `stext.walk()` callbacks when the `segment` option is combined with `preserve-images,dehyphenate`. Updated Pass 1 and Pass 2 to use `dehyphenate` and `preserve-images,dehyphenate`, confirming live extraction of both structured text blocks and embedded PNG/JPEG images.
2. **Annotation & Bookmark Drawer Resilience (`NotesDrawer.tsx`, `BookmarksDrawer.tsx`, `AnnotationPopover.tsx`, `annotationService.ts`)**:
   - Added rich annotation color/note editing, search/sort/export (HTML, Markdown, Plain Text) via `annotationService.ts` and `AnnotationPopover.tsx`.
   - Made drawer mutation callbacks optional with built-in Dexie fallbacks so both `EpubReaderView` and `PdfReaderView` share full bookmark and note management seamlessly.
3. **Library Import Experience & Packaging (`AddBookCard.tsx`, `ImportBooksModal.tsx`, `electron-builder.config.ts`)**:
   - Added interactive `AddBookCard` and `ImportBooksModal` for streamlined book/folder import and refreshed branding icons and `electron-builder.config.ts` for desktop packaging.


---

## Increment 16: Comprehensive Icecream-Faithful Notes, Highlights & Bookmarks Engine

### Architecture & Root-Cause Resolution
1. **Dedicated Annotation & Excerpt Engine (`src/renderer/src/services/annotationService.ts`)**:
   - **Theme-Aware SVG Highlighting**: Replaced `epub.js`'s default `{ fill: 'yellow', 'fill-opacity': '0.3', 'mix-blend-mode': 'multiply' }` (which rendered highlights nearly invisible on dark backgrounds) with theme-aware SVG styling (`mix-blend-mode: screen` on `night` and `dark-sepia`; `mix-blend-mode: multiply` on `day` and `light-sepia`) across all 6 authentic Icecream styles (`yellow`, `blue`, `green`, `purple`, `red`, and true stroke `underline`).
   - **Dual-Anchor Persistence (`db/index.ts` v2)**: Extended Dexie schema to store `pageNumber`, `chapterTitle`, `href`, `updatedAt`, and ported Icecream's `IceRange` (`makeXPath` + text offsets) alongside `EpubCFI` on every annotation, plus `excerpt`, `chapterTitle`, `xpath`, and `progressPercent` on bookmarks, and `notesCount` on books.
   - **Auto-Excerpt Bookmarking (`extractVisiblePageData`)**: Ported Icecream `jsengine.js`'s `getFirstVisibleElement()` / `getBookmarkData()` so every bookmark captures an authentic first-sentence excerpt from the bookmarked spread.
   - **Multi-Format Notes Export**: Added standalone Icecream-styled HTML report export, Markdown export, and plain-text clipboard copy (`exportNotesToHtml`, `exportNotesToMarkdown`, `exportNotesToPlainText`).
2. **Interactive On-Page Highlight Popover (`src/renderer/src/components/reader/AnnotationPopover.tsx`)**:
   - Clicking any existing highlight on the page opens a viewport-clamped popover supporting live color switching, inline comment editing (`Ctrl+Enter`), quote+note copy, Read Aloud (TTS), and synchronized deletion from both IndexedDB and the live rendition.
3. **Reader Selection, Hydration & Bookmark Ribbon (`EpubReaderView.tsx`, `SelectionPopup.tsx`, `ReaderTopBar.tsx`, `PdfReaderView.tsx`)**:
   - Fixed off-screen selection popup coordinates by computing offsets relative to `frameElement.getBoundingClientRect()` and clamping strictly inside viewport bounds.
   - Added full annotation hydration on book load and theme change, automatic iframe selection cleanup after highlighting, duplicate-safe highlight/bookmark guards, `Ctrl+B` instant bookmark toggle, clickable top-right **On-Page Bookmark Ribbon**, and custom contextual toasts with **Undo** support.
4. **Flagship Drawers & Sortable Library Notes Column (`NotesDrawer.tsx`, `BookmarksDrawer.tsx`, `LibraryView.tsx`, `BookCard.tsx`)**:
   - Upgraded `NotesDrawer` with live count, search, all 6 color + commented-only filters, sort (`Page order`, `Newest`, `Oldest`, `Color`), Chapter Grouping toggle, inline edit + live recolor, HTML/Markdown/Text export, and inline 2-step Clear All confirmation.
   - Upgraded `BookmarksDrawer` with auto-excerpts, inline rename, search, sort, duplicate-safe page toggle, and Clear All confirmation.
   - Wired live `notesCount` display in `BookCard` list view and interactive ascending/descending sorting across all 5 library columns (`Title`, `Author`, `Date`, `Notes`, `Progress`).



---

## Increment 16: Decluttered Library Toolbar, First-Slot Book Import Card & Category Bulk Add

### Summary
- **Top Toolbar Declutter (`LibraryView.tsx`)**: Removed the `+ Add book` and `Add folder` buttons from the top catalog header strip, replacing the left slot with a clean active shelf label and item count while preserving Search and Grid/List controls on the right.
- **First-Slot Book-Shaped Import Card (`AddBookCard.tsx`)**: Added a book-proportioned dashed `+` slot rendered in the very first position of both Grid View and List View (across main shelves and custom categories, hidden in Deleted/Trash and active search).
- **Unified Import & Bulk Category Modal (`ImportBooksModal.tsx`)**: Clicking the `+` book slot (or pressing `Ctrl+O`) opens a matte desktop dialog offering **Add Book** (file explorer) and **Add Folder** (recursive directory scan), automatically assigning newly imported books to the active custom category when browsing one. When inside a custom category, the modal also provides a **Bulk Add from Main Library** workflow with live filtering, select-all/deselect-all, and multi-select bulk assignment into that category, paired with a contextual bottom-right toast confirmation.


---

## Increment 15: Sleek Minimal Auto-Scroll Settings UI Redesign

### UI Polish & Clarity
- Redesigned Auto-Scroll controls consistently across `SettingsDrawer.tsx`, `FullSettingsModal.tsx`, and `AdaptiveScrollOverlay.tsx`.
- Replaced cryptic icon-only square buttons (`Power`, `Pilcrow`, unlabeled `Timer`/`Zap`) with a unified sleek segmented control (**Fixed** / **Smart**), concise 1-line micro-captions (*"Turns page on a fixed timer"* / *"Adapts pace to word count & speed"*), crisp unit readouts (`20s`, `250 WPM`), tactile sliding switches (`Auto-Scroll`, `Pause at breaks`), and subtle conditional reset buttons.


---

## Increment 16: Curved Theme Preview Cards (`ThemePickerGrid`)

### Summary
- **Reusable Live-Preview Theme Cards (`src/renderer/src/components/ui/ThemePickerGrid.tsx`)**: Replaced sharp flat theme toggle rectangles in both `FullSettingsModal.tsx` (System tab) and `SettingsDrawer.tsx` with curved (`rounded-[10px]`) live-preview cards rendered directly in each reading theme's authentic background, ink, and accent palette (`Day`, `Night`, `Light sepia`, `Dark sepia`).
- **Typography Specimen & Active State**: Each card displays a miniature serif `Aa` specimen alongside simulated accent/body text lines, the theme icon, and a crisp `#2a69df` check indicator + focus ring when selected, maintaining AAA contrast across all four palettes and proper `radiogroup` / `radio` accessibility roles.


---

## Increment 17: Slightly Curved Desktop Modal & Popover Corners

### Summary
- Softened all sharp `2px–3px` corners across dialogs and floating overlays to a consistent, slightly curved native desktop radius:
  - **`rounded-lg` (`8px`)**: `FullSettingsModal.tsx`, `ImportBooksModal.tsx`, `HelpModal.tsx`, `RSVPSpeedReaderModal.tsx`, `AnnotationPopover.tsx`, `FootnotePopover.tsx`, `SelectionPopup.tsx` (Note Composer, Dictionary, and Wikipedia modals), and `PdfReaderView.tsx` (Offline Reflow progress dialog).
  - **`rounded-md` (`6px`)**: Compact floating surfaces (`SelectionPopup.tsx` action bar, `ContextMenu.tsx`, and `EpubReaderView.tsx` contextual toasts).
