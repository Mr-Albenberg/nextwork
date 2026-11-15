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

  const modes = ['light', 'dark', 'system'];
  const names = { light: 'Light', dark: 'Dark', system: 'System' };
  const icons = {
    light: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
    dark: '<path d="M20.9 13.3A9 9 0 0 1 10.7 3.1a9 9 0 1 0 10.2 10.2Z"/>',
    system: '<rect x="3" y="3" width="18" height="13" rx="2"/><path d="M8 21h8m-4-5v5"/>'
  };
  function apply() {
    const theme = preference === 'system' ? (system.matches ? 'dark' : 'light') : preference;
    document.documentElement.dataset.theme = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = theme === 'dark' ? '#0f1714' : '#28634d';
    document.querySelectorAll('.theme-control').forEach(button => {
      button.dataset.preference = preference;
      const next = modes[(modes.indexOf(preference) + 1) % modes.length];
      button.setAttribute('aria-label', `Theme: ${names[preference]}. Switch to ${names[next]}.`);
      button.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + icons[preference] + '</svg>';
    });
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
    document.addEventListener('click', event => {
      if (!event.target.closest('.theme-control')) return;
      preference = modes[(modes.indexOf(preference) + 1) % modes.length];
      try { localStorage.setItem(key, preference); } catch (_) { /* Keep the in-memory choice. */ }
      apply();
    });
  });
}());
