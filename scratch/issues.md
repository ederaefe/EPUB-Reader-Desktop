# Agent Sync & Group Chat Log (`scratch/issues.md`)

Welcome to the multi-agent coordination board. This file serves as an ongoing group chat, concurrency registry, and technical audit log for autonomous agents working on the Semply Reader project across separate sessions and conversations.

---

## 1. Rules of Engagement & Protocol

1. **Check First**: Before initiating work or proposing modifications, read the latest messages in this log to verify what files, features, or architectural subsystems were recently touched or are currently undergoing changes.
2. **Assign a Handle**: Give yourself a recognizable username for each entry (e.g., `@Agent-Coordinator`, `@Agent-ReaderCore`, `@Agent-UIUX`, `@Agent-PDFEngine`).
3. **Prevent Conflicts**: If another agent recently touched a file or refactored an invariant (such as epub.js lifecycle, dual-page layout spread, or PDF worker cancellation), preserve their work and do not revert changes without documenting clear architectural justification.
4. **Log Before and After**:
   - **When Starting / Claiming Work**: Post an `[IN PROGRESS]` entry declaring what you are doing, the problem statement, and the active files you are locking.
   - **When Completing Work**: Post a `[COMPLETED]` entry detailing what was done, the problem statement, the concrete technical fix implemented, touched files, test outcomes (`tsc --noEmit`, tests), and notes for subsequent agents.
5. **No Destructive Overwrites**: Always append new chat entries to the activity feed below. Do not truncate or purge previous entries.
6. **Git Worktree Isolation & Consolidation**:
   - **Never commit or push concurrently in the shared workspace**: Doing so triggers `.git/index.lock` collisions, stages other agents' intermediate files, and causes push rejections.
   - **Use Isolated Worktrees**: Agents running concurrent tasks must create dedicated worktrees (`git worktree add -b feat/<task-id> .worktrees/<task-id> origin/main`).
   - **Consolidator Agent Responsibility**: Only a single Reviewer / Consolidator agent performs code review, verifies `npx tsc --noEmit`, merges completed branches into `main`, prunes the worktrees, and pushes to remote.

---

## 2. Standard Message Templates

### Template A: In-Progress Task Registration

```markdown
### [YYYY-MM-DD HH:MM] @<username> | Status: IN PROGRESS
- **What I Am Doing**: <Specific feature, bug, or refactor currently being undertaken>
- **Problem Statement**: <Root-cause explanation or user requirement being addressed>
- **Active Files / Lock**:
  - `path/to/file1.ts`
  - `path/to/file2.tsx`
```

### Template B: Completed Task & Technical Fix Handoff

```markdown
### [YYYY-MM-DD HH:MM] @<username> | Status: COMPLETED
- **What Was Done**: <Concise summary of the completed work>
- **Problem Statement**: <Recap of the exact bug, edge case, or capability requirement>
- **Technical Fix**: <Detailed architecture and code implementation breakdown explaining how the issue was resolved>
- **Touched Files**:
  - `path/to/file1.ts`
  - `path/to/file2.tsx`
- **Verification**: <e.g., npx tsc --noEmit passed, build clean, unit/browser tests verified>
- **Handoff Notes**: <Invariants preserved, potential side effects, or guidance for the next agent>
```

---

## 3. Agent Group Chat & Activity Feed

### [2026-11-20 20:35] @Agent-GitCoordinator | Status: COMPLETED
- **What Was Done**: Standardized Multi-Agent Git Worktree Isolation & Single-Authority Consolidation Protocol.
- **Problem Statement**: Multiple parallel agents executing concurrent `git status`, staging (`git add`), committing, and pushing in the same workspace collide with `.git/index.lock` failures, interleave half-finished stages, and trigger push rejections (`[rejected - non-fast-forward]`).
- **Technical Fix**:
  - Added Rule 6 to `scratch/issues.md` establishing mandatory isolation for concurrent agent workflows.
  - Added Section 5 to `AGENTS.md` forbidding shared-workspace concurrent commits/pushes.
  - Added `.worktrees/` to `.gitignore`.
  - Documented the Fan-out/Fan-in workflow: workers branch into `.worktrees/<task-id>`, while a single Consolidator / Reviewer agent runs `npx tsc --noEmit`, performs code review, merges into `main`, prunes worktrees, and pushes to remote.
- **Touched Files**:
  - `AGENTS.md`
  - `.gitignore`
  - `scratch/issues.md`
  - `dev-documentations.md`
- **Verification**: `npx tsc --noEmit` clean (0 errors), files verified on disk.
- **Handoff Notes**: When spawning parallel subagents, assign each to a dedicated git worktree under `.worktrees/`. Only the lead / reviewer agent is permitted to perform merges and remote pushes.

### [2026-11-20 20:33] @Agent-Coordinator | Status: COMPLETED
- **What Was Done**: Formalized the Multi-Agent Coordination Protocol across repository guidelines and documentation.
- **Problem Statement**: Autonomous agents operating across different conversation contexts lacked a standardized protocol for documenting active operations, resulting in risks of colliding edits, uncoordinated refactoring, and lost context on the root problem and technical solution.
- **Technical Fix**:
  - Updated `AGENTS.md` (Section 4) to require all agents in every session to log both `[IN PROGRESS]` (intent, problem statement, file locks) and `[COMPLETED]` (problem statement, technical fix, touched files, verification) entries.
  - Upgraded `scratch/issues.md` with explicit templates for In-Progress registration and Completed technical handoffs.
  - Documented the multi-agent coordination protocol in `dev-documentations.md` (Increment 31).
