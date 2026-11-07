import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export type FilterChip = {
  id: string;
  label: string;
  onRemove: () => void;
};

export function FilterChips({ chips, onClear }: { chips: FilterChip[]; onClear: () => void }) {
  if (!chips.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <button
          key={chip.id}
          type="button"
          onClick={chip.onRemove}
          className="inline-flex max-w-full items-center gap-1 rounded-md border border-border/70 bg-muted/40 px-2 py-1 text-xs text-foreground hover:bg-muted"
        >
          <span className="truncate">{chip.label}</span>
          <X className="h-3 w-3 shrink-0 text-muted-foreground" />
          <span className="sr-only">Remove {chip.label}</span>
        </button>
      ))}
      <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onClear}>
        Clear filters
      </Button>
    </div>
  );
}
