import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Star, Briefcase, TrendingUp } from "lucide-react";

export default function ProProfileEditor() {
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: profile, isLoading } = useQuery<any>({ queryKey: ["/api/pro/profile"] });

  const [form, setForm] = useState({
    businessName: "",
    yearsExperience: "",
    hourlyRate: "",
    bio: "",
  });

  // Pre-populate form when profile loads
  useEffect(() => {
    if (profile) {
      setForm({
        businessName: profile.businessName || "",
        yearsExperience: profile.yearsExperience != null ? String(profile.yearsExperience) : "",
        hourlyRate: profile.hourlyRate != null ? String(profile.hourlyRate) : "",
        bio: profile.bio || "",
      });
    }
  }, [profile]);

  const updateProfile = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", "/api/pro/profile", {
        businessName: form.businessName || null,
        yearsExperience: form.yearsExperience ? parseInt(form.yearsExperience) : null,
        hourlyRate: form.hourlyRate ? parseFloat(form.hourlyRate) : null,
        bio: form.bio || null,
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/pro/profile"] });
      refreshUser();
      toast({ title: "Profile updated", description: "Your changes have been saved." });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Also allow editing name/phone via PATCH /api/auth/profile
  const [nameForm, setNameForm] = useState({
    firstName: user?.firstName || "",
    lastName: user?.lastName || "",
    phone: (user as any)?.phone || "",
  });

  useEffect(() => {
    if (user) {
      setNameForm({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        phone: (user as any).phone || "",
      });
    }
  }, [user]);

  const updateName = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", "/api/auth/profile", nameForm);
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      refreshUser();
      toast({ title: "Personal info updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const initials = `${user?.firstName?.[0] || ""}${user?.lastName?.[0] || ""}`.toUpperCase();

  return (
    <DashboardLayout>
      <div className="p-6 max-w-2xl space-y-6">
        <h1 className="text-xl font-bold">My Profile</h1>

        {/* Header card */}
        <Card>
          <CardContent className="pt-4 pb-4 flex items-center gap-4">
            <Avatar className="w-14 h-14">
              <AvatarImage src={user?.avatarUrl} alt={user?.firstName} />
              <AvatarFallback className="text-lg">{initials}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold">{user?.firstName} {user?.lastName}</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
              {profile?.businessName && <Badge variant="outline" className="mt-1 text-xs">{profile.businessName}</Badge>}
            </div>
          </CardContent>
        </Card>

        {/* Personal info */}
        <Card>
          <CardHeader><CardTitle className="text-base">Personal Info</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>First name</Label>
                <Input value={nameForm.firstName} onChange={e => setNameForm(f => ({ ...f, firstName: e.target.value }))} data-testid="input-firstname" />
              </div>
              <div>
                <Label>Last name</Label>
                <Input value={nameForm.lastName} onChange={e => setNameForm(f => ({ ...f, lastName: e.target.value }))} data-testid="input-lastname" />
              </div>
            </div>
            <div>
              <Label>Phone number</Label>
              <Input type="tel" value={nameForm.phone} onChange={e => setNameForm(f => ({ ...f, phone: e.target.value }))} placeholder="+353 87 000 0000" data-testid="input-phone" />
            </div>
            <div>
              <Label>Email</Label>
              <Input value={user?.email || ""} disabled className="opacity-60 cursor-not-allowed" />
            </div>
            <Button onClick={() => updateName.mutate()} disabled={updateName.isPending} data-testid="button-save-personal">
              {updateName.isPending ? "Saving..." : "Save Personal Info"}
            </Button>
          </CardContent>
        </Card>

        {/* Business info */}
        <Card>
          <CardHeader><CardTitle className="text-base">Business Info</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="space-y-3">{[1,2,3].map(i=><div key={i} className="h-9 rounded bg-muted animate-pulse"/>)}</div>
            ) : (
              <>
                <div>
                  <Label>Business name</Label>
                  <Input
                    placeholder="e.g. Murphy Plumbing Services"
                    value={form.businessName}
                    onChange={e => setForm(f => ({ ...f, businessName: e.target.value }))}
                    data-testid="input-business-name"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Years experience</Label>
                    <Input
                      type="number" min="0" max="50"
                      placeholder="e.g. 8"
                      value={form.yearsExperience}
                      onChange={e => setForm(f => ({ ...f, yearsExperience: e.target.value }))}
                      data-testid="input-years-exp"
                    />
                  </div>
                  <div>
                    <Label>Hourly rate (€)</Label>
                    <Input
                      type="number" min="0"
                      placeholder="e.g. 65"
                      value={form.hourlyRate}
                      onChange={e => setForm(f => ({ ...f, hourlyRate: e.target.value }))}
                      data-testid="input-hourly-rate"
                    />
                  </div>
                </div>
                <div>
                  <Label>Bio</Label>
                  <Textarea
                    placeholder="Tell customers about your experience, certifications, and the type of work you specialize in..."
                    value={form.bio}
                    onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
                    rows={4}
                    data-testid="input-bio"
                  />
                </div>
                <Button onClick={() => updateProfile.mutate()} disabled={updateProfile.isPending} data-testid="button-save-business">
                  {updateProfile.isPending ? "Saving..." : "Save Business Info"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Stats */}
        {profile && (
          <Card>
            <CardHeader><CardTitle className="text-base">Performance Stats</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="space-y-1">
                  <div className="flex items-center justify-center gap-1">
                    <Star className="w-4 h-4 text-amber-400" />
                    <p className="text-2xl font-bold">{profile.ratingAvg ? Number(profile.ratingAvg).toFixed(1) : "–"}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">Avg rating</p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-center">
                    <p className="text-2xl font-bold">{profile.totalReviews ?? 0}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">Reviews</p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-center gap-1">
                    <TrendingUp className="w-4 h-4 text-primary" />
                    <p className="text-2xl font-bold">{profile.spinStreak ?? 0}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">Spin streak</p>
                </div>
              </div>
              <Separator className="my-4" />
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Credit balance</span>
                  <span className="font-bold text-primary">{user?.creditBalance ?? 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Lead streak</span>
                  <span className="font-bold">{profile.leadStreak ?? 0}</span>
                </div>
                {profile.isVerified && (
                  <div className="col-span-2">
                    <Badge className="gap-1 text-xs"><Briefcase className="w-3 h-3" /> Verified Professional</Badge>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
