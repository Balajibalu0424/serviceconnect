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
import { Star, Briefcase, TrendingUp, CheckCircle2, Wrench, ExternalLink, MapPin } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ReviewReplyForm } from "@/components/reviews/ReviewReplyForm";
import { ProfileCompleteness } from "@/components/pro/ProfileCompleteness";
import { formatFileSize, uploadAsset } from "@/lib/uploads";
import type { UploadedAsset } from "@shared/uploads";

function parseServiceAreas(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function ProProfileEditor() {
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: profile, isLoading } = useQuery<any>({ queryKey: ["/api/pro/profile"] });
  const { data: myReviews = [], refetch: refetchReviews } = useQuery<any[]>({ queryKey: ["/api/reviews"] });
  const { data: allCategories = [], isLoading: loadingCategories } = useQuery<any[]>({ queryKey: ["/api/categories"] });

  const [form, setForm] = useState({
    businessName: "",
    yearsExperience: "",
    hourlyRate: "",
    bio: "",
    website: "",
    serviceAreas: "",
    credentials: "",
    radiusKm: "25",
    lat: "",
    lng: "",
  });
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [portfolioItems, setPortfolioItems] = useState<Array<UploadedAsset & { caption?: string | null }>>([]);
  const [uploadingPortfolio, setUploadingPortfolio] = useState(false);

  // Pre-populate form when profile loads
  useEffect(() => {
    if (profile) {
      setForm({
        businessName: profile.businessName || "",
        yearsExperience: profile.yearsExperience != null ? String(profile.yearsExperience) : "",
        hourlyRate: profile.hourlyRate != null ? String(profile.hourlyRate) : "",
        bio: profile.bio || user?.bio || "",
        website: profile.website || "",
        serviceAreas: Array.isArray(profile.serviceAreas) ? profile.serviceAreas.join(", ") : profile.serviceAreas || "",
        credentials: profile.credentials || "",
        radiusKm: profile.radiusKm != null ? String(profile.radiusKm) : "25",
        lat: profile.lat || "",
        lng: profile.lng || "",
      });
      // Pre-populate selected categories (stored as UUID array)
      setSelectedCategories(profile.serviceCategories || []);
      setPortfolioItems(
        Array.isArray(profile.portfolio)
          ? profile.portfolio.map((item: any, index: number) => ({
              id: item.id || item.url || `legacy-${index}`,
              purpose: "PORTFOLIO_IMAGE" as const,
              url: item.url,
              originalName: item.originalName || item.caption || `Portfolio image ${index + 1}`,
              mimeType: item.mimeType || "image/*",
              sizeBytes: item.sizeBytes || 0,
              createdAt: item.createdAt,
              caption: item.caption || null,
            }))
          : [],
      );
    }
  }, [profile, user?.bio]);

  const handlePortfolioUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    const availableSlots = Math.max(0, 6 - portfolioItems.length);
    const nextFiles = Array.from(files).slice(0, availableSlots);
    if (nextFiles.length === 0) {
      toast({ title: "Portfolio limit reached", description: "You can upload up to 6 portfolio images.", variant: "destructive" });
      return;
    }

    setUploadingPortfolio(true);
    try {
      const uploaded = await Promise.all(
        nextFiles.map((file) => uploadAsset("portfolio-image", file, { entityType: "professional_portfolio" })),
      );
      setPortfolioItems((prev) => [...prev, ...uploaded].slice(0, 6));
      toast({ title: "Portfolio updated", description: `${uploaded.length} image${uploaded.length === 1 ? "" : "s"} uploaded.` });
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploadingPortfolio(false);
    }
  };

  const updateProfile = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", "/api/pro/profile", {
        businessName: form.businessName || null,
        yearsExperience: form.yearsExperience ? parseInt(form.yearsExperience) : null,
        hourlyRate: form.hourlyRate ? parseFloat(form.hourlyRate) : null,
        bio: form.bio || null,
        website: form.website || null,
        serviceAreas: parseServiceAreas(form.serviceAreas),
        serviceCategories: selectedCategories,
        credentials: form.credentials || null,
        radiusKm: form.radiusKm ? parseInt(form.radiusKm) : 25,
        lat: form.lat ? parseFloat(form.lat) : null,
        lng: form.lng ? parseFloat(form.lng) : null,
        portfolio: portfolioItems.map((item) => ({
          id: item.id.startsWith("legacy-") ? undefined : item.id,
          url: item.url,
          caption: item.caption || null,
        })),
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
  const completenessUser = {
    avatarUrl: user?.avatarUrl,
    bio: form.bio,
  };
  const completenessProfile = {
    ...profile,
    businessName: form.businessName || null,
    yearsExperience: form.yearsExperience ? parseInt(form.yearsExperience, 10) : null,
    website: form.website || null,
    serviceCategories: selectedCategories,
    serviceAreas: parseServiceAreas(form.serviceAreas),
    credentials: form.credentials || null,
    lat: form.lat || null,
    lng: form.lng || null,
    portfolio: portfolioItems,
    verificationStatus: profile?.verificationStatus || null,
  };

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-heading font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300">My Profile</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your professional presence and details</p>
        </div>

        {profile && user && (
          <ProfileCompleteness user={completenessUser} profile={completenessProfile} />
        )}

        {/* Header card */}
        <Card className="bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-2xl shadow-sm overflow-hidden">
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
        <Card className="bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-2xl shadow-sm overflow-hidden">
          <CardHeader className="bg-muted/10 border-b border-border/40 pb-4">
            <CardTitle className="text-base font-heading font-semibold text-foreground/80">Personal Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 pt-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              <Label>Phone number *</Label>
              <Input type="tel" required value={nameForm.phone} onChange={e => setNameForm(f => ({ ...f, phone: e.target.value }))} placeholder="+353 87 000 0000" data-testid="input-phone" />
            </div>
            <div>
              <Label>Email</Label>
              <Input value={user?.email || ""} disabled className="opacity-60 cursor-not-allowed" />
            </div>
            <Button onClick={() => updateName.mutate()} disabled={updateName.isPending} className="rounded-xl px-6 h-11 w-full sm:w-auto shadow-[0_4px_14px_0_rgba(var(--primary),0.39)] hover:shadow-[0_6px_20px_rgba(var(--primary),0.23)] hover:-translate-y-0.5 transition-all" data-testid="button-save-personal">
              {updateName.isPending ? "Saving..." : "Save Personal Info"}
            </Button>
          </CardContent>
        </Card>

        {/* Business info */}
        <Card className="bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-2xl shadow-sm overflow-hidden">
          <CardHeader className="bg-muted/10 border-b border-border/40 pb-4">
            <CardTitle className="text-base font-heading font-semibold text-foreground/80">Professional Setup</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 pt-6">
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label>Years of Experience</Label>
                    <Input
                      type="number" min="0" max="60"
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
                    onChange={e => setForm(f => ({ ...f, bio: e.target.value.slice(0, 500) }))}
                    rows={4}
                    maxLength={500}
                    data-testid="input-bio"
                  />
                  <p className={`text-xs mt-1 ${form.bio.length >= 480 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>{form.bio.length}/500 characters</p>
                </div>
                <div>
                  <Label>Website</Label>
                  <Input
                    type="url"
                    placeholder="https://yourwebsite.ie"
                    value={form.website}
                    onChange={e => setForm(f => ({ ...f, website: e.target.value }))}
                    data-testid="input-website"
                  />
                </div>
                <div>
                  <Label>Service Areas</Label>
                  <Textarea
                    placeholder="e.g. Dublin, Wicklow, Kildare"
                    value={form.serviceAreas}
                    onChange={e => setForm(f => ({ ...f, serviceAreas: e.target.value }))}
                    rows={2}
                    data-testid="input-service-areas"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Comma-separated list of counties, cities, or areas you serve</p>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <Label className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> Base Lat</Label>
                    <Input
                      type="number"
                      step="0.000001"
                      placeholder="e.g. 53.3498"
                      value={form.lat}
                      onChange={e => setForm(f => ({ ...f, lat: e.target.value }))}
                      data-testid="input-lat"
                    />
                  </div>
                  <div>
                    <Label>Base Lng</Label>
                    <Input
                      type="number"
                      step="0.000001"
                      placeholder="e.g. -6.2603"
                      value={form.lng}
                      onChange={e => setForm(f => ({ ...f, lng: e.target.value }))}
                      data-testid="input-lng"
                    />
                  </div>
                  <div>
                    <Label>Max Radius (km)</Label>
                    <Input
                      type="number" min="1"
                      placeholder="e.g. 25"
                      value={form.radiusKm}
                      onChange={e => setForm(f => ({ ...f, radiusKm: e.target.value }))}
                      data-testid="input-radius"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground -mt-3">Lat/Lng and Radius are used for matching jobs in your feed. Note: A proper geocoder will automate lat/lng fetching later.</p>

                <div>
                  <Label>Credentials, Certifications, or Licenses</Label>
                  <Textarea
                    placeholder="e.g. RGI Registered, Safe Pass, Plumbers Union ID..."
                    value={form.credentials}
                    onChange={e => setForm(f => ({ ...f, credentials: e.target.value }))}
                    rows={2}
                    data-testid="input-credentials"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Adding your credentials significantly improves your profile completeness score.</p>
                </div>
                <Button onClick={() => updateProfile.mutate()} disabled={updateProfile.isPending} className="rounded-xl px-6 h-11 w-full sm:w-auto shadow-[0_4px_14px_0_rgba(var(--primary),0.39)] hover:shadow-[0_6px_20px_rgba(var(--primary),0.23)] hover:-translate-y-0.5 transition-all mt-2" data-testid="button-save-business">
                  {updateProfile.isPending ? "Saving..." : "Save Business Info"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Service Categories */}
        <Card className="bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-2xl shadow-sm overflow-hidden">
          <CardHeader className="bg-muted/10 border-b border-border/40 pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-heading font-semibold text-foreground/80 flex items-center gap-2">
                <Wrench className="w-4 h-4 text-primary/70" /> Service Categories
              </CardTitle>
              {selectedCategories.length > 0 && (
                <Badge variant="secondary" className="text-xs bg-primary/10 text-primary">
                  {selectedCategories.length} selected
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Select the trades you work in. This determines which jobs appear in your feed.</p>
          </CardHeader>
          <CardContent className="pt-5">
            {loadingCategories ? (
              <div className="flex flex-wrap gap-2">
                {[1,2,3,4,5,6].map(i => <div key={i} className="h-9 w-28 rounded-xl bg-muted animate-pulse" />)}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {(allCategories as any[]).map((cat: any) => {
                  const selected = selectedCategories.includes(cat.id);
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedCategories(prev =>
                        prev.includes(cat.id) ? prev.filter(x => x !== cat.id) : [...prev, cat.id]
                      )}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium border transition-all duration-150 ${
                        selected
                          ? "bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/20"
                          : "bg-white/60 dark:bg-black/30 text-foreground/80 border-border/60 hover:border-primary/40 hover:bg-primary/5"
                      }`}
                    >
                      {selected && <CheckCircle2 className="w-3.5 h-3.5 opacity-90" />}
                      {cat.name}
                    </button>
                  );
                })}
              </div>
            )}
            <Button
              onClick={() => updateProfile.mutate()}
              disabled={updateProfile.isPending}
              className="rounded-xl px-6 h-11 w-full sm:w-auto shadow-[0_4px_14px_0_rgba(var(--primary),0.39)] hover:shadow-[0_6px_20px_rgba(var(--primary),0.23)] hover:-translate-y-0.5 transition-all mt-5"
              data-testid="button-save-categories"
            >
              {updateProfile.isPending ? "Saving..." : "Save Categories"}
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-2xl shadow-sm overflow-hidden">
          <CardHeader className="bg-muted/10 border-b border-border/40 pb-4">
            <CardTitle className="text-base font-heading font-semibold text-foreground/80">Portfolio</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Show examples of recent work. These images appear on your public profile.</p>
          </CardHeader>
          <CardContent className="pt-5 space-y-4">
            <Input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              multiple
              onChange={(e) => {
                void handlePortfolioUpload(e.target.files);
                e.currentTarget.value = "";
              }}
              disabled={uploadingPortfolio || portfolioItems.length >= 6}
            />

            {portfolioItems.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {portfolioItems.map((item) => (
                  <div key={item.id} className="rounded-xl border border-border/50 overflow-hidden bg-background">
                    <div className="aspect-square bg-muted">
                      <img src={item.url} alt={item.originalName} className="w-full h-full object-cover" />
                    </div>
                    <div className="p-2 space-y-2">
                      <p className="text-xs font-medium truncate">{item.originalName}</p>
                      <p className="text-[11px] text-muted-foreground">{item.sizeBytes > 0 ? formatFileSize(item.sizeBytes) : "Existing portfolio item"}</p>
                      <Input
                        value={item.caption || ""}
                        onChange={(e) => setPortfolioItems((prev) => prev.map((entry) => entry.id === item.id ? { ...entry, caption: e.target.value } : entry))}
                        placeholder="Optional caption"
                        className="h-8 text-xs"
                      />
                      <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs w-full" onClick={() => setPortfolioItems((prev) => prev.filter((entry) => entry.id !== item.id))}>
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No portfolio images yet. Add a few examples to improve trust and profile completeness.</p>
            )}

            <Button onClick={() => updateProfile.mutate()} disabled={updateProfile.isPending} className="rounded-xl px-6 h-11 w-full sm:w-auto shadow-[0_4px_14px_0_rgba(var(--primary),0.39)] hover:shadow-[0_6px_20px_rgba(var(--primary),0.23)] hover:-translate-y-0.5 transition-all">
              {updateProfile.isPending ? "Saving..." : "Save Portfolio"}
            </Button>
          </CardContent>
        </Card>

        {/* Public Profile */}
        <Card className="bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-2xl shadow-sm overflow-hidden">
          <CardHeader className="bg-muted/10 border-b border-border/40 pb-4">
            <CardTitle className="text-sm font-heading font-semibold text-foreground/80 flex items-center gap-2">
              <ExternalLink className="w-4 h-4 text-primary/70" /> Public Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-5 pb-4">
            <p className="text-sm text-muted-foreground mb-3">Your public profile is visible to customers reviewing professionals.</p>
            {user?.id && (
              <a
                href={`/#/pro/${user.id}/profile`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-primary font-medium hover:underline"
              >
                <ExternalLink className="w-3.5 h-3.5" /> View your public profile
              </a>
            )}
          </CardContent>
        </Card>

        {/* Stats */}
        {profile && (
          <Card className="bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-2xl shadow-sm overflow-hidden">
            <CardHeader className="bg-muted/10 border-b border-border/40 pb-4">
              <CardTitle className="text-base font-heading font-semibold text-foreground/80">Performance Metrics</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                <div className="space-y-1">
                  <div className="flex items-center justify-center gap-1">
                    <Star className="w-5 h-5 text-amber-500 fill-amber-500/20" />
                    <p className="text-3xl font-heading font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300">{profile.ratingAvg ? Number(profile.ratingAvg).toFixed(1) : "–"}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">Avg rating</p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-center h-[32px]">
                    <p className="text-3xl font-heading font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300">{profile.totalReviews ?? 0}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">Reviews</p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-center gap-1.5 h-[32px]">
                    <TrendingUp className="w-5 h-5 text-primary/80" />
                    <p className="text-3xl font-heading font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300">{profile.spinStreak ?? 0}</p>
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

        {/* Reviews — pro can view and respond */}
        {myReviews.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                Customer reviews of your profile
                <span className="text-muted-foreground font-normal text-sm ml-1">({myReviews.length})</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-5">
                {myReviews.map((r: any) => (
                  <div key={r.id} className="border-b last:border-0 pb-5 last:pb-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="flex">
                        {[1, 2, 3, 4, 5].map(i => (
                          <Star key={i} className={`w-3.5 h-3.5 ${i <= r.rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`} />
                        ))}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })}
                      </span>
                      {r.reviewerFirstName && (
                        <span className="text-xs text-muted-foreground">· {r.reviewerFirstName}</span>
                      )}
                    </div>
                    {r.title && <p className="text-sm font-medium mb-0.5">{r.title}</p>}
                    {r.comment && <p className="text-sm text-muted-foreground italic">"{r.comment}"</p>}
                    {r.proReply ? (
                      <div className="mt-3 pl-3 border-l-2 border-blue-200 dark:border-blue-800">
                        <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-0.5">Your response:</p>
                        <p className="text-xs text-muted-foreground">{r.proReply}</p>
                      </div>
                    ) : (
                      <ReviewReplyForm reviewId={r.id} onReplied={() => refetchReviews()} />
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
