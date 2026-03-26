import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Star, MapPin, Phone, Mail, Briefcase, CheckCircle, Calendar, Loader2, Clock, Users, Zap, Trophy, Shield, Award, Wifi } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

function StarRating({ rating, count }: { rating: number; count: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} className={`w-4 h-4 ${i <= Math.round(rating) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`} />
      ))}
      <span className="text-sm font-medium">{rating.toFixed(1)}</span>
      <span className="text-sm text-muted-foreground">({count} review{count !== 1 ? "s" : ""})</span>
    </div>
  );
}

function TrustSignal({ icon: Icon, value, label, highlight = false }: { icon: any; value: string; label: string; highlight?: boolean }) {
  return (
    <div className={`flex flex-col items-center p-3 rounded-xl border text-center ${highlight ? "border-primary/30 bg-primary/5" : "border-border bg-muted/30"}`}>
      <Icon className={`w-5 h-5 mb-1 ${highlight ? "text-primary" : "text-muted-foreground"}`} />
      <p className={`text-base font-bold leading-tight ${highlight ? "text-primary" : "text-foreground"}`}>{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

export default function ProPublicProfile() {
  const params = useParams<{ id: string }>();
  const proId = params.id;

  const { data: pro, isLoading, isError } = useQuery<any>({
    queryKey: ["/api/pro", proId, "profile"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/pro/${proId}/profile`);
      if (!res.ok) throw new Error("Profile not found");
      return res.json();
    },
    enabled: !!proId,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !pro) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-xl font-semibold">Profile not found</p>
        <Link href="/"><Button variant="outline">Go home</Button></Link>
      </div>
    );
  }

  const profile = pro.profile || {};
  const reviews: any[] = pro.reviews || [];
  const avgRating = reviews.length
    ? reviews.reduce((sum: number, r: any) => sum + (r.rating || 0), 0) / reviews.length
    : (profile.ratingAvg ? parseFloat(profile.ratingAvg) : 0);
  const totalReviews = reviews.length || profile.totalReviews || 0;

  // Computed trust signals
  const hiresOnPlatform = pro.totalHires ?? profile.totalJobsDone ?? null;
  const responseTime = pro.avgResponseMinutes
    ? pro.avgResponseMinutes < 60
      ? `<${Math.max(1, Math.round(pro.avgResponseMinutes))} min`
      : `<${Math.round(pro.avgResponseMinutes / 60)} hrs`
    : null;
  const yearsExp = profile.yearsExperience ?? null;
  const isElitePro = profile.subscriptionTier === "ELITE" || profile.earnedBadges?.includes("elite_pro");
  const isVerified = pro.status === "ACTIVE" || profile.isVerified;
  const isAvailableOnline = profile.availability?.availableOnline === true;

  const earnedBadges: string[] = profile.earnedBadges || [];
  const BADGE_META: Record<string, { label: string; color: string; icon: any }> = {
    top_rated: { label: "Top Rated", color: "bg-amber-100 text-amber-700 border-amber-300", icon: Star },
    fast_responder: { label: "Fast Responder", color: "bg-blue-100 text-blue-700 border-blue-300", icon: Clock },
    elite_pro: { label: "Elite Pro", color: "bg-purple-100 text-purple-700 border-purple-300", icon: Trophy },
    verified: { label: "Verified", color: "bg-green-100 text-green-700 border-green-300", icon: Shield },
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top nav */}
      <div className="border-b bg-background sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/">
            <span className="font-bold text-primary text-lg">ServiceConnect</span>
          </Link>
          <Link href="/post-job">
            <Button size="sm">Post a Job</Button>
          </Link>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Profile header */}
        <Card>
          <CardContent className="pt-6 pb-6">
            <div className="flex items-start gap-5">
              <div className="relative">
                <Avatar className="w-20 h-20 flex-shrink-0">
                  <AvatarImage src={pro.avatarUrl} />
                  <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                    {pro.firstName?.[0]}{pro.lastName?.[0]}
                  </AvatarFallback>
                </Avatar>
                {isAvailableOnline && (
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-background flex items-center justify-center" title="Available online">
                    <Wifi className="w-2.5 h-2.5 text-white" />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-bold">{pro.firstName} {pro.lastName}</h1>
                  {isVerified && (
                    <Badge className="text-xs flex items-center gap-1 bg-green-100 text-green-700 border-green-300 hover:bg-green-100">
                      <CheckCircle className="w-3 h-3" /> Verified
                    </Badge>
                  )}
                  {isElitePro && (
                    <Badge className="text-xs flex items-center gap-1 bg-purple-100 text-purple-700 border-purple-300 hover:bg-purple-100">
                      <Trophy className="w-3 h-3" /> Elite Pro
                    </Badge>
                  )}
                  {profile.profileBoostUntil && new Date(profile.profileBoostUntil) > new Date() && (
                    <Badge variant="secondary" className="text-xs">⚡ Boosted</Badge>
                  )}
                  {isAvailableOnline && (
                    <Badge className="text-xs flex items-center gap-1 bg-green-50 text-green-600 border-green-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                      Available online
                    </Badge>
                  )}
                </div>

                {profile.businessName && (
                  <p className="text-sm font-medium mt-1">{profile.businessName}</p>
                )}

                {profile.headline && (
                  <p className="text-sm text-muted-foreground mt-1">{profile.headline}</p>
                )}

                {totalReviews > 0 && avgRating > 0 && (
                  <div className="mt-2">
                    <StarRating rating={avgRating} count={totalReviews} />
                  </div>
                )}

                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-muted-foreground">
                  {profile.city && (
                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{profile.city}</span>
                  )}
                  {pro.createdAt && (
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />Member {formatDistanceToNow(new Date(pro.createdAt), { addSuffix: true })}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Trust signals grid — Bark-style hires counter */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
              {hiresOnPlatform != null && (
                <TrustSignal
                  icon={Users}
                  value={hiresOnPlatform > 0 ? `${hiresOnPlatform}` : "New"}
                  label={hiresOnPlatform > 0 ? "hires on platform" : "to the platform"}
                  highlight={hiresOnPlatform > 5}
                />
              )}
              {responseTime && (
                <TrustSignal icon={Clock} value={responseTime} label="response time" highlight />
              )}
              {yearsExp != null && yearsExp > 0 && (
                <TrustSignal icon={Briefcase} value={`${yearsExp} yr${yearsExp !== 1 ? "s" : ""}`} label="experience" />
              )}
              {totalReviews > 0 && (
                <TrustSignal
                  icon={Star}
                  value={avgRating > 0 ? avgRating.toFixed(1) : "—"}
                  label={`${totalReviews} review${totalReviews !== 1 ? "s" : ""}`}
                  highlight={avgRating >= 4.5}
                />
              )}
            </div>

            {/* Earned badges */}
            {earnedBadges.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {earnedBadges.map(badge => {
                  const meta = BADGE_META[badge];
                  if (!meta) return null;
                  const Icon = meta.icon;
                  return (
                    <div key={badge} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${meta.color}`}>
                      <Icon className="w-3 h-3" />
                      {meta.label}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* About */}
        {(pro.bio || profile.bio) && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">About</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{pro.bio || profile.bio}</p>
            </CardContent>
          </Card>
        )}

        {/* Services & Service Areas */}
        {(profile.serviceCategories?.length > 0 || profile.serviceAreas?.length > 0) && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Services Offered</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {profile.serviceCategories?.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Service categories</p>
                  <div className="flex flex-wrap gap-2">
                    {(profile.serviceCategories as string[]).map((s: string) => (
                      <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {profile.serviceAreas?.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Service areas</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(profile.serviceAreas as string[]).map((a: string) => (
                      <span key={a} className="flex items-center gap-1 text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                        <MapPin className="w-2.5 h-2.5" />{a}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {profile.hourlyRate && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Zap className="w-3.5 h-3.5" />
                  <span>From €{profile.hourlyRate}/hr</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Skills & Specialties */}
        {profile.skills && profile.skills.length > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Skills & Specialties</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {(profile.skills as string[]).map((skill: string) => (
                  <Badge key={skill} variant="secondary" className="text-xs">{skill}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Certifications */}
        {profile.certifications && profile.certifications.length > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Certifications</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {(profile.certifications as string[]).map((cert: string) => (
                  <div key={cert} className="flex items-center gap-1.5 text-sm bg-muted rounded-full px-3 py-1">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                    {cert}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Insurance & Compliance */}
        {(profile.hasInsurance || profile.registrationNumber) && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Compliance</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {profile.hasInsurance && (
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-emerald-500" /><span>Insurance verified</span>
                </div>
              )}
              {profile.registrationNumber && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Briefcase className="w-4 h-4" /><span>Reg. no: {profile.registrationNumber}</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Portfolio */}
        {profile.portfolio && profile.portfolio.length > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Portfolio</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {(profile.portfolio as any[]).slice(0, 6).map((item: any, i: number) => (
                  <div key={i} className="aspect-square bg-muted rounded-lg overflow-hidden">
                    {item.url && <img src={item.url} alt={item.caption || `Portfolio ${i + 1}`} className="w-full h-full object-cover" />}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Reviews */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              Reviews {reviews.length > 0 && <span className="text-muted-foreground font-normal text-sm">({reviews.length})</span>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {reviews.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No reviews yet — be the first to hire {pro.firstName}</p>
            ) : (
              <div className="space-y-4">
                {reviews.map((r: any) => (
                  <div key={r.id} className="border-b last:border-0 pb-4 last:pb-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="flex">
                        {[1, 2, 3, 4, 5].map(i => (
                          <Star key={i} className={`w-3.5 h-3.5 ${i <= r.rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`} />
                        ))}
                      </div>
                      <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })}</span>
                    </div>
                    {r.comment && <p className="text-sm text-muted-foreground italic">"{r.comment}"</p>}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Elite Pro upsell card (shown when pro has >=3 hires and is not yet Elite) */}
        {hiresOnPlatform != null && hiresOnPlatform >= 3 && !isElitePro && (
          <Card className="border-purple-200 bg-purple-50 dark:bg-purple-950/20 dark:border-purple-800">
            <CardContent className="pt-5 pb-5 flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
                <Trophy className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="font-semibold text-sm text-purple-800 dark:text-purple-300">Unlock Elite Pro status</p>
                <p className="text-xs text-purple-700 dark:text-purple-400 mt-0.5">
                  Elite Pros get a purple badge, appear higher in search, and access exclusive high-value jobs. Upgrade in your dashboard.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* CTA */}
        <div className="text-center py-4">
          <p className="text-sm text-muted-foreground mb-3">Need work done? Post a job and get quotes from professionals like {pro.firstName}.</p>
          <Link href="/post-job">
            <Button size="lg">Post a Job — It's Free</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
