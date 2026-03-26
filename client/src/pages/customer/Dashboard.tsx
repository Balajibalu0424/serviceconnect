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
  ArrowRight, Star, BadgeCheck
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

  const respond = useMutation({
    mutationFn: async (sorted: boolean) => {
      const res = await apiRequest("POST", `/api/jobs/${job.id}/aftercare/respond`, { sorted });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: (data, sorted) => {
      qc.invalidateQueries({ queryKey: ["/api/jobs"] });
      if (data.action === "boost_offered") {
        toast({ title: "We can help!", description: `Boost your job for €${data.boostFee} to get ${data.discountPct}% off credit costs for professionals.` });
      } else {
        toast({ title: sorted ? "Great news!" : "Job closed", description: sorted ? "Glad it got sorted! Don't forget to leave a review." : "Your job has been closed." });
      }
    }
  });

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
  const { data: conversations = [] } = useQuery<any[]>({ queryKey: ["/api/conversations"] });

  const activeJobs = (jobs as any[]).filter(j => ["LIVE", "IN_DISCUSSION", "BOOSTED"].includes(j.status));
  const draftJobs = (jobs as any[]).filter(j => j.status === "DRAFT");
  const aftercareJobs = (jobs as any[]).filter(j => ["AFTERCARE_2D", "AFTERCARE_5D"].includes(j.status));
  const completedBookings = (bookings as any[]).filter(b => b.status === "COMPLETED");
  const activeBookings = (bookings as any[]).filter(b => ["ACTIVE", "CONFIRMED"].includes(b.status));

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Welcome back, {user?.firstName}!</h1>
            <p className="text-sm text-muted-foreground">Here's what's happening with your jobs</p>
          </div>
          <Link href="/post-job">
            <Button size="sm" className="gap-1.5" data-testid="button-post-job">
              <PlusCircle className="w-4 h-4" /> Post a Job
            </Button>
          </Link>
        </div>

        {/* Draft job banner */}
        {draftJobs.length > 0 && (
          <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">
                      {draftJobs.length} unpublished job{draftJobs.length > 1 ? "s" : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {draftJobs[0]?.aiQualityScore < 40
                        ? "Your job needs improvements before going live — check the feedback"
                        : "Publish now and start receiving quotes from professionals"}
                    </p>
                  </div>
                </div>
                <Link href="/my-jobs">
                  <Button size="sm" className="gap-1.5 shrink-0" data-testid="button-publish-draft">
                    <Zap className="w-3 h-3" /> Review & Publish
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Aftercare alerts — most important, shown prominently */}
        {aftercareJobs.length > 0 && (
          <div className="space-y-3">
            {aftercareJobs.map((job: any) => <AftercareCard key={job.id} job={job} />)}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            {
              label: "Active Jobs", value: activeJobs.length, icon: Briefcase,
              color: "text-primary", bg: "bg-primary/5",
              sub: "live & in discussion", href: "/my-jobs"
            },
            {
              label: "Bookings", value: activeBookings.length, icon: BadgeCheck,
              color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-950/30",
              sub: "confirmed", href: "/bookings"
            },
            {
              label: "Notifications", value: notifData?.unreadCount || 0, icon: AlertCircle,
              color: "text-orange-500", bg: "bg-orange-50 dark:bg-orange-950/30",
              sub: "unread", href: "/notifications"
            },
            {
              label: "Jobs Done", value: completedBookings.length, icon: CheckCircle,
              color: "text-green-600", bg: "bg-green-50 dark:bg-green-950/30",
              sub: "completed", href: "/bookings"
            },
          ].map((stat) => (
            <Link key={stat.label} href={stat.href || "#"}>
              <Card className="cursor-pointer hover:shadow-sm hover:border-border/80 transition-all">
                <CardContent className="pt-4 pb-4">
                  <div className={`w-8 h-8 rounded-lg ${stat.bg} flex items-center justify-center mb-3`}>
                    <stat.icon className={`w-4 h-4 ${stat.color}`} />
                  </div>
                  <p className="text-2xl font-bold" data-testid={`stat-${stat.label.toLowerCase().replace(" ", "-")}`}>{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className="text-[10px] text-muted-foreground/70 mt-0.5">{stat.sub}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Two column: Jobs pipeline + Recent messages */}
        <div className="grid lg:grid-cols-2 gap-5">
          {/* Active job pipeline */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-primary" /> Job Pipeline
                </CardTitle>
                <Link href="/my-jobs">
                  <Button variant="ghost" size="sm" className="gap-1 text-xs">
                    All jobs <ChevronRight className="w-3 h-3" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {(jobs as any[]).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Briefcase className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No jobs yet</p>
                  <p className="text-xs mt-1 mb-3">Post a job and professionals will quote you</p>
                  <Link href="/post-job">
                    <Button size="sm" variant="outline" className="gap-1.5">
                      <PlusCircle className="w-3.5 h-3.5" /> Post your first job
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {(jobs as any[]).slice(0, 5).map((job: any) => (
                    <Link key={job.id} href={`/jobs/${job.id}`}>
                      <div
                        className="flex items-center justify-between p-2.5 rounded-lg border border-transparent hover:border-border/50 hover:bg-muted/50 transition-all cursor-pointer"
                        data-testid={`job-card-${job.id}`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{job.title}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                        <Badge variant={STATUS_COLORS[job.status] as any} className="ml-2 shrink-0 text-xs">
                          {STATUS_LABELS[job.status] || job.status}
                        </Badge>
                      </div>
                    </Link>
                  ))}
                  {(jobs as any[]).length > 5 && (
                    <Link href="/my-jobs">
                      <p className="text-xs text-primary text-center pt-1 hover:underline cursor-pointer">
                        +{(jobs as any[]).length - 5} more jobs →
                      </p>
                    </Link>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent conversations */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-primary" /> Messages
                </CardTitle>
                <Link href="/chat">
                  <Button variant="ghost" size="sm" className="gap-1 text-xs">
                    All chats <ChevronRight className="w-3 h-3" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {(conversations as any[]).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No messages yet</p>
                  <p className="text-xs mt-1">Conversations with professionals will appear here</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {(conversations as any[]).slice(0, 4).map((conv: any) => (
                    <Link key={conv.id} href={`/chat?conv=${conv.id}`}>
                      <div className="flex items-center gap-3 p-2.5 rounded-lg border border-transparent hover:border-border/50 hover:bg-muted/50 transition-all cursor-pointer">
                        <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                          <MessageSquare className="w-3.5 h-3.5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{conv.jobTitle || "Job conversation"}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            {conv.lastMessageAt
                              ? formatDistanceToNow(new Date(conv.lastMessageAt), { addSuffix: true })
                              : "No messages yet"}
                          </p>
                        </div>
                        {conv.unreadCount > 0 && (
                          <Badge variant="destructive" className="text-xs h-5 min-w-5 shrink-0">{conv.unreadCount}</Badge>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick actions footer */}
        <Card className="bg-muted/30 border-dashed">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs font-medium text-muted-foreground mb-3">Quick actions</p>
            <div className="flex flex-wrap gap-2">
              <Link href="/post-job">
                <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                  <PlusCircle className="w-3 h-3" /> Post a Job
                </Button>
              </Link>
              <Link href="/my-jobs">
                <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                  <Briefcase className="w-3 h-3" /> My Jobs
                </Button>
              </Link>
              <Link href="/bookings">
                <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                  <CheckCircle className="w-3 h-3" /> Bookings
                </Button>
              </Link>
              <Link href="/support">
                <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                  <MessageSquare className="w-3 h-3" /> Get Support
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
