# Design System Lock: Semply Geist Obsidian Desktop

## 1. Product Anchor
- **Product**: Semply Ebook Reader — cross-platform desktop EPUB, PDF, MOBI, and TXT reader (Electron + React 19 + TypeScript + Tailwind CSS + `epub.js` + `pdfjs-dist` + offline MuPDF WASM).
- **Audience**: Desktop readers, researchers, and students who read for extended sessions and expect crisp native desktop ergonomics with zero visual clutter or paywall gates.
- **Primary Job**: Deliver distraction-free reading paired with fast library curation, offline PDF reflow, full-book search, theme-aware highlights & notes, dual-mode auto-scroll, Read Aloud TTS, and reliable cover/first-page extraction.

---

## 2. Design Methodology: Architectural Obsidian Monochrome
Semply follows a **Vercel Geist-inspired Obsidian Desktop** aesthetic: pure obsidian surfaces (`#0a0a0a` / `#0d0d0d` / `#111111`), `1px` translucent hairline borders (`rgba(255,255,255,0.07–0.10)`), disciplined `6px–10px` radii on modern panels and controls, `tabular-nums` alignment on all numeric metrics, monochrome primary CTAs, and strict visual restraint so book typography owns the viewport.

### Explicit Anti-Pattern Ban (Retired Increment 1 Prototype)
The initial glassmorphic web prototype ("Encapsulated Obsidian Glassmorphism") was permanently retired. The following patterns must **never** be reintroduced:
1. **No Capsule / Pill CTA Buttons (`rounded-full`)**: Never render oval pill buttons (e.g., `Switch to Reader View`, glowing `+ Import eBook` CTAs) or floating format/preview badges (`Design Preview`, `EPUB 3` tags).
2. **No Verbose Text-Heavy Chrome**: Prefer crisp Lucide vector icons with concise tooltips and `aria-label` attributes over multi-word toolbar labels.
3. **No Ambient Mesh Blobs or Heavy Blur Halos**: Keep surfaces solid and restful so reading typography maintains full visual priority.
4. **No Paywall or Nag Chrome**: Zero "Upgrade to PRO", license banners, or update nag badges.

---

## 3. Geometry, Controls & Motion Tokens (`src/renderer/src/index.css`)
- **Typography**: `"Geist", "Inter", "Segoe UI", -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif` (`-webkit-font-smoothing: antialiased`, `letter-spacing: -0.01em`, `11px–13px` UI scale, `tabular-nums` for page counters and timers). Reader fonts: `Publisher (Original)`, `Sans`, `Serif (Georgia)`, `Mono (Consolas)`.
- **Control Radii & Custom Primitives**:
  - Geist buttons & inputs (`.ice-btn-dark`, `.ice-btn-blue`, `.ice-icon-btn`, `.ice-input`): `6px` radius with subtle tactile press scale (`scale(0.97)` on buttons, `scale(0.94)` on icon buttons).
  - Compact floating surfaces (`SelectionPopup` bar, `ContextMenu`, contextual toasts): `6px–8px` (`rounded-md` / `rounded-lg`).
  - Dialogs & popovers (`FullSettingsModal`, `ImportBooksModal`, `HelpModal`, `AnnotationPopover`, `FootnotePopover`): `8px–12px` (`rounded-lg` / `rounded-xl`).
  - Floating 3-Tab `SettingsDrawer` (`328px` wide, `top-10 right-3 bottom-3`) and `ThemePickerGrid` live-preview cards: `10px` (`rounded-[10px]`).
  - Checkboxes (`.ice-checkbox`): `15px × 15px`, `3px` radius, `#171a22` base, `#353b4c` border, `#2a69df` checked fill with crisp 45-degree white vector tick.
  - Range sliders (`.ice-slider`): `3px` translucent track (`rgba(255,255,255,0.12)`) with `13px` white circular thumb (`#3c7bf0` hover at `scale(1.25)`, `#1f56be` active at `scale(1.1)`).
  - Manual seconds inputs (`SecondsNumberInput.tsx`): `3–600s` numeric input with `-`/`+` `5s` steppers and `ArrowUp`/`ArrowDown` fine stepping.
- **Frameless Window & Drawer Layering Invariant**:
  - Title bar height is `32px` (`h-8`) with `.app-drag-region`; interactive controls carry `.app-no-drag`.
  - Left sliding drawers (`TOCDrawer`, `NotesDrawer`, `BookmarksDrawer`, `SearchDrawer`) anchor at `top-8 bottom-0` (or `top-0` in immersive fullscreen); the floating `SettingsDrawer` anchors at `top-10 right-3 bottom-3`. All carry explicit `app-no-drag` and click-outside backdrops so OS window-drag hit-testing never swallows close clicks.
