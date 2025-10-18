import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { demoAuthKeys } from "@/lib/demo";

export default function DemoLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("demo@demo.com");
  const [password, setPassword] = useState("demo@123");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    try {
      const uid = sessionStorage.getItem(demoAuthKeys().current);
      if (uid) navigate("/demo", { replace: true });
    } catch {}
  }, [navigate]);

  const currentYear = new Date().getFullYear();

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground md:flex-row">
      <aside className="relative hidden w-full flex-1 overflow-hidden md:block">
        <img
          src="/login_image.png"
          alt="SAMS workspace"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-background/40 via-background/55 to-primary/25" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[40%] bg-gradient-to-t from-background via-background/85 to-transparent" />
        <div className="relative z-10 flex h-full flex-col justify-between p-10">
          <div className="max-w-[200px]">
          </div>
          <p className="text-xs text-foreground/70">
            © {currentYear} SAMS Demo. Experience the platform risk-free.
          </p>
        </div>
      </aside>
      <main className="flex min-h-dvh w-full flex-1 items-center justify-center px-5 py-12 sm:px-8">
        <div className="w-full max-w-md space-y-8">
          <div className="overflow-hidden rounded-3xl border border-border/60 bg-card/80 shadow-soft md:hidden">
            <div className="relative h-40 w-full">
              <img src="/sams_logo.png" alt="SAMS workspace" className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-br from-background/40 via-background/35 to-primary/20" />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[45%] bg-gradient-to-t from-background via-background/85 to-transparent" />
              <div className="absolute bottom-4 left-4 flex items-center gap-3">
                <div className="max-w-[160px]">
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.32em] text-primary">SAMS Demo</p>
                </div>
              </div>
            </div>
          </div>
          <Card className="rounded-2xl border border-border/60 bg-card/95 shadow-soft">
            <CardHeader className="space-y-2 text-center">
              <CardTitle className="text-2xl font-semibold">Demo Login</CardTitle>
              <p className="text-sm text-muted-foreground">
                Use the prefilled credentials or tweak them to simulate sign-in.
              </p>
            </CardHeader>
            <CardContent>
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  setError("");
                  if (email.trim().toLowerCase() === "demo@demo.com" && password === "demo@123") {
                    try {
                      const keys = demoAuthKeys();
                      const user = { id: "demo-user", name: "Demo User", email: "demo@demo.com", role: "admin" };
                      // Demo-scoped keys (session only for isolation; no cross-contamination)
                      sessionStorage.setItem(keys.current, user.id);
                      sessionStorage.setItem(keys.auth, JSON.stringify(user));
                      // Ensure any stale demo keys in localStorage are cleared
                      try { localStorage.removeItem(keys.current); localStorage.removeItem(keys.auth); } catch {}
                    } catch {}
                    navigate("/demo", { replace: true });
                  } else {
                    setError("Invalid demo credentials");
                  }
                }}
              >
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email</label>
                  <Input value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Password</label>
                  <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" className="w-full">Sign in to Demo</Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
