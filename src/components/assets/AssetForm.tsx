import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Package, Save, ClipboardList, MapPin, Info } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { hasSupabaseEnv } from "@/lib/supabaseClient";
import { listProperties, type Property } from "@/services/properties";
import { getAccessiblePropertyIdsForCurrentUser } from '@/services/userAccess';
import { getLicenseSnapshot, type LicenseSnapshot } from '@/services/license';
import { listItemTypes, createItemType, deleteItemType } from "@/services/itemTypes";
import { listDepartments, type Department } from "@/services/departments";
import { listUserDepartmentAccess } from "@/services/userDeptAccess";
import { isDemoMode } from "@/lib/demo";

interface AssetFormProps {
  onSubmit?: (data: any) => boolean | void | Promise<boolean | void>;
  initialData?: any;
}

export function AssetForm({ onSubmit, initialData }: AssetFormProps) {
  const [formData, setFormData] = useState({
    itemName: initialData?.itemName || "",
    description: initialData?.description || "",
    purchaseDate: initialData?.purchaseDate || undefined,
    quantity: initialData?.quantity || "",
    itemType: initialData?.itemType || "",
    expiryDate: initialData?.expiryDate || undefined,
    poNumber: initialData?.poNumber || "",
    property: initialData?.property || "",
    condition: initialData?.condition || "",
    serialNumber: initialData?.serialNumber || "",
  location: initialData?.location || "",
  });
  const [properties, setProperties] = useState<Property[]>([]);
  const [itemTypes, setItemTypes] = useState<string[]>([]);
  const [newType, setNewType] = useState<string>("");
  const [departments, setDepartments] = useState<Department[]>([]);
  const [allowedDeptNames, setAllowedDeptNames] = useState<string[] | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [licenseSnap, setLicenseSnap] = useState<LicenseSnapshot | null>(null);
  const [licenseLoading, setLicenseLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        // Properties from Supabase (or fallback handled in page state)
        if (hasSupabaseEnv) {
          let props = await listProperties();
          // Filter by access for non-admin users
          try {
            const raw = (isDemoMode() ? (sessionStorage.getItem('demo_auth_user') || localStorage.getItem('demo_auth_user')) : null) || localStorage.getItem('auth_user');
            const cu = raw ? JSON.parse(raw) : null;
            const role = (cu?.role || '').toLowerCase();
            if (role !== 'admin') {
              const access = await getAccessiblePropertyIdsForCurrentUser();
              const accessIds = new Set(Array.from(access).map(String));
              const filtered = props.filter(p => accessIds.has(String(p.id)));
              // If editing and initialData property not in filtered, include it for visibility only
              if (initialData?.property && !filtered.find(p => p.id === initialData.property)) {
                const keep = props.find(p => p.id === initialData.property);
                if (keep) filtered.unshift(keep);
              }
              props = filtered;
            }
          } catch {}
          setProperties(props);
        } else {
          // fallback to common names when no Supabase
          setProperties([
            { id: "PROP-001", name: "Main Office", type: "Office", status: "Active", address: "", manager: "" } as any,
            { id: "PROP-002", name: "Warehouse", type: "Storage", status: "Active", address: "", manager: "" } as any,
            { id: "PROP-003", name: "Branch Office", type: "Office", status: "Active", address: "", manager: "" } as any,
            { id: "PROP-004", name: "Factory", type: "Manufacturing", status: "Active", address: "", manager: "" } as any,
          ]);
        }
      } catch (e) {
        console.error(e);
      }
      try {
        const types = await listItemTypes();
  const list = types.map(t => t.name);
  // Include current item's type if missing so it shows up in edit mode
  const cur = (initialData?.itemType || '').toString();
  setItemTypes(cur && !list.includes(cur) ? [...list, cur] : list);
      } catch (e) {
        console.error(e);
      }
  try {
        const list = await listDepartments();
        setDepartments(list);
      } catch (e) {
        console.error(e);
      }
      try {
        const raw = (isDemoMode() ? (sessionStorage.getItem('demo_auth_user') || localStorage.getItem('demo_auth_user')) : null) || localStorage.getItem('auth_user');
        const cu = raw ? JSON.parse(raw) : null;
        setCurrentUser(cu);
        // Load allowed departments for current user (self), when backend present
        if (hasSupabaseEnv && cu?.id) {
          try {
            const depts = await listUserDepartmentAccess(cu.id);
            setAllowedDeptNames(Array.isArray(depts) ? depts : []);
          } catch {
            setAllowedDeptNames([]);
          }
        } else {
          setAllowedDeptNames(null);
        }
      } catch {}
    })();
  }, []);

  // Auto-select effective department for non-admins when there's a single choice
  useEffect(() => {
    const role = (currentUser?.role || '').toLowerCase();
    const allowed = (allowedDeptNames && allowedDeptNames.length) ? allowedDeptNames : (currentUser?.department ? [currentUser.department] : []);
    if (role !== 'admin') {
      if (allowed.length === 1 && !(formData as any).department) {
        setFormData((prev) => ({ ...prev, department: allowed[0] } as any));
      }
      if (allowed.length > 1 && (formData as any).department && !allowed.map(d => d.toLowerCase()).includes(String((formData as any).department).toLowerCase())) {
        // Clear prefilled department if it isn't in allowed list
        setFormData((prev) => ({ ...prev, department: '' } as any));
      }
    }
  }, [currentUser, allowedDeptNames]);

  // Fetch license snapshot when property changes
  useEffect(() => {
    (async () => {
      const pid = formData.property;
      if (!pid) { setLicenseSnap(null); return; }
      try {
        setLicenseLoading(true);
        const snap = await getLicenseSnapshot(pid);
        setLicenseSnap(snap);
      } catch {
        setLicenseSnap(null);
      } finally {
        setLicenseLoading(false);
      }
    })();
  }, [formData.property]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
  const role = (currentUser?.role || '').toLowerCase();
  // For non-admins, if itemType not provided (hidden), default to "Other"
  const toSubmit = { ...formData, itemType: (role === 'admin' ? formData.itemType : (formData.itemType || 'Other')) };

    // Basic validation
  const deptVal = (toSubmit as any).department?.toString().trim();
  const locVal = (toSubmit as any).location?.toString().trim();
  const condVal = (toSubmit as any).condition?.toString().trim();
  if (!toSubmit.itemName || !toSubmit.quantity || (role === 'admin' && !toSubmit.itemType) || !toSubmit.property || !deptVal || !locVal || !condVal) {
      toast.error("Please fill in all required fields");
      return;
    }

    // Generic enforcement: if user is not admin and has allowed departments, selected department must be in that list
  const selectedDept = (toSubmit as any).department || currentUser?.department || '';
    const effectiveAllowed = (allowedDeptNames && allowedDeptNames.length) ? allowedDeptNames : (currentUser?.department ? [currentUser.department] : []);
    const allowed = new Set(effectiveAllowed.map((d: string) => String(d).toLowerCase()));
    if (role !== 'admin' && allowed.size > 0) {
      if (!selectedDept || !allowed.has(String(selectedDept).toLowerCase())) {
        toast.error("You are not allowed to create assets for this department");
        return;
      }
    }

    try {
      const result = await onSubmit?.(toSubmit);
      if (result === true) {
        toast.success("Asset saved successfully!");
        if (!initialData) {
          setFormData({
            itemName: "",
            description: "",
            purchaseDate: undefined,
            quantity: "",
            itemType: "",
            expiryDate: undefined,
            poNumber: "",
            property: "",
            condition: "",
            serialNumber: "",
            location: "",
          });
        }
      }
    } catch (err: any) {
      // Parent already surfaced error (e.g., modal). Do nothing here.
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Card className="rounded-2xl border border-border/60 bg-card/95 shadow-md">
      <CardHeader className="space-y-2 border-b border-border/70">
        <CardTitle className="flex items-center gap-2 text-xl font-semibold">
          <Package className="h-5 w-5 text-primary" />
          {initialData ? "Edit Asset" : "Add New Asset"}
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Capture the information your teams rely on for lifecycle, assignment, and reporting.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="space-y-6 rounded-2xl border border-border/60 bg-background/80 p-6">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <ClipboardList className="h-4 w-4 text-primary" />
              Asset Essentials
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="itemName">Item Name *</Label>
                <Input
                  id="itemName"
                  value={formData.itemName}
                  onChange={(e) => handleInputChange("itemName", e.target.value)}
                  placeholder="e.g., Dell Laptop, Office Chair"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity *</Label>
                <Input
                  id="quantity"
                  type="number"
                  value={formData.quantity}
                  onChange={(e) => handleInputChange("quantity", e.target.value)}
                  placeholder="Enter quantity"
                  min="1"
                  required
                />
                {licenseSnap && (
                  <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                    {licenseSnap.propertyLimit && licenseSnap.propertyLimit > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/80 px-2 py-0.5">
                        Property Remaining: {licenseSnap.propertyRemaining != null ? licenseSnap.propertyRemaining : '—'}
                      </span>
                    )}
                    {licenseLoading && <span>Updating…</span>}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="itemType">Item Type{((currentUser?.role || '').toLowerCase() === 'admin') ? ' *' : ''}</Label>
                <Select value={formData.itemType} onValueChange={(value) => handleInputChange("itemType", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select item type" />
                  </SelectTrigger>
                  <SelectContent>
                    {itemTypes.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {((currentUser?.role || '').toLowerCase() === 'admin') && (
                  <div className="space-y-2 rounded-lg border border-dashed border-border/60 bg-background/70 p-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                      <Input
                        placeholder="Add new type"
                        value={newType}
                        onChange={(e) => setNewType(e.target.value)}
                        className="sm:flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={async () => {
                          const name = newType.trim();
                          if (!name) return;
                          try {
                            const created = await createItemType(name);
                            setItemTypes((prev) => Array.from(new Set([...prev, created.name])));
                            setNewType("");
                            toast.success("Item type added");
                          } catch (e: any) {
                            console.error(e);
                            toast.error(e.message || "Failed to add item type");
                          }
                        }}
                      >
                        Add
                      </Button>
                    </div>
                    {itemTypes.length > 0 && (
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {itemTypes.map((t) => (
                          <div key={t} className="flex items-center justify-between rounded-md border border-border/60 bg-background/90 px-2 py-1 text-sm">
                            <span className="truncate pr-2">{t}</span>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              title={`Delete ${t}`}
                              onClick={async () => {
                                if (!confirm(`Delete item type "${t}"?`)) return;
                                try {
                                  await deleteItemType(t);
                                  setItemTypes((prev) => prev.filter((x) => x !== t));
                                  setFormData((prev) => (prev.itemType === t ? { ...prev, itemType: "" } : prev));
                                  toast.success("Item type deleted");
                                } catch (e: any) {
                                  console.error(e);
                                  toast.error(e.message || "Failed to delete item type");
                                }
                              }}
                            >
                              ×
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="condition">Condition *</Label>
                <Select value={formData.condition} onValueChange={(value) => handleInputChange("condition", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select condition" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="excellent">Excellent</SelectItem>
                    <SelectItem value="good">Good</SelectItem>
                    <SelectItem value="fair">Fair</SelectItem>
                    <SelectItem value="poor">Poor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="space-y-6 rounded-2xl border border-border/60 bg-background/80 p-6">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <MapPin className="h-4 w-4 text-primary" />
              Assignment & Tracking
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="property">Property *</Label>
                <Select value={formData.property} onValueChange={(value) => handleInputChange("property", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select property" />
                  </SelectTrigger>
                  <SelectContent>
                    {properties.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {licenseSnap && (
                  <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                    {licenseSnap.propertyLimit && licenseSnap.propertyLimit > 0 && licenseSnap.propertyUsage != null && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/80 px-2 py-0.5">
                        Property Usage: {licenseSnap.propertyUsage}/{licenseSnap.propertyLimit}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="department">Department *</Label>
                <Select
                  value={(formData as any).department || ""}
                  onValueChange={(value) => handleInputChange("department", value)}
                  disabled={(currentUser?.role || '').toLowerCase() !== 'admin' && ((allowedDeptNames && allowedDeptNames.length ? allowedDeptNames.length : (currentUser?.department ? 1 : 0)) === 1)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
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
                        const cur = ((formData as any).department || '').toString();
                        if (cur && !list.find(d => (d.name || '').toLowerCase() === cur.toLowerCase())) {
                          list = [{ id: 'cur', name: cur } as any, ...list];
                        }
                      }
                      return list.map((d) => (
                        <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>
                      ));
                    })()}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Location *</Label>
                <Input
                  id="location"
                  value={formData.location}
                  onChange={(e) => handleInputChange("location", e.target.value)}
                  placeholder="e.g., Floor 2, Room 203"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="serialNumber">Serial Number</Label>
                <Input
                  id="serialNumber"
                  value={formData.serialNumber}
                  onChange={(e) => handleInputChange("serialNumber", e.target.value)}
                  placeholder="Asset serial number"
                />
              </div>
            </div>
          </div>

          <div className="space-y-6 rounded-2xl border border-border/60 bg-background/80 p-6">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <CalendarIcon className="h-4 w-4 text-primary" />
              Lifecycle & Procurement
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Purchase Date</Label>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !formData.purchaseDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.purchaseDate ? format(formData.purchaseDate, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={formData.purchaseDate}
                        onSelect={(date) => handleInputChange("purchaseDate", date)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  {formData.purchaseDate && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="w-full sm:w-auto"
                      onClick={() => handleInputChange("purchaseDate", undefined)}
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
                          !formData.expiryDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.expiryDate ? format(formData.expiryDate, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={formData.expiryDate}
                        onSelect={(date) => handleInputChange("expiryDate", date)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  {formData.expiryDate && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="w-full sm:w-auto"
                      onClick={() => handleInputChange("expiryDate", undefined)}
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="poNumber">PO Number</Label>
                <Input
                  id="poNumber"
                  value={formData.poNumber}
                  onChange={(e) => handleInputChange("poNumber", e.target.value)}
                  placeholder="Purchase Order Number"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4 rounded-2xl border border-border/60 bg-background/80 p-6">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Info className="h-4 w-4 text-primary" />
              Additional Notes
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleInputChange("description", e.target.value)}
                placeholder="Add any context the team should know..."
                rows={4}
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-border/70 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Double-check quantity and location details before saving to keep reports accurate.
            </p>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => window.history.back()}>
                Cancel
              </Button>
              <Button type="submit" className="gap-2">
                <Save className="h-4 w-4" />
                {initialData ? "Update Asset" : "Save Asset"}
              </Button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
