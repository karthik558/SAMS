import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

export function ModeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const root = window.document.documentElement;
    setIsDark(root.classList.contains("dark"));
  }, []);

  const toggleTheme = () => {
    const root = window.document.documentElement;
    const newDark = !isDark;
    setIsDark(newDark);
    
    if (newDark) {
      root.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
    
    // Trigger a custom event so ThemeInitializer can re-run if needed
    // or just let ThemeInitializer handle the class change if it observes it.
    // However, ThemeInitializer reads from localStorage on mount/update.
    // Let's manually trigger a re-render of styles if needed.
    // Actually, ThemeInitializer seems to run on mount. 
    // We might need to reload or force update.
    // But for now, simple class toggle is standard.
    
    // Dispatch storage event to sync across tabs or components listening
    window.dispatchEvent(new Event("storage"));
  };

  return (
    <Button variant="ghost" size="icon" onClick={toggleTheme} className="rounded-full">
      {isDark ? (
        <Moon className="h-5 w-5 transition-all" />
      ) : (
        <Sun className="h-5 w-5 transition-all" />
      )}
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
