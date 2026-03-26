import { useRoute } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { MapPin, Clock, DollarSign, Zap, CheckCircle2, XCircle, Star, AlertTriangle, MessageCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";
import { cn } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  OPEN: "default", MATCHED: "secondary", BOOKED: "outline",
  COMPLETED: "secondary", CLOSED: "outline", AFTERCARE_2D: "default", AFTERCARE_5D: "destructive",
};

export default function JobDetail() {
  const [, params] = useRoute("/jobs/:id");
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [aftercareResponse, setAftercareResponse] = useState<"SORTED" | "NOT_SORTED" | null>(null);
  const [reviewData, setReviewData] = useState({ rating: 5, comment: "" });
  const [showReview, setShowReview] = useState(false);

  const { data: job, isLoading } = useQuery<any>({ queryKey: [`/api/jobs/${params?.id}`] });
  const { data: allQuotes = [] } = useQuery<any[]>({ queryKey: ["/api/quotes"] });

  const jobQuotes = (allQuotes as any[]).filter((q: any) => q.jobId === params?.id);
  const acceptedQuote = jobQuotes.find((q: any) => q.status === "ACCEPTED");

  const acceptQuote = useMutation({
    mutationFn: async (quoteId: string) => {
      const res = await apiRequest("POST", `/api/quotes/${quoteId}/accept`);
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/quotes"] });
      qc.invalidateQueries({ queryKey: [`/api/jobs/${params?.id}`] });
      toast({ title: "Quote accepted!", description: "A booking has been created." });
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
      toast({ title: "Job boosted!", description: "Your job is now featured for 24h. €4.99 charged." });
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

  const respondAftercare = useMutation({
    mutationFn: async (response: "SORTED" | "NOT_SORTED") => {
      const res = await apiRequest("POST", `/api/jobs/${params?.id}/aftercare/respond`, { response });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/jobs/${params?.id}`] });
      toast({ title: "Response recorded" });
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

  if (isLoading) return <DashboardLayout><div className="p-6 text-muted-foreground">Loading…</div></DashboardLayout>;
  if (!job) return <DashboardLayout><div className="p-6">Job not found</div></DashboardLayout>;

  const isAftercare = ["AFTERCARE_2D", "AFTERCARE_5D"].includes(job.status);
  const canBoost = job.status === "OPEN" && !job.isBoosted && job.customerId === user?.id;
  const canClose = ["OPEN", "MATCHED"].includes(job.status) && job.customerId === user?.id;
  const isCompleted = job.status === "COMPLETED";

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-2xl p-6 shadow-sm mb-6">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <h1 className="text-3xl font-heading font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 mr-2">{job.title}</h1>
            <Badge variant={STATUS_COLORS[job.status] as any} className="text-xs px-2.5 py-1 uppercase tracking-wider bg-white/50 dark:bg-black/50 backdrop-blur shadow-sm">{job.status}</Badge>
            {job.isBoosted && <Badge className="bg-gradient-to-r from-amber-400 to-amber-500 text-amber-950 border-none shadow-sm shadow-amber-500/20 text-xs px-2.5 py-1">⚡ Boosted</Badge>}
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mt-6 text-sm text-muted-foreground bg-white/40 dark:bg-white/5 backdrop-blur-sm p-4 rounded-xl border border-white/20 dark:border-white/5 w-fit">
            {job.locationText && (
              <span className="flex items-center gap-2 font-medium text-foreground/80"><MapPin className="w-4 h-4 text-primary/70" />{job.locationText}</span>
            )}
            {job.budgetMin && (
              <span className="flex items-center gap-2 font-medium text-foreground/80"><DollarSign className="w-4 h-4 text-green-500/70" />€{job.budgetMin} – €{job.budgetMax}</span>
            )}
            <span className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground/70" />{formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
            </span>
          </div>
        </div>

        {/* Aftercare banner */}
        {isAftercare && (
          <Card className="border-orange-400 bg-orange-50 dark:bg-orange-950/30">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-orange-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-semibold text-sm">Aftercare Check-in</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {job.status === "AFTERCARE_2D"
                      ? "48 hours have passed. Was your job sorted?"
                      : "5 days have passed. Please let us know how it went."}
                  </p>
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" variant="default" className="gap-1 bg-green-600 hover:bg-green-700"
                      onClick={() => respondAftercare.mutate("SORTED")} disabled={respondAftercare.isPending}>
                      <CheckCircle2 className="w-4 h-4" /> All sorted
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1"
                      onClick={() => respondAftercare.mutate("NOT_SORTED")} disabled={respondAftercare.isPending}>
                      <XCircle className="w-4 h-4" /> Not sorted
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Description */}
        <Card className="bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-2xl shadow-sm overflow-hidden">
          <CardHeader className="bg-muted/10 border-b border-border/40 pb-4">
            <CardTitle className="text-base font-heading font-semibold text-foreground/80">Description</CardTitle>
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
                  <Button variant="outline" size="sm" className="gap-2 h-10 px-4 rounded-xl border-amber-500/30 bg-amber-50/50 hover:bg-amber-100 hover:text-amber-900 dark:bg-amber-950/20 dark:hover:bg-amber-900/40 text-amber-600 dark:text-amber-400 transition-colors"
                    onClick={() => boostJob.mutate()} disabled={boostJob.isPending}
                    data-testid="button-boost-job">
                    <Zap className="w-4 h-4" />
                    Boost job (€4.99 · 24h)
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
                    <Button variant="destructive" size="sm" onClick={() => closeJob.mutate()} disabled={closeJob.isPending} className="rounded-lg shadow-sm w-full sm:w-auto ml-auto">Confirm</Button>
                    <Button variant="outline" size="sm" onClick={() => setShowCloseConfirm(false)} className="rounded-lg w-full sm:w-auto">Cancel</Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quotes */}
        <Card className="bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-2xl shadow-sm overflow-hidden">
          <CardHeader className="bg-muted/10 border-b border-border/40 pb-4">
            <CardTitle className="flex items-center gap-2 text-base font-heading font-semibold text-foreground/80">
              Quotes received
              <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20">{jobQuotes.length}</Badge>
            </CardTitle>
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
                {jobQuotes.map((q: any) => (
                  <div key={q.id} data-testid={`quote-${q.id}`}
                    className={cn(
                      "p-5 md:p-6 rounded-2xl transition-all duration-300 border backdrop-blur-sm",
                      q.status === "ACCEPTED" 
                        ? "border-green-500/50 bg-green-50/50 dark:bg-green-950/20 shadow-[0_0_15px_rgba(34,197,94,0.1)]" 
                        : "border-border/50 bg-white/40 dark:bg-white/5 hover:bg-white/60 dark:hover:bg-white/10 hover:shadow-md",
                      q.status === "REJECTED" && "border-destructive/20 bg-destructive/5 opacity-70 grayscale-[50%]"
                    )}>
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-5">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <p className="font-heading font-bold text-2xl tracking-tight text-foreground">€{q.amount}</p>
                          <Badge variant={
                            q.status === "ACCEPTED" ? "default" :
                            q.status === "REJECTED" ? "destructive" : "outline"
                          } className={cn("text-xs uppercase tracking-wider", q.status === "ACCEPTED" && "bg-green-500 hover:bg-green-600 shadow-sm shadow-green-500/20")}>{q.status}</Badge>
                        </div>
                        {q.message && <div className="p-3 bg-muted/30 rounded-lg border border-border/50 text-sm text-foreground/90 mt-2 mb-3 leading-relaxed">{q.message}</div>}
                        <div className="flex items-center gap-x-4 gap-y-2 mt-2 flex-wrap text-sm text-muted-foreground">
                          {q.estimatedDays && (
                            <span className="flex items-center gap-1.5 bg-muted/40 px-2 py-1 rounded-md">
                              <Clock className="w-3.5 h-3.5" /> Est. {q.estimatedDays} day{q.estimatedDays !== 1 ? "s" : ""}
                            </span>
                          )}
                          {q.professionalId && (
                            <Button variant="ghost" size="sm" className="h-auto p-0 text-primary font-medium hover:bg-transparent hover:underline" asChild>
                              <a href={`/#/pro/${q.professionalId}/profile`} data-testid={`link-pro-profile-${q.id}`}>
                                View professional profile →
                              </a>
                            </Button>
                          )}
                        </div>
                      </div>
                      {q.status === "PENDING" && job.status === "OPEN" && (
                        <div className="flex flex-row md:flex-col gap-2 shrink-0 w-full md:w-auto mt-4 md:mt-0 pt-4 md:pt-0 border-t md:border-t-0 border-border/30">
                          <Button size="sm" className="gap-2 rounded-xl h-10 px-5 flex-1 md:flex-auto shadow-[0_4px_14px_0_rgba(var(--primary),0.39)] hover:shadow-[0_6px_20px_rgba(var(--primary),0.23)] hover:-translate-y-0.5 transition-all w-full"
                            onClick={() => acceptQuote.mutate(q.id)} disabled={acceptQuote.isPending}
                            data-testid={`button-accept-quote-${q.id}`}>
                            <CheckCircle2 className="w-4 h-4" /> Accept Quote
                          </Button>
                          <Button size="sm" variant="outline" className="gap-2 rounded-xl h-10 flex-1 md:flex-auto hover:bg-destructive/5 hover:text-destructive hover:border-destructive/30 transition-colors w-full"
                            onClick={() => rejectQuote.mutate(q.id)} disabled={rejectQuote.isPending}
                            data-testid={`button-reject-quote-${q.id}`}>
                            <XCircle className="w-4 h-4" /> Decline
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Leave a review */}
        {isCompleted && !showReview && (
          <Button variant="outline" className="gap-2 w-full"
            onClick={() => setShowReview(true)} data-testid="button-leave-review">
            <Star className="w-4 h-4 text-yellow-500" /> Leave a review
          </Button>
        )}
        {showReview && (
          <Card>
            <CardHeader><CardTitle className="text-sm">Leave a Review</CardTitle></CardHeader>
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
              <Textarea
                placeholder="Share your experience…"
                value={reviewData.comment}
                onChange={e => setReviewData(r => ({ ...r, comment: e.target.value }))}
                rows={3}
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={() => submitReview.mutate()} disabled={submitReview.isPending}
                  data-testid="button-submit-review">Submit</Button>
                <Button size="sm" variant="outline" onClick={() => setShowReview(false)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
