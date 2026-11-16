# Design System Lock: Encapsulated Obsidian Glassmorphism

## 1. Product Anchor
- **Product**: Cross-platform Desktop eBook & Document Reader.
- **Audience**: Avid readers, researchers, and students who read for hours on desktop and want a distraction-free, aesthetically refined environment without artificial paywalls.
- **Primary Job**: Deliver a fluid, high-legibility reading experience with effortless library curation, rich annotations, smart Text-to-Speech, and accurate PDF-to-EPUB conversion.

---

## 2. Design Methodology: Encapsulated Obsidian Glassmorphism
Encapsulated Obsidian Glassmorphism isolates information into floating, independent card modules using deep charcoal surfaces, pronounced corner radii for nested fluid layouts, and delicate translucent inner borders to achieve modern visual depth without structural clutter.

### Anti-Clutter Rules
1. **Zero Opaque Borders**: Card separations use translucent white/slate hairline borders (`rgba(255, 255, 255, 0.08)`) with specular edge highlights (`rgba(255, 255, 255, 0.14)`).
2. **Dynamic Mesh Backdrop**: A subtle multi-stop obsidian radial mesh (`#0d1117` base with `#1a2744` and `#1f1b3a` accents) ensures `backdrop-filter: blur(20px)` refracts authentic optical depth.
3. **Rest-State Restraint**: Controls remain unobtrusive at rest. Navigation arrows, toolbars, and action icons reveal on proximity/hover rather than crowding the page.
4. **Drawers Over Modals**: Contextual utilities (TOC, Settings, Annotations, TTS) slide in from the right edge as frosted glass panels; they never stack or obscure the whole viewport.

---

## 3. Mathematical Radius Rules (`better-ui` Compliance)
- **Nested Formula**: $\text{Outer Radius} = \text{Inner Radius} + \text{Padding} + \text{Border Width}$.
  - Main Cards: Outer `16px` (`rounded-2xl`), Padding `12px`, Inner elements `8px` (`rounded-lg`).
  - Flyout Drawers: `24px 0 0 24px` (`rounded-l-3xl`).
  - Action Pills & Badges: `9999px` (`rounded-full`).
  - Selection Tooltips: `12px` (`rounded-xl`).

---

## 4. Color Palette & Semantic Tokens
- **Backdrop Base**: `#0d1117` (Deep Obsidian)
- **Mesh Blobs**:
  - Cool Slate: `rgba(26, 39, 68, 0.35)`
  - Midnight Violet: `rgba(31, 27, 58, 0.25)`
  - Deep Emerald: `rgba(15, 40, 32, 0.20)`
- **Glass Surfaces**:
  - `surface-card`: `rgba(18, 24, 40, 0.65)` with `backdrop-blur: 20px`
  - `surface-raised`: `rgba(26, 36, 60, 0.75)` with `backdrop-blur: 24px`
  - `surface-drawer`: `rgba(14, 20, 34, 0.85)` with `backdrop-blur: 32px`
- **Borders & Highlights**:
  - `border-glass`: `rgba(255, 255, 255, 0.08)`
  - `highlight-specular`: `linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.16), transparent)`
- **Typography Colors**:
  - `text-primary`: `#f1f5f9` (Slate 100)
  - `text-secondary`: `#94a3b8` (Slate 400)
  - `text-muted`: `#64748b` (Slate 500)
  - `text-accent`: `#60a5fa` (Blue 400)
- **Reading Themes**:
  - Night: `#111827` (BG) / `#d1d5db` (Text)
  - Day: `#f9f9f7` (BG) / `#1a1a1a` (Text)
  - Light Sepia: `#fbf0d9` (BG) / `#5f4b32` (Text)
  - Dark Sepia: `#2b2621` (BG) / `#d5c7b3` (Text)

---

## 5. Motion & Micro-Interactions
- **Press Response**: Interactive buttons scale to `0.96` over `150ms` with `ease-out`.
- **Icon Hover**: Quick transition on `opacity` and `background-color` within `150ms`.
- **Drawer Slide**: `300ms cubic-bezier(0.2, 0, 0, 1)` with entrance stagger of `100ms` for drawer items.
- **Accessibility**: All animations automatically disabled when `prefers-reduced-motion: reduce` is detected.
- **Hover Guard**: Hover styles constrained to `@media (hover: hover)`.

---

## 6. Iconography
- **System**: Lucide Icons.
- **Stroke Width**: `1.75px` to match 400-500 font weights.
- **Sizes**:
  - `16px` for inline metadata & status badges.
  - `20px` for toolbar actions and drawer navigation.
  - `24px` for prominent view switchers.
