import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { initNotificationSound } from '@/lib/sound'
import './index.css'

// Apply saved theme (or system preference) before React renders to avoid flash
try {
	const stored = localStorage.getItem('theme');
	const mql = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
	const prefersDark = !!mql && mql.matches;
	const useDark = stored ? stored === 'dark' : prefersDark;
	const root = document.documentElement;
	if (useDark) root.classList.add('dark'); else root.classList.remove('dark');
	// If no stored preference, follow system changes
	if (!stored && mql) {
		const handler = (e: MediaQueryListEvent) => {
			if (e.matches) root.classList.add('dark'); else root.classList.remove('dark');
		};
		try {
			mql.addEventListener('change', handler);
		} catch {
			// Safari
			// @ts-ignore
			mql.addListener?.(handler);
		}
	}
} catch {}

try { initNotificationSound(); } catch {}
createRoot(document.getElementById("root")!).render(<App />);
