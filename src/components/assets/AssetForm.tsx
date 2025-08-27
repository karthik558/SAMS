import { useState } from "react";
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
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    if (!formData.itemName || !formData.quantity || !formData.itemType || !formData.property) {
      toast.error("Please fill in all required fields");
      return;
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
                  <SelectItem value="furniture">Furniture</SelectItem>
                  <SelectItem value="electronics">Electronics</SelectItem>
                  <SelectItem value="vehicles">Vehicles</SelectItem>
                  <SelectItem value="machinery">Machinery</SelectItem>
                  <SelectItem value="office-supplies">Office Supplies</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Property */}
            <div className="space-y-2">
              <Label htmlFor="property">Property *</Label>
              <Select value={formData.property} onValueChange={(value) => handleInputChange("property", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select property" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="main-office">Main Office</SelectItem>
                  <SelectItem value="warehouse">Warehouse</SelectItem>
                  <SelectItem value="branch-office">Branch Office</SelectItem>
                  <SelectItem value="factory">Factory</SelectItem>
                  <SelectItem value="remote-site">Remote Site</SelectItem>
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