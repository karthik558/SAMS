import { hasSupabaseEnv, supabase } from "@/lib/supabaseClient";
import { addNotification } from "@/services/notifications";

export type TicketStatus = "open" | "in_progress" | "resolved" | "closed";

export type Ticket = {
  id: string;
  title: string;
  description: string;
  targetRole: 'admin' | 'manager';
  status: TicketStatus;
  assignee?: string | null; // user id or email
  priority?: "low" | "medium" | "high" | "urgent";
  slaDueAt?: string | null; // ISO
  createdBy: string;
  createdAt: string; // ISO
  updatedAt?: string | null;
};

const TABLE = "tickets";
const LS_KEY = "tickets";
const LS_EVENTS_KEY = "ticket_events";

function loadLocal(): Ticket[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]") as Ticket[]; } catch { return []; }
}
function saveLocal(list: Ticket[]) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(list)); } catch {}
}

export type TicketEvent = {
  id: string;
  ticketId: string;
  eventType: 'created' | 'status_change' | 'comment' | 'closed';
  author: string;
  message: string;
  createdAt: string; // ISO
};

function loadLocalEvents(): TicketEvent[] {
  try { return JSON.parse(localStorage.getItem(LS_EVENTS_KEY) || "[]") as TicketEvent[]; } catch { return []; }
}
function saveLocalEvents(list: TicketEvent[]) {
  try { localStorage.setItem(LS_EVENTS_KEY, JSON.stringify(list)); } catch {}
}

export async function listTickets(filter?: Partial<Pick<Ticket, "status" | "assignee" | "targetRole" | "createdBy">>): Promise<Ticket[]> {
  if (hasSupabaseEnv) {
    try {
      let query = supabase.from(TABLE).select("*").order("created_at", { ascending: false });
      if (filter?.status) query = query.eq("status", filter.status);
      if (filter?.assignee) query = query.eq("assignee", filter.assignee);
      if (filter?.targetRole) query = query.eq("target_role", filter.targetRole);
      if (filter?.createdBy) query = query.eq("created_by", filter.createdBy);
      const { data, error } = await query;
      if (error) throw error;
  try { localStorage.removeItem('tickets_fallback_reason'); } catch {}
  return (data || []).map(toCamel);
    } catch (e) {
      try { localStorage.setItem('tickets_fallback_reason', 'select_failed'); } catch {}
      console.warn("tickets table unavailable, using localStorage", e);
    }
  }
  const list = loadLocal();
  return list.filter(t => (
    (!filter?.status || t.status === filter.status) &&
    (!filter?.assignee || t.assignee === filter.assignee) &&
    (!filter?.targetRole || t.targetRole === filter.targetRole) &&
    (!filter?.createdBy || t.createdBy === filter.createdBy)
  ));
}

export async function createTicket(input: {
  title: string;
  description: string;
  targetRole: 'admin' | 'manager';
  createdBy: string;
  status?: TicketStatus;
  assignee?: string | null;
  priority?: "low" | "medium" | "high" | "urgent";
  slaDueAt?: string | null;
}): Promise<Ticket> {
  const payload: Ticket = {
    id: `TCK-${Math.floor(Math.random()*900000+100000)}`,
    title: input.title,
    description: input.description,
    targetRole: input.targetRole,
    status: input.status ?? "open",
    assignee: input.assignee ?? null,
    priority: input.priority ?? "medium",
    slaDueAt: input.slaDueAt ?? null,
    createdBy: input.createdBy,
    createdAt: new Date().toISOString(),
  // leave updatedAt undefined so DB default/trigger can set it
  updatedAt: undefined,
  };
  if (hasSupabaseEnv) {
    try {
      const { data, error } = await supabase.from(TABLE).insert(toSnake(payload)).select("*").single();
      if (error) throw error;
      const created = toCamel(data);
      // Clear fallback flag now that core insert worked
      try { localStorage.removeItem('tickets_fallback_reason'); } catch {}
      // Log an event (best-effort)
      try {
        await supabase.from('ticket_events').insert({ ticket_id: created.id, event_type: 'created', author: input.createdBy, message: created.title });
      } catch (e) {
        console.warn('ticket_events insert failed, continuing', e);
      }
      // Notify target group (best-effort; service has its own fallback)
      await addNotification({
        title: `New ticket for ${created.targetRole}`,
        message: `${created.id}: ${created.title}`,
        type: `ticket-${created.targetRole}`,
      });
      return created;
    } catch (e) {
      try { localStorage.setItem('tickets_fallback_reason', 'insert_failed'); } catch {}
      console.warn("tickets insert failed, using localStorage", e);
    }
  }
  const list = loadLocal();
  // Local: persist ticket and an event
  saveLocal([payload, ...list]);
  const events = loadLocalEvents();
  const ev: TicketEvent = { id: `EV-${Math.floor(Math.random()*900000+100000)}`, ticketId: payload.id, eventType: 'created', author: input.createdBy, message: payload.title, createdAt: new Date().toISOString() };
  saveLocalEvents([ev, ...events]);
  // Notify
  await addNotification({ title: `New ticket for ${payload.targetRole}`, message: `${payload.id}: ${payload.title}`, type: `ticket-${payload.targetRole}` });
  return payload;
}

