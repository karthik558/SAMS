import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { QrCode, Eye, EyeOff } from "lucide-react";
import { listUsers, type AppUser } from "@/services/users";
import { hasSupabaseEnv } from "@/lib/supabaseClient";
import { initiatePasswordSignIn, mfaChallenge, mfaVerify, loginWithPassword, requestPasswordReset, updateLastLogin, completePasswordReset, listMfaFactors } from "@/services/auth";
import { getUserPreferences } from "@/services/userPreferences";
import { supabase } from "@/lib/supabaseClient";

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
  const [isResetMode, setIsResetMode] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetMfaNeeded, setResetMfaNeeded] = useState(false);
  const [resetFactorId, setResetFactorId] = useState<string>("");
  const [resetChallengeId, setResetChallengeId] = useState<string>("");
  const [resetOtp, setResetOtp] = useState("");

  const isAuthed = useMemo(() => {
    try { return Boolean(localStorage.getItem(CURRENT_USER_KEY)); } catch { return false; }
  }, []);

  useEffect(() => {
    if (isAuthed) navigate("/", { replace: true });
  }, [isAuthed, navigate]);

  // Detect Supabase recovery flow from query params (access_token, type=recovery)
  useEffect(() => {
    const sp = new URLSearchParams(window.location.hash?.startsWith('#') ? window.location.hash.slice(1) : window.location.search);
    const type = (sp.get('type') || '').toLowerCase();
    if (type === 'recovery') {
      setIsResetMode(true);
      // Check if MFA is enabled and prepare a challenge
      (async () => {
        try {
          if (!hasSupabaseEnv) return;
          const factors = await listMfaFactors();
          const totp = factors.totp || [];
          if (Array.isArray(totp) && totp.length > 0) {
            setResetMfaNeeded(true);
            const fid = totp[0].id;
            setResetFactorId(fid);
            const ch = await mfaChallenge(fid);
            setResetChallengeId(ch.challengeId);
          }
        } catch (e) {
          // ignore; fallback to no-MFA reset
        }
      })();
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { toast({ title: "Email is required", variant: "destructive" }); return; }
    if (!password) { toast({ title: "Password is required", variant: "destructive" }); return; }
    setLoading(true);
    let success = false;
    try {
      if (hasSupabaseEnv) {
        if (attempts >= 5) {
          await new Promise(r => setTimeout(r, 1500));
        }
        let res: any = null;
        try {
          res = await initiatePasswordSignIn(email.trim(), password);
        } catch (err: any) {
          const msg = (err?.message || '').toLowerCase().includes('invalid') ? 'Email or password is incorrect.' : (err?.message || 'Sign in failed');
          toast({ title: "Invalid credentials", description: msg, variant: "destructive" });
          setAttempts(a => a + 1);
          return; // keep password so user can adjust
        }
        if (res.mfa) {
          setMfaNeeded(res.mfa);
          setSelectedFactor(res.mfa.factors[0]?.id || "");
          if (res.mfa.factors[0]?.id) {
            const ch = await mfaChallenge(res.mfa.factors[0].id);
            setChallengeId(ch.challengeId);
          }
          return; // keep password for MFA context (not strictly needed but OK)
        }
        const u = res.user;
        if (!u) {
          toast({ title: "Invalid credentials", description: "Email or password is incorrect.", variant: "destructive" });
          setAttempts(a => a + 1);
          return;
        }
        try {
          localStorage.setItem(CURRENT_USER_KEY, u.id);
          localStorage.setItem(AUTH_USER_KEY, JSON.stringify({ id: u.id, name: u.name, email: u.email, role: u.role, department: (u as any).department || null }));
        } catch {}
        try { await updateLastLogin(u.email); } catch {}
      } else {
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
          return; // preserve password
        }
        try {
          localStorage.setItem(CURRENT_USER_KEY, user.id);
          localStorage.setItem(AUTH_USER_KEY, JSON.stringify({ id: user.id, name: user.name, email: user.email, role: user.role, department: user.department || null }));
        } catch {}
      }
      success = true;
      try {
        // Attempt to load preferences for redirect
        const uid = localStorage.getItem(CURRENT_USER_KEY) || "";
        if (uid) {
          const prefs = await getUserPreferences(uid);
          const target = prefs?.default_landing_page || "/";
          // Gate approvals if user not allowed
          if (target === "/approvals") {
            let role = ""; try { const raw = localStorage.getItem(AUTH_USER_KEY); role = raw ? (JSON.parse(raw).role || '').toLowerCase() : ''; } catch {}
            if (!['admin','manager'].includes(role)) {
              navigate("/", { replace: true });
            } else {
              navigate(target, { replace: true });
            }
          } else {
            navigate(target, { replace: true });
          }
        } else {
          navigate("/", { replace: true });
        }
      } catch {
        navigate("/", { replace: true });
      }
    } finally {
      setLoading(false);
      if (success) {
        try { setPassword(""); } catch {}
      }
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
      localStorage.setItem(CURRENT_USER_KEY, u.id);
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify({ id: u.id, name: u.name, email: u.email, role: u.role, department: (u as any).department || null }));
      try { await updateLastLogin(u.email); } catch {}
  // No welcome toast
      try {
        const uid = localStorage.getItem(CURRENT_USER_KEY) || "";
        if (uid) {
          const prefs = await getUserPreferences(uid);
          const target = prefs?.default_landing_page || "/";
          if (target === "/approvals") {
            let role = ""; try { const raw = localStorage.getItem(AUTH_USER_KEY); role = raw ? (JSON.parse(raw).role || '').toLowerCase() : ''; } catch {}
            if (!['admin','manager'].includes(role)) navigate("/", { replace: true }); else navigate(target, { replace: true });
          } else {
            navigate(target, { replace: true });
          }
        } else {
          navigate("/", { replace: true });
        }
      } catch {
        navigate("/", { replace: true });
      }
    } catch (e:any) {
      toast({ title: "MFA verification failed", description: e?.message || String(e), variant: "destructive" });
    } finally {
      setLoading(false);
      try { setPassword(""); setOtp(""); } catch {}
    }
  };

  return (
    <div className="min-h-dvh flex flex-col bg-muted/20">
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm md:max-w-md">
          <Card className="w-full shadow-sm border-border/60 animate-in fade-in duration-300">
            <CardHeader className="space-y-3 text-center">
              <div className="mx-auto flex items-center justify-center">
                <div className="h-12 w-12 rounded-xl bg-background border border-border flex items-center justify-center shadow-sm">
                  <img src="/favicon.png" alt="SAMS" className="h-8 w-8 object-contain" />
                </div>
              </div>
              <div className="space-y-1">
                <CardTitle className="text-2xl">Sign in to SAMS</CardTitle>
                <p className="text-sm text-muted-foreground">Enter your credentials to continue.</p>
              </div>
            </CardHeader>
            <CardContent>
              {isResetMode ? (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    try {
                      if (!newPassword || newPassword.length < 8) {
                        toast({ title: 'Password too short', description: 'Use at least 8 characters.', variant: 'destructive' });
                        return;
                      }
                      if (newPassword !== confirmPassword) {
                        toast({ title: 'Passwords do not match', variant: 'destructive' });
                        return;
                      }
                      if (resetMfaNeeded) {
                        if (resetOtp.length !== 6) {
                          toast({ title: 'Enter the 6-digit code', variant: 'destructive' });
                          return;
                        }
                      }
                      setLoading(true);
                      // If MFA is required, verify first to upgrade session to AAL2
                      if (resetMfaNeeded && resetFactorId && resetChallengeId) {
                        try {
                          const { data: userRes } = await supabase.auth.getUser();
                          const emailForProfile = (userRes?.user?.email || '') as string;
                          await mfaVerify(resetFactorId, resetChallengeId, resetOtp, emailForProfile);
                        } catch (err:any) {
                          toast({ title: 'MFA verification failed', description: err?.message || String(err), variant: 'destructive' });
                          setLoading(false);
                          return;
                        }
                      }
                      await completePasswordReset(newPassword);
                      toast({ title: 'Password updated', description: 'You can now sign in with your new password.' });
                      setIsResetMode(false);
                      setNewPassword("");
                      setConfirmPassword("");
                      setResetOtp("");
                    } catch (err:any) {
                      toast({ title: 'Reset failed', description: err?.message || String(err), variant: 'destructive' });
                    } finally {
                      setLoading(false);
                    }
                  }}
                  className="space-y-5"
                >
                  <div className="space-y-2">
                    <label htmlFor="new_password" className="text-sm font-medium">New password</label>
                    <Input id="new_password" type="password" value={newPassword} onChange={(e)=>setNewPassword(e.target.value)} placeholder="••••••••" />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="confirm_password" className="text-sm font-medium">Confirm password</label>
                    <Input id="confirm_password" type="password" value={confirmPassword} onChange={(e)=>setConfirmPassword(e.target.value)} placeholder="••••••••" />
                  </div>
                  {resetMfaNeeded && (
                    <div className="space-y-2">
                      <label htmlFor="reset_otp" className="text-sm font-medium">Authenticator code</label>
                      <Input id="reset_otp" inputMode="numeric" pattern="[0-9]*" maxLength={6} placeholder="000000" value={resetOtp} onChange={(e)=>setResetOtp(e.target.value.replace(/\D/g, '').slice(0,6))} />
                      <p className="text-xs text-muted-foreground">Enter the 6-digit code from your authenticator app.</p>
                    </div>
                  )}
                  <Button type="submit" className="w-full" disabled={loading}>{loading ? 'Updating...' : 'Update password'}</Button>
                  <Button type="button" variant="ghost" className="w-full" onClick={()=>setIsResetMode(false)}>Back to sign in</Button>
                </form>
              ) : !mfaNeeded ? (
              <form onSubmit={handleLogin} className="space-y-5">
                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium">Email</label>
                  <Input id="email" type="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
                </div>
                <div className="space-y-2">
                  <label htmlFor="password" className="text-sm font-medium">Password</label>
                  <div className="flex gap-2">
                    <Input id="password" type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={password} aria-required="true" aria-invalid={attempts>0 && !mfaNeeded ? true : undefined} onChange={(e) => setPassword(e.target.value)} />
                    <Button type="button" variant="outline" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(s => !s)} className="shrink-0">
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
                  <Input id="otp" inputMode="numeric" pattern="[0-9]*" maxLength={6} placeholder="000000" value={otp} aria-label="One-time authentication code" onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0,6))} />
                </div>
                <Button type="submit" className="w-full" disabled={loading || otp.length !== 6}>
                  {loading ? "Verifying..." : "Verify"}
                </Button>
                <Button type="button" variant="ghost" className="w-full" onClick={() => { setMfaNeeded(null); setOtp(""); }}>
                  Use a different account
                </Button>
              </form>
              )}
              <div className="mt-6 flex flex-col gap-3">
                <Button type="submit" form={mfaNeeded ? undefined : undefined} variant="outline" className="w-full gap-2" onClick={() => navigate('/scan')}>
                  <QrCode className="h-4 w-4" />
                  Scan QR Code
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
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
