import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import StatusChip from "@/components/ui/status-chip";
import { Building2, Plus, Package, MapPin, Edit, Trash2, AlertTriangle, Users } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { isDemoMode } from "@/lib/demo";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { hasSupabaseEnv, supabase } from "@/lib/supabaseClient";
import { listProperties, deleteProperty as sbDeleteProperty, createProperty as sbCreateProperty, updateProperty as sbUpdateProperty, type Property } from "@/services/properties";
import { listAssets, type Asset } from "@/services/assets";
import { logActivity } from "@/services/activity";
import { getCurrentUserId, canUserEdit } from "@/services/permissions";
import PageHeader from "@/components/layout/PageHeader";
import Breadcrumbs from "@/components/layout/Breadcrumbs";
import { ResponsiveContainer, Tooltip as RechartsTooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList, PieChart, Pie, Cell } from "recharts";
// removed dropdown actions; showing buttons inline for better visibility

const mockProperties = [
  {
    id: "PROP-001",
    name: "Main Office",
    address: "123 Business St, Downtown, City 12345",
    type: "Office",
    assetCount: 78,
    userCount: 12,
    manager: "John Smith",
    status: "Active"
  },
  {
    id: "PROP-002", 
    name: "Warehouse",
    address: "456 Industrial Ave, Port District, City 67890",
    type: "Storage",
    assetCount: 45,
    userCount: 6,
    manager: "Sarah Johnson",
    status: "Active"
  },
  {
    id: "PROP-003",
    name: "Branch Office",
    address: "789 Corporate Blvd, Uptown, City 54321",
    type: "Office",
    assetCount: 32,
    userCount: 8,
    manager: "Mike Davis",
    status: "Active"
  },
  {
    id: "PROP-004",
    name: "Factory",
    address: "321 Manufacturing Way, Industrial Zone, City 98765",
    type: "Manufacturing",
    assetCount: 28,
    userCount: 15,
    manager: "Emma Wilson",
    status: "Active"
  },
  {
    id: "PROP-005",
    name: "Remote Site",
    address: "654 Remote Location Rd, Outskirts, City 13579",
    type: "Site Office",
    assetCount: 15,
    userCount: 3,
    manager: "Tom Brown",
    status: "Inactive"
  }
];

