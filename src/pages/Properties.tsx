import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Plus, Users, Package, MapPin, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";

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
  const handleAddProperty = () => {
    toast.info("Add Property feature requires Supabase connection");
  };

  const handleEditProperty = (propertyId: string) => {
    toast.info(`Edit Property ${propertyId} requires Supabase connection`);
  };

  const handleDeleteProperty = (propertyId: string) => {
    toast.info(`Delete Property ${propertyId} requires Supabase connection`);
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
          <Button onClick={handleAddProperty} className="gap-2">
            <Plus className="h-4 w-4" />
            Add New Property
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Properties</p>
                  <p className="text-2xl font-bold">{mockProperties.length}</p>
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
                    {mockProperties.filter(p => p.status === "Active").length}
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
                    {mockProperties.reduce((sum, prop) => sum + prop.assetCount, 0)}
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
                    {mockProperties.reduce((sum, prop) => sum + prop.userCount, 0)}
                  </p>
                </div>
                <Users className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Properties Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {mockProperties.map((property) => (
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
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {["Office", "Storage", "Manufacturing", "Site Office"].map((type) => {
                const propertiesOfType = mockProperties.filter(p => p.type === type);
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
        <Card className="border-warning/50 bg-warning/5">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <Building2 className="h-6 w-6 text-warning shrink-0" />
              <div>
                <h3 className="font-semibold text-foreground">Property Management Features</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Full property management requires Supabase connection for user assignments, 
                  property creation, and asset-property relationships.
                </p>
              </div>
            </div>
          </CardContent>
      </Card>
    </div>
  );
}