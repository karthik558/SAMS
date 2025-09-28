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
			// Safari fallback: older WebKit only supports addListener
			// @ts-expect-error: addListener exists on older MediaQueryList implementations
			mql.addListener?.(handler);
		}
	}
} catch {}

try { initNotificationSound(); } catch {}
const rootEl = document.getElementById("root")!;
createRoot(rootEl).render(<App />);

// Hide preloader once the current frame renders
try {
	const hide = () => {
		const el = document.getElementById('preloader');
		if (!el) return;
		el.classList.add('preloader-hide');
		// remove from DOM after transition to avoid tab order/click issues
		setTimeout(() => { try { el.parentElement?.removeChild(el); } catch {} }, 300);
	};
	// Use requestAnimationFrame to ensure DOM is ready and initial paint has occurred
	if (typeof requestAnimationFrame !== 'undefined') requestAnimationFrame(() => hide());
	else setTimeout(hide, 0);
} catch {}
