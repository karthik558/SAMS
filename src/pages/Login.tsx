import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { QrCode, Eye, EyeOff, Check } from "lucide-react";
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

  const currentYear = new Date().getFullYear();

  const handleForgotPassword = () => {
    toast({
      title: "Need a password reset?",
      description: "Reach out to your SAMS administrator to update your credentials.",
    });
  };

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground md:flex-row">
      <aside className="relative hidden w-full flex-1 overflow-hidden md:block">
        <img
          src="/login_image.png"
          alt="SAMS workspace"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-background/40 via-background/55 to-primary/25" />
        <div className="relative z-10 flex h-full flex-col justify-between p-10">
          <div className="max-w-[200px]">
            <img src="/sams_logo.png" alt="SAMS" className="h-10 w-full object-contain" />
          </div>
          <ul className="space-y-3 text-sm text-foreground/90">
            {["Bring every asset online", "Stay inspection ready", "Sign in securely from any device"].map((point) => (
              <li key={point} className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <Check className="h-3.5 w-3.5" />
                </span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-foreground/70">
            © {currentYear} SAMS. All rights reserved.
          </p>
        </div>
      </aside>
      <main className="flex min-h-dvh w-full flex-1 items-center justify-center px-5 py-12 sm:px-8">
        <div className="w-full max-w-md space-y-8">
          <div className="overflow-hidden rounded-3xl border border-border/60 bg-card/80 shadow-soft md:hidden">
            <div className="relative h-40 w-full">
              <img src="/login_image.png" alt="SAMS workspace" className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-br from-background/40 via-background/35 to-primary/20" />
              <div className="absolute bottom-4 left-4 flex items-center gap-3">
                <div className="max-w-[160px]">
                  <img src="/sams_logo.png" alt="SAMS" className="h-9 w-full object-contain" />
                </div>
              </div>
            </div>
          </div>
          <Card className="rounded-2xl border border-border/60 bg-card/95 shadow-soft">
            <CardHeader className="space-y-2 text-center">
              <CardTitle className="text-2xl font-semibold">Welcome back</CardTitle>
              <p className="text-sm text-muted-foreground">
                Enter your credentials to access SAMS.
              </p>
            </CardHeader>
            <CardContent className="space-y-5">
              <form onSubmit={handleLogin} className="space-y-5">
                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium text-muted-foreground/90">
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
                  <div className="flex items-center justify-between">
                    <label htmlFor="password" className="text-sm font-medium text-muted-foreground/90">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      className="text-xs font-semibold text-primary transition hover:text-primary/80"
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={password}
                      aria-required="true"
                      aria-invalid={attempts > 0 ? true : undefined}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      onClick={() => setShowPassword((s) => !s)}
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground transition hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <label className="inline-flex select-none items-center gap-2">
                    <Checkbox id="remember" />
                    <span className="text-muted-foreground">Remember me</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="text-sm font-semibold text-primary transition hover:text-primary/80"
                  >
                    Forgot password?
                  </button>
                </div>
                <Button
                  type="submit"
                  className="w-full h-11 rounded-2xl bg-primary text-primary-foreground shadow-soft transition hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2"
                  disabled={loading}
                >
                  {loading ? "Signing in..." : "Sign in"}
                </Button>
                <p className="rounded-2xl bg-muted/40 px-4 py-3 text-xs text-muted-foreground text-center">
                  Need help signing in? Email{" "}
                  <a href="mailto:karthik@samsproject.in" className="font-medium text-primary hover:underline">
                    karthik@samsproject.in
                  </a>
                  .
                </p>
              </form>
              <Button
                type="button"
                variant="outline"
                className="w-full gap-2 rounded-2xl border-border/70 bg-background/80 shadow-sm hover:bg-background"
                onClick={() => navigate("/scan")}
              >
                <QrCode className="h-4 w-4" />
                Scan QR Code
              </Button>
            </CardContent>
          </Card>
          <div className="text-center text-xs text-muted-foreground md:hidden">
            © {currentYear} <span className="font-medium text-foreground">SAMS</span>. All rights reserved.
          </div>
        </div>
      </main>
    </div>
  );
}
