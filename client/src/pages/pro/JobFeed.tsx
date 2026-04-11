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
  Phone, CheckCircle, Flame, Send, ChevronDown, ChevronUp, Euro, Briefcase
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
      qc.invalidateQueries({ queryKey: ["/api/chat/conversations"] });
      refreshUser();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" })
  });

  if (unlockResult) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white/80 dark:bg-black/60 backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
          <div className="text-center">
            <div className="w-14 h-14 bg-green-100/50 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-3 ring-4 ring-green-500/10">
              <CheckCircle className="w-7 h-7 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-xl font-heading font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300">Lead Unlocked!</h2>
            <p className="text-sm text-muted-foreground">{job.title}</p>
          </div>
          {chosenTier === "STANDARD" && unlockResult.customerPhone && (
            <div className="bg-primary/5 dark:bg-primary/10 rounded-xl p-4 flex items-center gap-3 border border-primary/10">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Phone className="w-4 h-4 text-primary shrink-0" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Customer's phone number</p>
                <p className="font-bold text-lg tracking-wide">{unlockResult.customerPhone}</p>
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white/90 dark:bg-black/80 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-2xl max-w-md w-full p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <h2 className="text-2xl font-heading font-bold mb-1 bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300">Unlock Lead</h2>
        <p className="text-sm text-muted-foreground mb-1">Choose your access level for this job</p>
        <p className="text-xs bg-primary/10 text-primary rounded-full px-3 py-1 mb-6 inline-block font-medium border border-primary/20">{job.title}</p>

        <div className="grid grid-cols-2 gap-4 mb-6">
          {/* Free tier */}
          <button
            onClick={() => unlock.mutate("FREE")}
            disabled={unlock.isPending}
            className="p-5 rounded-2xl border-2 border-muted/50 dark:border-white/5 bg-white/50 dark:bg-white/5 hover:border-primary/40 hover:bg-white/80 dark:hover:bg-white/10 hover:shadow-lg transition-all text-left group"
            data-testid="button-unlock-free"
          >
            <div className="w-10 h-10 rounded-xl bg-muted/60 dark:bg-white/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Lock className="w-5 h-5 text-muted-foreground" />
            </div>
            <p className="font-heading font-bold text-base">Free</p>
            <p className="text-xs text-muted-foreground mt-1">Chat only · contact masked</p>
            <p className="text-2xl font-bold mt-3 text-green-600 dark:text-green-400">0 <span className="text-sm font-normal text-muted-foreground">credits</span></p>
            <p className="text-xs text-muted-foreground mt-1.5 font-medium">Good for introductions</p>
          </button>

          {/* Standard tier */}
          <button
            onClick={() => unlock.mutate("STANDARD")}
            disabled={unlock.isPending || (user?.creditBalance || 0) < job.creditCost}
            className={cn(
              "p-5 rounded-2xl border-2 transition-all text-left relative overflow-hidden group",
              (user?.creditBalance || 0) >= job.creditCost
                ? "border-primary/50 bg-gradient-to-b from-primary/10 to-transparent hover:border-primary hover:shadow-[0_0_20px_rgba(var(--primary),0.2)]"
                : "border-border opacity-50 cursor-not-allowed"
            )}
            data-testid="button-unlock-standard"
          >
            <div className="absolute top-0 right-0 h-16 w-16 bg-primary/10 blur-xl rounded-full" />
            <div className="absolute top-3 right-3">
              <Badge className="text-[10px] px-2 py-0.5 bg-primary/20 text-primary hover:bg-primary/30 border-none">Best value</Badge>
            </div>
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform relative z-10">
              <Zap className="w-5 h-5 text-primary" />
            </div>
            <p className="font-heading font-bold text-base relative z-10">Standard</p>
            <p className="text-xs text-muted-foreground mt-1 relative z-10">Chat + phone number</p>
            <p className="text-2xl font-bold mt-3 text-primary relative z-10">{job.creditCost} <span className="text-sm font-normal opacity-70">credits</span></p>
            <p className="text-xs text-muted-foreground mt-1.5 font-medium relative z-10">
              {(user?.creditBalance || 0) < job.creditCost
                ? `Need ${job.creditCost - (user?.creditBalance || 0)} more`
                : "Full contact access"}
            </p>
          </button>
        </div>

        <Button variant="outline" className="w-full rounded-xl h-11" onClick={onClose} disabled={unlock.isPending}>
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
  const [categoryFilter, setCategoryFilter] = useState("my");
  const [urgencyFilter, setUrgencyFilter] = useState<string>("all");
  const [unlockJob, setUnlockJob] = useState<any | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  // Track which jobs should show inline quote form after unlock
  const [quoteJobId, setQuoteJobId] = useState<string | null>(null);

  const { data: rawFeedData, isLoading, isFetching } = useQuery<any>({
    queryKey: ["/api/jobs/feed", categoryFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (categoryFilter === "browse_all") {
        // Explicit "browse all categories" mode — tell backend to skip category filtering
        params.set("scope", "all");
      } else if (categoryFilter !== "my") {
        // Specific single category selected
        params.set("categoryId", categoryFilter);
      }
      // When categoryFilter === "my" (default), no categoryId/scope sent → backend auto-filters to pro's categories
      const res = await apiRequest("GET", `/api/jobs/feed?${params}`);
      if (!res.ok) throw new Error("Failed to load jobs");
      return res.json();
    },
  });

  // Handle both array response (normal) and object response (noCategories flag)
  const noCategories = rawFeedData && !Array.isArray(rawFeedData) && rawFeedData.noCategories;
  const pageData: any[] = Array.isArray(rawFeedData) ? rawFeedData : rawFeedData?.jobs ?? [];

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

  const upgrade = useMutation({
    mutationFn: async (jobId: string) => {
      const res = await apiRequest("POST", `/api/jobs/${jobId}/upgrade`);
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/jobs/feed"] });
      qc.invalidateQueries({ queryKey: ["/api/chat/conversations"] });
      toast({
        title: "Upgraded to Standard",
        description: data.customerPhone ? `Customer's phone: ${data.customerPhone}` : "Phone number unlocked.",
      });
      if (data.conversationId) {
        setLocation(data.conversationId ? `/pro/chat?conversationId=${data.conversationId}` : "/pro/chat");
      }
    },
    onError: (e: any) => toast({ title: "Upgrade failed", description: e.message, variant: "destructive" })
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

  const displayJobs = urgencyFilter === "all"
    ? filteredJobs
    : filteredJobs.filter(j => j.urgency === urgencyFilter || (j.aiIsUrgent && urgencyFilter === "URGENT"));

  const handleCategoryChange = (value: string) => {
    setCategoryFilter(value); setPage(1); setHasMore(true); setLoadedPages({}); setUrgencyFilter("all");
  };

  const URGENCY_COLORS: Record<string, string> = { LOW: "secondary", NORMAL: "outline", HIGH: "default", URGENT: "destructive" };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-4">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-heading font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300">Job Feed</h1>
            <p className="text-muted-foreground mt-1">Browse live jobs and send quotes to win work</p>
          </div>
          <Select value={categoryFilter} onValueChange={handleCategoryChange}>
            <SelectTrigger className="w-full md:w-56 h-11 bg-white/60 dark:bg-black/40 backdrop-blur-md border-white/40 dark:border-white/10 rounded-xl">
              <SelectValue placeholder="My trades" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-white/20 backdrop-blur-xl bg-white/90 dark:bg-black/90">
              <SelectItem value="my">My trades</SelectItem>
              <SelectItem value="browse_all">Browse all categories</SelectItem>
              {(categories as any[]).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* How it works — shown when no jobs unlocked yet */}
        <div className="bg-gradient-to-r from-primary/5 to-transparent rounded-2xl border border-primary/10 overflow-hidden relative">
          <div className="absolute inset-0 bg-[url('/noise.png')] opacity-20 mix-blend-overlay"></div>
          <div className="p-4 relative z-10 flex flex-wrap gap-x-6 gap-y-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-bold">1</span> Browse jobs below</span>
            <span className="flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-bold">2</span> Matchbook ones you like</span>
            <span className="flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-bold">3</span> Unlock to claim</span>
            <span className="flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-primary text-white text-xs flex items-center justify-center font-bold shadow-[0_0_10px_rgba(var(--primary),0.5)]">4</span> Win the job</span>
          </div>
        </div>

        {/* Urgency filter pills */}
        <div className="flex flex-wrap gap-2">
          {["all", "URGENT", "HIGH", "NORMAL", "LOW"].map((u) => (
            <button
              key={u}
              onClick={() => setUrgencyFilter(u)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-semibold border transition-all",
                urgencyFilter === u
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-white/60 dark:bg-black/40 border-white/40 dark:border-white/10 text-muted-foreground hover:border-primary/40 hover:text-primary"
              )}
            >
              {u === "all" ? "All urgencies" : u.charAt(0) + u.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        {isLoading && page === 1 ? (
          <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="h-40 rounded-2xl bg-white/40 dark:bg-white/5 animate-pulse" />)}</div>
        ) : noCategories ? (
          <div className="text-center py-24 text-muted-foreground bg-white/40 dark:bg-black/20 backdrop-blur-md rounded-3xl border border-white/20 dark:border-white/5">
            <div className="w-16 h-16 rounded-full bg-amber-100/80 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-4">
              <Briefcase className="w-8 h-8 text-amber-600 dark:text-amber-400" />
            </div>
            <p className="font-heading font-medium text-lg text-foreground">Set up your trade categories</p>
            <p className="text-sm mt-1 max-w-sm mx-auto">Complete your professional profile with your service categories to see relevant jobs in your feed.</p>
            <div className="flex gap-3 justify-center mt-4">
              <Button variant="default" onClick={() => setLocation("/pro/profile")}>Complete Profile</Button>
              <Button variant="outline" onClick={() => handleCategoryChange("browse_all")}>Browse all jobs</Button>
            </div>
          </div>
        ) : displayJobs.length === 0 ? (
          <div className="text-center py-24 text-muted-foreground bg-white/40 dark:bg-black/20 backdrop-blur-md rounded-3xl border border-white/20 dark:border-white/5">
            <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
              <Briefcase className="w-8 h-8 opacity-50" />
            </div>
            <p className="font-heading font-medium text-lg text-foreground">No jobs available right now</p>
            <p className="text-sm mt-1 max-w-sm mx-auto">New jobs are posted every day. Check back soon or adjust your category filter.</p>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {displayJobs.map((job: any) => (
                <Card
                  key={job.id}
                  className={cn(
                    "transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:hover:shadow-[0_8px_30px_rgb(0,0,0,0.2)] bg-white/60 dark:bg-black/40 backdrop-blur-xl border-white/40 dark:border-white/10 rounded-2xl overflow-hidden group",
                    job.isBoosted && "border-amber-300/60 ring-1 ring-amber-200/40 bg-gradient-to-br from-amber-50/50 to-white/60 dark:from-amber-950/20 dark:to-black/40"
                  )}
                  data-testid={`feed-job-${job.id}`}
                >
                  <CardContent className="p-5 md:p-6">
                    {/* Top: badges + title */}
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center flex-wrap gap-2 mb-2">
                          {job.isBoosted && <Badge className="text-xs font-semibold bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 border-none shadow-sm shadow-amber-500/20 text-amber-950">⚡ Boosted</Badge>}
                          {job.aiIsUrgent && (
                            <Badge className="text-xs font-semibold bg-gradient-to-r from-red-500 to-red-600 text-white border-none shadow-sm shadow-red-500/20 px-2 py-0.5 gap-1">
                              <Flame className="w-3 h-3" /> Urgent
                            </Badge>
                          )}
                          <Badge variant={URGENCY_COLORS[job.urgency] as any} className="text-xs bg-white/50 dark:bg-black/50 backdrop-blur">{job.urgency}</Badge>
                          <Badge variant="outline" className="text-[10px] uppercase tracking-wider bg-white/50 dark:bg-black/50 backdrop-blur text-muted-foreground">{job.category?.name}</Badge>
                        </div>
                        <h3 className="font-heading font-bold text-lg md:text-xl group-hover:text-primary transition-colors">{job.title}</h3>
                        <p className="text-sm text-muted-foreground line-clamp-2 mt-2 leading-relaxed">{job.description}</p>
                      </div>
                    </div>

                    {/* Meta row */}
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground mb-5 bg-white/40 dark:bg-white/5 backdrop-blur-sm p-3 rounded-xl border border-white/20 dark:border-white/5">
                      {job.locationText && <span className="flex items-center gap-1.5 font-medium text-foreground/80"><MapPin className="w-4 h-4 text-primary/70" />{job.locationText}</span>}
                      {job.budgetMin && <span className="flex items-center gap-1.5 font-medium text-foreground/80"><DollarSign className="w-4 h-4 text-green-500/70" />€{job.budgetMin}–€{job.budgetMax}</span>}
                      <span className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-muted-foreground/70" />{formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}</span>
                      <span className="flex items-center gap-1.5"><Users className="w-4 h-4 text-blue-500/70" />{String(job.matchbookCount || 0)} interested</span>
                    </div>

                    {/* CTA row */}
                    <div className="flex gap-3 items-center pt-2">
                      {job.unlock ? (
                        // Already unlocked — show actions
                        <div className="flex items-center gap-3 flex-wrap p-2 px-3 rounded-xl bg-green-50/50 dark:bg-green-950/20 border border-green-200/50 dark:border-green-900/50 w-full md:w-auto">
                          <Badge variant="outline" className="gap-1.5 text-xs border-green-300 text-green-700 dark:text-green-400 bg-white dark:bg-black/50 shadow-sm">
                            <CheckCircle className="w-3.5 h-3.5" /> Unlocked ({job.unlock.tier})
                          </Badge>
                          {job.unlock.tier === "STANDARD" && job.unlock.customerPhone && (
                            <span className="flex items-center gap-1.5 text-xs font-semibold">
                              <Phone className="w-3.5 h-3.5 text-green-600 dark:text-green-500" /> {job.unlock.customerPhone}
                            </span>
                          )}
                          {job.unlock.tier === "FREE" && (
                            <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs rounded-lg border-primary/40 text-primary hover:bg-primary/10"
                              onClick={() => upgrade.mutate(job.id)} disabled={upgrade.isPending}
                              data-testid={`button-upgrade-${job.id}`}>
                              <Phone className="w-3 h-3" /> Get phone ({job.creditCost} cr)
                            </Button>
                          )}
                          <Button size="sm" variant="default" className="gap-1.5 h-8 text-xs ml-auto rounded-lg shadow-sm"
                            onClick={() => setLocation(job.unlock?.conversationId ? `/pro/chat?conversationId=${job.unlock.conversationId}` : "/pro/chat")} data-testid={`button-chat-${job.id}`}>
                            <MessageCircle className="w-3.5 h-3.5" /> Chat
                          </Button>
                        </div>
                      ) : job.isMatchbooked ? (
                        // Matchbooked — ready to unlock
                        <Button
                          size="sm"
                          className="gap-2 rounded-xl h-10 px-5 shadow-sm bg-primary/10 hover:bg-primary/20 text-primary w-full md:w-auto"
                          onClick={() => setUnlockJob(job)}
                          data-testid={`button-unlock-${job.id}`}
                        >
                          <Lock className="w-4 h-4" /> Unlock Lead ({job.creditCost} cr)
                        </Button>
                      ) : (
                        // Default — matchbook or skip
                        <>
                          <Button
                            size="sm" variant="outline" className="gap-2 rounded-xl h-10 px-4 border-dashed border-2 hover:border-primary/50 hover:bg-primary/5 w-full md:w-auto"
                            onClick={() => matchbook.mutate(job.id)}
                            disabled={matchbook.isPending}
                            data-testid={`button-matchbook-${job.id}`}
                          >
                            <Star className="w-4 h-4" /> Matchbook
                          </Button>
                          <Button
                            size="sm" className="gap-2 rounded-xl h-10 px-6 shadow-[0_4px_14px_0_rgba(var(--primary),0.39)] hover:shadow-[0_6px_20px_rgba(var(--primary),0.23)] hover:-translate-y-0.5 transition-all w-full md:w-auto"
                            onClick={() => setUnlockJob(job)}
                            data-testid={`button-unlock-direct-${job.id}`}
                          >
                            <Zap className="w-4 h-4 fill-current" /> Claim Lead ({job.creditCost} cr)
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
            {!hasMore && displayJobs.length > PAGE_SIZE && (
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
