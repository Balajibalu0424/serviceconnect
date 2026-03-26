import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  MapPin, Clock, Star, Lock, Zap, Users, DollarSign, MessageCircle,
  Phone, CheckCircle, Flame, Send, ChevronDown, ChevronUp, Euro
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

// ─── Unlock Modal ────────────────────────────────────────────────────────────
function UnlockModal({ job, onClose, onUnlocked }: { job: any; onClose: () => void; onUnlocked: (result: any, tier: string) => void }) {
  const { toast } = useToast();
  const { user, refreshUser } = useAuth();
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
            <div className="w-14 h-14 bg-green-100 dark:bg-green-950 rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle className="w-7 h-7 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-lg font-bold">Lead Unlocked!</h2>
            <p className="text-sm text-muted-foreground">{job.title}</p>
          </div>
          {chosenTier === "STANDARD" && unlockResult.customerPhone && (
            <div className="bg-muted/50 rounded-lg p-3 flex items-center gap-3">
              <Phone className="w-4 h-4 text-primary shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Customer's phone number</p>
                <p className="font-bold">{unlockResult.customerPhone}</p>
              </div>
            </div>
          )}
          <p className="text-sm text-center text-muted-foreground">
            Now send a quote to win this job. The customer will see it and can accept or decline.
          </p>
          <div className="flex gap-2">
            <Button className="flex-1 gap-2" onClick={() => { onUnlocked(unlockResult, chosenTier!); onClose(); }} data-testid="button-send-quote">
              <Send className="w-4 h-4" /> Send a Quote
            </Button>
            <Button variant="outline" className="flex-1 gap-2" onClick={() => { onUnlocked(null, chosenTier!); onClose(); }}>
              <MessageCircle className="w-4 h-4" /> Just Chat
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-card rounded-xl max-w-md w-full p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold mb-1">Unlock Lead</h2>
        <p className="text-sm text-muted-foreground mb-1">Choose your access level for this job</p>
        <p className="text-xs bg-primary/10 text-primary rounded px-2 py-1 mb-5 inline-block font-medium">{job.title}</p>

        <div className="grid grid-cols-2 gap-4 mb-4">
          {/* Free tier */}
          <button
            onClick={() => unlock.mutate("FREE")}
            disabled={unlock.isPending}
            className="p-4 rounded-xl border-2 border-border hover:border-primary/40 transition-all text-left"
            data-testid="button-unlock-free"
          >
            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center mb-3">
              <Lock className="w-4 h-4 text-muted-foreground" />
            </div>
            <p className="font-semibold text-sm">Free</p>
            <p className="text-xs text-muted-foreground mt-0.5">Chat only · contact masked</p>
            <p className="text-xl font-bold mt-2 text-green-600">0 credits</p>
            <p className="text-xs text-muted-foreground mt-1">Good for introductions</p>
          </button>

          {/* Standard tier */}
          <button
            onClick={() => unlock.mutate("STANDARD")}
            disabled={unlock.isPending || (user?.creditBalance || 0) < job.creditCost}
            className={cn(
              "p-4 rounded-xl border-2 transition-all text-left relative overflow-hidden",
              (user?.creditBalance || 0) >= job.creditCost
                ? "border-primary bg-primary/5 hover:bg-primary/10"
                : "border-border opacity-50 cursor-not-allowed"
            )}
            data-testid="button-unlock-standard"
          >
            <div className="absolute top-2 right-2">
              <Badge className="text-[10px] px-1.5 py-0">Best</Badge>
            </div>
            <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center mb-3">
              <Zap className="w-4 h-4 text-primary" />
            </div>
            <p className="font-semibold text-sm">Standard</p>
            <p className="text-xs text-muted-foreground mt-0.5">Chat + phone number</p>
            <p className="text-xl font-bold mt-2 text-primary">{job.creditCost} credits</p>
            <p className="text-xs text-muted-foreground mt-1">
              {(user?.creditBalance || 0) < job.creditCost
                ? `Need ${job.creditCost - (user?.creditBalance || 0)} more`
                : "Full contact access"}
            </p>
          </button>
        </div>

        <Button variant="outline" className="w-full" onClick={onClose} disabled={unlock.isPending}>
          {unlock.isPending ? "Processing…" : "Cancel"}
        </Button>
      </div>
    </div>
  );
}

