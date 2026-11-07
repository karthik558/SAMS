import { useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WHATS_NEW } from "@/content/whatsNew";

const STORAGE_KEY = "sams_whats_new_dismissed";

export function WhatsNewPanel() {
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === WHATS_NEW[0]?.id; } catch { return false; }
  });
  const items = useMemo(() => WHATS_NEW.slice(0, 3), []);
  if (dismissed || items.length === 0) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" />
          What’s new
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            try { localStorage.setItem(STORAGE_KEY, items[0].id); } catch {}
            setDismissed(true);
          }}
        >
          Dismiss
        </Button>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-3">
        {items.map((item) => (
          <div key={item.id} className="rounded-lg border border-border/70 bg-muted/30 p-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{item.date}</p>
            <p className="mt-1 text-sm font-medium text-foreground">{item.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{item.body}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
