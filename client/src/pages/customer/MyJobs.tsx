import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Briefcase, PlusCircle, MapPin, Clock, Zap, AlertCircle, Hash, FileText } from "lucide-react";
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

  const { data: quoteSummaryData } = useQuery<any>({ queryKey: ["/api/quotes?summary=jobCounts"] });
  const quoteSummaryByJob = quoteSummaryData?.byJob || {};
  const pendingByJob: Record<string, number> = Object.fromEntries(
    Object.entries(quoteSummaryByJob).map(([jobId, summary]: [string, any]) => [jobId, summary.pending || 0])
  );

  const [showClosed, setShowClosed] = useState(false);

  const draftJobs = (jobs as any[]).filter(j => j.status === "DRAFT");
  const liveJobs = (jobs as any[]).filter(j =>
    ["LIVE", "IN_DISCUSSION", "BOOSTED", "AFTERCARE_2D", "AFTERCARE_5D"].includes(j.status)
  );
  const closedJobs = (jobs as any[]).filter(j =>
    ["COMPLETED", "CLOSED"].includes(j.status)
  );
  const visibleClosedJobs = showClosed ? closedJobs : closedJobs.slice(0, 3);

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-heading font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300">My Jobs</h1>
            <p className="text-sm text-muted-foreground mt-1">{(jobs as any[]).length} total jobs</p>
          </div>
          <Link href="/post-job">
            <Button size="sm" className="gap-2 h-10 px-4 rounded-xl shadow-[0_4px_14px_0_rgba(var(--primary),0.39)] hover:shadow-[0_6px_20px_rgba(var(--primary),0.23)] hover:-translate-y-0.5 transition-all">
              <PlusCircle className="w-4 h-4" /> Post Job
            </Button>
          </Link>
        </div>

        {isLoading ? (
          <div className="space-y-4">{[1,2,3].map(i=><div key={i} className="h-24 rounded-2xl bg-white/40 dark:bg-white/5 animate-pulse"/>)}</div>
        ) : (jobs as any[]).length === 0 ? (
          <div className="text-center py-24 text-muted-foreground bg-white/40 dark:bg-black/20 backdrop-blur-md rounded-3xl border border-white/20 dark:border-white/5">
            <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
              <Briefcase className="w-8 h-8 opacity-50" />
            </div>
            <p className="font-heading font-medium text-lg text-foreground">No jobs posted yet</p>
            <p className="text-sm mt-2 max-w-xs mx-auto">Post your first job and start receiving quotes from trusted professionals in minutes.</p>
            <Link href="/post-job"><Button className="mt-6 rounded-xl shadow-lg">Post your first job</Button></Link>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Draft jobs — prominent banner to publish */}
            {draftJobs.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/20 py-2 px-3 rounded-xl border border-amber-200/50 dark:border-amber-900/50 w-fit">
                  <AlertCircle className="w-4 h-4" />
                  <span className="font-medium">{draftJobs.length} draft job{draftJobs.length > 1 ? "s" : ""} — publish to go live</span>
                </div>
                {draftJobs.map((job: any) => (
                  <Card key={job.id} className="border-amber-200/60 dark:border-amber-900/60 bg-gradient-to-br from-amber-50/50 to-white/60 dark:from-amber-950/20 dark:to-black/40 backdrop-blur-xl rounded-2xl shadow-sm overflow-hidden" data-testid={`job-${job.id}`}>
                    <CardContent className="p-5">
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-heading font-bold text-lg truncate">{job.title}</h3>
                            <Badge variant="secondary" className="shrink-0 text-xs bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900">Draft</Badge>
                            {job.referenceCode && <span className="text-xs font-mono text-muted-foreground flex items-center gap-1"><Hash className="w-3 h-3" />{job.referenceCode}</span>}
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">{job.description}</p>
                          <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-muted-foreground">
                            {job.locationText && <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-primary/70"/>{job.locationText}</span>}
                            <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-muted-foreground/70"/>{formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}</span>
                          </div>
                        </div>
                        <div className="flex md:flex-col gap-2 shrink-0 w-full md:w-auto mt-4 md:mt-0">
                          <Button
                            size="sm"
                            className="gap-2 rounded-xl flex-1 md:flex-none shadow-sm"
                            onClick={() => publish.mutate(job.id)}
                            disabled={publish.isPending}
                            data-testid={`button-publish-${job.id}`}
                          >
                            <Zap className="w-4 h-4" />
                            {publish.isPending ? "Publishing..." : "Publish"}
                          </Button>
                          <Link href={`/jobs/${job.id}`} className="flex-1 md:flex-none">
                            <Button size="sm" variant="outline" className="w-full rounded-xl bg-white/50 dark:bg-black/50 backdrop-blur-sm">View</Button>
                          </Link>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Active / live jobs */}
            {liveJobs.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">
                  Active ({liveJobs.length})
                </h2>
                {liveJobs.map((job: any) => (
                  <Link key={job.id} href={`/jobs/${job.id}`}>
                    <Card className="cursor-pointer transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:hover:shadow-[0_8px_30px_rgb(0,0,0,0.2)] bg-white/60 dark:bg-black/40 backdrop-blur-xl border-white/40 dark:border-white/10 rounded-2xl overflow-hidden group mb-4 block" data-testid={`job-${job.id}`}>
                      <CardContent className="p-5 md:p-6">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-2 flex-wrap">
                              <h3 className="font-heading font-bold text-lg truncate group-hover:text-primary transition-colors">{job.title}</h3>
                              <Badge variant={STATUS_COLORS[job.status] as any} className="shrink-0 text-xs bg-white/50 dark:bg-black/50 backdrop-blur shadow-sm">
                                {STATUS_LABELS[job.status] || job.status}
                              </Badge>
                              {pendingByJob[job.id] > 0 && (
                                <Badge variant="outline" className="text-xs border-blue-300 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 shrink-0 font-semibold">
                                  {pendingByJob[job.id]} new quote{pendingByJob[job.id] > 1 ? "s" : ""}
                                </Badge>
                              )}
                              {job.referenceCode && <span className="text-xs font-mono text-muted-foreground flex items-center gap-1"><Hash className="w-3 h-3" />{job.referenceCode}</span>}
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">{job.description}</p>
                            {(quoteSummaryByJob[job.id]?.total || 0) > 0 && (
                              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                <FileText className="w-3 h-3" />
                                {quoteSummaryByJob[job.id].total} quote{quoteSummaryByJob[job.id].total > 1 ? "s" : ""} received
                              </p>
                            )}
                            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-4 text-xs text-muted-foreground bg-white/40 dark:bg-white/5 backdrop-blur-sm p-3 rounded-xl border border-white/20 dark:border-white/5 w-fit">
                              {job.locationText && <span className="flex items-center gap-1.5 font-medium text-foreground/80"><MapPin className="w-4 h-4 text-primary/70"/>{job.locationText}</span>}
                              <span className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-muted-foreground/70"/>{formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}</span>
                              {job.budgetMin && <span className="flex items-center gap-1.5 font-medium text-foreground/80"><Zap className="w-4 h-4 text-green-500/70" />€{job.budgetMin}–€{job.budgetMax}</span>}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}

            {/* Closed / completed jobs */}
            {closedJobs.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">
                  Closed ({closedJobs.length})
                </h2>
                {visibleClosedJobs.map((job: any) => (
                  <Link key={job.id} href={`/jobs/${job.id}`}>
                    <Card className="cursor-pointer transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:hover:shadow-[0_8px_30px_rgb(0,0,0,0.2)] bg-white/40 dark:bg-black/30 backdrop-blur-xl border-white/30 dark:border-white/5 rounded-2xl overflow-hidden group mb-4 block opacity-80" data-testid={`job-${job.id}`}>
                      <CardContent className="p-5 md:p-6">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-2 flex-wrap">
                              <h3 className="font-heading font-bold text-lg truncate group-hover:text-primary transition-colors">{job.title}</h3>
                              <Badge variant={STATUS_COLORS[job.status] as any} className="shrink-0 text-xs bg-white/50 dark:bg-black/50 backdrop-blur shadow-sm">
                                {STATUS_LABELS[job.status] || job.status}
                              </Badge>
                              {job.referenceCode && <span className="text-xs font-mono text-muted-foreground flex items-center gap-1"><Hash className="w-3 h-3" />{job.referenceCode}</span>}
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">{job.description}</p>
                            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-4 text-xs text-muted-foreground bg-white/40 dark:bg-white/5 backdrop-blur-sm p-3 rounded-xl border border-white/20 dark:border-white/5 w-fit">
                              {job.locationText && <span className="flex items-center gap-1.5 font-medium text-foreground/80"><MapPin className="w-4 h-4 text-primary/70"/>{job.locationText}</span>}
                              <span className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-muted-foreground/70"/>{formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}</span>
                              {job.budgetMin && <span className="flex items-center gap-1.5 font-medium text-foreground/80"><Zap className="w-4 h-4 text-green-500/70" />€{job.budgetMin}–€{job.budgetMax}</span>}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
                {closedJobs.length > 3 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full rounded-xl text-muted-foreground hover:text-foreground"
                    onClick={() => setShowClosed(prev => !prev)}
                  >
                    {showClosed
                      ? "Show fewer past jobs"
                      : `Show all ${closedJobs.length} past jobs`}
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
