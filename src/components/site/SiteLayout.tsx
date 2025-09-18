interface SiteLayoutProps { children: React.ReactNode }

export function SiteLayout({ children }: SiteLayoutProps) {
  return (
    <div className="min-h-dvh bg-gradient-to-b from-background to-muted/30 text-foreground">
      {/* Top header */}
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/favicon.png" alt="SAMS" className="h-5 w-5" />
            <span className="font-semibold tracking-tight">SAMS</span>
          </div>
          {/* simple header, external links removed per request */}
        </div>
      </header>

      {/* Main content */}
      <main className="container px-4 py-10 md:py-16">
        {children}
      </main>

      <footer className="border-t bg-background/80 py-10 text-sm text-muted-foreground">
        <div className="container flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-2 text-foreground">
            <div className="flex items-center gap-2">
              <img src="/favicon.png" alt="SAMS" className="h-5 w-5" />
              <span className="font-semibold tracking-tight">SAMS</span>
            </div>
            <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">A modern asset management platform built for teams who value clarity, auditability, and speed.</p>
          </div>
          <p className="text-[11px]">© {new Date().getFullYear()} SAMS. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
