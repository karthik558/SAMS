import { hasSupabaseEnv, supabase } from "@/lib/supabaseClient";
import { isDemoMode } from "@/lib/demo";
import { sendNewsletterEmail, getAllUserEmails } from "@/services/email";

export type NewsletterPost = {
  id: string;
  title: string;
  body: string;
  created_at: string; // ISO
  updated_at: string | null;
  author: string | null;
  published: boolean;
  category: string; // key from newsletter_categories
};

export type NewsletterCategory = {
  key: string;   // e.g., 'bug'
  label: string; // 'Bug'
  hue: string;   // 'red', 'emerald', 'amber', 'blue' ...
};

const TABLE = "newsletter_posts";
const CAT_TABLE = "newsletter_categories";
const LS_KEY = "newsletter_posts";
const FB_KEY = "newsletter_fallback_reason";

function loadLocal(): NewsletterPost[] {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || "[]") as NewsletterPost[];
  } catch {
    return [];
  }
}
function saveLocal(list: NewsletterPost[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(list));
  } catch {}
}
function purgeLocalIfProduction() {
  if (!isDemoMode() && hasSupabaseEnv) {
    try {
      localStorage.removeItem(LS_KEY);
      localStorage.removeItem(FB_KEY);
    } catch {}
  }
}

const DEFAULT_CATEGORIES: NewsletterCategory[] = [
  { key: 'release_notes', label: 'Release Notes', hue: 'blue' },
  { key: 'design_refresh', label: 'Design Refresh', hue: 'sky' },
  { key: 'content_update', label: 'Content Update', hue: 'amber' },
  { key: 'website_launch', label: 'Website Launch', hue: 'emerald' },
  { key: 'performance', label: 'Performance', hue: 'red' },
  { key: 'maintenance', label: 'Maintenance', hue: 'zinc' },
];

export async function listNewsletterCategories(): Promise<NewsletterCategory[]> {
  if (!isDemoMode() && hasSupabaseEnv) {
    try {
      const { data, error } = await supabase.from(CAT_TABLE).select('key,label,hue').order('label');
      if (error) throw error;
      const rows = (data || []) as NewsletterCategory[];
      return rows.length ? rows : DEFAULT_CATEGORIES;
    } catch (e) {
      console.warn('newsletter categories list failed, using defaults', e);
    }
  }
  return DEFAULT_CATEGORIES;
}

export async function listNewsletterPosts(limit = 20): Promise<NewsletterPost[]> {
  if (!isDemoMode() && hasSupabaseEnv) {
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .select("id, title, body, created_at, updated_at, author, published, category")
        .eq('published', true)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      const rows = (data || []) as NewsletterPost[];
      purgeLocalIfProduction();
      if (rows.length > 0) {
        try {
          localStorage.removeItem(FB_KEY);
        } catch {}
        return rows;
      }
      try {
        localStorage.removeItem(FB_KEY);
      } catch {}
      return rows;
    } catch (e) {
      console.warn('newsletter list failed, using localStorage', e);
      try { localStorage.setItem(FB_KEY, 'select_failed'); } catch {}
    }
  }
  // Demo/local fallback: seed a few example posts the first time
  try {
    if (isDemoMode()) {
      const cur = loadLocal();
      if (!cur.length) {
        const now = Date.now();
        const mk = (minsAgo: number) => new Date(now - minsAgo * 60000).toISOString();
        const seed: NewsletterPost[] = [
          { id: 'NEWS-900003', title: 'Homepage Refresh Now Live', body: 'Our primary landing page has been updated with the new hero layout, improved typography scale, and refined call-to-action block. Let us know if you spot spacing issues on tablet breakpoints.', author: 'design@sams.demo', published: true, created_at: mk(90), updated_at: null, category: 'design_refresh' },
          { id: 'NEWS-900002', title: 'Pricing Page Performance Win', body: 'Lazy loading and responsive image sets cut LCP to 1.6s on the pricing page. Marketing assets were recompressed and the testimonials carousel now defers below-the-fold rendering.', author: 'webops@sams.demo', published: true, created_at: mk(240), updated_at: null, category: 'performance' },
          { id: 'NEWS-900001', title: 'New Resource Center Navigation', body: 'We rolled out a streamlined navigation for resources with audience tags and contextual breadcrumbs. Content owners should review featured cards before Friday.', author: 'content@sams.demo', published: true, created_at: mk(480), updated_at: null, category: 'content_update' },
        ];
        saveLocal(seed);
      }
    }
  } catch {}
  if (isDemoMode()) {
    return loadLocal()
      .filter(p => p.published)
      .sort((a,b) => (a.created_at < b.created_at ? 1 : -1))
      .slice(0, limit);
  }
  return [];
}

