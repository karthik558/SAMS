import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Bell, Shield, Save, Building2, Trash2, ToggleLeft, ToggleRight, Plus, Settings as SettingsIcon } from "lucide-react";
import QRCode from "qrcode";
import { hasSupabaseEnv } from "@/lib/supabaseClient";
import { getSystemSettings, updateSystemSettings, getUserSettings, upsertUserSettings } from "@/services/settings";
import { listUsers } from "@/services/users";
import { loginWithPassword, setUserPassword } from "@/services/auth";
import { listDepartments, createDepartment, updateDepartment, deleteDepartment, type Department } from "@/services/departments";
import { listMfaFactors, mfaActivateTotp, mfaEnrollTotp } from "@/services/auth";

export default function Settings() {
  const { toast } = useToast();
  const [darkMode, setDarkMode] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);

  // Demo current user id (wire to auth user/app user as needed)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);

  // Password change fields
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  // Departments state
  const [departments, setDepartments] = useState<Department[]>([]);
  const [newDeptName, setNewDeptName] = useState("");
  const [newDeptCode, setNewDeptCode] = useState("");
  const [role, setRole] = useState<string>("");

  // MFA state
  const [mfaEnrolled, setMfaEnrolled] = useState<boolean>(false);
  const [mfaEnrollUrl, setMfaEnrollUrl] = useState<string>("");
  const [mfaQrDataUrl, setMfaQrDataUrl] = useState<string>("");
  const [mfaFactorId, setMfaFactorId] = useState<string>("");
  const [mfaCode, setMfaCode] = useState<string>("");
  const [mfaLoading, setMfaLoading] = useState(false);

  // Load settings
  useEffect(() => {
    (async () => {
      // current user from auth storage
      try {
        const uid = localStorage.getItem("current_user_id");
        const authRaw = localStorage.getItem("auth_user");
        if (uid) setCurrentUserId(uid);
        if (authRaw) {
          const au = JSON.parse(authRaw) as { email?: string };
          setCurrentUserEmail(au?.email || null);
        }
      } catch {}

      // user settings
      try {
        if (hasSupabaseEnv) {
          if (currentUserId) {
            const us = await getUserSettings(currentUserId);
            setNotifications(us.notifications ?? true);
            setEmailNotifications(us.email_notifications ?? true);
            setDarkMode(us.dark_mode ?? false);
          }
        } else {
          const local = JSON.parse(localStorage.getItem("user_settings") || "{}");
          setNotifications(local.notifications ?? true);
          setEmailNotifications(local.email_notifications ?? true);
          setDarkMode(local.dark_mode ?? false);
        }
      } catch {}

      // role
      try {
        const authRaw = localStorage.getItem("auth_user");
        if (authRaw) {
          const au = JSON.parse(authRaw) as { role?: string };
          setRole((au.role || "").toLowerCase());
        }
      } catch {}

      // load departments
      try {
        // Only admins can manage/view Departments tab
        const authRaw = localStorage.getItem("auth_user");
        const au = authRaw ? JSON.parse(authRaw) as { role?: string } : ({} as any);
        const r = (au.role || "").toLowerCase();
        if (r === 'admin') {
          const deps = await listDepartments();
          setDepartments(deps);
        }
      } catch {}

      // check MFA enrollment status
      try {
        if (hasSupabaseEnv) {
          const f = await listMfaFactors();
          setMfaEnrolled((f.totp?.length || 0) > 0);
        }
      } catch {}
    })();
  }, [currentUserId]);

  const handleSave = async () => {
    try {
      // Only user settings persisted (system config removed from UI)
      if (hasSupabaseEnv) {
        if (currentUserId) {
          await upsertUserSettings(currentUserId, { notifications, email_notifications: emailNotifications, dark_mode: darkMode });
        }
      } else {
        localStorage.setItem("user_settings", JSON.stringify({ notifications, email_notifications: emailNotifications, dark_mode: darkMode }));
      }
      // apply theme preference globally
      try {
        const root = document.documentElement;
        if (darkMode) {
          root.classList.add("dark");
          localStorage.setItem("theme", "dark");
        } else {
          root.classList.remove("dark");
          localStorage.setItem("theme", "light");
        }
      } catch {}
      toast({ title: "Settings saved", description: "Your settings have been updated successfully." });
    } catch (e: any) {
      toast({ title: "Failed to save", description: e.message || String(e), variant: "destructive" });
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast({ title: "Missing fields", description: "Fill all password fields.", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords do not match", description: "New and confirm passwords must match.", variant: "destructive" });
      return;
    }
    try {
      if (hasSupabaseEnv) {
        if (!currentUserEmail || !currentUserId) {
          toast({ title: "Not signed in", description: "No current user found.", variant: "destructive" });
          return;
        }
  const valid = await loginWithPassword(currentUserEmail, currentPassword);
        if (!valid) {
          toast({ title: "Invalid current password", description: "Please check your current password.", variant: "destructive" });
          return;
        }
        await setUserPassword(currentUserId, newPassword);
      } else {
        // Local fallback using demo users store
        const rawUsers = localStorage.getItem("app_users_fallback");
        const list = rawUsers ? JSON.parse(rawUsers) as any[] : [];
        const uid = currentUserId || localStorage.getItem("current_user_id");
        const idx = list.findIndex(u => u.id === uid);
        if (idx === -1) {
          toast({ title: "Not signed in", description: "No current user found.", variant: "destructive" });
          return;
        }
        const stored = list[idx].password_hash as string | undefined;
        const computed = btoa(unescape(encodeURIComponent(currentPassword))).slice(0, 32);
        if (!stored || stored !== computed) {
          toast({ title: "Invalid current password", description: "Please check your current password.", variant: "destructive" });
          return;
        }
        // Update hash
        list[idx].password_hash = btoa(unescape(encodeURIComponent(newPassword))).slice(0, 32);
        localStorage.setItem("app_users_fallback", JSON.stringify(list));
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast({ title: "Password updated", description: "Your password has been changed." });
    } catch (e: any) {
      toast({ title: "Update failed", description: e?.message || String(e), variant: "destructive" });
    }
  };

  async function startTotpEnrollment() {
    try {
      setMfaLoading(true);
      const { factorId, otpauthUrl } = await mfaEnrollTotp();
      setMfaFactorId(factorId);
      // Rewrite otpauth URI to use a friendly issuer/label for authenticator apps
      const issuer = 'SAMS';
      const email = currentUserEmail || 'user';
      let friendly = otpauthUrl;
      try {
        const prefix = 'otpauth://totp/';
        if (otpauthUrl.startsWith(prefix)) {
          const rest = otpauthUrl.slice(prefix.length);
          const qIndex = rest.indexOf('?');
          const rawLabel = qIndex >= 0 ? rest.slice(0, qIndex) : rest;
          const query = qIndex >= 0 ? rest.slice(qIndex + 1) : '';
          const newLabel = encodeURIComponent(`${issuer}:${email}`);
          const params = new URLSearchParams(query);
          params.set('issuer', issuer);
          friendly = `${prefix}${newLabel}?${params.toString()}`;
        }
      } catch {}
      setMfaEnrollUrl(friendly);
      try {
        const dataUrl = await QRCode.toDataURL(friendly, { width: 192, margin: 1 });
        setMfaQrDataUrl(dataUrl);
      } catch {}
    } catch (e: any) {
      toast({ title: "Enrollment failed", description: e?.message || String(e), variant: "destructive" });
    } finally {
      setMfaLoading(false);
    }
  }

  async function activateTotp() {
    if (!mfaFactorId || !mfaCode) return;
    try {
      setMfaLoading(true);
      await mfaActivateTotp(mfaFactorId, mfaCode);
      setMfaEnrolled(true);
      setMfaEnrollUrl("");
  setMfaQrDataUrl("");
      setMfaFactorId("");
      setMfaCode("");
      toast({ title: "MFA enabled", description: "Authenticator app configured." });
    } catch (e: any) {
      toast({ title: "Verification failed", description: e?.message || String(e), variant: "destructive" });
    } finally {
      setMfaLoading(false);
    }
  }

  return (
  <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <SettingsIcon className="h-8 w-8" />
          Settings
        </h1>
        <p className="text-muted-foreground">
          Manage your SAMS preferences and system configuration
        </p>
      </div>

      <Tabs defaultValue="security" className="space-y-6">
        <TabsList className={`grid w-full ${role === 'admin' ? 'grid-cols-3' : 'grid-cols-2'}`}>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">Notifications</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">Security</span>
          </TabsTrigger>
          {role === 'admin' && (
            <TabsTrigger value="departments" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              <span className="hidden sm:inline">Departments</span>
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>
                Choose how you want to be notified about system activities
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <Label>Push Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive notifications in your browser
                  </p>
                </div>
                <Switch checked={notifications} onCheckedChange={setNotifications} />
              </div>

              <Separator />

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <Label>Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Get notified via email for important updates
                  </p>
                </div>
                <Switch checked={emailNotifications} onCheckedChange={setEmailNotifications} />
              </div>

              <Separator />

              <div className="space-y-4">
                <Label>Notification Types</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center space-x-2">
                    <Switch id="asset-expiry" defaultChecked />
                    <Label htmlFor="asset-expiry" className="text-sm">Asset Expiry Alerts</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch id="low-stock" defaultChecked />
                    <Label htmlFor="low-stock" className="text-sm">Low Stock Warnings</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch id="new-assets" />
                    <Label htmlFor="new-assets" className="text-sm">New Asset Additions</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch id="system-updates" defaultChecked />
                    <Label htmlFor="system-updates" className="text-sm">System Updates</Label>
                  </div>
                </div>
              </div>

              <Button onClick={handleSave} className="w-full md:w-auto">
                <Save className="h-4 w-4 mr-2" />
                Save Preferences
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Security Settings</CardTitle>
              <CardDescription>
                Manage your account security and access permissions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="current-password">Current Password</Label>
                  <Input id="current-password" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <Input id="new-password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm New Password</Label>
                  <Input id="confirm-password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <Button onClick={handleChangePassword} className="flex-1 sm:flex-none">
                  <Save className="h-4 w-4 mr-2" />
                  Update Password
                </Button>
              </div>

              <Separator />

              <div>
                <Label className="font-medium">Multi-Factor Authentication</Label>
                <p className="text-sm text-muted-foreground">
                  Add an extra layer of security to your account
                </p>
                <div className="flex items-center justify-between gap-2">
                  <Badge variant={mfaEnrolled ? "default" : "outline"} className="font-medium">
                    {mfaEnrolled ? "Enabled" : "Not Enrolled"}
                  </Badge>
                  {!mfaEnrolled && (
                    <Button onClick={startTotpEnrollment} disabled={mfaLoading} className="whitespace-nowrap">
                      <Plus className="h-4 w-4 mr-2" />
                      Enable MFA
                    </Button>
                  )}
                </div>

                {(!mfaEnrolled && (mfaEnrollUrl || mfaQrDataUrl)) && (
                  <div className="mt-4">
                    <Label className="font-medium">Authenticator App</Label>
                    <p className="text-sm text-muted-foreground">
                      Scan the QR code below with your authenticator app
                    </p>
                    <div className="flex items-center gap-4">
                      <img src={mfaQrDataUrl || mfaEnrollUrl} alt="QR Code" className="w-24 h-24" />
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Input placeholder="Enter code" value={mfaCode} onChange={(e) => setMfaCode(e.target.value)} />
                          <Button onClick={activateTotp} disabled={mfaLoading || mfaCode.trim().length !== 6}>
                            Verify & Enable
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
  {role === 'admin' && (
  <TabsContent value="departments" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Departments</CardTitle>
              <CardDescription>Manage departments used for routing approvals and user assignments</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <Input placeholder="Name (e.g., IT)" value={newDeptName} onChange={(e) => setNewDeptName(e.target.value)} />
                <Input placeholder="Code (optional)" value={newDeptCode} onChange={(e) => setNewDeptCode(e.target.value)} />
                <Button onClick={async () => {
                  const name = newDeptName.trim();
                  if (!name) { toast({ title: "Name required", variant: "destructive" }); return; }
                  try {
                    const created = await createDepartment({ name, code: newDeptCode.trim() || null });
                    setDepartments((s) => [created, ...s]);
                    setNewDeptName(""); setNewDeptCode("");
                    toast({ title: "Department added" });
                  } catch (e: any) {
                    toast({ title: "Add failed", description: e?.message || String(e), variant: "destructive" });
                  }
                }}>
                  <Plus className="h-4 w-4 mr-2" /> Add
                </Button>
              </div>
              <div className="border rounded divide-y">
                {departments.length ? departments.map((d) => (
                  <div key={d.id} className="flex items-center justify-between p-3">
                    <div>
                      <div className="font-medium">{d.name}</div>
                      <div className="text-xs text-muted-foreground">Code: {d.code || '-'} • {d.is_active ? 'Active' : 'Inactive'}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={async () => {
                        try {
                          const updated = await updateDepartment(d.id, { is_active: !d.is_active });
                          setDepartments((s) => s.map(x => x.id === d.id ? updated : x));
                        } catch {}
                      }}>
                        {d.is_active ? <ToggleRight className="h-4 w-4 mr-2" /> : <ToggleLeft className="h-4 w-4 mr-2" />} {d.is_active ? 'Active' : 'Inactive'}
                      </Button>
                      <Button variant="destructive" size="sm" onClick={async () => {
                        if (!confirm(`Delete ${d.name}?`)) return;
                        try { await deleteDepartment(d.id); setDepartments((s) => s.filter(x => x.id !== d.id)); } catch {}
                      }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )) : <div className="p-3 text-sm text-muted-foreground">No departments</div>}
              </div>
            </CardContent>
          </Card>
  </TabsContent>
  )}
      </Tabs>
    </div>
  );
}
