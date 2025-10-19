interface SiteLayoutProps { children: React.ReactNode }

export function SiteLayout({ children }: SiteLayoutProps) {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground">
        Skip to content
      </a>
      {/* Top header */}
      <header className="border-b bg-background/95">
        <div className="container flex flex-col items-center gap-2 py-5 text-center md:py-6">
          <a href="/" className="inline-flex flex-col items-center gap-3">
            <img
              src="/sams_logo.png"
              alt="SAMS — Smart Asset Management System"
              className="h-10 w-auto transition-transform duration-200 hover:scale-[1.02] md:h-14"
            />
          </a>
        </div>
      </header>

      {/* Main content */}
      <main id="main-content" className="container px-4 py-12 md:py-16">
        {children}
      </main>

      <footer className="border-t bg-background/95 py-12 text-sm text-muted-foreground">
        <div className="container flex flex-col items-center gap-4 text-center">
          <img src="/sams_logo.png" alt="SAMS" className="h-10 w-auto" />
          <p className="max-w-xl text-xs leading-relaxed text-muted-foreground">
            A modern asset operations platform that keeps registries accurate, QR labels ready, and audit evidence within reach.
          </p>
          <div className="flex flex-wrap justify-center gap-4 text-xs text-muted-foreground">
            <a href="#overview" className="transition hover:text-foreground">Overview</a>
            <a href="#highlights" className="transition hover:text-foreground">Highlights</a>
            <a href="#modules" className="transition hover:text-foreground">Modules</a>
            <a href="#demo" className="transition hover:text-foreground">Demo</a>
            <a href="#support" className="transition hover:text-foreground">Support</a>
          </div>
          <p className="text-[11px] text-muted-foreground/80">© {new Date().getFullYear()} SAMS. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
