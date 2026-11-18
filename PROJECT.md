# Project: EPUB Reader Desktop Application
# Scope: Project-wide

## Architecture
- Electron-based application (TypeScript/React).
- Services for EPUB/PDF handling, UI, persistence.
- CI/CD release automation configured for Windows, macOS, Linux via electron-builder/electron-vite.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Create EPUB reader platform | Implement/Maintain reader platform | M1 | Survey |
| 2 | Revert website dark theme | Revert website theme to legacy blue-gray | M2 | Survey |
| 3 | Cross-platform downloads | Verify executables for Windows/macOS/Linux | M3 | Survey |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Reader Platform | Maintain existing platform | none | DONE |
| 2 | Revert Theme | Revert to legacy theme | M1 | DONE |
| 3 | Distribution | Verify multi-platform builds | M2 | DONE |

## Interface Contracts
### Website ↔ Backend
- Communication: RESTful API for theme synchronization.
- Authentication: Secure token-based auth for user settings.
- Error Handling: Standardized JSON response format for API errors.

## Code Layout
- Web: `.github/workflows/release.yml`, theme configs in `dev-documentations.md`
- App: Electron-based structures (`main`, `renderer`, `preload`, `shared`)
