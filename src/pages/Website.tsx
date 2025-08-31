import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Check, Copy, ShieldCheck, Sparkles, Mail, KeyRound } from "lucide-react";
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
      <section className="mx-auto max-w-4xl text-center">
        <div className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" />
          <span>Modern, responsive, open source</span>
        </div>
        <h1 className="mt-6 text-4xl md:text-6xl font-bold tracking-tight">Smart Asset Management System</h1>
        <p className="mt-4 text-muted-foreground">Track assets, generate QR codes, manage permissions, and ship reports — fast.</p>
  {/* Hero CTAs removed per request */}
      </section>

  {/* Screenshot */}
      <section className="mx-auto mt-10 max-w-5xl">
        <Card className="overflow-hidden border-border/60">
          <CardContent className="p-0">
    <img src="/sams_banner.jpg" alt="SAMS banner" className="w-full rounded-md" />
          </CardContent>
        </Card>
      </section>

      {/* Features */}
      <section className="mx-auto mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 max-w-5xl">
        {[ 
          { title: "Assets & Properties", desc: "Clean tables with filters, imports, and access control." },
          { title: "QR Codes", desc: "Generate, print, and export. Designed for labels and A4." },
          { title: "Roles & Permissions", desc: "Admins, managers, users — scoped views and actions." },
          { title: "Reports", desc: "Export summaries and lists with instant filters." },
          { title: "Responsive UI", desc: "Fast on desktop and mobile with a modern design." },
          { title: "Open Source", desc: "Self-host or fork. Supabase-ready, local-first fallback." },
        ].map((f) => (
          <Card key={f.title} className="bg-card/60">
            <CardContent className="pt-5">
              <div className="flex items-start gap-3">
                <div className="mt-1 rounded-md bg-primary/10 p-1"><Sparkles className="h-4 w-4 text-primary" /></div>
                <div>
                  <h3 className="font-medium">{f.title}</h3>
                  <p className="text-sm text-muted-foreground">{f.desc}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      {/* CTA */}
      <section className="mx-auto my-14 max-w-3xl rounded-xl border bg-card/50 p-6 text-center">
        <h2 className="text-xl font-semibold tracking-tight">See it in action</h2>
        <p className="mt-2 text-sm text-muted-foreground">Open the live demo or explore the code base.</p>
        <div className="mt-4 flex items-center justify-center gap-3">
          <a href={DemoUrl}><Button>Open Demo</Button></a>
          <a href={RepoUrl} target="_blank" rel="noreferrer"><Button variant="outline">GitHub</Button></a>
        </div>
        {/* Demo credentials moved here with improved design */}
        <div className="mt-5 text-left">
          <div className="mb-2 text-xs font-medium text-muted-foreground">Demo credentials</div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="flex items-center justify-between rounded-md border bg-background px-3 py-2">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" />
                <code className="font-mono text-sm">demo@demo.com</code>
              </div>
              <button
                type="button"
                className="p-1 text-muted-foreground hover:text-foreground"
                aria-label="Copy email"
                onClick={() => handleCopy("demo@demo.com", "email")}
              >
                {copied === "email" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            <div className="flex items-center justify-between rounded-md border bg-background px-3 py-2">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-primary" />
                <code className="font-mono text-sm">demo@123</code>
              </div>
              <button
                type="button"
                className="p-1 text-muted-foreground hover:text-foreground"
                aria-label="Copy password"
                onClick={() => handleCopy("demo@123", "password")}
              >
                {copied === "password" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
