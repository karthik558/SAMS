import { hasSupabaseEnv, supabase } from "@/lib/supabaseClient";
import { isDemoMode } from "@/lib/demo";
import { addNotification, addRoleNotification } from "@/services/notifications";
import { listUsers } from "@/services/users";

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
  closeNote?: string | null;
  createdBy: string;
  createdAt: string; // ISO
  updatedAt?: string | null;
};

const TABLE = "tickets";
const LS_KEY = "tickets";
const LS_EVENTS_KEY = "ticket_events";
const DEMO_TICKETS_KEY = "demo_tickets";
const DEMO_TICKET_EVENTS_KEY = "demo_ticket_events";

function loadLocal(): Ticket[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]") as Ticket[]; } catch { return []; }
}
function saveLocal(list: Ticket[]) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(list)); } catch {}
}

function loadDemoTickets(): Ticket[] {
  try {
    const raw = localStorage.getItem(DEMO_TICKETS_KEY);
    return raw ? (JSON.parse(raw) as Ticket[]) : [];
  } catch { return []; }
}
function saveDemoTickets(list: Ticket[]) {
  try { localStorage.setItem(DEMO_TICKETS_KEY, JSON.stringify(list)); } catch {}
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

function loadDemoEvents(): TicketEvent[] {
  try { return JSON.parse(localStorage.getItem(DEMO_TICKET_EVENTS_KEY) || "[]") as TicketEvent[]; } catch { return []; }
}
function saveDemoEvents(list: TicketEvent[]) {
  try { localStorage.setItem(DEMO_TICKET_EVENTS_KEY, JSON.stringify(list)); } catch {}
}

let demoSeeded = false;
function seedDemoTicketsOnce() {
  if (demoSeeded) return;
  demoSeeded = true;
  try {
    const existing = loadDemoTickets();
    if (existing.length > 0) return;
  } catch {}
  const now = new Date();
  const mkDate = (daysAgo: number, hours: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - daysAgo);
    d.setHours(hours, (hours * 7) % 60, 0, 0);
    return d.toISOString();
  };
  const roles: Array<'admin'|'manager'> = ['admin','manager'];
  const statuses: TicketStatus[] = ['open','in_progress','resolved','closed'];
  const titles = [
    'Printer not working in Floor 2',
    'Air conditioning maintenance - Warehouse',
    'Laptop battery replacement request',
    'Network switch reboot required',
    'Office chairs inspection',
    'Security camera offline - Loading Bay',
  ];
  const descs = [
    'Observed intermittent errors while printing. Please check toner and rollers.',
    'Temperature fluctuations during the afternoon. Request preventative maintenance.',
    'Battery health below 70%. Requesting scheduled replacement.',
    'Periodic reboot to restore connectivity for several desks.',
    'Please assess wear and tear; some chairs wobble.',
    'Camera #3 is offline since this morning; verify power and network.',
  ];
  const seed: Ticket[] = Array.from({ length: 8 }, (_, i) => ({
    id: `TCK-${100100 + i}`,
    title: titles[i % titles.length],
    description: descs[i % descs.length],
    targetRole: roles[i % roles.length],
    status: statuses[i % statuses.length],
    assignee: i % 3 === 0 ? 'admin@sams.demo' : i % 3 === 1 ? 'manager@sams.demo' : null,
    priority: (['low','medium','high','urgent'] as const)[i % 4],
    slaDueAt: i % 2 === 0 ? mkDate(-(i%3), 18) : null,
    createdBy: i % 2 === 0 ? 'demo.user1@example.com' : 'demo.user2@example.com',
    createdAt: mkDate((i % 5), 9 + (i % 4)),
    updatedAt: mkDate((i % 4), 12 + (i % 6)),
  }));
  saveDemoTickets(seed);
  const events: TicketEvent[] = seed.flatMap(t => ([(
    { id: `EV-${t.id}-1`, ticketId: t.id, eventType: 'created' as const, author: t.createdBy, message: t.title, createdAt: t.createdAt }
  ), (
    t.status !== 'open'
      ? { id: `EV-${t.id}-2`, ticketId: t.id, eventType: t.status === 'closed' ? 'closed' : 'status_change' as const, author: t.assignee || t.createdBy, message: `Status -> ${t.status}`, createdAt: t.updatedAt || t.createdAt }
      : null
  )].filter(Boolean) as TicketEvent[]));
  saveDemoEvents(events);
}