- **GPU Motion Primitives (`@keyframes ui-enter`)**:
  - Composable GPU-accelerated classes (`.animate-in`, `.fade-in`, `.zoom-in-95`, `.slide-in-from-left`, `.slide-in-from-right`, `.slide-in-from-bottom`, `.animate-fadeIn`) using `180ms cubic-bezier(0.22, 1, 0.36, 1)` (`will-change: transform, opacity`), fully disabled under `@media (prefers-reduced-motion: reduce)`.

---

## 4. Color Palette & Semantic Tokens

### Application Chrome (Geist Obsidian Scale)
- **Root Canvas & Title Bar**: `#0a0a0a`
- **Sidebar, Reader Top Bar & Resume Bar**: `#0d0d0d`
- **Elevated Floating Panels, Modals & Context Menus**: `#111111` (left utility drawers retain matte slate `#171a21` / `#14161c` headers)
- **Interactive Dark Controls (`.ice-btn-dark`)**: `#161616` (hover `#1f1f1f`, active `#121212`)
- **Input Wells (`.ice-input`)**: `#0f0f0f` (border `rgba(255,255,255,0.09)`, focus `rgba(255,255,255,0.28)`)
- **Hairline Borders**: `rgba(255, 255, 255, 0.07)` to `rgba(255, 255, 255, 0.10)`
- **Primary Monochrome CTA (`.ice-btn-blue`)**: `#ededed` fill with `#0a0a0a` text (hover `#ffffff`)
- **Active Indicators & Progress Accents**: Geist Blue `#0070f3` and Icecream Blue `#2a69df`
- **Text Hierarchy**:
  - Primary: `#ededed` / `#ffffff`
  - Secondary: `#888888` / `#9da7b3`
  - Muted: `#6e7681` / `#555555`

### EPUB Reading Themes (`EpubReaderView.tsx`)
| Theme | Display Label | Background | Text | Link | Bottom Bar | Border |
| --- | --- | --- | --- | --- | --- | --- |
| **day** | Light | `#ffffff` | `#171717` | `#0070f3` | `#fafafa` | `rgba(0,0,0,0.08)` |
| **night** | Obsidian | `#0d0d0e` | `#dcdcdc` | `#66b2ff` | `#0a0a0a` | `rgba(255,255,255,0.08)` |
| **light-sepia** | Paper | `#f6ebd4` | `#4a3a26` | `#8b5a2b` | `#efe2c6` | `rgba(95,75,50,0.16)` |
| **dark-sepia** | Dusk | `#221c16` | `#d8cbb8` | `#e6c8a5` | `#1a1510` | `rgba(255,255,255,0.08)` |

### Native PDF Canvas Theme Adaptation (`PdfReaderView.tsx`)
| Theme | Viewport Well | Canvas CSS Filter |
| --- | --- | --- |
| **day** | `#e9ecf0` | `none` |
| **night** | `#171a21` | `invert(0.88) hue-rotate(180deg) contrast(0.95)` |
| **light-sepia** | `#f4e6cb` | `sepia(0.28) brightness(0.98)` |
| **dark-sepia** | `#241e18` | `invert(0.86) sepia(0.35) hue-rotate(180deg) contrast(0.92)` |

### Theme-Aware Highlight Swatches (`annotationService.ts`)
- Light themes use `mix-blend-mode: multiply`; dark themes (`night`, `dark-sepia`) use `mix-blend-mode: screen` so highlights remain vivid and legible against dark paper:
  - Yellow: `#f3e3a2` (light) / `#f5d76e` (dark)
  - Blue: `#aed9f1` (light) / `#6cbcf0` (dark)
  - Green: `#b1f3a4` (light) / `#6ee787` (dark)
  - Purple: `#ccb8e4` (light) / `#b894f6` (dark)
  - Red: `#f3a2a2` (light) / `#f47c7c` (dark)
  - Underline: `#2a69df` (light stroke) / `#79c0ff` (dark stroke)
  - Temporary Search Match: `#f59e0b` at `35%` opacity

---

## 5. Iconography & Interaction Restraint
- **Icon System**: Lucide React (`14px–16px` crisp vector strokes) paired with native tooltips (`title` / `aria-label`).
- **3-Tab Reading Settings Command Center (`SettingsDrawer.tsx`)**: Organizes all reading controls into zero-scroll segmented tabs (**Display**, **Flow**, and **PDF / More**) so the primary `ReaderTopBar` stays minimal (exclusively Fullscreen + Settings on the right).
- **Immersive Restraint**: Bottom progress displays 5 subtle dots at rest and expands to `currentPage / totalPages` + interactive scrubber on hover; Immersive Fullscreen (`F11`) hides all window and reader chrome except book text and an optional muted bottom-right Auto-Scroll countdown.
- **Mutually Exclusive Drawers**: Opening any reader drawer (`Contents`, `Notes`, `Bookmarks`, `Find`, `Settings`) automatically closes any other open drawer and suspends active Auto-Scroll countdowns until dismissed.
