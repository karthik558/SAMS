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
import { Bell, Shield, Save } from "lucide-react";
import { hasSupabaseEnv } from "@/lib/supabaseClient";
import { getSystemSettings, updateSystemSettings, getUserSettings, upsertUserSettings } from "@/services/settings";
import { listUsers } from "@/services/users";
import { verifyCredentials, setUserPassword } from "@/services/auth";

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
        const valid = await verifyCredentials(currentUserEmail, currentPassword);
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

  return (
  <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your SAMS preferences and system configuration
        </p>
      </div>

      <Tabs defaultValue="security" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">Notifications</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">Security</span>
          </TabsTrigger>
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
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}