import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { QrCode, Eye, EyeOff, Check } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { loginWithPassword, updateLastLogin, type MinimalUser } from "@/services/auth";
import { getUserPreferences } from "@/services/userPreferences";
import { Checkbox } from "@/components/ui/checkbox";
import {
  requestPasswordReset,
  verifyPasswordResetCode,
  completePasswordReset,
  maskEmailAddress,
  PASSWORD_RESET_MAX_ATTEMPTS,
  PASSWORD_RESET_CODE_TTL_MINUTES,
} from "@/services/passwordReset";

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
  const [forgotOpen, setForgotOpen] = useState(false);
  const [resetStep, setResetStep] = useState<"email" | "code" | "password">("email");
  const [resetEmail, setResetEmail] = useState("");
  const [maskedEmail, setMaskedEmail] = useState<string | null>(null);
  const [requestingCode, setRequestingCode] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [attemptsRemaining, setAttemptsRemaining] = useState(PASSWORD_RESET_MAX_ATTEMPTS);
  const [otpLoading, setOtpLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [newPasswordValue, setNewPasswordValue] = useState("");
  const [confirmPasswordValue, setConfirmPasswordValue] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const RESEND_COOLDOWN_SECONDS = 45;

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

  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const resetForgotPasswordFlow = useCallback((seedEmail?: string) => {
    setResetStep("email");
    setResetEmail(seedEmail ? seedEmail.trim() : "");
    setMaskedEmail(seedEmail ? maskEmailAddress(seedEmail) : null);
    setRequestingCode(false);
    setOtpCode("");
    setResetToken(null);
    setAttemptsRemaining(PASSWORD_RESET_MAX_ATTEMPTS);
    setOtpLoading(false);
    setPasswordLoading(false);
    setNewPasswordValue("");
    setConfirmPasswordValue("");
    setCooldown(0);
  }, []);

  const finishLogin = useCallback(
    async (user: MinimalUser) => {
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
      setEmail(user.email);
      try {
        const prefs = await getUserPreferences(user.id);
        const target = prefs?.default_landing_page || "/";
        if (target === "/approvals") {
          const role = (user.role || "").toLowerCase();
          if (["admin", "manager"].includes(role)) {
            navigate(target, { replace: true });
            return;
          }
          navigate("/", { replace: true });
          return;
        }
        navigate(target, { replace: true });
      } catch {
        navigate("/", { replace: true });
      }
    },
    [navigate]
  );

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
      await finishLogin(user);
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
    const seeded = email.trim();
    resetForgotPasswordFlow(seeded);
    setForgotOpen(true);
  };

  const sendResetCode = useCallback(
    async (opts?: { quiet?: boolean }): Promise<boolean> => {
      const normalized = resetEmail.trim();
      if (!normalized) {
        throw new Error("Email is required");
      }
      setRequestingCode(true);
      try {
        const result = await requestPasswordReset(normalized);
        if (!result.userFound) {
          toast({
            title: "Account not found",
            description: "We couldn't find a SAMS account with that email address.",
            variant: "destructive",
          });
          setResetStep("email");
          setAttemptsRemaining(PASSWORD_RESET_MAX_ATTEMPTS);
          setOtpCode("");
          setResetToken(null);
          setCooldown(0);
          return false;
        }
        if (!result.delivered) {
          toast({
            title: "Unable to send code",
            description: "We couldn't send a verification code right now. Please try again later.",
            variant: "destructive",
          });
          return false;
        }
        const masked = result.maskedEmail || maskEmailAddress(normalized);
        setResetEmail(normalized);
        setMaskedEmail(masked);
        setResetStep("code");
        setAttemptsRemaining(PASSWORD_RESET_MAX_ATTEMPTS);
        setOtpCode("");
        setResetToken(null);
        setCooldown(RESEND_COOLDOWN_SECONDS);
        if (!opts?.quiet) {
          toast({
            title: "Verification code sent",
            description: `Check ${masked} for your one-time access code.`,
          });
        }
        return true;
      } catch (err: any) {
        console.error("requestPasswordReset failed", err);
        toast({
          title: "Unable to send code",
          description: err?.message || "Please try again in a moment.",
          variant: "destructive",
        });
        return false;
      } finally {
        setRequestingCode(false);
      }
    },
    [resetEmail, toast, RESEND_COOLDOWN_SECONDS]
  );

  const handleSendResetEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) {
      toast({ title: "Enter your email", variant: "destructive" });
      return;
    }
    await sendResetCode();
  };

  const handleResendCode = async () => {
    if (requestingCode || cooldown > 0) return;
    await sendResetCode();
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otpCode.trim();
    if (!code) {
      toast({ title: "Enter the verification code", variant: "destructive" });
      return;
    }
    setOtpLoading(true);
    try {
      const result = await verifyPasswordResetCode(resetEmail.trim(), code);
      if (result.status === "ok" && result.resetToken) {
        setResetToken(result.resetToken);
        setResetStep("password");
        setOtpCode("");
        setCooldown(0);
        setAttemptsRemaining(PASSWORD_RESET_MAX_ATTEMPTS);
        toast({ title: "Code verified", description: "Enter a new password to finish resetting your account." });
      } else if (result.status === "mismatch") {
        const remaining =
          typeof result.attemptsRemaining === "number"
            ? result.attemptsRemaining
            : Math.max(0, attemptsRemaining - 1);
        setAttemptsRemaining(remaining);
        setOtpCode("");
        toast({
          title: "Incorrect code",
          description: `You have ${remaining} attempt${remaining === 1 ? "" : "s"} remaining before a new code is sent.`,
          variant: "destructive",
        });
      } else {
        setAttemptsRemaining(PASSWORD_RESET_MAX_ATTEMPTS);
        setOtpCode("");
        const resent = await sendResetCode({ quiet: true });
        if (resent) {
          toast({
            title: "New code sent",
            description: "We emailed you a new verification code after too many incorrect attempts.",
          });
        }
      }
    } catch (err: any) {
      toast({
        title: "Verification failed",
        description: err?.message || "Unable to verify the code. Please try again.",
        variant: "destructive",
      });
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetToken) {
      toast({ title: "Missing verification", description: "Verify the latest code before updating your password.", variant: "destructive" });
      return;
    }
    const trimmedPassword = newPasswordValue.trim();
    if (trimmedPassword.length < 6) {
      toast({ title: "Password too short", description: "Use at least 6 characters for your new password.", variant: "destructive" });
      return;
    }
    if (trimmedPassword !== confirmPasswordValue.trim()) {
      toast({ title: "Passwords do not match", description: "Enter the same password in both fields.", variant: "destructive" });
      return;
    }
    setPasswordLoading(true);
    try {
      await completePasswordReset(resetToken, trimmedPassword);
      const user = await loginWithPassword(resetEmail.trim(), trimmedPassword);
      if (!user) {
        throw new Error("Password updated but automatic sign-in failed. Please sign in manually.");
      }
      await finishLogin(user);
      toast({ title: "Password updated", description: "You are now signed in with your new password." });
      setForgotOpen(false);
      resetForgotPasswordFlow("");
    } catch (err: any) {
      toast({
        title: "Unable to update password",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setPasswordLoading(false);
    }
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
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[40%] bg-gradient-to-t from-background via-background/85 to-transparent" />
        <div className="relative z-10 flex h-full flex-col justify-between p-10">
          <div className="max-w-[200px]">
          </div>
          <p className="text-xs text-foreground/70">
            © {currentYear} SAMS. All rights reserved.
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
      <Dialog
        open={forgotOpen}
        onOpenChange={(open) => {
          setForgotOpen(open);
          if (open) {
            const seeded = (resetEmail || email).trim();
            resetForgotPasswordFlow(seeded || email.trim());
          } else {
            resetForgotPasswordFlow("");
          }
        }}
      >
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md rounded-2xl border border-border/60 bg-card/95 p-0 shadow-2xl sm:w-full">
          <DialogHeader className="space-y-1 border-b border-border/60 px-6 py-5 text-left">
            <DialogTitle className="text-lg font-semibold text-foreground">Reset your access</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {resetStep === "email"
                ? "Security check before we let you back in."
                : resetStep === "code"
                  ? "This keeps your account safe while we verify."
                  : "Set a strong password you haven’t used here before."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 px-6 py-6">
            {resetStep === "email" && (
              <form onSubmit={handleSendResetEmail} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="reset-email" className="text-xs uppercase tracking-wide text-muted-foreground">
                    Work Email
                  </Label>
                  <Input
                    id="reset-email"
                    type="email"
                    autoFocus
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="h-11 rounded-xl border-border/70 bg-muted/30 backdrop-blur focus-visible:ring-primary/50"
                  />
                </div>
                <Button
                  type="submit"
                  className="h-11 w-full rounded-xl bg-primary text-primary-foreground shadow-soft transition hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 disabled:opacity-60"
                  disabled={requestingCode}
                >
                  {requestingCode ? "Sending…" : "Send security code"}
                </Button>
              </form>
            )}

            {resetStep === "code" && (
              <form onSubmit={handleVerifyCode} className="space-y-6">
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p className="leading-relaxed">
                    A one-time passcode was sent to{" "}
                    <span className="font-medium text-foreground">
                      {maskedEmail || maskEmailAddress(resetEmail)}
                    </span>
                    . It remains valid for the next {PASSWORD_RESET_CODE_TTL_MINUTES} minutes.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reset-code" className="text-xs uppercase tracking-wide text-muted-foreground">
                    Passcode
                  </Label>
                  <Input
                    id="reset-code"
                    inputMode="numeric"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="••••••"
                    autoFocus
                    className="h-11 rounded-xl border-border/70 bg-muted/30 text-center tracking-[0.6em] text-lg font-semibold focus-visible:ring-primary/50"
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="rounded-full border border-dashed border-border/60 px-3 py-1">
                    Attempts remaining: <span className="font-semibold text-foreground">{attemptsRemaining}</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleResendCode}
                    disabled={requestingCode || cooldown > 0}
                    className="font-medium text-primary transition hover:text-primary/80 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
                  </button>
                </div>
                <Button
                  type="submit"
                  className="h-11 w-full rounded-xl bg-primary text-primary-foreground shadow-soft transition hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 disabled:opacity-60"
                  disabled={otpLoading}
                >
                  {otpLoading ? "Verifying…" : "Confirm identity"}
                </Button>
              </form>
            )}

            {resetStep === "password" && (
              <form onSubmit={handleResetPassword} className="space-y-6">
                <div className="space-y-1 text-sm text-muted-foreground leading-relaxed">
                  <p>
                    You’re updating credentials for{" "}
                    <span className="font-medium text-foreground">{maskEmailAddress(resetEmail)}</span>.
                  </p>
                  <p>Use a phrase that mixes letters, numbers, and symbols.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-password" className="text-xs uppercase tracking-wide text-muted-foreground">
                    New password
                  </Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={newPasswordValue}
                    onChange={(e) => setNewPasswordValue(e.target.value)}
                    autoFocus
                    className="h-11 rounded-xl border-border/70 bg-muted/30 focus-visible:ring-primary/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password" className="text-xs uppercase tracking-wide text-muted-foreground">
                    Confirm password
                  </Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPasswordValue}
                    onChange={(e) => setConfirmPasswordValue(e.target.value)}
                    className="h-11 rounded-xl border-border/70 bg-muted/30 focus-visible:ring-primary/50"
                  />
                </div>
                <Button
                  type="submit"
                  className="h-11 w-full rounded-xl bg-primary text-primary-foreground shadow-soft transition hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 disabled:opacity-60"
                  disabled={passwordLoading}
                >
                  {passwordLoading ? "Updating…" : "Save & continue"}
                </Button>
              </form>
            )}
          </div>
          <DialogFooter className="px-6 pb-5 text-xs text-muted-foreground">
            Need a hand? Reach your SAMS admin or email{" "}
            <span className="font-medium text-foreground">support@samsproject.in</span>.
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
