# Release, Container & OS Code-Signing Guide

This runbook explains how Semply Ebook Reader builds, signs, attests, and distributes official releases across Windows, macOS, Linux, and Docker (`ghcr.io`), and what external accounts/secrets eliminate OS security prompts completely.

---

## 1. Cutting a New Release

Every version tag matching `v*` triggers `.github/workflows/release.yml`, which:
1. Typechecks, compiles, and packages:
   - **Windows (x64):** NSIS Setup `.exe` and Portable `.exe`
   - **macOS (Apple Silicon `arm64` + Intel `x64`):** `.dmg` and `.zip`
   - **Linux (x64):** `.AppImage` and `.deb`
2. Verifies `mupdf-wasm.wasm` is unpacked into `app.asar.unpacked` on every platform.
3. Builds and pushes the self-hosted browser-streamed Docker container to `ghcr.io/ederaefe/semply-ebook-reader:<version>` and `:latest`.
4. Generates `SHA256SUMS.txt` and signs SLSA Build Provenance Attestations via Sigstore (`actions/attest-build-provenance@v2`).
5. Publishes the GitHub Release, which the landing website (`index.html` / `landing.js`) picks up automatically.

### Release Commands
```bash
# Update version in package.json (or keep 1.0.0 for initial release)
npm version 1.0.1 -m "release: v%s"
git push origin main --follow-tags
```

---

## 2. Removing Windows SmartScreen Warnings ("Windows protected your PC")

Unsigned Windows `.exe` files always trigger SmartScreen. Pick one of the three trusted options below:

### Option A: SignPath Foundation (Recommended — Free for MIT Open Source)
Because Semply is public and MIT-licensed, you qualify for **free** publicly-trusted code signing through [SignPath Foundation](https://signpath.org/):
1. Apply at `https://signpath.org/` linking `https://github.com/ederaefe/EPUB-Reader-Desktop` and this MIT `LICENSE`.
2. Create a Signing Policy in SignPath linked to the `ederaefe/EPUB-Reader-Desktop` GitHub Actions workflow.
3. Add the SignPath GitHub Action (`signpath/github-action-submit-signing-request`) right after `npm run package:win` in `.github/workflows/release.yml` so SignPath's HSM signs both `.exe` files before publishing.

### Option B: Azure Artifact Signing (Formerly Azure Trusted Signing, ~\$9.99/mo)
`electron-builder.config.cjs` already supports Azure Artifact Signing out of the box. Add these GitHub Repository Secrets (`Settings > Secrets and variables > Actions`):
- `AZURE_SIGN_ENDPOINT` (regional Trusted Signing endpoint URI)
- `AZURE_SIGN_ACCOUNT_NAME`
- `AZURE_SIGN_PROFILE_NAME`
- `AZURE_TENANT_ID`
- `AZURE_CLIENT_ID`
- `AZURE_CLIENT_SECRET`
- `WIN_PUBLISHER_NAME` (exact CN on the certificate)

### Option C: Commercial Authenticode Certificate (`.pfx` / Cloud HSM)
Add these GitHub Repository Secrets:
- `WIN_CSC_LINK` (Base64-encoded `.pfx`)
- `WIN_CSC_KEY_PASSWORD`
- `WIN_PUBLISHER_NAME`

### Accelerating SmartScreen Reputation
After publishing your first **signed** Windows installer, submit the `.exe` URL/file to [Microsoft Security Intelligence File Submission](https://www.microsoft.com/en-us/wdsi/filesubmission) (choose **Software developer** -> **Incorrectly detected / SmartScreen**) to accelerate reputation whitelisting.

---

## 3. Removing macOS Gatekeeper Warnings ("Developer cannot be verified")

Apple strictly requires a paid **Apple Developer Program** membership (\$99/year) for Developer ID signing and notarization. `electron-builder.config.cjs` and `build/entitlements.mac*.plist` are already wired — add these 5 GitHub Repository Secrets to enable automatic signing + notarization + stapling on every `macos-latest` build:

1. Export your **Developer ID Application** certificate from Keychain Access as a `.p12`, Base64-encode it (`base64 -i cert.p12`), and store it as:
   - `MAC_CSC_LINK`
   - `MAC_CSC_KEY_PASSWORD`
2. Create an App Store Connect API key (Users and Access -> Integrations -> App Store Connect API -> Developer role), download the `.p8` file, and store:
   - `APPLE_API_KEY` (full raw text contents of the `.p8` file)
   - `APPLE_API_KEY_ID`
   - `APPLE_API_ISSUER_ID`

The workflow automatically writes `APPLE_API_KEY` to a temporary `.p8` file, enables Hardened Runtime + notarization, and staples the ticket to both `arm64` and `x64` `.dmg` images.

---

## 4. GitHub Container Registry (GHCR) Package Visibility

The first time GitHub Actions pushes `ghcr.io/ederaefe/semply-ebook-reader`, GitHub may default the new package to **Private**. To let anyone run `docker pull ghcr.io/ederaefe/semply-ebook-reader:latest`:
1. Open `https://github.com/ederaefe?tab=packages` and select **`semply-ebook-reader`**.
2. Go to **Package settings** -> **Danger Zone** -> **Change visibility** -> **Public**.
3. Confirm the package is linked to `ederaefe/EPUB-Reader-Desktop`.
