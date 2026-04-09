import { useRoute, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  ArrowLeft, Briefcase, MapPin, Clock, DollarSign, Zap, User,
  FileText, ShieldCheck, BarChart3, AlertTriangle, Unlock, Tag,
  Calendar, CheckCircle2, XCircle, Loader2, Hash, Flame
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700", LIVE: "bg-green-100 text-green-700",
  IN_DISCUSSION: "bg-blue-100 text-blue-700", MATCHED: "bg-purple-100 text-purple-700",
  BOOSTED: "bg-amber-100 text-amber-700", COMPLETED: "bg-emerald-100 text-emerald-700",
  CLOSED: "bg-gray-100 text-gray-500",
  AFTERCARE_2D: "bg-orange-100 text-orange-700", AFTERCARE_5D: "bg-red-100 text-red-700",
};

const QUOTE_STATUS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700", ACCEPTED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700", WITHDRAWN: "bg-gray-100 text-gray-500",
};

const BOOKING_STATUS: Record<string, string> = {
  CONFIRMED: "bg-blue-100 text-blue-700", IN_PROGRESS: "bg-amber-100 text-amber-700",
  COMPLETED: "bg-green-100 text-green-700", CANCELLED: "bg-red-100 text-red-700",
  DISPUTED: "bg-red-100 text-red-700",
};

