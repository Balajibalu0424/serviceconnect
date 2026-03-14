import { Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { PlusCircle, Briefcase, MessageSquare, CheckCircle, AlertCircle, TrendingUp, ThumbsUp, ThumbsDown, Zap } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "secondary", LIVE: "default", IN_DISCUSSION: "secondary",
  AFTERCARE_2D: "destructive", AFTERCARE_5D: "destructive", BOOSTED: "default",
  COMPLETED: "outline", CLOSED: "secondary"
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
        toast({ title: sorted ? "Great!" : "Job closed", description: sorted ? "Glad it got sorted!" : "Your job has been closed." });
      }
    }
  });

  return (
    <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-800">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-sm">Did you get sorted with: <span className="text-primary">"{job.title}"</span>?</p>
            <p className="text-xs text-muted-foreground mt-0.5">Let us know if a professional helped you out</p>
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          <Button size="sm" className="gap-1" onClick={() => respond.mutate(true)} disabled={respond.isPending} data-testid="button-sorted-yes">
            <ThumbsUp className="w-3 h-3" /> Yes, sorted!
          </Button>
          <Button size="sm" variant="outline" className="gap-1" onClick={() => respond.mutate(false)} disabled={respond.isPending} data-testid="button-sorted-no">
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

  const activeJobs = (jobs as any[]).filter(j => ["LIVE", "IN_DISCUSSION", "BOOSTED"].includes(j.status));
  const draftJobs = (jobs as any[]).filter(j => j.status === "DRAFT");
  const aftercareJobs = (jobs as any[]).filter(j => ["AFTERCARE_2D", "AFTERCARE_5D"].includes(j.status));
  const completedBookings = (bookings as any[]).filter(b => b.status === "COMPLETED");

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Welcome back, {user?.firstName}!</h1>
            <p className="text-sm text-muted-foreground">Here's what's happening with your jobs</p>
          </div>
          <Link href="/post-job">
            <Button size="sm" className="gap-1" data-testid="button-post-job">
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
                    <p className="font-medium text-sm">You have {draftJobs.length} unpublished job{draftJobs.length > 1 ? "s" : ""}</p>
                    <p className="text-xs text-muted-foreground">Publish to make it live so professionals can see it</p>
                  </div>
                </div>
                <Link href="/my-jobs">
                  <Button size="sm" className="gap-1 shrink-0" data-testid="button-publish-draft">
                    <Zap className="w-3 h-3" /> Publish Now
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Aftercare alerts */}
        {aftercareJobs.length > 0 && (
          <div className="space-y-3">
            {aftercareJobs.map((job: any) => <AftercareCard key={job.id} job={job} />)}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Active Jobs", value: activeJobs.length, icon: Briefcase, color: "text-primary" },
            { label: "Notifications", value: notifData?.unreadCount || 0, icon: AlertCircle, color: "text-orange-500" },
            { label: "Bookings", value: bookings.length, icon: CheckCircle, color: "text-accent" },
            { label: "Completed", value: completedBookings.length, icon: TrendingUp, color: "text-green-500" },
          ].map((stat) => (
            <Card key={stat.label}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold" data-testid={`stat-${stat.label.toLowerCase().replace(" ", "-")}`}>{stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                  <stat.icon className={`w-6 h-6 ${stat.color}`} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Recent jobs */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">My Jobs</CardTitle>
              <Link href="/my-jobs"><Button variant="ghost" size="sm">View all</Button></Link>
            </div>
          </CardHeader>
          <CardContent>
            {(jobs as any[]).length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Briefcase className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No jobs yet</p>
                <Link href="/post-job"><Button size="sm" variant="outline" className="mt-2">Post your first job</Button></Link>
              </div>
            ) : (
              <div className="space-y-3">
                {(jobs as any[]).slice(0, 5).map((job: any) => (
                  <Link key={job.id} href={`/jobs/${job.id}`}>
                    <div className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer" data-testid={`job-card-${job.id}`}>
                      <div>
                        <p className="font-medium text-sm">{job.title}</p>
                        <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}</p>
                      </div>
                      <Badge variant={STATUS_COLORS[job.status] as any}>{job.status}</Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
