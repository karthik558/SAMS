import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import Breadcrumbs from "@/components/layout/Breadcrumbs";
import { Megaphone, Filter, Pencil, Trash2, Search, FileText, CheckCircle, Edit3, Clock } from "lucide-react";
import { createNewsletterPost, deleteNewsletterPost, listAllNewsletterPosts, updateNewsletterPost, listNewsletterCategories, type NewsletterPost, type NewsletterCategory } from "@/services/newsletter";
import { isDemoMode } from "@/lib/demo";
import { cn } from "@/lib/utils";
import MetricCard from "@/components/ui/metric-card";

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
  const [category, setCategory] = useState<string>('release_notes');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft'>('all');
  const [composeExpanded, setComposeExpanded] = useState(false);

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

  useEffect(() => {
    if (!isAdmin && statusFilter === 'draft') {
      setStatusFilter('all');
    }
  }, [isAdmin, statusFilter]);

  const resetForm = () => { setEditing(null); setTitle(''); setBody(''); setPublished(true); setCategory('release_notes'); setComposeExpanded(false); };
  const openCreate = () => { resetForm(); setOpen(true); };
  const openEdit = (p: NewsletterPost) => { setEditing(p); setTitle(p.title); setBody(p.body); setPublished(p.published); setCategory(p.category || 'release_notes'); setComposeExpanded(false); setOpen(true); };

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
    const cat = categories.find(c => c.key === (p.category||'release_notes')) || { label: 'Release Notes', hue: 'blue' } as NewsletterCategory;
    return { label: cat.label, cls: hueBadge(cat.hue) };
  };

  const publishedPosts = useMemo(() => posts.filter((p) => p.published), [posts]);
  const visiblePosts = useMemo(() => (isAdmin ? posts : publishedPosts), [isAdmin, posts, publishedPosts]);

  const filtered = visiblePosts.filter(p => {
    const q = query.trim().toLowerCase();
    const matchesQuery = !q || p.title.toLowerCase().includes(q) || p.body.toLowerCase().includes(q) || (p.author || '').toLowerCase().includes(q);
    const matchesCategory = selectedCategory === 'all' || (p.category || 'release_notes') === selectedCategory;
    const matchesStatus = statusFilter === 'all' || (statusFilter === 'published' ? p.published : !p.published);
    return matchesQuery && matchesCategory && matchesStatus;
  });

  const publishedCount = publishedPosts.length;
  const draftCount = posts.length - publishedCount;
  const lastUpdated = visiblePosts[0]?.created_at ? new Date(visiblePosts[0].created_at).toLocaleString() : '—';
  const categoryFilters = [{ key: 'all', label: 'All' }, ...categories.map((c) => ({ key: c.key, label: c.label }))];
  const statusFilters = useMemo(() => {
    const filters: Array<{ key: typeof statusFilter; label: string }> = [
      { key: 'all', label: 'All' },
      { key: 'published', label: 'Published' },
    ];
    if (isAdmin) {
      filters.push({ key: 'draft', label: 'Drafts' });
    }
    return filters;
  }, [isAdmin]);
  const categoryStats = useMemo(() => {
    if (!categories.length) return [] as Array<{ key: string; label: string; hue: string; count: number }>;
    const source = isAdmin ? posts : visiblePosts;
    return categories.map((c) => ({
      key: c.key,
      label: c.label,
      hue: c.hue,
      count: source.filter((p) => (p.category || 'release_notes') === c.key).length,
    }));
  }, [categories, posts, visiblePosts, isAdmin]);

  return (
    <div className="space-y-8 md:space-y-10">
      <Breadcrumbs items={[{ label: 'Dashboard', to: '/' }, { label: 'Newsletter' }]} />

      <section className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/95 shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary))/0.12,transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,hsl(var(--muted))/0.35,transparent_60%)] opacity-80" />
        <div className="relative z-10 flex flex-col gap-8 p-6 sm:p-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl space-y-4">
              <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">Status & Updates</h1>
              <p className="text-sm text-muted-foreground md:text-base">
                Keep your organization aligned with polished release notes, planned maintenance, and human stories from the field.
              </p>
            </div>
            {isAdmin ? (
              <div className="flex items-center gap-3 self-start rounded-xl border border-border/60 bg-background/80 p-3 backdrop-blur">
                <div className="hidden max-w-[12rem] text-xs text-muted-foreground sm:block">
                  <p className="font-medium text-foreground">Ready to announce?</p>
                  <p>Draft, preview, and go live without leaving this page.</p>
                </div>
                <Button onClick={openCreate} size="lg" className="gap-2 rounded-xl px-5">
                  <Megaphone className="h-5 w-5" />
                  Publish Update
                </Button>
              </div>
            ) : null}
          </div>
          <div className={cn("grid gap-3 sm:grid-cols-2 lg:grid-cols-3", isAdmin ? "xl:grid-cols-4" : "xl:grid-cols-3")}>
            <MetricCard
              icon={FileText}
              title="Total Posts"
              value={(isAdmin ? posts.length : visiblePosts.length).toLocaleString()}
              iconClassName="text-primary h-4 w-4"
            />
            <MetricCard
              icon={CheckCircle}
              title="Published"
              value={publishedCount.toLocaleString()}
              iconClassName="text-primary h-4 w-4"
            />
            {isAdmin && (
              <MetricCard
                icon={Edit3}
                title="Drafts"
                value={draftCount.toLocaleString()}
                iconClassName="text-primary h-4 w-4"
              />
            )}
            <MetricCard
              icon={Clock}
              title="Last Update"
              value={lastUpdated}
              iconClassName="text-primary h-4 w-4"
            />
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card className="rounded-2xl border border-border/60 bg-card/95 shadow-lg">
          <CardHeader className="space-y-6 border-b border-border/60 bg-muted/10 px-6 py-6 sm:px-8">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="space-y-2">
                <CardTitle className="text-xl font-semibold text-foreground">Announcement Feed</CardTitle>
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
                    className="h-10 w-full rounded-xl border-border/60 bg-background/75 pl-9"
                  />
                </div>
                {isAdmin ? (
                  <div className="flex items-center gap-2">
                    {statusFilters.map((option) => (
                      <Button
                        key={option.key}
                        size="sm"
                        variant={statusFilter === option.key ? 'secondary' : 'ghost'}
                        onClick={() => setStatusFilter(option.key)}
                        className="h-9 px-3 text-xs font-semibold"
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                ) : null}
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
                    variant={selectedCategory === cat.key ? 'outline' : 'ghost'}
                    className={cn(
                      "h-8 rounded-lg px-3 text-xs font-semibold transition",
                      selectedCategory === cat.key && "border-primary/60 text-primary",
                    )}
                    onClick={() => setSelectedCategory(cat.key)}
                  >
                    {cat.label}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 px-6 py-6 sm:px-8">
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
                    className="group rounded-xl border border-border/60 bg-background/90 p-5 shadow-sm transition-all hover:border-primary/40 hover:shadow-md"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
                          <span className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-0.5", s.cls)}>
                            {s.label}
                          </span>
                          {!p.published ? (
                            <span className="inline-flex items-center rounded-md border border-border/60 bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                              Draft
                            </span>
                          ) : null}
                        </div>
                        <h3 className="text-lg font-semibold leading-snug text-foreground line-clamp-2" title={p.title}>
                          {p.title}
                        </h3>
                        <p className="text-xs text-muted-foreground">
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
                    <div className="mt-3 text-sm leading-6 text-foreground">
                      <div className={cn("relative whitespace-pre-wrap", !expanded && isLong && "max-h-32 overflow-hidden pr-4 md:max-h-40")}>
                        {p.body}
                        {!expanded && isLong && (
                          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-background via-background/90 to-transparent" />
                        )}
                      </div>
                      {isLong && (
                        <div className="mt-3 flex justify-end">
                          <Button
                            size="sm"
                            variant="link"
                            className="h-7 px-2 text-xs"
                            onClick={() => setExpandedId(expanded ? null : p.id)}
                          >
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
          <Card className="rounded-2xl border border-border/60 bg-card/95 shadow-lg">
            <CardHeader className="px-6 py-6 sm:px-8">
              <CardTitle className="text-sm font-semibold text-foreground">Category Overview</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                How your announcements are distributed across channels.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 px-6 pb-6 sm:px-8">
              {categoryStats.length === 0 ? (
                <p className="text-xs text-muted-foreground">Categories will appear once they are created.</p>
              ) : (
                categoryStats.map((c) => (
                  <div key={c.key} className="flex items-center justify-between rounded-xl border border-border/50 bg-muted/20 px-3 py-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <span className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px]", hueBadge(c.hue))}>
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
        <DialogContent className={cn("w-[calc(100vw-2rem)] rounded-2xl border border-border/60 bg-card/95 shadow-xl", composeExpanded ? "sm:max-w-5xl" : "sm:max-w-xl")}>
          <DialogHeader className="flex flex-row items-center justify-between gap-4 border-b border-border/60 pb-4">
            <div className="space-y-1">
              <DialogTitle>{editing ? "Edit Post" : "New Post"}</DialogTitle>
              <DialogDescription className="text-sm">
                Craft a concise update, add the highlights, and choose the destination feed.
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setComposeExpanded((prev) => !prev)}>
                {composeExpanded ? "Collapse" : "Expand"}
              </Button>
            </div>
          </DialogHeader>
          <div className="grid gap-4">
            <Input
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-11 rounded-xl border-border/60 bg-muted/20"
            />
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className={cn("min-h-[260px] rounded-xl border-border/60 bg-muted/10", composeExpanded && "min-h-[380px]")}
              placeholder={
                "Write your update…\n\nSuggestions:\n• Start with a headline summary.\n• Add context, timelines, and links.\n• Mention visual tweaks, performance metrics, or content shifts."
              }
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Category</span>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="h-11 rounded-xl border-border/60 bg-muted/20">
                    <SelectValue placeholder="Pick a category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {categories.map((c) => (
                        <SelectItem key={c.key} value={c.key}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <label className="mt-6 inline-flex items-center gap-2 text-sm sm:mt-0">
                <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
                <span>Publish immediately</span>
              </label>
            </div>
          </div>
          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save}>{editing ? "Save Changes" : "Create Post"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
