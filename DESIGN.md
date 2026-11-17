# Design System Lock: Semply Native Desktop Dark

## 1. Product Anchor
- **Product**: Semply Ebook Reader — cross-platform desktop EPUB and document reader (Electron + React + TypeScript + Tailwind CSS).
- **Audience**: Desktop readers, researchers, and students who read for extended sessions and expect authentic native desktop ergonomics with zero visual clutter or paywall gates.
- **Primary Job**: Deliver crisp, distraction-free book reading paired with fast library curation, full-book search, annotations, dual-mode auto-scroll, Read Aloud TTS, and reliable cover/metadata extraction.

---

## 2. Design Methodology: Matte Dark Slate Desktop Ergonomics
Semply uses solid, matte charcoal/slate desktop surfaces, sharp `2px–4px` control radii, icon-first toolbars with hover tooltips, and strict suppression of decorative web chrome.

### Explicit Anti-Pattern Ban (Retired Increment 1 Prototype)
The initial glassmorphic web prototype ("Encapsulated Obsidian Glassmorphism") was permanently retired. The following patterns must **never** be reintroduced:
1. **No Capsule / Pill Buttons (`rounded-full`)**: Never render oval pill buttons (e.g. `Switch to Reader View`, glowing `+ Import eBook` CTAs) or floating pill badges (`Design Preview`, `EPUB 3` tags).
2. **No Verbose Text-Heavy Chrome**: Prefer crisp Lucide vector icons with concise tooltips and `aria-label` attributes over multi-word button labels.
3. **No Ambient Mesh Blobs or Heavy Blur Halos**: Keep backgrounds solid and restful so book typography owns 100% of visual attention.
4. **No Paywall or Nag Chrome**: Zero "Upgrade to PRO", license banners, or update nag badges.

---

## 3. Geometry & Control Tokens (`src/renderer/src/index.css`)
- **Typography**: `"Segoe UI", -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif` for UI chrome (`11px–13px`), with customizable reader fonts (`Original`, `Georgia` serif, `Segoe UI` sans, `Consolas` mono).
- **Control Radii**:
  - Toolbar & drawer buttons / inputs: `2px–4px` (`rounded-[2px]` / `.ice-btn-dark`, `.ice-btn-blue`, `.ice-icon-btn`, `.ice-input`).
  - Dialogs & floating popovers: `6px–8px` (`rounded-md` for compact menus/toasts, `rounded-lg` for modals and popovers).
  - Theme preview cards (`ThemePickerGrid.tsx`): `10px` (`rounded-[10px]`) live-preview cards rendered in each theme's authentic paper, ink, and accent palette with serif `Aa` specimen lines and `#2a69df` active ring.
  - Checkboxes (`.ice-checkbox`): `15px × 15px`, `3px` radius, `#171a22` base, `#353b4c` border, `#2a69df` checked fill with crisp white checkmark.
  - Sliders (`.ice-slider`): `4px` `#252834` track with `12px` `#2a69df` circular thumb and `2px` white ring (`scale(1.25)` hover, `scale(1.10)` active).
- **Frameless Window & Drawer Layering**:
  - Title bar height is `32px` (`h-8`) with `.app-drag-region`; interactive controls carry `.app-no-drag`.
  - Sliding drawers (`TOCDrawer`, `NotesDrawer`, `BookmarksDrawer`, `SearchDrawer`, `SettingsDrawer`) anchor at `top-8 bottom-0` (or `top-0` in immersive fullscreen) with explicit `app-no-drag` headers and click-outside backdrops so OS window-drag regions never swallow clicks.

---

## 4. Color Palette & Semantic Tokens
### Application Chrome
- **Title Bar & Docked Header**: `#14161c`
- **Sidebar & Drawer Base**: `#171a21`
- **Catalog / Primary Viewport**: `#1c1f26`
- **Elevated Surface / Cards / Dark Button**: `#232732` (hover `#2b303d`, active `#1a1d26`)
- **Input Well**: `#12141a` (border `#232732`, focus `#2a69df`)
- **Hairline Borders**: `#232732` / `#282c38` / `#2b2f3a`
- **Primary Accent**: `#2a69df` (hover `#3b79ef`, active `#2156b8`)
- **Text Hierarchy**:
  - Primary: `#e6edf3` / `#ffffff`
  - Secondary: `#c8d1dc` / `#9da7b3`
  - Muted: `#8b949e` / `#6e7681`

### Reading Themes (`EpubReaderView.tsx`)
| Theme | Background | Text | Link | Bottom Bar | Border |
| --- | --- | --- | --- | --- | --- |
| **Day** | `#ffffff` | `#202020` | `#2a69df` | `#f2f2f2` | `#e1e4e8` |
| **Night** | `#1c1f26` | `#d8d8d8` | `#79c0ff` | `#14161c` | `#232732` |
| **Light Sepia** | `#fbf0d9` | `#5f4b32` | `#8b5a2b` | `#f2e5cb` | `#e2d3b5` |
| **Dark Sepia** | `#2d261e` | `#d5c7b3` | `#e6c8a5` | `#211c16` | `#3d3429` |

### Highlight Swatches
- Blue `#aed9f1`, Purple `#ccb8e4`, Red `#f3a2a2`, Yellow `#f3e3a2`, Green `#b1f3a4`, plus amber search-match highlight (`#f59e0b` at `35%` opacity).

---

## 5. Iconography & Interaction Restraint
- **Icon System**: Lucide React (`14px–16px` crisp vector strokes) paired with native tooltips (`title` / `aria-label`).
- **Immersive Restraint**: Bottom progress displays 5 subtle dots at rest and expands to the page counter + range scrubber on hover; immersive fullscreen (`F11`) hides all window and reader chrome except book text and an optional muted Auto-Scroll countdown.
- **Mutually Exclusive Drawers**: Opening any reader drawer (Contents, Notes, Bookmarks, Find, Settings) automatically closes any other open drawer and suspends active Auto-Scroll countdowns until dismissed.
