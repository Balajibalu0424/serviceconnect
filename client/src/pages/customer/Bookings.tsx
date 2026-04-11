import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ListChecks, CheckCircle2, XCircle, MessageCircle, User, MapPin, Clock, Euro, Hash, CalendarCheck, ArrowRight, Star } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation, Link } from "wouter";
import { cn } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  CONFIRMED: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  IN_PROGRESS: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  COMPLETED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  CANCELLED: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  DISPUTED: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

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
      navigate(`/chat?conversationId=${b.conversationId}`);
    } else if (b.professionalId) {
      // Fallback: create or find conversation
      apiRequest("POST", "/api/conversations", { participantId: b.professionalId, jobId: b.jobId })
        .then(r => r.json())
        .then(data => navigate(`/chat?conversationId=${data.id}`))
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
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <Link href={`/jobs/${b.jobId}`}>
                <p className="font-heading font-bold text-lg group-hover:text-primary transition-colors cursor-pointer hover:underline">
                  {b.job?.title || `Booking #${b.id.slice(-8)}`}
                </p>
              </Link>
              {b.job?.referenceCode && (
                <span className="text-xs font-mono text-muted-foreground flex items-center gap-0.5">
                  <Hash className="w-3 h-3" />{b.job.referenceCode}
                </span>
              )}
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
          <div className="flex flex-col items-end gap-3 shrink-0 w-full md:w-auto">
            <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider", STATUS_COLORS[b.status] || "bg-muted text-muted-foreground")}>
              {b.status.replace("_", " ")}
            </span>
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

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-heading font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300">Bookings</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage your confirmed and completed jobs</p>
          </div>
        </div>

        {(bookings as any[]).length === 0 ? (
          <div className="text-center py-24 text-muted-foreground bg-white/40 dark:bg-black/20 backdrop-blur-md rounded-3xl border border-white/20 dark:border-white/5">
            <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
              <ListChecks className="w-8 h-8 opacity-50" />
            </div>
            <p className="font-heading font-medium text-lg text-foreground">No bookings yet</p>
            <p className="text-sm mt-1 max-w-sm mx-auto">When you accept a quote from a professional, it will appear here as a booking.</p>
          </div>
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