- **Touched Files**:
  - `AGENTS.md`
  - `scratch/issues.md`
  - `dev-documentations.md`
- **Verification**: `npx tsc --noEmit` verified clean (0 errors).
- **Handoff Notes**: Any new conversation starting work must first read this file, post an `[IN PROGRESS]` entry with problem statement and locked files, and append a `[COMPLETED]` entry with the technical fix upon finishing.

### [2026-11-20 19:40] @Agent-PDFEngine | Status: COMPLETED
- **What Was Done**: Mounted AdaptiveScrollOverlay in native PDF view and synchronized continuous auto-scroll pacing.
- **Problem Statement**: PDF reading lacked hands-free auto-scrolling because previous implementations tied auto-scroll strictly to reflowable WPM calculations, which fail on fixed-layout PDF canvases.
- **Technical Fix**:
  - Lifted format restrictions in `useAppStore.ts` and wired `adaptiveScrollEngine` in deterministic `countdown` mode.
  - Configured layout-aware dwell durations: 25s for single-page reading and 45s for dual-page spreads.
  - Mounted `AdaptiveScrollOverlay` inside `PdfReaderView.tsx` with shared countdown subscriptions to eliminate counter drift.
  - Implemented automatic countdown suspension when drawers/modals are active and termination at EOF.
- **Touched Files**:
  - `src/renderer/src/views/PdfReaderView.tsx`
  - `src/renderer/src/components/AdaptiveScrollOverlay.tsx`
  - `src/renderer/src/components/Drawers/SettingsDrawer/AutoScrollSettingsTab.tsx`
- **Verification**: `npx tsc --noEmit` clean, verified countdown suspension and sync with settings drawer.
- **Handoff Notes**: Dual-page mode in PDF readers maps `currentPage + 1` for the right canvas; avoid resetting canvas transforms when updating timer state.

### [2026-11-20 18:15] @Agent-ReaderCore | Status: COMPLETED
- **What Was Done**: Dual-page PDF text layer alignment and selection fixes.
- **Problem Statement**: In dual-page PDF layout, text selection was restricted to the left page; selections or annotations on the right page failed or misattributed coordinates and bookmarks to `currentPage`.
- **Technical Fix**:
  - Added dedicated `textLayerRightRef` alongside `canvasRightRef` in `PdfReaderView.tsx`.
  - Populated both layers concurrently via `page.getTextContent()` with identical viewport scaling.
  - Implemented container-aware selection resolution in `handlePdfTextSelection` checking `textLayerRightRef.current?.contains(...)` to map right-page highlights accurately to `currentPage + 1`.
  - Added preemptive `taskRef.current.cancel()` checks prior to canvas unmount to prevent worker exceptions.
- **Touched Files**:
  - `src/renderer/src/views/PdfReaderView.tsx`
- **Verification**: `npm run typecheck` passed with 0 errors. Production bundle build clean.
- **Handoff Notes**: When modifying PDF text layer geometry, maintain standard viewport scale alignment to prevent highlight rect displacement.

### [2026-11-20 16:30] @Agent-LayoutMaster | Status: COMPLETED
- **What Was Done**: Horizontal paginated reader standardization, dual layout architecture, and occlusion-free drawer resizing.
- **Problem Statement**: Switching between single and dual layouts caused page estimation errors (spreadFactor halved), text inputs captured reader navigation keys, and opening overlay TOC drawers shifted the reading canvas unnecessarily.
- **Technical Fix**:
  - Reconciled legacy `pageSpread: 'double'` to `pageLayout: 'dual'` during store hydration in `useAppStore.ts`.
  - In `EpubReaderView.tsx`, recalculated `spreadFactor` via `isDualLayout ? 2 : 1`.
  - Added input element guards (`isTargetInput`) across content window and root window keydown listeners.
  - Removed left canvas margin contraction on overlay TOC drawer.
  - Applied `-translate-x-1/2` to the central dual-page gutter divider for exact optical midpoint alignment.
- **Touched Files**:
  - `src/renderer/src/views/EpubReaderView.tsx`
  - `src/renderer/src/store/useAppStore.ts`
  - `src/renderer/src/components/Drawers/TOCDrawer.tsx`
- **Verification**: Automated layout test suite (`scratch/test_reader_layout_modes.js`) passed (TC-1 through TC-4). `tsc --noEmit` passed.
- **Handoff Notes**: In `EpubReaderView.tsx`, always preserve `rendition.on('started')` layout constraints and do not place granular location states into continuous service effect hooks.


### [2026-11-20 20:50] @Agent-DocSync | Status: COMPLETED
- **What Was Done**: Prepended agent appending rules, templates, and concrete examples to the top of both documentation files.
- **Problem Statement**: Agents had to read entire documentation files (thousands of lines) before appending increments, causing context bloating and high latency.
- **Technical Fix**: Added upfront instructions ([!IMPORTANT]), strict 4-point rules, markdown codeblock templates, and complete examples at the beginning of documentation.md (user-facing) and dev-documentations.md (developer reference). Future agents only need to read lines 1-40 to know how to append and can jump straight to the end.
- **Touched Files**:
  - documentation.md
  - dev-documentations.md
  - AGENTS.md
  - .gitignore
  - scratch/issues.md
- **Verification**: Verified header formatting, 
pm run typecheck passed with 0 errors, 
pm run build passed.
- **Handoff Notes**: When adding future updates, read only the header rules/template of documentation.md or dev-documentations.md, then append directly to the bottom.
