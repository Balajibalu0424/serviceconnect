import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Briefcase, PlusCircle, MapPin, Clock, Zap, AlertCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "secondary", LIVE: "default", IN_DISCUSSION: "secondary",
  AFTERCARE_2D: "destructive", AFTERCARE_5D: "destructive", BOOSTED: "default",
  COMPLETED: "outline", CLOSED: "secondary"
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft", LIVE: "Live", IN_DISCUSSION: "In Discussion",
  AFTERCARE_2D: "Aftercare (2d)", AFTERCARE_5D: "Aftercare (5d)",
  BOOSTED: "Boosted", COMPLETED: "Completed", CLOSED: "Closed"
};

export default function MyJobs() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: jobs = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/jobs"] });

  const publish = useMutation({
    mutationFn: async (jobId: string) => {
      const res = await apiRequest("POST", `/api/jobs/${jobId}/publish`, {});
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({ title: "Job published!", description: "Your job is now live. Professionals can see it." });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const draftJobs = (jobs as any[]).filter(j => j.status === "DRAFT");
  const activeJobs = (jobs as any[]).filter(j => j.status !== "DRAFT");

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">My Jobs</h1>
            <p className="text-sm text-muted-foreground">{(jobs as any[]).length} total jobs</p>
          </div>
          <Link href="/post-job"><Button size="sm" className="gap-1"><PlusCircle className="w-4 h-4" /> Post Job</Button></Link>
        </div>

        {isLoading ? (
          <div className="space-y-3">{[1,2,3].map(i=><div key={i} className="h-20 rounded-lg bg-muted animate-pulse"/>)}</div>
        ) : (jobs as any[]).length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Briefcase className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>You haven't posted any jobs yet</p>
            <Link href="/post-job"><Button className="mt-4">Post your first job</Button></Link>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Draft jobs — prominent banner to publish */}
            {draftJobs.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                  <AlertCircle className="w-4 h-4" />
                  <span className="font-medium">{draftJobs.length} draft job{draftJobs.length > 1 ? "s" : ""} — publish to go live</span>
                </div>
                {draftJobs.map((job: any) => (
                  <Card key={job.id} className="border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20" data-testid={`job-${job.id}`}>
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium truncate">{job.title}</h3>
                            <Badge variant="secondary" className="shrink-0 text-xs">Draft</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2">{job.description}</p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            {job.locationText && <span className="flex items-center gap-1"><MapPin className="w-3 h-3"/>{job.locationText}</span>}
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3"/>{formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}</span>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 shrink-0">
                          <Button
                            size="sm"
                            className="gap-1"
                            onClick={() => publish.mutate(job.id)}
                            disabled={publish.isPending}
                            data-testid={`button-publish-${job.id}`}
                          >
                            <Zap className="w-3 h-3" />
                            {publish.isPending ? "Publishing..." : "Publish"}
                          </Button>
                          <Link href={`/jobs/${job.id}`}>
                            <Button size="sm" variant="outline" className="w-full">View</Button>
                          </Link>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Active/completed jobs */}
            {activeJobs.length > 0 && (
              <div className="space-y-3">
                {activeJobs.map((job: any) => (
                  <Link key={job.id} href={`/jobs/${job.id}`}>
                    <Card className="cursor-pointer hover:shadow-sm transition-all" data-testid={`job-${job.id}`}>
                      <CardContent className="pt-4 pb-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-medium truncate">{job.title}</h3>
                              <Badge variant={STATUS_COLORS[job.status] as any} className="shrink-0 text-xs">
                                {STATUS_LABELS[job.status] || job.status}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-2">{job.description}</p>
                            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                              {job.locationText && <span className="flex items-center gap-1"><MapPin className="w-3 h-3"/>{job.locationText}</span>}
                              <span className="flex items-center gap-1"><Clock className="w-3 h-3"/>{formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}</span>
                              {job.budgetMin && <span>€{job.budgetMin}–€{job.budgetMax}</span>}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
