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
    <div className="min-h-dvh flex flex-col bg-muted/30">
      <main className="flex flex-1 items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-soft border-border">
          <CardHeader className="space-y-3 text-center">
            <div className="mx-auto flex max-w-[160px] items-center justify-center">
              <img src="/sams_logo.png" alt="SAMS" className="h-10 w-full object-contain" />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-2xl">Demo Login</CardTitle>
              <p className="text-sm text-muted-foreground">Use the prefilled credentials to access the demo.</p>
            </div>
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
      </main>
    </div>
  );
}
