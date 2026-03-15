import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { MapPin, Clock, Star, Lock, Zap, Users, DollarSign, MessageCircle, Phone, CheckCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

// Unlock Tier Modal — shows result (phone / chat) inline before closing
function UnlockModal({ job, onClose }: { job: any; onClose: () => void }) {
  const { toast } = useToast();
  const { user, refreshUser } = useAuth();
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const [unlockResult, setUnlockResult] = useState<any>(null);
  const [chosenTier, setChosenTier] = useState<"FREE" | "STANDARD" | null>(null);

  const unlock = useMutation({
    mutationFn: async (tier: "FREE" | "STANDARD") => {
      const res = await apiRequest("POST", `/api/jobs/${job.id}/unlock`, { tier });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: (data, tier) => {
      setChosenTier(tier);
      setUnlockResult(data);
      qc.invalidateQueries({ queryKey: ["/api/jobs/feed"] });
      qc.invalidateQueries({ queryKey: ["/api/conversations"] });
      refreshUser();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" })
  });

  if (unlockResult) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-card rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
          <div className="text-center">
            <div className="w-14 h-14 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle className="w-7 h-7 text-accent" />
            </div>
            <h2 className="text-lg font-bold">Lead Unlocked!</h2>
            <p className="text-sm text-muted-foreground">{job.title}</p>
          </div>
          {chosenTier === "STANDARD" && unlockResult.customerPhone && (
            <div className="bg-muted/50 rounded-lg p-3 flex items-center gap-3">
              <Phone className="w-4 h-4 text-accent shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Customer phone</p>
                <p className="font-bold text-sm">{unlockResult.customerPhone}</p>
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <Button className="flex-1 gap-2" onClick={() => { onClose(); setLocation("/pro/chat"); }} data-testid="button-go-to-chat">
              <MessageCircle className="w-4 h-4" /> Open Chat
            </Button>
            <Button variant="outline" className="flex-1" onClick={onClose}>Close</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-card rounded-xl max-w-md w-full p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold mb-1">Unlock Lead</h2>
        <p className="text-sm text-muted-foreground mb-1">Choose how you want to access this lead</p>
        <p className="text-xs bg-primary/10 text-primary rounded px-2 py-1 mb-5 inline-block">Job: {job.title}</p>
        <div className="grid grid-cols-2 gap-4">
          <button onClick={() => unlock.mutate("FREE")} disabled={unlock.isPending}
            className="p-4 rounded-xl border-2 border-border hover:border-primary/40 transition-all text-left"
            data-testid="button-unlock-free">
            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center mb-2"><Lock className="w-4 h-4" /></div>
            <p className="font-semibold text-sm">Free Tier</p>
            <p className="text-xs text-muted-foreground mt-0.5">Chat only</p>
            <p className="text-lg font-bold mt-2 text-accent">0 credits</p>
            <p className="text-xs text-muted-foreground mt-1">Contact details masked</p>
          </button>
          <button onClick={() => unlock.mutate("STANDARD")} disabled={unlock.isPending || (user?.creditBalance || 0) < job.creditCost}
            className={cn("p-4 rounded-xl border-2 transition-all text-left relative overflow-hidden",
              (user?.creditBalance || 0) >= job.creditCost ? "border-primary bg-primary/5 hover:bg-primary/10" : "border-border opacity-50 cursor-not-allowed")}
            data-testid="button-unlock-standard">
            <div className="absolute top-2 right-2"><Badge className="text-xs">Recommended</Badge></div>
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center mb-2"><Zap className="w-4 h-4 text-primary" /></div>
            <p className="font-semibold text-sm">Standard Tier</p>
            <p className="text-xs text-muted-foreground mt-0.5">Chat + Phone number</p>
            <p className="text-lg font-bold mt-2 text-primary">{job.creditCost} credits</p>
            <p className="text-xs text-muted-foreground mt-1">{(user?.creditBalance || 0) < job.creditCost ? `Need ${job.creditCost - (user?.creditBalance || 0)} more credits` : "Full contact access"}</p>
          </button>
        </div>
        <Button variant="outline" className="w-full mt-4" onClick={onClose} disabled={unlock.isPending}>
          {unlock.isPending ? "Processing..." : "Cancel"}
        </Button>
      </div>
    </div>
  );
}

const PAGE_SIZE = 20;

export default function ProJobFeed() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [unlockJob, setUnlockJob] = useState<any | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const { data: pageData = [], isLoading, isFetching } = useQuery<any[]>({
    queryKey: ["/api/jobs/feed", categoryFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (categoryFilter !== "all") params.set("categoryId", categoryFilter);
      const res = await apiRequest("GET", `/api/jobs/feed?${params}`);
      if (!res.ok) throw new Error("Failed to load jobs");
      return res.json();
    },
  });

  const { data: categories = [] } = useQuery<any[]>({ queryKey: ["/api/categories"] });

  const matchbook = useMutation({
    mutationFn: async (jobId: string) => {
      const res = await apiRequest("POST", `/api/jobs/${jobId}/matchbook`);
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      setPage(1);
      setHasMore(true);
      qc.invalidateQueries({ queryKey: ["/api/jobs/feed"] });
      toast({ title: "Matchbooked!" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" })
  });

  // Accumulate page results — use the simplest approach: track loaded pages in state
  const [loadedPages, setLoadedPages] = useState<Record<string, any[]>>({});

  const cacheKey = `${categoryFilter}:${page}`;
  if (pageData.length > 0 && !loadedPages[cacheKey]) {
    setLoadedPages(prev => ({ ...prev, [cacheKey]: pageData }));
    if (pageData.length < PAGE_SIZE) setHasMore(false);
  } else if (pageData.length === 0 && !isLoading && !isFetching && page > 1) {
    setHasMore(false);
  }

  // Flatten all loaded pages in order for this filter
  const displayedJobs: any[] = [];
  for (let p = 1; p <= page; p++) {
    const key = `${categoryFilter}:${p}`;
    if (loadedPages[key]) displayedJobs.push(...loadedPages[key]);
  }

  // Deduplicate by id
  const seen = new Set<string>();
  const filteredJobs = displayedJobs.filter(j => {
    if (seen.has(j.id)) return false;
    seen.add(j.id);
    return true;
  });

  const handleCategoryChange = (value: string) => {
    setCategoryFilter(value);
    setPage(1);
    setHasMore(true);
    setLoadedPages({});
  };

  const handleLoadMore = () => {
    setPage(p => p + 1);
  };

  const URGENCY_COLORS: Record<string, string> = { LOW: "secondary", NORMAL: "outline", HIGH: "default", URGENT: "destructive" };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Job Feed</h1>
          <Select value={categoryFilter} onValueChange={handleCategoryChange}>
            <SelectTrigger className="w-40"><SelectValue placeholder="All categories" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {(categories as any[]).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {isLoading && page === 1 ? (
          <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />)}</div>
        ) : filteredJobs.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">No jobs available</div>
        ) : (
          <>
            <div className="space-y-3">
              {filteredJobs.map((job: any) => (
                <Card key={job.id} className={cn("job-card transition-all", job.isBoosted && "border-primary/40 ring-1 ring-primary/20")} data-testid={`feed-job-${job.id}`}>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {job.isBoosted && <Badge className="text-xs bg-amber-500">Boosted</Badge>}
                          <Badge variant={URGENCY_COLORS[job.urgency] as any} className="text-xs">{job.urgency}</Badge>
                          <Badge variant="outline" className="text-xs">{job.category?.name}</Badge>
                        </div>
                        <h3 className="font-semibold">{job.title}</h3>
                        <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{job.description}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground mb-3">
                      {job.locationText && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{job.locationText}</span>}
                      {job.budgetMin && <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />€{job.budgetMin}–€{job.budgetMax}</span>}
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}</span>
                      <span className="flex items-center gap-1"><Users className="w-3 h-3" />{String(job.matchbookCount || 0)} interested</span>
                    </div>
                    <div className="flex gap-2">
                      {job.unlock ? (
                        <Badge variant="outline" className="gap-1"><Lock className="w-3 h-3" /> Unlocked ({job.unlock.tier})</Badge>
                      ) : job.isMatchbooked ? (
                        <Button size="sm" className="gap-1" onClick={() => setUnlockJob(job)} data-testid={`button-unlock-${job.id}`}>
                          <Lock className="w-3 h-3" /> Unlock ({job.creditCost}cr)
                        </Button>
                      ) : (
                        <>
                          <Button size="sm" variant="outline" className="gap-1" onClick={() => matchbook.mutate(job.id)} disabled={matchbook.isPending} data-testid={`button-matchbook-${job.id}`}>
                            <Star className="w-3 h-3" /> Matchbook
                          </Button>
                          <Button size="sm" variant="ghost" className="text-muted-foreground">Skip</Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Load More */}
            {hasMore && (
              <div className="pt-2 flex justify-center">
                <Button
                  variant="outline"
                  onClick={handleLoadMore}
                  disabled={isFetching}
                  data-testid="button-load-more-jobs"
                >
                  {isFetching ? "Loading..." : `Load more jobs`}
                </Button>
              </div>
            )}
            {!hasMore && filteredJobs.length > PAGE_SIZE && (
              <p className="text-center text-xs text-muted-foreground pt-2">All jobs loaded</p>
            )}
          </>
        )}
      </div>
      {unlockJob && <UnlockModal job={unlockJob} onClose={() => setUnlockJob(null)} />}
    </DashboardLayout>
  );
}
