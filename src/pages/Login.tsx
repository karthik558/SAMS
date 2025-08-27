import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { listUsers, type AppUser } from "@/services/users";
import { hasSupabaseEnv } from "@/lib/supabaseClient";
import { verifyCredentials } from "@/services/auth";

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
        const u = await verifyCredentials(email.trim(), password);
        if (!u) {
          toast({ title: "Invalid credentials", description: "Email or password is incorrect.", variant: "destructive" });
          return;
        }
        try {
          localStorage.setItem(CURRENT_USER_KEY, u.id);
          localStorage.setItem(AUTH_USER_KEY, JSON.stringify({ id: u.id, name: u.name, email: u.email, role: u.role }));
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
          localStorage.setItem(AUTH_USER_KEY, JSON.stringify({ id: user.id, name: user.name, email: user.email, role: user.role }));
        } catch {}
        toast({ title: "Welcome", description: user.name });
      }
      navigate("/", { replace: true });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm shadow-soft">
        <CardHeader className="space-y-4 text-center">
          <div className="flex items-center justify-center gap-2">
            <img src="/placeholder.svg" alt="Logo" className="h-8 w-8" />
            <CardTitle className="text-xl">Sign in to SAMS</CardTitle>
          </div>
          <p className="text-sm text-muted-foreground">Use your work email to continue</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">Email</label>
              <Input id="email" type="email" placeholder="abc@example.com" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">Password</label>
              <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
