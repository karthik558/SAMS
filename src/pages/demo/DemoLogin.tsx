import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground md:flex-row">
      <aside className="relative hidden w-full flex-1 overflow-hidden md:block">
        <img src="/login_image.png" alt="SAMS workspace" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-br from-background/40 via-background/55 to-primary/25" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[40%] bg-gradient-to-t from-background via-background/85 to-transparent" />
      </aside>
      <main className="flex min-h-dvh w-full flex-1 items-center justify-center px-5 py-12 sm:px-8">
        <div className="w-full max-w-md space-y-8">
          <Card className="rounded-2xl border border-border/60 bg-card/95 shadow-soft">
            <CardHeader className="space-y-2 text-center">
              <CardTitle className="text-2xl font-semibold">Welcome to the demo</CardTitle>
              <p className="text-sm text-muted-foreground">
                Your credentials are filled in. Sign in to explore the workspace.
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
                  <label htmlFor="demo-email" className="text-sm font-medium">Email</label>
                  <Input id="demo-email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label htmlFor="demo-password" className="text-sm font-medium">Password</label>
                  <Input id="demo-password" autoComplete="current-password" required type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
                <Button type="submit" className="w-full">Sign in to Demo</Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
