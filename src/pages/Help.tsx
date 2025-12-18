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
  BookOpen,
  PlayCircle,
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
    <div className="space-y-8 pb-10">
      <Breadcrumbs items={[{ label: "Dashboard", to: "/" }, { label: "Help Center" }]} />

      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-3xl border bg-card px-8 py-12 shadow-sm sm:px-12 sm:py-16">
        <div className="relative z-10 max-w-3xl space-y-6">
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            How can we help you today?
          </h1>
          <p className="text-xl text-muted-foreground">
            Explore guides, documentation, and support resources to get the most out of SAMS.
          </p>
          
          <div className="flex flex-wrap gap-3 pt-4">
             <Button size="lg" onClick={() => startGuide("add-asset")} className="h-12 gap-2 rounded-full px-6 text-base transition-all">
                <PlayCircle className="h-5 w-5" />
                Start “Add asset” tour
              </Button>
              <Button variant="outline" size="lg" className="h-12 gap-2 rounded-full px-6 text-base" onClick={() => startGuide("command-palette")}>
                <Command className="h-4 w-4" />
                Command palette
              </Button>
          </div>
        </div>
        
        {/* Decorative background element */}
        <div className="absolute right-0 top-0 -z-10 h-full w-1/2 bg-gradient-to-l from-primary/5 to-transparent" />
        <div className="absolute -right-20 -top-20 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="grid gap-6 md:grid-cols-4">
         <div className="md:col-span-3 space-y-8">
            
            {/* Interactive Guides */}
            <section>
              <div className="mb-4 flex items-center gap-2">
                <h2 className="text-xl font-semibold">Interactive Walkthroughs</h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {accessibleGuides.map(guide => (
                  <Card key={guide.id} className="group cursor-pointer transition-all hover:shadow-md hover:border-primary/50" onClick={() => startGuide(guide.id)}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base group-hover:text-primary">{guide.title}</CardTitle>
                      <CardDescription className="line-clamp-2">{guide.summary}</CardDescription>
                    </CardHeader>
                    <CardContent>
                       <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          {guide.steps.length} Steps • {guide.audience}
                       </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>

            {/* Knowledge Base */}
            <section>
               <div className="mb-4 flex items-center gap-2">
                <h2 className="text-xl font-semibold">Knowledge Base</h2>
              </div>
              <div className="grid gap-4">
                {knowledgeCategories.map(category => (
                   <Card key={category.id} className="overflow-hidden">
                      <div className="border-b bg-muted/30 px-6 py-4">
                         <h3 className="font-semibold">{category.title}</h3>
                         <p className="text-sm text-muted-foreground">{category.summary}</p>
                      </div>
                      <div className="divide-y">
                        {category.articles.filter(a => canAccess(a)).map((article, index) => (
                           <div key={index} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                              <div className="space-y-1">
                                 <div className="font-medium text-sm">{article.title}</div>
                                 <div className="text-xs text-muted-foreground">{article.description}</div>
                              </div>
                              <div className="flex items-center gap-2">
                                {article.guideId && (
                                  <Button variant="ghost" size="sm" onClick={() => startGuide(article.guideId!)}>
                                    Start
                                  </Button>
                                )}
                                {article.to && (
                                  <Button variant="ghost" size="sm" asChild>
                                    <Link to={article.to}>View</Link>
                                  </Button>
                                )}
                              </div>
                           </div>
                        ))}
                      </div>
                   </Card>
                ))}
              </div>
            </section>

         </div>

         {/* Sidebar / Quick Links */}
         <div className="space-y-6">
            <section>
              <div className="mb-4 flex items-center gap-2">
                <h2 className="text-xl font-semibold">Quick Actions</h2>
              </div>
              <Card>
                <CardContent className="grid gap-2 pt-6">
                  {accessibleQuickActions.map(action => (
                    <Link key={action.to} to={action.to} className="flex items-center justify-between rounded-lg border p-3 text-sm transition-colors hover:bg-muted hover:text-primary">
                      <span>{action.label}</span>
                      <ArrowUpRight className="h-3 w-3 text-muted-foreground" />
                    </Link>
                  ))}
                </CardContent>
              </Card>
            </section>

            <section>
              <div className="mb-4 flex items-center gap-2">
                <h2 className="text-xl font-semibold">Support</h2>
              </div>
              <Card>
                <CardContent className="grid gap-2 pt-6">
                   {accessibleSupportChannels.map(channel => (
                      <div key={channel.title} className="rounded-lg border p-3 text-sm">
                         <div className="font-medium">{channel.title}</div>
                         <div className="mt-1 text-xs text-muted-foreground mb-2">{channel.description}</div>
                         {channel.to ? (
                           <Link to={channel.to} className="text-xs font-medium text-primary hover:underline">{channel.cta}</Link>
                         ) : (
                           <button onClick={() => channel.guideId && startGuide(channel.guideId)} className="text-xs font-medium text-primary hover:underline">{channel.cta}</button>
                         )}
                      </div>
                   ))}
                </CardContent>
              </Card>
            </section>
            
            <Alert className="border-primary/20 bg-primary/5">
              <LifeBuoy className="h-4 w-4 text-primary" />
              <AlertTitle className="text-sm font-semibold">System Status</AlertTitle>
              <AlertDescription className="text-xs text-muted-foreground mt-1">
                All systems operational. Check the newsletter for updates.
              </AlertDescription>
            </Alert>
         </div>
      </div>
    </div>
  );
}
