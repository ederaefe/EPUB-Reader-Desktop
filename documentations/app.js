/* Semply Ebook Reader User Documentation — Progressive Enhancement Script
 * All content lives statically in index.html for instant browser and AI access.
 * This script layers live theme switching, Ctrl+K instant search, the interactive
 * Auto-Scroll Pace Calculator, mobile drawer controls, scroll-spy, and copy toasts.
 */

(function () {
  const THEME_KEY = 'semply_docs_theme_v1';
  const VALID_THEMES = ['obsidian', 'light', 'paper', 'dusk'];

  const htmlEl = document.documentElement;
  const toastEl = document.getElementById('docs-toast');
  let toastTimer = null;

  function showToast(message) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.add('visible');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.classList.remove('visible');
    }, 2400);
  }

  /* ------------------------------------------------------------------------
   * 1. Live 4-Theme Switcher (Obsidian / Light / Paper / Dusk)
   * ------------------------------------------------------------------------ */
  function applyTheme(theme) {
    const safeTheme = VALID_THEMES.includes(theme) ? theme : 'obsidian';
    htmlEl.setAttribute('data-theme', safeTheme);
    try {
      localStorage.setItem(THEME_KEY, safeTheme);
    } catch (_) {}

    document.querySelectorAll('[data-set-theme]').forEach((btn) => {
      const isMatch = btn.getAttribute('data-set-theme') === safeTheme;
      btn.setAttribute('aria-pressed', String(isMatch));
    });
  }

  let savedTheme = 'obsidian';
  try {
    savedTheme = localStorage.getItem(THEME_KEY) || 'obsidian';
  } catch (_) {}
  applyTheme(savedTheme);

  document.querySelectorAll('[data-set-theme]').forEach((btn) => {
    btn.addEventListener('click', () => {
      applyTheme(btn.getAttribute('data-set-theme') || 'obsidian');
    });
  });

  /* ------------------------------------------------------------------------
   * 2. Mobile Navigation Drawer
   * ------------------------------------------------------------------------ */
  const menuBtn = document.getElementById('mobile-menu-btn');
  const sidebar = document.getElementById('docs-sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');

  function setDrawerOpen(open) {
    if (!sidebar || !backdrop || !menuBtn) return;
    sidebar.classList.toggle('open', open);
    backdrop.classList.toggle('open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
  }

  if (menuBtn && sidebar && backdrop) {
    menuBtn.addEventListener('click', () => {
      setDrawerOpen(!sidebar.classList.contains('open'));
    });
    backdrop.addEventListener('click', () => setDrawerOpen(false));
    sidebar.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => setDrawerOpen(false));
    });
  }

  /* ------------------------------------------------------------------------
   * 3. Copy Section Link Buttons & Email Copy
   * ------------------------------------------------------------------------ */
  document.querySelectorAll('.copy-anchor').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const targetId = btn.getAttribute('data-copy-id');
      if (!targetId) return;
      const url = new URL(window.location.href);
      url.hash = targetId;
      try {
        await navigator.clipboard.writeText(url.toString());
        showToast('Section link copied to clipboard');
      } catch (_) {
        window.location.hash = targetId;
        showToast('Jumped to section');
      }
    });
  });

  const copyEmailBtn = document.getElementById('copy-support-email-btn');
  if (copyEmailBtn) {
    copyEmailBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText('efeoghene@proton.me');
        showToast('Developer email copied to clipboard');
      } catch (_) {
        showToast('efeoghene@proton.me');
      }
    });
  }

  /* ------------------------------------------------------------------------
   * 4. Interactive Auto-Scroll Pace Calculator
   * Mirrors Semply's exact AdaptiveScrollEngine formula:
   * - Fixed Timer: fixedSec
   * - Smart Pace: clamp(round(baseSec * max(20, visibleWords) / 180), 3, 600)
   * ------------------------------------------------------------------------ */
  const modeFixedBtn = document.getElementById('pace-mode-fixed');
  const modeSmartBtn = document.getElementById('pace-mode-smart');
  const baseSlider = document.getElementById('pace-base-slider');
  const wordsSlider = document.getElementById('pace-words-slider');
  const baseOut = document.getElementById('pace-base-out');
  const wordsOut = document.getElementById('pace-words-out');
  const wordsWrap = document.getElementById('pace-words-wrap');
  const resultOut = document.getElementById('pace-result-out');
  const captionOut = document.getElementById('pace-result-caption');

  let paceMode = 'smart';

  function updatePaceLab() {
    if (!baseSlider || !wordsSlider || !resultOut || !captionOut) return;
    const baseSec = Number(baseSlider.value) || 25;
    const words = Number(wordsSlider.value) || 180;

    if (baseOut) baseOut.textContent = baseSec + 's';
    if (wordsOut) wordsOut.textContent = words + ' words';
    if (wordsWrap) wordsWrap.style.opacity = paceMode === 'smart' ? '1' : '0.45';
    wordsSlider.disabled = paceMode !== 'smart';

    if (paceMode === 'fixed') {
      resultOut.textContent = baseSec + 's per page';
      captionOut.textContent = 'Fixed Timer turns the page every ' + baseSec + ' seconds regardless of word count.';
    } else {
      const effectiveWords = Math.max(20, words);
      const computedSec = Math.max(3, Math.min(600, Math.round(baseSec * (effectiveWords / 180))));
      const equivWpm = Math.round((180 / baseSec) * 60);
      resultOut.textContent = computedSec + 's on this spread';
      captionOut.textContent =
        'Smart Pace scales ' + baseSec + 's (~' + equivWpm + ' WPM baseline) to ' + words + ' visible words.';
    }
  }

  if (modeFixedBtn && modeSmartBtn) {
    modeFixedBtn.addEventListener('click', () => {
      paceMode = 'fixed';
      modeFixedBtn.setAttribute('aria-pressed', 'true');
      modeSmartBtn.setAttribute('aria-pressed', 'false');
      updatePaceLab();
    });
    modeSmartBtn.addEventListener('click', () => {
      paceMode = 'smart';
      modeSmartBtn.setAttribute('aria-pressed', 'true');
      modeFixedBtn.setAttribute('aria-pressed', 'false');
      updatePaceLab();
    });
  }
  if (baseSlider) baseSlider.addEventListener('input', updatePaceLab);
  if (wordsSlider) wordsSlider.addEventListener('input', updatePaceLab);
  updatePaceLab();

  /* ------------------------------------------------------------------------
   * 5. Instant Client Search Modal (Ctrl+K or /)
   * ------------------------------------------------------------------------ */
  const searchBackdrop = document.getElementById('search-modal-backdrop');
  const searchInput = document.getElementById('docs-search-input');
  const searchResultsEl = document.getElementById('docs-search-results');
  const searchOpenBtn = document.getElementById('open-search-btn');

  const searchIndex = Array.from(document.querySelectorAll('.doc-section')).map((sec) => {
    const id = sec.getAttribute('id') || '';
    const heading = sec.querySelector('h2')?.textContent?.trim() || id;
    const text = (sec.textContent || '').replace(/\s+/g, ' ').trim();
    const firstPara = sec.querySelector('p')?.textContent?.trim() || text.slice(0, 140);
    return { id, heading, text: text.toLowerCase(), snippet: firstPara };
  });

  let activeResultIndex = 0;

  function renderSearchResults(query) {
    if (!searchResultsEl) return;
    const q = query.trim().toLowerCase();
    const matches = q
      ? searchIndex.filter((item) => item.heading.toLowerCase().includes(q) || item.text.includes(q))
      : searchIndex;

    activeResultIndex = 0;
    searchResultsEl.innerHTML = '';

    if (matches.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'search-empty';
      empty.textContent = 'No matching sections for "' + query.trim() + '".';
      searchResultsEl.appendChild(empty);
      return;
    }

    matches.forEach((item, idx) => {
      const a = document.createElement('a');
      a.href = '#' + item.id;
      a.className = 'search-result-item' + (idx === 0 ? ' active' : '');
      a.setAttribute('data-result-index', String(idx));

      const title = document.createElement('span');
      title.className = 'search-result-title';
      title.textContent = item.heading;

      const snip = document.createElement('span');
      snip.className = 'search-result-snippet';
      snip.textContent = item.snippet;

      a.appendChild(title);
      a.appendChild(snip);
      a.addEventListener('click', () => closeSearch());
      searchResultsEl.appendChild(a);
    });
  }

  function openSearch() {
    if (!searchBackdrop || !searchInput) return;
    searchBackdrop.classList.add('open');
    searchBackdrop.setAttribute('aria-hidden', 'false');
    searchInput.value = '';
    renderSearchResults('');
    requestAnimationFrame(() => searchInput.focus());
  }

  function closeSearch() {
    if (!searchBackdrop) return;
    searchBackdrop.classList.remove('open');
    searchBackdrop.setAttribute('aria-hidden', 'true');
  }

  if (searchOpenBtn) searchOpenBtn.addEventListener('click', openSearch);
  if (searchBackdrop) {
    searchBackdrop.addEventListener('click', (e) => {
      if (e.target === searchBackdrop) closeSearch();
    });
  }
  if (searchInput) {
    searchInput.addEventListener('input', () => renderSearchResults(searchInput.value));
    searchInput.addEventListener('keydown', (e) => {
      const items = Array.from(searchResultsEl?.querySelectorAll('.search-result-item') || []);
      if (e.key === 'ArrowDown' && items.length > 0) {
        e.preventDefault();
        activeResultIndex = (activeResultIndex + 1) % items.length;
        items.forEach((el, i) => el.classList.toggle('active', i === activeResultIndex));
        items[activeResultIndex].scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'ArrowUp' && items.length > 0) {
        e.preventDefault();
        activeResultIndex = (activeResultIndex - 1 + items.length) % items.length;
        items.forEach((el, i) => el.classList.toggle('active', i === activeResultIndex));
        items[activeResultIndex].scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter' && items[activeResultIndex]) {
        e.preventDefault();
        items[activeResultIndex].click();
      }
    });
  }

  window.addEventListener('keydown', (e) => {
    const tag = (e.target && e.target.tagName) || '';
    const inInput = tag === 'INPUT' || tag === 'TEXTAREA';

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (searchBackdrop?.classList.contains('open')) closeSearch();
      else openSearch();
    } else if (e.key === '/' && !inInput && !searchBackdrop?.classList.contains('open')) {
      e.preventDefault();
      openSearch();
    } else if (e.key === 'Escape') {
      closeSearch();
      setDrawerOpen(false);
    }
  });

  /* ------------------------------------------------------------------------
   * 6. Scroll-Spy for Left Navigation & Right "On This Page" Rail
   * ------------------------------------------------------------------------ */
  const sections = Array.from(document.querySelectorAll('.doc-section[id]'));
  const navLinks = Array.from(document.querySelectorAll('.nav-link[href^="#"], .toc-rail a[href^="#"]'));

  if ('IntersectionObserver' in window && sections.length > 0) {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          const id = visible[0].target.getAttribute('id');
          navLinks.forEach((link) => {
            link.classList.toggle('active', link.getAttribute('href') === '#' + id);
          });
        }
      },
      { rootMargin: '-80px 0px -65% 0px', threshold: 0.01 }
    );
    sections.forEach((sec) => observer.observe(sec));
  }
})();
