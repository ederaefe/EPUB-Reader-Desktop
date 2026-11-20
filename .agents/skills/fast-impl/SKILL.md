---
name: fast-impl
description: >-
  Universal high-velocity implementation, rapid forensic debugging, and architectural problem-solving across any stack.
  Use whenever the user requests high-speed debugging, rapid feature delivery, solving complex system freezes/crashes,
  or runs `/fast-impl`.
---

# Universal High-Velocity Implementation & Forensic Engineering (`fast-impl`)

The `fast-impl` skill is a universal, domain-agnostic protocol for diagnosing complex bugs, eliminating runtime regressions, and shipping production-grade features in minutes rather than hours. It replaces speculative trial-and-error with deterministic systems engineering.

---

## The 5-Phase Fast-Impl Loop

```text
1. Contract Bisection (30s)
   └── Isolate the exact architectural boundary where failure occurs.

2. Invariant Anatomy Match (45s)
   └── Match the symptom against the 6 Universal Failure Patterns.

3. Hypothesis Pinning (30s)
   └── Verify the root cause with a single targeted probe (zero guesswork).

4. Surgical Micro-Diff (45s)
   └── Execute minimal, high-impact edits (<= 15 lines) preserving adjacent state.

5. Headless Verification Loop (20s)
   └── Confirm zero regressions via compiler diagnostics or smoke tests.
```

---

## Phase 1: Contract Bisection (The 30-Second Scope Filter)

Never read or search an entire codebase indiscriminately. Isolate the contract boundary immediately:

| Architecture Layer | Where to Look First | What to Ignore |
| :--- | :--- | :--- |
| **Frontend UI / Components** | State-to-DOM boundary (store subscriptions, mount/unmount effects) | Pure visual styling, static layout shells, modal wrappers |
| **Fullstack / API Bridge** | Data transport boundary (fetch/IPC handler, request serializer/validator) | Database indexes, CSS styling, unrelated API endpoints |
| **Async / Engine Wrapper** | Imperative lifecycle boundary (start, destroy, event subscribers, queue managers) | Consumer UI controls, themes, settings panels |
| **Backend Service / DB** | Transaction and query boundary (connection pool, commit/rollback, schema constraint) | Routing tables, middleware boilerplate |

### Rapid File Isolation Commands
* **Windows PowerShell**:
  ```powershell
  Get-ChildItem -Recurse -File | Where-Object { $_.FullName -notmatch "node_modules|build|dist|\.git" -and $_.Extension -match "\.(ts|tsx|py|go|rs|cs|java)$" } | Select-String -Pattern "keyword" -List
  ```
* **POSIX (Bash / Zsh)**:
  ```bash
  git grep -l "keyword" -- ":(exclude)*lock*" ":(exclude)dist*" ":(exclude)build*"
  ```

---

## Phase 2: The 6 Universal Failure Patterns

Regardless of whether code is written in TypeScript, Python, Rust, Go, or C#, severe bugs and freezes almost always stem from one of these six patterns:

### Pattern 1: Lifecycle Inversion & Premature Reference Nulling
* **Symptom**: Uncaught exceptions (`TypeError: Cannot read properties of null`), thread panics, or white screens during teardown, tab switching, or component re-mounts.
* **Mechanism**: Setting host object pointers/refs to `null` before asynchronous worker queues or native background instances have finished their teardown loop.
* **Resolution**: Drain queues and complete asynchronous destruction *first*; set references to `null` strictly in a `finally` block or post-resolution step.

### Pattern 2: Domain Boundary Type Invariant Mismatch
* **Symptom**: Functions fail silently, return empty defaults, or reset coordinates to 0 / page 1.
* **Mechanism**: Supplying high-level composite tokens (e.g., custom CFI strings, URL fragments, UUID objects, encoded slugs) to lower-level routines expecting raw paths, numbers, or array indices.
* **Resolution**: Introduce explicit contract guards at the boundary. Validate input shapes before passing them downstream.

### Pattern 3: Lazy Instantiation Race Condition
* **Symptom**: Feature works on page refresh or after resizing the window, but fails on initial load.
* **Mechanism**: Mutating properties on child objects before the parent class emits its `ready`, `started`, or `connected` lifecycle event.
* **Resolution**: Hook the dedicated readiness event rather than assuming immediate availability after constructor invocation.

### Pattern 4: Reactive Cascades & Dependency Thrashing
* **Symptom**: Infinite re-rendering, UI stutter, duplicate events, or watchdog timer stalls.
* **Mechanism**: Placing continuous, high-frequency state coordinates (e.g., `scrollPosition`, `currentCfi`, `pointerX`, `elapsedSeconds`) inside reactive dependency arrays (`useEffect`, Vue `watch`, MobX `autorun`).
* **Resolution**: Prune volatile coordinates from reactive triggers. Drive updates through discrete event callbacks (`onScroll`, `relocated`, `onUpdate`).

### Pattern 5: Silent Fallback Swallowing & Masked Rejections
* **Symptom**: System behaves incorrectly without generating any error messages or stack traces.
* **Mechanism**: Empty `catch {}` blocks or aggressive default fallbacks (`|| defaultVal`) that hide underlying network, serialization, or syntax failures.
* **Resolution**: Log actionable error contexts or explicitly propagate exceptions up to the error boundary.

### Pattern 6: Stale Cache & Schema Drift
* **Symptom**: Works in clean environments or incognito tabs, but crashes for active users.
* **Mechanism**: IndexedDB, localStorage, Redis, or disk cache persists an outdated schema that fails validation against newer runtime assumptions.
* **Resolution**: Introduce schema versioning checks or automated invalidation when stored schemas diverge from runtime types.

---

## Phase 3: Surgical Micro-Patching Discipline

High-velocity engineering prioritizes surgical accuracy over sprawling refactors:
1. **Target the Invariant**: Locate the exact 2 to 15 lines where assumptions break.
2. **Zero Collateral Diff**: Never reformat, reorder imports, or refactor working adjacent methods within a bugfix.
3. **Defense-in-Depth Guards**: Add defensive type checks and null coalescing directly at the point of ingestion to prevent recurrence.

---

## Phase 4: Headless Verification Matrix

Never mark an implementation complete without running automated validation:

| Stack / Toolchain | Verification Command | Expected Output |
| :--- | :--- | :--- |
| **TypeScript / Node** | `npx tsc --noEmit` | Exit code 0, 0 diagnostic errors |
| **Rust** | `cargo check --quiet` | Clean exit, zero compilation failures |
| **Go** | `go vet ./...` | Clean exit |
| **Python** | `python -m mypy .` or targeted `pytest` | Zero type errors or failures |
| **Unit / Target Test** | Run the specific test suite matching the altered file | Passed test suite |

---

## Rapid Feature Construction Mode (Building Fast from Scratch)

When tasked with implementing a new feature rapidly:
1. **Contract First**: Write the TypeScript interface, Rust struct, or Python dataclass representing the data boundary before writing implementation logic.
2. **Consumer Wiring**: Hook the UI component or API caller to the interface stub.
3. **Core Transformation**: Implement the data pipeline between input and output.
4. **Compile & Smoke Test**: Run the project's static checker and perform a single verification pass.
