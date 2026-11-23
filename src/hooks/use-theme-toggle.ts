import { useEffect, useState } from "react";

export function useThemeToggle() {
  const root = document.documentElement;
  const [isDark, setIsDark] = useState(() => root.classList.contains("dark"));

  useEffect(() => {
    const sync = () => setIsDark(root.classList.contains("dark"));
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributeFilter: ["class"] });
    sync();
    return () => observer.disconnect();
  }, [root]);

  const toggleTheme = () => {
    const next = !root.classList.contains("dark");
    try { localStorage.setItem("theme", next ? "dark" : "light"); } catch {}
    root.classList.toggle("dark", next);
    setIsDark(next);
  };

  return { isDark, toggleTheme };
}
