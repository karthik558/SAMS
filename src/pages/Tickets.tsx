import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import type React from "react";
import { isDemoMode } from "@/lib/demo";
import { createTicket, listTickets, updateTicket, listTicketEvents, listAssigneesForProperty, type Ticket } from "@/services/tickets";
import { listUsers, type AppUser } from "@/services/users";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Ticket as TicketIcon } from "lucide-react";
import MetricCard from "@/components/ui/metric-card";
import { hasSupabaseEnv } from "@/lib/supabaseClient";
import DateRangePicker, { type DateRange } from "@/components/ui/date-range-picker";
import PageHeader from "@/components/layout/PageHeader";
import Breadcrumbs from "@/components/layout/Breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { listTicketComments, addTicketComment, type TicketComment } from "@/services/ticketComments";
import { PageSkeleton } from "@/components/ui/page-skeletons";
import { listProperties } from "@/services/properties";
import { getAccessiblePropertyIdsForCurrentUser } from "@/services/userAccess";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  PieChart,
  Pie,
  Cell,
  LabelList,
  LineChart,
  Line,
} from "recharts";

export default function Tickets() {
  const location = useLocation();
  const [items, setItems] = useState<Ticket[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [events, setEvents] = useState<Record<string, { id: string; createdAt: string; author: string; message: string; eventType: string }[]>>({});
  const [userMap, setUserMap] = useState<Record<string, { label: string }>>({});
  const [viewMode, setViewMode] = useState<'received' | 'raised'>('received');
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [closeNote, setCloseNote] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  // Property-aware assignment
  const [propertyId, setPropertyId] = useState<string>("");
  const [propertyOpts, setPropertyOpts] = useState<Array<{ id: string; name: string }>>([]);
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [assigneeOpts, setAssigneeOpts] = useState<Array<{ id: string; label: string }>>([]);
  const [assigneeRoleMap, setAssigneeRoleMap] = useState<Record<string, 'admin' | 'manager'>>({});
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [range, setRange] = useState<DateRange>();
  const [layout, setLayout] = useState<'list' | 'board'>('list');
  const [template, setTemplate] = useState<'none' | 'create_user'>('none');
  const [showClosedOnly, setShowClosedOnly] = useState(false);
  const [commentText, setCommentText] = useState<Record<string, string>>({});
  const [comments, setComments] = useState<Record<string, TicketComment[]>>({});
  const [initialLoading, setInitialLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState<Record<string, boolean>>({});
  const [assigning, setAssigning] = useState<Record<string, boolean>>({});
  const [closing, setClosing] = useState(false);
  const [posting, setPosting] = useState<Record<string, boolean>>({});

  useEffect(() => {
    (async () => {
      const raw = (isDemoMode() ? (sessionStorage.getItem('demo_auth_user') || localStorage.getItem('demo_auth_user')) : null) || localStorage.getItem('auth_user');
      let role: string | null = null;
      let me: string | null = null;
      try {
        const u = raw ? JSON.parse(raw) : null;
        role = (u?.role || '').toLowerCase() || null;
        me = u?.email || u?.id || null;
      } catch {}
      // Build user directory for assignee display
      try {
        const users = await listUsers();
        const map: Record<string, { label: string }> = {};
        (users as AppUser[]).forEach(u => {
          const label = (u.name || u.email || u.id);
          map[u.id] = { label };
        });
        setUserMap(map);
      } catch {}

      const meId = (() => { try { const u = raw ? JSON.parse(raw) : null; return u?.id || null; } catch { return null; } })();
      const meEmail = me;
      if (role === 'admin') {
        const assignedById = meId ? await listTickets({ assignee: meId }) : [];
        const assignedByEmail = meEmail ? await listTickets({ assignee: meEmail }) : [];
        const createdById = meId ? await listTickets({ createdBy: meId }) : [];
        const createdByEmail = meEmail ? await listTickets({ createdBy: meEmail }) : [];
        const mapMerge = new Map<string, Ticket>();
        [...assignedById, ...assignedByEmail, ...createdById, ...createdByEmail].forEach(t => mapMerge.set(t.id, t));
        setItems(Array.from(mapMerge.values()));
      } else if (role === 'manager') {
        const assignedById = meId ? await listTickets({ assignee: meId }) : [];
        const assignedByEmail = meEmail ? await listTickets({ assignee: meEmail }) : [];
        const createdById = meId ? await listTickets({ createdBy: meId }) : [];
        const createdByEmail = meEmail ? await listTickets({ createdBy: meEmail }) : [];
        const mapMerge = new Map<string, Ticket>();
        [...assignedById, ...assignedByEmail, ...createdById, ...createdByEmail].forEach(t => mapMerge.set(t.id, t));
        setItems(Array.from(mapMerge.values()));
      } else {
        // Regular user: only tickets they created
        const createdById = meId ? await listTickets({ createdBy: meId }) : [];
        const createdByEmail = meEmail ? await listTickets({ createdBy: meEmail }) : [];
        const mapMerge = new Map<string, Ticket>();
        [...createdById, ...createdByEmail].forEach(t => mapMerge.set(t.id, t));
        setItems(Array.from(mapMerge.values()));
      }
  const fallback = localStorage.getItem('tickets_fallback_reason');
      if (!hasSupabaseEnv || fallback) {
        toast.info('Supabase not configured or unreachable; tickets are saved locally.');
      }
  setInitialLoading(false);
      // Load accessible properties for current user and populate options
      try {
        const accessible = await getAccessiblePropertyIdsForCurrentUser();
        const allProps = await listProperties();
        const filtered = allProps.filter(p => accessible.size === 0 || accessible.has(String(p.id)));
        setPropertyOpts(filtered.map(p => ({ id: p.id, name: p.name })));
        if (filtered[0]) setPropertyId(filtered[0].id);
      } catch {}

    })();
  }, []);

  // Refresh assignee options when property changes
  useEffect(() => {
    (async () => {
      if (!propertyId) { setAssigneeOpts([]); setAssigneeRoleMap({}); setAssigneeId(""); return; }
      try {
        const list = await listAssigneesForProperty(propertyId);
        setAssigneeOpts(list.map(a => ({ id: a.id, label: a.label })));
        const map: Record<string, 'admin' | 'manager'> = {};
        list.forEach(a => { map[a.id] = a.role; });
        setAssigneeRoleMap(map);
        setAssigneeId("");
      } catch {
        setAssigneeOpts([]);
        setAssigneeRoleMap({});
      }
    })();
  }, [propertyId]);

  // If navigated with a ticket id (e.g., /tickets?id=TCK-123456), auto-expand and scroll to it.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const focusId = params.get('id');
    if (!focusId || items.length === 0) return;
    const t = items.find(i => i.id === focusId);
    if (!t) return;
    // If the ticket is closed and closed are hidden, switch to show only closed so it is visible
    if (t.status === 'closed') {
      // Delay to next tick to avoid filtering race on initial load
      setTimeout(() => setShowClosedOnly(true), 0);
    }
    setExpanded(s => ({ ...s, [focusId]: true }));
    // Smooth scroll into view if present in DOM
    setTimeout(() => {
      const el = document.getElementById(`ticket-${focusId}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }, [location.search, items]);

  const add = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!title.trim() || !description.trim() || !propertyId) { toast.error('Please enter title, description, and select a property.'); return; }
    setCreating(true);
    const currentUser = (() => { try { const raw = (isDemoMode() ? (sessionStorage.getItem('demo_auth_user') || localStorage.getItem('demo_auth_user')) : null) || localStorage.getItem('auth_user'); return raw ? JSON.parse(raw) : {}; } catch { return {}; } })();
    const createdBy = (currentUser?.email || currentUser?.id || 'user');
    const tempId = `temp_${Date.now()}`;
    const optimistic: Ticket = { id: tempId, title: title.trim(), description: description.trim(), targetRole: (assigneeId ? (assigneeRoleMap[assigneeId] || 'manager') : 'manager'), createdBy, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), status: 'open', assignee: assigneeId || null, priority, slaDueAt: null, closeNote: null, propertyId } as any;
    setItems((s) => [optimistic, ...s]);
    toast.message('Creating ticket…');
    try {
      const t = await createTicket({ title: title.trim(), description: description.trim(), createdBy, priority, propertyId, assignee: assigneeId || null, targetRole: assigneeId ? assigneeRoleMap[assigneeId] : undefined });
      setItems((s) => [t, ...s.filter(i => i.id !== tempId)]);
      setTitle("");
      setDescription("");
      setPriority('medium');
      setAssigneeId("");
      // keep property selected
      const fallback = localStorage.getItem('tickets_fallback_reason');
      if (hasSupabaseEnv && !fallback) toast.success('Ticket created'); else toast.info('Ticket saved locally (Supabase not configured)');
    } catch (err) {
      setItems((s) => s.filter(i => i.id !== tempId));
      toast.error('Failed to create ticket');
    } finally {
      setCreating(false);
    }
  };

  const setStatus = async (id: string, status: Ticket["status"]) => {
    const prev = items.find(i => i.id === id)?.status;
    setUpdatingStatus(s => ({ ...s, [id]: true }));
    setItems((s) => s.map(i => i.id === id ? { ...i, status } : i));
    try {
      const t = await updateTicket(id, { status });
      if (t) setItems((s) => s.map(i => i.id === id ? t : i));
      toast.success(`Marked as ${status.replace('_',' ')}`);
    } catch (e: any) {
      setItems((s) => s.map(i => i.id === id ? { ...i, status: prev as any } : i));
      const msg = (e?.message || '').toString();
      if (msg.includes('NOT_AUTHORIZED')) {
        toast.error('Only the assigned person can change the status.');
      } else {
        toast.error('Failed to update status.');
      }
    } finally {
      setUpdatingStatus(s => ({ ...s, [id]: false }));
    }
  };

  const openCloseDialog = (id: string) => {
    setClosingId(id);
    setCloseNote("");
    setCloseDialogOpen(true);
  };
  const confirmClose = async () => {
    if (!closingId) return;
    try {
      const t = await updateTicket(closingId, { status: 'closed' }, { message: closeNote.trim() || undefined });
      if (t) setItems((s) => s.map(i => i.id === closingId ? t : i));
      setCloseDialogOpen(false);
      setClosingId(null);
      setCloseNote("");
      toast.success('Ticket closed');
    } catch (e: any) {
      const msg = (e?.message || '').toString();
      if (msg.includes('NOT_AUTHORIZED')) toast.error('Only the assigned person can close this ticket.');
      else toast.error('Failed to close ticket.');
    }
  };

  const toggleEvents = async (id: string) => {
    setExpanded(s => ({ ...s, [id]: !s[id] }));
    if (!events[id]) {
      const evs = await listTicketEvents(id);
      setEvents(s => ({ ...s, [id]: evs.map(e => ({ id: e.id, createdAt: e.createdAt, author: e.author, message: e.message, eventType: e.eventType })) }));
    }
    // Lazy load comments the first time we expand
    if (!comments[id]) {
      try { const list = await listTicketComments(id); setComments((s)=>({ ...s, [id]: list })); } catch {}
    }
  };

  // Current actor details (used by filters and permissions)
  const currentUser = (() => { try { const raw = (isDemoMode() ? (sessionStorage.getItem('demo_auth_user') || localStorage.getItem('demo_auth_user')) : null) || localStorage.getItem('auth_user'); return raw ? JSON.parse(raw) : {}; } catch { return {}; } })();
  const currentActorId = (currentUser?.id || '') as string;
  const currentActorEmail = (currentUser?.email || '') as string;
  const currentRole = String(currentUser?.role || '').toLowerCase();
  const canAssign = currentRole === 'admin' || currentRole === 'manager';

  const filteredItems = useMemo(() => {
    // Date filter
    let base = items;
    // Mode filter: received vs raised
    const ids = [currentActorId, currentActorEmail].filter(Boolean).map(String);
    if (viewMode === 'received') {
      base = base.filter(t => t.assignee && ids.some(v => String(t.assignee) === v));
    } else {
      base = base.filter(t => ids.some(v => String(t.createdBy) === v));
    }
    if (showClosedOnly) {
      base = base.filter(t => t.status === 'closed');
    } else {
      // Hide closed by default
      base = base.filter(t => t.status !== 'closed');
    }
    if (!range?.from) return base;
    const start = new Date(range.from.getFullYear(), range.from.getMonth(), range.from.getDate()).getTime();
    const to = range.to ?? range.from;
    const end = new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59, 999).getTime();
    return base.filter(t => {
      const ts = t?.createdAt ? new Date(t.createdAt).getTime() : NaN;
      return !isNaN(ts) && ts >= start && ts <= end;
    });
  }, [items, range, viewMode, currentActorId, currentActorEmail, showClosedOnly]);

  // Helpers
  const canChangeStatus = (t: Ticket) => {
    if (!t.assignee) return false;
    return [currentActorId, currentActorEmail].filter(Boolean).some(v => String(t.assignee) === String(v));
  };
  const assigneeLabel = (t: Ticket) => {
    if (!t.assignee) return 'Unassigned';
    const key = String(t.assignee);
    // If it's an email, show as-is; if it looks like an id, map to name/email
    if (key.includes('@')) return key;
    return userMap[key]?.label || key;
  };
  const initials = (nameOrEmail: string) => {
    try {
      const s = (nameOrEmail || '').trim();
      if (!s) return '?';
      const at = s.indexOf('@');
      const base = at > 0 ? s.slice(0, at) : s;
      const parts = base.split(/[\s._-]+/).filter(Boolean);
      const first = (parts[0] || base)[0] || '?';
      const second = parts.length > 1 ? (parts[1][0] || '') : '';
      return (first + second).toUpperCase();
    } catch { return '?'; }
  };
  const assignToMe = async (id: string) => {
    const assignee = currentActorEmail || currentActorId;
    if (!assignee) { toast.error('Cannot determine your user identity.'); return; }
    try {
      setAssigning(s => ({ ...s, [id]: true }));
      const prev = items.find(i => i.id === id)?.assignee;
      setItems((s) => s.map(i => i.id === id ? { ...i, assignee } : i));
      const t = await updateTicket(id, { assignee });
      if (t) {
        setItems((s) => s.map(i => i.id === id ? t : i));
        toast.success('Assigned to you.');
      }
    } catch {
      const prev = items.find(i => i.id === id)?.assignee;
      setItems((s) => s.map(i => i.id === id ? { ...i, assignee: prev || null } : i));
      toast.error('Failed to assign.');
    } finally {
      setAssigning(s => ({ ...s, [id]: false }));
    }
  };

  const ticketMetrics = useMemo(() => {
    const base = filteredItems;
    const statusCounts: Record<Ticket['status'], number> = {
      open: 0,
      in_progress: 0,
      resolved: 0,
      closed: 0,
    };
    const priorityCounts: Record<'low' | 'medium' | 'high' | 'urgent', number> = {
      low: 0,
      medium: 0,
      high: 0,
      urgent: 0,
    };
    let totalAgeMs = 0;
    let ageCount = 0;
    let totalResolutionMs = 0;
    let resolutionCount = 0;
    const now = Date.now();

    base.forEach((ticket) => {
      statusCounts[ticket.status] += 1;
      if (ticket.priority && priorityCounts[ticket.priority] !== undefined) {
        priorityCounts[ticket.priority] += 1;
      }

      if (ticket.createdAt) {
        const createdTs = new Date(ticket.createdAt).getTime();
        if (!Number.isNaN(createdTs)) {
          totalAgeMs += Math.max(0, now - createdTs);
          ageCount += 1;
          if ((ticket.status === 'resolved' || ticket.status === 'closed') && ticket.updatedAt) {
            const resolvedTs = new Date(ticket.updatedAt).getTime();
            if (!Number.isNaN(resolvedTs) && resolvedTs >= createdTs) {
              totalResolutionMs += resolvedTs - createdTs;
              resolutionCount += 1;
            }
          }
        }
      }
    });

    const total = base.length;
    const completed = statusCounts.resolved + statusCounts.closed;
    const backlog = statusCounts.open + statusCounts.in_progress;

    return {
      total,
      statusCounts,
      priorityCounts,
      backlog,
      completionRate: total ? Math.round((completed / total) * 100) : 0,
      avgAgeHours: ageCount ? totalAgeMs / ageCount / (1000 * 60 * 60) : 0,
      avgResolutionHours: resolutionCount ? totalResolutionMs / resolutionCount / (1000 * 60 * 60) : null,
    };
  }, [filteredItems]);

  const statusChartData = useMemo(() => {
    const colors: Record<Ticket['status'], string> = {
      open: 'hsl(var(--warning))',
      in_progress: 'hsl(var(--primary))',
      resolved: 'hsl(var(--success))',
      closed: 'hsl(var(--muted-foreground))',
    };
    return (Object.entries(ticketMetrics.statusCounts) as Array<[Ticket['status'], number]>).map(([key, value]) => ({
      key,
      label: key === 'in_progress' ? 'In Progress' : key.charAt(0).toUpperCase() + key.slice(1),
      value,
      fill: colors[key],
    }));
  }, [ticketMetrics.statusCounts]);

  const priorityChartData = useMemo(() => {
    const colors: Record<'low' | 'medium' | 'high' | 'urgent', string> = {
      low: '#64748b',
      medium: '#0ea5e9',
      high: '#f59e0b',
      urgent: '#ef4444',
    };
    return (Object.entries(ticketMetrics.priorityCounts) as Array<['low' | 'medium' | 'high' | 'urgent', number]>).map(([key, value]) => ({
      key,
      label: key.charAt(0).toUpperCase() + key.slice(1),
      value,
      fill: colors[key],
    }));
  }, [ticketMetrics.priorityCounts]);

  const monthlyTrend = useMemo(() => {
    const map = new Map<string, { label: string; created: number; resolved: number; sort: number }>();
    filteredItems.forEach((ticket) => {
      const created = ticket.createdAt ? new Date(ticket.createdAt) : null;
      if (created && !Number.isNaN(created.getTime())) {
        const key = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, '0')}`;
        const sort = created.getFullYear() * 100 + created.getMonth();
        if (!map.has(key)) {
          map.set(key, {
            label: created.toLocaleString(undefined, { month: 'short', year: '2-digit' }),
            created: 0,
            resolved: 0,
            sort,
          });
        }
        map.get(key)!.created += 1;
      }

      if ((ticket.status === 'resolved' || ticket.status === 'closed') && ticket.updatedAt) {
        const resolvedAt = new Date(ticket.updatedAt);
        if (!Number.isNaN(resolvedAt.getTime())) {
          const key = `${resolvedAt.getFullYear()}-${String(resolvedAt.getMonth() + 1).padStart(2, '0')}`;
          const sort = resolvedAt.getFullYear() * 100 + resolvedAt.getMonth();
          if (!map.has(key)) {
            map.set(key, {
              label: resolvedAt.toLocaleString(undefined, { month: 'short', year: '2-digit' }),
              created: 0,
              resolved: 0,
              sort,
            });
          }
          map.get(key)!.resolved += 1;
        }
      }
    });

    return Array.from(map.values())
      .sort((a, b) => a.sort - b.sort)
      .slice(-6);
  }, [filteredItems]);

  const ChartTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-md border border-border/70 bg-card/95 px-3 py-2 text-xs shadow-sm">
        {label ? <div className="mb-1 font-medium text-foreground">{label}</div> : null}
        <div className="space-y-1">
          {payload.map((entry: any, idx: number) => (
            <div key={idx} className="flex items-center gap-2">
              {entry?.color ? (
                <span className="inline-flex h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
              ) : null}
              <span className="text-muted-foreground">{entry.name}</span>
              <span className="font-medium text-foreground">{entry.value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };
  const fmt = (iso?: string | null) => {
    if (!iso) return '—';
    try { const d = new Date(iso); return d.toLocaleString(); } catch { return iso as string; }
  };
  const slaBadge = (t: Ticket) => {
    if (!t.slaDueAt) return null;
    let label = '';
    let color = 'bg-muted text-foreground';
    try {
      const now = Date.now();
      const due = new Date(t.slaDueAt).getTime();
      const diffMs = due - now;
      const abs = Math.abs(diffMs);
      const hrs = Math.floor(abs / 3600000);
      const mins = Math.floor((abs % 3600000) / 60000);
      if (diffMs < 0) {
        label = `Overdue ${hrs}h ${mins}m`;
        color = 'bg-red-100 text-red-800 border-red-200';
      } else if (diffMs <= 24 * 3600000) {
        label = `Due in ${hrs}h ${mins}m`;
        color = 'bg-amber-100 text-amber-900 border-amber-200';
      } else {
        const days = Math.ceil(diffMs / (24*3600000));
        label = `Due in ${days}d`;
        color = 'bg-emerald-100 text-emerald-900 border-emerald-200';
      }
    } catch { label = fmt(t.slaDueAt); }
    return <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs ${color}`}>SLA: {label}</span>;
  };
  const statusColor = (status: Ticket["status"]) => {
    switch (status) {
      case 'open':
        return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/40 dark:text-blue-200 dark:border-blue-800';
      case 'in_progress':
        return 'bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-800';
      case 'resolved':
        return 'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-900/40 dark:text-sky-200 dark:border-sky-800';
      case 'closed':
        return 'bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-200 dark:border-emerald-800';
      default:
        return 'bg-muted text-foreground dark:bg-muted dark:text-foreground';
    }
  };
  const priorityColor = (priority: NonNullable<Ticket["priority"]>) => {
    switch (priority) {
      case 'low':
        return 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700';
      case 'medium':
        return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/40 dark:text-blue-200 dark:border-blue-800';
      case 'high':
        return 'bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-800';
      case 'urgent':
        return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/40 dark:text-red-200 dark:border-red-800';
      default:
        return 'bg-muted text-foreground dark:bg-muted dark:text-foreground';
    }
  };
  const addComment = async (id: string) => {
    const msg = (commentText[id] || '').trim();
    if (!msg) return;
    // Prevent commenting on closed tickets
    const ticket = items.find(i => i.id === id);
    if (ticket?.status === 'closed') {
      toast.error('Ticket is closed; comments are disabled.');
      return;
    }
    try {
      const c = await addTicketComment(id, msg);
      setComments(s => ({ ...s, [id]: [...(s[id]||[]), c] }));
      setCommentText(s => ({ ...s, [id]: '' }));
    } catch { toast.error('Failed to add comment'); }
  };
  

  // Kanban helpers
  const columns: { key: Ticket["status"]; label: string }[] = [
    { key: 'open', label: 'Open' },
    { key: 'in_progress', label: 'In Progress' },
    { key: 'resolved', label: 'Resolved' },
    { key: 'closed', label: 'Closed' },
  ];
  const grouped = useMemo(() => {
    const map: Record<string, Ticket[]> = { open: [], in_progress: [], resolved: [], closed: [] };
    for (const t of filteredItems) map[t.status].push(t);
    return map as Record<Ticket['status'], Ticket[]>;
  }, [filteredItems]);
  const onDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
  };
  const onDropTo = (e: React.DragEvent, status: Ticket['status']) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain');
    if (!id) return;
    if (status === 'closed') { openCloseDialog(id); return; }
    setStatus(id, status);
  };

  const formatDuration = (hours: number | null | undefined) => {
    if (hours == null || Number.isNaN(hours)) return '—';
    if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m`;
    if (hours < 24) return `${Math.round(hours)}h`;
    return `${Math.round(hours / 24)}d`;
  };

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Dashboard", to: "/" }, { label: "Tickets" }]} />
      <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm sm:p-8">
        <PageHeader
          icon={TicketIcon}
          title="Maintenance Tickets"
          description="Monitor, triage, and resolve maintenance issues across your properties"
        />
      </div>
      <section className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            icon={TicketIcon}
            title="Tickets in View"
            value={ticketMetrics.total.toLocaleString()}
            caption="Filtered by mode, date, and closed toggle"
          />
          <MetricCard
            icon={TicketIcon}
            title="Active Backlog"
            value={ticketMetrics.backlog.toLocaleString()}
            caption="Open plus in-progress tickets"
            iconClassName="text-amber-500 dark:text-amber-300"
            valueClassName="text-amber-600 dark:text-amber-300"
          />
          <MetricCard
            icon={TicketIcon}
            title="Completion Rate"
            value={`${ticketMetrics.completionRate}%`}
            caption="Resolved or closed in the current view"
            iconClassName="text-emerald-500 dark:text-emerald-300"
            valueClassName="text-emerald-600 dark:text-emerald-300"
          />
          <MetricCard
            icon={TicketIcon}
            title="Avg Resolution"
            value={formatDuration(ticketMetrics.avgResolutionHours)}
            caption="Mean time from open to finished"
            iconClassName="text-sky-500 dark:text-sky-300"
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.5fr,1fr]">
          <Card className="rounded-2xl border border-border/70 bg-card/95 shadow-sm">
            <CardHeader className="pb-1">
              <CardTitle>Status Overview</CardTitle>
              <CardDescription>Tickets split across workflow stages</CardDescription>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statusChartData} margin={{ top: 12, right: 24, left: 24, bottom: 12 }}>
                    <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="4 4" strokeOpacity={0.35} vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <RechartsTooltip content={<ChartTooltip />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.2 }} />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {statusChartData.map((entry) => (
                        <Cell key={entry.key} fill={entry.fill} />
                      ))}
                      <LabelList dataKey="value" position="top" className="text-xs font-medium" fill="hsl(var(--foreground))" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-border/70 bg-card/95 shadow-sm">
            <CardHeader className="pb-1">
              <CardTitle>Priority Mix</CardTitle>
              <CardDescription>Relative share of priorities in the filtered list</CardDescription>
            </CardHeader>
            <CardContent className="px-0 pb-4 space-y-4">
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={priorityChartData} dataKey="value" innerRadius={55} outerRadius={90} paddingAngle={3}>
                      {priorityChartData.map((entry) => (
                        <Cell key={entry.key} fill={entry.fill} />
                      ))}
                      <LabelList dataKey="value" position="outside" className="text-[11px] font-medium" fill="hsl(var(--foreground))" />
                    </Pie>
                    <RechartsTooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap gap-2 px-6 text-xs text-muted-foreground">
                {priorityChartData.map((entry) => (
                  <span key={entry.key} className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-3 py-1">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.fill }} />
                    <span>{entry.label}</span>
                    <span className="font-semibold text-foreground">{entry.value}</span>
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {monthlyTrend.length ? (
          <Card className="rounded-2xl border border-border/70 bg-card/95 shadow-sm">
            <CardHeader className="pb-1">
              <CardTitle>Monthly Throughput</CardTitle>
              <CardDescription>Created versus resolved tickets across the last six months</CardDescription>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyTrend} margin={{ top: 12, right: 24, left: 24, bottom: 12 }}>
                    <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="4 4" strokeOpacity={0.35} />
                    <XAxis dataKey="label" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <RechartsTooltip content={<ChartTooltip />} />
                    <Line type="monotone" dataKey="created" name="Created" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="resolved" name="Resolved" stroke="hsl(var(--success))" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </section>

      <Card>
        <CardHeader><CardTitle>New Ticket</CardTitle></CardHeader>
        <CardContent className="grid gap-3">
          <div className="grid gap-3 md:grid-cols-6">
            <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} className="md:col-span-2" />
            <Select value={propertyId} onValueChange={(v) => setPropertyId(v)}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Property" /></SelectTrigger>
              <SelectContent>
                {propertyOpts.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.id} • {p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={assigneeId} onValueChange={(v) => setAssigneeId(v)}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Assign to (Managers for property, or Admin)" /></SelectTrigger>
              <SelectContent>
                {assigneeOpts.map(a => (
                  <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={priority} onValueChange={(v) => setPriority(v as any)}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Priority" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={add} disabled={!propertyId || creating}>{creating ? 'Creating…' : 'Create'}</Button>
          </div>
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="template">Insert template</Label>
            <Select
              value={template}
              onValueChange={(v) => {
                const val = (v as 'none' | 'create_user');
                if (val === 'create_user') {
                  if (!title.trim()) setTitle('Create User');
                  const tpl = [
                    'Create User Request',
                    '',
                    '| Field           | Value                  |',
                    '|-----------------|------------------------|',
                    '| Email           | user@example.com       |',
                    '| Full name       | FirstN LastN           |',
                    '| Department      | Engineering            |',
                    '| Property Access | Property 1, Property 2 |',
                    '',
                    'Additional notes:',
                    '-',
                  ].join('\n');
                  setDescription(tpl);
                }
                // Reset selector back to none for a lightweight UX
                setTemplate('none');
              }}
            >
              <SelectTrigger id="template" className="w-56">
                <SelectValue placeholder="Choose Template" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="create_user">Create User</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Textarea
            placeholder="Describe the issue in detail..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="min-h-48 resize-y"
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <CardTitle>Tickets</CardTitle>
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
                <TabsList>
          <TabsTrigger value="received" aria-label="Received tickets">Received</TabsTrigger>
          <TabsTrigger value="raised" aria-label="Raised tickets">Raised</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <DateRangePicker value={range} onChange={setRange} />
              <Button
                variant={showClosedOnly ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShowClosedOnly(v => !v)}
                aria-pressed={showClosedOnly}
                aria-label="Toggle closed-only filter"
              >
                {showClosedOnly ? 'Closed only' : 'Show closed'}
              </Button>
              <ToggleGroup type="single" value={layout} onValueChange={(v) => v && setLayout(v as any)}>
                <ToggleGroupItem value="list" aria-label="List view">List</ToggleGroupItem>
                <ToggleGroupItem value="board" aria-label="Board view">Board</ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {initialLoading ? (
            <PageSkeleton />
          ) : layout === 'list' ? (
            filteredItems.map(t => (
              <div key={t.id} id={`ticket-${t.id}`} className="border rounded p-4 bg-card">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="font-medium flex items-center gap-2">
                      <span>{t.id}</span>
                      <span className="text-foreground/80">•</span>
                      <span>{t.title}</span>
                    </div>
                    <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5">To: {t.targetRole}</span>
                      <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 ${statusColor(t.status)}`}>Status: {t.status}</span>
                      <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 ${priorityColor(t.priority || 'medium')}`}>Priority: {t.priority || 'medium'}</span>
                      {slaBadge(t)}
                      <span className="inline-flex items-center gap-2 rounded border px-1.5 py-0.5">
                        <Avatar className="h-5 w-5"><AvatarFallback className="text-[10px]">{initials(assigneeLabel(t))}</AvatarFallback></Avatar>
                        <span>Assignee: {assigneeLabel(t)}</span>
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">Created by: {t.createdBy} • {fmt(t.createdAt)}</div>
                    <div className="text-sm text-foreground mt-2 whitespace-pre-wrap">{t.description}</div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="flex gap-2">
                      {t.status !== 'closed' && canChangeStatus(t) && (
                        <>
                          <Button aria-label={`Mark ticket ${t.id} open`} size="sm" variant={t.status==='open' ? 'default' : 'outline'} onClick={() => setStatus(t.id, 'open')} disabled={!!updatingStatus[t.id]}>{updatingStatus[t.id] ? '…' : 'Open'}</Button>
                          <Button aria-label={`Mark ticket ${t.id} in progress`} size="sm" variant={t.status==='in_progress' ? 'default' : 'outline'} onClick={() => setStatus(t.id, 'in_progress')} disabled={!!updatingStatus[t.id]}>{updatingStatus[t.id] ? '…' : 'In Progress'}</Button>
                          <Button aria-label={`Mark ticket ${t.id} resolved`} size="sm" variant={t.status==='resolved' ? 'default' : 'outline'} onClick={() => setStatus(t.id, 'resolved')} disabled={!!updatingStatus[t.id]}>{updatingStatus[t.id] ? '…' : 'Resolved'}</Button>
                          <Button aria-label={`Close ticket ${t.id}`} size="sm" variant="outline" onClick={() => openCloseDialog(t.id)} disabled={!!updatingStatus[t.id]}>Closed</Button>
                        </>
                      )}
                      {t.status !== 'closed' && !canChangeStatus(t) && canAssign && (
                        <Button size="sm" variant="outline" onClick={() => assignToMe(t.id)}>Assign to me</Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => toggleEvents(t.id)}>Log</Button>
                    </div>
                  </div>
                </div>
                {expanded[t.id] && (
                  <div className="mt-3 border-t pt-3 space-y-3">
                    <div className="text-xs space-y-1">
                      {(events[t.id] || []).map(e => (
                        <div key={e.id} className="flex items-start gap-2">
                          <span className="text-muted-foreground w-52 shrink-0">{fmt(e.createdAt)} • {e.author}</span>
                          <span>{e.eventType}: {e.message}</span>
                        </div>
                      ))}
                      {!events[t.id]?.length && <div className="text-muted-foreground">No events yet.</div>}
                    </div>
                    <div className="text-xs space-y-2">
                      <div className="font-medium">Comments</div>
                      <div className="space-y-1">
                        {(comments[t.id]||[]).map(c => (
                          <div key={c.id} className="flex items-start gap-2">
                            <span className="text-muted-foreground w-52 shrink-0">{fmt(c.createdAt)} • {c.author}</span>
                            <span>{c.message}</span>
                          </div>
                        ))}
                        {t.status !== 'closed' ? (
                          <div className="flex items-center gap-2">
                            <Input aria-label={`Add comment to ticket ${t.id}`} placeholder="Add comment" value={commentText[t.id]||''} onChange={(e)=> setCommentText(s=>({ ...s, [t.id]: e.target.value }))} />
                            <Button aria-label={`Post comment on ticket ${t.id}`} size="sm" onClick={() => addComment(t.id)} disabled={posting[t.id] || !(commentText[t.id]||'').trim()}>{posting[t.id] ? 'Posting…' : 'Post'}</Button>
                          </div>
                        ) : (
                          <div className="text-muted-foreground">Ticket is closed. Comments are disabled.</div>
                        )}
                      </div>
                    </div>
                    
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {columns.map(col => (
                <div key={col.key} className="rounded border bg-background">
                  <div className="px-3 py-2 border-b bg-muted/50 text-sm font-medium flex items-center justify-between">
                    <span>{col.label}</span>
                    <Badge variant="secondary">{grouped[col.key].length}</Badge>
                  </div>
                  <div
                    className="p-2 min-h-[200px] space-y-2"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => onDropTo(e, col.key)}
                  >
                    {grouped[col.key].map(t => (
                      <div
                        key={t.id}
                        id={`ticket-${t.id}`}
                        className="rounded border bg-card p-3 shadow-sm cursor-grab"
                        draggable={t.status !== 'closed' && canChangeStatus(t)}
                        onDragStart={(e) => onDragStart(e, t.id)}
                      >
                        <div className="text-xs text-muted-foreground mb-1 flex items-center justify-between">
                          <span>{t.id}</span>
                          <span className="inline-flex items-center gap-1">
                            <Badge variant="outline">{t.priority || 'medium'}</Badge>
                          </span>
                        </div>
                        <div className="font-medium text-sm">{t.title}</div>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-2 text-xs">
                            <Avatar className="h-5 w-5"><AvatarFallback className="text-[10px]">{initials(assigneeLabel(t))}</AvatarFallback></Avatar>
                            <span className="truncate max-w-[140px]">{assigneeLabel(t)}</span>
                          </span>
                          <span className="text-xs">{slaBadge(t)}</span>
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          {t.status !== 'closed' && !canChangeStatus(t) && canAssign && (
                            <Button size="sm" variant="outline" onClick={() => assignToMe(t.id)}>Assign to me</Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => toggleEvents(t.id)}>Log</Button>
                        </div>
                        {expanded[t.id] && (
                          <div className="mt-2 border-t pt-2 text-[11px] space-y-1">
                            {(events[t.id] || []).map(e => (
                              <div key={e.id} className="flex items-start gap-2">
                                <span className="text-muted-foreground w-40 shrink-0">{fmt(e.createdAt)} • {e.author}</span>
                                <span>{e.eventType}: {e.message}</span>
                              </div>
                            ))}
                            {!events[t.id]?.length && <div className="text-muted-foreground">No events yet.</div>}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Close ticket</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Optional: add a closing note.</p>
            <Textarea
              placeholder="Add closing description (optional)"
              value={closeNote}
              onChange={(e) => setCloseNote(e.target.value)}
              className="min-h-[6rem]"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseDialogOpen(false)} disabled={closing}>Cancel</Button>
            <Button aria-label="Confirm close ticket" onClick={confirmClose} disabled={closing}>{closing ? 'Closing…' : 'Close Ticket'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
