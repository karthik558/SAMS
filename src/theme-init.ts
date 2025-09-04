// Initialize theme class before React mounts (CSP-safe)
try {
  const stored = localStorage.getItem('theme');
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const dark = stored ? stored === 'dark' : prefersDark;
  if (dark) document.documentElement.classList.add('dark');
  else document.documentElement.classList.remove('dark');
} catch {}
