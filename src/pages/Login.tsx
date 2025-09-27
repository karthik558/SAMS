import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { QrCode, Eye, EyeOff } from "lucide-react";
import { loginWithPassword, updateLastLogin } from "@/services/auth";
import { getUserPreferences } from "@/services/userPreferences";
import { Checkbox } from "@/components/ui/checkbox";

const CURRENT_USER_KEY = "current_user_id";
const AUTH_USER_KEY = "auth_user";

export default function Login() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [showPassword, setShowPassword] = useState(false);

  const isAuthed = useMemo(() => {
    try {
      return Boolean(localStorage.getItem(CURRENT_USER_KEY));
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    if (isAuthed) navigate("/", { replace: true });
  }, [isAuthed, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast({ title: "Email is required", variant: "destructive" });
      return;
    }
    if (!password) {
      toast({ title: "Password is required", variant: "destructive" });
      return;
    }
    setLoading(true);
    if (attempts >= 5) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    try {
      const user = await loginWithPassword(email.trim(), password);
      if (!user) {
        setAttempts((a) => a + 1);
        toast({ title: "Invalid credentials", description: "Email or password is incorrect.", variant: "destructive" });
        return;
      }
      try {
        localStorage.setItem(CURRENT_USER_KEY, user.id);
        localStorage.setItem(
          AUTH_USER_KEY,
          JSON.stringify({
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            department: user.department ?? null,
          })
        );
      } catch {}
      try {
        await updateLastLogin(user.email);
      } catch {}
      setAttempts(0);
      setPassword("");
      try {
        const prefs = await getUserPreferences(user.id);
        const target = prefs?.default_landing_page || "/";
        if (target === "/approvals") {
          const role = (user.role || "").toLowerCase();
          if (["admin", "manager"].includes(role)) {
            navigate(target, { replace: true });
          } else {
            navigate("/", { replace: true });
          }
        } else {
          navigate(target, { replace: true });
        }
      } catch {
        navigate("/", { replace: true });
      }
    } catch (err: any) {
      toast({
        title: "Sign in failed",
        description: err?.message || "Unable to sign in. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh grid md:grid-cols-2 bg-background">
      {/* Brand / Visual Side */}
      <div className="relative hidden md:block">
        <img
          src="/sams_banner.jpg"
          alt="SAMS"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-primary/60 via-background/10 to-background/80" />
        <div className="relative z-10 flex h-full flex-col justify-between p-8">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-background/80 border border-border/60 backdrop-blur flex items-center justify-center shadow-sm">
              <img src="/favicon.png" alt="SAMS" className="h-8 w-8 object-contain" />
            </div>
            <span className="text-xl font-bold text-white drop-shadow">SAMS</span>
          </div>
          <div className="space-y-3 text-white drop-shadow">
            <h1 className="text-3xl font-semibold">Smart Asset Management System</h1>
            <p className="max-w-md text-sm text-white/90">
              Keep track of properties, assets, audits, and tickets with a modern, fast, and secure workflow.
            </p>
          </div>
        </div>
      </div>

      {/* Auth Form Side */}
      <div className="flex min-h-dvh items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <Card className="w-full rounded-2xl border border-primary/30 bg-card/90 backdrop-blur-sm shadow-md">
            <CardHeader className="space-y-3 text-center">
              <div className="mx-auto flex items-center justify-center">
                <div className="h-12 w-12 rounded-xl bg-primary/10 border border-primary/40 flex items-center justify-center shadow-sm text-primary">
                  <img src="/favicon.png" alt="SAMS" className="h-8 w-8 object-contain" />
                </div>
              </div>
              <div className="space-y-1">
                <CardTitle className="text-2xl">Welcome back</CardTitle>
                <p className="text-sm text-muted-foreground">Sign in to continue to SAMS</p>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-5">
                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium">
                    Email
                  </label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="password" className="text-sm font-medium">
                    Password
                  </label>
                  <div className="flex gap-2">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      aria-required="true"
                      aria-invalid={attempts > 0 ? true : undefined}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      onClick={() => setShowPassword((s) => !s)}
                      className="shrink-0"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <label className="inline-flex items-center gap-2 select-none">
                    <Checkbox id="remember" />
                    <span className="text-muted-foreground">Remember me</span>
                  </label>
                </div>
                <Button type="submit" className="w-full h-11 bg-gradient-to-r from-primary via-primary/90 to-primary/80 hover:from-primary/90 hover:via-primary hover:to-primary/90" disabled={loading}>
                  {loading ? "Signing in..." : "Sign in"}
                </Button>
              </form>
              <div className="mt-6 flex flex-col gap-3">
                <Button type="button" variant="outline" className="w-full gap-2" onClick={() => navigate("/scan")}>
                  <QrCode className="h-4 w-4" />
                  Scan QR Code
                </Button>
              </div>
            </CardContent>
          </Card>
          <div className="mt-6 text-center text-xs text-muted-foreground">
            © 2025 <span className="font-medium text-foreground">SAMS</span>. All rights reserved.
          </div>
        </div>
      </div>
    </div>
  );
}
