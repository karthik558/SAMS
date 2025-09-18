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
import { getUserPreferences, upsertUserPreferences, type UserPreferences } from "@/services/userPreferences";
import { listUsers } from "@/services/users";
import { loginWithPassword, setUserPassword } from "@/services/auth";
import { listDepartments, createDepartment, updateDepartment, deleteDepartment, type Department } from "@/services/departments";
import { listMfaFactors, mfaActivateTotp, mfaEnrollTotp, mfaChallenge, mfaVerify, mfaUnenrollTotp } from "@/services/auth";
import PageHeader from "@/components/layout/PageHeader";
// Audit controls have moved to the main Audit page
import Breadcrumbs from "@/components/layout/Breadcrumbs";

export default function Settings() {
  const { toast } = useToast();
  const [darkMode, setDarkMode] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);
  // Personalization preferences
  const [showNewsletter, setShowNewsletter] = useState(false);
  const [compactMode, setCompactMode] = useState(false);
  const [betaFeatures, setBetaFeatures] = useState(false);
  const [defaultLanding, setDefaultLanding] = useState<string>("");
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  // Initialize dark mode from existing theme preference immediately (before async load)
  useEffect(() => {
    try {
      const stored = localStorage.getItem('theme');
      if (stored === 'dark') setDarkMode(true);
    } catch {}
  }, []);

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
  // Audit controls moved to /audit

  // MFA state
  const [mfaEnrolled, setMfaEnrolled] = useState<boolean>(false);
  const [mfaEnrollUrl, setMfaEnrollUrl] = useState<string>("");
  const [mfaQrDataUrl, setMfaQrDataUrl] = useState<string>("");
  const [mfaFactorId, setMfaFactorId] = useState<string>("");
  const [mfaCode, setMfaCode] = useState<string>("");
  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaDisableOtp, setMfaDisableOtp] = useState<string>("");
  const [mfaDisableChallengeId, setMfaDisableChallengeId] = useState<string>("");

  const baseTabs = [
    { value: "notifications", label: "Notifications", icon: Bell },
    { value: "security", label: "Security", icon: Shield },
    { value: "personalization", label: "Personalization", icon: SettingsIcon },
  ];
  const tabItems = role === "admin"
    ? [...baseTabs, { value: "departments", label: "Departments", icon: Building2 }]
    : baseTabs;

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

      // load user personalization preferences
      try {
        if (currentUserId) {
          const p = await getUserPreferences(currentUserId);
          setShowNewsletter(!!p.show_newsletter);
          setCompactMode(!!p.compact_mode);
          setBetaFeatures(!!p.enable_beta_features);
          setDefaultLanding(p.default_landing_page || "");
        }
      } catch {}
      finally { setPrefsLoaded(true); }

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
          await upsertUserPreferences(currentUserId, { show_newsletter: showNewsletter, compact_mode: compactMode, enable_beta_features: betaFeatures, default_landing_page: defaultLanding || null });
        }
      } else {
        localStorage.setItem("user_settings", JSON.stringify({ notifications, email_notifications: emailNotifications, dark_mode: darkMode }));
        if (currentUserId) {
          try {
            const raw = JSON.parse(localStorage.getItem("user_pref_" + currentUserId) || "null");
            const merged = { ...(raw||{}), user_id: currentUserId, show_newsletter: showNewsletter, compact_mode: compactMode, enable_beta_features: betaFeatures, default_landing_page: defaultLanding || null };
            localStorage.setItem("user_pref_" + currentUserId, JSON.stringify(merged));
          } catch {}
        }
      }
      // apply theme preference globally ONLY if it changed to avoid accidental resets
      try {
        const root = document.documentElement;
        const currentlyDark = root.classList.contains('dark');
        if (darkMode !== currentlyDark) {
          if (darkMode) {
            root.classList.add('dark');
            localStorage.setItem('theme', 'dark');
          } else {
            root.classList.remove('dark');
            localStorage.setItem('theme', 'light');
          }
        }
        if (compactMode) root.classList.add('compact-ui'); else root.classList.remove('compact-ui');
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

  async function beginDisableMfa() {
    try {
      setMfaLoading(true);
      // list factors to get the current totp factor id
      const f = await listMfaFactors();
      const fid = f.totp[0]?.id;
      if (!fid) {
        toast({ title: "No MFA found", description: "There's no authenticator configured.", variant: "destructive" });
        return;
      }
      // Start a challenge to verify ownership before disabling
      const ch = await mfaChallenge(fid);
      setMfaFactorId(fid);
      setMfaDisableChallengeId(ch.challengeId);
      setMfaDisableOtp("");
      toast({ title: "Enter code to disable", description: "Enter a 6-digit code from your authenticator to disable MFA." });
    } catch (e: any) {
      toast({ title: "Cannot start disable flow", description: e?.message || String(e), variant: "destructive" });
    } finally {
      setMfaLoading(false);
    }
  }

  async function confirmDisableMfa() {
    if (!mfaFactorId) return;
    try {
      setMfaLoading(true);
      // If we have an active challenge and code, verify first
      if (mfaDisableChallengeId && mfaDisableOtp.trim().length === 6) {
        await mfaVerify(mfaFactorId, mfaDisableChallengeId, mfaDisableOtp.trim(), currentUserEmail || "");
      }
      await mfaUnenrollTotp(mfaFactorId);
      setMfaEnrolled(false);
      setMfaDisableChallengeId("");
      setMfaDisableOtp("");
      setMfaFactorId("");
      toast({ title: "MFA disabled", description: "Authenticator app unenrolled." });
    } catch (e: any) {
      toast({ title: "Disable failed", description: e?.message || String(e), variant: "destructive" });
    } finally {
      setMfaLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Dashboard", to: "/" }, { label: "Settings" }]} />
      <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm sm:p-8">
        <PageHeader
          icon={SettingsIcon}
          title="Settings"
          description="Manage your SAMS preferences and system configuration"
        />
      </div>
      <Tabs defaultValue="security" className="space-y-6">
        <TabsList className="flex w-full flex-wrap items-stretch gap-2 rounded-md bg-muted/50 p-1 backdrop-blur supports-[backdrop-filter]:bg-muted/60 sm:flex-nowrap">
          {tabItems.map(({ value, label, icon: Icon }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="flex flex-1 min-w-[3.25rem] items-center justify-center gap-2 rounded-md px-3 py-2 text-sm sm:min-w-[3.5rem] sm:px-3 lg:flex-none lg:min-w-0 lg:justify-start lg:px-4"
              title={label}
              aria-label={label}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="sr-only lg:not-sr-only">{label}</span>
            </TabsTrigger>
          ))}
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
                  {!mfaEnrolled ? (
                    <Button onClick={startTotpEnrollment} disabled={mfaLoading} className="whitespace-nowrap">
                      <Plus className="h-4 w-4 mr-2" />
                      Enable MFA
                    </Button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Button variant="destructive" onClick={beginDisableMfa} disabled={mfaLoading} className="whitespace-nowrap">
                        Disable MFA
                      </Button>
                    </div>
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

                {mfaEnrolled && mfaDisableChallengeId && (
                  <div className="mt-4">
                    <Label className="font-medium">Confirm Disable</Label>
                    <p className="text-sm text-muted-foreground">Enter a 6-digit code from your authenticator to confirm disabling MFA.</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Input placeholder="000000" inputMode="numeric" pattern="[0-9]*" maxLength={6} value={mfaDisableOtp} onChange={(e) => setMfaDisableOtp(e.target.value.replace(/\D/g, '').slice(0,6))} />
                      <Button variant="destructive" onClick={confirmDisableMfa} disabled={mfaLoading || mfaDisableOtp.length !== 6}>Confirm</Button>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="personalization" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Personalization</CardTitle>
              <CardDescription>Customize UI features and defaults just for you</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {!prefsLoaded && <div className="text-sm text-muted-foreground">Loading preferences...</div>}
              {prefsLoaded && (
                <>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <Label>Show Newsletter Menu</Label>
                      <p className="text-sm text-muted-foreground">Adds the status & updates feed to your sidebar</p>
                    </div>
                    <Switch checked={showNewsletter} onCheckedChange={setShowNewsletter} />
                  </div>
                  <Separator />
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <Label>Compact Mode</Label>
                      <p className="text-sm text-muted-foreground">Use denser spacing for tables and navigation</p>
                    </div>
                    <Switch checked={compactMode} onCheckedChange={setCompactMode} />
                  </div>
                  <Separator />
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <Label>Beta Features</Label>
                      <p className="text-sm text-muted-foreground">Enable early experimental UI components</p>
                    </div>
                    <Switch checked={betaFeatures} onCheckedChange={setBetaFeatures} />
                  </div>
                  <Separator />
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <Label>Dark Mode</Label>
                      <p className="text-sm text-muted-foreground">Toggle dark theme appearance</p>
                    </div>
                    <Switch checked={darkMode} onCheckedChange={setDarkMode} />
                  </div>
                  <Separator />
                  <div className="flex flex-col gap-2">
                    <div className="space-y-1">
                      <Label htmlFor="default-landing">Default Landing Page</Label>
                      <p className="text-sm text-muted-foreground">Choose where the app sends you after login</p>
                    </div>
                    <select id="default-landing" value={defaultLanding} onChange={(e) => setDefaultLanding(e.target.value)} className="h-9 w-full rounded border border-border/60 bg-background px-2 text-sm">
                      <option value="">System Default (Dashboard)</option>
                      <option value="/assets">Assets</option>
                      <option value="/properties">Properties</option>
                      <option value="/approvals">Approvals</option>
                      <option value="/tickets">Tickets</option>
                      <option value="/reports">Reports</option>
                      <option value="/newsletter">Newsletter</option>
                      <option value="/settings">Settings</option>
                    </select>
                    <p className="text-xs text-muted-foreground">This will take effect on your next login.</p>
                  </div>
                  <Button onClick={handleSave} className="w-full md:w-auto">
                    <Save className="h-4 w-4 mr-2" />
                    Save Personalization
                  </Button>
                </>
              )}
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
                    <div key={d.id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="font-medium">{d.name}</div>
                        <div className="text-xs text-muted-foreground">Code: {d.code || '-'} • {d.is_active ? 'Active' : 'Inactive'}</div>
                      </div>
                      <div className="flex items-center gap-2 self-end sm:self-auto">
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