// ─── Inline Quote Form ───────────────────────────────────────────────────────
function InlineQuoteForm({ job, onSent }: { job: any; onSent: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [duration, setDuration] = useState("");
  const [expanded, setExpanded] = useState(true);

  const sendQuote = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/quotes", {
        jobId: job.id, amount: parseFloat(amount),
        message: message || undefined,
        estimatedDuration: duration || undefined,
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/quotes"] });
      qc.invalidateQueries({ queryKey: ["/api/jobs/feed"] });
      toast({ title: "Quote sent!", description: "The customer will be notified and can accept or decline." });
      onSent();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" })
  });

  return (
    <div className="mt-3 border-t border-border pt-3">
      <button
        className="flex items-center gap-2 text-sm font-medium text-primary w-full text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <Send className="w-3.5 h-3.5" />
        Send Quote to Win This Job
        {expanded ? <ChevronUp className="w-3.5 h-3.5 ml-auto" /> : <ChevronDown className="w-3.5 h-3.5 ml-auto" />}
      </button>

      {expanded && (
        <div className="mt-3 space-y-3 p-3 rounded-lg bg-muted/30 border border-border/50">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Your quote (€) *</Label>
              <div className="relative mt-1">
                <Euro className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  type="number" min={1} step={1}
                  value={amount} onChange={e => setAmount(e.target.value)}
                  placeholder="150" className="pl-8 h-9 text-sm"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Estimated time</Label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Under 1 hour">Under 1 hour</SelectItem>
                  <SelectItem value="1-2 hours">1–2 hours</SelectItem>
                  <SelectItem value="Half a day">Half a day</SelectItem>
                  <SelectItem value="1 day">1 day</SelectItem>
                  <SelectItem value="2-3 days">2–3 days</SelectItem>
                  <SelectItem value="1 week+">1 week+</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-xs">Message to customer <span className="text-muted-foreground">(recommended)</span></Label>
            <Textarea
              value={message} onChange={e => setMessage(e.target.value)}
              placeholder="Introduce yourself, mention your experience with this type of job, and confirm your availability…"
              rows={3} className="mt-1 text-sm"
            />
          </div>

          <div className="flex gap-2">
            <Button
              size="sm" className="gap-1.5"
              onClick={() => sendQuote.mutate()}
              disabled={!amount || sendQuote.isPending}
            >
              {sendQuote.isPending ? "Sending…" : <><Send className="w-3.5 h-3.5" /> Send Quote (€{amount || "—"})</>}
            </Button>
            <Button size="sm" variant="ghost" onClick={onSent} className="text-muted-foreground">
              Skip for now
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            The customer will get a notification and can accept or decline your quote.
            If accepted, a booking is automatically created.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Main Feed ───────────────────────────────────────────────────────────────
const PAGE_SIZE = 20;

export default function ProJobFeed() {
  const qc = useQueryClient();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [unlockJob, setUnlockJob] = useState<any | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  // Track which jobs should show inline quote form after unlock
  const [quoteJobId, setQuoteJobId] = useState<string | null>(null);

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
      setPage(1); setHasMore(true); setLoadedPages({});
      qc.invalidateQueries({ queryKey: ["/api/jobs/feed"] });
      toast({ title: "Matchbooked!", description: "Saved to your matchbooked list. Unlock when ready." });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" })
  });

  const [loadedPages, setLoadedPages] = useState<Record<string, any[]>>({});
  const cacheKey = `${categoryFilter}:${page}`;
  if (pageData.length > 0 && !loadedPages[cacheKey]) {
    setLoadedPages(prev => ({ ...prev, [cacheKey]: pageData }));
    if (pageData.length < PAGE_SIZE) setHasMore(false);
  } else if (pageData.length === 0 && !isLoading && !isFetching && page > 1) {
    setHasMore(false);
  }

  const displayedJobs: any[] = [];
  for (let p = 1; p <= page; p++) {
    const key = `${categoryFilter}:${p}`;
    if (loadedPages[key]) displayedJobs.push(...loadedPages[key]);
  }
  const seen = new Set<string>();
  const filteredJobs = displayedJobs.filter(j => { if (seen.has(j.id)) return false; seen.add(j.id); return true; });

  const handleCategoryChange = (value: string) => {
    setCategoryFilter(value); setPage(1); setHasMore(true); setLoadedPages({});
  };

  const URGENCY_COLORS: Record<string, string> = { LOW: "secondary", NORMAL: "outline", HIGH: "default", URGENT: "destructive" };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Job Feed</h1>
            <p className="text-sm text-muted-foreground">Browse live jobs and send quotes to win work</p>
          </div>
          <Select value={categoryFilter} onValueChange={handleCategoryChange}>
            <SelectTrigger className="w-40"><SelectValue placeholder="All categories" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {(categories as any[]).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* How it works — shown when no jobs unlocked yet */}
        <Card className="bg-muted/20 border-dashed">
          <CardContent className="pt-3 pb-3">
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded-full bg-primary text-white text-[10px] flex items-center justify-center font-bold">1</span> Browse jobs below</span>
              <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded-full bg-primary text-white text-[10px] flex items-center justify-center font-bold">2</span> Matchbook ones you like (free)</span>
              <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded-full bg-primary text-white text-[10px] flex items-center justify-center font-bold">3</span> Unlock to see contact details</span>
              <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded-full bg-primary text-white text-[10px] flex items-center justify-center font-bold">4</span> Send a quote — customer accepts or declines</span>
            </div>
          </CardContent>
        </Card>

        {isLoading && page === 1 ? (
          <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-32 rounded-xl bg-muted animate-pulse" />)}</div>
        ) : filteredJobs.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <p className="font-medium">No jobs available right now</p>
            <p className="text-sm mt-1">New jobs are posted every day. Check back soon.</p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {filteredJobs.map((job: any) => (
                <Card
                  key={job.id}
                  className={cn("transition-all", job.isBoosted && "border-amber-300/60 ring-1 ring-amber-200/40")}
                  data-testid={`feed-job-${job.id}`}
                >
                  <CardContent className="pt-4 pb-4">
                    {/* Top: badges + title */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center flex-wrap gap-1.5 mb-1.5">
                          {job.isBoosted && <Badge className="text-xs bg-amber-500 hover:bg-amber-500">⚡ Boosted</Badge>}
                          {job.aiIsUrgent && (
                            <Badge className="text-xs bg-red-600 text-white gap-1">
                              <Flame className="w-2.5 h-2.5" /> Urgent
                            </Badge>
                          )}
                          <Badge variant={URGENCY_COLORS[job.urgency] as any} className="text-xs">{job.urgency}</Badge>
                          <Badge variant="outline" className="text-xs">{job.category?.name}</Badge>
                        </div>
                        <h3 className="font-semibold text-base">{job.title}</h3>
                        <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{job.description}</p>
                      </div>
                    </div>

                    {/* Meta row */}
                    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground mb-3">
                      {job.locationText && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{job.locationText}</span>}
                      {job.budgetMin && <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />€{job.budgetMin}–€{job.budgetMax}</span>}
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}</span>
                      <span className="flex items-center gap-1"><Users className="w-3 h-3" />{String(job.matchbookCount || 0)} interested</span>
                    </div>

                    {/* CTA row */}
                    <div className="flex gap-2 items-center">
                      {job.unlock ? (
                        // Already unlocked — show actions
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="gap-1 text-xs border-green-300 text-green-700 dark:text-green-400">
                            <CheckCircle className="w-3 h-3" /> Unlocked ({job.unlock.tier})
                          </Badge>
                          {job.unlock.tier === "STANDARD" && job.unlock.customerPhone && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Phone className="w-3 h-3 text-primary" /> {job.unlock.customerPhone}
                            </span>
                          )}
                          <Button size="sm" variant="outline" className="gap-1.5 h-7 text-xs"
                            onClick={() => setLocation("/pro/chat")} data-testid={`button-chat-${job.id}`}>
                            <MessageCircle className="w-3 h-3" /> Chat
                          </Button>
                        </div>
                      ) : job.isMatchbooked ? (
                        // Matchbooked — ready to unlock
                        <Button
                          size="sm"
                          className="gap-1.5"
                          onClick={() => setUnlockJob(job)}
                          data-testid={`button-unlock-${job.id}`}
                        >
                          <Lock className="w-3.5 h-3.5" /> Unlock Lead ({job.creditCost} cr)
                        </Button>
                      ) : (
                        // Default — matchbook or skip
                        <>
                          <Button
                            size="sm" variant="outline" className="gap-1.5"
                            onClick={() => matchbook.mutate(job.id)}
                            disabled={matchbook.isPending}
                            data-testid={`button-matchbook-${job.id}`}
                          >
                            <Star className="w-3.5 h-3.5" /> Matchbook (free)
                          </Button>
                          <Button
                            size="sm" className="gap-1.5 bg-primary/90 hover:bg-primary"
                            onClick={() => setUnlockJob(job)}
                            data-testid={`button-unlock-direct-${job.id}`}
                          >
                            <Zap className="w-3.5 h-3.5" /> Unlock Now ({job.creditCost} cr)
                          </Button>
                        </>
                      )}
                    </div>

                    {/* Inline quote form — shown after unlock when user clicks "Send Quote" */}
                    {job.unlock && quoteJobId === job.id && (
                      <InlineQuoteForm
                        job={job}
                        onSent={() => setQuoteJobId(null)}
                      />
                    )}

                    {/* After unlock prompt — show if just unlocked and no quote sent */}
                    {job.unlock && quoteJobId !== job.id && (
                      <div className="mt-2 pt-2 border-t border-border/40">
                        <button
                          className="flex items-center gap-1.5 text-xs text-primary hover:underline font-medium"
                          onClick={() => setQuoteJobId(job.id)}
                        >
                          <Send className="w-3 h-3" /> Send a quote to win this job →
                        </button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {hasMore && (
              <div className="pt-2 flex justify-center">
                <Button variant="outline" onClick={() => setPage(p => p + 1)} disabled={isFetching} data-testid="button-load-more-jobs">
                  {isFetching ? "Loading…" : "Load more jobs"}
                </Button>
              </div>
            )}
            {!hasMore && filteredJobs.length > PAGE_SIZE && (
              <p className="text-center text-xs text-muted-foreground pt-2">All jobs loaded</p>
            )}
          </>
        )}
      </div>

      {unlockJob && (
        <UnlockModal
          job={unlockJob}
          onClose={() => setUnlockJob(null)}
          onUnlocked={(result, tier) => {
            setUnlockJob(null);
            if (result !== null) {
              // User clicked "Send a Quote" in the success modal
              setQuoteJobId(unlockJob?.id || null);
            }
            // Refresh feed
            setPage(1); setHasMore(true); setLoadedPages({});
            qc.invalidateQueries({ queryKey: ["/api/jobs/feed"] });
          }}
        />
      )}
    </DashboardLayout>
  );
}
