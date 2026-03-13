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
import { MapPin, Clock, DollarSign, Zap, CheckCircle2, XCircle, Star, AlertTriangle } from "lucide-react";
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
      <div className="p-4 md:p-6 space-y-5 max-w-3xl">
        {/* Header */}
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <h1 className="text-xl font-bold">{job.title}</h1>
            <Badge variant={STATUS_COLORS[job.status] as any}>{job.status}</Badge>
            {job.isBoosted && <Badge className="bg-amber-500 text-white">⚡ Boosted</Badge>}
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            {job.locationText && (
              <span className="flex items-center gap-1"><MapPin className="w-4 h-4" />{job.locationText}</span>
            )}
            {job.budgetMin && (
              <span className="flex items-center gap-1"><DollarSign className="w-4 h-4" />€{job.budgetMin} – €{job.budgetMax}</span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />{formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
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
        <Card>
          <CardHeader><CardTitle className="text-sm">Description</CardTitle></CardHeader>
          <CardContent><p className="text-sm whitespace-pre-wrap">{job.description}</p></CardContent>
        </Card>

        {/* Actions */}
        {(canBoost || canClose) && (
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex flex-wrap gap-2">
                {canBoost && (
                  <Button variant="outline" size="sm" className="gap-2"
                    onClick={() => boostJob.mutate()} disabled={boostJob.isPending}
                    data-testid="button-boost-job">
                    <Zap className="w-4 h-4 text-amber-500" />
                    Boost job (€4.99 · 24h)
                  </Button>
                )}
                {canClose && !showCloseConfirm && (
                  <Button variant="ghost" size="sm" className="text-destructive"
                    onClick={() => setShowCloseConfirm(true)} data-testid="button-close-job">
                    Close job
                  </Button>
                )}
                {showCloseConfirm && (
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-muted-foreground">Close this job?</p>
                    <Button variant="destructive" size="sm" onClick={() => closeJob.mutate()}
                      disabled={closeJob.isPending}>Confirm</Button>
                    <Button variant="outline" size="sm" onClick={() => setShowCloseConfirm(false)}>Cancel</Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quotes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">
              Quotes received ({jobQuotes.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {jobQuotes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No quotes yet — professionals are reviewing your job.</p>
            ) : (
              <div className="space-y-3">
                {jobQuotes.map((q: any) => (
                  <div key={q.id} data-testid={`quote-${q.id}`}
                    className={cn(
                      "p-4 rounded-xl border transition-all",
                      q.status === "ACCEPTED" && "border-green-500 bg-green-50 dark:bg-green-950/30",
                      q.status === "REJECTED" && "border-destructive/30 opacity-60"
                    )}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-bold text-lg">€{q.amount}</p>
                          <Badge variant={
                            q.status === "ACCEPTED" ? "default" :
                            q.status === "REJECTED" ? "destructive" : "outline"
                          } className="text-xs">{q.status}</Badge>
                        </div>
                        {q.message && <p className="text-sm text-muted-foreground">{q.message}</p>}
                        {q.estimatedDays && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Est. {q.estimatedDays} day{q.estimatedDays !== 1 ? "s" : ""}
                          </p>
                        )}
                      </div>
                      {q.status === "PENDING" && job.status === "OPEN" && (
                        <div className="flex gap-2 flex-shrink-0">
                          <Button size="sm" className="gap-1 bg-green-600 hover:bg-green-700"
                            onClick={() => acceptQuote.mutate(q.id)} disabled={acceptQuote.isPending}
                            data-testid={`button-accept-quote-${q.id}`}>
                            <CheckCircle2 className="w-3 h-3" /> Accept
                          </Button>
                          <Button size="sm" variant="outline" className="gap-1"
                            onClick={() => rejectQuote.mutate(q.id)} disabled={rejectQuote.isPending}
                            data-testid={`button-reject-quote-${q.id}`}>
                            <XCircle className="w-3 h-3" /> Reject
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
