import { useEffect, useState } from "react";

export function useTablePreferences(key: string) {
  // Initialize from localStorage synchronously to avoid race with defaults
  const [dense, setDense] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem(`table:${key}`);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      return typeof parsed?.dense === 'boolean' ? parsed.dense : false;
    } catch {
      return false;
    }
  });
  const [visibleCols, setVisibleCols] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(`table:${key}`);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed?.visibleCols) ? parsed.visibleCols : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(`table:${key}`, JSON.stringify({ dense, visibleCols }));
    } catch {}
  }, [key, dense, visibleCols]);

  return { dense, setDense, visibleCols, setVisibleCols } as const;
}
