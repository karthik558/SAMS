import { useEffect, useMemo, useState } from "react";
import { isDemoMode } from "@/lib/demo";
import { createTicket, listTickets, updateTicket, listTicketEvents, type Ticket } from "@/services/tickets";
import { listUsers, type AppUser } from "@/services/users";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Ticket as TicketIcon } from "lucide-react";
import { hasSupabaseEnv } from "@/lib/supabaseClient";
import DateRangePicker, { type DateRange } from "@/components/ui/date-range-picker";
import PageHeader from "@/components/layout/PageHeader";
import Breadcrumbs from "@/components/layout/Breadcrumbs";

export default function Tickets() {
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
  const [targetRole, setTargetRole] = useState<'admin' | 'manager'>('admin');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [range, setRange] = useState<DateRange>();

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
    })();
  }, []);

  const add = async () => {
    if (!title || !description) return;
    const currentUser = (() => { try { const raw = (isDemoMode() ? (sessionStorage.getItem('demo_auth_user') || localStorage.getItem('demo_auth_user')) : null) || localStorage.getItem('auth_user'); return raw ? JSON.parse(raw) : {}; } catch { return {}; } })();
    const createdBy = (currentUser?.email || currentUser?.id || 'user');
    const t = await createTicket({ title, description, targetRole, createdBy, priority });
    setItems((s) => [t, ...s]);
    setTitle("");
    setDescription("");
    setPriority('medium');
  const fallback = localStorage.getItem('tickets_fallback_reason');
  if (hasSupabaseEnv && !fallback) {
      toast.success('Ticket created');
    } else {
      toast.info('Ticket saved locally (Supabase not configured)');
    }
  };

  const setStatus = async (id: string, status: Ticket["status"]) => {
    try {
      const t = await updateTicket(id, { status });
      if (t) setItems((s) => s.map(i => i.id === id ? t : i));
    } catch (e: any) {
      const msg = (e?.message || '').toString();
      if (msg.includes('NOT_AUTHORIZED')) {
        toast.error('Only the assigned person can change the status.');
      } else {
        toast.error('Failed to update status.');
      }
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
    if (!range?.from) return base;
    const start = new Date(range.from.getFullYear(), range.from.getMonth(), range.from.getDate()).getTime();
    const to = range.to ?? range.from;
    const end = new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59, 999).getTime();
    return base.filter(t => {
      const ts = t?.createdAt ? new Date(t.createdAt).getTime() : NaN;
      return !isNaN(ts) && ts >= start && ts <= end;
    });
  }, [items, range, viewMode, currentActorId, currentActorEmail]);

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
  const assignToMe = async (id: string) => {
    const assignee = currentActorEmail || currentActorId;
    if (!assignee) { toast.error('Cannot determine your user identity.'); return; }
    try {
      const t = await updateTicket(id, { assignee });
      if (t) {
        setItems((s) => s.map(i => i.id === id ? t : i));
        toast.success('Assigned to you.');
      }
    } catch {
      toast.error('Failed to assign.');
    }
  };
  const fmt = (iso?: string | null) => {
    if (!iso) return '—';
    try { const d = new Date(iso); return d.toLocaleString(); } catch { return iso as string; }
  };

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Dashboard", to: "/" }, { label: "Tickets" }]} />
      <PageHeader icon={TicketIcon} title="Maintenance Tickets" />
      <Card>
        <CardHeader><CardTitle>New Ticket</CardTitle></CardHeader>
        <CardContent className="grid gap-3">
          <div className="grid gap-3 md:grid-cols-5">
            <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} className="md:col-span-2" />
            <Select value={targetRole} onValueChange={(v) => setTargetRole(v as 'admin' | 'manager')}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Target" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
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
            <Button onClick={add}>Create</Button>
          </div>
          <Textarea
            placeholder="Describe the issue in detail..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="min-h-28 resize-y"
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
                  <TabsTrigger value="received">Received</TabsTrigger>
                  <TabsTrigger value="raised">Raised</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <DateRangePicker value={range} onChange={setRange} />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {filteredItems.map(t => (
            <div key={t.id} className="border rounded p-4 bg-card">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="font-medium flex items-center gap-2">
                    <span>{t.id}</span>
                    <span className="text-foreground/80">•</span>
                    <span>{t.title}</span>
                  </div>
                  <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5">To: {t.targetRole}</span>
                    <span className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5">Status: {t.status}</span>
                    <span className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5">Assignee: {assigneeLabel(t)}</span>
                    <span className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5">Priority: {t.priority || 'medium'}</span>
                    <span className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5">SLA: {fmt(t.slaDueAt)}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">Created by: {t.createdBy} • {fmt(t.createdAt)}</div>
                  <div className="text-sm text-foreground mt-2 whitespace-pre-wrap">{t.description}</div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="flex gap-2">
                    {t.status !== 'closed' && canChangeStatus(t) && (
                      <>
                        <Button size="sm" variant={t.status==='open' ? 'default' : 'outline'} onClick={() => setStatus(t.id, 'open')}>Open</Button>
                        <Button size="sm" variant={t.status==='in_progress' ? 'default' : 'outline'} onClick={() => setStatus(t.id, 'in_progress')}>In Progress</Button>
                        <Button size="sm" variant={t.status==='resolved' ? 'default' : 'outline'} onClick={() => setStatus(t.id, 'resolved')}>Resolved</Button>
                        <Button size="sm" variant="outline" onClick={() => openCloseDialog(t.id)}>Closed</Button>
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
                <div className="mt-3 border-t pt-2 text-xs space-y-1">
                  {(events[t.id] || []).map(e => (
                    <div key={e.id} className="flex items-start gap-2">
                      <span className="text-muted-foreground w-52 shrink-0">{fmt(e.createdAt)} • {e.author}</span>
                      <span>{e.eventType}: {e.message}</span>
                    </div>
                  ))}
                  {!events[t.id]?.length && <div className="text-muted-foreground">No events yet.</div>}
                </div>
              )}
            </div>
          ))}
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
            <Button variant="outline" onClick={() => setCloseDialogOpen(false)}>Cancel</Button>
            <Button onClick={confirmClose}>Close Ticket</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
