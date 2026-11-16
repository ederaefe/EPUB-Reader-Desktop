# Implementation Directive for Main Agent: Adaptive Auto-Scroll Engine

## Task Objective
Implement **Phase 1: Adaptive Auto-Scroll Engine** into the **Ebook Reader** desktop application.

---

## 1. Architectural Blueprint

### Problem Solved
Static auto-scroll with fixed pixel speed fails because word density across paragraphs varies drastically (dialogue vs. descriptive blocks). The adaptive auto-scroll engine continuously estimates the reader's real-time reading cadence (WPM) and dynamically modulates scroll velocity based on the text density of the upcoming DOM slice.

### Mathematical Model
1. **Cadence Profiling (Exponential Moving Average)**:
   - When the user manually scrolls or advances pages, measure observed reading speed:
     $$\text{WPM}_{\text{observed}} = \frac{\text{Word Count in Viewport}}{\Delta t_{\text{elapsed}}}$$
   - Smooth fluctuations using an EMA ($\alpha = 0.15$):
     $$\text{WPM}_{\text{current}} = \alpha \cdot \text{WPM}_{\text{observed}} + (1 - \alpha) \cdot \text{WPM}_{\text{previous}}$$
     *(Default initial baseline: 250 WPM)*

2. **Dynamic Block Velocity**:
   - For continuous scroll or page pacing:
     $$v_{\text{scroll}}(t) = \frac{\text{Word Count in Upcoming DOM Block}}{\text{WPM}_{\text{current}} \times 60} \times \text{Block Height (px)}$$

3. **Behavioral Adaptation Signals**:
   - **Back-Scroll / Wheel Up**: User lost their spot or speed is too fast $\rightarrow$ reduce target $\text{WPM}$ by $15\%$.
   - **Forward Nudge / Down Arrow**: User is waiting $\rightarrow$ increase target $\text{WPM}$ by $10\%$.
   - **Cognitive Pause Buffers**: Add a 300ms pause at chapter ends, section dividers (`***`), and large margins.
   - **Focus / Distraction Interruption**: Auto-pause smoothly on `window.onblur`, text selection, or active hover on interactive footnotes.

---

## 2. File Implementation Checklist

### A. New Service: `src/renderer/src/services/adaptiveScrollService.ts`
- Implement class `AdaptiveScrollService`:
  - Methods: `start(viewport: HTMLElement, initialWpm?: number)`, `stop()`, `pause()`, `resume()`.
  - Methods: `handleUserBackScroll()`, `handleUserForwardNudge()`, `getLearnedWpm(): number`.
  - DOM text-density analyzer inspecting child paragraphs of the rendered EPUB iframe.

### B. State Store Updates: `src/renderer/src/stores/useAppStore.ts`
- Add to state:
  - `isAdaptiveScrollActive: boolean`
  - `learnedWpm: number`
  - `toggleAdaptiveScroll: (active?: boolean) => void`
  - `setLearnedWpm: (wpm: number) => void`

### C. Reader UI Integration: `src/renderer/src/components/reader/EpubReaderView.tsx` & `ReaderTopBar.tsx`
- Bind hotkey `Space` or `A` to toggle Adaptive Auto-Scroll.
- Wire wheel event listener inside the reader iframe to feed back-scroll / forward-nudge signals to `adaptiveScrollService`.
- Display a floating, unobtrusive speed pill at the bottom edge showing:
  `[ ► 245 WPM | Adaptive Auto-Scroll (Space to pause) ]`

---

## 3. Verification Protocol
1. Run `npm run typecheck` to confirm zero TypeScript errors.
2. Run `npm run build` to confirm production bundling succeeds.
3. Test in live window via `npm run dev`:
   - Open a book (*The Fifth Season*).
   - Press `Space` or click auto-scroll.
   - Verify smooth pacing that slows down on dense paragraphs and speeds up on dialogue.
   - Scroll up with mouse wheel and confirm WPM automatically drops and decelerates.
