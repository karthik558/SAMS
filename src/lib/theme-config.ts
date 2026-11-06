export const ACCENT_COLORS = [
  { id: 'orange', label: 'Terracotta (Default)', dark: '16.36 51.89% 58.43%', value: '16.36 51.89% 58.43%', hover: '16 52% 52%', light: '16 42% 88%', sidebar: '16 45% 94%' },
  { id: 'blue', label: 'Ocean Blue', dark: '221 85% 75%', value: '221 83% 53%', hover: '221 83% 60%', light: '221 83% 92%', sidebar: '221 83% 96%' },
  { id: 'green', label: 'Emerald', dark: '142 60% 65%', value: '142 71% 45%', hover: '142 71% 50%', light: '142 71% 92%', sidebar: '142 71% 96%' },
  { id: 'violet', label: 'Royal Violet', dark: '262 85% 78%', value: '262 83% 58%', hover: '262 83% 65%', light: '262 83% 92%', sidebar: '262 83% 96%' },
  { id: 'rose', label: 'Rose Red', dark: '346 80% 75%', value: '346 87% 43%', hover: '346 87% 50%', light: '346 87% 92%', sidebar: '346 87% 96%' },
];

export const DARK_LEVELS = [
  { id: 'standard', label: 'Standard Dark', bg: '60 3% 15%', card: '60 3% 13%', headerOpacity: 0.1 },
  { id: 'deep', label: 'Deep Night', bg: '240 10% 3.9%', card: '240 10% 6%', headerOpacity: 0.12 },
  { id: 'oled', label: 'OLED Black', bg: '0 0% 0%', card: '0 0% 5%', headerOpacity: 0.15 },
  { id: 'midnight', label: 'Midnight Blue', bg: '222 47% 11%', card: '217 33% 17%', headerOpacity: 0.15 },
  { id: 'forest', label: 'Forest Night', bg: '150 20% 8%', card: '150 15% 12%', headerOpacity: 0.15 },
  { id: 'obsidian', label: 'Obsidian', bg: '240 5% 8%', card: '240 4% 12%', headerOpacity: 0.12 },
];

// Keep initial paint, saved preferences, and live appearance changes consistent.
export function applyAccentTheme(root: HTMLElement, accent: typeof ACCENT_COLORS[number], isDark: boolean) {
  const primary = isDark ? accent.dark : accent.value;
  const foreground = isDark || accent.id === 'orange' ? '220 20% 12%' : '0 0% 100%';
  root.style.setProperty('--primary', primary);
  root.style.setProperty('--primary-hover', !isDark && accent.id === 'orange' ? '16 48% 36%' : isDark ? accent.dark : accent.hover);
  root.style.setProperty('--primary-action', !isDark && accent.id === 'orange' ? '16 48% 43%' : primary);
  root.style.setProperty('--primary-action-foreground', isDark ? foreground : '0 0% 100%');
  root.style.setProperty('--primary-foreground', foreground);
  root.style.setProperty('--ring', primary);
  root.style.setProperty('--sidebar-primary', primary);
  root.style.setProperty('--sidebar-primary-foreground', foreground);
  root.style.setProperty('--sidebar-ring', primary);
  for (const key of ['--sidebar-accent', '--accent', '--accent-foreground']) {
    if (isDark) root.style.removeProperty(key);
    else root.style.setProperty(key, key === '--accent-foreground' ? accent.value : accent.light);
  }
  if (!isDark) root.style.setProperty('--sidebar-background', accent.sidebar);
}