export async function updateTicket(id: string, patch: Partial<Ticket>): Promise<Ticket | null> {
  const toUpdate = { ...patch, updatedAt: new Date().toISOString() } as Partial<Ticket>;
  const getActor = () => {
    try {
      const raw = localStorage.getItem('auth_user');
      const u = raw ? JSON.parse(raw) : null;
      return u?.email || u?.id || 'system';
    } catch {
      return 'system';
    }
  };
  if (hasSupabaseEnv) {
    try {
      const { data, error } = await supabase.from(TABLE).update(toSnake(toUpdate)).eq("id", id).select("*").single();
      if (error) throw error;
      const updated = toCamel(data);
      if (patch.status) {
        const event_type = patch.status === 'closed' ? 'closed' : 'status_change';
        await supabase.from('ticket_events').insert({ ticket_id: id, event_type, author: patch.assignee || patch.createdBy || getActor(), message: `Status -> ${patch.status}` });
        // Notify interested parties
        await addNotification({
          title: `Ticket ${id} ${patch.status}`,
          message: `Status changed to ${patch.status}`,
          type: `ticket-status`,
        });
      }
  try { localStorage.removeItem('tickets_fallback_reason'); } catch {}
      return updated;
    } catch (e) {
      console.warn("tickets update failed, using localStorage", e);
    }
  }
  const list = loadLocal();
  const idx = list.findIndex(t => t.id === id);
  if (idx >= 0) {
    const updated = { ...list[idx], ...patch, updatedAt: new Date().toISOString() } as Ticket;
    const next = [...list];
    next[idx] = updated;
    saveLocal(next);
    if (patch.status) {
      const events = loadLocalEvents();
      const ev: TicketEvent = { id: `EV-${Math.floor(Math.random()*900000+100000)}`, ticketId: id, eventType: patch.status === 'closed' ? 'closed' : 'status_change', author: patch.assignee || getActor(), message: `Status -> ${patch.status}`, createdAt: new Date().toISOString() };
      saveLocalEvents([ev, ...events]);
      await addNotification({ title: `Ticket ${id} ${patch.status}`, message: `Status changed to ${patch.status}`, type: `ticket-status` });
    }
    return updated;
  }
  return null;
}

export async function listTicketEvents(ticketId: string): Promise<TicketEvent[]> {
  if (hasSupabaseEnv) {
    try {
      const { data, error } = await supabase
        .from('ticket_events')
        .select('id, ticket_id, event_type, author, message, created_at')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map((r: any) => ({ id: r.id, ticketId: r.ticket_id, eventType: r.event_type, author: r.author, message: r.message, createdAt: r.created_at }));
    } catch (e) {
      console.warn('ticket_events unavailable, using localStorage', e);
    }
  }
  return loadLocalEvents().filter(e => e.ticketId === ticketId).sort((a,b) => (a.createdAt < b.createdAt ? 1 : -1));
}

function toCamel(row: any): Ticket {
  return {
    id: row.id,
    title: row.title,
  description: row.description,
  targetRole: row.target_role,
    status: row.status,
    assignee: row.assignee ?? null,
    priority: row.priority ?? "medium",
    slaDueAt: row.sla_due_at ?? null,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? null,
  };
}

function toSnake(input: Partial<Ticket>) {
  const obj: any = {
    id: input.id,
    title: input.title,
    description: input.description,
    target_role: input.targetRole,
    status: input.status,
    assignee: input.assignee ?? null,
    priority: input.priority ?? undefined,
    sla_due_at: input.slaDueAt ?? null,
    created_by: input.createdBy,
    created_at: input.createdAt,
    updated_at: input.updatedAt,
  };
  // Remove undefined fields so DB defaults apply
  Object.keys(obj).forEach((k) => {
    if (obj[k] === undefined) delete obj[k];
  });
  return obj;
}
