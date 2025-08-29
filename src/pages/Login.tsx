import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { QrCode, Eye, EyeOff } from "lucide-react";
import { listUsers, type AppUser } from "@/services/users";
import { hasSupabaseEnv } from "@/lib/supabaseClient";
import { initiatePasswordSignIn, mfaChallenge, mfaVerify, ensureSingleActiveSession, generateSessionTag, getLocalSessionTag, setLocalSessionTag, loginWithPassword, requestPasswordReset } from "@/services/auth";

const LS_USERS_KEY = "app_users_fallback";
const CURRENT_USER_KEY = "current_user_id";
const AUTH_USER_KEY = "auth_user";

function readLocalUsers(): AppUser[] {
  try {
    const raw = localStorage.getItem(LS_USERS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as AppUser[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export default function Login() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [mfaNeeded, setMfaNeeded] = useState<{ factors: Array<{ id: string; friendlyName?: string | null }> } | null>(null);
  const [selectedFactor, setSelectedFactor] = useState<string>("");
  const [challengeId, setChallengeId] = useState<string>("");
  const [otp, setOtp] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [resetSending, setResetSending] = useState(false);

  const isAuthed = useMemo(() => {
    try { return Boolean(localStorage.getItem(CURRENT_USER_KEY)); } catch { return false; }
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
    setLoading(true);
    try {
      if (hasSupabaseEnv) {
        if (attempts >= 5) {
          await new Promise(r => setTimeout(r, 1500)); // throttle after 5 attempts
        }
        // Try password sign-in and detect MFA
        const res = await initiatePasswordSignIn(email.trim(), password);
        if (res.mfa) {
          setMfaNeeded(res.mfa);
          setSelectedFactor(res.mfa.factors[0]?.id || "");
          // Create a challenge for the first factor
          if (res.mfa.factors[0]?.id) {
            const ch = await mfaChallenge(res.mfa.factors[0].id);
            setChallengeId(ch.challengeId);
          }
          return; // wait for OTP submit
        }
        const u = res.user;
        if (!u) {
          toast({ title: "Invalid credentials", description: "Email or password is incorrect.", variant: "destructive" });
          setAttempts(a => a + 1);
          return;
        }
        // Single-device enforcement
        const tag = generateSessionTag();
        const single = await ensureSingleActiveSession(u.email, tag, false);
        if ((single as any).conflict) {
          const overwrite = window.confirm("You are signed in elsewhere. Sign out other sessions?");
          if (!overwrite) return;
          const newTag = generateSessionTag();
          const force = await ensureSingleActiveSession(u.email, newTag, true);
          if ((force as any).ok) {
            try { setLocalSessionTag(newTag); } catch {}
          }
          if (!(force as any).ok) return;
        }
        try { setLocalSessionTag(tag); } catch {}
        try {
          localStorage.setItem(CURRENT_USER_KEY, u.id);
          localStorage.setItem(AUTH_USER_KEY, JSON.stringify({ id: u.id, name: u.name, email: u.email, role: u.role, department: (u as any).department || null }));
        } catch {}
        toast({ title: "Welcome", description: u.name });
      } else {
        // Local fallback: check local users and simple hash
        const users = readLocalUsers();
        const user = users.find(u => u.email.toLowerCase() === email.trim().toLowerCase());
        if (!user) {
          toast({ title: "Invalid credentials", description: "User not found.", variant: "destructive" });
          return;
        }
        const raw = (user as any).password_hash as string | undefined;
        const computed = password ? btoa(unescape(encodeURIComponent(password))).slice(0, 32) : "";
        if (!raw || computed !== raw) {
          toast({ title: "Invalid credentials", description: "Wrong password.", variant: "destructive" });
          return;
        }
        try {
          localStorage.setItem(CURRENT_USER_KEY, user.id);
          localStorage.setItem(AUTH_USER_KEY, JSON.stringify({ id: user.id, name: user.name, email: user.email, role: user.role, department: user.department || null }));
        } catch {}
        toast({ title: "Welcome", description: user.name });
      }
      navigate("/", { replace: true });
    } finally {
  setLoading(false);
  // Clear sensitive in-memory state
  try { setPassword(""); } catch {}
    }
  };

  const handleMfaVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const factorId = selectedFactor;
      if (!factorId || !challengeId || !otp) return;
      const u = await mfaVerify(factorId, challengeId, otp, email.trim());
      if (!u) { toast({ title: "MFA failed", variant: "destructive" }); return; }
      // Single-device enforcement
      const tag = generateSessionTag();
      const single = await ensureSingleActiveSession(u.email, tag, false);
      if ((single as any).conflict) {
        const overwrite = window.confirm("You are signed in elsewhere. Sign out other sessions?");
        if (!overwrite) return;
        const newTag = generateSessionTag();
        const force = await ensureSingleActiveSession(u.email, newTag, true);
        if ((force as any).ok) {
          try { setLocalSessionTag(newTag); } catch {}
        }
        if (!(force as any).ok) return;
      }
      try { setLocalSessionTag(tag); } catch {}
      localStorage.setItem(CURRENT_USER_KEY, u.id);
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify({ id: u.id, name: u.name, email: u.email, role: u.role, department: (u as any).department || null }));
      toast({ title: "Welcome", description: u.name });
      navigate("/", { replace: true });
    } catch (e:any) {
      toast({ title: "MFA verification failed", description: e?.message || String(e), variant: "destructive" });
    } finally {
      setLoading(false);
      try { setPassword(""); setOtp(""); } catch {}
    }
  };

  return (
    <div className="min-h-dvh flex flex-col bg-muted/30">
      <main className="flex flex-1 items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-soft border-border">
          <CardHeader className="space-y-3 text-center">
            <div className="mx-auto flex items-center justify-center">
              <div className="h-12 w-12 rounded-xl bg-background border border-border flex items-center justify-center shadow-sm">
                <img src="/favicon.png" alt="SAMS" className="h-8 w-8 object-contain" />
              </div>
            </div>
            <div className="space-y-1">
              <CardTitle className="text-2xl">Sign in to SAMS</CardTitle>
              <p className="text-sm text-muted-foreground">Welcome back. Please enter your details.</p>
            </div>
          </CardHeader>
          <CardContent>
            {!mfaNeeded ? (
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">Email</label>
                <Input id="email" type="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
              </div>
              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium">Password</label>
                <div className="flex gap-2">
                  <Input id="password" type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
                  <Button type="button" variant="outline" onClick={() => setShowPassword(s => !s)} className="shrink-0">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <label className="inline-flex items-center gap-2 select-none">
                  <input type="checkbox" className="rounded border-border" />
                  <span className="text-muted-foreground">Remember me</span>
                </label>
                <button
                  type="button"
                  className="text-primary hover:underline disabled:opacity-60"
                  disabled={resetSending || !email}
                  onClick={async () => {
                    if (!email) return;
                    try {
                      setResetSending(true);
                      const base = (import.meta as any)?.env?.VITE_PUBLIC_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : '');
                      const redirect = `${(base || '').replace(/\/$/, '')}/login`;
                      await requestPasswordReset(email.trim(), redirect);
                      toast({ title: "Reset email sent", description: "Check your inbox for password reset." });
                    } catch (e:any) {
                      toast({ title: "Reset failed", description: e?.message || String(e), variant: "destructive" });
                    } finally {
                      setResetSending(false);
                    }
                  }}
                >
                  Forgot password?
                </button>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Signing in..." : "Sign in"}
              </Button>
            </form>
            ) : (
            <form onSubmit={handleMfaVerify} className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium">Enter authentication code</label>
                <Input id="otp" inputMode="numeric" pattern="[0-9]*" maxLength={6} placeholder="000000" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0,6))} />
              </div>
              <Button type="submit" className="w-full" disabled={loading || otp.length !== 6}>
                {loading ? "Verifying..." : "Verify"}
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={() => { setMfaNeeded(null); setOtp(""); }}>
                Use a different account
              </Button>
            </form>
            )}
            <div className="mt-4">
              <Button type="button" variant="outline" className="w-full gap-2" onClick={() => navigate('/scan')}>
                <QrCode className="h-4 w-4" />
                Scan QR (No login)
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
      <footer className="border-t border-border p-4 text-center text-xs text-muted-foreground">
        <p>
          © 2025{' '}
          <a
            href="https://karthiklal.in"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            SAMS
          </a>
          . All rights reserved.
        </p>
      </footer>
    </div>
  );
}
