import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Bell, Shield, Save, Settings as SettingsIcon } from "lucide-react";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { hasSupabaseEnv } from "@/lib/supabaseClient";
import { getUserSettings, upsertUserSettings } from "@/services/settings";
import { getUserPreferences, peekCachedUserPreferences, upsertUserPreferences } from "@/services/userPreferences";
import { refreshSoundPreference } from "@/lib/sound";
import { changeOwnPassword } from "@/services/auth";
import PageHeader from "@/components/layout/PageHeader";
// Audit controls have moved to the main Audit page
import Breadcrumbs from "@/components/layout/Breadcrumbs";

export default function Settings() {
  const { toast } = useToast();
  const cachedPrefs = useMemo(() => {
    try {
      const uid = localStorage.getItem("current_user_id");
      return peekCachedUserPreferences(uid);
    } catch {
      return null;
    }
  }, []);
  const [darkMode, setDarkMode] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);
  // Personalization preferences
  const [showNewsletter, setShowNewsletter] = useState(() => Boolean(cachedPrefs?.show_newsletter));
  const [compactMode, setCompactMode] = useState(() => Boolean(cachedPrefs?.compact_mode)); // legacy
  const [betaFeatures, setBetaFeatures] = useState(() => Boolean(cachedPrefs?.enable_beta_features));
  const [defaultLanding, setDefaultLanding] = useState<string>(() => cachedPrefs?.default_landing_page || "");
  // New personalization fields
  const [density, setDensity] = useState<'comfortable'|'compact'|'ultra'>(() => {
    if (cachedPrefs?.density) return cachedPrefs.density;
    return cachedPrefs?.compact_mode ? 'compact' : 'comfortable';
  });
  const [autoTheme, setAutoTheme] = useState(() => Boolean(cachedPrefs?.auto_theme));
  const [enableSounds, setEnableSounds] = useState(() => (typeof cachedPrefs?.enable_sounds === 'boolean' ? Boolean(cachedPrefs?.enable_sounds) : true));
  const [sidebarCollapsedPref, setSidebarCollapsedPref] = useState(() => Boolean(cachedPrefs?.sidebar_collapsed));
  const [showAnnouncements, setShowAnnouncements] = useState(() => cachedPrefs?.show_announcements !== false);
  const [stickyHeader, setStickyHeader] = useState(() => Boolean(cachedPrefs?.sticky_header));
  const [topNavMode, setTopNavMode] = useState(() => Boolean(cachedPrefs?.top_nav_mode));
  const [showHelpCenter, setShowHelpCenter] = useState(() => cachedPrefs?.show_help_center !== false);
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
  const [role, setRole] = useState<string>("");
  // Audit controls moved to /audit


  const baseTabs = [
    { value: "notifications", label: "Notifications", icon: Bell },
    { value: "security", label: "Security", icon: Shield },
    { value: "personalization", label: "Personalization", icon: SettingsIcon },
  ];
  const tabItems = baseTabs;

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
          if (p.density) setDensity(p.density);
          if (typeof p.auto_theme === 'boolean') setAutoTheme(p.auto_theme);
          if (typeof p.enable_sounds === 'boolean') setEnableSounds(p.enable_sounds);
          if (typeof p.sidebar_collapsed === 'boolean') setSidebarCollapsedPref(p.sidebar_collapsed);
          if (typeof p.show_announcements === 'boolean') setShowAnnouncements(p.show_announcements);
          if (typeof p.sticky_header === 'boolean') setStickyHeader(p.sticky_header);
          if (typeof p.top_nav_mode === 'boolean') setTopNavMode(p.top_nav_mode);
          if (typeof p.show_help_center === 'boolean') setShowHelpCenter(p.show_help_center);
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

      // departments management moved to Users page

      // MFA status check not implemented in this app currently.
    })();
  }, [currentUserId]);

  const handleSave = async () => {
    try {
      // Validate default landing page against whitelist
  const allowedLanding = new Set(["/","/assets","/properties","/tickets","/reports","/newsletter","/settings","/approvals"]);
      let landingToSave: string | null = (defaultLanding || "") || null;
      if (landingToSave && !allowedLanding.has(landingToSave)) {
        landingToSave = null; // coerce invalid to null (system default)
      }
      // Gate approvals landing if user lacks role
      if (landingToSave === "/approvals") {
        try {
          const raw = localStorage.getItem('auth_user');
          const r = raw ? (JSON.parse(raw).role || '').toLowerCase() : '';
          if (!['admin','manager'].includes(r)) landingToSave = null;
        } catch {}
      }
      // Only user settings persisted (system config removed from UI)
      if (hasSupabaseEnv) {
        if (currentUserId) {
          await upsertUserSettings(currentUserId, { notifications, email_notifications: emailNotifications, dark_mode: darkMode });
          await upsertUserPreferences(currentUserId, {
            show_newsletter: showNewsletter,
            compact_mode: density === 'compact' || density === 'ultra' ? true : compactMode,
            enable_beta_features: betaFeatures,
            default_landing_page: landingToSave,
            density,
            auto_theme: autoTheme,
            enable_sounds: enableSounds,
            sidebar_collapsed: sidebarCollapsedPref,
            show_announcements: showAnnouncements,
            sticky_header: stickyHeader,
            top_nav_mode: topNavMode,
            show_help_center: showHelpCenter,
          });
        }
      } else {
        localStorage.setItem("user_settings", JSON.stringify({ notifications, email_notifications: emailNotifications, dark_mode: darkMode }));
        if (currentUserId) {
          try {
            const raw = JSON.parse(localStorage.getItem("user_pref_" + currentUserId) || "null");
            const merged = { ...(raw||{}), user_id: currentUserId, show_newsletter: showNewsletter, show_help_center: showHelpCenter, compact_mode: (density === 'compact' || density==='ultra') ? true : compactMode, enable_beta_features: betaFeatures, default_landing_page: landingToSave, density, auto_theme: autoTheme, enable_sounds: enableSounds, sidebar_collapsed: sidebarCollapsedPref, show_announcements: showAnnouncements, sticky_header: stickyHeader, top_nav_mode: topNavMode };
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
        // Density classes
        try {
          root.classList.remove('compact-ui');
          root.classList.remove('ultra-ui');
          if (density === 'compact') root.classList.add('compact-ui');
          else if (density === 'ultra') { root.classList.add('compact-ui'); root.classList.add('ultra-ui'); }
        } catch {}
      } catch {}
  try { refreshSoundPreference(); } catch {}
  // Broadcast preference delta for live layout adjustments (same-tab + cross-tab)
  try {
    const patch = {
      top_nav_mode: topNavMode,
      sticky_header: stickyHeader,
      auto_theme: autoTheme,
      density,
      show_newsletter: showNewsletter,
      show_help_center: showHelpCenter,
      show_announcements: showAnnouncements,
      sidebar_collapsed: sidebarCollapsedPref,
      enable_sounds: enableSounds,
    };
    // Cross-tab broadcast
    localStorage.setItem('user_preferences_patch', JSON.stringify(patch));
    // Same-tab broadcast
    try { window.dispatchEvent(new CustomEvent('user-preferences-changed', { detail: patch })); } catch {}
  } catch {}
  // Success toast removed per request
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
      const uid = currentUserId || localStorage.getItem("current_user_id");
      let emailForValidation = currentUserEmail;
      if (!emailForValidation) {
        try {
          const raw = localStorage.getItem("auth_user");
          if (raw) {
            const parsed = JSON.parse(raw) as { email?: string };
            emailForValidation = parsed?.email || null;
          }
        } catch {}
      }
      if (!uid || !emailForValidation) {
        toast({ title: "Not signed in", description: "No current user found.", variant: "destructive" });
        return;
      }
      // Use secure RPC to change own password server-side (validates current password)
      await changeOwnPassword(emailForValidation, currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast({ title: "Password updated", description: "Your password has been changed." });
    } catch (e: any) {
      toast({ title: "Update failed", description: e?.message || String(e), variant: "destructive" });
    }
  };

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
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <Label>Push Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive notifications in your browser
                  </p>
                </div>
                <Switch checked={notifications} onCheckedChange={setNotifications} />
              </div>

              <Separator />

              <div className="flex items-center justify-between gap-4">
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
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <Label>Show Newsletter Menu</Label>
                      <p className="text-sm text-muted-foreground">Adds the status & updates feed to your sidebar</p>
                    </div>
                    <Switch checked={showNewsletter} onCheckedChange={setShowNewsletter} />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <Label>Show Help Center</Label>
                      <p className="text-sm text-muted-foreground">Keep the Help Center entry visible in your navigation</p>
                    </div>
                    <Switch checked={showHelpCenter} onCheckedChange={setShowHelpCenter} />
                  </div>
                  <Separator />
                  <div className="flex flex-col gap-3">
                    <div className="space-y-1">
                      <Label>Interface Density</Label>
                      <p className="text-sm text-muted-foreground">Adjust spacing scale across UI components</p>
                    </div>
                    <Select value={density} onValueChange={(v) => setDensity(v as any)}>
                      <SelectTrigger className="h-10 w-full md:w-72"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="comfortable">Comfortable</SelectItem>
                        <SelectItem value="compact">Compact</SelectItem>
                        <SelectItem value="ultra">Ultra Dense</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <Label>Beta Features</Label>
                      <p className="text-sm text-muted-foreground">Enable early experimental UI components</p>
                    </div>
                    <Switch checked={betaFeatures} onCheckedChange={setBetaFeatures} />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <Label>Notification Sounds</Label>
                      <p className="text-sm text-muted-foreground">Play a sound for new notifications</p>
                    </div>
                    <Switch checked={enableSounds} onCheckedChange={setEnableSounds} />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <Label>Sidebar Collapsed</Label>
                      <p className="text-sm text-muted-foreground">Start with sidebar collapsed on desktop</p>
                    </div>
                    <Switch checked={sidebarCollapsedPref} onCheckedChange={setSidebarCollapsedPref} />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <Label>Show Announcements</Label>
                      <p className="text-sm text-muted-foreground">Display the announcements panel on dashboard</p>
                    </div>
                    <Switch checked={showAnnouncements} onCheckedChange={setShowAnnouncements} />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <Label>Sticky Header</Label>
                      <p className="text-sm text-muted-foreground">Keep top navigation visible while scrolling</p>
                    </div>
                    <Switch checked={stickyHeader} onCheckedChange={setStickyHeader} />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <Label>Top Navigation Layout</Label>
                      <p className="text-sm text-muted-foreground">Use a horizontal top bar instead of sidebar navigation</p>
                    </div>
                    <Switch checked={topNavMode} onCheckedChange={setTopNavMode} />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <Label>Dark Mode</Label>
                      <p className="text-sm text-muted-foreground">Toggle dark theme appearance</p>
                    </div>
                    <Switch checked={darkMode} disabled={autoTheme} onCheckedChange={setDarkMode} />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <Label>Auto Theme</Label>
                      <p className="text-sm text-muted-foreground">Follow system light/dark preference automatically</p>
                    </div>
                    <Switch checked={autoTheme} onCheckedChange={setAutoTheme} />
                  </div>
                  <Separator />
                  <div className="flex flex-col gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="default-landing">Default Landing Page</Label>
                      <p className="text-sm text-muted-foreground">Choose where the app sends you after login</p>
                    </div>
                    {(() => {
                      try {
                        const authRaw = (() => { try { return localStorage.getItem('auth_user'); } catch { return null; } })();
                        const r = authRaw ? ((): string => { try { return (JSON.parse(authRaw).role || '').toLowerCase(); } catch { return ''; } })() : '';
                        const canSeeApprovals = ['admin','manager'].includes(r);
                        return (
                          <Select value={defaultLanding || undefined} onValueChange={(v) => setDefaultLanding(v)}>
                            <SelectTrigger id="default-landing" className="h-11 w-full rounded-lg font-medium">
                              <SelectValue placeholder="System Default (Dashboard)" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="/">Dashboard</SelectItem>
                              <SelectItem value="/assets">Assets</SelectItem>
                              <SelectItem value="/properties">Properties</SelectItem>
                              {canSeeApprovals && <SelectItem value="/approvals">Approvals</SelectItem>}
                              <SelectItem value="/tickets">Tickets</SelectItem>
                              <SelectItem value="/reports">Reports</SelectItem>
                              <SelectItem value="/newsletter">Newsletter</SelectItem>
                              <SelectItem value="/settings">Settings</SelectItem>
                            </SelectContent>
                          </Select>
                        );
                      } catch (e) {
                        return (
                          <div className="rounded-md border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
                            Unable to render selector.
                          </div>
                        );
                      }
                    })()}
                    <p className="text-xs text-muted-foreground">This will take effect on your next login.</p>
                  </div>
                  <Button
                    onClick={handleSave}
                    className="relative w-full overflow-hidden rounded-lg bg-gradient-to-r from-primary via-primary/90 to-primary/80 px-6 py-5 text-sm font-semibold shadow-md transition hover:from-primary/90 hover:via-primary hover:to-primary/90 focus-visible:ring-2 focus-visible:ring-primary/50 md:w-auto"
                  >
                    <span className="relative z-10 flex items-center">
                      <Save className="h-4 w-4 mr-2" />
                      Save Personalization
                    </span>
                    <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent opacity-0 animate-[shine_1.8s_ease_infinite] [animation-delay:400ms] group-hover:opacity-60" />
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Departments management has moved to Users page. */}
      </Tabs>
    </div>
  );
}
