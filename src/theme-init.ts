import { ACCENT_COLORS, DARK_LEVELS } from './lib/theme-config';

// Initialize theme class before React mounts (CSP-safe)
try {
  const root = document.documentElement;
  
  // 1. Dark Mode
  const storedTheme = localStorage.getItem('theme');
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = storedTheme ? storedTheme === 'dark' : prefersDark;
  
  if (isDark) root.classList.add('dark');
  else root.classList.remove('dark');

  // 2. Accent Color
  const storedAccent = localStorage.getItem('theme_accent') || 'orange';
  const accent = ACCENT_COLORS.find(c => c.id === storedAccent) || ACCENT_COLORS[0];
  
  root.style.setProperty('--primary', accent.value);
  // We can set other accent vars here if needed for the preloader
  
  // 3. Dark Level (Background)
  let bgValue = '0 0% 100%';
  if (isDark) {
      const storedLevel = localStorage.getItem('theme_dark_level') || 'standard';
      const level = DARK_LEVELS.find(l => l.id === storedLevel) || DARK_LEVELS[0];
      bgValue = level.bg;
      root.style.setProperty('--background', level.bg);
  } else {
      // Light mode default background
      root.style.setProperty('--background', '0 0% 100%');
  }

  // Update theme-color meta tag to match background
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute('content', `hsl(${bgValue})`);
  }

} catch (e) {
  console.error("Theme init failed", e);
}
