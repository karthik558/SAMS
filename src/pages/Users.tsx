import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { 
  Plus, 
  Search, 
  MoreHorizontal, 
  Edit, 
  Trash2, 
  UserPlus,
  Shield,
  User,
  Mail,
  Phone,
  Calendar,
  Filter
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AppUser, createUser, deleteUser, listUsers, updateUser } from "@/services/users";
import { listDepartments, createDepartment, type Department } from "@/services/departments";
import { hasSupabaseEnv } from "@/lib/supabaseClient";
import { listProperties, type Property } from "@/services/properties";
import { listUserPropertyAccess, setUserPropertyAccess } from "@/services/userAccess";
import { listUserPermissions, setUserPermissions, type PageKey, roleDefaults, mergeDefaultsWithOverrides } from "@/services/permissions";

// Local fallback key
const LS_KEY = "app_users_fallback";

function getInitials(name?: string): string {
  if (!name) return "U";
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "U";
  if (words.length === 1) {
    const cleaned = words[0].replace(/[^A-Za-z0-9]/g, "");
    return (cleaned.slice(0, 2).toUpperCase() || "U");
  }
  const first = words[0][0] || "";
  const last = words[words.length - 1][0] || "";
  const init = (first + last).toUpperCase().replace(/[^A-Z0-9]/g, "");
  return init || "U";
}

