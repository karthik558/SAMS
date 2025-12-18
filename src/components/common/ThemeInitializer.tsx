import { useEffect } from 'react';
import { ACCENT_COLORS, DARK_LEVELS } from '@/lib/theme-config';

export function ThemeInitializer() {
  useEffect(() => {
    const applyTheme = () => {
      const root = document.documentElement;
      const accentColor = localStorage.getItem('theme_accent') || 'orange';
      const darkLevel = localStorage.getItem('theme_dark_level') || 'standard';
      const isDark = root.classList.contains('dark');

      const accent = ACCENT_COLORS.find(c => c.id === accentColor) || ACCENT_COLORS[0];
      
      // Main accent colors
      root.style.setProperty('--primary', accent.value);
      root.style.setProperty('--primary-hover', accent.hover);
      root.style.setProperty('--ring', accent.value);
      
      // Sidebar accent colors
      root.style.setProperty('--sidebar-primary', accent.value);
      root.style.setProperty('--sidebar-ring', accent.value);
      
      if (!isDark) {
         root.style.setProperty('--sidebar-accent', accent.light);
         root.style.setProperty('--accent', accent.light);
         root.style.setProperty('--accent-foreground', accent.value);
      } else {
         root.style.removeProperty('--sidebar-accent');
         root.style.removeProperty('--accent');
         root.style.removeProperty('--accent-foreground');
      }

      const level = DARK_LEVELS.find(l => l.id === darkLevel) || DARK_LEVELS[0];
      
      let bgValue = '0 0% 100%';
      if (isDark) {
        bgValue = level.bg;
        root.style.setProperty('--background', level.bg);
        root.style.setProperty('--card', level.card);
        root.style.setProperty('--popover', level.card);
        root.style.setProperty('--sidebar-background', level.card);

        // Adjust dashboard card headers for dark mode depth
        // @ts-ignore
        const opacity = level.headerOpacity || 0.1;
        root.style.setProperty('--header-amc', `hsl(30 100% 50% / ${opacity})`);
        root.style.setProperty('--header-food', `hsl(150 100% 50% / ${opacity})`);
      } else {
        root.style.removeProperty('--background');
        root.style.removeProperty('--card');
        root.style.removeProperty('--popover');
        
        // Light mode sidebar background (tint of accent)
        if (accent.sidebar) {
          root.style.setProperty('--sidebar-background', accent.sidebar);
        } else {
          root.style.removeProperty('--sidebar-background');
        }
        
        // Light mode defaults
        root.style.setProperty('--header-amc', 'hsl(33 100% 96%)'); // orange-50
        root.style.setProperty('--header-food', 'hsl(150 100% 96%)'); // emerald-50
      }

      // Update theme-color meta tag to match background
      const metaThemeColor = document.querySelector('meta[name="theme-color"]');
      if (metaThemeColor) {
        metaThemeColor.setAttribute('content', `hsl(${bgValue})`);
      }
    };

    // Apply immediately
    applyTheme();

    // Observe class changes on html element to detect dark mode toggle
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          applyTheme();
        }
      });
    });

    observer.observe(document.documentElement, { attributes: true });

    return () => observer.disconnect();
  }, []);

  return null;
}
