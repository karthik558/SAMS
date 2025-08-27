import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Plus, Users, Package, MapPin, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState } from "react";
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
import { hasSupabaseEnv } from "@/lib/supabaseClient";
import { listProperties, deleteProperty as sbDeleteProperty, createProperty as sbCreateProperty, updateProperty as sbUpdateProperty, type Property } from "@/services/properties";
import { logActivity } from "@/services/activity";

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

  useEffect(() => {
    if (!isSupabase) return;
    (async () => {
      try {
        const data = await listProperties();
        const counts = Object.fromEntries(mockProperties.map(p => [p.id, { assetCount: p.assetCount, userCount: p.userCount }]));
        const merged = data.map((p: Property) => ({
          id: p.id,
          name: p.name,
          address: p.address ?? "",
          type: p.type,
          status: p.status,
          manager: p.manager ?? "",
          assetCount: counts[p.id]?.assetCount ?? 0,
          userCount: counts[p.id]?.userCount ?? 0,
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
      const raw = localStorage.getItem("auth_user");
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

  const getStatusBadge = (status: string) => {
    return status === "Active" ? 
      <Badge variant="secondary">Active</Badge> : 
      <Badge variant="outline">Inactive</Badge>;
  };

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

  return (
    <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Building2 className="h-8 w-8" />
              Property Management
            </h1>
            <p className="text-muted-foreground">
              Manage properties and assign users for asset tracking
            </p>
          </div>
          <Button onClick={handleAddProperty} className="gap-2" disabled={role !== 'admin'}>
            <Plus className="h-4 w-4" />
            Add New Property
          </Button>
        </div>

    {/* Stats */}
  <div className="grid gap-3 sm:gap-4 md:grid-cols-4">
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
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Users</p>
                  <p className="text-2xl font-bold">
                    {properties.reduce((sum, prop) => sum + prop.userCount, 0)}
                  </p>
                </div>
                <Users className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Properties Grid */}
  <div className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
          {properties.map((property) => (
            <Card key={property.id} className="hover:shadow-medium transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{property.name}</CardTitle>
                    <CardDescription className="flex items-center gap-2 mt-1">
                      <span className={`font-medium ${getTypeColor(property.type)}`}>
                        {property.type}
                      </span>
                      • {getStatusBadge(property.status)}
                    </CardDescription>
                  </div>
                  <Building2 className="h-6 w-6 text-muted-foreground" />
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {/* Address */}
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <p className="text-sm text-muted-foreground">{property.address}</p>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <p className="text-2xl font-bold text-primary">{property.assetCount}</p>
                    <p className="text-xs text-muted-foreground">Assets</p>
                  </div>
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <p className="text-2xl font-bold text-success">{property.userCount}</p>
                    <p className="text-xs text-muted-foreground">Users</p>
                  </div>
                </div>

                {/* Manager */}
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    <span className="text-muted-foreground">Manager:</span>{" "}
                    <span className="font-medium">{property.manager}</span>
                  </span>
                </div>

                {/* Actions */}
                {role === 'admin' && (
                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEditProperty(property.id)}
                      className="flex-1 gap-2"
                    >
                      <Edit className="h-4 w-4" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDeleteProperty(property.id)}
                      className="gap-2 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Property Types Overview */}
        <Card>
          <CardHeader>
            <CardTitle>Property Types Distribution</CardTitle>
            <CardDescription>
              Overview of your properties by type and their asset distribution
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-4">
              {["Office", "Storage", "Manufacturing", "Site Office"].map((type) => {
                const propertiesOfType = properties.filter(p => p.type === type);
                const totalAssets = propertiesOfType.reduce((sum, p) => sum + p.assetCount, 0);
                
                return (
                  <div key={type} className="text-center p-4 border border-border rounded-lg">
                    <h3 className={`font-semibold ${getTypeColor(type)}`}>{type}</h3>
                    <p className="text-2xl font-bold mt-2">{propertiesOfType.length}</p>
                    <p className="text-xs text-muted-foreground">Properties</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {totalAssets} assets total
                    </p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

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
  <Dialog open={isDialogOpen && role==='admin'} onOpenChange={setIsDialogOpen}>
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