# Security Policy

Semply Ebook Reader is committed to maintaining the highest standards of security and privacy for our users. We adhere to a "security-first" development philosophy, prioritizing supply chain integrity, local-first data privacy, and verifiable builds.

## Supported Versions

We provide security updates for the current stable release series. Older versions may not receive active maintenance, and we strongly encourage users to upgrade to the latest version to ensure access to the latest security improvements and features.

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

If you discover a security issue or a vulnerability in Semply Ebook Reader, we appreciate your help in responsibly disclosing it so we can address it as quickly as possible.

### How to Report

Please report security vulnerabilities directly to the maintainer at **efeoghene@proton.me**.

To help us investigate and reproduce the issue, please include the following in your report:
*   **Description**: A clear, concise summary of the vulnerability.
*   **Impact**: Potential impact of the vulnerability.
*   **Steps to Reproduce**: Detailed instructions on how to replicate the issue.
*   **Environment**: Information about your operating system and version of Semply Ebook Reader.

### Our Commitment

We treat all security reports with the highest priority. We aim to:
*   **Acknowledge** receipt of your report within 48 hours.
*   **Investigate** the report thoroughly.
*   **Remediate** validated vulnerabilities promptly, keeping you informed throughout the process.
*   **Credit** you in the release notes if your report is accepted and results in a fix.

---

## Security & Integrity Measures

### 1. Supply Chain Integrity
Every official binary release is compiled in a hardened GitHub Actions environment. We employ **SLSA (Supply-chain Levels for Software Artifacts) Build Provenance** to provide cryptographic proof that our binaries were built directly from our public source code, without tampering or unauthorized modification.

### 2. Binary Integrity (Checksums)
Each release includes a `SHA256SUMS.txt` file signed by our build process. You should verify the integrity of any downloaded binary:
- **Windows (PowerShell):**
  `Get-FileHash .\Semply-Ebook-Reader-*-win-x64-setup.exe -Algorithm SHA256`
- **macOS / Linux:**
  `sha256sum -c SHA256SUMS.txt --ignore-missing`

### 3. Application Security
The application itself is hardened with:
- **Chromium Sandbox Isolation:** Rendering and application logic are separated to mitigate exploits.
- **Strict Network Egress Seal:** The app blocks arbitrary internet access. Only verified dictionary services, Wikipedia, and font hosts are permitted, with a **Strict Offline Mode** available.
- **File Access Security:** All filesystem access is strictly bounded. The application cannot access sensitive system directories, credentials, or arbitrary files not explicitly authorized by you.
