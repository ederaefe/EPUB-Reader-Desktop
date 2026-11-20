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

## 4. Multi-Agent Coordination & Synchronization Protocol
All autonomous agents across every conversation session MUST consult and maintain `dev-documentations.md` to prevent race conditions, conflicting file modifications, and redundant refactors:

1. **Pre-Task Check**: Read the header rules and latest increments at the end of `dev-documentations.md` before touching code to verify active locks, recent architectural fixes, and known constraints.
2. **Task Registration (In-Progress)**: When claiming a task or modifying shared files, append an entry to `dev-documentations.md` with status `[IN PROGRESS]` declaring:
   - **Agent Username**: Handle identifying the agent (e.g., `@Agent-PDFEngine`, `@Agent-LayoutCore`).
   - **Status**: `[IN PROGRESS]`
   - **What I Am Doing**: Specific goal and targeted components.
   - **Problem Statement**: Explicit root-cause description of the bug, edge case, or feature requirement.
   - **Active Files / Lock**: Exact paths reserved for this increment.
3. **Task Completion (Done & Technical Fix)**: When the increment passes verification, append or update your increment entry in `dev-documentations.md` with status `[COMPLETED]` declaring:
   - **Agent Username**: Matching agent handle.
   - **Status**: `[COMPLETED]`
   - **What Was Done**: Summary of work performed.
   - **Problem Statement**: Explicit recap of the underlying issue.
   - **Technical Fix**: In-depth explanation of the technical solution, architectural decisions, and mechanics implemented (not vague summaries).
   - **Touched Files**: Exact list of modified files.
   - **Verification**: Command results (`npx tsc --noEmit`, test suites, build).
   - **Handoff Notes**: Invariants preserved, known constraints, or directives for future agents.

## 5. Git Concurrency & Worktree Isolation Protocol
- **Prohibited Shared-Workspace Operations**: Multiple agents must NEVER run concurrent `git add`, `git commit`, or `git push` commands in the root workspace. Doing so causes `.git/index.lock` contention, mutual staging contamination, and non-fast-forward push rejections.
- **Isolated Git Worktrees for Parallel Work**: Agents assigned to parallel or independent features must spawn an isolated Git worktree (`git worktree add -b feat/<task-id> .worktrees/<task-id> origin/main`) so each agent has dedicated `.git/index` and worktree isolation.
- **Single-Authority Consolidation & Code Review**: A designated Consolidator / Reviewer agent (or Lead Coordinator) reviews completed branches, runs `npx tsc --noEmit` and build verification, merges clean branches into `main`, destroys temporary worktrees (`git worktree remove .worktrees/<task-id>`), and performs the final push.

