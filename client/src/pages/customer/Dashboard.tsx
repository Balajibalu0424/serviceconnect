import { useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  PlusCircle, Briefcase, MessageSquare, CheckCircle, AlertCircle,
  TrendingUp, ThumbsUp, ThumbsDown, Zap, ChevronRight, Clock,
  ArrowRight, Star, BadgeCheck, Mail, FileText, Bell
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "secondary", LIVE: "default", IN_DISCUSSION: "secondary",
  AFTERCARE_2D: "destructive", AFTERCARE_5D: "destructive", BOOSTED: "default",
  COMPLETED: "outline", CLOSED: "secondary"
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft", LIVE: "Live", IN_DISCUSSION: "In Discussion",
  AFTERCARE_2D: "Awaiting feedback", AFTERCARE_5D: "Follow-up needed",
  BOOSTED: "Boosted", COMPLETED: "Completed", CLOSED: "Closed"
};

function AftercareCard({ job }: { job: any }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [boostOffer, setBoostOffer] = useState<{ fee: number; discountPct: number } | null>(null);
  const [showDeclineOptions, setShowDeclineOptions] = useState(false);

  const respond = useMutation({
    mutationFn: async (sorted: boolean) => {
      const res = await apiRequest("POST", `/api/jobs/${job.id}/aftercare/respond`, { sorted });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: (data, sorted) => {
      if (data.action === "boost_offered") {
        setBoostOffer({ fee: data.boostFee, discountPct: data.discountPct });
      } else {
        qc.invalidateQueries({ queryKey: ["/api/jobs"] });
        toast({ title: sorted ? "Great news!" : "Job closed", description: sorted ? "Glad it got sorted! Don't forget to leave a review." : "Your job has been closed." });
      }
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" })
  });

  const acceptBoost = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/jobs/${job.id}/boost`);
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      setBoostOffer(null);
      qc.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({ title: "Job boosted!", description: "Your job is now featured and cheaper to claim. €4.99 charged." });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" })
  });

  const declineBoost = useMutation({
    mutationFn: async (action: "close" | "leave_open") => {
      const res = await apiRequest("POST", `/api/jobs/${job.id}/aftercare/decline-boost`, { action });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: (data) => {
      setBoostOffer(null);
      setShowDeclineOptions(false);
      qc.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({ title: data.action === "closed" ? "Job closed" : "Job left open", description: data.action === "left_open" ? "Note: you won't be able to repost this same type of job." : undefined });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" })
  });

  // Boost offer step
  if (boostOffer && !showDeclineOptions) {
    return (
      <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-700">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start gap-3 mb-3">
            <Zap className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-sm">Boost <span className="text-primary">"{job.title}"</span> to get more interest?</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                For €{boostOffer.fee} your job is reposted and becomes {boostOffer.discountPct}% cheaper for professionals to claim.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="gap-1.5 bg-amber-500 hover:bg-amber-600 text-white" onClick={() => acceptBoost.mutate()} disabled={acceptBoost.isPending} data-testid="button-boost-yes">
              <Zap className="w-3 h-3" /> Yes, boost (€{boostOffer.fee})
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowDeclineOptions(true)} disabled={acceptBoost.isPending} data-testid="button-boost-no">
              No thanks
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Decline boost → close or leave open
  if (showDeclineOptions) {
    return (
      <Card className="border-muted bg-muted/20">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start gap-3 mb-3">
            <AlertCircle className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-sm">What would you like to do with <span className="text-primary">"{job.title}"</span>?</p>
              <p className="text-xs text-muted-foreground mt-0.5">Closing removes it from the feed. Leaving it open keeps it visible (repost not allowed).</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="destructive" className="gap-1.5" onClick={() => declineBoost.mutate("close")} disabled={declineBoost.isPending} data-testid="button-close-job">
              Close job
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => declineBoost.mutate("leave_open")} disabled={declineBoost.isPending} data-testid="button-leave-open">
              Leave it open
            </Button>
            <Button size="sm" variant="ghost" className="gap-1.5 text-muted-foreground" onClick={() => setShowDeclineOptions(false)} disabled={declineBoost.isPending}>
              Back
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-800">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start gap-3 mb-3">
          <AlertCircle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-sm">Did you get sorted with: <span className="text-primary">"{job.title}"</span>?</p>
            <p className="text-xs text-muted-foreground mt-0.5">Let us know if a professional helped you out — takes 5 seconds</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" className="gap-1.5 flex-1 sm:flex-none" onClick={() => respond.mutate(true)} disabled={respond.isPending} data-testid="button-sorted-yes">
            <ThumbsUp className="w-3 h-3" /> Yes, sorted!
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5 flex-1 sm:flex-none" onClick={() => respond.mutate(false)} disabled={respond.isPending} data-testid="button-sorted-no">
            <ThumbsDown className="w-3 h-3" /> Not yet
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function CustomerDashboard() {
  const { user } = useAuth();
  const { data: jobs = [] } = useQuery<any[]>({ queryKey: ["/api/jobs"] });
  const { data: bookings = [] } = useQuery<any[]>({ queryKey: ["/api/bookings"] });
  const { data: notifData } = useQuery<any>({ queryKey: ["/api/notifications"] });
  const { data: conversations = [] } = useQuery<any[]>({ queryKey: ["/api/chat/conversations"] });
  // staleTime:0 + refetchOnWindowFocus ensures count is always fresh after accepting/rejecting
  // quotes on other pages (e.g., JobDetail) and returning to the dashboard.
  const { data: quoteSummaryData } = useQuery<any>({
    queryKey: ["/api/quotes?summary=jobCounts"],
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
  });
  const quoteSummaryByJob = quoteSummaryData?.byJob || {};
  // Only count quotes in a truly actionable state — PENDING only.
  // Accepted, rejected, withdrawn, expired quotes must not inflate this count.
  const pendingQuotes = Object.values(quoteSummaryByJob).reduce((total: number, summary: any) => total + (summary.pending || 0), 0);

  // Quote count per job (pending only)
  const pendingQuotesByJob: Record<string, number> = Object.fromEntries(
    Object.entries(quoteSummaryByJob).map(([jobId, summary]: [string, any]) => [jobId, summary.pending || 0])
  );

  // Pro first names per job for pending quotes (shows who quoted in pipeline)
  const pendingQuoteProsByJob: Record<string, string[]> = Object.fromEntries(
    Object.entries(quoteSummaryByJob).map(([jobId, summary]: [string, any]) => [jobId, summary.pendingProfessionalFirstNames || []])
  );

  const activeJobs = (jobs as any[]).filter(j => ["LIVE", "IN_DISCUSSION", "BOOSTED"].includes(j.status));
  const draftJobs = (jobs as any[]).filter(j => j.status === "DRAFT");
  const aftercareJobs = (jobs as any[]).filter(j => ["AFTERCARE_2D", "AFTERCARE_5D"].includes(j.status));
  const completedBookings = (bookings as any[]).filter(b => b.status === "COMPLETED");
  const activeBookings = (bookings as any[]).filter(b => ["ACTIVE", "CONFIRMED", "IN_PROGRESS"].includes(b.status));

  return (
    <DashboardLayout>
      <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-1.5">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight font-outfit text-foreground">
              Welcome back, <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-indigo-600 dark:from-primary dark:to-indigo-400">{user?.firstName}</span>!
            </h1>
            <p className="text-muted-foreground text-sm max-w-xl">
              Here is your service command center. Manage jobs, stay updated, and connect with professionals seamlessly.
            </p>
          </div>
          <Link href="/post-job">
            <Button className="gap-2 shadow-lg shadow-primary/20 rounded-xl px-6" size="lg" data-testid="button-post-job">
              <PlusCircle className="w-5 h-5" /> Post a New Job
            </Button>
          </Link>
        </div>

        {/* Draft job banner */}
        {draftJobs.length > 0 && (
          <div className="relative overflow-hidden group rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/40 shadow-sm p-5 md:p-6">
            <div className="absolute top-0 right-0 w-64 h-64 bg-amber-400/10 dark:bg-amber-500/10 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/60 flex items-center justify-center shrink-0 shadow-sm">
                  <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-amber-900 dark:text-amber-100 text-base font-outfit">
                    {draftJobs.length} unpublished job{draftJobs.length > 1 ? "s" : ""}
                  </h3>
                  <p className="text-sm text-amber-700 dark:text-amber-400/80 mt-0.5">
                    {draftJobs[0]?.aiQualityScore < 40
                      ? "Your job needs improvements before going live — check the feedback"
                      : "Publish now and start receiving quotes from professionals"}
                  </p>
                </div>
              </div>
              <Link href="/my-jobs">
                <Button className="gap-2 shrink-0 bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/20 rounded-xl" data-testid="button-publish-draft">
                  <Zap className="w-4 h-4" /> Review & Publish
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* Email verification banner — shown when user registered but hasn't verified OTP */}
        {user && !user.emailVerified && user.role === "CUSTOMER" && (
          <div className="relative overflow-hidden group rounded-2xl border border-blue-200 dark:border-blue-900/50 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 shadow-sm p-5 md:p-6">
            <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/60 flex items-center justify-center shrink-0">
                  <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-blue-900 dark:text-blue-100 text-base font-outfit">Verify your email to publish your job</h3>
                  <p className="text-sm text-blue-700 dark:text-blue-400/80 mt-0.5">
                    Enter the 6-digit code we sent to <strong>{user.email}</strong> to publish your job.
                  </p>
                </div>
              </div>
              <Link href="/post-job?verify=1">
                <Button className="gap-2 shrink-0 bg-blue-600 hover:bg-blue-700 text-white shadow-md rounded-xl" data-testid="button-verify-email">
                  <Mail className="w-4 h-4" /> Verify Now
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* Aftercare alerts — most important, shown prominently */}
        {aftercareJobs.length > 0 && (
          <div className="space-y-4">
            {aftercareJobs.map((job: any) => <AftercareCard key={job.id} job={job} />)}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {[
            {
              label: "Active Jobs", value: activeJobs.length, icon: Briefcase,
              color: "text-indigo-600 dark:text-indigo-400", bg: "from-indigo-500/10 to-blue-500/10",
              sub: "live & in discussion", href: "/my-jobs"
            },
            {
              label: "Bookings", value: activeBookings.length, icon: BadgeCheck,
              color: "text-blue-500 dark:text-blue-400", bg: "from-blue-500/10 to-cyan-500/10",
              sub: "confirmed & in progress", href: "/bookings"
            },
            {
              label: "Notifications", value: notifData?.unreadCount || 0, icon: AlertCircle,
              color: "text-orange-500 dark:text-orange-400", bg: "from-orange-500/10 to-amber-500/10",
              sub: "unread", href: "/notifications"
            },
            {
              label: "Jobs Done", value: completedBookings.length, icon: CheckCircle,
              color: "text-emerald-600 dark:text-emerald-400", bg: "from-emerald-500/10 to-green-500/10",
              sub: "completed", href: "/bookings"
            },
          ].map((stat) => (
            <Link key={stat.label} href={stat.href || "#"} className="block group">
              <div className="bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-white/40 dark:border-white/10 p-5 rounded-2xl shadow-sm group-hover:shadow-md group-hover:border-primary/20 transition-all duration-300 relative overflow-hidden">
                <div className={`absolute -right-4 -top-4 w-24 h-24 bg-gradient-to-br ${stat.bg} rounded-full blur-2xl opacity-50 group-hover:opacity-100 transition-opacity`} />
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.bg} flex items-center justify-center mb-4 relative z-10 border border-white/20 dark:border-white/5`}>
                  <stat.icon className={`w-6 h-6 ${stat.color}`} />
                </div>
                <div className="relative z-10">
                  <p className="text-3xl font-bold font-outfit" data-testid={`stat-${stat.label.toLowerCase().replace(" ", "-")}`}>{stat.value}</p>
                  <p className="text-sm font-medium text-muted-foreground mt-1 text-foreground/80">{stat.label}</p>
                  <p className="text-xs text-muted-foreground/60 mt-0.5">{stat.sub}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Actions Required — only shown when there's something to do */}
        {(pendingQuotes > 0 || (notifData?.unreadCount || 0) > 0) && (
          <div className="bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-indigo-200/60 dark:border-indigo-800/40 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-border/40 bg-indigo-50/60 dark:bg-indigo-950/20 flex items-center gap-2">
              <Bell className="w-4 h-4 text-indigo-500" />
              <p className="text-sm font-semibold text-indigo-900 dark:text-indigo-100">Actions Required</p>
            </div>
            <div className="divide-y divide-border/30">
              {pendingQuotes > 0 && (
                <Link href="/my-jobs">
                  <div className="flex items-center justify-between px-5 py-3.5 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 transition-colors cursor-pointer group">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {pendingQuotes} quote{pendingQuotes > 1 ? "s" : ""} waiting for your decision
                        </p>
                        <p className="text-xs text-muted-foreground">Review and accept or decline</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </Link>
              )}
              {(notifData?.unreadCount || 0) > 0 && (
                <Link href="/notifications">
                  <div className="flex items-center justify-between px-5 py-3.5 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 transition-colors cursor-pointer group">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center shrink-0">
                        <Bell className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {notifData.unreadCount} unread notification{notifData.unreadCount > 1 ? "s" : ""}
                        </p>
                        <p className="text-xs text-muted-foreground">Stay up to date with your activity</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Two column: Jobs pipeline + Recent messages */}
        <div className="grid lg:grid-cols-2 gap-6 md:gap-8">
          {/* Active job pipeline */}
          <div className="bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-2xl shadow-sm overflow-hidden flex flex-col">
            <div className="p-5 md:p-6 border-b border-border/50 bg-white/40 dark:bg-white/5 flex items-center justify-between">
              <h2 className="text-lg font-bold font-outfit flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-primary" /> Job Pipeline
              </h2>
              <Link href="/my-jobs">
                <Button variant="ghost" size="sm" className="gap-1 text-xs rounded-xl hover:bg-white/50 dark:hover:bg-white/10">
                  View all <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </div>
            <div className="p-3 md:p-4 flex-1">
              {(jobs as any[]).length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center py-10 md:py-16 px-4">
                  <div className="w-16 h-16 rounded-2xl bg-primary/5 flex items-center justify-center mb-4">
                    <Briefcase className="w-8 h-8 text-primary/40" />
                  </div>
                  <h3 className="text-md font-semibold font-outfit mb-1 relative z-10">No jobs yet</h3>
                  <p className="text-sm text-muted-foreground max-w-xs mb-6 relative z-10">Post your first job and start receiving quotes from our verified professionals.</p>
                  <Link href="/post-job" className="relative z-10">
                    <Button className="gap-2 rounded-xl shadow-md shadow-primary/20">
                      <PlusCircle className="w-4 h-4" /> Post a Job
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-1">
                  {(jobs as any[]).slice(0, 5).map((job: any) => (
                    <Link key={job.id} href={`/jobs/${job.id}`}>
                      <div
                        className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-transparent hover:border-border/60 hover:bg-white/50 dark:hover:bg-white/5 transition-all cursor-pointer"
                        data-testid={`job-card-${job.id}`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate group-hover:text-primary transition-colors">{job.title}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
                            <Clock className="w-3 h-3" />
                            {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <div className="flex items-center gap-2">
                            {pendingQuotesByJob[job.id] > 0 && (
                              <Badge variant="outline" className="text-[11px] border-blue-300 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 py-1 font-semibold shrink-0">
                                {pendingQuotesByJob[job.id]} quote{pendingQuotesByJob[job.id] > 1 ? "s" : ""}
                              </Badge>
                            )}
                            <Badge variant={STATUS_COLORS[job.status] as any} className="shrink-0 py-1 text-[11px] font-semibold w-fit">
                              {STATUS_LABELS[job.status] || job.status}
                            </Badge>
                          </div>
                          {pendingQuotesByJob[job.id] > 0 && pendingQuoteProsByJob[job.id]?.length > 0 && (
                            <p className="text-[10px] text-muted-foreground leading-tight text-right">
                              from {pendingQuoteProsByJob[job.id].slice(0, 2).join(", ")}
                              {pendingQuoteProsByJob[job.id].length > 2 && ` +${pendingQuoteProsByJob[job.id].length - 2}`}
                            </p>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                  {(jobs as any[]).length > 5 && (
                    <div className="pt-2 px-4 pb-1">
                      <Link href="/my-jobs">
                        <Button variant="ghost" className="w-full text-xs text-primary hover:bg-primary/5 rounded-xl">
                          +{ (jobs as any[]).length - 5 } more jobs <ArrowRight className="w-3 h-3 ml-1.5" />
                        </Button>
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Recent conversations */}
          <div className="bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-2xl shadow-sm overflow-hidden flex flex-col">
            <div className="p-5 md:p-6 border-b border-border/50 bg-white/40 dark:bg-white/5 flex items-center justify-between">
              <h2 className="text-lg font-bold font-outfit flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-indigo-500" /> Recent Messages
              </h2>
              <Link href="/chat">
                <Button variant="ghost" size="sm" className="gap-1 text-xs rounded-xl hover:bg-white/50 dark:hover:bg-white/10">
                  Open chat <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </div>
            <div className="p-3 md:p-4 flex-1">
              {(conversations as any[]).length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center py-10 md:py-16 px-4">
                  <div className="w-16 h-16 rounded-full bg-indigo-500/5 flex items-center justify-center mb-4">
                    <MessageSquare className="w-8 h-8 text-indigo-500/40" />
                  </div>
                  <h3 className="text-md font-semibold font-outfit mb-1 relative z-10">Your inbox is empty</h3>
                  <p className="text-sm text-muted-foreground max-w-xs relative z-10">When you connect with professionals, your conversations will appear right here.</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {(conversations as any[]).slice(0, 4).map((conv: any) => (
                    <Link key={conv.id} href={`/chat?conversationId=${conv.id}`}>
                      <div className="flex items-center gap-4 p-3.5 rounded-xl border border-transparent hover:border-border/60 hover:bg-white/50 dark:hover:bg-white/5 transition-all cursor-pointer">
                        <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center shrink-0 border border-indigo-500/20">
                          <MessageSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{conv.jobTitle || "Job conversation"}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                            <Clock className="w-3 h-3" />
                            {conv.lastMessageAt
                              ? formatDistanceToNow(new Date(conv.lastMessageAt), { addSuffix: true })
                              : "Started recently"}
                          </p>
                        </div>
                        {conv.unreadCount > 0 && (
                          <Badge variant="destructive" className="px-2 py-0.5 h-auto text-xs font-bold rounded-full">{conv.unreadCount}</Badge>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Active bookings summary */}
        {activeBookings.length > 0 && (
          <div className="bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-5 md:p-6 border-b border-border/50 bg-white/40 dark:bg-white/5 flex items-center justify-between">
              <h2 className="text-lg font-bold font-outfit flex items-center gap-2">
                <BadgeCheck className="w-5 h-5 text-blue-500" /> Active Bookings
              </h2>
              <Link href="/bookings">
                <Button variant="ghost" size="sm" className="gap-1 text-xs rounded-xl hover:bg-white/50 dark:hover:bg-white/10">
                  View all <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </div>
            <div className="p-3 md:p-4">
              <div className="space-y-1">
                {activeBookings.slice(0, 3).map((b: any) => (
                  <Link key={b.id} href="/bookings">
                    <div className="flex items-center justify-between gap-4 p-4 rounded-xl border border-transparent hover:border-border/60 hover:bg-white/50 dark:hover:bg-white/5 transition-all cursor-pointer group">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate group-hover:text-primary transition-colors">
                          {b.job?.title || `Booking #${b.id.slice(-6)}`}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {b.professional?.firstName} {b.professional?.lastName}
                          {b.totalAmount ? ` · €${b.totalAmount}` : ""}
                        </p>
                      </div>
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider shrink-0 ${
                        b.status === "CONFIRMED"
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                          : b.status === "IN_PROGRESS"
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                          : "bg-muted text-muted-foreground"
                      }`}>
                        {b.status?.replace("_", " ")}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Quick actions footer */}
        <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-border/40">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mr-2">Quick actions:</span>
          <Link href="/post-job" className="relative z-10">
            <Button size="sm" variant="outline" className="gap-2 rounded-xl bg-white/50 dark:bg-black/20 hover:bg-white dark:hover:bg-white/10 hover:text-primary transition-all shadow-sm">
              <PlusCircle className="w-3.5 h-3.5" /> Post Job
            </Button>
          </Link>
          <Link href="/my-jobs" className="relative z-10">
            <Button size="sm" variant="outline" className="gap-2 rounded-xl bg-white/50 dark:bg-black/20 hover:bg-white dark:hover:bg-white/10 transition-all shadow-sm">
              <Briefcase className="w-3.5 h-3.5" /> Jobs
            </Button>
          </Link>
          <Link href="/bookings" className="relative z-10">
            <Button size="sm" variant="outline" className="gap-2 rounded-xl bg-white/50 dark:bg-black/20 hover:bg-white dark:hover:bg-white/10 transition-all shadow-sm">
              <CheckCircle className="w-3.5 h-3.5" /> Bookings
            </Button>
          </Link>
          <Link href="/support" className="relative z-10">
            <Button size="sm" variant="outline" className="gap-2 rounded-xl bg-white/50 dark:bg-black/20 hover:bg-white dark:hover:bg-white/10 transition-all shadow-sm">
              <MessageSquare className="w-3.5 h-3.5" /> Support
            </Button>
          </Link>
        </div>
      </div>
    </DashboardLayout>
  );
}
