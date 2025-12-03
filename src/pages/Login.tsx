import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { QrCode, Eye, EyeOff, Check } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { loginWithPassword, loginWithUsernameOrEmail, updateLastLogin, type MinimalUser } from "@/services/auth";
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
      } catch { }
      try {
        await updateLastLogin(user.email);
      } catch { }
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
      toast({ title: "Email or username is required", variant: "destructive" });
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
      // Accept either username (local-part) or full email
      const user = await loginWithUsernameOrEmail(email.trim(), password);
      if (!user) {
        setAttempts((a) => a + 1);
        toast({ title: "Invalid credentials", description: "Email/username or password is incorrect.", variant: "destructive" });
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
    <div className="flex min-h-screen w-full bg-background">
      {/* Left Panel - Visual */}
      <div className="relative hidden w-0 flex-1 lg:block">
        <img
          src="/login_image.png"
          alt="SAMS Workspace"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-background/40 via-background/55 to-primary/25" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[40%] bg-gradient-to-t from-background via-background/85 to-transparent" />
      </div>

      {/* Right Panel - Form */}
      <div className="flex flex-1 flex-col justify-center px-4 py-12 sm:px-6 lg:flex-none lg:px-20 xl:px-24">
        <div className="mx-auto w-full max-w-sm lg:w-96">
          <div className="mb-10">
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/5 p-3 shadow-sm ring-1 ring-inset ring-primary/10">
              <img src="/sams_logo.png" alt="Logo" className="h-full w-full object-contain" />
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-foreground">Welcome back</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Please sign in to your account to continue.
            </p>
          </div>

          <div className="space-y-6">
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">
                  Email or Username
                </Label>
                <Input
                  id="email"
                  type="text"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                  className="h-11 rounded-xl bg-muted/30 px-4 transition-all focus:bg-background focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-sm font-medium">
                    Password
                  </Label>
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11 rounded-xl bg-muted/30 px-4 pr-10 transition-all focus:bg-background focus:ring-2 focus:ring-primary/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-0 top-0 flex h-full w-10 items-center justify-center text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox id="remember" />
                <label
                  htmlFor="remember"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-muted-foreground"
                >
                  Remember me for 30 days
                </label>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="h-11 w-full text-base font-medium transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                {loading ? "Signing in..." : "Sign in"}
              </Button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-muted" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
              </div>
            </div>

            <Button
              variant="outline"
              type="button"
              onClick={() => navigate("/scan")}
              className="h-11 w-full border-muted bg-background hover:bg-muted/50"
            >
              <QrCode className="mr-2 h-4 w-4" />
              Scan QR Code
            </Button>
          </div>

          <p className="mt-10 text-center text-xs text-muted-foreground">
            © {currentYear} SAMS. All rights reserved.
          </p>
        </div>
      </div>

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
