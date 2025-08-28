import { useEffect, useState } from "react";
import { createTicket, listTickets, updateTicket, listTicketEvents, type Ticket } from "@/services/tickets";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { toast } from "sonner";
import { hasSupabaseEnv } from "@/lib/supabaseClient";

export default function Tickets() {
  const [items, setItems] = useState<Ticket[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [events, setEvents] = useState<Record<string, { id: string; createdAt: string; author: string; message: string; eventType: string }[]>>({});
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetRole, setTargetRole] = useState<'admin' | 'manager'>('admin');

  useEffect(() => {
    (async () => {
      const raw = localStorage.getItem('auth_user');
      let role: string | null = null;
      let me: string | null = null;
      try { const u = raw ? JSON.parse(raw) : null; role = u?.role || null; me = u?.email || u?.id || null; } catch {}
      if (role === 'admin') {
        setItems(await listTickets());
      } else if (role === 'manager') {
        const mine = me ? await listTickets({ createdBy: me }) : [];
        const managed = await listTickets({ targetRole: 'manager' });
        // de-duplicate
        const map = new Map<string, any>();
        [...managed, ...mine].forEach(t => map.set(t.id, t));
        setItems(Array.from(map.values()));
      } else {
        setItems(me ? await listTickets({ createdBy: me }) : []);
      }
      const fallback = localStorage.getItem('tickets_fallback_reason');
      if (!hasSupabaseEnv || fallback) {
        toast.info('Supabase not configured or unreachable; tickets are saved locally.');
      }
    })();
  }, []);

  const add = async () => {
    if (!title || !description) return;
    const currentUser = (() => { try { return JSON.parse(localStorage.getItem('auth_user') || '{}'); } catch { return {}; } })();
    const createdBy = (currentUser?.email || currentUser?.id || 'user');
    const t = await createTicket({ title, description, targetRole, createdBy });
    setItems((s) => [t, ...s]);
    setTitle("");
    setDescription("");
  const fallback = localStorage.getItem('tickets_fallback_reason');
  if (hasSupabaseEnv && !fallback) {
      toast.success('Ticket created');
    } else {
      toast.info('Ticket saved locally (Supabase not configured)');
    }
  };

  const setStatus = async (id: string, status: Ticket["status"]) => {
    const t = await updateTicket(id, { status });
    if (t) setItems((s) => s.map(i => i.id === id ? t : i));
  };

  const toggleEvents = async (id: string) => {
    setExpanded(s => ({ ...s, [id]: !s[id] }));
    if (!events[id]) {
      const evs = await listTicketEvents(id);
      setEvents(s => ({ ...s, [id]: evs.map(e => ({ id: e.id, createdAt: e.createdAt, author: e.author, message: e.message, eventType: e.eventType })) }));
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Maintenance Tickets</h1>
      <Card>
        <CardHeader><CardTitle>New Ticket</CardTitle></CardHeader>
        <CardContent className="grid gap-2 md:grid-cols-4">
          <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} className="md:col-span-2" />
          <Select value={targetRole} onValueChange={(v) => setTargetRole(v as 'admin' | 'manager')}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Target" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="manager">Manager</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={add}>Create</Button>
          <Input placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} className="md:col-span-4" />
        </CardContent>
      </Card>
      <Card>
  <CardHeader><CardTitle>All Tickets</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {items.map(t => (
            <div key={t.id} className="border rounded p-3 bg-background">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{t.id} • {t.title}</div>
                  <div className="text-xs text-muted-foreground">To: {t.targetRole} • Status: {t.status} • SLA: {t.slaDueAt ? new Date(t.slaDueAt).toLocaleString() : '—'}</div>
                  <div className="text-xs text-foreground mt-1 line-clamp-2">{t.description}</div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant={t.status==='open' ? 'default' : 'outline'} onClick={() => setStatus(t.id, 'open')}>Open</Button>
                  <Button size="sm" variant={t.status==='in_progress' ? 'default' : 'outline'} onClick={() => setStatus(t.id, 'in_progress')}>In Progress</Button>
                  <Button size="sm" variant={t.status==='resolved' ? 'default' : 'outline'} onClick={() => setStatus(t.id, 'resolved')}>Resolved</Button>
                  <Button size="sm" variant={t.status==='closed' ? 'default' : 'outline'} onClick={() => setStatus(t.id, 'closed')}>Closed</Button>
                  <Button size="sm" variant="ghost" onClick={() => toggleEvents(t.id)}>Log</Button>
                </div>
              </div>
              {expanded[t.id] && (
                <div className="mt-3 border-t pt-2 text-xs space-y-1">
                  {(events[t.id] || []).map(e => (
                    <div key={e.id} className="flex items-start gap-2">
                      <span className="text-muted-foreground w-40 shrink-0">{new Date(e.createdAt).toLocaleString()} • {e.author}</span>
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
    </div>
  );
}
