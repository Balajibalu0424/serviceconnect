import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Star, MapPin, Phone, Mail, Briefcase, CheckCircle, Calendar, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

function StarRating({ rating, count }: { rating: number; count: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          className={`w-4 h-4 ${i <= Math.round(rating) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`}
        />
      ))}
      <span className="text-sm font-medium">{rating.toFixed(1)}</span>
      <span className="text-sm text-muted-foreground">({count} review{count !== 1 ? "s" : ""})</span>
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
    : 0;

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
              <Avatar className="w-20 h-20 flex-shrink-0">
                <AvatarImage src={pro.avatarUrl} />
                <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                  {pro.firstName?.[0]}{pro.lastName?.[0]}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-bold">{pro.firstName} {pro.lastName}</h1>
                  {pro.status === "ACTIVE" && (
                    <Badge className="text-xs flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Verified
                    </Badge>
                  )}
                  {profile.profileBoostUntil && new Date(profile.profileBoostUntil) > new Date() && (
                    <Badge variant="secondary" className="text-xs">⚡ Boosted</Badge>
                  )}
                </div>

                {profile.headline && (
                  <p className="text-sm font-medium text-muted-foreground mt-1">{profile.headline}</p>
                )}

                {reviews.length > 0 && (
                  <div className="mt-2">
                    <StarRating rating={avgRating} count={reviews.length} />
                  </div>
                )}

                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-muted-foreground">
                  {profile.city && (
                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{profile.city}</span>
                  )}
                  {profile.yearsExperience != null && (
                    <span className="flex items-center gap-1"><Briefcase className="w-3 h-3" />{profile.yearsExperience} yr{profile.yearsExperience !== 1 ? "s" : ""} experience</span>
                  )}
                  {profile.totalJobsDone != null && (
                    <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3" />{profile.totalJobsDone} jobs completed</span>
                  )}
                  {pro.createdAt && (
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />Member {formatDistanceToNow(new Date(pro.createdAt), { addSuffix: true })}</span>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* About */}
        {(pro.bio || profile.bio) && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">About</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{pro.bio || profile.bio}</p>
            </CardContent>
          </Card>
        )}

        {/* Skills & Specialties */}
        {profile.skills && profile.skills.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Skills & Specialties</CardTitle>
            </CardHeader>
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
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Certifications</CardTitle>
            </CardHeader>
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
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Compliance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {profile.hasInsurance && (
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                  <span>Insurance verified</span>
                </div>
              )}
              {profile.registrationNumber && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Briefcase className="w-4 h-4" />
                  <span>Reg. no: {profile.registrationNumber}</span>
                </div>
              )}
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
              <p className="text-sm text-muted-foreground py-4 text-center">No reviews yet</p>
            ) : (
              <div className="space-y-4">
                {reviews.map((r: any) => (
                  <div key={r.id} className="border-b last:border-0 pb-4 last:pb-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="flex">
                        {[1, 2, 3, 4, 5].map(i => (
                          <Star
                            key={i}
                            className={`w-3.5 h-3.5 ${i <= r.rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`}
                          />
                        ))}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                    {r.comment && <p className="text-sm text-muted-foreground italic">"{r.comment}"</p>}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* CTA */}
        <div className="text-center py-4">
          <p className="text-sm text-muted-foreground mb-3">Need work done? Post a job and get quotes from professionals like {pro.firstName}.</p>
          <Link href="/post-job">
            <Button size="lg">Post a Job</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
