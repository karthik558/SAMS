import { useEffect, useRef } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { SiteSidebar } from "./SiteSidebar";

interface SiteLayoutProps {
  children: React.ReactNode;
}

export function SiteLayout({ children }: SiteLayoutProps) {
  const isMobile = useIsMobile();
  const mainRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    // Enable smooth scroll behavior for in-page anchors
    if (typeof window !== "undefined") {
      document.documentElement.style.scrollBehavior = "smooth";
    }
    return () => {
      if (typeof window !== "undefined") {
        document.documentElement.style.scrollBehavior = "auto";
      }
    };
  }, []);

  useEffect(() => {
    // If there is an initial hash in URL, scroll to it once mounted
    if (typeof window !== "undefined" && window.location.hash) {
      const id = window.location.hash.replace(/^#/, "");
      const target = document.getElementById(id);
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  }, []);

  const onNavigate = (href: string) => {
    const id = href.replace(/^#/, "");
    const target = document.getElementById(id);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      // Nudge to account for small sticky offset if any
      const container = mainRef.current;
      if (container) {
        requestAnimationFrame(() => {
          container.scrollTo({ top: container.scrollTop - 12, behavior: "instant" as any });
        });
      }
      // Update hash for back/forward and deep-link
      if (window.location.hash !== `#${id}`) {
        history.replaceState(null, "", `#${id}`);
      }
    }
  };
  return (
    <div className="flex min-h-dvh bg-background flex-col md:flex-row">
      {/* Sidebar on desktop, top bar on mobile */}
      <div className="hidden md:block">
        <SiteSidebar onNavigate={onNavigate} />
      </div>
      <div className="md:hidden w-full sticky top-0 z-30">
        <SiteSidebar isMobile onNavigate={onNavigate} />
      </div>

      <main ref={(el) => (mainRef.current = el)} className="flex-1 overflow-auto p-4 md:p-6 bg-muted/30">
        {children}
      </main>
    </div>
  );
}
