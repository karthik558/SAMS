import { hasSupabaseEnv, supabase } from "@/lib/supabaseClient";
import { isDemoMode } from "@/lib/demo";

export type TicketAttachment = {
  id: string; // storage path or synthetic id
  ticketId: string;
  name: string;
  url: string;
  uploadedAt: string;
  uploadedBy: string;
};

const DEMO_KEY = 'demo_ticket_attachments';
function loadDemo(): TicketAttachment[] { try { return JSON.parse(localStorage.getItem(DEMO_KEY)||'[]'); } catch { return []; } }
function saveDemo(list: TicketAttachment[]) { try { localStorage.setItem(DEMO_KEY, JSON.stringify(list)); } catch {} }

const BUCKET = 'tickets';

async function ensureBucket(): Promise<void> {
  // Client SDK cannot create bucket; assume it exists. Documented as a prerequisite.
}

export async function listAttachments(ticketId: string): Promise<TicketAttachment[]> {
  if (!isDemoMode() && hasSupabaseEnv) {
    try {
      await ensureBucket();
      const prefix = `${ticketId}/`;
      const { data, error } = await supabase.storage.from(BUCKET).list(prefix, { limit: 100 });
      if (error) throw error;
      const baseUrl = supabase.storage.from(BUCKET).getPublicUrl(prefix).data.publicUrl.replace(/\/$/, '');
      return (data||[]).map(obj => ({
        id: `${prefix}${obj.name}`,
        ticketId,
        name: obj.name,
        url: `${baseUrl}/${encodeURIComponent(obj.name)}`,
        uploadedAt: new Date(obj.created_at || obj.updated_at || Date.now()).toISOString(),
        uploadedBy: 'user',
      }));
    } catch (e) {
      console.warn('listAttachments failed, returning empty', e);
      return [];
    }
  }
  return loadDemo().filter(a => a.ticketId === ticketId);
}

export async function uploadAttachment(ticketId: string, file: File): Promise<TicketAttachment> {
  const actor = (() => { try { const raw = (isDemoMode()? (sessionStorage.getItem('demo_auth_user')||localStorage.getItem('demo_auth_user')):null)||localStorage.getItem('auth_user'); const u = raw? JSON.parse(raw): null; return (u?.email||u?.id||'user') as string; } catch { return 'user'; } })();
  const name = `${Date.now()}_${file.name}`;
  if (!isDemoMode() && hasSupabaseEnv) {
    try {
      await ensureBucket();
      const path = `${ticketId}/${name}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const att: TicketAttachment = { id: path, ticketId, name: file.name, url: urlData.publicUrl, uploadedAt: new Date().toISOString(), uploadedBy: actor };
      return att;
    } catch (e) {
      console.warn('uploadAttachment failed, falling back', e);
    }
  }
  const att: TicketAttachment = { id: `ATT-${Math.floor(Math.random()*900000+100000)}`, ticketId, name: file.name, url: URL.createObjectURL(file), uploadedAt: new Date().toISOString(), uploadedBy: actor };
  const list = loadDemo();
  saveDemo([...list, att]);
  return att;
}

export async function removeAttachment(attachmentId: string): Promise<void> {
  if (!isDemoMode() && hasSupabaseEnv) {
    try {
      const { error } = await supabase.storage.from(BUCKET).remove([attachmentId]);
      if (error) throw error;
      return;
    } catch (e) {
      console.warn('removeAttachment failed, ignoring', e);
    }
  }
  const list = loadDemo();
  const next = list.filter(a => a.id !== attachmentId);
  saveDemo(next);
}
