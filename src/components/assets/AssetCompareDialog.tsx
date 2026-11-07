import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type AssetLike = Record<string, any>;

const FIELDS: Array<{ key: string; label: string }> = [
  { key: "id", label: "Asset ID" },
  { key: "name", label: "Name" },
  { key: "type", label: "Type" },
  { key: "property", label: "Property" },
  { key: "department", label: "Department" },
  { key: "quantity", label: "Quantity" },
  { key: "condition", label: "Condition" },
  { key: "status", label: "Status" },
  { key: "location", label: "Location" },
  { key: "serialNumber", label: "Serial number" },
  { key: "purchaseDate", label: "Purchase date" },
  { key: "expiryDate", label: "Expiry date" },
  { key: "description", label: "Description" },
];

function textOf(asset: AssetLike | undefined, key: string) {
  const value = asset?.[key];
  if (value == null || value === "") return "—";
  return String(value);
}

export function AssetCompareDialog({
  open,
  onOpenChange,
  left,
  right,
  propertyName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  left?: AssetLike;
  right?: AssetLike;
  propertyName?: (id: string) => string;
}) {
  const display = (asset: AssetLike | undefined, key: string) => {
    if (key === "property" && asset?.property && propertyName) return propertyName(String(asset.property));
    return textOf(asset, key);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Compare assets</DialogTitle>
          <DialogDescription>
            {left?.id || "Asset"} and {right?.id || "Asset"} from the current catalogue.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-auto rounded-lg border border-border/70">
          <div className="grid grid-cols-[140px_1fr_1fr] border-b border-border/70 bg-muted/40 text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
            <div className="px-3 py-2">Field</div>
            <div className="px-3 py-2">{left?.id || "Left"}</div>
            <div className="px-3 py-2">{right?.id || "Right"}</div>
          </div>
          {FIELDS.map((field) => {
            const a = display(left, field.key);
            const b = display(right, field.key);
            const differs = a !== b;
            return (
              <div key={field.key} className="grid grid-cols-[140px_1fr_1fr] border-b border-border/60 text-sm last:border-0">
                <div className="px-3 py-2 text-muted-foreground">{field.label}</div>
                <div className={differs ? "bg-primary/5 px-3 py-2" : "px-3 py-2"}>{a}</div>
                <div className={differs ? "bg-primary/5 px-3 py-2" : "px-3 py-2"}>{b}</div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
