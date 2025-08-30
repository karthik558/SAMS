import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Settings2 } from "lucide-react";

export type ColumnDef = { key: string; label: string; always?: boolean };

export default function ColumnChooser({
  columns,
  visible,
  onChange,
}: {
  columns: ColumnDef[];
  visible: string[];
  onChange: (next: string[]) => void;
}) {
  const setChecked = (k: string, checked: boolean) => {
    const base = new Set(visible);
    if (checked) base.add(k); else base.delete(k);
    onChange(Array.from(base));
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings2 className="h-4 w-4" /> Columns
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Visible columns</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {columns.map((c) => (
          <DropdownMenuCheckboxItem
            key={c.key}
            checked={c.always ? true : visible.includes(c.key)}
            disabled={!!c.always}
            onCheckedChange={(v) => setChecked(c.key, !!v)}
            className="capitalize"
          >
            {c.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