export async function listTickets(filter?: Partial<Pick<Ticket, "status" | "assignee" | "targetRole" | "createdBy">>): Promise<Ticket[]> {
  if (isDemoMode()) {
    seedDemoTicketsOnce();
    const list = loadDemoTickets();
    const out = list.filter(t => (
      (!filter?.status || t.status === filter.status) &&
      (!filter?.assignee || t.assignee === filter.assignee) &&
      (!filter?.targetRole || t.targetRole === filter.targetRole) &&
      (!filter?.createdBy || t.createdBy === filter.createdBy)
    ));
    return out.sort((a,b) => (a.createdAt < b.createdAt ? 1 : -1));
  }
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
  // Derive default assignee when not provided: pick an active user with that role
  async function pickDefaultAssignee(role: 'admin' | 'manager'): Promise<string | null> {
    try {
      if (isDemoMode()) return role === 'admin' ? 'admin@sams.demo' : 'manager@sams.demo';
      if (!hasSupabaseEnv) return null;
      const users = await listUsers();
      const candidates = users.filter(u => (u.role || '').toLowerCase() === role && (u.status || '').toLowerCase() !== 'inactive');
      // Prefer most recently active
      const sorted = candidates.sort((a,b) => {
        const ta = a.last_login ? Date.parse(a.last_login) : 0;
        const tb = b.last_login ? Date.parse(b.last_login) : 0;
        return tb - ta;
      });
  const chosen = sorted[0] || candidates[0];
  return chosen ? (chosen.email || chosen.id || null) : null;
    } catch {
      return null;
    }
  }
  const derivedAssignee = input.assignee ?? await pickDefaultAssignee(input.targetRole);
  const payload: Ticket = {
    id: `TCK-${Math.floor(Math.random()*900000+100000)}`,
    title: input.title,
    description: input.description,
    targetRole: input.targetRole,
    status: input.status ?? "open",
    assignee: derivedAssignee,
    priority: input.priority ?? "medium",
    slaDueAt: input.slaDueAt ?? null,
    createdBy: input.createdBy,
    createdAt: new Date().toISOString(),
  // leave updatedAt undefined so DB default/trigger can set it
  updatedAt: undefined,
  };
  if (isDemoMode()) {
    seedDemoTicketsOnce();
    const list = loadDemoTickets();
    saveDemoTickets([payload, ...list]);
    const events = loadDemoEvents();
    const ev: TicketEvent = { id: `EV-${Math.floor(Math.random()*900000+100000)}`, ticketId: payload.id, eventType: 'created', author: input.createdBy, message: payload.title, createdAt: new Date().toISOString() };
    saveDemoEvents([ev, ...events]);
    await addRoleNotification({ title: `New ticket for ${payload.targetRole}`, message: `${payload.id}: ${payload.title}`, type: `ticket-${payload.targetRole}` }, payload.targetRole);
    return payload;
  }
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
      // Notify target group by fan-out per role (best-effort)
      await addRoleNotification({
        title: `New ticket for ${created.targetRole}`,
        message: `${created.id}: ${created.title}`,
        type: `ticket-${created.targetRole}`,
      }, created.targetRole);
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
  await addRoleNotification({ title: `New ticket for ${payload.targetRole}`, message: `${payload.id}: ${payload.title}`, type: `ticket-${payload.targetRole}` }, payload.targetRole);
  return payload;
}

