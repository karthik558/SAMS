import { Link } from "react-router-dom";
import { ArrowUpRight, Menu } from "lucide-react";
import { ModeToggle } from "@/components/common/ModeToggle";
import { Button } from "@/components/ui/button";

interface SiteLayoutProps { children: React.ReactNode }

export function SiteLayout({ children }: SiteLayoutProps) {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-3 focus:text-primary-foreground">Skip to content</a>
      <header className="sticky top-0 z-50 border-b border-border/80 bg-background/95 backdrop-blur-xl">
        <div className="site-container flex h-20 items-center justify-between gap-4">
          <Link to="/site" aria-label="SAMS home" className="flex shrink-0 items-center gap-3">
            <span className="h-9 w-28 bg-primary" style={{ mask: 'url("/sams_logo.png") left center / contain no-repeat', WebkitMask: 'url("/sams_logo.png") left center / contain no-repeat' }} />
          </Link>
          <nav aria-label="Main navigation" className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
            <a href="#features" className="hover:text-primary">Why SAMS</a>
            <a href="#modules" className="hover:text-primary">Platform</a>
            <a href="#support" className="hover:text-primary">Support</a>
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            <ModeToggle />
            <Button asChild size="sm"><Link to="/login">Sign in <ArrowUpRight /></Link></Button>
            <details className="relative md:hidden">
              <summary aria-label="Open navigation" className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-lg border [&::-webkit-details-marker]:hidden"><Menu className="h-5 w-5" /></summary>
              <nav aria-label="Mobile navigation" className="absolute right-0 top-12 grid w-48 gap-1 rounded-xl border bg-popover p-2 text-sm shadow-medium">
                <a className="rounded-lg p-3 hover:bg-accent" href="#features">Why SAMS</a>
                <a className="rounded-lg p-3 hover:bg-accent" href="#modules">Platform</a>
                <a className="rounded-lg p-3 hover:bg-accent" href="#demo">Try the demo</a>
                <a className="rounded-lg p-3 hover:bg-accent" href="#support">Support</a>
              </nav>
            </details>
          </div>
        </div>
      </header>
      <main id="main-content" tabIndex={-1}>{children}</main>
      <footer className="border-t py-10">
        <div className="site-container flex flex-col justify-between gap-8 sm:flex-row">
          <Link to="/site" aria-label="SAMS home" className="flex shrink-0 items-center">
            <span className="h-9 w-28 bg-primary" style={{ mask: 'url("/sams_logo.png") left center / contain no-repeat', WebkitMask: 'url("/sams_logo.png") left center / contain no-repeat' }} />
          </Link>
          <nav aria-label="Footer navigation" className="flex flex-wrap gap-x-6 gap-y-3 text-sm text-muted-foreground">
            <a href="#demo" className="hover:text-primary">Try the demo</a>
            <a href="mailto:karthik@samsproject.in" className="hover:text-primary">Contact</a>
            <a href="https://github.com/karthik558/SAMS" className="hover:text-primary">GitHub ↗</a>
          </nav>
        </div>
        <div className="site-container mt-8 flex flex-wrap justify-between gap-3 border-t pt-6 text-xs text-muted-foreground"><p>© {new Date().getFullYear()} SAMS Project.</p><p>Open source. Built for everyday operations.</p></div>
      </footer>
    </div>
  );
}
