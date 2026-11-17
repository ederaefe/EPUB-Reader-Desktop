/**
 * Semply Ebook Reader - Official Landing Site Engine
 * Handles dynamic OS/architecture detection, GitHub Releases live hydration,
 * Release Colophon platform tabs, integrity verification commands,
 * interactive hero reader theme switching, and accessible FAQ accordions.
 * Zero external dependencies.
 */

document.addEventListener('DOMContentLoaded', () => {
  const GITHUB_REPO = 'ederaefe/EPUB-Reader-Desktop';
  const FALLBACK_VERSION = 'v1.0.0';
  const LATEST_RELEASE_URL = `https://github.com/${GITHUB_REPO}/releases/latest`;

  // --------------------------------------------------------------------------
  // 1. Dynamic OS & Architecture Detection
  // --------------------------------------------------------------------------
  function detectUserOS() {
    const userAgent = navigator.userAgent || '';
    const platform =
      (navigator.userAgentData && navigator.userAgentData.platform) ||
      navigator.platform ||
      '';

    if (/Win/i.test(platform) || /Windows/i.test(userAgent)) return 'windows';
    if (/Mac/i.test(platform) || /Macintosh|Mac OS X/i.test(userAgent)) return 'macos';
    if (/Linux/i.test(platform) || /Linux|X11/i.test(userAgent)) return 'linux';
    return 'windows';
  }

  let currentOS = detectUserOS();
  let preferredMacArch = 'arm64'; // Default Apple Silicon on modern macOS

  if (
    currentOS === 'macos' &&
    navigator.userAgentData &&
    typeof navigator.userAgentData.getHighEntropyValues === 'function'
  ) {
    navigator.userAgentData
      .getHighEntropyValues(['architecture'])
      .then((ua) => {
        if (ua && ua.architecture === 'x86') {
          preferredMacArch = 'x64';
          applyReleaseData(lastTag, lastAssets, lastPublishedAt);
        }
      })
      .catch(() => {});
  }

  // --------------------------------------------------------------------------
  // 2. Release Colophon Platform Tabs & Integrity Verification Switcher
  // --------------------------------------------------------------------------
  const platformTabs = document.querySelectorAll('[data-platform-tab]');
  const platformPanels = document.querySelectorAll('[data-platform-panel]');

  function activatePlatformTab(platform) {
    const valid = ['windows', 'macos', 'linux', 'docker'].includes(platform)
      ? platform
      : 'windows';

    platformTabs.forEach((tab) => {
      const isMatch = tab.getAttribute('data-platform-tab') === valid;
      tab.classList.toggle('is-active', isMatch);
      tab.setAttribute('aria-selected', String(isMatch));
    });

    platformPanels.forEach((panel) => {
      const isMatch = panel.getAttribute('data-platform-panel') === valid;
      panel.classList.toggle('is-active', isMatch);
      panel.hidden = !isMatch;
    });
  }

  platformTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const target = tab.getAttribute('data-platform-tab');
      if (target) activatePlatformTab(target);
    });
  });

  // Hero "Other platforms" links smoothly jump to #downloads and open the requested tab
  document.querySelectorAll('[data-select-platform]').forEach((link) => {
    link.addEventListener('click', () => {
      const target = link.getAttribute('data-select-platform');
      if (target) activatePlatformTab(target);
    });
  });

  activatePlatformTab(currentOS);

  // Integrity Verification shell tabs
  const verifyTabs = document.querySelectorAll('[data-verify-tab]');
  const verifyCmdOutput = document.getElementById('verify-cmd-output');
  let activeVerifyShell = currentOS === 'windows' ? 'win' : 'unix';

  function getSampleFilename(tag) {
    const ver = (tag || FALLBACK_VERSION).replace(/^v/i, '');
    if (currentOS === 'macos') {
      return `Semply-Ebook-Reader-${ver}-mac-${preferredMacArch}.dmg`;
    }
    if (currentOS === 'linux') {
      return `Semply-Ebook-Reader-${ver}-linux-x64.AppImage`;
    }
    return `Semply-Ebook-Reader-${ver}-win-x64-setup.exe`;
  }

  function renderVerifyCommand(tag) {
    if (!verifyCmdOutput) return;
    const sampleFile = getSampleFilename(tag);

    if (activeVerifyShell === 'win') {
      verifyCmdOutput.textContent = `Get-FileHash .\\${sampleFile} -Algorithm SHA256`;
    } else if (activeVerifyShell === 'unix') {
      verifyCmdOutput.textContent = `sha256sum -c SHA256SUMS.txt --ignore-missing`;
    } else {
      verifyCmdOutput.textContent = `gh attestation verify ${sampleFile} --owner ederaefe`;
    }
  }

  function activateVerifyTab(shell) {
    activeVerifyShell = shell;
    verifyTabs.forEach((tab) => {
      const isMatch = tab.getAttribute('data-verify-tab') === shell;
      tab.classList.toggle('is-active', isMatch);
      tab.setAttribute('aria-selected', String(isMatch));
    });
    renderVerifyCommand(lastTag);
  }

  verifyTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const target = tab.getAttribute('data-verify-tab');
      if (target) activateVerifyTab(target);
    });
  });

  // --------------------------------------------------------------------------
  // 3. GitHub Releases Live Connector with Deterministic Fallbacks
  // --------------------------------------------------------------------------
  const primaryDownloadBtn = document.getElementById('primary-download-btn');
  const primaryDownloadLabel = document.getElementById('primary-download-label');
  const releaseTagEl = document.getElementById('release-tag');
  const releaseBadgeEl = document.getElementById('release-badge');
  const releaseDateEl = document.getElementById('release-date');
  const releaseSizeEl = document.getElementById('release-size');
  const ledgerVersionEl = document.getElementById('ledger-version');
  const footerVersionEl = document.getElementById('footer-version');
  const dockerRunCmdEl = document.getElementById('docker-run-cmd');

  let lastTag = FALLBACK_VERSION;
  let lastAssets = [];
  let lastPublishedAt = null;

  function formatBytes(bytes) {
    if (!bytes || !Number.isFinite(bytes)) return '—';
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function updateAssetRow(linkId, nameId, sizeId, asset, fallbackName) {
    const linkEl = document.getElementById(linkId);
    const nameEl = document.getElementById(nameId);
    const sizeEl = document.getElementById(sizeId);

    const filename = asset ? asset.name : fallbackName;
    const href = asset
      ? asset.browser_download_url
      : `${LATEST_RELEASE_URL}/download/${encodeURIComponent(fallbackName)}`;

    if (linkEl) linkEl.href = href;
    if (nameEl) nameEl.textContent = filename;
    if (sizeEl) sizeEl.textContent = asset && asset.size ? formatBytes(asset.size) : '—';
  }

  function applyReleaseData(tag, assets, publishedAt) {
    lastTag = tag || FALLBACK_VERSION;
    lastAssets = Array.isArray(assets) ? assets : [];
    lastPublishedAt = publishedAt || null;

    const ver = lastTag.replace(/^v/i, '');

    if (releaseTagEl) releaseTagEl.textContent = lastTag;
    if (releaseBadgeEl) releaseBadgeEl.textContent = `${lastTag} Latest`;
    if (ledgerVersionEl) ledgerVersionEl.textContent = lastTag;
    if (footerVersionEl) footerVersionEl.textContent = lastTag;

    if (publishedAt && releaseDateEl) {
      try {
        const date = new Date(publishedAt);
        releaseDateEl.textContent = date.toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
      } catch {
        releaseDateEl.textContent = 'Latest';
      }
    }

    const findAsset = (predicate) => lastAssets.find((a) => a && typeof a.name === 'string' && predicate(a.name));

    const winSetup = findAsset((n) => /-win-.*setup\.exe$/i.test(n)) || findAsset((n) => /\.exe$/i.test(n) && !/portable/i.test(n));
    const winPortable = findAsset((n) => /-win-.*portable\.exe$/i.test(n)) || findAsset((n) => /portable.*\.exe$/i.test(n));
    const macArm64 = findAsset((n) => /mac-arm64\.dmg$/i.test(n)) || findAsset((n) => /arm64.*\.dmg$/i.test(n));
    const macX64 = findAsset((n) => /mac-x64\.dmg$/i.test(n)) || findAsset((n) => /x64.*\.dmg$/i.test(n));
    const macArm64Zip = findAsset((n) => /mac-arm64\.zip$/i.test(n)) || findAsset((n) => /arm64.*\.zip$/i.test(n));
    const linuxAppImage = findAsset((n) => /\.AppImage$/i.test(n));
    const linuxDeb = findAsset((n) => /\.deb$/i.test(n));
    const linuxRpm = findAsset((n) => /\.rpm$/i.test(n));
    const checksums = findAsset((n) => /^SHA256SUMS\.txt$/i.test(n));

    updateAssetRow('dl-win-setup', 'name-win-setup', 'size-win-setup', winSetup, `Semply-Ebook-Reader-${ver}-win-x64-setup.exe`);
    updateAssetRow('dl-win-portable', 'name-win-portable', 'size-win-portable', winPortable, `Semply-Ebook-Reader-${ver}-win-x64-portable.exe`);
    updateAssetRow('dl-mac-arm64', 'name-mac-arm64', 'size-mac-arm64', macArm64, `Semply-Ebook-Reader-${ver}-mac-arm64.dmg`);
    updateAssetRow('dl-mac-x64', 'name-mac-x64', 'size-mac-x64', macX64, `Semply-Ebook-Reader-${ver}-mac-x64.dmg`);
    updateAssetRow('dl-mac-arm64-zip', 'name-mac-arm64-zip', 'size-mac-arm64-zip', macArm64Zip, `Semply-Ebook-Reader-${ver}-mac-arm64.zip`);
    updateAssetRow('dl-linux-appimage', 'name-linux-appimage', 'size-linux-appimage', linuxAppImage, `Semply-Ebook-Reader-${ver}-linux-x64.AppImage`);
    updateAssetRow('dl-linux-deb', 'name-linux-deb', 'size-linux-deb', linuxDeb, `Semply-Ebook-Reader-${ver}-linux-x64.deb`);
    updateAssetRow('dl-linux-rpm', 'name-linux-rpm', 'size-linux-rpm', linuxRpm, `Semply-Ebook-Reader-${ver}-linux-x64.rpm`);

    const checksumLink = document.getElementById('dl-checksums');
    if (checksumLink) {
      checksumLink.href = checksums
        ? checksums.browser_download_url
        : `${LATEST_RELEASE_URL}/download/SHA256SUMS.txt`;
    }

    if (dockerRunCmdEl) {
      dockerRunCmdEl.textContent = [
        'docker run -d \\',
        '  --name semply-ebook-reader \\',
        '  --shm-size=1gb \\',
        '  -p 3001:3001 \\',
        '  -v ./semply-config:/config \\',
        '  -v ./books:/books \\',
        `  ghcr.io/ederaefe/semply-ebook-reader:${ver}`
      ].join('\n');
    }

    // Primary hero CTA match
    let primaryAsset = null;
    let fallbackPrimaryFile = `Semply-Ebook-Reader-${ver}-win-x64-setup.exe`;

    if (currentOS === 'windows') {
      primaryAsset = winSetup || winPortable;
      fallbackPrimaryFile = `Semply-Ebook-Reader-${ver}-win-x64-setup.exe`;
    } else if (currentOS === 'macos') {
      primaryAsset = preferredMacArch === 'x64' ? (macX64 || macArm64) : (macArm64 || macX64);
      fallbackPrimaryFile = `Semply-Ebook-Reader-${ver}-mac-${preferredMacArch}.dmg`;
    } else if (currentOS === 'linux') {
      primaryAsset = linuxAppImage || linuxDeb || linuxRpm;
      fallbackPrimaryFile = `Semply-Ebook-Reader-${ver}-linux-x64.AppImage`;
    }

    const downloadUrl = primaryAsset
      ? primaryAsset.browser_download_url
      : `${LATEST_RELEASE_URL}/download/${encodeURIComponent(fallbackPrimaryFile)}`;

    if (primaryDownloadBtn) {
      primaryDownloadBtn.href = downloadUrl;
    }

    if (primaryDownloadLabel) {
      if (currentOS === 'windows') {
        primaryDownloadLabel.textContent = `Download for Windows (${lastTag})`;
      } else if (currentOS === 'macos') {
        const archLabel = preferredMacArch === 'x64' ? 'Intel' : 'Apple Silicon';
        primaryDownloadLabel.textContent = `Download for macOS ${archLabel} (${lastTag})`;
      } else if (currentOS === 'linux') {
        primaryDownloadLabel.textContent = `Download for Linux (${lastTag})`;
      } else {
        primaryDownloadLabel.textContent = `Download Semply (${lastTag})`;
      }
    }

    if (releaseSizeEl && primaryAsset && primaryAsset.size) {
      releaseSizeEl.textContent = formatBytes(primaryAsset.size);
    }

    renderVerifyCommand(lastTag);
  }

  // Initial immediate application of fallback so every link is clickable immediately
  activateVerifyTab(activeVerifyShell);
  applyReleaseData(FALLBACK_VERSION, [], null);

  // Hydrate from localStorage cache while fresh GitHub API request resolves
  try {
    const cached = localStorage.getItem('semply_latest_release');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && parsed.tag_name) {
        applyReleaseData(parsed.tag_name, parsed.assets, parsed.published_at);
      }
    }
  } catch {
    // Ignore storage errors
  }

  // Query GitHub Releases API asynchronously
  fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
    headers: { Accept: 'application/vnd.github.v3+json' },
    cache: 'no-cache'
  })
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then((data) => {
      if (data && data.tag_name) {
        applyReleaseData(data.tag_name, data.assets || [], data.published_at);
        try {
          localStorage.setItem(
            'semply_latest_release',
            JSON.stringify({
              tag_name: data.tag_name,
              assets: data.assets,
              published_at: data.published_at,
              cached_at: Date.now()
            })
          );
        } catch {
          // Ignore quota errors
        }
      }
    })
    .catch(() => {
      // Keep deterministic release links active on rate limit or offline
    });

  // --------------------------------------------------------------------------
  // 4. Interactive Hero Reader Theme Switcher
  // --------------------------------------------------------------------------
  const themePills = document.querySelectorAll('.theme-pill-btn');
  const readerFrame = document.querySelector('.reader-frame');

  if (readerFrame && themePills.length > 0) {
    themePills.forEach((pill) => {
      pill.addEventListener('click', () => {
        const targetTheme = pill.getAttribute('data-theme-target');
        if (!targetTheme) return;

        readerFrame.setAttribute('data-reader-theme', targetTheme);

        themePills.forEach((p) => {
          p.classList.remove('is-active');
          p.setAttribute('aria-checked', 'false');
        });
        pill.classList.add('is-active');
        pill.setAttribute('aria-checked', 'true');
      });
    });
  }

  // --------------------------------------------------------------------------
  // 5. Accessible FAQ Accordions
  // --------------------------------------------------------------------------
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach((item) => {
    const btn = item.querySelector('.faq-question-btn');
    const panel = item.querySelector('.faq-answer-panel');
    if (!btn || !panel) return;

    btn.addEventListener('click', () => {
      const isOpen = item.classList.contains('is-open');

      faqItems.forEach((other) => {
        if (other !== item && other.classList.contains('is-open')) {
          other.classList.remove('is-open');
          const otherBtn = other.querySelector('.faq-question-btn');
          const otherPanel = other.querySelector('.faq-answer-panel');
          if (otherBtn) otherBtn.setAttribute('aria-expanded', 'false');
          if (otherPanel) otherPanel.style.maxHeight = '0px';
        }
      });

      if (isOpen) {
        item.classList.remove('is-open');
        btn.setAttribute('aria-expanded', 'false');
        panel.style.maxHeight = '0px';
      } else {
        item.classList.add('is-open');
        btn.setAttribute('aria-expanded', 'true');
        panel.style.maxHeight = `${panel.scrollHeight + 20}px`;
      }
    });
  });

  // --------------------------------------------------------------------------
  // 6. Headroom Smart Header Auto-Hide / Pin
  // --------------------------------------------------------------------------
  const header = document.querySelector('.site-header');
  if (header) {
    let lastScrollY = window.pageYOffset || document.documentElement.scrollTop;
    const threshold = 12;

    window.addEventListener(
      'scroll',
      () => {
        const currentScrollY = window.pageYOffset || document.documentElement.scrollTop;

        if (currentScrollY <= 80) {
          header.classList.remove('is-hidden');
          lastScrollY = currentScrollY;
          return;
        }

        if (Math.abs(currentScrollY - lastScrollY) < threshold) return;

        if (currentScrollY > lastScrollY && currentScrollY > 120) {
          header.classList.add('is-hidden');
        } else {
          header.classList.remove('is-hidden');
        }

        lastScrollY = currentScrollY;
      },
      { passive: true }
    );
  }

  // --------------------------------------------------------------------------
  // 7. Copy-to-Clipboard Controls (Quickstart, Docker & Integrity Commands)
  // --------------------------------------------------------------------------
  function attachCopyFeedback(btn, getText) {
    btn.addEventListener('click', () => {
      const text = getText();
      if (!text) return;

      navigator.clipboard
        .writeText(text)
        .then(() => {
          const originalHtml = btn.innerHTML;
          btn.innerHTML = '<span>Copied</span>';
          btn.style.borderColor = 'var(--accent-emerald)';
          btn.style.color = 'var(--accent-emerald)';

          setTimeout(() => {
            btn.innerHTML = originalHtml;
            btn.style.borderColor = '';
            btn.style.color = '';
          }, 2000);
        })
        .catch(() => {});
    });
  }

  const quickstartCopyBtn = document.getElementById('btn-copy-quickstart');
  if (quickstartCopyBtn) {
    attachCopyFeedback(quickstartCopyBtn, () =>
      [
        'git clone https://github.com/ederaefe/EPUB-Reader-Desktop.git',
        'cd EPUB-Reader-Desktop',
        'npm install',
        'npm run dev'
      ].join('\n')
    );
  }

  document.querySelectorAll('[data-copy-target]').forEach((btn) => {
    const targetId = btn.getAttribute('data-copy-target');
    if (!targetId) return;
    attachCopyFeedback(btn, () => {
      const el = document.getElementById(targetId);
      return el ? el.textContent.trim() : '';
    });
  });
});
