# Semply Ebook Reader - User Documentation

> **User-Facing Guide** — Simple, plain-language overview of Semply Ebook Reader features, preferences, and recent updates. For internal architecture, file paths, IPC contracts, and technical implementation specs, see `dev-documentations.md`.

## Documentation Style Guide (User-Facing)
All future updates appended to `documentation.md` must follow these rules:
- **Audience**: Everyday readers, not engineers. Explain *what changed for the user* and *how to use it*.
- **Tone & Clarity**: Use plain, direct language with short bullet points and clear headings. Keep sentences concise.
- **No Code Internals**: Omit source file paths, CSS class names, IPC channel names, database schemas, and internal component names (put those in `dev-documentations.md`).
- **Format**: Append new user-visible changes under **Recent Updates** with a short bold title and 1–3 plain sentences per feature.

---

## Core Features
- **Multi-Format Library**: Import `.epub`, `.pdf`, `.mobi`, and `.txt` books via file picker, folder scan, or drag-and-drop. Organize with Grid/List views, custom color-coded shelves, Favorites, Trash & Restore, and a Quick-Resume bar.
- **Reflowable EPUB & Native PDF Reading**: Read EPUBs in single-page or two-page spread mode with customizable typefaces, spacing, 4 reading themes (`Day`, `Night`, `Light Sepia`, `Dark Sepia`), highlights, notes, bookmarks, footnotes, full-book search, Read Aloud narration, and Auto-Scroll. Read PDFs natively or convert them offline to reflowable EPUB with one click.
- **Distraction-Free Reading**: Use `F11` for clean fullscreen reading, warm blue-light filtering for night sessions, and safe local backups (JSON or ZIP) with zero accounts or cloud lock-in.

---

## Recent Updates
- **Modern Add-Book Card**: Updated the library "Add Book" card with a rounded squircle frame, subtle dashed border, and gentle hover highlight around the "+" icon.
- **Streamlined Preferences & Tactile Controls**: Moved Read Aloud controls exclusively into the Reader Settings `Flow` tab and refreshed all global Settings tabs (`System`, `Reading settings`, `Hotkeys`, `Backup & Sync`, `About`) with crisp theme-aware buttons, switches, and keyboard shortcut badges across Day, Night, Light Sepia, and Dark Sepia themes.
- **App-Wide Roman (Baskerville) Typography & Higher Legibility**: Updated the entire application interface to use **Libre Baskerville** for a classic book-first Roman aesthetic, bolded muted labels for clearer readability across all themes, and established a clear visual hierarchy in Settings with bolder, larger section titles alongside clean regular-weight helper descriptions.
- **Compact Inline Settings Controls**: Redesigned every numeric stepper control (Font Size, Line Spacing, Screen Dimming, Warm Filter Temperature & Intensity, and Auto-Scroll timers) into compact inline `- / value / +` inputs aligned beside their labels, eliminating wasted space and duplicate readouts.
- **Language Selector Removed**: Removed the unused Language dropdown from System preferences for a cleaner, clutter-free settings layout.
- **Responsive Progress Bar, Page Counter & Faster Seeking**: Fixed EPUB progress tracking and scrubber navigation so clicking or dragging anywhere on the bottom progress bar jumps reliably without locking up page turns. Added a clear, high-contrast `current/total` page readout (such as `45/543`) at the end of the progress bar for both EPUB and PDF books, along with cached book indexing for instant subsequent opens.
- **Reliable Navigation, Scroll Modes & Backup Export**: Prevented reader page-turn freezes, connected Horizontal and Vertical Scroll Mode switching in Reader Settings, wired `F7`/`F8` Read Aloud and `End` shortcuts inside book pages, fixed side-edge navigation arrows, and ensured canceling a Backup Save dialog stops the export immediately.
- **App-Wide Theme Polish**: Made the progress scrubber tooltip, right-click menus, reader settings switches and buttons, in-book search highlights, highlight popovers, side arrows, and confirmation dialogs cleanly adapt across Day, Night, Light Sepia, and Dark Sepia themes.

