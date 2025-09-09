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
      purchaseDate: asset.purchaseDate || "",
      expiryDate: asset.expiryDate || "",
      poNumber: asset.poNumber || "",
      condition: asset.condition || "",
      location: asset.location || "",
    });
    setNotes("");
  }, [asset]);

  const setField = (k: string, v: any) => setForm(s => ({ ...s, [k]: v }));

  const changes = useMemo(() => {
    if (!asset) return [] as Array<{ key: string; before: any; after: any }>;
    const patch: any = {};
    const keys: Array<keyof typeof form> = ["name","type","property","quantity","purchaseDate","expiryDate","poNumber","condition","location"];
    for (const k of keys) {
      const before = (asset as any)[k] ?? "";
      const after = (form as any)[k];
      const beforeStr = before == null ? "" : String(before);
      const afterStr = after == null ? "" : String(after);
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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Request Edit</DialogTitle>
        </DialogHeader>
        {asset ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                <Input type="date" value={form.purchaseDate?.slice(0,10) || ''} onChange={e => setField('purchaseDate', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Expiry Date</Label>
                <Input type="date" value={form.expiryDate?.slice(0,10) || ''} onChange={e => setField('expiryDate', e.target.value)} />
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
              <div className="space-y-2 md:col-span-2">
                <Label>Location</Label>
                <Input value={form.location} onChange={e => setField('location', e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Comments for Manager</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Add context for the approver" rows={3} />
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Changes Preview</div>
              <div className="rounded border bg-muted/30 p-2 text-sm max-h-48 overflow-auto">
                {changes.length ? changes.map(ch => (
                  <div key={ch.key} className="flex items-start justify-between gap-2 py-1">
                    <div className="font-medium min-w-[140px]">{ch.key}</div>
                    <div className="text-muted-foreground line-through break-all">{String(ch.before ?? "-")}</div>
                    <div className="break-all">{String(ch.after ?? "-")}</div>
                  </div>
                )) : <div className="text-muted-foreground">No changes yet</div>}
              </div>
            </div>
          </div>
        ) : null}
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => {
            if (!asset) return;
            // Build patch
            const patch: Record<string, any> = {};
            const keys = ["name","type","property","department","quantity","purchaseDate","expiryDate","poNumber","condition","location"] as const;
            let changed = 0;
            for (const k of keys) {
              const b = (asset as any)[k] ?? "";
              const a = (form as any)[k];
              if (String(b ?? "") !== String(a ?? "")) { patch[k] = a; changed++; }
            }
            onSubmitted({ patch, notes: notes.trim() || undefined });
          }}>Send for Approval</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
