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

      <div className="flex flex-col gap-24 pb-24">
        {/* Hero Section */}
        <section id="overview" className="pt-20 md:pt-32 pb-16">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center text-center space-y-8">
              <div className="space-y-4 max-w-3xl">
                <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl lg:text-7xl">
                  Enterprise Asset Management <br className="hidden sm:inline" />
                  <span className="text-primary">Simplified.</span>
                </h1>
                <p className="mx-auto max-w-[700px] text-muted-foreground md:text-xl leading-relaxed">
                  SAMS provides a unified platform to track assets, manage audits, and ensure compliance across your entire organization. 
                  Move beyond spreadsheets to a system designed for accuracy and accountability.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-4 min-w-[200px]">
                <Link 
                  to="/login" 
                  className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
                >
                  Access Platform
                </Link>
                <a 
                  href="#features" 
                  className="inline-flex h-11 items-center justify-center rounded-md border border-input bg-background px-8 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
                >
                  Learn More
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Key Features - Typography Focused */}
        <section id="features" className="bg-muted/30 py-24">
          <div className="container px-4 md:px-6">
            <div className="grid gap-12 lg:grid-cols-3">
              <div className="space-y-4">
                <h3 className="text-xl font-bold">Asset Lifecycle Tracking</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Complete visibility from procurement to disposal. Track location, custody, and condition changes with a comprehensive audit trail for every item in your inventory.
                </p>
              </div>
              <div className="space-y-4">
                <h3 className="text-xl font-bold">Digital Audits & Verification</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Streamline physical verification with mobile-friendly tools. Assign audits to departments, capture evidence via camera, and reconcile discrepancies in real-time.
                </p>
              </div>
              <div className="space-y-4">
                <h3 className="text-xl font-bold">Compliance & Reporting</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Generate accurate depreciation schedules and compliance reports. Ensure your asset register matches financial records with automated depreciation calculations.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Modules Section */}
        <section id="modules" className="container px-4 md:px-6">
          <div className="mb-12">
            <h2 className="text-3xl font-bold tracking-tight mb-4">System Modules</h2>
            <p className="text-muted-foreground max-w-2xl">
              A modular architecture designed to handle specific operational needs while maintaining a unified data core.
            </p>
          </div>
          
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            <div className="p-6 border rounded-lg bg-card text-card-foreground shadow-sm">
              <h4 className="font-semibold mb-2">Asset Registry</h4>
              <p className="text-sm text-muted-foreground">
                Centralized database for IT and non-IT assets with QR code generation and bulk management capabilities.
              </p>
            </div>
            
            <div className="p-6 border rounded-lg bg-card text-card-foreground shadow-sm">
              <h4 className="font-semibold mb-2">Property Management</h4>
              <p className="text-sm text-muted-foreground">
                Manage physical locations, branches, and office spaces to organize assets geographically.
              </p>
            </div>

            <div className="p-6 border rounded-lg bg-card text-card-foreground shadow-sm">
              <h4 className="font-semibold mb-2">Audit Center</h4>
              <p className="text-sm text-muted-foreground">
                Plan and execute physical verification drives. Track progress and resolve missing assets.
              </p>
            </div>

            <div className="p-6 border rounded-lg bg-card text-card-foreground shadow-sm">
              <h4 className="font-semibold mb-2">Help Desk</h4>
              <p className="text-sm text-muted-foreground">
                Internal ticketing system for asset repairs, requests, and maintenance scheduling.
              </p>
            </div>

            <div className="p-6 border rounded-lg bg-card text-card-foreground shadow-sm">
              <h4 className="font-semibold mb-2">Analytics Dashboard</h4>
              <p className="text-sm text-muted-foreground">
                Real-time insights into asset value, category distribution, and audit compliance status.
              </p>
            </div>
          </div>
        </section>

        {/* Quality & Support Section (Restored Data) */}
        <section id="support" className="container px-4 md:px-6">
          <div className="grid gap-12 md:grid-cols-2">
            <div>
              <h3 className="text-xl font-bold mb-4">Built for Reliability</h3>
              <ul className="space-y-3 text-muted-foreground">
                <li className="flex gap-2">
                  <span className="font-semibold text-foreground">Testing:</span> Component-level tests roll out alongside critical modules.
                </li>
                <li className="flex gap-2">
                  <span className="font-semibold text-foreground">Accessibility:</span> Keyboard-friendly experiences with ARIA defaults baked in.
                </li>
                <li className="flex gap-2">
                  <span className="font-semibold text-foreground">Observability:</span> User-facing events surface in toasts and audit trails.
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-xl font-bold mb-4">Support & Governance</h3>
              <div className="space-y-3 text-muted-foreground">
                <p>
                  Email <a href="mailto:karthik@samsproject.in" className="text-primary hover:underline">karthik@samsproject.in</a> for guided walkthroughs or implementation planning.
                </p>
                <p>
                  Report bugs or request enhancements via our <a href="https://github.com/karthik558/SAMS/issues" className="text-primary hover:underline">GitHub issues</a>.
                </p>
                <p>The project ships under the MIT License with a community Code of Conduct.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Demo / CTA Section */}
        <section id="demo" className="py-24 bg-primary text-primary-foreground">
          <div className="container px-4 md:px-6 text-center">
            <h2 className="text-3xl font-bold tracking-tight mb-6">Ready to modernize your operations?</h2>
            
            <div className="max-w-sm mx-auto bg-primary-foreground/10 rounded-lg p-6 mb-8 backdrop-blur-sm border border-primary-foreground/20 text-left">
              <h3 className="text-lg font-semibold mb-4 text-center">Demo Credentials</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center bg-background/10 p-3 rounded">
                  <span className="text-sm opacity-90">Email</span>
                  <code className="font-mono font-bold">demo@demo.com</code>
                </div>
                <div className="flex justify-between items-center bg-background/10 p-3 rounded">
                  <span className="text-sm opacity-90">Password</span>
                  <code className="font-mono font-bold">demo@123</code>
                </div>
              </div>
            </div>

            <p className="text-primary-foreground/80 max-w-2xl mx-auto mb-8 text-lg">
              Join organizations that trust SAMS for their asset management and audit requirements.
            </p>
            <Link 
              to="/demo/login" 
              className="inline-flex h-11 items-center justify-center rounded-md bg-background px-8 text-sm font-medium text-primary shadow transition-colors hover:bg-background/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
            >
              Access Demo Environment
            </Link>
          </div>
        </section>
      </div>
    </SiteLayout>
  );
}
