import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Check, Copy, ShieldCheck, Mail, KeyRound, Building2, QrCode, Shield, BarChart3, MonitorSmartphone, GitBranch, ArrowUpRight } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useState } from "react";
import { SiteLayout } from "@/components/site/SiteLayout";

const DemoUrl = "/demo/login";
const RepoUrl = "https://github.com/karthik558/SAMS";

export default function Website() {
  const [copied, setCopied] = useState<null | "email" | "password">(null);
  const handleCopy = async (value: string, which: "email" | "password") => {
    try { await navigator.clipboard.writeText(value); setCopied(which); setTimeout(() => setCopied(null), 1200); } catch {}
  };

  return (
    <SiteLayout>
      {/* Hero */}
      <section className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl border border-border/40 bg-gradient-to-br from-primary/10 via-background to-background px-6 py-14 text-center shadow-sm md:px-12 md:py-20">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-[-10%] h-48 w-3/5 -translate-x-1/2 rounded-full bg-primary/30 opacity-50 blur-3xl" />
          <div className="absolute bottom-[-15%] right-1/4 h-36 w-1/3 rounded-full bg-muted opacity-40 blur-3xl" />
          <div className="absolute inset-x-1/3 top-1/3 h-[1px] bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-40" />
        </div>
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/70 px-4 py-1 text-[11px] uppercase tracking-[0.35em] text-muted-foreground shadow-sm">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" />
          <span>Modern, responsive, open source</span>
        </div>
        <h1 className="mx-auto mt-6 max-w-4xl text-4xl font-semibold tracking-tight text-foreground md:text-6xl md:leading-tight">Smart Asset Management System</h1>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">Track assets, generate QR codes, manage permissions, and ship reports — fast.</p>
  {/* Hero CTAs removed per request */}
      </section>

  {/* Screenshot */}
      <section className="relative mx-auto mt-12 max-w-6xl px-2 md:px-0">
        <div className="absolute inset-x-12 -top-6 h-20 rounded-full bg-primary/15 blur-3xl" aria-hidden />
        <Card className="relative overflow-hidden border-border/60 shadow-lg">
          <CardContent className="p-0">
            <img src="/sams_banner.jpg" alt="SAMS banner" className="w-full rounded-md" />
          </CardContent>
        </Card>
      </section>

      {/* Features */}
      <section className="mx-auto mt-16 grid max-w-6xl gap-6 px-2 sm:grid-cols-2 lg:grid-cols-3 lg:px-0">
        {[ 
          { title: "Assets & Properties", desc: "Clean tables with filters, imports, and access control.", icon: Building2, tag: "Operations" },
          { title: "QR Codes", desc: "Generate, print, and export. Designed for labels and A4.", icon: QrCode, tag: "Logistics" },
          { title: "Roles & Permissions", desc: "Admins, managers, users — scoped views and actions.", icon: Shield, tag: "Security" },
          { title: "Reports", desc: "Export summaries and lists with instant filters.", icon: BarChart3, tag: "Analytics" },
          { title: "Responsive UI", desc: "Fast on desktop and mobile with a modern design.", icon: MonitorSmartphone, tag: "Product" },
          { title: "Open Source", desc: "Self-host or fork. Supabase-ready, local-first fallback.", icon: GitBranch, tag: "Engineering" },
        ].map(({ title, desc, icon: Icon, tag }, index) => (
          <Card
            key={title}
            className={`border-border/50 bg-card/70 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-xl ${index % 2 === 0 ? "backdrop-blur" : "bg-background/70"}`}
          >
            <CardContent className="space-y-5 pt-6">
              <div className="flex items-center justify-between">
                <div className="inline-flex items-center justify-center rounded-xl border border-border/60 bg-background/80 p-3 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <span className="rounded-full border border-border/60 bg-background/70 px-3 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {tag}
                </span>
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{desc}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      {/* Social proof */}
      <section className="mx-auto mt-16 max-w-5xl px-4 md:px-0">
        <Card className="border-border/40 bg-background/90 shadow-sm">
          <CardContent className="flex flex-col items-center gap-4 px-6 py-6 text-center md:flex-row md:items-center md:justify-between md:text-left">
            <div className="max-w-xl space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-primary/80">Trusted by teams</p>
              <p className="text-base leading-relaxed text-muted-foreground">
                Facilities, IT, and finance teams rely on SAMS to keep asset data accurate, auditable, and always within reach.
              </p>
            </div>
            <div className="flex items-center gap-3 text-muted-foreground/80">
              <div className="h-10 w-10 rounded-full border border-border/60 bg-primary/20" aria-hidden />
              <div className="h-10 w-10 rounded-full border border-border/60 bg-primary/10" aria-hidden />
              <div className="h-10 w-10 rounded-full border border-border/60 bg-primary/5" aria-hidden />
            </div>
          </CardContent>
        </Card>
      </section>

      {/* CTA */}
      <section className="relative mx-auto my-16 max-w-5xl overflow-hidden rounded-3xl border border-border/50 bg-gradient-to-r from-primary/15 via-background to-background p-8 text-center shadow-lg md:px-12 md:py-14">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute inset-y-0 left-1/2 w-2/3 -translate-x-1/2 bg-[radial-gradient(circle_at_center,_rgba(59,130,246,0.18),_transparent_65%)]" />
        </div>
        <h2 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">See it in action</h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
          Open the live demo to explore workflows or dive into the repository to tailor SAMS for your team.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
          <a href={DemoUrl} className="transition-transform duration-200 hover:-translate-y-0.5">
            <Button size="lg" className="gap-2">
              Open Demo
              <ArrowUpRight className="h-4 w-4" />
            </Button>
          </a>
          <a href={RepoUrl} target="_blank" rel="noreferrer" className="transition-transform duration-200 hover:-translate-y-0.5">
            <Button variant="outline" size="lg" className="gap-2">
              GitHub
              <ArrowUpRight className="h-4 w-4" />
            </Button>
          </a>
        </div>
        {/* Demo credentials moved here with improved design */}
        <div className="mt-6 text-left">
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Demo credentials</div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[ 
              { label: "demo@demo.com", icon: Mail, flag: "email" as const },
              { label: "demo@123", icon: KeyRound, flag: "password" as const },
            ].map(({ label, icon: Icon, flag }) => (
              <div key={flag} className="flex items-center justify-between rounded-xl border border-border/60 bg-background/80 px-3 py-2 shadow-sm">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-primary" />
                  <code className="font-mono text-sm">{label}</code>
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
                  <TooltipContent sideOffset={8}>
                    {copied === flag ? "Copied" : "Copy"}
                  </TooltipContent>
                </Tooltip>
              </div>
            ))}
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