export default function Properties() {
  const [properties, setProperties] = useState<any[]>(mockProperties);
  const isSupabase = hasSupabaseEnv;
  const [role, setRole] = useState<string>("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    id: "",
    name: "",
    address: "",
    type: "Office",
    status: "Active",
    manager: "",
  });
  const [canEditPage, setCanEditPage] = useState<boolean>(false);
  useEffect(() => {
    (async () => {
      try {
        const uid = getCurrentUserId();
  const allowed = uid ? await canUserEdit(uid, 'properties') : null;
  const baseline = role === 'admin';
  setCanEditPage(allowed === null ? baseline : allowed);
      } catch { setCanEditPage(role === 'admin'); }
    })();
  }, [role]);

  useEffect(() => {
    if (!isSupabase) return;
    (async () => {
      try {
        // Load properties, assets, and user-property access
        const [props, assets, userAccess] = await Promise.all([
          listProperties(),
          listAssets().catch(() => [] as Asset[]),
          supabase
            .from("user_property_access")
            .select("user_id, property_id")
            .then(({ data, error }) => {
              if (error) throw error;
              return (data || []) as Array<{ user_id: string; property_id: string }>;
            })
            .catch(() => [] as Array<{ user_id: string; property_id: string }>),
        ]);

        // Build counts by property id/code
        const assetCounts: Record<string, number> = {};
        for (const a of assets) {
          const key = (a.property_id || a.property || "").toString();
          if (!key) continue;
          assetCounts[key] = (assetCounts[key] || 0) + 1;
        }

        const userCounts: Record<string, number> = {};
        // Count distinct users per property
        const grouped = new Map<string, Set<string>>();
        for (const ua of userAccess) {
          if (!ua.property_id || !ua.user_id) continue;
          if (!grouped.has(ua.property_id)) grouped.set(ua.property_id, new Set());
          grouped.get(ua.property_id)!.add(ua.user_id);
        }
        for (const [propId, users] of grouped.entries()) {
          userCounts[propId] = users.size;
        }

        const merged = props.map((p: Property) => ({
          id: p.id,
          name: p.name,
          address: p.address ?? "",
          type: p.type,
          status: p.status,
          manager: p.manager ?? "",
          assetCount: assetCounts[p.id] ?? 0,
          userCount: userCounts[p.id] ?? 0,
        }));
        setProperties(merged);
      } catch (e: any) {
        console.error(e);
        toast.error("Failed to load properties from Supabase; using local data");
      }
    })();
  }, [isSupabase]);

  useEffect(() => {
    try {
  const raw = (isDemoMode() ? (sessionStorage.getItem('demo_auth_user') || localStorage.getItem('demo_auth_user')) : null) || localStorage.getItem("auth_user");
      const r = raw ? (JSON.parse(raw).role || "") : "";
      setRole((r || "").toLowerCase());
    } catch {}
  }, []);

  const handleAddProperty = () => {
    setEditingId(null);
    setForm({ id: "", name: "", address: "", type: "Office", status: "Active", manager: "" });
    setIsDialogOpen(true);
  };

  const handleEditProperty = (propertyId: string) => {
    setEditingId(propertyId);
    const p = properties.find((x: any) => x.id === propertyId);
    if (p) {
      setForm({
        id: p.id,
        name: p.name,
        address: p.address ?? "",
        type: p.type,
        status: p.status,
        manager: p.manager ?? "",
      });
      setIsDialogOpen(true);
    }
  };

  const handleDeleteProperty = async (propertyId: string) => {
    const ok = window.confirm(`Are you sure you want to delete property ${propertyId}? This action cannot be undone.`);
    if (!ok) return;
    try {
      if (isSupabase) {
        await sbDeleteProperty(propertyId);
        setProperties(prev => prev.filter(p => p.id !== propertyId));
        toast.success(`Property ${propertyId} deleted`);
  await logActivity("property_deleted", `Property ${propertyId} deleted`);
      } else {
        setProperties(prev => prev.filter(p => p.id !== propertyId));
        toast.info("Supabase not configured; deleted locally only");
  await logActivity("property_deleted", `Property ${propertyId} deleted (local)`, "Local");
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Failed to delete property");
    }
  };

  const handleSubmit = async () => {
    try {
      if (!form.name || !form.type || !form.status) {
        toast.error("Please fill required fields");
        return;
      }
      const id = editingId ? editingId : (form.id || `PROP-${Math.floor(Math.random()*900+100)}`);
      if (isSupabase) {
        if (editingId) {
          await sbUpdateProperty(editingId, {
            // do not update primary key id to avoid FK issues
            name: form.name,
            address: form.address,
            type: form.type,
            status: form.status,
            manager: form.manager,
          });
          setProperties(prev => prev.map((p: any) => p.id === editingId ? { ...p, ...form, id: editingId } : p));
          toast.success("Property updated");
          await logActivity("property_updated", `Property ${editingId} updated`);
        } else {
          const created = await sbCreateProperty({
            id,
            name: form.name,
            address: form.address,
            type: form.type,
            status: form.status,
            manager: form.manager,
          } as Property);
          setProperties(prev => [
            ...prev,
            { ...created, assetCount: 0, userCount: 0 }
          ]);
          toast.success("Property created");
          await logActivity("property_created", `Property ${id} created`);
        }
      } else {
        if (editingId) {
          setProperties(prev => prev.map((p: any) => p.id === editingId ? { ...p, ...form, id: editingId } : p));
          toast.info("Updated locally (no Supabase)");
          await logActivity("property_updated", `Property ${editingId} updated (local)`, "Local");
        } else {
          setProperties(prev => [...prev, { ...form, id, assetCount: 0, userCount: 0 }]);
          toast.info("Created locally (no Supabase)");
          await logActivity("property_created", `Property ${id} created (local)`, "Local");
        }
      }
      setIsDialogOpen(false);
      setEditingId(null);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Failed to save property");
    }
  };

  const getStatusBadge = (status: string) => <StatusChip status={status} size="sm" className="px-2" />;

  const getTypeColor = (type: string) => {
    switch (type) {
      case "Office":
        return "text-primary";
      case "Storage":
        return "text-warning";
      case "Manufacturing":
        return "text-success";
      case "Site Office":
        return "text-muted-foreground";
      default:
        return "text-foreground";
    }
  };

  // Derived helpers for UI rendering
  const maxAssets = Math.max(1, ...properties.map((p: any) => Number(p.assetCount) || 0));
  const inactiveCount = properties.filter(p => (p.status || "").toLowerCase() === "inactive").length;
  const typeCounts = (() => {
    const map = new Map<string, number>();
    for (const p of properties) {
      const t = p.type || "Other";
      map.set(t, (map.get(t) || 0) + 1);
    }
    // Use site color tokens only
    const paletteTypes = [
      "hsl(var(--primary))",
      "hsl(var(--secondary))",
      "hsl(var(--accent))",
      "hsl(var(--success))",
      "hsl(var(--warning))",
      "hsl(var(--destructive))",
    ];
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, value], i) => ({ name, value, fill: paletteTypes[i % paletteTypes.length] }));
  })();

  const assetsByType = (() => {
    const map = new Map<string, number>();
    for (const p of properties) {
      const t = p.type || "Other";
      const count = Number(p.assetCount) || 0;
      map.set(t, (map.get(t) || 0) + count);
    }
    // Use site color tokens only; order offset so palettes differ across the two charts
    const paletteAssets = [
      "hsl(var(--accent))",
      "hsl(var(--success))",
      "hsl(var(--warning))",
      "hsl(var(--primary))",
      "hsl(var(--secondary))",
      "hsl(var(--destructive))",
    ];
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, assets], i) => ({ name, assets, fill: paletteAssets[i % paletteAssets.length] }));
  })();

  // Themed tooltip for charts to ensure readability in dark mode
  function ChartTooltip({ active, payload, label }: any) {
    if (!active || !payload || !payload.length) return null;
    return (
      <div
        className="rounded-md border bg-card/95 backdrop-blur px-2.5 py-2 shadow-md text-xs"
        style={{ color: 'hsl(var(--foreground))', borderColor: 'hsl(var(--border))' }}
      >
        {label ? <div className="mb-1 font-medium text-foreground">{label}</div> : null}
        <div className="space-y-1">
          {payload.map((entry: any, i: number) => (
            <div key={i} className="flex items-center gap-2">
              {entry?.color ? (
                <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
              ) : null}
              <span className="text-muted-foreground">{entry?.name}</span>
              <span className="font-medium text-foreground">{entry?.value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
        <Breadcrumbs items={[{ label: "Dashboard", to: "/" }, { label: "Properties" }]} />
        <PageHeader
          icon={Building2}
          title="Property Management"
          description="Manage properties and related assets"
          actions={
            <Button onClick={handleAddProperty} className="gap-2" disabled={!canEditPage}>
              <Plus className="h-4 w-4" />
              Add New Property
            </Button>
          }
        />

    {/* Stats */}
  <div className="grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Properties</p>
                  <p className="text-2xl font-bold">{properties.length}</p>
                </div>
                <Building2 className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Active Properties</p>
                  <p className="text-2xl font-bold text-success">
                    {properties.filter(p => p.status === "Active").length}
                  </p>
                </div>
                <MapPin className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Assets</p>
                  <p className="text-2xl font-bold">
                    {properties.reduce((sum, prop) => sum + prop.assetCount, 0)}
                  </p>
                </div>
                <Package className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          
          {/* New: Inactive Properties */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Inactive Properties</p>
                  <p className="text-2xl font-bold text-destructive">{inactiveCount}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          
        </div>

        {/* Properties Grid */}
        <div className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
          {properties.map((property) => {
            const pct = Math.max(0, Math.min(100, Math.round((Number(property.assetCount) || 0) / maxAssets * 100)));
            return (
              <Card
                key={property.id}
                className="group relative border-border/70 hover:border-primary/30 hover:shadow-md transition-colors duration-200 rounded-xl overflow-hidden bg-card hover:bg-card/90"
              >
                <CardHeader className="pb-0">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-base md:text-[1.05rem] truncate">{property.name}</CardTitle>
                        {getStatusBadge(property.status)}
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5">{property.id}</span>
                        <Badge variant="outline" className="px-2 py-0.5 text-[11px]">{property.type}</Badge>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-3">
                  {/* Address */}
                  <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground/80" />
                    <span className="truncate">{property.address}</span>
                  </p>

                  {/* Stats chips */}
                  <div className="flex items-center gap-3 text-xs">
                    <div className="inline-flex items-center gap-1.5 rounded-md bg-muted/60 border px-2 py-1">
                      <Package className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-muted-foreground">Assets</span>
                      <span className="font-medium text-foreground">{property.assetCount}</span>
                    </div>
                    <div className="inline-flex items-center gap-1.5 rounded-md bg-muted/60 border px-2 py-1">
                      <Users className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-muted-foreground">Users</span>
                      <span className="font-medium text-foreground">{Number(property.userCount) || 0}</span>
                    </div>
                  </div>

                  {/* Asset meter */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] text-muted-foreground">Utilization</span>
                      <span className="text-[11px] font-medium text-foreground">{pct}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-primary/10 overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>

                  {/* Manager */}
                  {property.manager ? (
                    <p className="text-[11px] text-muted-foreground">Manager: <span className="text-foreground/90 font-medium">{property.manager}</span></p>
                  ) : null}

                  {/* Actions */}
                  {canEditPage && (
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" variant="outline" onClick={() => handleEditProperty(property.id)} className="gap-2">
                        <Edit className="h-4 w-4" /> Edit
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleDeleteProperty(property.id)} className="gap-2 text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" /> Delete
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Property Types & Assets by Type (compact two-chart grid) */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Property Types Distribution</CardTitle>
              <CardDescription>Breakdown of properties by type</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <RechartsTooltip content={<ChartTooltip />} />
                    <Pie
                      dataKey="value"
                      data={typeCounts}
                      innerRadius={48}
                      outerRadius={76}
                      paddingAngle={2}
                      startAngle={90}
                      endAngle={-270}
                      stroke="hsl(var(--background))"
                      strokeWidth={1}
                    >
                      {typeCounts.map((d) => (
                        <Cell key={d.name} fill={d.fill} />
                      ))}
                      <LabelList dataKey="value" position="outside" className="text-[10px]" style={{ fill: 'hsl(var(--foreground))' }} />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              {/* Compact legend pills */}
              <div className="mt-2 flex flex-wrap gap-2">
                {typeCounts.map((t) => (
                  <span key={t.name} className="inline-flex items-center gap-2 rounded-full border px-2 py-0.5 text-[11px]">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: t.fill }} />
                    <span className="text-muted-foreground">{t.name}</span>
                    <span className="font-medium text-foreground">{t.value}</span>
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Assets by Property Type</CardTitle>
              <CardDescription>Total assets grouped by property type</CardDescription>
            </CardHeader>
            <CardContent>
      <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={assetsByType.sort((a, b) => b.assets - a.assets)}
                    layout="vertical"
        margin={{ top: 4, right: 8, left: 8, bottom: 4 }}
                  >
  <CartesianGrid stroke="hsl(var(--muted-foreground))" strokeOpacity={0.25} strokeDasharray="3 3" vertical={false} />
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="name" width={120} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <RechartsTooltip content={<ChartTooltip />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }} />
        <Bar dataKey="assets" radius={[6, 6, 6, 6]} barSize={12} background={{ fill: 'hsl(var(--muted))', opacity: 0.35 }}>
                      {assetsByType.map((d) => (
                        <Cell key={d.name} fill={d.fill} />
                      ))}
                      <LabelList dataKey="assets" position="right" className="text-[10px] fill-foreground" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Backend Connection Notice */}
        {!isSupabase && (
          <Card className="border-warning/50 bg-warning/5">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <Building2 className="h-6 w-6 text-warning shrink-0" />
                <div>
                  <h3 className="font-semibold text-foreground">Property Management Features</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Connect Supabase to persist properties and relationships.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Add/Edit Property Dialog */}
  <Dialog open={isDialogOpen && canEditPage} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Property" : "Add New Property"}</DialogTitle>
              <DialogDescription>
                {editingId ? "Update property details" : "Create a new property for asset tracking"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="prop-id">Property ID</Label>
                  <Input id="prop-id" value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} placeholder="e.g., PROP-006" disabled={Boolean(editingId)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="prop-name">Name</Label>
                  <Input id="prop-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Main Office" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="prop-address">Address</Label>
                <Input id="prop-address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Full address" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Office">Office</SelectItem>
                      <SelectItem value="Storage">Storage</SelectItem>
                      <SelectItem value="Manufacturing">Manufacturing</SelectItem>
                      <SelectItem value="Site Office">Site Office</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="prop-manager">Manager</Label>
                  <Input id="prop-manager" value={form.manager} onChange={(e) => setForm({ ...form, manager: e.target.value })} placeholder="Manager name" />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSubmit}>{editingId ? "Save Changes" : "Create Property"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </div>
  );
}