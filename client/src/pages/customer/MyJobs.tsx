import { useState, useMemo } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusPill } from "@/components/ui/status-pill";
import { ListSkeleton } from "@/components/ui/loading-skeleton";
import {
  Briefcase, PlusCircle, MapPin, Clock, Zap, AlertCircle, Hash, FileText,
  Euro, Search as SearchIcon,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";

type Filter = "all" | "active" | "drafts" | "closed";

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
      toast({ title: "Job published", description: "Your job is now live — verified professionals can start quoting." });
    },
    onError: (e: any) => toast({ title: "Couldn't publish", description: e.message, variant: "destructive" }),
  });

  const { data: quoteSummaryData } = useQuery<any>({ queryKey: ["/api/quotes?summary=jobCounts"] });
  const quoteSummaryByJob = quoteSummaryData?.byJob || {};
  const pendingByJob: Record<string, number> = Object.fromEntries(
    Object.entries(quoteSummaryByJob).map(([jobId, summary]: [string, any]) => [jobId, summary.pending || 0])
  );

  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [showClosed, setShowClosed] = useState(false);

  const draftJobs = (jobs as any[]).filter(j => j.status === "DRAFT");
  const liveJobs = (jobs as any[]).filter(j =>
    ["LIVE", "IN_DISCUSSION", "BOOSTED", "AFTERCARE_2D", "AFTERCARE_5D"].includes(j.status)
  );
  const closedJobs = (jobs as any[]).filter(j =>
    ["COMPLETED", "CLOSED"].includes(j.status)
  );

  const filteredDraft = useMemo(
    () => (filter === "all" || filter === "drafts" ? draftJobs : []).filter(
      (j) => !search || j.title?.toLowerCase().includes(search.toLowerCase())
    ),
    [filter, search, draftJobs],
  );
  const filteredLive = useMemo(
    () => (filter === "all" || filter === "active" ? liveJobs : []).filter(
      (j) => !search || j.title?.toLowerCase().includes(search.toLowerCase())
    ),
    [filter, search, liveJobs],
  );
  const filteredClosed = useMemo(
    () => (filter === "all" || filter === "closed" ? closedJobs : []).filter(
      (j) => !search || j.title?.toLowerCase().includes(search.toLowerCase())
    ),
    [filter, search, closedJobs],
  );
  const visibleClosedJobs = showClosed ? filteredClosed : filteredClosed.slice(0, 3);

  const totalCount = (jobs as any[]).length;
  const hasAnyFiltered = filteredDraft.length + filteredLive.length + filteredClosed.length > 0;

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-[1200px] mx-auto">
        <PageHeader
          eyebrow="Customer"
          title="My jobs"
          description={`${totalCount} job${totalCount === 1 ? "" : "s"} total. Track status, quotes and next steps in one place.`}
          icon={<Briefcase className="w-5 h-5" />}
          actions={
            <Link href="/post-job">
              <Button size="sm" className="gap-2 rounded-xl shadow-md shadow-primary/20" data-testid="button-post-job">
                <PlusCircle className="w-4 h-4" /> Post a job
              </Button>
            </Link>
          }
        />

        {/* Filters + search bar */}
        {totalCount > 0 && (
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-2xl px-3 py-2.5 shadow-sm">
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
              {([
                { key: "all", label: `All (${totalCount})` },
                { key: "active", label: `Active (${liveJobs.length})` },
                { key: "drafts", label: `Drafts (${draftJobs.length})` },
                { key: "closed", label: `Closed (${closedJobs.length})` },
              ] as { key: Filter; label: string }[]).map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition whitespace-nowrap ${
                    filter === f.key
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-white/60 dark:hover:bg-white/5"
                  }`}
                  data-testid={`filter-${f.key}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="relative w-full md:w-64 shrink-0">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by title"
                className="pl-9 h-9 text-sm bg-white/80 dark:bg-black/40"
                data-testid="input-search-jobs"
              />
            </div>
          </div>
        )}

        {isLoading ? (
          <ListSkeleton rows={4} />
        ) : totalCount === 0 ? (
          <EmptyState
            icon={<Briefcase className="w-7 h-7" />}
            title="No jobs posted yet"
            description="Post your first job and start receiving quotes from verified professionals — most customers get their first quote within 30 minutes."
            primaryAction={
              <Link href="/post-job">
                <Button className="gap-2 rounded-xl shadow-md shadow-primary/20">
                  <PlusCircle className="w-4 h-4" /> Post your first job
                </Button>
              </Link>
            }
            secondaryAction={
              <Link href="/services">
                <Button variant="ghost" className="rounded-xl">Browse services</Button>
              </Link>
            }
          />
        ) : !hasAnyFiltered ? (
          <EmptyState
            icon={<SearchIcon className="w-6 h-6" />}
            title="No jobs match your filters"
            description="Try a different filter or clear your search."
            primaryAction={
              <Button variant="outline" className="rounded-xl" onClick={() => { setFilter("all"); setSearch(""); }}>Clear filters</Button>
            }
          />
        ) : (
          <div className="space-y-6">
            {/* Drafts — prominent */}
            {filteredDraft.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 py-2 px-3 rounded-xl border border-amber-200/60 dark:border-amber-900/60 w-fit">
                  <AlertCircle className="w-4 h-4" />
                  <span className="font-medium">
                    {filteredDraft.length} draft{filteredDraft.length > 1 ? "s" : ""} — publish to start receiving quotes
                  </span>
                </div>
                {filteredDraft.map((job: any) => (
                  <Card
                    key={job.id}
                    className="border-amber-200/60 dark:border-amber-900/60 bg-gradient-to-br from-amber-50/60 to-white/70 dark:from-amber-950/20 dark:to-black/40 backdrop-blur-xl rounded-2xl shadow-sm overflow-hidden"
                    data-testid={`job-${job.id}`}
                  >
                    <CardContent className="p-5">
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <h3 className="font-bold text-lg truncate">{job.title}</h3>
                            <StatusPill status="DRAFT" />
                            {job.referenceCode && (
                              <span className="text-xs font-mono text-muted-foreground flex items-center gap-1">
                                <Hash className="w-3 h-3" />{job.referenceCode}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">{job.description}</p>
                          <JobMeta job={job} />
                        </div>
                        <div className="flex md:flex-col gap-2 shrink-0 w-full md:w-auto">
                          <Button
                            size="sm"
                            className="gap-2 rounded-xl flex-1 md:flex-none shadow-sm"
                            onClick={() => publish.mutate(job.id)}
                            disabled={publish.isPending}
                            data-testid={`button-publish-${job.id}`}
                          >
                            <Zap className="w-4 h-4" />
                            {publish.isPending ? "Publishing…" : "Publish"}
                          </Button>
                          <Link href={`/jobs/${job.id}`} className="flex-1 md:flex-none">
                            <Button size="sm" variant="outline" className="w-full rounded-xl">Review</Button>
                          </Link>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Active / live jobs */}
            {filteredLive.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
                  Active ({filteredLive.length})
                </h2>
                {filteredLive.map((job: any) => (
                  <Link key={job.id} href={`/jobs/${job.id}`}>
                    <Card
                      className="cursor-pointer transition-all duration-300 hover:shadow-md hover:border-primary/20 bg-white/60 dark:bg-black/40 backdrop-blur-xl border-white/40 dark:border-white/10 rounded-2xl overflow-hidden group mb-3 block"
                      data-testid={`job-${job.id}`}
                    >
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <h3 className="font-bold text-base md:text-lg truncate group-hover:text-primary transition-colors">{job.title}</h3>
                              <StatusPill status={job.status} />
                              {pendingByJob[job.id] > 0 && (
                                <StatusPill
                                  status="PENDING_QUOTES"
                                  tone="info"
                                  label={`${pendingByJob[job.id]} new quote${pendingByJob[job.id] > 1 ? "s" : ""}`}
                                  icon={<FileText className="w-3 h-3" />}
                                />
                              )}
                              {job.referenceCode && (
                                <span className="text-xs font-mono text-muted-foreground flex items-center gap-1">
                                  <Hash className="w-3 h-3" />{job.referenceCode}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">{job.description}</p>
                            {(quoteSummaryByJob[job.id]?.total || 0) > 0 && (
                              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                <FileText className="w-3 h-3" />
                                {quoteSummaryByJob[job.id].total} quote{quoteSummaryByJob[job.id].total > 1 ? "s" : ""} received
                              </p>
                            )}
                            <JobMeta job={job} />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}

            {/* Closed / completed jobs */}
            {filteredClosed.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
                  Closed ({filteredClosed.length})
                </h2>
                {visibleClosedJobs.map((job: any) => (
                  <Link key={job.id} href={`/jobs/${job.id}`}>
                    <Card
                      className="cursor-pointer transition-all duration-300 hover:shadow-md bg-white/40 dark:bg-black/30 backdrop-blur-xl border-white/30 dark:border-white/5 rounded-2xl overflow-hidden group mb-3 block opacity-80"
                      data-testid={`job-${job.id}`}
                    >
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <h3 className="font-bold text-base md:text-lg truncate group-hover:text-primary transition-colors">{job.title}</h3>
                              <StatusPill status={job.status} />
                              {job.referenceCode && (
                                <span className="text-xs font-mono text-muted-foreground flex items-center gap-1">
                                  <Hash className="w-3 h-3" />{job.referenceCode}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">{job.description}</p>
                            <JobMeta job={job} />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
                {filteredClosed.length > 3 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full rounded-xl text-muted-foreground hover:text-foreground"
                    onClick={() => setShowClosed(prev => !prev)}
                  >
                    {showClosed
                      ? "Show fewer past jobs"
                      : `Show all ${filteredClosed.length} past jobs`}
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

function JobMeta({ job }: { job: any }) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-4 text-xs text-muted-foreground bg-white/40 dark:bg-white/5 backdrop-blur-sm p-3 rounded-xl border border-white/20 dark:border-white/5 w-fit">
      {job.locationText && (
        <span className="flex items-center gap-1.5 font-medium text-foreground/80">
          <MapPin className="w-3.5 h-3.5 text-primary/70" />{job.locationText}
        </span>
      )}
      <span className="flex items-center gap-1.5">
        <Clock className="w-3.5 h-3.5 text-muted-foreground/70" />
        {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
      </span>
      {job.budgetMin && (
        <span className="flex items-center gap-1.5 font-medium text-foreground/80">
          <Euro className="w-3.5 h-3.5 text-emerald-500/80" />
          €{job.budgetMin}–€{job.budgetMax}
        </span>
      )}
    </div>
  );
}
