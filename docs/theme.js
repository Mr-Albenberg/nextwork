/* Apply before styles load to avoid flashing the wrong theme. */
(function () {
  'use strict';
  const key = 'nextwork-theme';
  const valid = value => ['light', 'dark', 'system'].includes(value);
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  let preference = 'system';
  try {
    const saved = localStorage.getItem(key);
    if (valid(saved)) preference = saved;
  } catch (_) { /* Theme switching also works when storage is unavailable. */ }

  function apply() {
    const theme = preference === 'system' ? (system.matches ? 'dark' : 'light') : preference;
    document.documentElement.dataset.theme = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = theme === 'dark' ? '#101625' : '#1d3be0';
    document.querySelectorAll('.theme-control select').forEach(selector => { selector.value = preference; });
  }
  apply();
  system.addEventListener('change', apply);
  window.addEventListener('storage', event => {
    if (event.key !== key && event.key !== null) return;
    preference = valid(event.newValue) ? event.newValue : 'system';
    apply();
  });
  document.addEventListener('DOMContentLoaded', () => {
    apply();
    document.addEventListener('change', event => {
      if (!event.target.matches('.theme-control select')) return;
      preference = valid(event.target.value) ? event.target.value : 'system';
      try { localStorage.setItem(key, preference); } catch (_) { /* Keep the in-memory choice. */ }
      apply();
    });
  });
}());
