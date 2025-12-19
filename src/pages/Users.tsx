import { useEffect, useMemo, useState } from "react";
import { usePasswordConfirmation } from "@/hooks/use-password-confirmation";
import { isDemoMode } from "@/lib/demo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import StatusChip from "@/components/ui/status-chip";
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
  DialogClose,
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
  Users as UsersIcon,
  Mail,
  Phone,
  Filter,
  Building2,
  Key,
  Maximize2,
  Minimize2,
  Save,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { format } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AppUser, createUser, deleteUser, listUsers, updateUser } from "@/services/users";
import { listDepartments, createDepartment, updateDepartment, deleteDepartment, type Department } from "@/services/departments";
import { hasSupabaseEnv } from "@/lib/supabaseClient";
import { createPasswordHash, adminSetUserPassword } from "@/services/auth";
import { listProperties, type Property } from "@/services/properties";
import { listAuditInchargeForUser, setAuditInchargeForUser } from "@/services/audit";
import { listFinalApproverPropsForUser, listFinalApproverPropsForEmail, setFinalApproverPropsForUser, setFinalApproverPropsForEmail } from "@/services/finalApprover";
import { listUserPropertyAccess, setUserPropertyAccess } from "@/services/userAccess";
import { listUserDepartmentAccess, setUserDepartmentAccess } from "@/services/userDeptAccess";
import { listUserPermissions, setUserPermissions, type PageKey, roleDefaults, mergeDefaultsWithOverrides } from "@/services/permissions";
import Breadcrumbs from "@/components/layout/Breadcrumbs";
import { PageSkeleton, TableSkeleton } from "@/components/ui/page-skeletons";
import { cn } from "@/lib/utils";
import MetricCard from "@/components/ui/metric-card";

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
  avatar_url: null,
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
  avatar_url: null,
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
  avatar_url: null,
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
  avatar_url: null,
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
  const [propertyFilter, setPropertyFilter] = useState("all");
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isDepartmentsOpen, setIsDepartmentsOpen] = useState(false);
  const [isAddDialogMaximized, setIsAddDialogMaximized] = useState(false);
  const [isEditUserOpen, setIsEditUserOpen] = useState(false);
  const [isEditDialogMaximized, setIsEditDialogMaximized] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  // Reset password popup state
  const [isResetPwOpen, setIsResetPwOpen] = useState(false);
  const [resetTargetUser, setResetTargetUser] = useState<AppUser | null>(null);
  const [resetNewPassword, setResetNewPassword] = useState("");
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
  const [inchargePropertyIds, setInchargePropertyIds] = useState<string[]>([]);
  const [approverPropertyIds, setApproverPropertyIds] = useState<string[]>([]);
  const [userPropertyMap, setUserPropertyMap] = useState<Record<string, string[]>>({});
  const [authRole, setAuthRole] = useState<string>("");
  const [editSelectedPropertyIds, setEditSelectedPropertyIds] = useState<string[]>([]);
  const [editInchargePropertyIds, setEditInchargePropertyIds] = useState<string[]>([]);
  const [editApproverPropertyIds, setEditApproverPropertyIds] = useState<string[]>([]);
  const [deptOptions, setDeptOptions] = useState<Department[]>([]);
  // Full list for management UI (active + inactive)
  const [departmentsAll, setDepartmentsAll] = useState<Department[]>([]);
  const [deptLoading, setDeptLoading] = useState<boolean>(false);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [newDeptModalOpen, setNewDeptModalOpen] = useState(false);
  const [newDeptName, setNewDeptName] = useState("");
  const [newDeptCode, setNewDeptCode] = useState("");
  // Per-page permissions
  const allPages: PageKey[] = ['assets','properties','qrcodes','users','reports','settings','audit', 'all_properties', 'all_departments'];
  const [permView, setPermView] = useState<Record<PageKey, boolean>>({ assets:false, properties:false, qrcodes:false, users:false, reports:false, settings:false, audit:false, all_properties:false, all_departments:false });
  const [permEdit, setPermEdit] = useState<Record<PageKey, boolean>>({ assets:false, properties:false, qrcodes:false, users:false, reports:false, settings:false, audit:false, all_properties:false, all_departments:false });
  const [ePermView, setEPermView] = useState<Record<PageKey, boolean>>({ assets:false, properties:false, qrcodes:false, users:false, reports:false, settings:false, audit:false, all_properties:false, all_departments:false });
  const [ePermEdit, setEPermEdit] = useState<Record<PageKey, boolean>>({ assets:false, properties:false, qrcodes:false, users:false, reports:false, settings:false, audit:false, all_properties:false, all_departments:false });

  // Edit form fields
  const [eFirstName, setEFirstName] = useState("");
  const [eLastName, setELastName] = useState("");
  const [eEmail, setEEmail] = useState("");
  const [ePhone, setEPhone] = useState("");
  const [eRole, setERole] = useState<string | undefined>(undefined);
  const [eDepartment, setEDepartment] = useState<string | undefined>(undefined);
  const [editSelectedDepartments, setEditSelectedDepartments] = useState<string[]>([]);
  const [eStatus, setEStatus] = useState<string>("active");
  const [ePassword, setEPassword] = useState("");
  const [eMustChange, setEMustChange] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const { confirm: requirePassword, dialog: passwordDialog } = usePasswordConfirmation({
    title: "Verify password",
    description: "Enter your password to continue.",
  });

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

  // Load departments for selectors and management (fallbacks handled in service)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setDeptLoading(true);
      try {
        const deps = await listDepartments();
        if (!cancelled) {
          setDepartmentsAll(deps);
          setDeptOptions(deps.filter(d => d.is_active));
        }
      } catch {
        if (!cancelled) { setDepartmentsAll([]); setDeptOptions([]); }
      } finally {
        if (!cancelled) setDeptLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    try {
  const raw = (isDemoMode() ? (sessionStorage.getItem('demo_auth_user') || localStorage.getItem('demo_auth_user')) : null) || localStorage.getItem("auth_user");
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!users.length) {
        if (!cancelled) setUserPropertyMap({});
        return;
      }
      try {
        const entries = await Promise.all(
          users.map(async (user) => {
            try {
              const ids = await listUserPropertyAccess(user.id);
              return [user.id, ids.map((id) => String(id))] as const;
            } catch {
              return [user.id, [] as string[]] as const;
            }
          })
        );
        if (!cancelled) {
          const map: Record<string, string[]> = {};
          for (const [uid, ids] of entries) map[uid] = ids;
          setUserPropertyMap(map);
        }
      } catch {
        if (!cancelled) setUserPropertyMap({});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [users]);

  useEffect(() => {
    if (propertyFilter === "all") return;
    const exists = properties.some((p) => String(p.id) === propertyFilter);
    if (!exists) setPropertyFilter("all");
  }, [properties, propertyFilter]);

  const filteredUsers = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return users.filter((user) => {
      const matchesSearch =
        user.name.toLowerCase().includes(term) || user.email.toLowerCase().includes(term);
      const matchesRole = roleFilter === "all" || user.role.toLowerCase() === roleFilter;
      const matchesStatus =
        statusFilter === "all" || user.status.toLowerCase() === statusFilter;
      const propertyIds = userPropertyMap[user.id] || [];
      const matchesProperty =
        propertyFilter === "all" || propertyIds.some((pid) => String(pid) === propertyFilter);
      return matchesSearch && matchesRole && matchesStatus && matchesProperty;
    });
  }, [users, searchTerm, roleFilter, statusFilter, propertyFilter, userPropertyMap]);

  const userHighlights = useMemo(() => {
    const totalUsers = users.length;
    const activeUsers = users.filter((u) => (u.status || "").toLowerCase() === "active").length;
    const adminCount = users.filter((u) => (u.role || "").toLowerCase() === "admin").length;
    const departmentCount = new Set(
      users
        .map((u) => (u.department || "").trim())
        .filter(Boolean)
    ).size;

    return [
      {
        key: 'total',
        title: 'Total Users',
        icon: User,
        value: totalUsers.toLocaleString(),
        caption: 'Accounts in the system',
        iconClassName: 'text-primary h-4 w-4',
      },
      {
        key: 'active',
        title: 'Active Users',
        icon: UserPlus,
        value: activeUsers.toLocaleString(),
        caption: 'Currently enabled',
        iconClassName: 'text-primary h-4 w-4',
      },
      {
        key: 'admins',
        title: 'Admins',
        icon: Shield,
        value: adminCount.toLocaleString(),
        caption: 'Users with full access',
        iconClassName: 'text-primary h-4 w-4',
      },
      {
        key: 'departments',
        title: 'Departments',
        icon: UsersIcon,
        value: departmentCount.toLocaleString(),
        caption: 'Active department records',
        iconClassName: 'text-primary h-4 w-4',
      },
    ];
  }, [users]);

  // Inline validation helpers
  const emailInvalid = useMemo(() => (email.trim().length > 0 && !/^\S+@\S+\.\S+$/.test(email.trim())), [email]);
  const addRequiredMissing = useMemo(() => (!firstName.trim() || !lastName.trim() || !email.trim() || !role), [firstName, lastName, email, role]);

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
  // Normalize department against options to avoid duplicates like FinanceFINANCE
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
    const payload = {
      name,
      email: email.trim(),
  role: mapRole(role),
  department: normalizeDeptInput(department),
      phone: phone || null,
      last_login: null,
      status: "Active",
  avatar_url: null,
      must_change_password: mustChangePassword,
      password_changed_at: null,
      // password is used only for local fallback or future auth integration
      password: password || undefined,
    } as Omit<AppUser, "id"> & { password?: string };

    try {
      const created = await createUser(payload);
      // If Supabase is configured and a password is provided, set via admin RPC (prompts for admin password)
      if (hasSupabaseEnv && password) {
        try {
          const adminRaw = localStorage.getItem("auth_user");
          const adminEmail = adminRaw ? (JSON.parse(adminRaw).email || null) : null;
          if (adminEmail) {
            await adminSetUserPassword(adminEmail, "", created.id, password);
          }
        } catch (e) { console.error(e); }
      }
      // Persist property access mapping
      if (selectedPropertyIds.length) {
        try { await setUserPropertyAccess(created.id, selectedPropertyIds); } catch {}
      }
  // Persist department access mapping
  try {
        const res = await setUserDepartmentAccess(created.id, selectedDepartments);
        if (!res?.savedRemotely) {
          console.warn("Department access saved locally only (not remote)");
        }
      } catch {}
      // Persist per-page permissions
      try {
        const payloadPerms = Object.fromEntries(allPages.map((p) => [p, { v: !!permView[p], e: !!permEdit[p] }])) as any;
        await setUserPermissions(created.id, payloadPerms);
      } catch {}
      // Persist Auditor Incharge assignments
      try {
        if (inchargePropertyIds.length) {
          await setAuditInchargeForUser(created.id, created.name || null, inchargePropertyIds);
          try {
            // Auto-grant Audit page view permission when user becomes incharge
            await setUserPermissions(created.id, ({ audit: { v: true, e: true } } as unknown) as Partial<Record<PageKey, { v?: boolean; e?: boolean }>> as any);
          } catch {}
        }
      } catch {}
      // Persist Final Approver assignments (if any)
      try {
        if (approverPropertyIds.length) {
          try {
            if (created.email) {
              await setFinalApproverPropsForEmail(created.email, created.name || null, approverPropertyIds);
            } else {
              await setFinalApproverPropsForUser(created.id, created.name || null, approverPropertyIds);
            }
          } catch (e: any) {
            toast({ title: "Final Approver not saved", description: e?.message || "Could not persist Final Approver assignments.", variant: "destructive" });
          }
        }
      } catch {}
      setUsers((prev) => [created, ...prev]);
      setUserPropertyMap((prev) => ({
        ...prev,
        [created.id]: Array.from(new Set(selectedPropertyIds.map((id) => String(id)))),
      }));
      toast({ title: "User added", description: `${created.name} has been added.` });
    } catch (e: any) {
      // Fallback: persist to localStorage
      const hash = password ? await createPasswordHash(password) ?? undefined : undefined;
      const passwordChangedAt = hash ? new Date().toISOString() : payload.password_changed_at;
  type LocalAppUser = AppUser & { password_hash?: string };
  const local: LocalAppUser = {
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
        password_changed_at: passwordChangedAt,
    // local-only field for demo mode; not part of AppUser API in backend
    password_hash: hash,
  } as LocalAppUser;
      const next = [local, ...users];
      setUsers(next);
      writeLocalUsers(next);
      // Local mapping fallback
      if (selectedPropertyIds.length) {
        try { await setUserPropertyAccess(local.id, selectedPropertyIds); } catch {}
      }
  try { await setUserDepartmentAccess(local.id, selectedDepartments); } catch {}
      // Local per-page permissions fallback
      try {
        const payloadPerms = Object.fromEntries(allPages.map((p) => [p, { v: !!permView[p], e: !!permEdit[p] }])) as any;
        await setUserPermissions(local.id, payloadPerms);
      } catch {}
      // Local Auditor Incharge fallback
      try {
        if (inchargePropertyIds.length) {
          await setAuditInchargeForUser(local.id, local.name || null, inchargePropertyIds);
        }
      } catch {}
  // Final Approver assignments are Supabase-only. No local fallback.
      toast({ title: "User added (local)", description: `${local.name} stored locally.` });
      setUserPropertyMap((prev) => ({
        ...prev,
        [local.id]: Array.from(new Set(selectedPropertyIds.map((id) => String(id)))),
      }));
    }
    setIsAddUserOpen(false);
    setIsAddDialogMaximized(false);
    resetForm();
    // Reset permission toggles
  setPermView({ assets:false, properties:false, qrcodes:false, users:false, reports:false, settings:false, audit:false, all_properties:false, all_departments:false });
  setPermEdit({ assets:false, properties:false, qrcodes:false, users:false, reports:false, settings:false, audit:false, all_properties:false, all_departments:false });
  };

  const propertyAccessSummary = useMemo(() => {
    if (editSelectedPropertyIds.length === 0) return "No properties";
    return `${editSelectedPropertyIds.length} selected`;
  }, [editSelectedPropertyIds]);

  const inchargeSummary = useMemo(() => {
    if (editInchargePropertyIds.length === 0) return "No assignments";
    return `${editInchargePropertyIds.length} selected`;
  }, [editInchargePropertyIds]);

  const approverSummary = useMemo(() => {
    if (editApproverPropertyIds.length === 0) return "Not configured";
    return `${editApproverPropertyIds.length} selected`;
  }, [editApproverPropertyIds]);

  const deptAccessSummary = useMemo(() => {
    if (editSelectedDepartments.length === 0) return "No departments";
    return `${editSelectedDepartments.length} selected`;
  }, [editSelectedDepartments]);

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
    // Load properties where this user is Auditor Incharge
    try {
      const pids = await listAuditInchargeForUser(user.id, user.email || undefined);
      // Normalize returned IDs to match existing property IDs (case-insensitive mapping)
      const byLower = new Map<string, string>(properties.map(p => [String(p.id).toLowerCase(), String(p.id)]));
      const normalized = Array.from(new Set(pids.map(pid => byLower.get(String(pid).toLowerCase()) || String(pid))));
      setEditInchargePropertyIds(normalized);
    } catch {
      setEditInchargePropertyIds([]);
    }
    // Load properties where this user is Final Approver
    try {
  const pids2 = user?.email ? await listFinalApproverPropsForEmail(user.email) : await listFinalApproverPropsForUser(user.id);
      setEditApproverPropertyIds(pids2);
    } catch {
      setEditApproverPropertyIds([]);
    }
    try {
      const depts = await listUserDepartmentAccess(user.id);
      setEditSelectedDepartments(depts);
    } catch {
      setEditSelectedDepartments([]);
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
        if (hasSupabaseEnv) {
          try {
            const adminRaw = localStorage.getItem("auth_user");
            const adminEmail = adminRaw ? (JSON.parse(adminRaw).email || null) : null;
            if (adminEmail) {
              await adminSetUserPassword(adminEmail, "", editingUser.id, ePassword.trim());
            }
          } catch (e) { console.error(e); }
        } else {
          const rawUsers = localStorage.getItem(LS_KEY);
          const list = rawUsers ? JSON.parse(rawUsers) as any[] : [];
          const idx = list.findIndex(u => u.id === editingUser.id);
          if (idx !== -1) {
            const nextHash = await createPasswordHash(ePassword.trim());
            if (nextHash) {
              list[idx].password_hash = nextHash;
              list[idx].password_changed_at = new Date().toISOString();
              list[idx].must_change_password = false;
            }
            localStorage.setItem(LS_KEY, JSON.stringify(list));
          }
        }
      }
      if (updated) {
        setUsers(prev => prev.map(u => (u.id === updated!.id ? updated! : u)));
      }
      // Persist property access mapping
      try { await setUserPropertyAccess(editingUser.id, editSelectedPropertyIds); } catch {}
      setUserPropertyMap((prev) => ({
        ...prev,
        [editingUser.id]: Array.from(new Set(editSelectedPropertyIds.map((id) => String(id)))),
      }));
  // Persist department access mapping
  try {
        const res = await setUserDepartmentAccess(editingUser.id, editSelectedDepartments);
        if (!res?.savedRemotely) {
          console.warn("Department access saved locally only (not remote)");
        }
      } catch {}
      // Persist per-page permissions
      try {
        const payloadPerms = Object.fromEntries(allPages.map((p) => [p, { v: !!ePermView[p], e: !!ePermEdit[p] }])) as any;
        await setUserPermissions(editingUser.id, payloadPerms);
      } catch {}
      // Persist Auditor Incharge assignments (admin only UI but safe to call)
      try {
        await setAuditInchargeForUser(editingUser.id, updated?.name || null, editInchargePropertyIds);
        try {
          // If user has any incharge properties, ensure Audit page permission is granted
          if (editInchargePropertyIds && editInchargePropertyIds.length > 0) {
            await setUserPermissions(editingUser.id, ({ audit: { v: true, e: true } } as unknown) as Partial<Record<PageKey, { v?: boolean; e?: boolean }>> as any);
          }
        } catch {}
      } catch {}
      // Persist Final Approver assignments
      try {
        try {
          if (editingUser.email) {
            await setFinalApproverPropsForEmail(editingUser.email, updated?.name || null, editApproverPropertyIds);
          } else {
            await setFinalApproverPropsForUser(editingUser.id, updated?.name || null, editApproverPropertyIds);
          }
        } catch (e: any) {
          toast({ title: "Final Approver not saved", description: e?.message || "Could not persist Final Approver assignments.", variant: "destructive" });
        }
      } catch {}
      toast({ title: "User updated", description: `${name} has been saved.` });
      setIsEditUserOpen(false);
      setIsEditDialogMaximized(false);
      setEditingUser(null);
    } catch (e: any) {
      toast({ title: "Update failed", description: e?.message || "Unable to update user.", variant: "destructive" });
    }
  };

  const handleDeleteUser = async (userId: string, name: string) => {
    const ok = window.confirm(`Are you sure you want to delete ${name}? This action cannot be undone.`);
    if (!ok) return;
    const verified = await requirePassword({
      title: "Confirm user deletion",
      description: `Enter your password to delete ${name}.`,
      confirmLabel: "Delete User",
    });
    if (!verified) return;
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
  }

  const openResetPassword = (user: AppUser) => {
    setResetTargetUser(user);
    setResetNewPassword("");
    setIsResetPwOpen(true);
  };

  const handleConfirmResetPassword = async () => {
    if (!resetTargetUser) return;
    const newPw = resetNewPassword.trim();
    if (!newPw) {
      toast({ title: "Password required", description: "Please enter a new password.", variant: "destructive" });
      return;
    }
    try {
      if (hasSupabaseEnv) {
        try {
          const adminRaw = localStorage.getItem("auth_user");
          const adminEmail = adminRaw ? (JSON.parse(adminRaw).email || null) : null;
          if (!adminEmail) throw new Error("Admin email not found in session.");
          await adminSetUserPassword(adminEmail, "", resetTargetUser.id, newPw);
        } catch (e: any) {
          // If Supabase call fails, attempt local fallback below
          console.warn("Supabase reset failed, falling back to local.", e?.message || e);
          const rawUsers = localStorage.getItem(LS_KEY);
          const list = rawUsers ? (JSON.parse(rawUsers) as any[]) : [];
          const idx = list.findIndex((u) => u.id === resetTargetUser.id);
          if (idx !== -1) {
            const hash = await createPasswordHash(newPw);
            if (hash) {
              list[idx].password_hash = hash;
              list[idx].password_changed_at = new Date().toISOString();
              list[idx].must_change_password = false;
              localStorage.setItem(LS_KEY, JSON.stringify(list));
            }
          }
        }
      } else {
        // Local-only fallback
        const rawUsers = localStorage.getItem(LS_KEY);
        const list = rawUsers ? (JSON.parse(rawUsers) as any[]) : [];
        const idx = list.findIndex((u) => u.id === resetTargetUser.id);
        if (idx !== -1) {
          const hash = await createPasswordHash(newPw);
          if (hash) {
            list[idx].password_hash = hash;
            list[idx].password_changed_at = new Date().toISOString();
            list[idx].must_change_password = false;
            localStorage.setItem(LS_KEY, JSON.stringify(list));
          }
        }
      }
      toast({ title: "Password updated", description: `Password reset for ${resetTargetUser.name}.` });
      setIsResetPwOpen(false);
      setResetTargetUser(null);
      setResetNewPassword("");
    } catch (e: any) {
      toast({ title: "Reset failed", description: e?.message || "Unable to reset password.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      <Breadcrumbs items={[{ label: "Dashboard", to: "/" }, { label: "Users" }]} />
      <div className="relative overflow-hidden rounded-3xl border bg-card px-8 py-10 shadow-sm">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gradient-to-l from-primary/5 to-transparent blur-3xl" />
        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">People & Access</h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Curate roles, onboarding, and audit trails for everyone using SAMS
            </p>
          </div>
            <Dialog
              open={isAddUserOpen}
              onOpenChange={(open) => {
                setIsAddUserOpen(open);
                if (!open) {
                  setIsAddDialogMaximized(false);
                }
              }}
            >
              <DialogTrigger asChild>
                <Button className="w-full gap-2 sm:w-auto shadow-sm hover:shadow-md transition-all">
                  <Plus className="h-4 w-4" />
                  Add User
                </Button>
              </DialogTrigger>
              <DialogContent
                className={cn(
                  "mx-auto flex flex-col overflow-hidden rounded-3xl border border-border/60 bg-background/95 shadow-2xl",
                  isAddDialogMaximized
                    ? "h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] max-w-none sm:h-[calc(100vh-3rem)] sm:w-[calc(100vw-3rem)]"
                    : "h-[min(92vh,800px)] w-[calc(100vw-1.5rem)] max-w-4xl sm:w-full"
                )}
              >
                <DialogHeader className="space-y-1.5 border-b border-border/60 bg-muted/10 px-6 py-5 text-left sm:px-8">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <DialogTitle className="text-xl font-semibold tracking-tight">Add New User</DialogTitle>
                      <DialogDescription className="text-sm text-muted-foreground">
                        Create a new user account and configure access permissions
                      </DialogDescription>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setIsAddDialogMaximized((prev) => !prev)}
                      aria-label={isAddDialogMaximized ? "Restore dialog size" : "Maximize dialog"}
                      className="rounded-xl hover:bg-muted/50"
                    >
                      {isAddDialogMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                    </Button>
                  </div>
                </DialogHeader>
                
                {authRole !== 'admin' && (
                  <div className="mx-6 mt-4 rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive-foreground sm:mx-8">
                    You have view-only access. Contact an administrator to add users.
                  </div>
                )}

                <div className="no-scrollbar flex-1 overflow-y-auto bg-muted/5 px-6 py-6 sm:px-8">
                  <div className="space-y-8">
                    {/* Identity Section */}
                    <section className="space-y-4">
                      <div className="flex items-center gap-2 pb-2 border-b border-border/40">
                        <User className="h-4 w-4 text-primary" />
                        <h3 className="text-sm font-semibold text-foreground">Identity & Credentials</h3>
                      </div>
                      
                      <div className="grid gap-5 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="firstName" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">First Name <span className="text-destructive">*</span></Label>
                          <Input id="firstName" placeholder="e.g. Jane" value={firstName} onChange={(e) => setFirstName(e.target.value)} disabled={authRole !== 'admin'} className="bg-background" />
                          {!firstName.trim() && (<p className="text-[10px] text-destructive font-medium">Required</p>)}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="lastName" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Last Name <span className="text-destructive">*</span></Label>
                          <Input id="lastName" placeholder="e.g. Doe" value={lastName} onChange={(e) => setLastName(e.target.value)} disabled={authRole !== 'admin'} className="bg-background" />
                          {!lastName.trim() && (<p className="text-[10px] text-destructive font-medium">Required</p>)}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="email" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Email Address <span className="text-destructive">*</span></Label>
                          <Input id="email" type="email" placeholder="jane.doe@company.com" value={email} onChange={(e) => setEmail(e.target.value)} disabled={authRole !== 'admin'} className="bg-background" />
                          {(!email.trim()) && (<p className="text-[10px] text-destructive font-medium">Required</p>)}
                          {emailInvalid && (<p className="text-[10px] text-destructive font-medium">Invalid email format</p>)}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="phone" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Phone Number</Label>
                          <Input id="phone" type="tel" placeholder="+1 (555) 000-0000" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={authRole !== 'admin'} className="bg-background" />
                        </div>
                        <div className="space-y-2 sm:col-span-2">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="password" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{mustChangePassword ? "Temporary Password" : "Password"}</Label>
                            <div className="flex items-center space-x-2">
                              <Checkbox id="mustChange" checked={mustChangePassword} onCheckedChange={(c) => setMustChangePassword(!!c)} className="h-3.5 w-3.5" />
                              <Label htmlFor="mustChange" className="text-xs font-normal text-muted-foreground cursor-pointer">Require change on login</Label>
                            </div>
                          </div>
                          <Input id="password" type="password" placeholder={mustChangePassword ? "Set a temporary password" : "Set a secure password"} value={password} onChange={(e) => setPassword(e.target.value)} disabled={authRole !== 'admin'} className="bg-background" />
                        </div>
                      </div>
                    </section>

                    {/* Role & Organization Section */}
                    <section className="space-y-4">
                      <div className="flex items-center gap-2 pb-2 border-b border-border/40">
                        <Building2 className="h-4 w-4 text-primary" />
                        <h3 className="text-sm font-semibold text-foreground">Role & Organization</h3>
                      </div>
                      
                      <div className="grid gap-5 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="role" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">System Role <span className="text-destructive">*</span></Label>
                          <Select value={role} onValueChange={setRole} disabled={authRole !== 'admin'}>
                            <SelectTrigger className="bg-background">
                              <SelectValue placeholder="Select role" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="user">User</SelectItem>
                              <SelectItem value="manager">Manager</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                          </Select>
                          {!role && (<p className="text-[10px] text-destructive font-medium">Required</p>)}
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="department" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Department</Label>
                          <div className="flex gap-2">
                            <div className="flex-1">
                              <Select value={department} onValueChange={setDepartment} disabled={authRole !== 'admin'}>
                                <SelectTrigger className="bg-background">
                                  <SelectValue placeholder="Select department" />
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
                                <Button variant="outline" size="icon" type="button" disabled={authRole !== 'admin'} className="shrink-0 bg-background">
                                  <Plus className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Add Department</DialogTitle>
                                  <DialogDescription>Create a new department</DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                  <div className="space-y-2">
                                    <Label>Name</Label>
                                    <Input placeholder="e.g., IT" value={newDeptName} onChange={(e) => setNewDeptName(e.target.value)} />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Code</Label>
                                    <Input placeholder="e.g., IT" value={newDeptCode} onChange={(e) => setNewDeptCode(e.target.value)} />
                                  </div>
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
                                      alert('Failed to create department.');
                                    }
                                  }}>Add Department</Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                          </div>
                        </div>
                      </div>
                    </section>

                    {/* Access Control Section */}
                    <section className="space-y-4">
                      <div className="flex items-center gap-2 pb-2 border-b border-border/40">
                        <Shield className="h-4 w-4 text-primary" />
                        <h3 className="text-sm font-semibold text-foreground">Access Control</h3>
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-3">
                          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Page Permissions</Label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {(['assets','properties','qrcodes','users','reports','settings','audit'] as PageKey[])
                              .filter((p) => !(p === 'audit' && (role || '').toLowerCase() === 'user'))
                              .map((p) => (
                              <div key={p} className="flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-background p-3 shadow-sm">
                                <div className="text-sm font-medium capitalize">{p}</div>
                                <div className="flex items-center gap-3">
                                  <label className="flex items-center gap-1.5 text-xs cursor-pointer hover:text-primary transition-colors">
                                    <Checkbox checked={!!permView[p]} disabled={authRole !== 'admin'} onCheckedChange={(v: any) => setPermView((s) => ({ ...s, [p]: Boolean(v) }))} className="h-3.5 w-3.5" />
                                    View
                                  </label>
                                  <label className="flex items-center gap-1.5 text-xs cursor-pointer hover:text-primary transition-colors">
                                    <Checkbox checked={!!permEdit[p]} disabled={authRole !== 'admin'} onCheckedChange={(v: any) => setPermEdit((s) => ({ ...s, [p]: Boolean(v) }))} className="h-3.5 w-3.5" />
                                    Edit
                                  </label>
                                </div>
                              </div>
                            ))}
                          </div>
                          <p className="text-[10px] text-muted-foreground">Role provides baseline permissions; these are additional per-user overrides.</p>
                        </div>

                        <div className="grid gap-5 sm:grid-cols-2 pt-2">
                          {/* Property Access */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Property Access</Label>
                              <label className="flex items-center gap-1.5 text-xs cursor-pointer hover:text-primary transition-colors">
                                <Checkbox 
                                  checked={!!permView['all_properties']} 
                                  disabled={authRole !== 'admin'} 
                                  onCheckedChange={(v: any) => {
                                    setPermView((s) => ({ ...s, all_properties: Boolean(v) }));
                                    setPermEdit((s) => ({ ...s, all_properties: Boolean(v) }));
                                  }} 
                                  className="h-3.5 w-3.5" 
                                />
                                All Properties (Auto-assign)
                              </label>
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="outline" className="justify-between w-full bg-background" disabled={authRole !== 'admin' || !!permView['all_properties']}>
                                  <span className="truncate text-left flex-1 min-w-0 text-sm">
                                    {!!permView['all_properties'] 
                                      ? "All properties selected" 
                                      : (selectedPropertyIds.length > 0
                                        ? `${selectedPropertyIds.length} properties selected`
                                        : "Select properties")}
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
                                      <Checkbox className="shrink-0" checked={checked} disabled={authRole !== 'admin'} onCheckedChange={() => {}} />
                                      <span className="truncate flex-1 min-w-0" title={p.name}>{p.name}</span>
                                    </DropdownMenuItem>
                                  );
                                })}
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

                          {/* Department Access */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Department Access</Label>
                              <label className="flex items-center gap-1.5 text-xs cursor-pointer hover:text-primary transition-colors">
                                <Checkbox 
                                  checked={!!permView['all_departments']} 
                                  disabled={authRole !== 'admin'} 
                                  onCheckedChange={(v: any) => {
                                    setPermView((s) => ({ ...s, all_departments: Boolean(v) }));
                                    setPermEdit((s) => ({ ...s, all_departments: Boolean(v) }));
                                  }} 
                                  className="h-3.5 w-3.5" 
                                />
                                All Departments (Auto-assign)
                              </label>
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="outline" className="justify-between w-full bg-background" disabled={authRole !== 'admin' || !!permView['all_departments']}>
                                  <span className="truncate text-left flex-1 min-w-0 text-sm">
                                    {!!permView['all_departments']
                                      ? "All departments selected"
                                      : (selectedDepartments.length > 0
                                        ? `${selectedDepartments.length} departments selected`
                                        : "Select departments")}
                                  </span>
                                  <MoreHorizontal className="h-4 w-4 opacity-60" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start" className="w-64 max-h-64 overflow-auto">
                                {deptOptions.filter(d => d.is_active).map((d) => {
                                  const checked = selectedDepartments.includes(d.name);
                                  return (
                                    <DropdownMenuItem
                                      key={d.id}
                                      onSelect={(e) => {
                                        e.preventDefault();
                                        if (authRole !== 'admin') return;
                                        const next = new Set(selectedDepartments);
                                        if (checked) next.delete(d.name); else next.add(d.name);
                                        setSelectedDepartments(Array.from(next));
                                      }}
                                      className="gap-2 w-full"
                                    >
                                      <Checkbox className="shrink-0" checked={checked} disabled={authRole !== 'admin'} onCheckedChange={() => {}} />
                                      <span className="truncate flex-1 min-w-0" title={d.name}>{d.name}</span>
                                    </DropdownMenuItem>
                                  );
                                })}
                                {deptOptions.filter(d => d.is_active).length > 0 && (
                                  <>
                                    <div className="my-1 h-px bg-border" />
                                    <DropdownMenuItem
                                      onSelect={(e) => {
                                        e.preventDefault();
                                        if (authRole !== 'admin') return;
                                        const names = deptOptions.filter(d => d.is_active).map(d => d.name);
                                        setSelectedDepartments(names);
                                      }}
                                      className="text-muted-foreground"
                                    >
                                      Select all
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onSelect={(e) => {
                                        e.preventDefault();
                                        if (authRole !== 'admin') return;
                                        setSelectedDepartments([]);
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

                        {/* Advanced Roles (Admin Only) */}
                        {authRole === 'admin' && (
                          <div className="grid gap-5 sm:grid-cols-2 pt-2">
                            <div className="space-y-2">
                              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Final Approver</Label>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="outline" className="justify-between w-full bg-background" disabled={!(['manager','admin'].includes((role || '').toLowerCase()))}>
                                    <span className="truncate text-left flex-1 min-w-0 text-sm">
                                      {approverPropertyIds.length > 0
                                        ? `${approverPropertyIds.length} properties`
                                        : "Select properties"}
                                    </span>
                                    <MoreHorizontal className="h-4 w-4 opacity-60" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="w-64 max-h-64 overflow-auto">
                                  {properties.filter(p => (p.status || '').toLowerCase() === 'active').map((p) => {
                                    const checked = approverPropertyIds.includes(p.id);
                                    return (
                                      <DropdownMenuItem
                                        key={p.id}
                                        onSelect={(e) => {
                                          e.preventDefault();
                                          const next = new Set(approverPropertyIds);
                                          if (checked) next.delete(p.id); else next.add(p.id);
                                          setApproverPropertyIds(Array.from(next));
                                        }}
                                        className="gap-2 w-full"
                                      >
                                        <Checkbox className="shrink-0" checked={checked} onCheckedChange={() => {}} />
                                        <span className="truncate flex-1 min-w-0" title={p.name}>{p.name}</span>
                                      </DropdownMenuItem>
                                    );
                                  })}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>

                            <div className="space-y-2">
                              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Auditor Incharge</Label>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="outline" className="justify-between w-full bg-background">
                                    <span className="truncate text-left flex-1 min-w-0 text-sm">
                                      {inchargePropertyIds.length > 0
                                        ? `${inchargePropertyIds.length} properties`
                                        : "Select properties"}
                                    </span>
                                    <MoreHorizontal className="h-4 w-4 opacity-60" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="w-64 max-h-64 overflow-auto">
                                  {properties.filter(p => (p.status || '').toLowerCase() === 'active').map((p) => {
                                    const checked = inchargePropertyIds.some(id => String(id).toLowerCase() === String(p.id).toLowerCase());
                                    return (
                                      <DropdownMenuItem
                                        key={p.id}
                                        onSelect={(e) => {
                                          e.preventDefault();
                                          const next = new Set(inchargePropertyIds);
                                          if (checked) next.delete(p.id); else next.add(p.id);
                                          setInchargePropertyIds(Array.from(next));
                                        }}
                                        className="gap-2 w-full"
                                      >
                                        <Checkbox className="shrink-0" checked={checked} onCheckedChange={() => {}} />
                                        <span className="truncate flex-1 min-w-0" title={p.name}>{p.name}</span>
                                      </DropdownMenuItem>
                                    );
                                  })}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        )}
                      </div>
                    </section>
                  </div>
                </div>

                <DialogFooter className="gap-3 border-t border-border/60 bg-muted/10 px-6 py-5 sm:px-8">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsAddUserOpen(false);
                      setIsAddDialogMaximized(false);
                    }}
                    className="rounded-xl"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="button" 
                    onClick={handleAddUser} 
                    disabled={authRole !== 'admin' || addRequiredMissing || emailInvalid}
                    className="rounded-xl gap-2 transition-all"
                  >
                    <UserPlus className="h-4 w-4" />
                    Create User Account
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
        </div>
      </div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {userHighlights.map(({ key, title, icon: Icon, value, caption }) => (
        <MetricCard
          key={key}
          icon={Icon}
          title={title}
          value={value}
          caption={caption}
        />
      ))}
    </div>

      <Card className="rounded-3xl border border-border/60 bg-card/95 shadow-sm overflow-hidden">
        <CardHeader className="space-y-4 border-b border-border/60 bg-muted/5 px-6 py-6 sm:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-xl font-semibold tracking-tight text-foreground">User Directory</CardTitle>
              <CardDescription className="mt-1.5">
                Manage system access and view user details
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="h-7 rounded-lg border-border/60 bg-background px-3 font-medium">
                {filteredUsers.length} Users
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="border-b border-border/60 bg-background/50 p-4 sm:px-8 sm:py-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative w-full lg:max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
                <Input
                  placeholder="Search by name, email, or role..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-10 rounded-xl border-border/60 bg-background pl-10 shadow-sm focus-visible:ring-1 focus-visible:ring-primary/20"
                />
              </div>

              <div className="flex w-full flex-col gap-3 sm:flex-row sm:w-auto sm:items-center">
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="h-10 w-full rounded-xl border-border/60 bg-background shadow-sm sm:w-[140px]">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Filter className="h-3.5 w-3.5" />
                      <span className="text-foreground">{roleFilter === 'all' ? 'All Roles' : mapRole(roleFilter)}</span>
                    </div>
                  </SelectTrigger>
                  <SelectContent align="end" className="rounded-xl">
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="user">User</SelectItem>
                  </SelectContent>
                </Select>

                {properties.length > 0 && (
                  <Select value={propertyFilter} onValueChange={setPropertyFilter}>
                    <SelectTrigger className="h-10 w-full rounded-xl border-border/60 bg-background shadow-sm sm:w-[160px]">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Building2 className="h-3.5 w-3.5" />
                        <span className="truncate text-foreground">
                          {propertyFilter === 'all' 
                            ? 'All Properties' 
                            : properties.find(p => String(p.id) === propertyFilter)?.name || 'Property'}
                        </span>
                      </div>
                    </SelectTrigger>
                    <SelectContent align="end" className="rounded-xl">
                      <SelectItem value="all">All Properties</SelectItem>
                      {properties.map((prop) => (
                        <SelectItem key={prop.id} value={String(prop.id)}>
                          {prop.name || String(prop.id)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-10 w-full rounded-xl border-border/60 bg-background shadow-sm sm:w-[140px]">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <div className={cn("h-2 w-2 rounded-full", 
                        statusFilter === 'active' ? "bg-emerald-500" : 
                        statusFilter === 'inactive' ? "bg-destructive" : "bg-muted-foreground"
                      )} />
                      <span className="text-foreground">
                        {statusFilter === 'all' ? 'All Status' : 
                         statusFilter === 'active' ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </SelectTrigger>
                  <SelectContent align="end" className="rounded-xl">
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="p-8 space-y-4">
              <TableSkeleton rows={5} />
            </div>
          ) : (
            <div className="overflow-x-auto">
              {/* Desktop table */}
              <div className="hidden sm:block">
                <Table>
                  <TableHeader className="bg-muted/5">
                    <TableRow className="hover:bg-transparent border-border/60">
                      <TableHead className="h-12 min-w-[200px] pl-8 font-medium text-muted-foreground">User</TableHead>
                      <TableHead className="h-12 font-medium text-muted-foreground">Role</TableHead>
                      <TableHead className="h-12 font-medium text-muted-foreground">Department</TableHead>
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
                              {user.avatar_url && !String(user.avatar_url).includes('placeholder') && (
                                <AvatarImage src={user.avatar_url} alt={user.name} />
                              )}
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
                          <StatusChip status={user.status} />
                        </TableCell>
                        <TableCell className="hidden xl:table-cell text-sm text-muted-foreground">
                          {user.last_login
                            ? (() => {
                                try {
                                  return format(new Date(user.last_login), 'PP p');
                                } catch {
                                  return '-';
                                }
                              })()
                            : '-'}
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
                                <DropdownMenuItem onClick={() => openResetPassword(user)}>
                                  <Key className="h-4 w-4 mr-2" />
                                  Reset Password
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
              {/* Mobile cards */}
              <div className="sm:hidden space-y-2">
                {filteredUsers.map((user) => (
                  <Card key={user.id}>
                    <CardContent className="p-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          {user.avatar_url && !String(user.avatar_url).includes('placeholder') && (
                            <AvatarImage src={user.avatar_url} alt={user.name} />
                          )}
                          <AvatarFallback className="bg-muted text-foreground font-medium">
                            {getInitials(user.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{user.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                          <div className="mt-1 flex items-center gap-2">
                            <Badge variant={getRoleBadgeVariant(user.role)} className="text-xxs">
                              {user.role}
                            </Badge>
                            <StatusChip status={user.status} />
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="outline">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {authRole === 'admin' && (
                              <DropdownMenuItem onClick={() => openEditUser(user)}>
                                <Edit className="h-4 w-4 mr-2" /> Edit
                              </DropdownMenuItem>
                            )}
                            {authRole === 'admin' && (
                              <DropdownMenuItem onClick={() => openResetPassword(user)}>
                                <Key className="h-4 w-4 mr-2" /> Reset Password
                              </DropdownMenuItem>
                            )}
                            {authRole === 'admin' && (
                              <DropdownMenuItem
                                onClick={() => handleDeleteUser(user.id, user.name)}
                                className="text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" /> Delete
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {filteredUsers.length === 0 && !loading && (
           
            <div className="py-8 text-center">
              <User className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
              <p className="text-muted-foreground">No users found</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Departments management (moved from Settings) - Admin only and hidden in Demo */}
      {authRole === 'admin' && !isDemoMode() && (
        <Card className="rounded-2xl border border-border/60 bg-card/95 shadow-sm">
          <CardHeader className="space-y-4 border-b border-border/60 pb-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div 
                className="flex items-center gap-2 cursor-pointer select-none" 
                onClick={() => setIsDepartmentsOpen(!isDepartmentsOpen)}
              >
                {isDepartmentsOpen ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
                <div>
                  <CardTitle className="text-xl font-semibold">Departments</CardTitle>
                  <CardDescription>Manage department visibility, routing, and ownership</CardDescription>
                </div>
              </div>
              {isDepartmentsOpen && (
              <Dialog>
                <DialogTrigger asChild>
                  <Button className="gap-2 px-4 py-2">
                    <Plus className="h-4 w-4" />
                    Add Department
                  </Button>
                </DialogTrigger>
                <DepartmentEditorDialog
                  onSave={async (name, code) => {
                    if (!name.trim()) return;
                    try {
                      const created = await createDepartment({ name: name.trim(), code: code?.trim() || null });
                      setDepartmentsAll((prev) => [created, ...prev]);
                      // refresh active options
                     
                      setDeptOptions((prev) => [created, ...prev]);
                      toast({ title: 'Department added', description: `${created.name} created.` });
                                       } catch (e: any) {
                      toast({ title: 'Add failed', description: e?.message || 'Unable to add department.', variant: 'destructive' });
                    }
                  }}
                />
              </Dialog>
              )}
            </div>
          </CardHeader>
          {isDepartmentsOpen && (
          <CardContent className="sm:p-8">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[200px]">Name</TableHead>
                    <TableHead className="hidden sm:table-cell">Code</TableHead>
                    <TableHead className="hidden sm:table-cell">Status</TableHead>
                    <TableHead className="hidden md:table-cell">Created</TableHead>
                    <TableHead className="w-[70px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deptLoading ? (
                    <TableRow>
                      <TableCell colSpan={5}>
                        <div className="py-6 text-center text-sm text-muted-foreground">Loading departments…</div>
                      </TableCell>
                    </TableRow>
                  ) : departmentsAll.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5}>
                        <div className="py-6 text-center text-sm text-muted-foreground">No departments found</div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    departmentsAll.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell className="font-medium">{d.name}</TableCell>
                        <TableCell className="hidden sm:table-cell">{d.code || '—'}</TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <Badge variant={d.is_active ? 'default' : 'secondary'}>{d.is_active ? 'Active' : 'Inactive'}</Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                          {(() => { try { return d.created_at ? format(new Date(d.created_at), 'PP p') : '—'; } catch { return '—'; } })()}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <Dialog>
                                <DialogTrigger asChild>
                                  <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                    <Edit className="h-4 w-4 mr-2" /> Edit
                                  </DropdownMenuItem>
                                </DialogTrigger>
                                <DepartmentEditorDialog
                                  initialName={d.name}
                                  initialCode={d.code || ''}
                                  onSave={async (name, code) => {
                                    if (isDemoMode()) { toast({ title: 'Blocked in demo', description: 'Editing departments is disabled in demo.', variant: 'destructive' }); return; }
                                    try {
                                      const updated = await updateDepartment(d.id, { name: name.trim(), code: code?.trim() || null });
                                      setDepartmentsAll((prev) => prev.map(x => x.id === d.id ? updated : x));
                                      setDeptOptions((prev) => {
                                        const next = prev.map(x => x.id === d.id ? updated : x).filter(x => x.is_active);
                                        // ensure active-only list
                                        return next;
                                      });
                                      toast({ title: 'Department updated', description: `${updated.name} saved.` });
                                    } catch (e: any) {
                                      toast({ title: 'Update failed', description: e?.message || 'Unable to update department.', variant: 'destructive' });
                                    }
                                  }}
                                />
                              </Dialog>
                              <DropdownMenuItem
                                onClick={async () => {
                                  if (isDemoMode()) { toast({ title: 'Blocked in demo', description: 'Editing departments is disabled in demo.', variant: 'destructive' }); return; }
                                  try {
                                    const updated = await updateDepartment(d.id, { is_active: !d.is_active });
                                    setDepartmentsAll((prev) => prev.map(x => x.id === d.id ? updated : x));
                                    setDeptOptions((prev) => {
                                      const base = prev.filter(x => x.id !== d.id);
                                      return updated.is_active ? [updated, ...base] : base;
                                    });
                                  } catch (e: any) {
                                    toast({ title: 'Action failed', description: e?.message || 'Unable to toggle status.', variant: 'destructive' });
                                  }
                                }}
                              >
                                {d.is_active ? 'Deactivate' : 'Activate'}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={async () => {
                                  if (isDemoMode()) { toast({ title: 'Blocked in demo', description: 'Deleting departments is disabled in demo.', variant: 'destructive' }); return; }
                                  const ok = window.confirm(`Delete department "${d.name}"? This cannot be undone.`);
                                  if (!ok) return;
                                  try {
                                    await deleteDepartment(d.id);
                                    setDepartmentsAll((prev) => prev.filter(x => x.id !== d.id));
                                    setDeptOptions((prev) => prev.filter(x => x.id !== d.id));
                                    toast({ title: 'Department deleted', description: `${d.name} removed.` });
                                  } catch (e: any) {
                                    toast({ title: 'Delete failed', description: e?.message || 'Unable to delete department.', variant: 'destructive' });
                                  }
                                }}
                              >
                                <Trash2 className="h-4 w-4 mr-2" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
          )}
        </Card>
      )}

      {/* Reset Password Dialog */}
      <Dialog open={isResetPwOpen} onOpenChange={setIsResetPwOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              {resetTargetUser ? `Set a new password for ${resetTargetUser.name}` : 'Enter a new password'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="resetPassword">New Password</Label>
            <Input
              id="resetPassword"
              type="password"
              placeholder="Enter new password"
              value={resetNewPassword}
              onChange={(e) => setResetNewPassword(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsResetPwOpen(false)}>Cancel</Button>
            <Button onClick={handleConfirmResetPassword}>
              <Key className="h-4 w-4 mr-2" />
              Reset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog
        open={isEditUserOpen}
        onOpenChange={(open) => {
          setIsEditUserOpen(open);
          if (!open) {
            setIsEditDialogMaximized(false);
          }
        }}
      >
        <DialogContent
          className={cn(
            "mx-auto flex flex-col overflow-hidden rounded-3xl border border-border/60 bg-background/95 shadow-2xl",
            isEditDialogMaximized
              ? "h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] max-w-none sm:h-[calc(100vh-3rem)] sm:w-[calc(100vw-3rem)]"
              : "h-[min(92vh,800px)] w-[calc(100vw-1.5rem)] max-w-4xl sm:w-full"
          )}
        >
          <DialogHeader className="space-y-1.5 border-b border-border/60 bg-muted/10 px-6 py-5 text-left sm:px-8">
            <div className="flex items-start justify-between gap-3">
              <div>
                <DialogTitle className="text-xl font-semibold tracking-tight">Edit User</DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground">
                  Update user details and access permissions
                </DialogDescription>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsEditDialogMaximized((prev) => !prev)}
                aria-label={isEditDialogMaximized ? "Restore dialog size" : "Maximize dialog"}
                className="rounded-xl hover:bg-muted/50"
              >
                {isEditDialogMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
            </div>
          </DialogHeader>

          <div className="no-scrollbar flex-1 overflow-y-auto bg-muted/5 px-6 py-6 sm:px-8">
            <div className="space-y-8">
              {/* Identity Section */}
              <section className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-border/40">
                  <User className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">Identity & Credentials</h3>
                </div>
                
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="efirstName" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">First Name</Label>
                    <Input id="efirstName" placeholder="e.g. Jane" value={eFirstName} onChange={(e) => setEFirstName(e.target.value)} className="bg-background" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="elastName" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Last Name</Label>
                    <Input id="elastName" placeholder="e.g. Doe" value={eLastName} onChange={(e) => setELastName(e.target.value)} className="bg-background" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="eemail" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Email Address</Label>
                    <Input id="eemail" type="email" placeholder="jane.doe@company.com" value={eEmail} onChange={(e) => setEEmail(e.target.value)} className="bg-background" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ephone" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Phone Number</Label>
                    <Input id="ephone" type="tel" placeholder="+1 (555) 000-0000" value={ePhone} onChange={(e) => setEPhone(e.target.value)} className="bg-background" />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="etemp" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Set New Password</Label>
                      <div className="flex items-center space-x-2">
                        <Checkbox id="emust" checked={eMustChange} onCheckedChange={(c) => setEMustChange(!!c)} className="h-3.5 w-3.5" />
                        <Label htmlFor="emust" className="text-xs font-normal text-muted-foreground cursor-pointer">Require change on login</Label>
                      </div>
                    </div>
                    <Input id="etemp" type="password" placeholder="Leave blank to keep unchanged" value={ePassword} onChange={(e) => setEPassword(e.target.value)} className="bg-background" />
                  </div>
                </div>
              </section>

              {/* Role & Organization Section */}
              <section className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-border/40">
                  <Building2 className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">Role & Organization</h3>
                </div>
                
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="erole" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">System Role</Label>
                    <Select value={eRole} onValueChange={setERole}>
                      <SelectTrigger className="bg-background">
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
                    <Label htmlFor="edepartment" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Department</Label>
                    <Select value={eDepartment} onValueChange={setEDepartment}>
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        {deptOptions.map(d => (
                          <SelectItem key={d.id} value={(d.name || '').toLowerCase()}>{d.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="estatus" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Account Status</Label>
                    <Select value={eStatus} onValueChange={setEStatus}>
                      <SelectTrigger className="bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </section>

              {/* Access Control Section */}
              <section className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-border/40">
                  <Shield className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">Access Control</h3>
                </div>

                <div className="space-y-4">
                  <div className="space-y-3">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Page Permissions</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {(['assets','properties','qrcodes','users','reports','settings','audit'] as PageKey[])
                        .filter((p) => !(p === 'audit' && (eRole || '').toLowerCase() === 'user'))
                        .map((p) => (
                        <div key={p} className="flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-background p-3 shadow-sm">
                          <div className="text-sm font-medium capitalize">{p}</div>
                          <div className="flex items-center gap-3">
                            <label className="flex items-center gap-1.5 text-xs cursor-pointer hover:text-primary transition-colors">
                              <Checkbox checked={!!ePermView[p]} onCheckedChange={(v: any) => setEPermView((s) => ({ ...s, [p]: Boolean(v) }))} className="h-3.5 w-3.5" />
                              View
                            </label>
                            <label className="flex items-center gap-1.5 text-xs cursor-pointer hover:text-primary transition-colors">
                              <Checkbox checked={!!ePermEdit[p]} onCheckedChange={(v: any) => setEPermEdit((s) => ({ ...s, [p]: Boolean(v) }))} className="h-3.5 w-3.5" />
                              Edit
                            </label>
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-[10px] text-muted-foreground">Role provides baseline permissions; these are additional per-user overrides.</p>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2 pt-2">
                    {/* Property Access */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Property Access</Label>
                        <label className="flex items-center gap-1.5 text-xs cursor-pointer hover:text-primary transition-colors">
                          <Checkbox 
                            checked={!!ePermView['all_properties']} 
                            disabled={authRole !== 'admin'} 
                            onCheckedChange={(v: any) => {
                              setEPermView((s) => ({ ...s, all_properties: Boolean(v) }));
                              setEPermEdit((s) => ({ ...s, all_properties: Boolean(v) }));
                            }} 
                            className="h-3.5 w-3.5" 
                          />
                          All Properties (Auto-assign)
                        </label>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" className="justify-between w-full bg-background" disabled={authRole !== 'admin' || !!ePermView['all_properties']}>
                            <span className="truncate text-left flex-1 min-w-0 text-sm">
                              {!!ePermView['all_properties']
                                ? "All properties selected"
                                : (editSelectedPropertyIds.length > 0
                                  ? `${editSelectedPropertyIds.length} properties selected`
                                  : "Select properties")}
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
                                <Checkbox className="shrink-0" checked={checked} disabled={authRole !== 'admin'} onCheckedChange={() => {}} />
                                <span className="truncate flex-1 min-w-0" title={p.name}>{p.name}</span>
                              </DropdownMenuItem>
                            );
                          })}
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

                    {/* Department Access */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Department Access</Label>
                        <label className="flex items-center gap-1.5 text-xs cursor-pointer hover:text-primary transition-colors">
                          <Checkbox 
                            checked={!!ePermView['all_departments']} 
                            disabled={authRole !== 'admin'} 
                            onCheckedChange={(v: any) => {
                              setEPermView((s) => ({ ...s, all_departments: Boolean(v) }));
                              setEPermEdit((s) => ({ ...s, all_departments: Boolean(v) }));
                            }} 
                            className="h-3.5 w-3.5" 
                          />
                          All Departments (Auto-assign)
                        </label>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" className="justify-between w-full bg-background" disabled={authRole !== 'admin' || !!ePermView['all_departments']}>
                            <span className="truncate text-left flex-1 min-w-0 text-sm">
                              {!!ePermView['all_departments']
                                ? "All departments selected"
                                : (editSelectedDepartments.length > 0
                                  ? `${editSelectedDepartments.length} departments selected`
                                  : "Select departments")}
                            </span>
                            <MoreHorizontal className="h-4 w-4 opacity-60" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-64 max-h-64 overflow-auto">
                          {deptOptions.filter(d => d.is_active).map((d) => {
                            const checked = editSelectedDepartments.includes(d.name);
                            return (
                              <DropdownMenuItem
                                key={d.id}
                                onSelect={(e) => {
                                  e.preventDefault();
                                  if (authRole !== 'admin') return;
                                  const next = new Set(editSelectedDepartments);
                                  if (checked) next.delete(d.name); else next.add(d.name);
                                  setEditSelectedDepartments(Array.from(next));
                                }}
                                className="gap-2 w-full"
                              >
                                <Checkbox className="shrink-0" checked={checked} disabled={authRole !== 'admin'} onCheckedChange={() => {}} />
                                <span className="truncate flex-1 min-w-0" title={d.name}>{d.name}</span>
                              </DropdownMenuItem>
                            );
                          })}
                          {deptOptions.filter(d => d.is_active).length > 0 && (
                            <>
                              <div className="my-1 h-px bg-border" />
                              <DropdownMenuItem
                                onSelect={(e) => {
                                  e.preventDefault();
                                  if (authRole !== 'admin') return;
                                  const names = deptOptions.filter(d => d.is_active).map(d => d.name);
                                  setEditSelectedDepartments(names);
                                }}
                                className="text-muted-foreground"
                              >
                                Select all
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onSelect={(e) => {
                                  e.preventDefault();
                                  if (authRole !== 'admin') return;
                                  setEditSelectedDepartments([]);
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

                  {/* Advanced Roles (Admin Only) */}
                  {authRole === 'admin' && (
                    <div className="grid gap-5 sm:grid-cols-2 pt-2">
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Final Approver</Label>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="justify-between w-full bg-background" disabled={!(['manager','admin'].includes((eRole || '').toLowerCase()))}>
                              <span className="truncate text-left flex-1 min-w-0 text-sm">
                                {editApproverPropertyIds.length > 0
                                  ? `${editApproverPropertyIds.length} properties`
                                  : "Select properties"}
                              </span>
                              <MoreHorizontal className="h-4 w-4 opacity-60" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-64 max-h-64 overflow-auto">
                            {properties.filter(p => (p.status || '').toLowerCase() === 'active').map((p) => {
                              const checked = editApproverPropertyIds.includes(p.id);
                              return (
                                <DropdownMenuItem
                                  key={p.id}
                                  onSelect={(e) => {
                                    e.preventDefault();
                                    const next = new Set(editApproverPropertyIds);
                                    if (checked) next.delete(p.id); else next.add(p.id);
                                    setEditApproverPropertyIds(Array.from(next));
                                  }}
                                  className="gap-2 w-full"
                                >
                                  <Checkbox className="shrink-0" checked={checked} onCheckedChange={() => {}} />
                                  <span className="truncate flex-1 min-w-0" title={p.name}>{p.name}</span>
                                </DropdownMenuItem>
                              );
                            })}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Auditor Incharge</Label>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="justify-between w-full bg-background">
                              <span className="truncate text-left flex-1 min-w-0 text-sm">
                                {editInchargePropertyIds.length > 0
                                  ? `${editInchargePropertyIds.length} properties`
                                  : "Select properties"}
                              </span>
                              <MoreHorizontal className="h-4 w-4 opacity-60" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-64 max-h-64 overflow-auto">
                            {properties.filter(p => (p.status || '').toLowerCase() === 'active').map((p) => {
                              const checked = editInchargePropertyIds.some(id => String(id).toLowerCase() === String(p.id).toLowerCase());
                              return (
                                <DropdownMenuItem
                                  key={p.id}
                                  onSelect={(e) => {
                                    e.preventDefault();
                                    const next = new Set(editInchargePropertyIds);
                                    if (checked) next.delete(p.id); else next.add(p.id);
                                    setEditInchargePropertyIds(Array.from(next));
                                  }}
                                  className="gap-2 w-full"
                                >
                                  <Checkbox className="shrink-0" checked={checked} onCheckedChange={() => {}} />
                                  <span className="truncate flex-1 min-w-0" title={p.name}>{p.name}</span>
                                </DropdownMenuItem>
                              );
                            })}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            </div>
          </div>

          <DialogFooter className="gap-3 border-t border-border/60 bg-muted/10 px-6 py-5 sm:px-8">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsEditUserOpen(false);
                setIsEditDialogMaximized(false);
              }}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button 
              type="button" 
              onClick={handleSaveEditUser}
              className="rounded-xl gap-2 shadow-md hover:shadow-lg transition-all"
            >
              <Save className="h-4 w-4" />
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
        {passwordDialog}
    </div>
  );
}

// Inline Department Editor dialog component
function DepartmentEditorDialog({ initialName = "", initialCode = "", onSave }: { initialName?: string; initialCode?: string; onSave: (name: string, code?: string) => Promise<void> | void; }) {
  const [name, setName] = useState<string>(initialName);
  const [code, setCode] = useState<string>(initialCode);
  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>{initialName ? 'Edit Department' : 'Add Department'}</DialogTitle>
        <DialogDescription>{initialName ? 'Update department details' : 'Create a new department'}</DialogDescription>
      </DialogHeader>
      <div className="space-y-2">
        <Label htmlFor="dept_name">Name</Label>
        <Input id="dept_name" placeholder="e.g., IT" value={name} onChange={(e) => setName(e.target.value)} />
        <Label htmlFor="dept_code">Code</Label>
        <Input id="dept_code" placeholder="e.g., IT" value={code} onChange={(e) => setCode(e.target.value)} />
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline">Cancel</Button>
        </DialogClose>
        <DialogClose asChild>
          <Button disabled={!name.trim()} onClick={async () => { await onSave(name, code); }}>
            {initialName ? 'Save' : 'Add'}
          </Button>
        </DialogClose>
      </DialogFooter>
    </DialogContent>
  );
}
