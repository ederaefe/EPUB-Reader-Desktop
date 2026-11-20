---
name: engine-forensic-debugging
description: >-
  Use this skill when investigating rendering freezes, spine misalignments, race conditions,
  or memory/state leaks in reader engines (epub.js, pdf.js, WASM) and complex React/Electron bridges.
---

# Engine Forensic Debugging Playbook

Systematic diagnostic protocol for complex asynchronous UI and document-rendering engines.

## 1. Subsystem Isolation & Triage
- Map symptoms directly to specific engine boundaries: lifecycle cleanup, parameter types, event sequence, or reactive dependencies.
- Avoid generic component re-renders or superficial UI workarounds before finding the underlying mechanical defect.

## 2. The 4 Classic Failure Vectors
1. **Lifecycle Inversion**:
   - Check whether imperative teardown functions (`destroy()`, `stop()`, `clear()`) run before or after React component refs are set to `null`.
   - *Rule*: Always tear down imperative instances before nulling refs to prevent dangling events firing on dead/null references.
2. **API Contract & Type Invariants**:
   - Verify whether library APIs expect specific subtypes (e.g. `epub.spine.get` requires an href or spine index, rejecting raw CFI strings).
   - Never pass complex structured formats (like `epubcfi(...)`) into functions designed only for file paths without a format guard.
3. **Lazy Initialization Races**:
   - Check if layout adjustments (such as `_minSpreadWidth` or dimensions) are applied before the engine's internal layout manager has instantiated.
   - Hook into specific lifecycle events (e.g., `started`, `rendered`) rather than synchronous top-level execution.
4. **Reactive Dependency Pollution**:
   - Check if an active timer, countdown, or background process re-subscribes or cancels itself on every state change (e.g. pagination position in `useEffect` deps).
   - Only include minimal state triggers in effect dependency arrays; let events drive updates where possible.

## 3. Atomic Verification
- Patch all identified root causes in a unified pass.
- Verify zero syntax or typing regressions using the project type checker (`npx tsc --noEmit`).
