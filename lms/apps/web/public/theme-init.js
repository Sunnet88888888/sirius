// Runs synchronously in <head>, before <body> paints, so the saved theme is
// applied without a flash of the wrong one. Same mechanism as dir-init.js.
// Storage key and values must match lib/theme.ts: 'light' | 'dark' | 'system'.
(function () {
  try {
    var mode = localStorage.getItem('sirius-theme') || 'light';
    var dark =
      mode === 'dark' ||
      (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    var root = document.documentElement;
    if (dark) root.classList.add('dark');
    root.style.colorScheme = dark ? 'dark' : 'light';
  } catch (e) {
    /* storage unavailable: stay on the light theme */
  }
})();
