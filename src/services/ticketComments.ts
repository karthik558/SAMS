import { hasSupabaseEnv, supabase } from "@/lib/supabaseClient";
import { isDemoMode } from "@/lib/demo";

export type TicketComment = {
  id: string;
  ticketId: string;
  author: string; // user label (email/id)
  message: string;
  createdAt: string; // ISO
};

const DEMO_KEY = "demo_ticket_comments";
function loadDemo(): TicketComment[] {
  try { return JSON.parse(localStorage.getItem(DEMO_KEY)||"[]"); } catch { return []; }
}
function saveDemo(list: TicketComment[]) {
  try { localStorage.setItem(DEMO_KEY, JSON.stringify(list)); } catch {}
}

export async function listTicketComments(ticketId: string): Promise<TicketComment[]> {
  if (!isDemoMode() && hasSupabaseEnv) {
    try {
      const { data, error } = await supabase
        .from('ticket_events')
        .select('id, ticket_id, author, message, created_at, event_type')
        .eq('ticket_id', ticketId)
        .eq('event_type', 'comment')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data||[]).map(r => ({ id: r.id as any, ticketId: r.ticket_id as any, author: r.author as any, message: r.message as any, createdAt: r.created_at as any }));
    } catch (e) {
      console.warn('listTicketComments failed, returning empty', e);
      return [];
    }
  }
  const all = loadDemo();
  return all.filter(c => c.ticketId === ticketId).sort((a,b) => a.createdAt < b.createdAt ? -1 : 1);
}

export async function addTicketComment(ticketId: string, message: string, authorLabel?: string): Promise<TicketComment> {
  const author = (() => {
    if (authorLabel) return authorLabel;
    try {
      const raw = (isDemoMode() ? (sessionStorage.getItem('demo_auth_user') || localStorage.getItem('demo_auth_user')) : null) || localStorage.getItem('auth_user');
      const u = raw ? JSON.parse(raw) : null;
      return (u?.email || u?.id || 'user') as string;
    } catch { return 'user'; }
  })();
  const payload: TicketComment = {
    id: `CMT-${Math.floor(Math.random()*900000+100000)}`,
    ticketId,
    author,
    message,
    createdAt: new Date().toISOString(),
  };
  if (!isDemoMode() && hasSupabaseEnv) {
    try {
      const { data, error } = await supabase
        .from('ticket_events')
        .insert({ ticket_id: ticketId, event_type: 'comment', author, message })
        .select('id, ticket_id, author, message, created_at')
        .single();
      if (error) throw error;
      return { id: data.id as any, ticketId: data.ticket_id as any, author: data.author as any, message: data.message as any, createdAt: data.created_at as any };
    } catch (e) {
      console.warn('addTicketComment failed, falling back', e);
    }
  }
  const list = loadDemo();
  saveDemo([...list, payload]);
  return payload;
}