function readLocalUsers(): AppUser[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as AppUser[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeLocalUsers(users: AppUser[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(users));
  } catch {}
}

const seedLocalUsersIfEmpty = () => {
  const existing = readLocalUsers();
  if (existing.length) return existing;
  const seeded: AppUser[] = [
    {
      id: crypto?.randomUUID?.() || String(Date.now()),
      name: "John Doe",
      email: "john.doe@company.com",
      role: "Admin",
      department: "IT",
      phone: "+1 (555) 123-4567",
      last_login: "2024-01-15",
      status: "Active",
      avatar_url: "/placeholder.svg",
    },
    {
      id: crypto?.randomUUID?.() || String(Date.now() + 1),
      name: "Jane Smith",
      email: "jane.smith@company.com",
      role: "User",
      department: "HR",
      phone: "+1 (555) 234-5678",
      last_login: "2024-01-14",
      status: "Active",
      avatar_url: "/placeholder.svg",
    },
    {
      id: crypto?.randomUUID?.() || String(Date.now() + 2),
      name: "Mike Johnson",
      email: "mike.johnson@company.com",
      role: "User",
      department: "Finance",
      phone: "+1 (555) 345-6789",
      last_login: "2024-01-10",
      status: "Inactive",
      avatar_url: "/placeholder.svg",
    },
    {
      id: crypto?.randomUUID?.() || String(Date.now() + 3),
      name: "Sarah Wilson",
      email: "sarah.wilson@company.com",
      role: "Manager",
      department: "Operations",
      phone: "+1 (555) 456-7890",
      last_login: "2024-01-15",
      status: "Active",
      avatar_url: "/placeholder.svg",
    },
  ];
  writeLocalUsers(seeded);
  return seeded;
};

export default function Users() {
  const { toast } = useToast();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isEditUserOpen, setIsEditUserOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<string | undefined>(undefined);
  const [department, setDepartment] = useState<string | undefined>(undefined);
  const [password, setPassword] = useState("");
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<string[]>([]);
  const [authRole, setAuthRole] = useState<string>("");
  const [editSelectedPropertyIds, setEditSelectedPropertyIds] = useState<string[]>([]);
  const [deptOptions, setDeptOptions] = useState<Department[]>([]);
  const [newDeptModalOpen, setNewDeptModalOpen] = useState(false);
  const [newDeptName, setNewDeptName] = useState("");
  const [newDeptCode, setNewDeptCode] = useState("");
  // Per-page permissions
  const allPages: PageKey[] = ['assets','properties','qrcodes','users','reports','settings'];
  const [permView, setPermView] = useState<Record<PageKey, boolean>>({ assets:false, properties:false, qrcodes:false, users:false, reports:false, settings:false });
  const [permEdit, setPermEdit] = useState<Record<PageKey, boolean>>({ assets:false, properties:false, qrcodes:false, users:false, reports:false, settings:false });
  const [ePermView, setEPermView] = useState<Record<PageKey, boolean>>({ assets:false, properties:false, qrcodes:false, users:false, reports:false, settings:false });
  const [ePermEdit, setEPermEdit] = useState<Record<PageKey, boolean>>({ assets:false, properties:false, qrcodes:false, users:false, reports:false, settings:false });

  // Edit form fields
  const [eFirstName, setEFirstName] = useState("");
  const [eLastName, setELastName] = useState("");
  const [eEmail, setEEmail] = useState("");
  const [ePhone, setEPhone] = useState("");
  const [eRole, setERole] = useState<string | undefined>(undefined);
  const [eDepartment, setEDepartment] = useState<string | undefined>(undefined);
  const [eStatus, setEStatus] = useState<string>("active");
  const [ePassword, setEPassword] = useState("");
  const [eMustChange, setEMustChange] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Local fallback properties (ids align with demo data used elsewhere)
  const fallbackProperties: Property[] = [
    { id: "PROP-001", name: "Main Office", address: null, type: "Office", status: "Active", manager: null },
    { id: "PROP-002", name: "Warehouse", address: null, type: "Storage", status: "Active", manager: null },
    { id: "PROP-003", name: "Branch Office", address: null, type: "Office", status: "Active", manager: null },
    { id: "PROP-004", name: "Factory", address: null, type: "Manufacturing", status: "Active", manager: null },
    { id: "PROP-005", name: "Remote Site", address: null, type: "Site Office", status: "Inactive", manager: null },
  ];

  // initial load
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
  const data = await listUsers();
  if (!cancelled) setUsers((data && data.length) ? data : seedLocalUsersIfEmpty());
      } catch (e: any) {
        // Fallback to localStorage when Supabase isn't configured
        const seeded = seedLocalUsersIfEmpty();
        if (!cancelled) setUsers(seeded);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Load departments for selectors
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const deps = await listDepartments();
        if (!cancelled) setDeptOptions(deps.filter(d => d.is_active));
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("auth_user");
      const r = raw ? (JSON.parse(raw).role || "") : "";
      setAuthRole((r || "").toLowerCase());
    } catch {}
  }, []);

  // Load properties for Property Access selection
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await listProperties();
        if (!cancelled) setProperties(list);
      } catch {
        if (!cancelled) setProperties(fallbackProperties);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredUsers = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return users.filter((user) => {
      const matchesSearch =
        user.name.toLowerCase().includes(term) || user.email.toLowerCase().includes(term);
      const matchesRole = roleFilter === "all" || user.role.toLowerCase() === roleFilter;
      const matchesStatus =
        statusFilter === "all" || user.status.toLowerCase() === statusFilter;
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, searchTerm, roleFilter, statusFilter]);

  const resetForm = () => {
    setFirstName("");
    setLastName("");
    setEmail("");
    setPhone("");
    setRole(undefined);
    setDepartment(undefined);
  setPassword("");
  setMustChangePassword(false);
  setSelectedPropertyIds([]);
  };

  // Pre-tick permission checkboxes for Add dialog based on selected role's defaults
  useEffect(() => {
    const defaults = roleDefaults(role);
    setPermView(Object.fromEntries(allPages.map(p => [p, defaults[p].v])) as any);
    setPermEdit(Object.fromEntries(allPages.map(p => [p, defaults[p].e])) as any);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  const toTitle = (v?: string) => (v ? v.charAt(0).toUpperCase() + v.slice(1) : "");
  const mapRole = (v?: string) => (v ? toTitle(v) : "User");
  // Normalize department against options list to avoid duplicates like FinanceFINANCE
  const normalizeDeptInput = (v?: string): string | null => {
    if (!v) return null;
    const key = v.toLowerCase();
    const found = deptOptions.find(d => (d.name || '').toLowerCase() === key || (d.code || '').toLowerCase() === key);
    if (found) return found.name;
    // Fallback to title-cased name
    return toTitle(v);
  };

  const handleAddUser = async () => {
    const name = `${firstName.trim()} ${lastName.trim()}`.trim();
    if (!name || !email.trim()) {
      toast({ title: "Missing info", description: "Name and email are required.", variant: "destructive" });
      return;
    }
    if (!password.trim()) {
      toast({ title: "Password required", description: "Please set a password for the new user.", variant: "destructive" });
      return;
    }
    const payload = {
      name,
      email: email.trim(),
  role: mapRole(role),
  department: normalizeDeptInput(department),
      phone: phone || null,
      last_login: null,
      status: "Active",
      avatar_url: "/placeholder.svg",
      must_change_password: mustChangePassword,
      password_changed_at: null,
  // password used for Auth provisioning
  password: password,
    } as Omit<AppUser, "id"> & { password?: string };

    try {
  const created = await createUser(payload);
      // Persist property access mapping
      if (selectedPropertyIds.length) {
        try { await setUserPropertyAccess(created.id, selectedPropertyIds); } catch {}
      }
      // Persist per-page permissions
      try {
        const payloadPerms = Object.fromEntries(allPages.map((p) => [p, { v: !!permView[p], e: !!permEdit[p] }])) as any;
        await setUserPermissions(created.id, payloadPerms);
      } catch {}
      setUsers((prev) => [created, ...prev]);
      toast({ title: "User added", description: `${created.name} has been added.` });
    } catch (e: any) {
      if (hasSupabaseEnv) {
        const msg = e?.message || 'Auth provisioning failed';
        toast({ title: 'User creation failed', description: `${msg}. Ensure the provisioning endpoint is deployed and you are an admin/manager.`, variant: 'destructive' });
        return;
      }
      // Local-only mode
      const local: AppUser = {
        id: crypto?.randomUUID?.() || String(Date.now()),
        name: payload.name,
        email: payload.email,
        role: payload.role,
        department: payload.department,
        phone: payload.phone,
        last_login: payload.last_login,
        status: payload.status,
        avatar_url: payload.avatar_url,
        must_change_password: payload.must_change_password,
        password_changed_at: payload.password_changed_at,
      } as AppUser as any;
      const next = [local, ...users];
      setUsers(next);
      writeLocalUsers(next);
      if (selectedPropertyIds.length) {
        try { await setUserPropertyAccess(local.id, selectedPropertyIds); } catch {}
      }
      try {
        const payloadPerms = Object.fromEntries(allPages.map((p) => [p, { v: !!permView[p], e: !!permEdit[p] }])) as any;
        await setUserPermissions(local.id, payloadPerms);
      } catch {}
      toast({ title: 'User added (local)', description: `${local.name} stored locally.` });
    }
    setIsAddUserOpen(false);
    resetForm();
    // Reset permission toggles
    setPermView({ assets:false, properties:false, qrcodes:false, users:false, reports:false, settings:false });
    setPermEdit({ assets:false, properties:false, qrcodes:false, users:false, reports:false, settings:false });
  };

  const openEditUser = async (user: AppUser) => {
    setEditingUser(user);
    // Split name into first/last best-effort
    const parts = (user.name || "").trim().split(/\s+/);
    setEFirstName(parts[0] || "");
    setELastName(parts.slice(1).join(" "));
    setEEmail(user.email || "");
    setEPhone(user.phone || "");
    setERole((user.role || "").toLowerCase());
  setEDepartment((user.department || "")?.toString().toLowerCase());
    setEStatus((user.status || "Active").toLowerCase());
    setEMustChange(!!user.must_change_password);
    // Determine if current user is admin
    try {
      const raw = localStorage.getItem("auth_user");
      if (raw) {
        const au = JSON.parse(raw) as { role?: string };
        setIsAdmin((au.role || "").toLowerCase() === "admin");
      }
    } catch {}
    try {
      const ids = await listUserPropertyAccess(user.id);
      setEditSelectedPropertyIds(ids);
    } catch {
      setEditSelectedPropertyIds([]);
    }
    // Load per-page permissions for this user and merge with role defaults for display
    try {
      const perms = await listUserPermissions(user.id);
      const merged = mergeDefaultsWithOverrides((user.role || '').toString(), perms as any);
      const v: any = Object.fromEntries(allPages.map(p => [p, merged[p]?.v || false]));
      const e: any = Object.fromEntries(allPages.map(p => [p, merged[p]?.e || false]));
      setEPermView(v);
      setEPermEdit(e);
    } catch {}
    setIsEditUserOpen(true);
  };

  const handleSaveEditUser = async () => {
    if (!editingUser) return;
    const name = `${eFirstName.trim()} ${eLastName.trim()}`.trim();
    if (!name || !eEmail.trim()) {
      toast({ title: "Missing info", description: "Name and email are required.", variant: "destructive" });
      return;
    }
    const patch: Partial<AppUser> = {
      name,
      email: eEmail.trim(),
      phone: ePhone || null,
  role: mapRole(eRole),
  department: normalizeDeptInput(eDepartment),
      status: eStatus === "inactive" ? "Inactive" : "Active",
      must_change_password: eMustChange,
    };
    try {
      let updated: AppUser | null = null;
      try {
        updated = await updateUser(editingUser.id, patch);
      } catch (e) {
        // Local fallback
        updated = { ...editingUser, ...patch } as AppUser;
        const next = users.map(u => (u.id === editingUser!.id ? updated! : u));
        setUsers(next);
        writeLocalUsers(next);
      }
      // If admin set a new password, apply via Supabase RPC or local fallback
      if (ePassword.trim()) {
        if (!hasSupabaseEnv) {
          const rawUsers = localStorage.getItem(LS_KEY);
          const list = rawUsers ? JSON.parse(rawUsers) as any[] : [];
          const idx = list.findIndex(u => u.id === editingUser.id);
          if (idx !== -1) {
            list[idx].password_hash = btoa(unescape(encodeURIComponent(ePassword.trim()))).slice(0, 32);
            localStorage.setItem(LS_KEY, JSON.stringify(list));
          }
        }
      }
      if (updated) {
        setUsers(prev => prev.map(u => (u.id === updated!.id ? updated! : u)));
      }
      // Persist property access mapping
      try { await setUserPropertyAccess(editingUser.id, editSelectedPropertyIds); } catch {}
      // Persist per-page permissions
      try {
        const payloadPerms = Object.fromEntries(allPages.map((p) => [p, { v: !!ePermView[p], e: !!ePermEdit[p] }])) as any;
        await setUserPermissions(editingUser.id, payloadPerms);
      } catch {}
      toast({ title: "User updated", description: `${name} has been saved.` });
      setIsEditUserOpen(false);
      setEditingUser(null);
    } catch (e: any) {
      toast({ title: "Update failed", description: e?.message || "Unable to update user.", variant: "destructive" });
    }
  };

  const handleDeleteUser = async (userId: string, name: string) => {
  const ok = window.confirm(`Are you sure you want to delete ${name}? This action cannot be undone.`);
  if (!ok) return;
    try {
      await deleteUser(userId);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      toast({ title: "User deleted", description: `${name} has been removed.`, variant: "destructive" });
    } catch (e: any) {
      // Fallback delete locally
      const next = users.filter((u) => u.id !== userId);
      setUsers(next);
      writeLocalUsers(next);
      toast({ title: "User deleted (local)", description: `${name} removed locally.`, variant: "destructive" });
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role.toLowerCase()) {
      case "admin":
        return "destructive";
      case "manager":
        return "default";
      default:
        return "secondary";
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    return status.toLowerCase() === "active" ? "default" : "secondary";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">User Management</h1>
          <p className="text-muted-foreground">
            Manage user accounts, roles, and permissions
          </p>
        </div>
        
    <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
          <DialogTrigger asChild>
      <Button className="w-full sm:w-auto" disabled={authRole !== 'admin'}>
              <Plus className="h-4 w-4 mr-2" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent className="w-[96vw] sm:max-w-3xl md:max-w-4xl max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Add New User</DialogTitle>
              <DialogDescription>
                Create a new user account for the system
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 flex-1 overflow-y-auto pr-1 no-scrollbar">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
          <Label htmlFor="firstName">First Name</Label>
          <Input id="firstName" placeholder="Abc" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                </div>
                <div className="space-y-2">
          <Label htmlFor="lastName">Last Name</Label>
          <Input id="lastName" placeholder="Abc" value={lastName} onChange={(e) => setLastName(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="abc@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" type="tel" placeholder="+1 (555) 123-4567" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="password">{mustChangePassword ? "Temporary Password" : "Password"}</Label>
                  <Input id="password" type="password" placeholder={mustChangePassword ? "Set a temporary password" : "Set a password"} value={password} onChange={(e) => setPassword(e.target.value)} />
                  <p className="text-xs text-muted-foreground">{mustChangePassword ? "User will be asked to change this on first login." : "This will be the user's password."}</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select value={role} onValueChange={setRole}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="department">Department</Label>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Select value={department} onValueChange={setDepartment}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select dept" />
                      </SelectTrigger>
                      <SelectContent>
                        {deptOptions.map(d => (
                          <SelectItem key={d.id} value={(d.name || '').toLowerCase()}>{d.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Dialog open={newDeptModalOpen} onOpenChange={setNewDeptModalOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" type="button">New</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add Department</DialogTitle>
                        <DialogDescription>Create a new department</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-2">
                        <Label>Name</Label>
                        <Input placeholder="e.g., IT" value={newDeptName} onChange={(e) => setNewDeptName(e.target.value)} />
                        <Label>Code</Label>
                        <Input placeholder="e.g., IT" value={newDeptCode} onChange={(e) => setNewDeptCode(e.target.value)} />
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setNewDeptModalOpen(false)}>Cancel</Button>
                        <Button onClick={async () => {
                          const name = newDeptName.trim();
                          if (!name) return;
                          try {
                            const created = await createDepartment({ name, code: (newDeptCode.trim() || null) });
                            setDeptOptions((opts) => [created, ...opts]);
                            setDepartment((created.name || '').toLowerCase());
                            setNewDeptName(""); setNewDeptCode(""); setNewDeptModalOpen(false);
                          } catch (e) {
                            console.error(e);
                            alert('Failed to create department. Check backend policies or connection.');
                          }
                        }}>Add</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
              {/* Page Permissions */}
              <div className="space-y-2">
                <Label>Page Permissions</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(['assets','properties','qrcodes','users','reports','settings'] as PageKey[]).map((p) => (
                    <div key={p} className="flex items-center justify-between gap-4 border rounded p-2 bg-muted/30">
                      <div className="text-sm font-medium capitalize">{p}</div>
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 text-xs">
                          <Checkbox checked={!!permView[p]} onCheckedChange={(v: any) => setPermView((s) => ({ ...s, [p]: Boolean(v) }))} />
                          View
                        </label>
                        <label className="flex items-center gap-2 text-xs">
                          <Checkbox checked={!!permEdit[p]} onCheckedChange={(v: any) => setPermEdit((s) => ({ ...s, [p]: Boolean(v) }))} />
                          Edit
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">Role provides baseline; these are additional per-user overrides.</p>
              </div>
              {/* Property Access - Dropdown multi-select */}
              <div className="space-y-2">
                <Label>Property Access</Label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="justify-between w-full gap-2 min-w-0">
                      <span className="truncate text-left flex-1 min-w-0">
                        {selectedPropertyIds.length > 0
                          ? (() => {
                              const map = new Map(properties.map(p => [p.id, p.name] as const));
                              const names = selectedPropertyIds.map(id => map.get(id) || id);
                              const preview = names.slice(0, 2).join(", ");
                              const extra = names.length - 2;
                              // If preview would be too long, show count only
                              const label = preview.length > 24 ? `${names.length} selected` : preview;
                              return `${label}${extra > 0 && label !== `${names.length} selected` ? ` +${extra}` : ""}`;
                            })()
                          : "Select properties (e.g., Abc, Abc)"}
                      </span>
                      <MoreHorizontal className="h-4 w-4 opacity-60" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-64 max-h-64 overflow-auto">
                    {properties.filter(p => (p.status || '').toLowerCase() === 'active').map((p) => {
                      const checked = selectedPropertyIds.includes(p.id);
                      return (
                        <DropdownMenuItem
                          key={p.id}
                          onSelect={(e) => {
                            e.preventDefault();
                            const next = new Set(selectedPropertyIds);
                            if (checked) next.delete(p.id); else next.add(p.id);
                            setSelectedPropertyIds(Array.from(next));
                          }}
                          className="gap-2 w-full"
                        >
                          <Checkbox className="shrink-0" checked={checked} onCheckedChange={() => {}} />
                          <span className="truncate flex-1 min-w-0" title={p.name}>{p.name}</span>
                        </DropdownMenuItem>
                      );
                    })}
                    {properties.filter(p => (p.status || '').toLowerCase() === 'active').length === 0 && (
                      <div className="px-2 py-1.5 text-xs text-muted-foreground">No active properties available.</div>
                    )}
                    {properties.filter(p => (p.status || '').toLowerCase() === 'active').length > 0 && (
                      <>
                        <div className="my-1 h-px bg-border" />
                        <DropdownMenuItem
                          onSelect={(e) => {
                            e.preventDefault();
                            const ids = properties.filter(p => (p.status || '').toLowerCase() === 'active').map(p => p.id);
                            setSelectedPropertyIds(ids);
                          }}
                          className="text-muted-foreground"
                        >
                          Select all
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={(e) => {
                            e.preventDefault();
                            setSelectedPropertyIds([]);
                          }}
                          className="text-muted-foreground"
                        >
                          Clear selection
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="flex items-center space-x-2 pt-1">
                <input id="mustChange" type="checkbox" className="h-4 w-4" checked={mustChangePassword} onChange={(e) => setMustChangePassword(e.target.checked)} />
                <Label htmlFor="mustChange">Require password change on first login</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddUserOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddUser}>
                <UserPlus className="h-4 w-4 mr-2" />
                Add User
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>System Users</CardTitle>
              <CardDescription>
                {filteredUsers.length} of {users.length} users
              </CardDescription>
            </div>
          </div>
          
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1 sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <div className="flex gap-2">
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-32">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">User</TableHead>
                  <TableHead className="hidden md:table-cell">Role</TableHead>
                  <TableHead className="hidden lg:table-cell">Department</TableHead>
                  <TableHead className="hidden sm:table-cell">Status</TableHead>
                  <TableHead className="hidden xl:table-cell">Last Login</TableHead>
                  <TableHead className="w-[70px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={user.avatar_url || undefined} alt={user.name} />
                          <AvatarFallback className="bg-muted text-foreground font-medium">
                            {getInitials(user.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="space-y-1">
                          <p className="text-sm font-medium">{user.name}</p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge variant={getRoleBadgeVariant(user.role)}>
                        {user.role === "Admin" && <Shield className="h-3 w-3 mr-1" />}
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {user.department ?? "-"}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant={getStatusBadgeVariant(user.status)}>
                        {user.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden xl:table-cell text-sm text-muted-foreground">
                      {user.last_login ? new Date(user.last_login).toLocaleDateString() : "-"}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {authRole === 'admin' && (
                          <DropdownMenuItem onClick={() => openEditUser(user)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          )}
                          {authRole === 'admin' && (
                            <DropdownMenuItem 
                              onClick={() => handleDeleteUser(user.id, user.name)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          
          {filteredUsers.length === 0 && !loading && (
            <div className="text-center py-8">
              <User className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">No users found</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit User Dialog */}
      <Dialog open={isEditUserOpen} onOpenChange={setIsEditUserOpen}>
        <DialogContent className="w-[96vw] sm:max-w-3xl md:max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update user details and access</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 flex-1 overflow-y-auto pr-1 no-scrollbar">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="efirstName">First Name</Label>
                <Input id="efirstName" placeholder="Abc" value={eFirstName} onChange={(e) => setEFirstName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="elastName">Last Name</Label>
                <Input id="elastName" placeholder="Abc" value={eLastName} onChange={(e) => setELastName(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="eemail">Email</Label>
              <Input id="eemail" type="email" placeholder="abc@example.com" value={eEmail} onChange={(e) => setEEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ephone">Phone</Label>
              <Input id="ephone" type="tel" placeholder="+1 (555) 123-4567" value={ePhone} onChange={(e) => setEPhone(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="erole">Role</Label>
                <Select value={eRole} onValueChange={setERole}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edepartment">Department</Label>
                <Select value={eDepartment} onValueChange={setEDepartment}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select dept" />
                  </SelectTrigger>
                  <SelectContent>
                    {deptOptions.map(d => (
                      <SelectItem key={d.id} value={(d.name || '').toLowerCase()}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="estatus">Status</Label>
              <Select value={eStatus} onValueChange={setEStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* Page Permissions (edit) */}
            <div className="space-y-2">
              <Label>Page Permissions</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(['assets','properties','qrcodes','users','reports','settings'] as PageKey[]).map((p) => (
                  <div key={p} className="flex items-center justify-between gap-4 border rounded p-2 bg-muted/30">
                    <div className="text-sm font-medium capitalize">{p}</div>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 text-xs">
                        <Checkbox checked={!!ePermView[p]} onCheckedChange={(v: any) => setEPermView((s) => ({ ...s, [p]: Boolean(v) }))} />
                        View
                      </label>
                      <label className="flex items-center gap-2 text-xs">
                        <Checkbox checked={!!ePermEdit[p]} onCheckedChange={(v: any) => setEPermEdit((s) => ({ ...s, [p]: Boolean(v) }))} />
                        Edit
                      </label>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Overrides apply on top of role defaults.</p>
            </div>
            {/* Property Access - Dropdown multi-select (edit) */}
            <div className="space-y-2">
              <Label>Property Access</Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="justify-between w-full gap-2 min-w-0">
                    <span className="truncate text-left flex-1 min-w-0">
                      {editSelectedPropertyIds.length > 0
                        ? (() => {
                            const map = new Map(properties.map(p => [p.id, p.name] as const));
                            const names = editSelectedPropertyIds.map(id => map.get(id) || id);
                            const preview = names.slice(0, 2).join(", ");
                            const extra = names.length - 2;
                            const label = preview.length > 24 ? `${names.length} selected` : preview;
                            return `${label}${extra > 0 && label !== `${names.length} selected` ? ` +${extra}` : ""}`;
                          })()
                        : "Select properties (e.g., Abc, Abc)"}
                    </span>
                    <MoreHorizontal className="h-4 w-4 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64 max-h-64 overflow-auto">
                  {properties.filter(p => (p.status || '').toLowerCase() === 'active').map((p) => {
                    const checked = editSelectedPropertyIds.includes(p.id);
                    return (
                      <DropdownMenuItem
                        key={p.id}
                        onSelect={(e) => {
                          e.preventDefault();
                          const next = new Set(editSelectedPropertyIds);
                          if (checked) next.delete(p.id); else next.add(p.id);
                          setEditSelectedPropertyIds(Array.from(next));
                        }}
                        className="gap-2 w-full"
                      >
                        <Checkbox className="shrink-0" checked={checked} onCheckedChange={() => {}} />
                        <span className="truncate flex-1 min-w-0" title={p.name}>{p.name}</span>
                      </DropdownMenuItem>
                    );
                  })}
                  {properties.filter(p => (p.status || '').toLowerCase() === 'active').length === 0 && (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">No active properties available.</div>
                  )}
                  {properties.filter(p => (p.status || '').toLowerCase() === 'active').length > 0 && (
                    <>
                      <div className="my-1 h-px bg-border" />
                      <DropdownMenuItem
                        onSelect={(e) => {
                          e.preventDefault();
                          const ids = properties.filter(p => (p.status || '').toLowerCase() === 'active').map(p => p.id);
                          setEditSelectedPropertyIds(ids);
                        }}
                        className="text-muted-foreground"
                      >
                        Select all
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={(e) => {
                          e.preventDefault();
                          setEditSelectedPropertyIds([]);
                        }}
                        className="text-muted-foreground"
                      >
                        Clear selection
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <div className="space-y-2 pt-2">
            <Label htmlFor="etemp">Set Password</Label>
            <Input id="etemp" type="password" placeholder="Leave blank to keep unchanged" value={ePassword} onChange={(e) => setEPassword(e.target.value)} />
            <p className="text-xs text-muted-foreground">Updates the user's password in the backend.</p>
            <div className="flex items-center space-x-2">
              <input id="emust" type="checkbox" className="h-4 w-4" checked={eMustChange} onChange={(e) => setEMustChange(e.target.checked)} />
              <Label htmlFor="emust">Require password change on next login</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditUserOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveEditUser}>
              <Edit className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* User Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Users</p>
                <p className="text-2xl font-bold">{users.length}</p>
              </div>
              <User className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Users</p>
                <p className="text-2xl font-bold text-primary">
                  {users.filter(u => u.status === "Active").length}
                </p>
              </div>
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <div className="h-2 w-2 rounded-full bg-primary"></div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Admins</p>
                <p className="text-2xl font-bold text-destructive">
                  {users.filter(u => u.role === "Admin").length}
                </p>
              </div>
              <Shield className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Departments</p>
                <p className="text-2xl font-bold">
                  {new Set(users.map(u => u.department || "")).size}
                </p>
              </div>
              <div className="h-8 w-8 rounded-full bg-accent flex items-center justify-center">
                <Calendar className="h-4 w-4 text-accent-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}