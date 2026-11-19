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
  // 1. Dynamic OS Detection & In-Page Platform Switching
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

  let activeOS = detectUserOS();
  let activeReleaseData = {
    tag: FALLBACK_VERSION,
    assets: [],
    publishedAt: null
  };

  // --------------------------------------------------------------------------
  // 2. GitHub Releases Live Connector with Graceful Fallback
  // --------------------------------------------------------------------------
  const primaryDownloadBtn = document.getElementById('primary-download-btn');
  const primaryDownloadLabel = document.getElementById('primary-download-label');
  const primaryDownloadIconBox = document.getElementById('primary-download-icon-box');
  const releaseTagEl = document.getElementById('release-tag');
  const releaseBadgeEl = document.getElementById('release-badge');
  const releaseDateEl = document.getElementById('release-date');
  const releaseSizeEl = document.getElementById('release-size');

  const OS_ICONS = {
    windows: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 12V6.75L10.5 5.5V12H3ZM3 13.5H10.5V20L3 18.75V13.5ZM12 5.25L21 3.75V12H12V5.25ZM12 13.5H21V21.75L12 20.25V13.5Z"/></svg>`,
    macos: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.63-.76 1.05-1.82.93-2.88-.91.04-2.02.61-2.67 1.37-.58.67-1.09 1.75-.95 2.79 1.02.08 2.06-.52 2.69-1.28z"/></svg>`,
    linux: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.001 2c-2.41 0-4.001 1.87-4.001 4.168 0 .86.23 1.68.64 2.39-1.63 1.11-2.64 2.94-2.64 4.942 0 1.37.52 2.65 1.4 3.63-.44.75-1.1 1.44-1.92 1.95-.3.19-.24.65.11.75 1.77.5 3.32-.07 4.41-.95.63.18 1.3.28 2 .28s1.37-.1 2-.28c1.09.88 2.64 1.45 4.41.95.35-.1.41-.56.11-.75-.82-.51-1.48-1.2-1.92-1.95.88-.98 1.4-2.26 1.4-3.63 0-2.002-1.01-3.832-2.64-4.942.41-.71.64-1.53.64-2.39 0-2.298-1.591-4.168-4.001-4.168z"/></svg>`
  };

  // Fallback download targets
  const fallbackUrls = {
    windows: `${LATEST_RELEASE_URL}/download/Semply-Setup.exe`,
    macos: `${LATEST_RELEASE_URL}/download/Semply.dmg`,
    linux: `${LATEST_RELEASE_URL}/download/Semply.AppImage`
  };

  function updatePlatformPillsUI(os) {
    const pills = document.querySelectorAll('.platform-pill[data-os]');
    pills.forEach(pill => {
      const pillOS = pill.getAttribute('data-os');
      if (pillOS === os) {
        pill.classList.add('active');
        pill.setAttribute('aria-pressed', 'true');
      } else {
        pill.classList.remove('active');
        pill.setAttribute('aria-pressed', 'false');
      }
    });
  }

  function applyReleaseData(tag, assets, publishedAt) {
    activeReleaseData = { tag, assets, publishedAt };

    if (releaseTagEl) releaseTagEl.textContent = tag;
    if (releaseBadgeEl) releaseBadgeEl.textContent = `${tag} Latest`;

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
      if (activeOS === 'windows') {
        matchedAsset = assets.find(a => a.name.endsWith('.exe')) || assets[0];
      } else if (activeOS === 'macos') {
        matchedAsset = assets.find(a => a.name.endsWith('.dmg') || a.name.endsWith('.zip')) || assets[0];
      } else if (activeOS === 'linux') {
        matchedAsset = assets.find(a => a.name.endsWith('.AppImage') || a.name.endsWith('.deb')) || assets[0];
      }

      if (matchedAsset) {
        downloadUrl = matchedAsset.browser_download_url;
        if (matchedAsset.size) {
          targetSize = `${(matchedAsset.size / (1024 * 1024)).toFixed(1)} MB`;
        }
      }
    } else {
      downloadUrl = fallbackUrls[activeOS] || LATEST_RELEASE_URL;
    }

    if (primaryDownloadBtn) {
      primaryDownloadBtn.href = downloadUrl;
    }

    if (primaryDownloadIconBox && OS_ICONS[activeOS]) {
      primaryDownloadIconBox.innerHTML = OS_ICONS[activeOS];
    }

    if (primaryDownloadLabel) {
      if (activeOS === 'windows') {
        primaryDownloadLabel.textContent = `Download for Windows (${tag})`;
      } else if (activeOS === 'macos') {
        primaryDownloadLabel.textContent = `Download for macOS (${tag})`;
      } else if (activeOS === 'linux') {
        primaryDownloadLabel.textContent = `Download for Linux (${tag})`;
      } else {
        primaryDownloadLabel.textContent = `Download Semply (${tag})`;
      }
    }

    if (releaseSizeEl && targetSize) {
      releaseSizeEl.textContent = targetSize;
    }
  }

  function setPlatform(newOS) {
    activeOS = newOS;
    updatePlatformPillsUI(activeOS);
    applyReleaseData(activeReleaseData.tag, activeReleaseData.assets, activeReleaseData.publishedAt);
  }

  // Wire platform switcher pills so clicking switches OS in-place without navigating away
  const platformPills = document.querySelectorAll('.platform-pill[data-os]');
  platformPills.forEach(pill => {
    pill.addEventListener('click', (e) => {
      e.preventDefault();
      const targetOS = pill.getAttribute('data-os');
      if (targetOS) {
        setPlatform(targetOS);
      }
    });
  });

  // Highlight initial detected OS
  updatePlatformPillsUI(activeOS);

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
  // 3. Interactive Hero Reader Engine (Theme, Font Size, Layout, Footnote Peek)
  // --------------------------------------------------------------------------
  const themePills = document.querySelectorAll('.theme-pill-btn');
  const readerFrame = document.querySelector('.reader-frame');

  // Theme Switching
  if (readerFrame && themePills.length > 0) {
    themePills.forEach(pill => {
      pill.addEventListener('click', () => {
        const targetTheme = pill.getAttribute('data-theme-target');
        if (!targetTheme) return;

        readerFrame.setAttribute('data-reader-theme', targetTheme);

        themePills.forEach(p => {
          p.classList.remove('is-active');
          p.setAttribute('aria-checked', 'false');
        });
        pill.classList.add('is-active');
        pill.setAttribute('aria-checked', 'true');
      });
    });
  }

  // Font Size Stepping (Small -> Medium -> Large)
  const fontSizes = ['small', 'medium', 'large'];
  let currentFontIndex = 1; // Default: 'medium'

  const fontDecBtn = document.getElementById('mockup-font-dec');
  const fontIncBtn = document.getElementById('mockup-font-inc');
  const fontSizeLabel = document.getElementById('mockup-font-label');

  function updateFontSize() {
    if (!readerFrame) return;
    const size = fontSizes[currentFontIndex];
    readerFrame.setAttribute('data-font-size', size);
    if (fontSizeLabel) {
      fontSizeLabel.textContent = size === 'small' ? '16px' : size === 'medium' ? '18px' : '22px';
    }
  }

  if (fontDecBtn) {
    fontDecBtn.addEventListener('click', () => {
      if (currentFontIndex > 0) {
        currentFontIndex--;
        updateFontSize();
      }
    });
  }

  if (fontIncBtn) {
    fontIncBtn.addEventListener('click', () => {
      if (currentFontIndex < fontSizes.length - 1) {
        currentFontIndex++;
        updateFontSize();
      }
    });
  }

  // Layout Toggling (Single Page vs Spread)
  const layoutBtns = document.querySelectorAll('.mockup-layout-btn');
  if (readerFrame && layoutBtns.length > 0) {
    layoutBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetLayout = btn.getAttribute('data-layout-target');
        if (!targetLayout) return;

        readerFrame.setAttribute('data-layout', targetLayout);
        layoutBtns.forEach(b => {
          b.classList.remove('is-active');
          b.setAttribute('aria-checked', 'false');
        });
        btn.classList.add('is-active');
        btn.setAttribute('aria-checked', 'true');
      });
    });
  }

  // In-Place Footnote Peek Demo Toggle
  const fnRef = document.querySelector('.mockup-fn-ref');
  const fnCard = document.querySelector('.mockup-footnote-card');
  if (fnRef && fnCard) {
    fnRef.addEventListener('click', () => {
      const isVisible = fnCard.style.display !== 'none';
      fnCard.style.display = isVisible ? 'none' : 'block';
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
