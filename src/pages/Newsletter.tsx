import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import Breadcrumbs from "@/components/layout/Breadcrumbs";
import PageHeader from "@/components/layout/PageHeader";
import { Megaphone } from "lucide-react";
import { createNewsletterPost, deleteNewsletterPost, listAllNewsletterPosts, updateNewsletterPost, listNewsletterCategories, type NewsletterPost, type NewsletterCategory } from "@/services/newsletter";
import { isDemoMode } from "@/lib/demo";

export default function Newsletter() {
  const [posts, setPosts] = useState<NewsletterPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<NewsletterPost | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [published, setPublished] = useState(true);
  const [query, setQuery] = useState("");
  const [categories, setCategories] = useState<NewsletterCategory[]>([]);
  const [category, setCategory] = useState<string>('update');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Read role to enable admin actions
  const role = (() => {
    try {
      const raw = isDemoMode() ? (sessionStorage.getItem('demo_auth_user') || localStorage.getItem('demo_auth_user')) : localStorage.getItem('auth_user');
      const u = raw ? JSON.parse(raw) : null;
      return String(u?.role || '').toLowerCase();
    } catch { return ''; }
  })();
  const isAdmin = role === 'admin';

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [list, cats] = await Promise.all([
          listAllNewsletterPosts(200),
          listNewsletterCategories(),
        ]);
        setPosts(list);
        setCategories(cats);
      } catch { setPosts([]); }
      setLoading(false);
    })();
  }, []);

  const resetForm = () => { setEditing(null); setTitle(''); setBody(''); setPublished(true); setCategory('update'); };
  const openCreate = () => { resetForm(); setOpen(true); };
  const openEdit = (p: NewsletterPost) => { setEditing(p); setTitle(p.title); setBody(p.body); setPublished(p.published); setCategory(p.category || 'update'); setOpen(true); };

  const save = async () => {
    if (!title.trim() || !body.trim()) { toast.error('Title and content are required'); return; }
    try {
      if (editing) {
        const updated = await updateNewsletterPost(editing.id, { title: title.trim(), body, published, category });
        setPosts(s => s.map(p => p.id === updated.id ? updated : p));
        toast.success('Post updated');
      } else {
        let author: string | null = null;
        try {
          const raw = isDemoMode() ? (sessionStorage.getItem('demo_auth_user') || localStorage.getItem('demo_auth_user')) : localStorage.getItem('auth_user');
          author = raw ? (JSON.parse(raw).email || JSON.parse(raw).name || null) : null;
        } catch {}
        const created = await createNewsletterPost({ title: title.trim(), body, published, author, category });
        setPosts(s => [created, ...s]);
        toast.success('Post created');
      }
      setOpen(false);
      resetForm();
    } catch { toast.error('Save failed'); }
  };

  const remove = async (id: string) => {
    if (!window.confirm('Delete this post?')) return;
    try { await deleteNewsletterPost(id); setPosts(s => s.filter(p => p.id !== id)); toast.success('Deleted'); } catch { toast.error('Delete failed'); }
  };

  // Derive a status-like badge from the title/body (no schema change required)
  const hueBadge = (hue: string) => {
    switch ((hue||'').toLowerCase()) {
      case 'red': return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/40 dark:text-red-200 dark:border-red-800';
      case 'emerald': return 'bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-200 dark:border-emerald-800';
      case 'amber': return 'bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-800';
      case 'blue': return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/40 dark:text-blue-200 dark:border-blue-800';
      case 'sky': return 'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-900/40 dark:text-sky-200 dark:border-sky-800';
      case 'zinc': return 'bg-zinc-100 text-zinc-800 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700';
      default: return 'bg-muted text-foreground';
    }
  };
  const statusOf = (p: NewsletterPost): { label: string; cls: string } => {
    if (!p.published) return { label: 'Draft', cls: hueBadge('zinc') };
    const cat = categories.find(c => c.key === (p.category||'update')) || { label: 'Update', hue: 'blue' } as NewsletterCategory;
    return { label: cat.label, cls: hueBadge(cat.hue) };
  };

  const filtered = posts.filter(p => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return p.title.toLowerCase().includes(q) || p.body.toLowerCase().includes(q) || (p.author||'').toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Dashboard', to: '/' }, { label: 'Newsletter' }]} />
      <PageHeader icon={Megaphone} title="Status & Updates" />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle>Latest Updates</CardTitle>
            <div className="flex items-center gap-2">
              <Input
                placeholder="Search updates…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-9 w-56"
              />
              {isAdmin && (
                <Button size="sm" onClick={openCreate}>New Post</Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="text-sm text-muted-foreground">No posts yet.</div>
          ) : (
            <div className="space-y-3">
              {filtered.map((p) => {
                const s = statusOf(p);
                const expanded = expandedId === p.id;
                const isLong = (p.body?.length || 0) > 320 || (p.body || '').split(/\n/).length > 6;
                return (
                  <div key={p.id} className="rounded-lg border bg-card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs ${s.cls}`}>{s.label}</span>
                          <div className="font-medium text-foreground truncate max-w-[60ch]" title={p.title}>{p.title}</div>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {new Date(p.created_at).toLocaleString()} {p.author ? `• ${p.author}` : ''}
                        </div>
                      </div>
                      {isAdmin && (
                        <div className="flex items-center gap-2 shrink-0">
                          <Button size="sm" variant="outline" onClick={() => openEdit(p)}>Edit</Button>
                          <Button size="sm" variant="destructive" onClick={() => remove(p.id)}>Delete</Button>
                        </div>
                      )}
                    </div>
                    <div className="mt-2">
                      <div className={[
                        "text-[13.5px] leading-6 text-foreground whitespace-pre-wrap relative",
                        (!expanded && isLong) ? "max-h-32 md:max-h-40 overflow-hidden pr-2" : ""
                      ].join(' ')}>
                        {p.body}
                        {(!expanded && isLong) && (
                          <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-background via-background/80 to-transparent" />
                        )}
                      </div>
                      {isLong && (
                        <div className="mt-2 flex justify-end">
                          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setExpandedId(expanded ? null : p.id)}>
                            {expanded ? 'Show less' : 'Read more'}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Post' : 'New Post'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <Input placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} />
            <Textarea value={body} onChange={e => setBody(e.target.value)} className="min-h-[240px]" placeholder={"Write your update…\n\nTips:\n- Start with a short summary.\n- Add details, timelines, and links.\n- Include keywords like Maintenance, Incident, Resolved for status badges."} />
            <div className="flex items-center gap-3">
              <label className="text-sm">Category</label>
              <select className="h-9 rounded border bg-background px-2 text-sm" value={category} onChange={(e)=> setCategory(e.target.value)}>
                {categories.map(c => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </select>
            </div>
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" checked={published} onChange={e => setPublished(e.target.checked)} />
              <span>Published</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save}>{editing ? 'Save Changes' : 'Create Post'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
