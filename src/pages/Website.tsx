import { ArrowRight, ArrowUpRight, Package, QrCode, ClipboardCheck, Building2, Ticket, BarChart3, Check, Layers, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { SiteLayout } from "@/components/site/SiteLayout";

const BaseUrl = "https://samsproject.in";
const HeroDescription =
  "SAMS centralizes the entire asset lifecycle with QR-enabled tracking, collaborative workflows, and audit-ready reporting in a responsive, open-source platform.";

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

      <section id="overview" className="site-container py-14 sm:py-20 lg:py-24">
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr,1fr] lg:gap-16">
          <div>
            <p className="eyebrow mb-6 flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-primary" /> Everything accounted for</p>
            <h1 className="max-w-2xl text-5xl font-semibold leading-[1.08] tracking-[-0.045em] sm:text-6xl lg:text-7xl">Your assets.<br />In order.<br /><span className="font-serif font-normal italic text-primary">Under control.</span></h1>
            <p className="site-copy mt-7 max-w-md">Know what you own, where it belongs, and what needs attention. Bring your assets, teams, and daily operations into one clear workspace.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg"><Link to="/demo/login">Explore the live demo <ArrowRight /></Link></Button>
              <Button asChild variant="outline" size="lg"><Link to="/login">Open your workspace</Link></Button>
            </div>
            <p className="mt-5 text-xs text-muted-foreground">Open source · QR-enabled tracking · Built for distributed teams</p>
          </div>
          <div className="relative rounded-3xl border border-primary/15 bg-primary/[0.05] p-5 sm:p-8">
            <div className="mb-6 flex items-center justify-between text-xs"><span className="font-semibold uppercase tracking-[0.15em] text-primary">The asset lifecycle</span><span className="text-muted-foreground">Workflow preview</span></div>
            <div className="rounded-2xl border bg-card shadow-medium">
              <div className="flex items-center gap-3 border-b px-5 py-4"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Package className="h-5 w-5" /></span><div><p className="text-sm font-semibold">One asset. A complete picture.</p><p className="mt-0.5 text-xs text-muted-foreground">From registration to verification</p></div></div>
              <div className="px-5 py-2">
                {[
                  { icon: Layers, title: "Register & organize", text: "Record details, ownership, and location." },
                  { icon: QrCode, title: "Label & track", text: "Connect physical assets to digital records." },
                  { icon: Ticket, title: "Maintain & resolve", text: "Keep requests and repairs moving." },
                  { icon: ClipboardCheck, title: "Verify & report", text: "Reconcile your inventory with confidence." },
                ].map(({ icon: Icon, title, text }, i) => (
                  <div key={title} className="relative flex gap-4 py-4">
                    {i < 3 && <span aria-hidden="true" className="absolute bottom-[-16px] left-[19px] top-14 w-px bg-border" />}
                    <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-background text-primary"><Icon className="h-4 w-4" /></span>
                    <div><p className="text-sm font-medium">{title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{text}</p></div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between gap-3 rounded-b-2xl border-t bg-muted/40 px-5 py-4 text-xs"><span className="flex items-center gap-2 text-muted-foreground"><ScanLine className="h-4 w-4 text-primary" /> A scan away from the details</span><QrCode aria-hidden="true" className="h-7 w-7 text-foreground/65" /></div>
            </div>
            <p className="mt-5 text-center font-serif text-lg italic text-muted-foreground">Less searching. More knowing.</p>
          </div>
        </div>
      </section>

      <section id="features" className="border-y bg-card py-16 sm:py-20">
        <div className="site-container">
          <div className="mb-10 grid gap-5 md:grid-cols-2 md:items-end"><div><p className="eyebrow mb-3">Clarity at every step</p><h2 className="site-heading">Good operations start<br />with a clear picture.</h2></div><p className="site-copy max-w-md md:justify-self-end">Give facilities, finance, and audit teams a shared source of truth, from the office to the field.</p></div>
          <div className="grid gap-8 md:grid-cols-3 md:gap-10">
            {[
              { n: "01", title: "Find it. Know it.", text: "Keep asset details, properties, and ownership together. Spend less time piecing information across spreadsheets." },
              { n: "02", title: "Take work into the field.", text: "Generate QR labels and scan assets on location. Bring the right record to your team when they need it." },
              { n: "03", title: "Close the loop.", text: "Connect maintenance tickets, approvals, and audits. Keep every request visible from the first report to resolution." },
            ].map(({ n, title, text }) => <div key={n} className="border-t-2 border-primary/30 pt-5"><p className="mb-5 font-mono text-xs text-primary">{n} /</p><h3 className="text-xl font-semibold tracking-tight">{title}</h3><p className="site-copy mt-3 text-sm">{text}</p></div>)}
          </div>
        </div>
      </section>

      <section id="modules" className="site-container py-16 sm:py-24">
        <p className="eyebrow mb-3">One connected platform</p>
        <div className="mb-10 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><h2 className="site-heading">A place for every<br />part of the process.</h2><a href="#demo" className="inline-flex items-center gap-2 text-sm font-medium text-primary">See it in action <ArrowUpRight className="h-4 w-4" /></a></div>
        <div className="grid gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {[
            { icon: Package, title: "Asset registry", text: "Organize asset records, manage bulk imports, and keep lifecycle details in view." },
            { icon: Building2, title: "Properties & locations", text: "Structure your inventory around the places and departments that use it." },
            { icon: QrCode, title: "QR labels & scanning", text: "Create, download, and print labels that connect directly to asset records." },
            { icon: ClipboardCheck, title: "Audits & approvals", text: "Coordinate verification and review asset changes with role-based workflows." },
            { icon: Ticket, title: "Maintenance & tickets", text: "Capture issues, assign work, and follow requests through to completion." },
            { icon: BarChart3, title: "Reports & insights", text: "Understand asset distribution and export the information your team needs." },
          ].map(({ icon: Icon, title, text }) => <div key={title} className="bg-card p-7 sm:p-8"><Icon className="mb-6 h-6 w-6 text-primary" strokeWidth={1.5} /><h3 className="text-base font-semibold">{title}</h3><p className="mt-3 text-sm leading-6 text-muted-foreground">{text}</p></div>)}
        </div>
      </section>

      <section id="demo" className="site-container pb-16 sm:pb-24">
        <div className="grid gap-10 rounded-3xl border border-primary/20 bg-primary/[0.06] p-7 sm:p-12 lg:grid-cols-[1.2fr,1fr] lg:gap-20">
          <div><p className="eyebrow mb-4">Take a look around</p><h2 className="site-heading">Meet your next<br />everyday workspace.</h2><p className="site-copy mt-5 max-w-md">Explore SAMS with sample data in a separate demo environment. Your first look is just a sign-in away.</p><div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground"><Check className="h-4 w-4 text-primary" /> Prefilled credentials. No setup needed.</div></div>
          <div className="self-center rounded-2xl border bg-card p-6 shadow-soft"><h3 className="font-semibold">Your demo access</h3><dl className="my-5 divide-y rounded-lg border bg-background px-4 text-sm"><div className="flex flex-wrap justify-between gap-2 py-3"><dt className="text-muted-foreground">Email</dt><dd className="font-mono">demo@demo.com</dd></div><div className="flex flex-wrap justify-between gap-2 py-3"><dt className="text-muted-foreground">Password</dt><dd className="font-mono">demo@123</dd></div></dl><Button asChild className="w-full" size="lg"><Link to="/demo/login">Enter the demo <ArrowRight /></Link></Button></div>
        </div>
      </section>

      <section id="support" className="border-t bg-card py-12 sm:py-16"><div className="site-container grid gap-8 md:grid-cols-2"><div><p className="eyebrow mb-3">Built in the open</p><h2 className="text-2xl font-semibold tracking-tight">Your operations. Your way.</h2><p className="site-copy mt-4 max-w-lg text-sm">SAMS is an open-source project. Explore the code, share feedback, or help shape what comes next on <a href="https://github.com/karthik558/SAMS" className="text-primary underline underline-offset-4">GitHub</a>.</p></div><div className="md:border-l md:pl-10"><h3 className="font-semibold">A little help getting started?</h3><p className="site-copy mt-3 text-sm">Get in touch for a walkthrough or implementation planning.</p><a href="mailto:karthik@samsproject.in" className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-primary">karthik@samsproject.in <ArrowUpRight className="h-4 w-4" /></a></div></div></section>
    </SiteLayout>
  );
}
