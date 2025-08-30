import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, Boxes, BadgeCheck, Users as UsersIcon, Printer, Mail, KeyRound, Copy, Check, ShieldCheck, WifiOff, MonitorSmartphone, GitBranch, HelpCircle, Wrench, ScrollText, BookText } from "lucide-react";
import { useState } from "react";
import { SiteLayout } from "@/components/site/SiteLayout";

const DemoUrl = "https://sams-ams.vercel.app/demo/login";
const RepoUrl = "https://github.com/karthik558/SAMS";

export default function Website() {
  const [copied, setCopied] = useState<null | "email" | "password">(null);
  const handleCopy = async (value: string, which: "email" | "password") => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(which);
      setTimeout(() => setCopied(null), 1500);
    } catch {}
  };
  return (
    <SiteLayout>
      {/* Overview/Hero */}
      <header id="overview" className="py-8 md:py-12">
        <div className="container flex flex-col items-center text-center gap-6">
          <img src="/favicon.png" alt="SAMS" className="h-14 w-14" />
          <div>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight">Smart Asset Management System</h1>
            <p className="mt-4 text-muted-foreground max-w-2xl">Centralized asset lifecycle, tracking, and auditing for modern operations.</p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <a href={DemoUrl} target="_blank" rel="noopener" className="inline-block">
              <Button className="gap-2">Open Live Demo</Button>
            </a>
            <a href={RepoUrl} target="_blank" rel="noopener" className="inline-block">
              <Button variant="outline">View on GitHub</Button>
            </a>
          </div>
          <div className="text-xs text-muted-foreground">
            <div className="inline-flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-muted/40 border border-border rounded-md p-2">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" />
                <span className="hidden sm:inline">Email:</span>
                <code className="font-mono text-foreground bg-background/60 rounded px-1.5 py-0.5">demo@demo.com</code>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  aria-label="Copy email"
                  onClick={() => handleCopy("demo@demo.com", "email")}
                >
                  {copied === "email" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-primary" />
                <span className="hidden sm:inline">Password:</span>
                <code className="font-mono text-foreground bg-background/60 rounded px-1.5 py-0.5">demo@123</code>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  aria-label="Copy password"
                  onClick={() => handleCopy("demo@123", "password")}
                >
                  {copied === "password" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Sections from README */}
      <section className="container pb-10 space-y-8">
        <div className="grid md:grid-cols-2 gap-6">
          <Card id="capabilities" className="bg-card/60 backdrop-blur rounded-xl border border-border/60 shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-200 hover:-translate-y-0.5 scroll-mt-20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center rounded-md bg-primary/10 text-primary p-1.5">
                  <Sparkles className="h-4 w-4" />
                </span>
                <span>Key Capabilities</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <ul className="mt-2 space-y-2 text-sm text-muted-foreground list-disc pl-5">
                <li>Asset registry and lifecycle with unit-level precision</li>
                <li>Properties directory with filters and access rules</li>
                <li>QR generation, downloads (PNG, ZIP, PDF flows)</li>
                <li>Views, filters, date ranges, and column chooser</li>
                <li>Role-based controls, approvals, and activity logs</li>
                <li>Dashboard metrics, charts, and summaries</li>
              </ul>
            </CardContent>
          </Card>
          <Card id="modules" className="scroll-mt-20 bg-card/60 backdrop-blur rounded-xl border border-border/60 shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-200 hover:-translate-y-0.5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center rounded-md bg-primary/10 text-primary p-1.5">
                  <Boxes className="h-4 w-4" />
                </span>
                <span>Modules</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <ul className="mt-2 space-y-2 text-sm text-muted-foreground list-disc pl-5">
                <li>Dashboard, Assets, Properties, QR Codes</li>
                <li>Reports, Approvals, Tickets</li>
                <li>Settings and Users</li>
              </ul>
            </CardContent>
          </Card>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <Card id="benefits" className="scroll-mt-20 bg-card/60 backdrop-blur rounded-xl border border-border/60 shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-200 hover:-translate-y-0.5">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <span className="inline-flex items-center justify-center rounded-md bg-primary/10 text-primary p-1.5">
                  <BadgeCheck className="h-4 w-4" />
                </span>
                <span>Benefits</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <ul className="mt-2 space-y-2 text-sm text-muted-foreground list-disc pl-5">
                <li>Faster onboarding and updates</li>
                <li>Audit readiness with histories</li>
                <li>Clear governance via role-based actions</li>
              </ul>
            </CardContent>
          </Card>

          <Card id="audience" className="scroll-mt-20 bg-card/60 backdrop-blur rounded-xl border border-border/60 shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-200 hover:-translate-y-0.5">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <span className="inline-flex items-center justify-center rounded-md bg-primary/10 text-primary p-1.5">
                  <UsersIcon className="h-4 w-4" />
                </span>
                <span>Who It’s For</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <ul className="mt-2 space-y-2 text-sm text-muted-foreground list-disc pl-5">
                <li>Administrators</li>
                <li>Managers</li>
                <li>Operators</li>
                <li>Auditors (read-only)</li>
              </ul>
            </CardContent>
          </Card>

          <Card id="printing-offline" className="scroll-mt-20 bg-card/60 backdrop-blur rounded-xl border border-border/60 shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-200 hover:-translate-y-0.5">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <span className="inline-flex items-center justify-center rounded-md bg-primary/10 text-primary p-1.5">
                  <Printer className="h-4 w-4" />
                </span>
                <span>Printing & Offline</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <ul className="mt-2 space-y-2 text-sm text-muted-foreground list-disc pl-5">
                <li>A4 print flows and label presets</li>
                <li>Installable app; offline asset caching</li>
                <li>Auto-update mechanism</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Security and Access */}
      <section className="container pb-10 space-y-4">
        <Card id="security-access" className="bg-card/60 backdrop-blur rounded-xl border border-border/60 shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-200 hover:-translate-y-0.5 scroll-mt-20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center rounded-md bg-primary/10 text-primary p-1.5">
                <ShieldCheck className="h-4 w-4" />
              </span>
              <span>Security and Access</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ul className="mt-2 space-y-2 text-sm text-muted-foreground list-disc pl-5">
              <li>Role-aware navigation and gated actions</li>
              <li>Sensitive elements hidden for non-privileged users</li>
              <li>Visibility aligned with property access rules</li>
            </ul>
          </CardContent>
        </Card>
      </section>

      {/* Printing and Labels */}
      <section className="container pb-10 space-y-4">
        <Card id="printing-labels" className="bg-card/60 backdrop-blur rounded-xl border border-border/60 shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-200 hover:-translate-y-0.5 scroll-mt-20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center rounded-md bg-primary/10 text-primary p-1.5">
                <Printer className="h-4 w-4" />
              </span>
              <span>Printing and Labels</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ul className="mt-2 space-y-2 text-sm text-muted-foreground list-disc pl-5">
              <li>One-click print dialog for A4 sheets</li>
              <li>Label flows with exact page sizing and presets</li>
              <li>Custom width/height options</li>
            </ul>
          </CardContent>
        </Card>
      </section>

      {/* Reliability and Offline */}
      <section className="container pb-10 space-y-4">
        <Card id="reliability-offline" className="bg-card/60 backdrop-blur rounded-xl border border-border/60 shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-200 hover:-translate-y-0.5 scroll-mt-20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center rounded-md bg-primary/10 text-primary p-1.5">
                <WifiOff className="h-4 w-4" />
              </span>
              <span>Reliability and Offline</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ul className="mt-2 space-y-2 text-sm text-muted-foreground list-disc pl-5">
              <li>Installable on desktop and mobile</li>
              <li>Asset list caching by property for offline reference</li>
              <li>Auto-update mechanism</li>
            </ul>
          </CardContent>
        </Card>
      </section>

  {/* Live Demo and Request a Demo sections removed per request */}

      {/* Browser and Device Support */}
      <section className="container pb-10 space-y-4">
        <Card id="support" className="bg-card/60 backdrop-blur rounded-xl border border-border/60 shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-200 hover:-translate-y-0.5 scroll-mt-20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center rounded-md bg-primary/10 text-primary p-1.5">
                <MonitorSmartphone className="h-4 w-4" />
              </span>
              <span>Browser and Device Support</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ul className="mt-2 space-y-2 text-sm text-muted-foreground list-disc pl-5">
              <li>Current desktop browsers and mobile webviews</li>
              <li>Responsive layouts for phones, tablets, and desktops</li>
            </ul>
          </CardContent>
        </Card>
      </section>

      {/* Versioning and Releases */}
      <section className="container pb-10 space-y-4">
        <Card id="versioning" className="bg-card/60 backdrop-blur rounded-xl border border-border/60 shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-200 hover:-translate-y-0.5 scroll-mt-20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center rounded-md bg-primary/10 text-primary p-1.5">
                <GitBranch className="h-4 w-4" />
              </span>
              <span>Versioning and Releases</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ul className="mt-2 space-y-2 text-sm text-muted-foreground list-disc pl-5">
              <li>Semantic versioning</li>
              <li>Release notes summarize notable changes</li>
            </ul>
          </CardContent>
        </Card>
      </section>

      {/* FAQ */}
      <section className="container pb-10 space-y-4">
        <Card id="faq" className="bg-card/60 backdrop-blur rounded-xl border border-border/60 shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-200 hover:-translate-y-0.5 scroll-mt-20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center rounded-md bg-primary/10 text-primary p-1.5">
                <HelpCircle className="h-4 w-4" />
              </span>
              <span>FAQ</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ul className="mt-2 space-y-2 text-sm text-muted-foreground list-disc pl-5">
              <li>Import assets via bulk template</li>
              <li>Offline mode caches lists per property</li>
              <li>Roles gate navigation and actions</li>
              <li>Printing via QR Codes page with presets</li>
              <li>Reports support export; QR history retains print status</li>
            </ul>
          </CardContent>
        </Card>
      </section>

      {/* Troubleshooting */}
      <section className="container pb-10 space-y-4">
        <Card id="troubleshooting" className="bg-card/60 backdrop-blur rounded-xl border border-border/60 shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-200 hover:-translate-y-0.5 scroll-mt-20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center rounded-md bg-primary/10 text-primary p-1.5">
                <Wrench className="h-4 w-4" />
              </span>
              <span>Troubleshooting</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ul className="mt-2 space-y-2 text-sm text-muted-foreground list-disc pl-5">
              <li>Dashboard cards depend on role permissions</li>
              <li>QR image download issues: try print-to-PDF or clear cache</li>
              <li>No assets visible: check filters, access, and columns</li>
            </ul>
          </CardContent>
        </Card>
      </section>

      {/* Legal */}
      <section id="license" className="container pb-4 space-y-2 scroll-mt-20">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ScrollText className="h-4 w-4 text-primary" />
          <span>License: This project is open source under a permissive license.</span>
        </div>
      </section>

      <section id="code-of-conduct" className="container pb-12 space-y-2 scroll-mt-20">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <BookText className="h-4 w-4 text-primary" />
          <span>Code of Conduct: Contributors uphold a professional, respectful environment.</span>
        </div>
      </section>
    </SiteLayout>
  );
}
