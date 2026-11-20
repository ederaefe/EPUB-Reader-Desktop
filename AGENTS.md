# AGENTS.md — Workspace Rules for Semply Reader

These rules are permanent behavioral guidelines for coding agents working in this repository.

## 1. Reader Engine & Async Lifecycle Invariants
- **Teardown Order**: In `EpubReaderView.tsx` and any engine view mounting imperative instances (`epub.js`, `pdfjs-dist`, `mupdf`), always stop queues and call `.destroy()` **before** setting instance refs to `null`. Never null refs before destroy.
- **CFI vs Href Handling**: `epub.spine.get()` expects file paths or integer indices, NOT `epubcfi(...)` strings. Always check for CFI format (`startsWith('epubcfi(')`) before querying the spine.
- **Layout Initialization Timing**: Epub.js instantiates `_layout` lazily during the `started` phase. Always configure spread and `_minSpreadWidth` constraints via `rendition.on('started', ...)` or after layout manager creation.
- **Reactive Dependency Isolation**: Never place granular reader position states (`currentCfi`, `currentPage`, `progressPercent`) into effect dependencies of continuous services (such as Auto-Scroll timers or TTS feeds). Position changes must be handled reactively through engine event listeners (`relocated`).

## 2. Type Checking & Verification
- Always run `npx tsc --noEmit` before concluding code modifications to ensure zero TypeScript errors across renderer, main, and shared processes.

## 3. Documentation Invariants
- Keep `documentation.md` (user-facing, no code internals) and `dev-documentations.md` (developer-facing, architectural deep-dive) updated and appended with every completed increment.

## 4. Multi-Agent Coordination Protocol
- Before starting work on any task, read `scratch/issues.md` to inspect recent agent activities, active file locks, and handoff warnings.
- After completing any task or when claiming an active file lock, append a message entry to `scratch/issues.md` stating your agent username, status, touched files, what was done, and handoff notes so agents in different conversation sessions avoid duplicate or conflicting changes.
