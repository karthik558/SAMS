import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listProperties, type Property } from "@/services/properties";
import { listItemTypes } from "@/services/itemTypes";
import { listDepartments, type Department } from "@/services/departments";
import { listUserDepartmentAccess } from "@/services/userDeptAccess";
import { getAccessiblePropertyIdsForCurrentUser } from "@/services/userAccess";
import { isDemoMode } from "@/lib/demo";
import { type Asset } from "@/services/assets";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

type Props = {
  open: boolean;
  asset: Asset | null;
  onClose: () => void;
  onSubmitted: (result: { patch: Record<string, any>; notes?: string | null }) => void;
};

export default function RequestEditModal({ open, asset, onClose, onSubmitted }: Props) {
  const [propsList, setPropsList] = useState<Property[]>([]);
  const [itemTypes, setItemTypes] = useState<string[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [allowedDeptNames, setAllowedDeptNames] = useState<string[] | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [accessibleProps, setAccessibleProps] = useState<Set<string>>(new Set());
  const [form, setForm] = useState<Record<string, any>>({});
  const [notes, setNotes] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        const ps = await listProperties();
        setPropsList(ps);
      } catch {}
      try {
        const types = await listItemTypes();
        const list = types.map(t => t.name);
        const cur = (asset?.type || '').toString();
        setItemTypes(cur && !list.includes(cur) ? [...list, cur] : list);
      } catch {}
      try {
        const ds = await listDepartments();
        setDepartments(ds);
      } catch {}
      try {
        const raw = (isDemoMode() ? (sessionStorage.getItem('demo_auth_user') || localStorage.getItem('demo_auth_user')) : null) || localStorage.getItem('auth_user');
        const cu = raw ? JSON.parse(raw) : null;
        setCurrentUser(cu);
        if (cu?.id) {
          try { const list = await listUserDepartmentAccess(cu.id); setAllowedDeptNames(Array.isArray(list) ? list : []); }
          catch { setAllowedDeptNames([]); }
        } else {
          setAllowedDeptNames(null);
        }
      } catch {}
      try {
        const ids = await getAccessiblePropertyIdsForCurrentUser();
        setAccessibleProps(ids);
      } catch { setAccessibleProps(new Set()); }
    })();
  }, [asset?.type]);

  useEffect(() => {
    if (!asset) return;
    setForm({
      name: asset.name || "",
      type: asset.type || "",
      property: asset.property || "",
      department: (asset as any).department || "",
      quantity: asset.quantity ?? 1,
      // normalize to Date objects for Calendar
      purchaseDate: asset.purchaseDate ? new Date(asset.purchaseDate) : undefined,
      expiryDate: asset.expiryDate ? new Date(asset.expiryDate) : undefined,
      poNumber: asset.poNumber || "",
      condition: asset.condition || "",
      location: asset.location || "",
    });
    setNotes("");
  }, [asset]);

  const setField = (k: string, v: any) => setForm(s => ({ ...s, [k]: v }));

  // Helpers to normalize/pretty print date values
  const normalizeDateStr = (v: any): string => {
    if (!v) return "";
    if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0, 10);
    const s = String(v);
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const d = new Date(s);
    return isNaN(d.getTime()) ? s : d.toISOString().slice(0, 10);
  };
  const prettyVal = (v: any): string => {
    if (!v) return "-";
    if (v instanceof Date && !isNaN(v.getTime())) return format(v, "PPP");
    const s = String(v);
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
      const d = new Date(s);
      return isNaN(d.getTime()) ? s : format(d, "PPP");
    }
    return s;
  };

  const changes = useMemo(() => {
    if (!asset) return [] as Array<{ key: string; before: any; after: any }>;
    const patch: any = {};
    const keys: Array<keyof typeof form> = ["name","type","property","quantity","purchaseDate","expiryDate","poNumber","condition","location","department"];
    for (const k of keys) {
      const before = (asset as any)[k] ?? "";
      const after = (form as any)[k];
      const beforeStr = (k === "purchaseDate" || k === "expiryDate") ? normalizeDateStr(before) : (before == null ? "" : String(before));
      const afterStr = (k === "purchaseDate" || k === "expiryDate") ? normalizeDateStr(after) : (after == null ? "" : String(after));
      if (beforeStr !== afterStr) {
        patch[k] = after;
      }
    }
    return Object.keys(patch).map(k => ({ key: k, before: (asset as any)[k], after: (patch as any)[k] }));
  }, [asset, form]);

  // Restrict property list for non-admins (managers/users) if accessible set is available
  const visibleProperties: Property[] = useMemo(() => {
    const role = (currentUser?.role || '').toLowerCase();
    if (role === 'admin') return propsList;
    if (accessibleProps && accessibleProps.size) return propsList.filter(p => accessibleProps.has(String(p.id)));
    return propsList;
  }, [propsList, accessibleProps, currentUser]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
  <DialogContent className="w-[calc(100vw-1.5rem)] max-w-2xl sm:w-full grid grid-rows-[auto,1fr,auto] max-h-[90vh] p-0 rounded-2xl border border-border/60 bg-background/95 shadow-2xl">
        <DialogHeader className="space-y-1.5 border-b border-border/60 bg-muted/10 px-4 py-4 sm:px-6 sm:py-6">
          <DialogTitle>Request Edit</DialogTitle>
        </DialogHeader>
        {asset ? (
          <div className="space-y-4 overflow-y-auto px-4 sm:px-6 pb-4">
            <section className="space-y-3 rounded-2xl border border-border/60 bg-background/85 p-4 sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Asset Fields</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={form.name} onChange={e => setField('name', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={v => setField('type', v)}>
                  <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    {itemTypes.map(t => (<SelectItem key={t} value={t}>{t}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Property</Label>
                <Select value={form.property} onValueChange={v => setField('property', v)}>
                  <SelectTrigger><SelectValue placeholder="Select property" /></SelectTrigger>
                  <SelectContent>
                    {visibleProperties.map(p => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Department</Label>
                <Select value={form.department || ''} onValueChange={v => setField('department', v)}>
                  <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                  <SelectContent>
                    {(() => {
                      const role = (currentUser?.role || '').toLowerCase();
                      let list: Department[] = [];
                      if (role === 'admin') {
                        list = departments || [];
                      } else {
                        const effective = (allowedDeptNames && allowedDeptNames.length) ? allowedDeptNames : (currentUser?.department ? [currentUser.department] : []);
                        const set = new Set(effective.map((n: string) => n.toLowerCase()));
                        list = (departments || []).filter((d) => set.has((d.name || '').toLowerCase()));
                        const cur = (form.department || '').toString();
                        if (cur && !list.find(d => (d.name || '').toLowerCase() === cur.toLowerCase())) {
                          list = [{ id: 'cur', name: cur } as any, ...list];
                        }
                      }
                      return list.map(d => (<SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>));
                    })()}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Quantity</Label>
                <Input type="number" min={1} value={form.quantity} onChange={e => setField('quantity', Number(e.target.value || 0))} />
              </div>
              <div className="space-y-2">
                <Label>Purchase Date</Label>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !form.purchaseDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {form.purchaseDate ? format(form.purchaseDate as Date, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 max-h-[80vh] overflow-auto overscroll-contain">
                      <Calendar
                        mode="single"
                        selected={form.purchaseDate as Date | undefined}
                        onSelect={(date) => setField('purchaseDate', date)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  {form.purchaseDate && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="w-full sm:w-auto"
                      onClick={() => setField('purchaseDate', undefined)}
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Expiry Date</Label>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !form.expiryDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {form.expiryDate ? format(form.expiryDate as Date, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 max-h-[80vh] overflow-auto overscroll-contain">
                      <Calendar
                        mode="single"
                        selected={form.expiryDate as Date | undefined}
                        onSelect={(date) => setField('expiryDate', date)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  {form.expiryDate && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="w-full sm:w-auto"
                      onClick={() => setField('expiryDate', undefined)}
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label>PO Number</Label>
                <Input value={form.poNumber} onChange={e => setField('poNumber', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Condition</Label>
                <Select value={form.condition} onValueChange={v => setField('condition', v)}>
                  <SelectTrigger><SelectValue placeholder="Select condition" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="New">New</SelectItem>
                    <SelectItem value="Excellent">Excellent</SelectItem>
                    <SelectItem value="Good">Good</SelectItem>
                    <SelectItem value="Fair">Fair</SelectItem>
                    <SelectItem value="Poor">Poor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
                <div className="space-y-2 sm:col-span-2">
                <Label>Location</Label>
                <Input value={form.location} onChange={e => setField('location', e.target.value)} />
              </div>
              </div>
            </section>

            <section className="space-y-3 rounded-2xl border border-border/60 bg-background/85 p-4 sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Comments</p>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Add context for the approver" rows={4} />
            </section>

            <section className="space-y-3 rounded-2xl border border-border/60 bg-background/85 p-4 sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Changes Preview</p>
              <div className="rounded border bg-muted/30 p-2 text-sm max-h-48 overflow-auto">
                {changes.length ? changes.map(ch => (
                  <div key={ch.key} className="flex items-start justify-between gap-2 py-1">
                    <div className="font-medium min-w-[140px] capitalize">{ch.key}</div>
                    <div className="text-muted-foreground line-through break-all">{prettyVal(ch.before)}</div>
                    <div className="break-all">{prettyVal(ch.after)}</div>
                  </div>
                )) : <div className="text-muted-foreground">No changes yet</div>}
              </div>
            </section>
          </div>
        ) : null}
        <DialogFooter className="mt-0 px-4 py-3 sm:px-6 sm:py-4 border-t border-border/60 space-y-2 sm:space-y-0 sm:space-x-2">
          <Button className="w-full sm:w-auto" variant="outline" onClick={onClose}>Cancel</Button>
          <Button className="w-full sm:w-auto" onClick={() => {
            if (!asset) return;
            // Build patch
            const patch: Record<string, any> = {};
            const keys = ["name","type","property","department","quantity","purchaseDate","expiryDate","poNumber","condition","location"] as const;
            let changed = 0;
            for (const k of keys) {
              const b = (asset as any)[k] ?? "";
              let a = (form as any)[k];
              // Normalize dates to YYYY-MM-DD
              const bStr = (k === "purchaseDate" || k === "expiryDate") ? normalizeDateStr(b) : String(b ?? "");
              const aStr = (k === "purchaseDate" || k === "expiryDate") ? normalizeDateStr(a) : String(a ?? "");
              if (bStr !== aStr) {
                patch[k] = (k === "purchaseDate" || k === "expiryDate") ? aStr || null : a;
                changed++;
              }
            }
            onSubmitted({ patch, notes: notes.trim() || undefined });
          }}>Send for Approval</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
