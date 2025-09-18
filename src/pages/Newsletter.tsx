import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import Breadcrumbs from "@/components/layout/Breadcrumbs";
import PageHeader from "@/components/layout/PageHeader";
import { Megaphone, Filter, Pencil, Trash2, Search } from "lucide-react";
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
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft'>('all');

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
        } catch {
          // ignore fallback author fetch errors
        }
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
    const matchesQuery = !q || p.title.toLowerCase().includes(q) || p.body.toLowerCase().includes(q) || (p.author || '').toLowerCase().includes(q);
    const matchesCategory = selectedCategory === 'all' || (p.category || 'update') === selectedCategory;
    const matchesStatus = statusFilter === 'all' || (statusFilter === 'published' ? p.published : !p.published);
    return matchesQuery && matchesCategory && matchesStatus;
  });

  const publishedCount = posts.filter((p) => p.published).length;
  const draftCount = posts.length - publishedCount;
  const lastUpdated = posts[0]?.created_at ? new Date(posts[0].created_at).toLocaleString() : '—';
  const categoryFilters = [{ key: 'all', label: 'All' }, ...categories.map((c) => ({ key: c.key, label: c.label }))];
  const statusFilters: Array<{ key: typeof statusFilter; label: string }> = [
    { key: 'all', label: 'All' },
    { key: 'published', label: 'Published' },
    { key: 'draft', label: 'Drafts' },
  ];
  const categoryStats = useMemo(() => {
    if (!categories.length) return [] as Array<{ key: string; label: string; hue: string; count: number }>;
    return categories.map((c) => ({
      key: c.key,
      label: c.label,
      hue: c.hue,
      count: posts.filter((p) => (p.category || 'update') === c.key).length,
    }));
  }, [categories, posts]);

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Dashboard', to: '/' }, { label: 'Newsletter' }]} />

      <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm sm:p-8">
        <PageHeader
          icon={Megaphone}
          title="Status & Updates"
          description="Broadcast release notes, maintenance windows, and success stories to keep everyone aligned."
          actions={isAdmin ? <Button onClick={openCreate}>New Post</Button> : null}
        />
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-border/40 bg-background/90 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Total Posts</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{posts.length}</p>
          </div>
          <div className="rounded-xl border border-border/40 bg-background/90 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Published</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{publishedCount}</p>
          </div>
          <div className="rounded-xl border border-border/40 bg-background/90 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Drafts</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{draftCount}</p>
          </div>
          <div className="rounded-xl border border-border/40 bg-background/90 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Last Update</p>
            <p className="mt-1 text-base font-medium text-foreground">{lastUpdated}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[2fr,1fr]">
        <Card className="rounded-2xl border border-border/60 bg-card shadow-sm">
          <CardHeader className="space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <CardTitle className="text-lg font-semibold text-foreground">Announcement Feed</CardTitle>
                <CardDescription className="text-sm text-muted-foreground">
                  Browse updates, filter by category, and surface the messages that matter most.
                </CardDescription>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative w-full sm:w-64">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search updates…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="h-10 w-full rounded-lg border-border/60 bg-background/80 pl-9"
                  />
                </div>
                <div className="flex items-center gap-2">
                  {statusFilters.map((option) => (
                    <Button
                      key={option.key}
                      size="sm"
                      variant={statusFilter === option.key ? 'default' : 'outline'}
                      onClick={() => setStatusFilter(option.key)}
                      className="h-9 px-3 text-xs"
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Filter className="h-3.5 w-3.5" />
              <span>Filter by category:</span>
              <div className="flex flex-wrap items-center gap-2">
                {categoryFilters.map((cat) => (
                  <Button
                    key={cat.key}
                    size="sm"
                    variant={selectedCategory === cat.key ? 'secondary' : 'ghost'}
                    className="h-8 px-3 text-xs"
                    onClick={() => setSelectedCategory(cat.key)}
                  >
                    {cat.label}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
                Loading announcements…
              </div>
            ) : filtered.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
                Nothing to show yet. Try adjusting your filters or add a new update.
              </div>
            ) : (
              filtered.map((p) => {
                const s = statusOf(p);
                const expanded = expandedId === p.id;
                const isLong = (p.body?.length || 0) > 320 || (p.body || '').split(/\n/).length > 6;
                return (
                  <article
                    key={p.id}
                    className="group rounded-xl border border-border/50 bg-card/90 p-4 shadow-sm transition hover:border-border hover:shadow-md"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium ${s.cls}`}>
                            {s.label}
                          </span>
                          {!p.published && (
                            <span className="inline-flex items-center rounded border border-border/60 bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                              Draft
                            </span>
                          )}
                        </div>
                        <h3 className="mt-2 text-base font-semibold text-foreground line-clamp-2" title={p.title}>
                          {p.title}
                        </h3>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {new Date(p.created_at).toLocaleString()} {p.author ? `• ${p.author}` : ''}
                        </p>
                      </div>
                      {isAdmin && (
                        <div className="flex items-center gap-1">
                          <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Edit post" onClick={() => openEdit(p)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive"
                            aria-label="Delete post"
                            onClick={() => remove(p.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                    <div className="mt-3 text-[13.5px] leading-6 text-foreground">
                      <div className={`relative whitespace-pre-wrap ${(!expanded && isLong) ? 'max-h-32 overflow-hidden pr-4 md:max-h-40' : ''}`}>
                        {p.body}
                        {!expanded && isLong && (
                          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-card via-card/90 to-transparent" />
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
                  </article>
                );
              })
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="rounded-2xl border border-border/60 bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-foreground">Category Overview</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                How your announcements are distributed.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {categoryStats.length === 0 ? (
                <p className="text-xs text-muted-foreground">Categories will appear once they are created.</p>
              ) : (
                categoryStats.map((c) => (
                  <div key={c.key} className="flex items-center justify-between rounded-lg border border-border/40 bg-muted/20 px-3 py-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <span className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] ${hueBadge(c.hue)}`}>
                        {c.label}
                      </span>
                    </div>
                    <span className="text-sm text-muted-foreground">{c.count}</span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

        </div>
      </div>

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
