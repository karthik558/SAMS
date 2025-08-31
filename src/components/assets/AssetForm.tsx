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
import { CalendarIcon, Package, Save } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { hasSupabaseEnv } from "@/lib/supabaseClient";
import { listProperties, type Property } from "@/services/properties";
import { listItemTypes, createItemType } from "@/services/itemTypes";
import { listDepartments, type Department } from "@/services/departments";
import { listUserDepartmentAccess } from "@/services/userDeptAccess";
import { isDemoMode } from "@/lib/demo";

interface AssetFormProps {
  onSubmit?: (data: any) => void;
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

  useEffect(() => {
    (async () => {
      try {
        // Properties from Supabase (or fallback handled in page state)
        if (hasSupabaseEnv) {
          const props = await listProperties();
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
        setItemTypes(types.map(t => t.name));
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    if (!formData.itemName || !formData.quantity || !formData.itemType || !formData.property) {
      toast.error("Please fill in all required fields");
      return;
    }

    // Generic enforcement: if user is not admin and has allowed departments, selected department must be in that list
    const role = (currentUser?.role || '').toLowerCase();
    const selectedDept = (formData as any).department || currentUser?.department || '';
    const effectiveAllowed = (allowedDeptNames && allowedDeptNames.length) ? allowedDeptNames : (currentUser?.department ? [currentUser.department] : []);
    const allowed = new Set(effectiveAllowed.map((d: string) => String(d).toLowerCase()));
    if (role !== 'admin' && allowed.size > 0) {
      if (!selectedDept || !allowed.has(String(selectedDept).toLowerCase())) {
        toast.error("You are not allowed to create assets for this department");
        return;
      }
    }

    onSubmit?.(formData);
    toast.success("Asset saved successfully!");
    
    // Reset form if creating new asset
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
  // department will re-compute from currentUser in UI
      });
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          {initialData ? "Edit Asset" : "Add New Asset"}
        </CardTitle>
        <CardDescription>
          Enter the details for the asset item. Required fields are marked with *
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Item Name */}
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

            {/* Quantity */}
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
            </div>

            {/* Item Type */}
            <div className="space-y-2">
              <Label htmlFor="itemType">Item Type *</Label>
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
              <div className="flex gap-2 mt-2">
                <Input
                  placeholder="Add new type (Admin)"
                  value={newType}
                  onChange={(e) => setNewType(e.target.value)}
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
            </div>

            {/* Property */}
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
            </div>

            {/* Department */}
            <div className="space-y-2">
              <Label htmlFor="department">Department</Label>
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
                    if (role === 'admin') return departments;
                    const effective = (allowedDeptNames && allowedDeptNames.length) ? allowedDeptNames : (currentUser?.department ? [currentUser.department] : []);
                    const set = new Set(effective.map((n: string) => n.toLowerCase()));
                    return (departments || []).filter((d) => set.has((d.name || '').toLowerCase()));
                  })().map((d) => (
                    <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Purchase Date */}
            <div className="space-y-2">
              <Label>Purchase Date</Label>
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
            </div>

            {/* Expiry Date */}
            <div className="space-y-2">
              <Label>Expiry Date</Label>
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
            </div>

            {/* PO Number */}
            <div className="space-y-2">
              <Label htmlFor="poNumber">PO Number</Label>
              <Input
                id="poNumber"
                value={formData.poNumber}
                onChange={(e) => handleInputChange("poNumber", e.target.value)}
                placeholder="Purchase Order Number"
              />
            </div>

            {/* Serial Number */}
            <div className="space-y-2">
              <Label htmlFor="serialNumber">Serial Number</Label>
              <Input
                id="serialNumber"
                value={formData.serialNumber}
                onChange={(e) => handleInputChange("serialNumber", e.target.value)}
                placeholder="Asset serial number"
              />
            </div>

            {/* Location */}
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => handleInputChange("location", e.target.value)}
                placeholder="e.g., Floor 2, Room 203"
              />
            </div>

            {/* Condition */}
            <div className="space-y-2">
              <Label htmlFor="condition">Condition</Label>
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

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
              placeholder="Additional details about the asset..."
              rows={3}
            />
          </div>

          {/* Submit Button */}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => window.history.back()}>
              Cancel
            </Button>
            <Button type="submit" className="gap-2">
              <Save className="h-4 w-4" />
              {initialData ? "Update Asset" : "Save Asset"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}