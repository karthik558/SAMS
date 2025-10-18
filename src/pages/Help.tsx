import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  LifeBuoy,
  Sparkles,
  Package,
  ClipboardCheck,
  BarChart3,
  Ticket,
  Command,
  ArrowUpRight,
  ShieldCheck,
} from "lucide-react";
import Breadcrumbs from "@/components/layout/Breadcrumbs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { helpGuides } from "@/data/help-guides";
import { useHelpGuide } from "@/components/help/HelpGuideProvider";
import { cn } from "@/lib/utils";
import { isDemoMode } from "@/lib/demo";
import { getCurrentUserId, listUserPermissions, mergeDefaultsWithOverrides, type PageKey } from "@/services/permissions";

type RoleKey = "admin" | "manager" | "user";

type AccessRule = {
  roles?: RoleKey[];
  pageKey?: PageKey;
};

type QuickAction = {
  label: string;
  description: string;
  to: string;
  icon: LucideIcon;
} & AccessRule;

type KnowledgeArticle = {
  title: string;
  description: string;
  to?: string;
  guideId?: string;
} & AccessRule;

type KnowledgeCategory = {
  id: string;
  title: string;
  summary: string;
  icon: LucideIcon;
  articles: KnowledgeArticle[];
};

type SupportChannel = {
  title: string;
  description: string;
  to?: string;
  icon: LucideIcon;
  cta: string;
  guideId?: string;
} & AccessRule;

const quickActions: QuickAction[] = [
  {
    label: "Assets workspace",
    description: "Create, edit, or verify equipment records.",
    to: "/assets",
    icon: Package,
    pageKey: "assets",
  },
  {
    label: "Approvals queue",
    description: "Review pending change requests.",
    to: "/approvals",
    icon: ClipboardCheck,
    roles: ["admin", "manager"],
  },
  {
    label: "Insights & reports",
    description: "Generate exports and share results.",
    to: "/reports",
    icon: BarChart3,
    pageKey: "reports",
  },
  {
    label: "Support tickets",
    description: "Escalate issues or request access.",
    to: "/tickets",
    icon: Ticket,
  },
];

const knowledgeCategories: KnowledgeCategory[] = [
  {
    id: "orientation",
    title: "Orientation & navigation",
    summary: "Stay productive with keyboard shortcuts, personalized layouts, and mobile friendly views.",
    icon: Sparkles,
    articles: [
      {
        title: "Keyboard-first command palette",
        description: "Press ⌘K / Ctrl+K to jump between modules and launch quick actions without leaving the keyboard.",
        guideId: "command-palette",
      },
      {
        title: "Choose your preferred layout density",
        description: "Switch between sidebar or top navigation, compact tables, and sticky headers from Settings.",
        to: "/settings",
        pageKey: "settings",
      },
      {
        title: "Mobile quick actions",
        description: "Use the mobile bottom bar for rapid access to Dashboard, Scan, Assets, and Tickets while on the move.",
      },
    ],
  },
  {
    id: "asset-lifecycle",
    title: "Asset lifecycle",
    summary: "Track every asset from intake to retirement, complete with QR labels and approvals.",
    icon: Package,
    articles: [
      {
        title: "Add a new asset",
        description: "Capture full metadata, assign ownership, and create a catalogue entry in minutes.",
        guideId: "add-asset",
      },
      {
        title: "Smart approvals",
        description: "Route sensitive changes through manager and admin review with comments and status tracking.",
        guideId: "review-approval",
        roles: ["admin", "manager"],
      },
      {
        title: "Generate QR codes",
        description: "Batch export printable QR sheets or generate single codes for equipment in the field.",
        to: "/qr-codes",
        pageKey: "qrcodes",
      },
    ],
  },
  {
    id: "insights",
    title: "Insights & compliance",
    summary: "Stay audit ready with scheduled reviews, dashboards, and automated reports.",
    icon: BarChart3,
    articles: [
      {
        title: "Generate an operational report",
        description: "Choose the right template, scope your filters, and export to PDF, Excel, CSV, or JSON.",
        guideId: "generate-report",
        pageKey: "reports",
      },
      {
        title: "Run an audit session",
        description: "Verify assets, capture discrepancies, and publish audit-ready summaries.",
        guideId: "perform-audit",
        roles: ["admin", "manager"],
        pageKey: "audit",
      },
      {
        title: "Automation & notifications",
        description: "Stay ahead of expiry, license thresholds, and ticket responses via tailored alerts.",
      },
    ],
  },
  {
    id: "support",
    title: "Support & escalation",
    summary: "Log issues, request upgrades, and keep stakeholders in the loop.",
    icon: LifeBuoy,
    articles: [
      {
        title: "Create a support ticket",
        description: "Log maintenance, access, or improvement requests and monitor replies in real time.",
        guideId: "raise-ticket",
      },
      {
        title: "License and compliance questions",
        description: "Track usage versus entitlements and request upgrades directly from the license card.",
        to: "/license",
        roles: ["admin"],
      },
      {
        title: "Share release notes",
        description: "Use Newsletter broadcasts to announce changes, maintenance windows, and success stories.",
        to: "/newsletter",
      },
    ],
  },
];

