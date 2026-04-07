import { useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { User, Lock, Phone, Mail, Camera } from "lucide-react";

export default function Settings() {
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Profile state
  const [firstName, setFirstName] = useState(user?.firstName || "");
  const [lastName, setLastName] = useState(user?.lastName || "");
  const [phone, setPhone] = useState((user as any)?.phone || "");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || "");
  const [profileLoading, setProfileLoading] = useState(false);

  // Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwLoading, setPwLoading] = useState(false);

  const initials = `${user?.firstName?.[0] || ""}${user?.lastName?.[0] || ""}`.toUpperCase();

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setAvatarUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  const isCustomer = user?.role === "CUSTOMER";

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileLoading(true);
    try {
      const payload: Record<string, unknown> = {
        phone,
        avatarUrl: avatarUrl || undefined,
      };
      // Professionals can edit their name; customers cannot (server enforces this too)
      if (!isCustomer) {
        payload.firstName = firstName;
        payload.lastName = lastName;
      }
      const res = await apiRequest("PATCH", "/api/auth/profile", payload);
      if (!res.ok) throw new Error((await res.json()).error);
      await refreshUser();
      toast({ title: "Profile updated", description: "Your changes have been saved." });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setProfileLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    if (newPassword.length < 8) {
      toast({ title: "Password must be at least 8 characters", variant: "destructive" });
      return;
    }
    setPwLoading(true);
    try {
      const res = await apiRequest("POST", "/api/auth/change-password", { currentPassword, newPassword });
      if (!res.ok) throw new Error((await res.json()).error);
      toast({ title: "Password updated", description: "Your new password is active." });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setPwLoading(false); }
  };

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-heading font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300">Account Settings</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage your profile, password, and preferences</p>
          </div>
          <Badge variant="outline" className="capitalize bg-white/50 dark:bg-black/50 backdrop-blur shadow-sm px-3 py-1 text-sm border-white/40 dark:border-white/10">{user?.role?.toLowerCase()}</Badge>
        </div>

        {/* Profile Edit */}
        <Card className="bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-2xl shadow-sm overflow-hidden">
          <CardHeader className="bg-muted/10 border-b border-border/40 pb-4">
            <CardTitle className="text-base font-heading font-semibold text-foreground/80 flex items-center gap-2">
              <User className="w-4 h-4 text-primary/70" /> Profile Information
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleProfileSave} className="space-y-5">
              {/* Avatar */}
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Avatar className="w-16 h-16">
                    <AvatarImage src={avatarUrl} alt={user?.firstName} />
                    <AvatarFallback className="text-lg">{initials}</AvatarFallback>
                  </Avatar>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute -bottom-1 -right-1 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center hover:bg-primary/90 transition-colors"
                    data-testid="button-change-avatar"
                  >
                    <Camera className="w-3 h-3" />
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarChange}
                    data-testid="input-avatar-file"
                  />
                </div>
                <div>
                  <p className="font-medium">{user?.firstName} {user?.lastName}</p>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Mail className="w-3 h-3" />{user?.email}
                  </p>
                </div>
              </div>

              <Separator />

              {isCustomer ? (
                <div className="space-y-1.5">
                  <Label>Full name</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="px-3 py-2 rounded-md border bg-gray-50 dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300 select-none">
                      {user?.firstName}
                    </div>
                    <div className="px-3 py-2 rounded-md border bg-gray-50 dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300 select-none">
                      {user?.lastName}
                    </div>
                  </div>
                  <p className="text-xs text-gray-400">
                    Your name cannot be changed after registration. Contact support if a correction is needed.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="firstName">First name</Label>
                    <Input
                      id="firstName"
                      value={firstName}
                      onChange={e => setFirstName(e.target.value)}
                      placeholder="First name"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="lastName">Last name</Label>
                    <Input
                      id="lastName"
                      value={lastName}
                      onChange={e => setLastName(e.target.value)}
                      placeholder="Last name"
                      required
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <Label htmlFor="phone">
                  <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> Phone number</span>
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+353 87 000 0000"
                  data-testid="input-phone"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={user?.email || ""}
                  disabled
                  className="opacity-60 cursor-not-allowed"
                  data-testid="input-email"
                />
                <p className="text-xs text-muted-foreground">Email cannot be changed.</p>
              </div>

              <Button type="submit" disabled={profileLoading} className="rounded-xl px-6 h-11 w-full sm:w-auto shadow-[0_4px_14px_0_rgba(var(--primary),0.39)] hover:shadow-[0_6px_20px_rgba(var(--primary),0.23)] hover:-translate-y-0.5 transition-all" data-testid="button-save-profile">
                {profileLoading ? "Saving..." : "Save changes"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Change Password */}
        <Card className="bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-2xl shadow-sm overflow-hidden">
          <CardHeader className="bg-muted/10 border-b border-border/40 pb-4">
            <CardTitle className="text-base font-heading font-semibold text-foreground/80 flex items-center gap-2">
              <Lock className="w-4 h-4 text-primary/70" /> Security
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="currentPassword">Current password</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  required
                  data-testid="input-current-password"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="newPassword">New password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  minLength={8}
                  required
                  data-testid="input-new-password"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="confirmPassword">Confirm new password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  minLength={8}
                  required
                  data-testid="input-confirm-password"
                />
              </div>
              <Button type="submit" variant="outline" disabled={pwLoading} className="rounded-xl px-6 h-11 w-full sm:w-auto hover:bg-primary/5 hover:text-primary transition-colors" data-testid="button-update-password">
                {pwLoading ? "Updating..." : "Update password"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Account Info */}
        <Card className="bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-2xl shadow-sm overflow-hidden">
          <CardHeader className="bg-muted/10 border-b border-border/40 pb-4">
            <CardTitle className="text-base font-heading font-semibold text-foreground/80">System Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm pt-6">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Account ID</span>
              <span className="font-mono text-xs">{user?.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Role</span>
              <Badge variant="secondary" className="capitalize">{user?.role?.toLowerCase()}</Badge>
            </div>
            {(user as any)?.creditBalance !== undefined && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Credit balance</span>
                <span className="font-semibold text-primary">{(user as any).creditBalance} credits</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