export default function AdminJobDetail() {
  const [, params] = useRoute("/admin/jobs/:id");
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<any>({
    queryKey: [`/api/admin/jobs/${params?.id}/detail`],
    enabled: !!params?.id,
  });

  const closeJob = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", `/api/jobs/${params?.id}`, {});
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/admin/jobs/${params?.id}/detail`] });
      toast({ title: "Job closed" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return (
    <DashboardLayout>
      <div className="p-8 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
    </DashboardLayout>
  );

  if (!data?.job) return (
    <DashboardLayout>
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Job not found</p>
        <Link href="/admin/jobs"><Button variant="outline" className="mt-4 gap-2"><ArrowLeft className="w-4 h-4" /> Back to Jobs</Button></Link>
      </div>
    </DashboardLayout>
  );

  const { job, customer, category, unlocks, quotes, bookings, boosts, aftercare } = data;

  return (
    <DashboardLayout>
      <div className="p-4 md:p-8 space-y-6 max-w-6xl mx-auto">
        {/* Back + Header */}
        <div className="flex items-start gap-4">
          <Link href="/admin/jobs">
            <Button variant="ghost" size="sm" className="gap-1.5 rounded-xl mt-1">
              <ArrowLeft className="w-4 h-4" /> Back
            </Button>
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight font-outfit">{job.title}</h1>
              <Badge className={cn("text-xs px-2.5 py-1 rounded-full font-semibold border-0", STATUS_COLORS[job.status])}>
                {job.status}
              </Badge>
              {job.isBoosted && <Badge className="bg-amber-500 text-white border-0 gap-0.5 text-xs"><Zap className="w-3 h-3" /> Boosted</Badge>}
              {job.aiIsUrgent && <Badge className="bg-red-600 text-white border-0 gap-0.5 text-xs"><Flame className="w-3 h-3" /> Urgent</Badge>}
              {job.aiIsFakeFlag && <Badge className="bg-orange-600 text-white border-0 gap-0.5 text-xs"><AlertTriangle className="w-3 h-3" /> Flagged</Badge>}
            </div>
            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground flex-wrap">
              {job.referenceCode && <span className="flex items-center gap-1 font-mono text-xs bg-muted px-2 py-0.5 rounded"><Hash className="w-3 h-3" /> {job.referenceCode}</span>}
              <span className="font-mono text-xs text-muted-foreground/60">{job.id}</span>
            </div>
          </div>
          {!["CLOSED", "COMPLETED"].includes(job.status) && (
            <Button variant="destructive" size="sm" className="rounded-xl gap-1.5" onClick={() => closeJob.mutate()} disabled={closeJob.isPending}>
              <XCircle className="w-4 h-4" /> Close Job
            </Button>
          )}
        </div>

        {/* Top grid: Job details + Customer */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Job Details */}
          <Card className="lg:col-span-2 bg-white/60 dark:bg-black/40 backdrop-blur-xl border-white/40 dark:border-white/10 rounded-2xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <Briefcase className="w-4 h-4" /> Job Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Description</p>
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{job.description}</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Category</p>
                  <div className="flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-primary" />
                    <span className="text-sm font-medium">{category?.name || "Unknown"}</span>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Location</p>
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-primary" />
                    <span className="text-sm">{job.locationText || "Not set"}</span>
                  </div>
                  {job.locationTown && <p className="text-xs text-muted-foreground ml-5">Town: {job.locationTown}</p>}
                  {job.locationEircode && <p className="text-xs text-muted-foreground ml-5">Eircode: {job.locationEircode}</p>}
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Urgency</p>
                  <Badge variant={job.urgency === "URGENT" ? "destructive" : "secondary"} className="text-xs">{job.urgency}</Badge>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Budget</p>
                  <span className="text-sm">{job.budgetMin ? `€${job.budgetMin} – €${job.budgetMax}` : "Not set"}</span>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Credit Cost</p>
                  <span className="text-sm">{job.creditCost} credits</span>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Boost Count</p>
                  <span className="text-sm">{job.boostCount || 0}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border/30">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Created</p>
                  <span className="text-sm">{format(new Date(job.createdAt), "PPp")}</span>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Updated</p>
                  <span className="text-sm">{format(new Date(job.updatedAt), "PPp")}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Customer + AI Info */}
          <div className="space-y-4">
            <Card className="bg-white/60 dark:bg-black/40 backdrop-blur-xl border-white/40 dark:border-white/10 rounded-2xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                  <User className="w-4 h-4" /> Customer
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-medium">{customer?.firstName} {customer?.lastName}</p>
                <p className="text-sm text-muted-foreground">{customer?.email}</p>
              </CardContent>
            </Card>

            <Card className="bg-white/60 dark:bg-black/40 backdrop-blur-xl border-white/40 dark:border-white/10 rounded-2xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" /> AI Analysis
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Quality Score</p>
                  <div className="flex items-center gap-2">
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn("h-full rounded-full", (job.aiQualityScore || 0) >= 70 ? "bg-green-500" : (job.aiQualityScore || 0) >= 40 ? "bg-amber-500" : "bg-red-500")}
                        style={{ width: `${job.aiQualityScore || 0}%` }}
                      />
                    </div>
                    <span className="text-sm font-bold">{job.aiQualityScore ?? "N/A"}</span>
                  </div>
                </div>
                {job.aiQualityPrompt && <div><p className="text-xs font-medium text-muted-foreground mb-1">Improvement Hint</p><p className="text-xs text-muted-foreground">{job.aiQualityPrompt}</p></div>}
                {job.aiCategorySlug && <div><p className="text-xs font-medium text-muted-foreground mb-1">AI Category</p><p className="text-sm">{job.aiCategorySlug} ({job.aiCategoryConfidence})</p></div>}
                {job.aiUrgencyKeywords?.length > 0 && <div><p className="text-xs font-medium text-muted-foreground mb-1">Urgency Keywords</p><p className="text-sm">{job.aiUrgencyKeywords.join(", ")}</p></div>}
                {job.aiIsFakeFlag && <div><p className="text-xs font-medium text-muted-foreground mb-1">Fake Flag Reason</p><p className="text-sm text-red-600">{job.aiFakeReason}</p></div>}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Unlocks */}
        <Card className="bg-white/60 dark:bg-black/40 backdrop-blur-xl border-white/40 dark:border-white/10 rounded-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <Unlock className="w-4 h-4" /> Unlocks ({unlocks?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!unlocks?.length ? (
              <p className="text-sm text-muted-foreground">No professionals have unlocked this job yet.</p>
            ) : (
              <div className="divide-y divide-border/30">
                {unlocks.map((u: any) => (
                  <div key={u.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-medium">{u.proName}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(u.unlockedAt), "PPp")}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="text-xs">{u.tier}</Badge>
                      <span className="text-sm font-medium">{u.creditsSpent} credits</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quotes */}
        <Card className="bg-white/60 dark:bg-black/40 backdrop-blur-xl border-white/40 dark:border-white/10 rounded-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <FileText className="w-4 h-4" /> Quotes ({quotes?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!quotes?.length ? (
              <p className="text-sm text-muted-foreground">No quotes submitted for this job.</p>
            ) : (
              <div className="divide-y divide-border/30">
                {quotes.map((q: any) => (
                  <div key={q.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-medium">{q.proName}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(q.createdAt), "PPp")}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold">€{q.amount}</span>
                      <Badge className={cn("text-xs border-0 rounded-full", QUOTE_STATUS[q.status])}>{q.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bookings */}
        <Card className="bg-white/60 dark:bg-black/40 backdrop-blur-xl border-white/40 dark:border-white/10 rounded-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> Bookings ({bookings?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!bookings?.length ? (
              <p className="text-sm text-muted-foreground">No bookings for this job yet.</p>
            ) : (
              <div className="divide-y divide-border/30">
                {bookings.map((b: any) => (
                  <div key={b.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-medium">{b.proName}</p>
                      <p className="text-xs text-muted-foreground">
                        {b.serviceDate ? `Scheduled: ${format(new Date(b.serviceDate), "PP")}` : "No date set"}
                        {b.completedAt && ` | Completed: ${format(new Date(b.completedAt), "PP")}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold">€{b.totalAmount}</span>
                      <Badge className={cn("text-xs border-0 rounded-full", BOOKING_STATUS[b.status])}>{b.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Boosts + Aftercare */}
        {(boosts?.length > 0 || aftercare?.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {boosts?.length > 0 && (
              <Card className="bg-white/60 dark:bg-black/40 backdrop-blur-xl border-white/40 dark:border-white/10 rounded-2xl">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                    <Zap className="w-4 h-4" /> Boost History
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {boosts.map((b: any, i: number) => (
                    <div key={i} className="flex justify-between py-2 text-sm">
                      <span>{format(new Date(b.boostedAt || b.createdAt), "PPp")}</span>
                      <span className="font-medium">€{b.fee || "4.99"}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
            {aftercare?.length > 0 && (
              <Card className="bg-white/60 dark:bg-black/40 backdrop-blur-xl border-white/40 dark:border-white/10 rounded-2xl">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                    <Calendar className="w-4 h-4" /> Aftercare
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {aftercare.map((a: any, i: number) => (
                    <div key={i} className="py-2 text-sm">
                      <p>Branch: {a.branch} | Response: {a.customerResponse || "Pending"}</p>
                      {a.createdAt && <p className="text-xs text-muted-foreground">{format(new Date(a.createdAt), "PPp")}</p>}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
