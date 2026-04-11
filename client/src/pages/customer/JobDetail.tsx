import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { MapPin, Clock, DollarSign, Zap, CheckCircle2, XCircle, Star, AlertTriangle, MessageCircle, Pencil, Hash, Sparkles, ArrowRight, MessageSquare, SortAsc, TrendingDown, Award } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";
import { cn } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "secondary", LIVE: "default", IN_DISCUSSION: "secondary",
  MATCHED: "secondary", BOOKED: "outline",
  COMPLETED: "secondary", CLOSED: "outline",
  AFTERCARE_2D: "default", AFTERCARE_5D: "destructive",
};

const EDITABLE_STATUSES = ["DRAFT", "LIVE", "BOOSTED", "IN_DISCUSSION"];

export default function JobDetail() {
  const [, params] = useRoute("/jobs/:id");
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [aftercareResponse, setAftercareResponse] = useState<"SORTED" | "NOT_SORTED" | null>(null);
  const [boostOffer, setBoostOffer] = useState<{ fee: number; discountPct: number } | null>(null);
  const [showDeclineBoostConfirm, setShowDeclineBoostConfirm] = useState(false);
  const [reviewData, setReviewData] = useState({ rating: 5, comment: "" });
  const [showReview, setShowReview] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editForm, setEditForm] = useState({ title: "", description: "", locationText: "", locationTown: "", locationEircode: "", budgetMin: "", budgetMax: "", urgency: "NORMAL" });
  const [enhancing, setEnhancing] = useState(false);
  const [quoteSortBy, setQuoteSortBy] = useState<"amount" | "date">("amount");

  const { data: job, isLoading } = useQuery<any>({ queryKey: [`/api/jobs/${params?.id}`], enabled: !!params?.id });
  const { data: allQuotes = [] } = useQuery<any[]>({ queryKey: ["/api/quotes"] });

  const quotesArray = Array.isArray(allQuotes) ? allQuotes : [];
  const jobQuotes = quotesArray.filter((q: any) => q.jobId === params?.id);
  const acceptedQuote = jobQuotes.find((q: any) => q.status === "ACCEPTED");

  const sortedJobQuotes = [...jobQuotes].sort((a: any, b: any) => {
    if (quoteSortBy === "amount") return Number(a.amount) - Number(b.amount);
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
  const lowestQuote = jobQuotes.length ? Math.min(...jobQuotes.map((q: any) => Number(q.amount))) : null;
  const pendingQuotesCount = jobQuotes.filter((q: any) => q.status === "PENDING").length;

  const acceptQuote = useMutation({
    mutationFn: async (quoteId: string) => {
      const res = await apiRequest("POST", `/api/quotes/${quoteId}/accept`);
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/quotes"] });
      qc.invalidateQueries({ queryKey: [`/api/jobs/${params?.id}`] });
      qc.invalidateQueries({ queryKey: ["/api/bookings"] });
      toast({
        title: "Quote accepted!",
        description: "A booking has been confirmed. You can view it in My Bookings.",
      });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const rejectQuote = useMutation({
    mutationFn: async (quoteId: string) => {
      const res = await apiRequest("POST", `/api/quotes/${quoteId}/reject`);
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/quotes"] });
      toast({ title: "Quote rejected" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const boostJob = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/jobs/${params?.id}/boost`);
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/jobs/${params?.id}`] });
      toast({ title: "Job boosted!", description: "Your job is now featured for 24h." });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const closeJob = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/jobs/${params?.id}/close`);
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/jobs/${params?.id}`] });
      setShowCloseConfirm(false);
      toast({ title: "Job closed" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const editJob = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PATCH", `/api/jobs/${params?.id}`, data);
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/jobs/${params?.id}`] });
      setShowEditDialog(false);
      toast({ title: "Job updated", description: "Your changes have been saved." });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const respondAftercare = useMutation({
    mutationFn: async (sorted: boolean) => {
      const res = await apiRequest("POST", `/api/jobs/${params?.id}/aftercare/respond`, { sorted });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: (data) => {
      if (data.action === "boost_offered") {
        setBoostOffer({ fee: data.boostFee, discountPct: data.discountPct });
        setAftercareResponse("NOT_SORTED");
      } else {
        qc.invalidateQueries({ queryKey: [`/api/jobs/${params?.id}`] });
        if (data.reviewPrompt) {
          setShowReview(true);
          toast({ title: "Job closed!", description: "Glad it got sorted \u2014 leave a review for the professional." });
        } else {
          toast({ title: "Job closed" });
        }
      }
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const acceptBoost = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/jobs/${params?.id}/boost`);
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      setBoostOffer(null);
      qc.invalidateQueries({ queryKey: [`/api/jobs/${params?.id}`] });
      toast({ title: "Job boosted!" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const declineBoost = useMutation({
    mutationFn: async (action: "close" | "leave_open") => {
      const res = await apiRequest("POST", `/api/jobs/${params?.id}/aftercare/decline-boost`, { action });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: (data) => {
      setBoostOffer(null);
      setShowDeclineBoostConfirm(false);
      qc.invalidateQueries({ queryKey: [`/api/jobs/${params?.id}`] });
      toast({ title: data.action === "closed" ? "Job closed" : "Job left open" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const submitReview = useMutation({
    mutationFn: async () => {
      if (!acceptedQuote) throw new Error("No accepted quote");
      const booking = await apiRequest("GET", `/api/bookings`).then(r => r.json()).then((bs: any[]) =>
        bs.find(b => b.jobId === params?.id)
      );
      if (!booking) throw new Error("No booking found");
      const res = await apiRequest("POST", `/api/bookings/${booking.id}/review`, reviewData);
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      setShowReview(false);
      toast({ title: "Review submitted!" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const enhanceDescription = async () => {
    setEnhancing(true);
    try {
      const res = await apiRequest("POST", "/api/ai/enhance-description", {
        title: editForm.title,
        description: editForm.description,
        category: job?.category?.name || "general",
      });
      if (res.ok) {
        const data = await res.json();
        setEditForm(f => ({ ...f, description: data.enhanced || data.description || f.description }));
        toast({ title: "Description enhanced", description: "AI has improved your job description." });
      }
    } catch { /* ignore */ }
    setEnhancing(false);
  };

  const openEditDialog = () => {
    if (!job) return;
    setEditForm({
      title: job.title || "",
      description: job.description || "",
      locationText: job.locationText || "",
      locationTown: job.locationTown || "",
      locationEircode: job.locationEircode || "",
      budgetMin: job.budgetMin || "",
      budgetMax: job.budgetMax || "",
      urgency: job.urgency || "NORMAL",
    });
    setShowEditDialog(true);
  };

  if (isLoading) return <DashboardLayout><div className="p-6 text-muted-foreground">Loading...</div></DashboardLayout>;
  if (!job) return <DashboardLayout><div className="p-6">Job not found</div></DashboardLayout>;

  const isAftercare = ["AFTERCARE_2D", "AFTERCARE_5D"].includes(job.status);
  const canBoost = ["LIVE", "IN_DISCUSSION", "BOOSTED"].includes(job.status) && !job.isBoosted && job.customerId === user?.id;
  const canClose = ["LIVE", "IN_DISCUSSION", "MATCHED", "BOOSTED"].includes(job.status) && job.customerId === user?.id;
  const canEdit = EDITABLE_STATUSES.includes(job.status) && job.customerId === user?.id;
  const isCompleted = job.status === "COMPLETED";
  const isMatched = job.status === "MATCHED";

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-2xl p-6 shadow-sm mb-6">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <h1 className="text-3xl font-heading font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 mr-2">{job.title}</h1>
            <Badge variant={STATUS_COLORS[job.status] as any} className="text-xs px-2.5 py-1 uppercase tracking-wider bg-white/50 dark:bg-black/50 backdrop-blur shadow-sm">{job.status}</Badge>
            {job.isBoosted && <Badge className="bg-gradient-to-r from-amber-400 to-amber-500 text-amber-950 border-none shadow-sm shadow-amber-500/20 text-xs px-2.5 py-1">Boosted</Badge>}
          </div>
          {job.referenceCode && (
            <div className="flex items-center gap-1.5 mb-4">
              <Hash className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-sm font-mono text-muted-foreground">{job.referenceCode}</span>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-muted-foreground bg-white/40 dark:bg-white/5 backdrop-blur-sm p-4 rounded-xl border border-white/20 dark:border-white/5 w-fit">
            {job.locationText && (
              <span className="flex items-center gap-2 font-medium text-foreground/80"><MapPin className="w-4 h-4 text-primary/70" />{job.locationText}</span>
            )}
            {job.locationEircode && (
              <span className="flex items-center gap-2 text-foreground/80 text-xs font-mono bg-muted px-2 py-0.5 rounded">{job.locationEircode}</span>
            )}
            {job.budgetMin && (
              <span className="flex items-center gap-2 font-medium text-foreground/80"><DollarSign className="w-4 h-4 text-green-500/70" />{"\u20AC"}{job.budgetMin} \u2013 {"\u20AC"}{job.budgetMax}</span>
            )}
            <span className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground/70" />{formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
            </span>
          </div>
        </div>

        {/* Matched / booking confirmed banner */}
        {isMatched && acceptedQuote && (
          <Card className="border-green-400/60 bg-green-50/60 dark:bg-green-950/20">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-semibold text-sm text-green-800 dark:text-green-300">Booking confirmed!</p>
                  <p className="text-xs text-green-700/80 dark:text-green-400/80 mt-0.5">
                    You accepted a quote of <strong>€{acceptedQuote.amount}</strong>. A booking has been created.
                  </p>
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" className="gap-1.5 bg-green-600 hover:bg-green-700 shadow-sm" onClick={() => navigate("/bookings")}>
                      <ArrowRight className="w-3.5 h-3.5" /> View Booking
                    </Button>
                    {acceptedQuote.conversationId && (
                      <Button size="sm" variant="outline" className="gap-1.5 border-green-300 text-green-700 hover:bg-green-50" onClick={() => navigate(`/chat?conversationId=${acceptedQuote.conversationId}`)}>
                        <MessageSquare className="w-3.5 h-3.5" /> Chat
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Aftercare banner */}
        {isAftercare && !boostOffer && !showDeclineBoostConfirm && (
          <Card className="border-orange-400 bg-orange-50 dark:bg-orange-950/30">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-orange-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-semibold text-sm">Aftercare Check-in</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {job.status === "AFTERCARE_2D" ? "48 hours have passed. Was your job sorted?" : "5 days have passed. Please let us know how it went."}
                  </p>
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" variant="default" className="gap-1 bg-green-600 hover:bg-green-700"
                      onClick={() => respondAftercare.mutate(true)} disabled={respondAftercare.isPending}>
                      <CheckCircle2 className="w-4 h-4" /> All sorted
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1"
                      onClick={() => respondAftercare.mutate(false)} disabled={respondAftercare.isPending}>
                      <XCircle className="w-4 h-4" /> Not sorted
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Boost offer */}
        {boostOffer && !showDeclineBoostConfirm && (
          <Card className="border-amber-400 bg-amber-50 dark:bg-amber-950/30">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start gap-3">
                <Zap className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-semibold text-sm">Boost your job?</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    For {"\u20AC"}{boostOffer.fee} your job gets reposted and becomes {boostOffer.discountPct}% cheaper for professionals to claim.
                  </p>
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" variant="default" className="gap-1 bg-amber-500 hover:bg-amber-600 text-white"
                      onClick={() => acceptBoost.mutate()} disabled={acceptBoost.isPending}>
                      <Zap className="w-4 h-4" /> Yes, boost it ({"\u20AC"}{boostOffer.fee})
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1"
                      onClick={() => setShowDeclineBoostConfirm(true)} disabled={acceptBoost.isPending}>
                      No thanks
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Decline boost */}
        {showDeclineBoostConfirm && (
          <Card className="border-muted bg-muted/30">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-semibold text-sm">What would you like to do with this job?</p>
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" variant="destructive" onClick={() => declineBoost.mutate("close")} disabled={declineBoost.isPending}>Close this job</Button>
                    <Button size="sm" variant="outline" onClick={() => declineBoost.mutate("leave_open")} disabled={declineBoost.isPending}>Leave it open</Button>
                    <Button size="sm" variant="ghost" onClick={() => setShowDeclineBoostConfirm(false)}>Back</Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Description */}
        <Card className="bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-2xl shadow-sm overflow-hidden">
          <CardHeader className="bg-muted/10 border-b border-border/40 pb-4 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-heading font-semibold text-foreground/80">Description</CardTitle>
            {canEdit && (
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={openEditDialog}>
                <Pencil className="w-3.5 h-3.5" /> Edit Job
              </Button>
            )}
          </CardHeader>
          <CardContent className="pt-6">
            <div className="prose dark:prose-invert max-w-none text-muted-foreground text-sm/relaxed">
              <p className="whitespace-pre-wrap">{job.description}</p>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        {(canBoost || canClose) && (
          <Card className="bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-2xl shadow-sm">
            <CardContent className="p-5">
              <div className="flex flex-wrap items-center gap-3">
                {canBoost && (
                  <Button variant="outline" size="sm" className="gap-2 h-10 px-4 rounded-xl border-amber-500/30 bg-amber-50/50 hover:bg-amber-100 text-amber-600 transition-colors"
                    onClick={() => boostJob.mutate()} disabled={boostJob.isPending} data-testid="button-boost-job">
                    <Zap className="w-4 h-4" /> Boost job ({"\u20AC"}4.99)
                  </Button>
                )}
                {canClose && !showCloseConfirm && (
                  <Button variant="ghost" size="sm" className="text-destructive h-10 px-4 rounded-xl hover:bg-destructive/10 transition-colors"
                    onClick={() => setShowCloseConfirm(true)} data-testid="button-close-job">
                    Close job
                  </Button>
                )}
                {showCloseConfirm && (
                  <div className="flex items-center gap-3 bg-destructive/5 p-2 rounded-xl border border-destructive/20 w-full sm:w-auto">
                    <AlertTriangle className="w-4 h-4 text-destructive ml-2" />
                    <p className="text-sm font-medium text-destructive">Close this job?</p>
                    <Button variant="destructive" size="sm" onClick={() => closeJob.mutate()} disabled={closeJob.isPending}>Confirm</Button>
                    <Button variant="outline" size="sm" onClick={() => setShowCloseConfirm(false)}>Cancel</Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quotes */}
        <Card className="bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-2xl shadow-sm overflow-hidden">
          <CardHeader className="bg-muted/10 border-b border-border/40 pb-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-base font-heading font-semibold text-foreground/80">
                Quotes received
                <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20">{jobQuotes.length}</Badge>
              </CardTitle>
              {jobQuotes.length > 1 && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span className="font-medium">Sort:</span>
                  <button
                    onClick={() => setQuoteSortBy("amount")}
                    className={cn("px-2.5 py-1 rounded-lg border transition-colors", quoteSortBy === "amount" ? "bg-primary/10 text-primary border-primary/20 font-semibold" : "border-border/40 hover:bg-muted/50")}
                  >
                    Lowest price
                  </button>
                  <button
                    onClick={() => setQuoteSortBy("date")}
                    className={cn("px-2.5 py-1 rounded-lg border transition-colors", quoteSortBy === "date" ? "bg-primary/10 text-primary border-primary/20 font-semibold" : "border-border/40 hover:bg-muted/50")}
                  >
                    Newest first
                  </button>
                </div>
              )}
            </div>
            {jobQuotes.length > 0 && lowestQuote !== null && (
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/30 flex-wrap text-sm">
                <span className="flex items-center gap-1.5 text-green-700 dark:text-green-400 font-medium">
                  <TrendingDown className="w-4 h-4" /> Lowest: €{lowestQuote}
                </span>
                {pendingQuotesCount > 0 && (
                  <span className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                    <Award className="w-4 h-4" /> {pendingQuotesCount} awaiting your decision
                  </span>
                )}
                {acceptedQuote && (
                  <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-medium">
                    <CheckCircle2 className="w-4 h-4" /> Accepted: €{acceptedQuote.amount}
                  </span>
                )}
              </div>
            )}
          </CardHeader>
          <CardContent className="pt-6">
            {jobQuotes.length === 0 ? (
              <div className="text-center py-12 px-4 border border-dashed border-border/60 rounded-xl bg-muted/10">
                <div className="w-12 h-12 bg-muted/50 rounded-full flex items-center justify-center mx-auto mb-3">
                  <MessageCircle className="w-6 h-6 text-muted-foreground opacity-50" />
                </div>
                <p className="font-medium text-foreground">No quotes yet</p>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">Professionals are reviewing your job. When they send quotes, they'll appear here.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {sortedJobQuotes.map((q: any) => (
                  <div key={q.id} data-testid={`quote-${q.id}`}
                    className={cn(
                      "p-5 md:p-6 rounded-2xl transition-all duration-300 border backdrop-blur-sm",
                      q.status === "ACCEPTED" ? "border-green-500/50 bg-green-50/50 dark:bg-green-950/20 shadow-[0_0_15px_rgba(34,197,94,0.1)]"
                        : "border-border/50 bg-white/40 dark:bg-white/5 hover:bg-white/60 dark:hover:bg-white/10 hover:shadow-md",
                      q.status === "REJECTED" && "border-destructive/20 bg-destructive/5 opacity-70 grayscale-[50%]"
                    )}>
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-5">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <p className="font-heading font-bold text-2xl tracking-tight text-foreground">{"\u20AC"}{q.amount}</p>
                          <Badge variant={
                            q.status === "ACCEPTED" ? "default" :
                            q.status === "REJECTED" ? "destructive" : "outline"
                          } className={cn("text-xs uppercase tracking-wider", q.status === "ACCEPTED" && "bg-green-500 hover:bg-green-600 shadow-sm shadow-green-500/20")}>{q.status}</Badge>
                        </div>
                        {q.professional && (
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <div className="w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center uppercase shrink-0">
                              {q.professional.firstName?.[0]}{q.professional.lastName?.[0]}
                            </div>
                            <span className="text-sm font-medium">{q.professional.firstName} {q.professional.lastName}</span>
                            {q.professional.ratingAvg && Number(q.professional.ratingAvg) > 0 && (
                              <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                                <span className="font-medium">{Number(q.professional.ratingAvg).toFixed(1)}</span>
                                {q.professional.totalReviews > 0 && (
                                  <span className="text-muted-foreground">({q.professional.totalReviews})</span>
                                )}
                              </span>
                            )}
                            {q.status === "ACCEPTED" && <Badge className="bg-green-500 text-white text-xs border-0 ml-auto">Accepted</Badge>}
                          </div>
                        )}
                        {q.message && <div className="p-3 bg-muted/30 rounded-lg border border-border/50 text-sm text-foreground/90 mt-2 mb-3 leading-relaxed">{q.message}</div>}
                        <div className="flex items-center gap-x-4 gap-y-2 mt-2 flex-wrap text-sm text-muted-foreground">
                          {q.estimatedDuration && (
                            <span className="flex items-center gap-1.5 bg-muted/40 px-2 py-1 rounded-md">
                              <Clock className="w-3.5 h-3.5" /> Est. {q.estimatedDuration}
                            </span>
                          )}
                          {q.professionalId && (
                            <Button variant="ghost" size="sm" className="h-auto p-0 text-primary font-medium hover:bg-transparent hover:underline" asChild>
                              <a href={`/#/pro/${q.professionalId}/profile`}>View professional profile</a>
                            </Button>
                          )}
                        </div>
                      </div>
                      {q.status === "PENDING" && ["LIVE", "IN_DISCUSSION", "BOOSTED"].includes(job.status) && !acceptedQuote && (
                        <div className="flex flex-row md:flex-col gap-2 shrink-0 w-full md:w-auto mt-4 md:mt-0 pt-4 md:pt-0 border-t md:border-t-0 border-border/30">
                          <Button size="sm" className="gap-2 rounded-xl h-10 px-5 flex-1 md:flex-auto shadow-[0_4px_14px_0_rgba(var(--primary),0.39)] hover:shadow-[0_6px_20px_rgba(var(--primary),0.23)] hover:-translate-y-0.5 transition-all w-full"
                            onClick={() => acceptQuote.mutate(q.id)} disabled={acceptQuote.isPending}
                            data-testid={`button-accept-quote-${q.id}`}>
                            <CheckCircle2 className="w-4 h-4" />
                            {acceptQuote.isPending ? "Accepting…" : "Accept Quote"}
                          </Button>
                          <Button size="sm" variant="outline" className="gap-2 rounded-xl h-10 flex-1 md:flex-auto hover:bg-destructive/5 hover:text-destructive hover:border-destructive/30 transition-colors w-full"
                            onClick={() => rejectQuote.mutate(q.id)} disabled={rejectQuote.isPending}
                            data-testid={`button-reject-quote-${q.id}`}>
                            <XCircle className="w-4 h-4" /> Decline
                          </Button>
                        </div>
                      )}
                      {q.status === "ACCEPTED" && (
                        <div className="flex flex-row md:flex-col gap-2 shrink-0 w-full md:w-auto mt-4 md:mt-0 pt-4 md:pt-0 border-t md:border-t-0 border-green-200 dark:border-green-900">
                          <Button size="sm" variant="outline" className="gap-2 rounded-xl h-10 flex-1 md:flex-auto border-green-300 bg-green-50 hover:bg-green-100 text-green-700 w-full"
                            onClick={() => navigate("/bookings")}
                            data-testid="button-view-booking">
                            <ArrowRight className="w-4 h-4" /> View Booking
                          </Button>
                          {q.conversationId && (
                            <Button size="sm" variant="outline" className="gap-2 rounded-xl h-10 flex-1 md:flex-auto w-full"
                              onClick={() => navigate(`/chat?conversationId=${q.conversationId}`)}>
                              <MessageSquare className="w-4 h-4" /> Open Chat
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Leave a review — prominent card CTA */}
        {isCompleted && !showReview && (
          <Card className="border-emerald-400/50 bg-emerald-50/50 dark:bg-emerald-950/20">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="font-semibold text-sm text-emerald-800 dark:text-emerald-300">Job complete — how did it go?</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Your feedback helps others find great professionals.</p>
                </div>
                <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 shadow-sm shrink-0 text-white"
                  onClick={() => setShowReview(true)} data-testid="button-leave-review">
                  <Star className="w-3.5 h-3.5" /> Leave a Review
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
        {showReview && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">How was your experience?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm mb-2">Rating</p>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button key={n} onClick={() => setReviewData(r => ({ ...r, rating: n }))}>
                      <Star className={cn("w-6 h-6", n <= reviewData.rating ? "text-yellow-400 fill-yellow-400" : "text-muted")} />
                    </button>
                  ))}
                </div>
              </div>
              <Textarea placeholder="Share your experience..." value={reviewData.comment} onChange={e => setReviewData(r => ({ ...r, comment: e.target.value }))} rows={3} />
              <div className="flex gap-2">
                <Button size="sm" onClick={() => submitReview.mutate()} disabled={submitReview.isPending} data-testid="button-submit-review">Submit</Button>
                <Button size="sm" variant="outline" onClick={() => setShowReview(false)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Edit Job Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Pencil className="w-4 h-4" /> Edit Job</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium">Title</label>
              <Input value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Description</label>
                <Button variant="ghost" size="sm" className="text-xs gap-1 text-violet-600" onClick={enhanceDescription} disabled={enhancing || !editForm.description.trim()}>
                  <Sparkles className="w-3 h-3" /> {enhancing ? "Enhancing..." : "Enhance with AI"}
                </Button>
              </div>
              <Textarea value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} rows={5} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Location</label>
                <Input placeholder="e.g. Dublin 6" value={editForm.locationText} onChange={e => setEditForm(f => ({ ...f, locationText: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium">Town / City</label>
                <Input placeholder="e.g. Dublin" value={editForm.locationTown} onChange={e => setEditForm(f => ({ ...f, locationTown: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Eircode (optional)</label>
                <Input placeholder="e.g. D06 R2C0" value={editForm.locationEircode} onChange={e => setEditForm(f => ({ ...f, locationEircode: e.target.value.toUpperCase() }))} maxLength={10} />
              </div>
              <div>
                <label className="text-sm font-medium">Urgency</label>
                <select value={editForm.urgency} onChange={e => setEditForm(f => ({ ...f, urgency: e.target.value }))}
                  className="w-full h-10 border border-input rounded-md px-3 text-sm bg-background">
                  <option value="LOW">Low</option>
                  <option value="NORMAL">Normal</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Budget Min ({"\u20AC"})</label>
                <Input type="number" placeholder="0" value={editForm.budgetMin} onChange={e => setEditForm(f => ({ ...f, budgetMin: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium">Budget Max ({"\u20AC"})</label>
                <Input type="number" placeholder="0" value={editForm.budgetMax} onChange={e => setEditForm(f => ({ ...f, budgetMax: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancel</Button>
            <Button onClick={() => editJob.mutate(editForm)} disabled={editJob.isPending}>
              {editJob.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