const supportChannels: SupportChannel[] = [
  {
    title: "Raise a ticket",
    description: "Create an issue or request with attachments so the SAMS team can respond quickly.",
    to: "/tickets",
    icon: Ticket,
    cta: "Open tickets",
  },
  {
    title: "Contact your administrator",
    description: "Reach out to your SAMS administrator for role updates, onboarding, or environment configuration.",
    icon: ShieldCheck,
    cta: "View directory",
    to: "/users",
    roles: ["admin"],
    pageKey: "users",
  },
  {
    title: "Use the command palette",
    description: "Tap ⌘K / Ctrl+K anytime to search navigation, quick actions, or recently visited records.",
    icon: Command,
    guideId: "command-palette",
    cta: "Launch guide",
  },
];

const personaHighlights = [
  {
    label: "Team members",
    description: "Quickly add assets, print QR codes, and keep inventories current.",
    icon: Package,
  },
  {
    label: "Managers & admins",
    description: "Approve changes, schedule audits, and generate stakeholder ready reports.",
    icon: ClipboardCheck,
  },
  {
    label: "Support & ops",
    description: "Track tickets, communicate updates, and stay ahead of compliance.",
    icon: LifeBuoy,
  },
] as const;

export default function Help() {
  const { startGuide, activeGuide } = useHelpGuide();
  const [role, setRole] = useState<RoleKey>("user");
  const [perm, setPerm] = useState<Record<PageKey, { v: boolean; e: boolean }> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let resolvedRole = "";
      try {
        const raw =
          (isDemoMode() ? sessionStorage.getItem("demo_auth_user") || localStorage.getItem("demo_auth_user") : null) ||
          localStorage.getItem("auth_user");
        if (raw) {
          const parsed = JSON.parse(raw);
          resolvedRole = (parsed?.role || "").toLowerCase();
        }
      } catch {
        resolvedRole = "";
      }
      if (!cancelled) {
        const normalized: RoleKey =
          resolvedRole === "admin" || resolvedRole === "manager" ? (resolvedRole as RoleKey) : "user";
        setRole(normalized);
      }
      try {
        const uid = getCurrentUserId();
        if (!uid) {
          if (!cancelled) setPerm({} as Record<PageKey, { v: boolean; e: boolean }>);
          return;
        }
        const data = await listUserPermissions(uid);
        if (!cancelled) setPerm(data as any);
      } catch {
        if (!cancelled) setPerm({} as Record<PageKey, { v: boolean; e: boolean }>);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const effectivePerm = useMemo(
    () => mergeDefaultsWithOverrides(role, perm ?? ({} as Record<PageKey, { v: boolean; e: boolean }>)),
    [role, perm]
  );

  const canAccess = useCallback(
    (rule: AccessRule = {}) => {
      const { roles, pageKey } = rule;
      if (roles?.length && !roles.includes(role)) return false;
      if (pageKey) {
        const entry = effectivePerm?.[pageKey];
        if (!entry?.v) return false;
      }
      return true;
    },
    [role, effectivePerm]
  );

  const accessibleQuickActions = useMemo(
    () => quickActions.filter((action) => canAccess(action)),
    [canAccess]
  );

  const guideAccess: Record<string, AccessRule> = useMemo(
    () => ({
      "review-approval": { roles: ["admin", "manager"] },
      "perform-audit": { roles: ["admin", "manager"], pageKey: "audit" },
      "generate-report": { pageKey: "reports" },
      "add-asset": { pageKey: "assets" },
      "command-palette": {},
      "raise-ticket": {},
    }),
    []
  );

  const accessibleGuides = useMemo(
    () => helpGuides.filter((guide) => canAccess(guideAccess[guide.id] ?? {})),
    [canAccess, guideAccess]
  );

  const accessibleSupportChannels = useMemo(
    () => supportChannels.filter((channel) => canAccess(channel)),
    [canAccess]
  );

  return (
    <div className="space-y-10">
      <Breadcrumbs items={[{ label: "Dashboard", to: "/" }, { label: "Help Center" }]} />

      <section className="rounded-3xl border border-border/60 bg-card shadow-sm">
        <div className="flex flex-col gap-8 p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl space-y-4">
            <h1 className="text-3xl font-bold text-foreground sm:text-4xl">
              Welcome to the SAMS Help Center
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
              Explore best-practice workflows, follow live walkthroughs that move with you, and share resources with your team. Everything is built on your actual SAMS data so you can learn and apply at the same time.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button size="lg" onClick={() => startGuide("add-asset")} className="gap-2">
                Start “Add asset” tour
                <ArrowUpRight className="h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => startGuide("command-palette")}>
                Learn the command palette
              </Button>
            </div>
            {activeGuide ? (
              <p className="text-xs text-muted-foreground">
                Currently following: <span className="font-medium text-foreground">{activeGuide.title}</span>. Use the <span className="font-medium">←</span> and <span className="font-medium">→</span> keys to move through steps.
              </p>
            ) : null}
          </div>
          <div className="grid w-full max-w-xl gap-3 sm:grid-cols-2">
            {accessibleQuickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.to}
                  to={action.to}
                  className="group rounded-2xl border border-border/50 bg-background/80 p-4 transition hover:border-primary/40 hover:bg-primary/5"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-sm font-semibold text-foreground group-hover:text-primary">{action.label}</h3>
                  <p className="mt-2 text-xs text-muted-foreground">{action.description}</p>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {personaHighlights.map((persona) => {
          const Icon = persona.icon;
          return (
            <Card key={persona.label} className="border border-border/60 bg-card/90 shadow-sm">
              <CardContent className="flex h-full flex-col gap-4 p-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground">
                  {persona.label}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {persona.description}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold text-foreground">Interactive walkthroughs</h2>
          <p className="text-sm text-muted-foreground">
            Follow along with guided steps that automatically navigate you between pages and highlight what matters for each role.
          </p>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          {accessibleGuides.map((guide) => {
            const Icon = guide.icon;
            const isActive = activeGuide?.id === guide.id;
            return (
              <Card
                key={guide.id}
                className={cn(
                  "border border-border/70 bg-card/95 shadow-sm transition hover:border-primary/40",
                  isActive && "ring-2 ring-primary/40"
                )}
              >
                <CardHeader className="flex flex-col gap-4 pb-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="space-y-1">
                      <CardTitle className="text-lg font-semibold text-foreground">{guide.title}</CardTitle>
                      <CardDescription className="text-sm text-muted-foreground leading-relaxed">
                        {guide.summary}
                      </CardDescription>
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {guide.audience}
                  </span>
                </CardHeader>
                <CardContent className="flex flex-col gap-4 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-xs text-muted-foreground">
                    {guide.steps.length} step{guide.steps.length === 1 ? "" : "s"} • {guide.steps[0]?.route ? `Starts on ${guide.steps[0].route}` : "Multi-page tour"}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => startGuide(guide.id)}>
                      {isActive ? "Resume guide" : "Start guide"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold text-foreground">Knowledge base</h2>
          <p className="text-sm text-muted-foreground">
            Browse curated guidance for every stage of the asset lifecycle. Each article links directly to live pages or a guided tour so you can apply the recommendation instantly.
          </p>
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          {knowledgeCategories.map((category) => {
            const visibleArticles = category.articles.filter((article) => canAccess(article));
            if (!visibleArticles.length) return null;
            const Icon = category.icon;
            return (
              <Card key={category.id} className="border border-border/70 bg-card/95 shadow-sm">
                <CardHeader className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="space-y-1">
                      <CardTitle className="text-lg font-semibold text-foreground">{category.title}</CardTitle>
                      <CardDescription className="text-sm text-muted-foreground">
                        {category.summary}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 border-t border-border/60 pt-4">
                  <Accordion type="single" collapsible className="space-y-3">
                    {visibleArticles.map((article, index) => (
                      <AccordionItem key={`${category.id}-${index}`} value={`${category.id}-${index}`} className="rounded-xl border border-border/60 px-3">
                        <AccordionTrigger className="text-left text-sm font-semibold text-foreground hover:text-primary">
                          {article.title}
                        </AccordionTrigger>
                        <AccordionContent className="space-y-3 text-sm text-muted-foreground">
                          <p>{article.description}</p>
                          <div className="flex flex-wrap gap-2">
                            {article.guideId ? (
                              <Button size="sm" onClick={() => startGuide(article.guideId!)} className="w-full sm:w-auto">
                                Launch guided walkthrough
                              </Button>
                            ) : null}
                            {article.to ? (
                              <Link
                                to={article.to}
                                className="inline-flex items-center gap-2 rounded-lg border border-border/60 px-3 py-1.5 text-xs font-medium text-primary transition hover:border-primary/40 hover:bg-primary/5"
                              >
                                Jump to page
                              </Link>
                            ) : null}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold text-foreground">Need more help?</h2>
          <p className="text-sm text-muted-foreground">
            Support channels that keep your team informed and your operations compliant.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {accessibleSupportChannels.map((channel) => {
            const Icon = channel.icon;
            return (
              <Card key={channel.title} className="border border-border/70 bg-card/90 shadow-sm">
                <CardContent className="flex h-full flex-col gap-4 p-5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-foreground">{channel.title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{channel.description}</p>
                  </div>
                  <div className="mt-auto">
                    {channel.guideId ? (
                      <Button size="sm" variant="outline" onClick={() => startGuide(channel.guideId!)}>
                        {channel.cta}
                      </Button>
                    ) : channel.to ? (
                      <Link
                        to={channel.to}
                        className="inline-flex items-center gap-2 text-sm font-medium text-primary transition hover:text-primary/80"
                      >
                        {channel.cta}
                        <ArrowUpRight className="h-4 w-4" />
                      </Link>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
        <Alert className="border-primary/40 bg-primary/5">
          <LifeBuoy className="h-5 w-5 text-primary" />
          <AlertTitle>Service status & announcements</AlertTitle>
          <AlertDescription>
            Keep teams informed with real-time updates in the Notification center. Use the Newsletter module for planned maintenance and release notes.
          </AlertDescription>
        </Alert>
      </section>
    </div>
  );
}
