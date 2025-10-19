import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  BarChart3,
  BellRing,
  Check,
  ClipboardList,
  Copy,
  GitBranch,
  KeyRound,
  Mail,
  QrCode,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { SiteLayout } from "@/components/site/SiteLayout";

const BaseUrl = "https://samsproject.in";
const HeroDescription =
  "SAMS centralizes the entire asset lifecycle with QR-enabled tracking, collaborative workflows, and audit-ready reporting in a responsive, open-source platform.";

const heroPoints = [
  {
    title: "Lifecycle Clarity",
    description: "Replace fragmented spreadsheets with a normalized registry capturing procurement, ownership, and depreciation data.",
    icon: ClipboardList,
  },
  {
    title: "QR-Ready Operations",
    description: "Generate, print, and scan QR labels with presets, exports, and history that keep audits simple.",
    icon: QrCode,
  },
  {
    title: "Collaborative Guardrails",
    description: "Empower facilities, finance, and audit teams with scoped access, approvals, tickets, and exports that respect every role.",
    icon: Users,
  },
];

const productHighlights = [
  {
    title: "Asset Lifecycle & Registry",
    icon: ClipboardList,
    summary: "Keep every asset actionable with normalized, auditable metadata.",
    bullets: [
      "Track procurement, lifecycle, depreciation, and ownership data in one place.",
      "Normalize quantities into unit-level records for accurate reconciliation.",
      "Maintain natural asset ID ordering so sibling items stay grouped.",
    ],
    tag: "Operations",
  },
  {
    title: "Properties & Access Control",
    icon: Users,
    summary: "Scale governance with scoped visibility and approvals.",
    bullets: [
      "Maintain a property directory with occupancy status and permissions.",
      "Grant department or location visibility per user and role.",
      "Surface pending approvals so managers can act in context.",
    ],
    tag: "Security",
  },
  {
    title: "QR Labelling & Printing",
    icon: QrCode,
    summary: "Label assets instantly with export-friendly workflows.",
    bullets: [
      "Generate QR codes individually or in bulk, with PNG, ZIP, and PDF exports.",
      "Align output with hardware using presets and custom label sizing.",
      "Review print history to preserve audit evidence and prevent duplicates.",
    ],
    tag: "Logistics",
  },
  {
    title: "Tickets & Collaboration",
    icon: BellRing,
    summary: "Resolve issues fast with role-aware ticketing and notifications.",
    bullets: [
      "Collaborate through Kanban and list views that respect SLA and priority.",
      "Lock comments automatically when tickets close to preserve history.",
      "Route deep-link notifications that open the right context immediately.",
    ],
    tag: "Support",
  },
  {
    title: "Insights & Reliability",
    icon: BarChart3,
    summary: "Monitor performance with exportable insights and offline resilience.",
    bullets: [
      "Summarize audits with dashboards, reports, and downloadable exports.",
      "Offer a PWA-ready install experience for quick access on any device.",
      "Cache asset lists offline to keep field teams productive when disconnected.",
    ],
    tag: "Analytics",
  },
  {
    title: "Open & Extensible",
    icon: GitBranch,
    summary: "Run SAMS self-hosted or tailor it for your stack.",
    bullets: [
      "Built with React, Vite, Supabase, and modern TypeScript tooling.",
      "Ships with demo data fallbacks so evaluation never blocks on backend setup.",
      "MIT licensed with contribution guidelines and an active roadmap.",
    ],
    tag: "Engineering",
  },
];

const modules = [
  { name: "Dashboard", scope: "Activity feed, quick actions, and an audit readiness snapshot." },
  { name: "Assets", scope: "Advanced tables and bulk actions with QR generation and exports." },
  { name: "Properties", scope: "Location registry, occupancy, and role-based visibility controls." },
  { name: "QR Codes", scope: "History, previews, downloads, and print orchestration from one place." },
  { name: "Tickets", scope: "Maintenance lifecycle with SLA tracking and Kanban board workflows." },
  { name: "Announcements", scope: "Release notes, maintenance bulletins, and category badges." },
  { name: "Reports", scope: "Operational insights with scoped access and audit-grade exports." },
  { name: "Settings & Users", scope: "Role management, permissions, and department/property access." },
];

const qualitySignals = [
  {
    title: "Testing",
    description: "Component-level tests roll out alongside critical modules, with regression suites on the roadmap.",
  },
  {
    title: "Accessibility",
    description: "Shadcn and Radix primitives deliver keyboard-friendly experiences with ARIA defaults baked in.",
  },
  {
    title: "Observability",
    description: "User-facing events surface in toasts and audit trails, while Supabase captures server-side logs.",
  },
];

const pendingInitiatives = [
  "Advanced analytics dashboards with multi-property drill downs.",
  "Offline-first ticket queue for updates made in the field.",
  "Automated label layout designer with saved presets per printer.",
  "Playwright-based end-to-end testing integrated into CI.",
  "Role-based data retention policies and export audit trails.",
];

