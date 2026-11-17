/**
 * Semply Ebook Reader - Official Landing Site Engine
 * Handles dynamic OS detection, GitHub Releases integration,
 * interactive hero reader theme switching, and accessible FAQ accordions.
 * Zero external dependencies.
 */

document.addEventListener('DOMContentLoaded', () => {
  const GITHUB_REPO = 'ederaefe/EPUB-Reader-Desktop';
  const FALLBACK_VERSION = 'v1.0.0';
  const RELEASES_PAGE_URL = `https://github.com/${GITHUB_REPO}/releases`;
  const LATEST_RELEASE_URL = `https://github.com/${GITHUB_REPO}/releases/latest`;

  // --------------------------------------------------------------------------
  // 1. Dynamic OS Detection
  // --------------------------------------------------------------------------
  function detectUserOS() {
    const userAgent = navigator.userAgent || '';
    const platform = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '';

    if (/Win/i.test(platform) || /Windows/i.test(userAgent)) {
      return 'windows';
    }
    if (/Mac/i.test(platform) || /Macintosh|Mac OS X/i.test(userAgent)) {
      return 'macos';
    }
    if (/Linux/i.test(platform) || /Linux|X11/i.test(userAgent)) {
      return 'linux';
    }
    return 'windows'; // Safe default
  }

  const currentOS = detectUserOS();

  // --------------------------------------------------------------------------
  // 2. GitHub Releases Live Connector with Graceful Fallback
  // --------------------------------------------------------------------------
  const primaryDownloadBtn = document.getElementById('primary-download-btn');
  const primaryDownloadLabel = document.getElementById('primary-download-label');
  const releaseTagEl = document.getElementById('release-tag');
  const releaseBadgeEl = document.getElementById('release-badge');
  const releaseDateEl = document.getElementById('release-date');
  const releaseSizeEl = document.getElementById('release-size');

  // Fallback download targets
  const fallbackUrls = {
    windows: `${LATEST_RELEASE_URL}/download/Semply-Setup.exe`,
    macos: `${LATEST_RELEASE_URL}/download/Semply.dmg`,
    linux: `${LATEST_RELEASE_URL}/download/Semply.AppImage`
  };

  // Validate release download URLs strictly against official GitHub release origins
  function isTrustedReleaseUrl(rawUrl) {
    if (typeof rawUrl !== 'string' || !rawUrl.trim()) return false;
    try {
      const parsed = new URL(rawUrl.trim());
      if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return false;
      const host = parsed.hostname.toLowerCase();
      if (host === 'github.com') {
        return parsed.pathname.toLowerCase().startsWith(`/${GITHUB_REPO.toLowerCase()}/releases/`);
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  function applyReleaseData(tag, assets, publishedAt) {
    const safeTag = typeof tag === 'string' ? tag.replace(/[^\w.-]/g, '').slice(0, 32) || FALLBACK_VERSION : FALLBACK_VERSION;
    if (releaseTagEl) releaseTagEl.textContent = safeTag;
    if (releaseBadgeEl) releaseBadgeEl.textContent = `${safeTag} Latest`;

    if (publishedAt && releaseDateEl) {
      try {
        const date = new Date(publishedAt);
        releaseDateEl.textContent = date.toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
      } catch (e) {
        releaseDateEl.textContent = 'Latest';
      }
    }

    let downloadUrl = LATEST_RELEASE_URL;
    let targetSize = null;

    if (Array.isArray(assets) && assets.length > 0) {
      let matchedAsset = null;
      const validAssets = assets.filter(a => a && typeof a.name === 'string' && isTrustedReleaseUrl(a.browser_download_url));
      if (currentOS === 'windows') {
        matchedAsset = validAssets.find(a => a.name.endsWith('.exe')) || validAssets[0];
      } else if (currentOS === 'macos') {
        matchedAsset = validAssets.find(a => a.name.endsWith('.dmg') || a.name.endsWith('.zip')) || validAssets[0];
      } else if (currentOS === 'linux') {
        matchedAsset = validAssets.find(a => a.name.endsWith('.AppImage') || a.name.endsWith('.deb')) || validAssets[0];
      }

      if (matchedAsset && isTrustedReleaseUrl(matchedAsset.browser_download_url)) {
        downloadUrl = matchedAsset.browser_download_url;
        if (typeof matchedAsset.size === 'number' && Number.isFinite(matchedAsset.size) && matchedAsset.size > 0) {
          targetSize = `${(matchedAsset.size / (1024 * 1024)).toFixed(1)} MB`;
        }
      } else {
        downloadUrl = fallbackUrls[currentOS] || LATEST_RELEASE_URL;
      }
    } else {
      downloadUrl = fallbackUrls[currentOS] || LATEST_RELEASE_URL;
    }

    if (primaryDownloadBtn && isTrustedReleaseUrl(downloadUrl)) {
      primaryDownloadBtn.href = downloadUrl;
    }

    if (primaryDownloadLabel) {
      if (currentOS === 'windows') {
        primaryDownloadLabel.textContent = `Download for Windows (${safeTag})`;
      } else if (currentOS === 'macos') {
        primaryDownloadLabel.textContent = `Download for macOS (${safeTag})`;
      } else if (currentOS === 'linux') {
        primaryDownloadLabel.textContent = `Download for Linux (${safeTag})`;
      } else {
        primaryDownloadLabel.textContent = `Download Semply (${safeTag})`;
      }
    }

    if (releaseSizeEl && targetSize) {
      releaseSizeEl.textContent = targetSize;
    }
  }

  // Initial immediate application of fallback so button is immediately clickable
  applyReleaseData(FALLBACK_VERSION, [], null);

  // Attempt to load cached release data from localStorage first
  try {
    const cached = localStorage.getItem('semply_latest_release');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && parsed.tag_name) {
        applyReleaseData(parsed.tag_name, parsed.assets, parsed.published_at);
      }
    }
  } catch (e) {
    // Ignore storage errors
  }

  // Query GitHub API asynchronously
  fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
    headers: { 'Accept': 'application/vnd.github.v3+json' },
    cache: 'no-cache'
  })
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then(data => {
      if (data && data.tag_name) {
        applyReleaseData(data.tag_name, data.assets || [], data.published_at);
        try {
          localStorage.setItem('semply_latest_release', JSON.stringify({
            tag_name: data.tag_name,
            assets: data.assets,
            published_at: data.published_at,
            cached_at: Date.now()
          }));
        } catch (e) {}
      }
    })
    .catch(() => {
      // Graceful fallback to verified direct links on rate limit or offline
      applyReleaseData(FALLBACK_VERSION, [], null);
    });

  // --------------------------------------------------------------------------
  // 3. Interactive Hero Reader Theme Switcher
  // --------------------------------------------------------------------------
  const themePills = document.querySelectorAll('.theme-pill-btn');
  const readerFrame = document.querySelector('.reader-frame');

  if (readerFrame && themePills.length > 0) {
    themePills.forEach(pill => {
      pill.addEventListener('click', () => {
        const targetTheme = pill.getAttribute('data-theme-target');
        if (!targetTheme) return;

        readerFrame.setAttribute('data-reader-theme', targetTheme);

        themePills.forEach(p => p.classList.remove('is-active'));
        pill.classList.add('is-active');
      });
    });
  }

  // --------------------------------------------------------------------------
  // 4. Accessible FAQ Accordions
  // --------------------------------------------------------------------------
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(item => {
    const btn = item.querySelector('.faq-question-btn');
    const panel = item.querySelector('.faq-answer-panel');
    if (!btn || !panel) return;

    btn.addEventListener('click', () => {
      const isOpen = item.classList.contains('is-open');

      // Close all other items for clean accordion UX
      faqItems.forEach(other => {
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
  // 5. Headroom Smart Header Auto-Hide / Pin
  // --------------------------------------------------------------------------
  const header = document.querySelector('.site-header');
  if (header) {
    let lastScrollY = window.pageYOffset || document.documentElement.scrollTop;
    const threshold = 12;

    window.addEventListener('scroll', () => {
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
    }, { passive: true });
  }

  // --------------------------------------------------------------------------
  // 6. Terminal Code Copy Button
  // --------------------------------------------------------------------------
  const copyBtn = document.getElementById('btn-copy-quickstart');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      const codeSnippet = [
        'git clone https://github.com/ederaefe/EPUB-Reader-Desktop.git',
        'cd EPUB-Reader-Desktop',
        'npm install',
        'npm run dev'
      ].join('\n');

      navigator.clipboard.writeText(codeSnippet).then(() => {
        const originalText = copyBtn.innerHTML;
        copyBtn.innerHTML = `
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          <span>Copied!</span>
        `;
        copyBtn.style.borderColor = 'var(--accent-emerald)';
        copyBtn.style.color = 'var(--accent-emerald)';

        setTimeout(() => {
          copyBtn.innerHTML = originalText;
          copyBtn.style.borderColor = '';
          copyBtn.style.color = '';
        }, 2200);
      }).catch(() => {
        // Fallback if clipboard permission is denied
      });
    });
  }
});