export async function updateTicket(id: string, patch: Partial<Ticket>, opts?: { message?: string }): Promise<Ticket | null> {
  const toUpdate = { ...patch, updatedAt: new Date().toISOString() } as Partial<Ticket>;
  const getActorInfo = () => {
    try {
      const raw = (isDemoMode() ? (sessionStorage.getItem('demo_auth_user') || localStorage.getItem('demo_auth_user')) : null) || localStorage.getItem('auth_user');
      const u = raw ? JSON.parse(raw) : null;
      const id = u?.id as string | undefined;
      const email = u?.email as string | undefined;
      const label = (email || id || 'system') as string;
      return { id, email, label };
    } catch {
      return { id: undefined, email: undefined, label: 'system' };
    }
  };
  // Guard: Only the assigned person can change status
  const ensureCanChange = async (): Promise<void> => {
    // Only enforce when changing status; other updates can be extended later if needed
    if (!('status' in patch) || !patch.status) return;
    const actor = getActorInfo();
    try {
      if (!isDemoMode() && hasSupabaseEnv) {
        const { data } = await supabase.from(TABLE).select('assignee').eq('id', id).limit(1).maybeSingle();
        const assignee = (data as any)?.assignee ?? null;
        if (!assignee || ![actor.id, actor.email].filter(Boolean).some(v => String(assignee) === String(v))) throw new Error('NOT_AUTHORIZED');
      } else if (isDemoMode()) {
        const list = loadDemoTickets();
        const cur = list.find(t => t.id === id);
        const assignee = cur?.assignee ?? null;
        if (!assignee || ![actor.id, actor.email].filter(Boolean).some(v => String(assignee) === String(v))) throw new Error('NOT_AUTHORIZED');
      } else {
        const list = loadLocal();
        const cur = list.find(t => t.id === id);
        const assignee = cur?.assignee ?? null;
        if (!assignee || ![actor.id, actor.email].filter(Boolean).some(v => String(assignee) === String(v))) throw new Error('NOT_AUTHORIZED');
      }
    } catch (e) {
      // Re-throw with a consistent code
      throw new Error('NOT_AUTHORIZED');
    }
  };

  // Enforce permission for status changes
  await ensureCanChange();
  if (!isDemoMode() && hasSupabaseEnv) {
    try {
      const { data, error } = await supabase.from(TABLE).update(toSnake(toUpdate)).eq("id", id).select("*").single();
      if (error) throw error;
      const updated = toCamel(data);
      if (patch.status) {
        const event_type = patch.status === 'closed' ? 'closed' : 'status_change';
        const actor = getActorInfo();
        const msg = opts?.message || `Status -> ${patch.status}`;
        await supabase.from('ticket_events').insert({ ticket_id: id, event_type, author: patch.assignee || patch.createdBy || actor.label, message: msg });
        if (patch.status === 'closed' && opts?.message) {
          await supabase.from(TABLE).update({ close_note: opts.message }).eq('id', id);
        }
        // Notify interested parties
        await addNotification({
          title: `Ticket ${id} ${patch.status}`,
          message: opts?.message ? `${patch.status}: ${opts.message}` : `Status changed to ${patch.status}`,
          type: `ticket-status`,
        });
      }
  try { localStorage.removeItem('tickets_fallback_reason'); } catch {}
      return updated;
    } catch (e) {
      console.warn("tickets update failed, using localStorage", e);
    }
  }
  if (isDemoMode()) {
    const list = loadDemoTickets();
    const idx = list.findIndex(t => t.id === id);
    if (idx >= 0) {
      const updated = { ...list[idx], ...patch, updatedAt: new Date().toISOString() } as Ticket;
      const next = [...list];
      next[idx] = updated;
      saveDemoTickets(next);
      if (patch.status) {
        const events = loadDemoEvents();
        const actor = getActorInfo();
        const ev: TicketEvent = { id: `EV-${Math.floor(Math.random()*900000+100000)}`, ticketId: id, eventType: patch.status === 'closed' ? 'closed' : 'status_change', author: patch.assignee || actor.label, message: opts?.message || `Status -> ${patch.status}`, createdAt: new Date().toISOString() };
        saveDemoEvents([ev, ...events]);
        await addNotification({ title: `Ticket ${id} ${patch.status}`, message: opts?.message ? `${patch.status}: ${opts.message}` : `Status changed to ${patch.status}`, type: `ticket-status` });
      }
      return updated;
    }
    return null;
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
      const actor = getActorInfo();
      const ev: TicketEvent = { id: `EV-${Math.floor(Math.random()*900000+100000)}`, ticketId: id, eventType: patch.status === 'closed' ? 'closed' : 'status_change', author: patch.assignee || actor.label, message: opts?.message || `Status -> ${patch.status}`, createdAt: new Date().toISOString() };
      saveLocalEvents([ev, ...events]);
      await addNotification({ title: `Ticket ${id} ${patch.status}`, message: opts?.message ? `${patch.status}: ${opts.message}` : `Status changed to ${patch.status}`, type: `ticket-status` });
    }
    return updated;
  }
  return null;
}

export async function listTicketEvents(ticketId: string): Promise<TicketEvent[]> {
  if (!isDemoMode() && hasSupabaseEnv) {
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
  if (isDemoMode()) {
    return loadDemoEvents().filter(e => e.ticketId === ticketId).sort((a,b) => (a.createdAt < b.createdAt ? 1 : -1));
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
  closeNote: row.close_note ?? null,
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
    // Only include assignee when explicitly provided; avoid nulling on unrelated updates
    // assignee will be set below via hasOwnProperty check
    priority: input.priority ?? undefined,
    sla_due_at: input.slaDueAt ?? null,
  close_note: input.closeNote,
    created_by: input.createdBy,
    created_at: input.createdAt,
    updated_at: input.updatedAt,
  };
  if (Object.prototype.hasOwnProperty.call(input, 'assignee')) {
    // Allow setting to null explicitly when caller intends to unassign
    // @ts-ignore
    obj.assignee = input.assignee ?? null;
  }
  // Remove undefined fields so DB defaults apply
  Object.keys(obj).forEach((k) => {
    if (obj[k] === undefined) delete obj[k];
  });
  return obj;
}
