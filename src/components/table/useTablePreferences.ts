import { useEffect, useState } from "react";

export function useTablePreferences(key: string) {
  const [dense, setDense] = useState(false);
  const [visibleCols, setVisibleCols] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`table:${key}`);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (typeof parsed?.dense === 'boolean') setDense(parsed.dense);
      if (Array.isArray(parsed?.visibleCols)) setVisibleCols(parsed.visibleCols);
    } catch {}
  }, [key]);

  useEffect(() => {
    try {
      localStorage.setItem(`table:${key}`, JSON.stringify({ dense, visibleCols }));
    } catch {}
  }, [key, dense, visibleCols]);

  return { dense, setDense, visibleCols, setVisibleCols } as const;
}
