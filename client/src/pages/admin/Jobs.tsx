import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusPill } from "@/components/ui/status-pill";
import { ListSkeleton } from "@/components/ui/loading-skeleton";
import {
  Briefcase, Flame, ShieldAlert, Search, ChevronLeft, ChevronRight,
  MapPin, Clock, Coins, BarChart3, Eye, Loader2, Inbox, Zap
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Link } from "wouter";

const STATUS_CONFIG: Record<string, { variant: string; label: string; color: string }> = {
  DRAFT: { variant: "secondary", label: "Draft", color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  LIVE: { variant: "default", label: "Live", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  IN_DISCUSSION: { variant: "secondary", label: "In Discussion", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  AFTERCARE_2D: { variant: "destructive", label: "Aftercare (2d)", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
  AFTERCARE_5D: { variant: "destructive", label: "Aftercare (5d)", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  BOOSTED: { variant: "default", label: "Boosted", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  COMPLETED: { variant: "outline", label: "Completed", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  CLOSED: { variant: "secondary", label: "Closed", color: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400" },
};

const ALL_STATUSES = ["DRAFT", "LIVE", "BOOSTED", "IN_DISCUSSION", "AFTERCARE_2D", "AFTERCARE_5D", "COMPLETED", "CLOSED"];
const PAGE_SIZE = 20;

function QualityBar({ score }: { score: number | null }) {
  if (score == null) return <span className="text-xs text-muted-foreground">N/A</span>;
  const color = score >= 70 ? "bg-green-500" : score >= 40 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-muted/50 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-medium text-muted-foreground">{score}</span>
    </div>
  );
}

export default function AdminJobs() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const params = new URLSearchParams();
  if (statusFilter !== "all") params.set("status", statusFilter);
  if (search) params.set("search", search);
  params.set("limit", String(PAGE_SIZE));
  params.set("offset", String((page - 1) * PAGE_SIZE));

  const { data, isLoading } = useQuery<any>({ queryKey: [`/api/admin/jobs?${params}`] });
  const jobs = data?.jobs || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const publishJob = useMutation({
    mutationFn: async (jobId: string) => {
      const res = await apiRequest("POST", `/api/jobs/${jobId}/publish`, {});
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string)?.startsWith("/api/admin/jobs") });
      toast({ title: "Job published successfully" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const closeJob = useMutation({
    mutationFn: async (jobId: string) => {
      const res = await apiRequest("DELETE", `/api/jobs/${jobId}`, {});
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string)?.startsWith("/api/admin/jobs") });
      toast({ title: "Job closed" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Status summary counts
  const statusCounts = ALL_STATUSES.reduce((acc, s) => {
    acc[s] = (jobs as any[]).filter((j: any) => j.status === s).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <DashboardLayout>
      <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
        <PageHeader
          eyebrow="Admin"
          title="Job management"
          description={`${total.toLocaleString()} jobs total. Review, publish, moderate or close any listing across the platform.`}
          icon={<Briefcase className="w-5 h-5" />}
        />

        {/* Search & Filter Bar */}
        <div className="bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-2xl p-4 shadow-sm">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search jobs by title or location..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="pl-9 rounded-xl border-border/60 focus:border-primary focus:ring-primary/20"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
              <SelectTrigger className="w-full sm:w-48 rounded-xl">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {ALL_STATUSES.map(s => (
                  <SelectItem key={s} value={s}>
                    <span className="flex items-center gap-2">
                      <span className={cn("w-2 h-2 rounded-full", STATUS_CONFIG[s]?.color.split(" ")[0])} />
                      {STATUS_CONFIG[s]?.label || s}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Job List */}
        {isLoading ? (
          <ListSkeleton rows={5} />
        ) : jobs.length === 0 ? (
          <EmptyState
            icon={<Inbox className="w-6 h-6" />}
            title="No jobs found"
            description={search ? "Try a different search term or clear your filters." : "No jobs have been posted yet. When customers post jobs, they'll appear here."}
            primaryAction={
              search || statusFilter !== "all" ? (
                <Button variant="outline" className="rounded-xl" onClick={() => { setSearch(""); setStatusFilter("all"); setPage(1); }}>Clear filters</Button>
              ) : undefined
            }
          />
        ) : (
          <div className="space-y-2">
            {jobs.map((job: any) => {
              const statusConf = STATUS_CONFIG[job.status] || { variant: "secondary", label: job.status, color: "" };
              return (
                <Link
                  key={job.id}
                  href={`/admin/jobs/${job.id}`}
                  data-testid={`admin-job-${job.id}`}
                  className="block bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-2xl p-4 md:p-5 hover:shadow-md transition-all duration-200 group cursor-pointer"
                >
                  <div className="flex flex-col md:flex-row md:items-center gap-4">
                    {/* Left: Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
                        <p className="font-semibold text-sm truncate group-hover:text-primary transition-colors">{job.title}</p>
                        <Badge className={cn("text-[11px] px-2 py-0.5 rounded-full font-semibold border-0", statusConf.color)}>
                          {statusConf.label}
                        </Badge>
                        {job.isBoosted && (
                          <Badge className="text-[10px] bg-amber-500 text-white border-0 gap-0.5">
                            <Zap className="w-2.5 h-2.5" /> Boosted
                          </Badge>
                        )}
                        {job.aiIsUrgent && (
                          <Badge className="text-[10px] bg-red-600 text-white border-0 gap-0.5">
                            <Flame className="w-2.5 h-2.5" /> Urgent
                          </Badge>
                        )}
                        {job.aiIsFakeFlag && (
                          <Badge className="text-[10px] bg-orange-600 text-white border-0 gap-0.5">
                            <ShieldAlert className="w-2.5 h-2.5" /> Flagged
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                        {job.locationText && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> {job.locationText}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
                        </span>
                        <span className="flex items-center gap-1">
                          <Coins className="w-3 h-3" /> {job.creditCost} credits
                        </span>
                        {job.aiQualityScore != null && (
                          <span className="flex items-center gap-1.5">
                            <BarChart3 className="w-3 h-3" /> Quality: <QualityBar score={job.aiQualityScore} />
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.preventDefault()}>
                      {job.status === "DRAFT" && (
                        <Button
                          size="sm"
                          className="gap-1.5 rounded-xl bg-green-600 hover:bg-green-700 text-white shadow-sm"
                          onClick={(e) => { e.preventDefault(); publishJob.mutate(job.id); }}
                          disabled={publishJob.isPending}
                          data-testid={`button-publish-${job.id}`}
                        >
                          {publishJob.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
                          Publish
                        </Button>
                      )}
                      {!["CLOSED", "COMPLETED"].includes(job.status) && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10 rounded-xl"
                          onClick={(e) => { e.preventDefault(); closeJob.mutate(job.id); }}
                          disabled={closeJob.isPending}
                          data-testid={`button-close-${job.id}`}
                        >
                          Close
                        </Button>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-muted-foreground">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total} jobs
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1 rounded-xl"
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
              >
                <ChevronLeft className="w-4 h-4" /> Previous
              </Button>
              <span className="text-sm font-medium px-2">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="gap-1 rounded-xl"
                disabled={page >= totalPages}
                onClick={() => setPage(p => p + 1)}
              >
                Next <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
