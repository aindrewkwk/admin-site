// ── R Studio Admin — Language Toggle (EN/VI) ──────────────────────
// Add data-vi="..." to any element, then include this script.
// User's preference is saved in localStorage.

(function () {
  const STORAGE_KEY = 'rstudio-lang';

  function getLang() {
    return localStorage.getItem(STORAGE_KEY) || 'en';
  }

  function setLang(lang) {
    localStorage.setItem(STORAGE_KEY, lang);
    applyLang(lang);
  }

  function applyLang(lang) {
    document.querySelectorAll('[data-vi]').forEach(el => {
      if (lang === 'vi') {
        el.textContent = el.getAttribute('data-vi');
      } else {
        // Restore original English from the element's default text
        const en = el.getAttribute('data-en');
        if (en) el.textContent = en;
      }
    });

    // Update toggle button label
    const label = document.getElementById('langLabel');
    if (label) label.textContent = lang === 'vi' ? 'EN' : 'VI';

    // Update html lang attribute
    document.documentElement.lang = lang;
  }

  // Store original English text on first load
  function init() {
    document.querySelectorAll('[data-vi]').forEach(el => {
      if (!el.getAttribute('data-en')) {
        el.setAttribute('data-en', el.textContent);
      }
    });
    applyLang(getLang());
  }

  // Toggle handler
  window.toggleLang = function () {
    setLang(getLang() === 'vi' ? 'en' : 'vi');
  };

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
