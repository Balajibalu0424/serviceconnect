import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusPill } from "@/components/ui/status-pill";
import { ListChecks, CheckCircle2, XCircle, MessageCircle, User, MapPin, Clock, Euro, Hash, CalendarCheck, ArrowRight, Star, PlusCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation, Link } from "wouter";
import { BookingTimeline } from "@/components/bookings/BookingTimeline";
import { buildConversationPath } from "@shared/chatRoutes";

export default function Bookings() {
  const { data: bookings = [] } = useQuery<any[]>({ queryKey: ["/api/bookings"] });
  const qc = useQueryClient();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [cancelDialog, setCancelDialog] = useState<{ open: boolean; bookingId: string | null }>({ open: false, bookingId: null });
  const [cancelReason, setCancelReason] = useState("");

  const completeMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      const res = await apiRequest("POST", `/api/bookings/${bookingId}/complete`);
      if (!res.ok) throw new Error((await res.json()).error || "Failed to complete booking");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/bookings"] });
      toast({ title: "Booking marked as complete" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" })
  });

  const cancelMutation = useMutation({
    mutationFn: async ({ bookingId, reason }: { bookingId: string; reason: string }) => {
      const res = await apiRequest("POST", `/api/bookings/${bookingId}/cancel`, { reason });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to cancel booking");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/bookings"] });
      setCancelDialog({ open: false, bookingId: null });
      setCancelReason("");
      toast({ title: "Booking cancelled" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" })
  });

  const handleCancelConfirm = () => {
    if (!cancelDialog.bookingId) return;
    cancelMutation.mutate({ bookingId: cancelDialog.bookingId, reason: cancelReason });
  };

  const openChat = (b: any) => {
    if (b.conversationId) {
      navigate(buildConversationPath(false, b.conversationId));
    } else if (b.professionalId) {
      // Fallback: create or find conversation
      apiRequest("POST", "/api/conversations", { participantId: b.professionalId, jobId: b.jobId })
        .then(r => r.json())
        .then(data => navigate(buildConversationPath(false, data.id)))
        .catch(() => toast({ title: "Could not open chat", variant: "destructive" }));
    }
  };

  const actionableStatuses = ["CONFIRMED", "IN_PROGRESS"];
  const active = (bookings as any[]).filter(b => actionableStatuses.includes(b.status));
  const past = (bookings as any[]).filter(b => !actionableStatuses.includes(b.status));

  const BookingCard = ({ b }: { b: any }) => (
    <Card
      key={b.id}
      data-testid={`booking-${b.id}`}
      className="transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:hover:shadow-[0_8px_30px_rgb(0,0,0,0.2)] bg-white/60 dark:bg-black/40 backdrop-blur-xl border-white/40 dark:border-white/10 rounded-2xl overflow-hidden group"
    >
      <CardContent className="p-5 md:p-6">
        <div className="flex flex-col md:flex-row items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <Link href={`/jobs/${b.jobId}`}>
                <p className="font-heading font-bold text-lg group-hover:text-primary transition-colors cursor-pointer hover:underline">
                  {b.job?.title || `Booking #${b.id.slice(-8)}`}
                </p>
              </Link>
              <StatusPill status={b.status} />
              {b.job?.referenceCode && (
                <span className="text-xs font-mono text-muted-foreground flex items-center gap-0.5">
                  <Hash className="w-3 h-3" />{b.job.referenceCode}
                </span>
              )}
            </div>
            <div className="mb-3">
              <BookingTimeline booking={b} compact />
            </div>
            {b.professional && (
              <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                <User className="w-3.5 h-3.5" />
                <span>{b.professional.firstName} {b.professional.lastName}</span>
              </div>
            )}
            {b.job?.locationText && (
              <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                <MapPin className="w-3 h-3" />
                <span>{b.job.locationText}</span>
              </div>
            )}
            <div className="flex items-center gap-x-4 gap-y-1 mt-2 flex-wrap text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5 font-medium text-foreground/80">
                <Euro className="w-3.5 h-3.5 text-green-500" />€{b.totalAmount}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                {formatDistanceToNow(new Date(b.createdAt), { addSuffix: true })}
              </span>
              {b.scheduledDate && (
                <span className="flex items-center gap-1.5 text-primary/80">
                  <CalendarCheck className="w-3.5 h-3.5" />
                  Scheduled: {new Date(b.scheduledDate).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-3 shrink-0 w-full md:w-auto mt-auto">
            <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
              {(b.conversationId || b.professionalId) && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 rounded-xl h-9 px-3 text-xs flex-1 md:flex-auto"
                  onClick={() => openChat(b)}
                >
                  <MessageCircle className="w-3.5 h-3.5" /> Chat
                </Button>
              )}
              {actionableStatuses.includes(b.status) && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-green-600 border-green-200 bg-green-50/50 hover:bg-green-100 rounded-xl h-9 px-3 text-xs flex-1 md:flex-auto"
                    onClick={() => completeMutation.mutate(b.id)}
                    disabled={completeMutation.isPending}
                    data-testid={`button-complete-${b.id}`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Complete
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-destructive border-destructive/20 bg-destructive/5 hover:bg-destructive/10 rounded-xl h-9 px-3 text-xs flex-1 md:flex-auto"
                    onClick={() => { setCancelDialog({ open: true, bookingId: b.id }); setCancelReason(""); }}
                    disabled={cancelMutation.isPending}
                    data-testid={`button-cancel-${b.id}`}
                  >
                    <XCircle className="w-3.5 h-3.5" /> Cancel
                  </Button>
                </>
              )}
              {b.status === "COMPLETED" && (
                <>
                  {!b.hasReview && (
                    <Button
                      size="sm"
                      variant="default"
                      className="gap-1.5 rounded-xl h-9 px-3 text-xs flex-1 md:flex-auto bg-amber-500 hover:bg-amber-600 text-white shadow-sm"
                      onClick={() => navigate(`/jobs/${b.jobId}`)}
                      data-testid={`button-review-${b.id}`}
                    >
                      <Star className="w-3.5 h-3.5" /> Leave a Review
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1.5 rounded-xl h-9 px-3 text-xs flex-1 md:flex-auto"
                    onClick={() => navigate(`/jobs/${b.jobId}`)}
                  >
                    <ArrowRight className="w-3.5 h-3.5" /> View Job
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const totalSpent = past
    .filter(b => b.status === "COMPLETED" && b.totalAmount)
    .reduce((sum, b) => sum + Number(b.totalAmount || 0), 0);

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-5xl mx-auto">
        <PageHeader
          eyebrow="Customer"
          title="Bookings"
          description="Track bookings from quote acceptance through completion. Cancel, complete or leave a review in one click."
          icon={<ListChecks className="w-5 h-5" />}
        />

        {/* Summary strip */}
        {(bookings as any[]).length > 0 && (
          <div className="grid grid-cols-3 gap-3 bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-2xl p-4 shadow-sm">
            <div className="text-center border-r border-border/40">
              <p className="text-2xl font-bold font-outfit text-indigo-600 dark:text-indigo-400">{active.length}</p>
              <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mt-0.5">Active</p>
            </div>
            <div className="text-center border-r border-border/40">
              <p className="text-2xl font-bold font-outfit text-emerald-600 dark:text-emerald-400">
                {past.filter(b => b.status === "COMPLETED").length}
              </p>
              <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mt-0.5">Completed</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold font-outfit text-foreground">
                €{totalSpent.toLocaleString("en-IE", { maximumFractionDigits: 0 })}
              </p>
              <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mt-0.5">Total spend</p>
            </div>
          </div>
        )}

        {(bookings as any[]).length === 0 ? (
          <EmptyState
            icon={<ListChecks className="w-7 h-7" />}
            title="No bookings yet"
            description="When you accept a quote from a professional, it will appear here. Bookings track scheduling, completion and reviews in one place."
            primaryAction={
              <Link href="/post-job">
                <Button className="gap-2 rounded-xl shadow-md shadow-primary/20">
                  <PlusCircle className="w-4 h-4" /> Post your first job
                </Button>
              </Link>
            }
            secondaryAction={
              <Link href="/my-jobs">
                <Button variant="ghost" className="rounded-xl">View jobs</Button>
              </Link>
            }
          />
        ) : (
          <div className="space-y-6">
            {active.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">Active ({active.length})</p>
                {active.map(b => <BookingCard key={b.id} b={b} />)}
              </div>
            )}
            {past.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">Past ({past.length})</p>
                {past.map(b => <BookingCard key={b.id} b={b} />)}
              </div>
            )}
          </div>
        )}
      </div>

      <Dialog open={cancelDialog.open} onOpenChange={(open) => { if (!open) setCancelDialog({ open: false, bookingId: null }); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Booking</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label htmlFor="cancel-reason">Reason for cancellation (optional)</Label>
            <Textarea
              id="cancel-reason"
              placeholder="Let the professional know why you're cancelling..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={3}
              data-testid="input-cancel-reason"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialog({ open: false, bookingId: null })}>Keep Booking</Button>
            <Button variant="destructive" onClick={handleCancelConfirm} disabled={cancelMutation.isPending} data-testid="button-confirm-cancel">
              {cancelMutation.isPending ? "Cancelling..." : "Yes, Cancel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
