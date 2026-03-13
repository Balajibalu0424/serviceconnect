import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

export default function ProProfileEditor() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: profile } = useQuery<any>({ queryKey: ["/api/pro/profile"] });
  const [form, setForm] = useState({ businessName: "", yearsExperience: "", hourlyRate: "", bio: "" });

  const updateProfile = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", "/api/pro/profile", {
        businessName: form.businessName || profile?.businessName,
        yearsExperience: form.yearsExperience ? parseInt(form.yearsExperience) : profile?.yearsExperience,
        hourlyRate: form.hourlyRate || profile?.hourlyRate,
        bio: form.bio
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/pro/profile"] });
      toast({ title: "Profile updated" });
    }
  });

  return (
    <DashboardLayout>
      <div className="p-6 max-w-2xl space-y-6">
        <h1 className="text-xl font-bold">My Profile</h1>
        <Card>
          <CardHeader><CardTitle className="text-base">Business Info</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Business name</Label>
              <Input placeholder={profile?.businessName || "Your business name"}
                value={form.businessName} onChange={e => setForm(f => ({...f, businessName: e.target.value}))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Years experience</Label>
                <Input type="number" placeholder={String(profile?.yearsExperience || "")}
                  value={form.yearsExperience} onChange={e => setForm(f => ({...f, yearsExperience: e.target.value}))} />
              </div>
              <div>
                <Label>Hourly rate (€)</Label>
                <Input type="number" placeholder={String(profile?.hourlyRate || "")}
                  value={form.hourlyRate} onChange={e => setForm(f => ({...f, hourlyRate: e.target.value}))} />
              </div>
            </div>
            <div>
              <Label>Bio</Label>
              <Textarea placeholder="Tell customers about your experience..."
                value={form.bio} onChange={e => setForm(f => ({...f, bio: e.target.value}))} rows={3} />
            </div>
            <Button onClick={() => updateProfile.mutate()} disabled={updateProfile.isPending}>
              {updateProfile.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </CardContent>
        </Card>
        {profile && (
          <Card>
            <CardHeader><CardTitle className="text-base">Stats</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-3 gap-4 text-center text-sm">
              <div><p className="text-2xl font-bold">{profile.ratingAvg || "–"}</p><p className="text-muted-foreground">Avg rating</p></div>
              <div><p className="text-2xl font-bold">{profile.totalReviews}</p><p className="text-muted-foreground">Reviews</p></div>
              <div><p className="text-2xl font-bold">{profile.spinStreak}</p><p className="text-muted-foreground">Spin streak</p></div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
