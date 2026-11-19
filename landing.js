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

  function applyReleaseData(tag, assets, publishedAt) {
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
      if (currentOS === 'windows') {
        matchedAsset = assets.find(a => a.name.endsWith('.exe')) || assets[0];
      } else if (currentOS === 'macos') {
        matchedAsset = assets.find(a => a.name.endsWith('.dmg') || a.name.endsWith('.zip')) || assets[0];
      } else if (currentOS === 'linux') {
        matchedAsset = assets.find(a => a.name.endsWith('.AppImage') || a.name.endsWith('.deb')) || assets[0];
      }

      if (matchedAsset) {
        downloadUrl = matchedAsset.browser_download_url;
        if (matchedAsset.size) {
          targetSize = `${(matchedAsset.size / (1024 * 1024)).toFixed(1)} MB`;
        }
      }
    } else {
      downloadUrl = fallbackUrls[currentOS] || LATEST_RELEASE_URL;
    }

    if (primaryDownloadBtn) {
      primaryDownloadBtn.href = downloadUrl;
    }

    if (primaryDownloadLabel) {
      if (currentOS === 'windows') {
        primaryDownloadLabel.textContent = `Download for Windows (${tag})`;
      } else if (currentOS === 'macos') {
        primaryDownloadLabel.textContent = `Download for macOS (${tag})`;
      } else if (currentOS === 'linux') {
        primaryDownloadLabel.textContent = `Download for Linux (${tag})`;
      } else {
        primaryDownloadLabel.textContent = `Download Semply (${tag})`;
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