const deploymentNotes = [
  "Vercel is the reference deployment target with configuration provided in vercel.json.",
  "Environment variables can be managed via Vercel dashboards or any modern hosting provider.",
  "Self-hosted deployments should enforce HTTPS because camera access for QR downloads expects secure origins.",
];

const browserSupport = [
  "Responsive layouts optimized for desktop, tablet, and mobile breakpoints.",
  "Best experienced on current versions of Chrome, Edge, Firefox, and Safari.",
  "Installable as a Progressive Web App for always-on access.",
];

const structuredData = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "SAMS — Smart Asset Management System",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: BaseUrl,
  description: HeroDescription,
  image: `${BaseUrl}/sams_logo.png`,
  offers: {
    "@type": "Offer",
    price: "0.00",
    priceCurrency: "USD",
    availability: "https://schema.org/InStock",
  },
  featureList: productHighlights.map((item) => item.title),
  author: {
    "@type": "Person",
    name: "Karthik Lal",
    email: "mailto:karthik@samsproject.in",
  },
  publisher: {
    "@type": "Organization",
    name: "SAMS Project",
    url: BaseUrl,
  },
};

export default function Website() {
  const [copied, setCopied] = useState<null | "email" | "password">(null);
  const handleCopy = async (value: string, which: "email" | "password") => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(which);
      setTimeout(() => setCopied(null), 1200);
    } catch {}
  };

  const credentialBlocks = useMemo(
    () => [
      { label: "demo@demo.com", icon: Mail, flag: "email" as const },
      { label: "demo@123", icon: KeyRound, flag: "password" as const },
    ],
    []
  );

  return (
    <SiteLayout>
      <Helmet>
        <title>SAMS — Smart Asset Management System</title>
        <meta name="description" content={HeroDescription} />
        <meta
          name="keywords"
          content="asset management software, qr code asset tracking, supabase asset system, equipment tracking, facilities management, audit-ready reporting, open source asset platform"
        />
        <meta name="author" content="Karthik Lal" />
        <link rel="canonical" href={BaseUrl} />
        <meta property="og:title" content="SAMS — Smart Asset Management System" />
        <meta property="og:description" content={HeroDescription} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={BaseUrl} />
        <meta property="og:image" content={`${BaseUrl}/sams_logo.png`} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="SAMS — Smart Asset Management System" />
        <meta name="twitter:description" content={HeroDescription} />
        <meta name="twitter:image" content={`${BaseUrl}/sams_logo.png`} />
        <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
      </Helmet>

      {/* Overview / Hero */}
      <section
        id="overview"
        aria-labelledby="overview-heading"
        className="mx-auto max-w-5xl space-y-10 rounded-3xl border border-border/40 bg-background px-6 py-14 text-center shadow-sm md:px-12 md:py-20"
      >
        <div className="mx-auto max-w-3xl space-y-4">
          <h1 id="overview-heading" className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl md:leading-snug">
            Modern asset operations for distributed teams
          </h1>
          <p className="text-base leading-relaxed text-muted-foreground md:text-lg">
            {HeroDescription}
          </p>
        </div>
        <div className="mx-auto grid max-w-4xl gap-4 text-left md:grid-cols-3">
          {heroPoints.map(({ title, description, icon: Icon }) => (
            <div key={title} className="flex h-full flex-col gap-3 rounded-2xl border border-border/40 bg-background/95 p-5 shadow-sm">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="h-5 w-5" aria-hidden />
              </div>
              <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Product highlights */}
      <section id="highlights" aria-labelledby="highlights-heading" className="mx-auto mt-16 max-w-6xl space-y-8">
        <div className="mx-auto max-w-3xl space-y-3 text-center">
          <h2 id="highlights-heading" className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
            End-to-end capabilities without the clutter
          </h2>
          <p className="text-muted-foreground">
            SAMS keeps workflows approachable—rich enough for enterprise teams, calm enough for daily use.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {productHighlights.map(({ title, icon: Icon, summary, bullets, tag }) => (
            <article
              key={title}
              className="flex h-full flex-col gap-5 rounded-2xl border border-border/40 bg-background/95 p-6 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center justify-center rounded-xl bg-primary/10 p-3 text-primary">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <span className="rounded-full bg-muted/60 px-3 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {tag}
                </span>
              </div>
              <div className="space-y-3">
                <h3 className="text-lg font-semibold tracking-tight text-foreground">{title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{summary}</p>
              </div>
              <ul className="space-y-2 text-sm leading-relaxed text-muted-foreground">
                {bullets.map((bullet) => (
                  <li key={bullet} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-3.5 w-3.5 flex-none text-primary/80" aria-hidden />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      {/* Platform modules */}
      <section id="modules" aria-labelledby="modules-heading" className="mx-auto mt-16 max-w-6xl space-y-8">
        <div className="mx-auto max-w-3xl space-y-3 text-center">
          <h2 id="modules-heading" className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
            Modules designed for teams, not tool sprawl
          </h2>
          <p className="text-muted-foreground">
            Assets, properties, tickets, and reports stay organized with guardrails that respect roles and context.
          </p>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          {modules.map((module) => (
            <div key={module.name} className="flex h-full flex-col gap-3 rounded-2xl border border-border/40 bg-background/95 p-5 shadow-sm">
              <h3 className="text-lg font-semibold tracking-tight text-foreground">{module.name}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{module.scope}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Quality, deployment, roadmap */}
      <section id="quality" aria-labelledby="quality-heading" className="mx-auto mt-16 max-w-6xl space-y-8">
        <div className="mx-auto max-w-3xl space-y-3 text-center">
          <h2 id="quality-heading" className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
            Built for reliability, delivered with a roadmap
          </h2>
          <p className="text-muted-foreground">
            Testing, accessibility, deployment guidance, and upcoming releases are part of the package—not afterthoughts.
          </p>
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="border-border/40 bg-background/95 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-semibold tracking-tight text-foreground">Quality & Observability</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground">
              {qualitySignals.map((item) => (
                <div key={item.title} className="flex gap-2">
                  <Check className="mt-1 h-3.5 w-3.5 flex-none text-primary/80" aria-hidden />
                  <span>
                    <strong className="text-foreground/90">{item.title}:</strong> {item.description}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card className="border-border/40 bg-background/95 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-semibold tracking-tight text-foreground">Deployment Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground">
              {deploymentNotes.map((note) => (
                <div key={note} className="flex gap-2">
                  <Check className="mt-1 h-3.5 w-3.5 flex-none text-primary/80" aria-hidden />
                  <span>{note}</span>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card className="border-border/40 bg-background/95 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-semibold tracking-tight text-foreground">What&apos;s Shipping Next</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground">
              {pendingInitiatives.map((item) => (
                <div key={item} className="flex gap-2">
                  <Check className="mt-1 h-3.5 w-3.5 flex-none text-primary/80" aria-hidden />
                  <span>{item}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Demo credentials */}
      <section id="demo" aria-labelledby="demo-heading" className="mx-auto mt-16 max-w-4xl space-y-6">
        <div className="mx-auto max-w-3xl space-y-3 text-center">
          <h2 id="demo-heading" className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
            Explore the live demo
          </h2>
          <p className="text-muted-foreground">
            Use the hosted sandbox to experience QR-ready workflows, or fork the repository to tailor SAMS for your asset models.
          </p>
        </div>
        <Card className="border-border/40 bg-background/95 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold tracking-tight text-foreground">Demo Credentials</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {credentialBlocks.map(({ label, icon: Icon, flag }) => (
              <div key={flag} className="flex items-center justify-between rounded-xl border border-border/60 bg-background/80 px-3 py-2 shadow-sm">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-primary" aria-hidden />
                  <code className="font-mono text-sm text-foreground">{label}</code>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="rounded-md p-1 text-muted-foreground transition hover:bg-muted/60 hover:text-foreground"
                      aria-label={`Copy ${flag}`}
                      onClick={() => handleCopy(label, flag)}
                    >
                      {copied === flag ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent sideOffset={8}>{copied === flag ? "Copied" : "Copy"}</TooltipContent>
                </Tooltip>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      {/* Browser & support */}
      <section id="support" aria-labelledby="support-heading" className="mx-auto mt-16 max-w-5xl space-y-6">
        <div className="mx-auto max-w-3xl space-y-3 text-center">
          <h2 id="support-heading" className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
            Ready when your teams are
          </h2>
          <p className="text-muted-foreground">
            Whether you&apos;re validating the demo or deploying to production, support and compliance are already in place.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-border/40 bg-background/95 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-semibold tracking-tight text-foreground">Browser & Device Support</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm leading-relaxed text-muted-foreground">
              {browserSupport.map((item) => (
                <div key={item} className="flex gap-2">
                  <Check className="mt-1 h-3.5 w-3.5 flex-none text-primary/80" aria-hidden />
                  <span>{item}</span>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card className="border-border/40 bg-background/95 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-semibold tracking-tight text-foreground">Support & Governance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground">
              <p>
                Email{" "}
                <a href="mailto:karthik@samsproject.in" className="text-primary underline underline-offset-2">
                  karthik@samsproject.in
                </a>{" "}
                for guided walkthroughs, implementation planning, or tailored onboarding.
              </p>
              <p>
                Prefer async updates? Open a{" "}
                <a href="https://github.com/karthik558/SAMS/issues" className="text-primary underline underline-offset-2" rel="noreferrer">
                  GitHub issue
                </a>{" "}
                to report bugs or request enhancements.
              </p>
              <p>The project ships under the MIT License with a community Code of Conduct, keeping contributions welcoming.</p>
            </CardContent>
          </Card>
        </div>
      </section>
    </SiteLayout>
  );
}