- **Link & Protocol Hardening**: Outgoing hyperlink clicks inside eBooks now strictly allow standard web addresses (`http` and `https`), blocking local file execution or unwanted system URI handlers.
- **Dynamic Book Page & Progress Calculation**: EPUB page counts and reading progress now adapt smoothly to individual book sizes rather than assuming preset page totals before indexing completes.
- **Dedicated Read Aloud (TTS) Hotkeys**: Added quick-access keyboard hotkeys for text-to-speech — press `F7` to play or pause reading aloud, and `F8` to stop reading immediately.
- **Restored About Dialog**: Re-connected the "About Semply" dialog in the library sidebar with clean links and verified asset rendering.
- **Security & Data Protection Hardening**: Hardened the entire desktop app with Chromium sandbox isolation, defense-in-depth file access protection (preventing access to operating system and sensitive credentials folders), strict HTTPS verification for online dictionary and font downloads, and automated backup data integrity validation.
- **Atomic Backup Writes & Network Resilience**: Enhanced export reliability using atomic file writes to protect against corrupted backups during unexpected power loss, added a 10-minute cache for dictionary and Wikipedia definitions, and enforced memory quotas to keep reading fast and smooth.
- **Streamlined Sidebar**: Removed the duplicate "About Semply" entry and standalone popup from the library sidebar since app information and links are already available under Settings > About.

- **Reliable Page Turning & Position Preservation**: Fixed an issue where EPUB page turns could stall on cover or front-matter sections and ensured your exact reading position stays intact instead of jumping back to the first page when layout settings or progress updates occur.
- **Higher-Contrast Dark Themes**: Brightened both muted secondary labels and primary reading/interface text across Night and Dark Sepia modes so captions, counts, icons, and book text stand out crisply without straining your eyes.
- **In-Reader Metadata, Tags & Cover Editor**: Open Reader Settings and select the book summary card under **More** (or **PDF**) to inspect and edit title, author, tags, description, publishing details, and cover thumbnails while you read—without losing your place. Changes save instantly to your library and make books searchable by tags, publisher, or series, with an optional **Write to file** toggle to update your `.epub` or `.pdf` file directly on disk.
- **Crisper Reading Contrast & Text Weight Control**: Deepened ink contrast across the Paper, Light, Dusk, and Obsidian themes (fixing the Paper top background seam) and enabled native subpixel optical text rendering so serif books look sharp on desktop monitors. Added a **Normal / Medium / Bold** Text Weight control under Display and Reading Settings to make thin serif typefaces effortlessly legible at any size.
- **One-Time Climax Progress Bar & Fullscreen Wave**: Each book picks its own random climax point between 75% and 85%—aligning the progress bar's crimson peak with a subtle, once-per-book three-pulse glow in windowed mode, or a subtle theme-adaptive crimson wave flowing down from the top of the screen three times in fullscreen (stopping immediately if you exit fullscreen).
- **Accurate Table of Contents & Clean Chapter List**: Removed the estimated `p.XX` page labels from the Table of Contents drawer so each entry displays only the chapter title, and upgraded chapter mapping so tapping any chapter (including nested subchapters and multi-chapter files) jumps directly to that exact section with accurate active-chapter tracking.

- **Cross-Reader Parity & Tokenized Contents Drawer**: Unified EPUB and PDF Table of Contents handling under a shared TOC service supporting recursive nested outlines and live active-chapter tracking, stabilized PDF loading against metadata-update reloads, aligned PDF bookmark/keyboard/drawer shortcuts with the EPUB reader, matched multi-view EPUB iframes by section index in vertical scroll mode, and migrated the Contents drawer to semantic theme design tokens.
- **Open & Import Library Redesign**: Renamed "Add" actions to **Open** for books and **Import** for folders across the library shelf, modal, and hotkey guide. Redesigned the Open / Import dialog with matching rounded dashed cards, centered circular icon medallions, and full theme adaptation across Night, Day, Light Sepia, and Dark Sepia.
