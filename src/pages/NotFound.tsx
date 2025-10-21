import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { isDemoMode } from "@/lib/demo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Home, ArrowLeft, MapPin, Compass, Mail } from "lucide-react";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    try {
      console.error("404:", location.pathname);
    } catch {}
  }, [location.pathname]);

  return (
    <div className="relative overflow-hidden py-16">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary))/0.12,transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,hsl(var(--muted))/0.25,transparent_55%)]" />
      <div className="relative mx-auto flex w-full max-w-4xl flex-col gap-6 rounded-2xl border border-border/60 bg-card/95 p-6 shadow-xl sm:gap-8 sm:p-10">
        <span className="inline-flex w-fit items-center gap-2 rounded-lg border border-border/60 bg-background/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          <Compass className="h-3.5 w-3.5" />
          Off The Map
        </span>
        <div className="grid gap-6 lg:grid-cols-[1.4fr,1fr]">
          <div className="space-y-5">
            <div className="space-y-2">
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-muted-foreground">404 Error</p>
              <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                We can’t find that page
              </h1>
            </div>
            <p className="text-sm leading-6 text-muted-foreground sm:text-base">
              The link could be outdated, or you might have typed the address incorrectly. Let’s get you back to
              work with one of the options below.
            </p>
            <div className="flex flex-col gap-2 text-xs text-muted-foreground">
              <div className="inline-flex items-center gap-2 rounded-lg border border-border/60 bg-background/80 px-3 py-2">
                <MapPin className="h-4 w-4 text-primary" />
                <span className="font-medium text-foreground">Requested URL:</span>
                <code className="truncate font-mono text-muted-foreground">{location.pathname}</code>
              </div>
              <p>Still lost? Please reach out to support and include the URL above.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => navigate(isDemoMode() ? "/demo" : "/")} className="gap-2 rounded-xl px-5">
                <Home className="h-4 w-4" />
                Back to Dashboard
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate(-1)}
                className="gap-2 rounded-xl border-border/60 bg-background/80"
              >
                <ArrowLeft className="h-4 w-4" />
                Previous page
              </Button>
            </div>
          </div>
          <Card className="h-full overflow-hidden border border-border/60 bg-background/80">
            <CardHeader className="border-b border-border/60 bg-muted/10 px-4 py-4">
              <CardTitle className="text-base font-semibold text-foreground">Need a hand?</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Reach our support crew and share the URL above for faster help.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 px-4 py-4 text-sm">
              <div className="flex items-start gap-3 rounded-lg border border-border/50 bg-background/85 px-3 py-3">
                <Mail className="mt-0.5 h-4 w-4 text-primary" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">Email</p>
                  <a href="mailto:karthik@samsproject.com" className="text-xs text-muted-foreground hover:text-primary">
                    karthik@samsproject.com
                  </a>
                  <p className="text-xs text-muted-foreground">
                    Share the page link above so we can track it quickly.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