export async function listAllNewsletterPosts(limit = 200): Promise<NewsletterPost[]> {
  if (!isDemoMode() && hasSupabaseEnv) {
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .select("id, title, body, created_at, updated_at, author, published, category")
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      const rows = (data || []) as NewsletterPost[];
      purgeLocalIfProduction();
      if (rows.length > 0) {
        try { localStorage.removeItem(FB_KEY); } catch {}
        return rows;
      }
      try { localStorage.removeItem(FB_KEY); } catch {}
      return [];
    } catch (e) {
      console.warn('newsletter listAll failed, using localStorage', e);
      try { localStorage.setItem(FB_KEY, 'select_failed'); } catch {}
    }
  }
  // Demo/local: ensure demo seed
  try {
    if (isDemoMode()) {
      const cur = loadLocal();
      if (!cur.length) {
        const now = Date.now();
        const mk = (minsAgo: number) => new Date(now - minsAgo * 60000).toISOString();
        const seed: NewsletterPost[] = [
          { id: 'NEWS-900003', title: 'Homepage Refresh Now Live', body: 'Our primary landing page has been updated with the new hero layout, improved typography scale, and refined call-to-action block. Let us know if you spot spacing issues on tablet breakpoints.', author: 'design@sams.demo', published: true, created_at: mk(90), updated_at: null, category: 'design_refresh' },
          { id: 'NEWS-900002', title: 'Pricing Page Performance Win', body: 'Lazy loading and responsive image sets cut LCP to 1.6s on the pricing page. Marketing assets were recompressed and the testimonials carousel now defers below-the-fold rendering.', author: 'webops@sams.demo', published: true, created_at: mk(240), updated_at: null, category: 'performance' },
          { id: 'NEWS-900001', title: 'New Resource Center Navigation', body: 'We rolled out a streamlined navigation for resources with audience tags and contextual breadcrumbs. Content owners should review featured cards before Friday.', author: 'content@sams.demo', published: true, created_at: mk(480), updated_at: null, category: 'content_update' },
        ];
        saveLocal(seed);
      }
    }
  } catch {}
  if (isDemoMode()) {
    return loadLocal().sort((a,b) => (a.created_at < b.created_at ? 1 : -1)).slice(0, limit);
  }
  return [];
}

export async function createNewsletterPost(input: { title: string; body: string; category?: string; published?: boolean; author?: string | null }): Promise<NewsletterPost> {
  const payload: NewsletterPost = {
    id: `NEWS-${Math.floor(Math.random()*900000+100000)}`,
    title: input.title,
    body: input.body,
    published: input.published ?? true,
    author: input.author ?? null,
    created_at: new Date().toISOString(),
    updated_at: null,
    category: input.category || 'release_notes',
  };
  if (!isDemoMode() && hasSupabaseEnv) {
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .insert({ id: payload.id, title: payload.title, body: payload.body, published: payload.published, author: payload.author, category: payload.category })
        .select("id, title, body, created_at, updated_at, author, published, category")
        .single();
      if (error) throw error;
      try { localStorage.removeItem(FB_KEY); } catch {}
      
      // Send email notification if published
      const created = data as NewsletterPost;
      if (created.published) {
        try {
          const recipientEmails = await getAllUserEmails();
          if (recipientEmails.length > 0) {
            await sendNewsletterEmail({
              title: created.title,
              body: created.body,
              category: created.category,
              author: created.author ?? undefined,
              recipientEmails,
            });
          }
        } catch (error) {
          console.warn('Failed to send newsletter email:', error);
        }
      }
      
      return created;
    } catch (e) {
      console.warn('newsletter create failed, using localStorage', e);
      try { localStorage.setItem(FB_KEY, 'insert_failed'); } catch {}
    }
  }
  const list = loadLocal();
  saveLocal([payload, ...list]);
  return payload;
}

export async function updateNewsletterPost(id: string, patch: Partial<Pick<NewsletterPost,'title'|'body'|'published'|'category'>>): Promise<NewsletterPost> {
  if (!isDemoMode() && hasSupabaseEnv) {
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select("id, title, body, created_at, updated_at, author, published, category")
        .single();
      if (error) throw error;
      try { localStorage.removeItem(FB_KEY); } catch {}
      
      // Send email notification if newly published
      const updated = data as NewsletterPost;
      if (updated.published && patch.published === true) {
        try {
          const recipientEmails = await getAllUserEmails();
          if (recipientEmails.length > 0) {
            await sendNewsletterEmail({
              title: updated.title,
              body: updated.body,
              category: updated.category,
              author: updated.author ?? undefined,
              recipientEmails,
            });
          }
        } catch (error) {
          console.warn('Failed to send newsletter email:', error);
        }
      }
      
      return updated;
    } catch (e) {
      console.warn('newsletter update failed, using localStorage', e);
      try { localStorage.setItem(FB_KEY, 'update_failed'); } catch {}
    }
  }
  const list = loadLocal();
  const idx = list.findIndex(p => p.id === id);
  if (idx >= 0) {
    const next = { ...list[idx], ...patch, updated_at: new Date().toISOString() } as NewsletterPost;
    const copy = [...list];
    copy[idx] = next;
    saveLocal(copy);
    return next;
  }
  throw new Error('Not found');
}

export async function deleteNewsletterPost(id: string): Promise<void> {
  if (!isDemoMode() && hasSupabaseEnv) {
    try {
      const { error } = await supabase.from(TABLE).delete().eq('id', id);
      if (error) throw error;
      try { localStorage.removeItem(FB_KEY); } catch {}
      return;
    } catch (e) {
      console.warn('newsletter delete failed, using localStorage', e);
      try { localStorage.setItem(FB_KEY, 'delete_failed'); } catch {}
    }
  }
  const list = loadLocal();
  saveLocal(list.filter(p => p.id !== id));
}
