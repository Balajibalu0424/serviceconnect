import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusPill } from "@/components/ui/status-pill";
import { ListSkeleton } from "@/components/ui/loading-skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ListChecks, MessageCircle, MapPin, User, CheckCircle2, Clock, Euro, Hash, CalendarCheck, ArrowRight, XCircle } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { BookingTimeline } from "@/components/bookings/BookingTimeline";
import { buildConversationPath } from "@shared/chatRoutes";

export default function ProBookings() {
  const { data: bookings = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/bookings"] });
  const [selectedBooking, setSelectedBooking] = useState<any | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const markInProgress = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/bookings/${id}/in-progress`);
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      toast({ title: "Booking updated", description: "The job is now marked as in progress." });
      setSelectedBooking((prev: any) => prev ? { ...prev, status: "IN_PROGRESS" } : null);
    },
    onError: (error: Error) => {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    }
  });

  const markComplete = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/bookings/${id}/complete`);
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      toast({ title: "Booking completed! 🎉", description: "The job has been marked as complete. Encourage the customer to leave a review." });
      setSelectedBooking((prev: any) => prev ? { ...prev, status: "COMPLETED", completedAt: new Date().toISOString() } : null);
    },
    onError: (error: Error) => {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    }
  });

  const cancelBooking = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const res = await apiRequest("POST", `/api/bookings/${id}/cancel`, { reason });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      toast({ title: "Booking cancelled", description: "The customer has been notified." });
      setSelectedBooking(null);
      setCancelReason("");
      setShowCancelConfirm(false);
    },
    onError: (error: Error) => {
      toast({ title: "Cancel failed", description: error.message, variant: "destructive" });
    }
  });

  const startMessage = useMutation({
    mutationFn: async (booking: any) => {
      // Pass jobId so we find the existing conversation linked to this job (not create a new one)
      const res = await apiRequest("POST", "/api/conversations", {
        participantId: booking.customerId,
        jobId: booking.jobId,
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to find conversation");
      return res.json();
    },
    onSuccess: (data) => {
      setSelectedBooking(null);
      setLocation(buildConversationPath(true, data.id));
    },
    onError: (error: Error) => {
      toast({ title: "Could not open chat", description: error.message, variant: "destructive" });
    }
  });

  const activeBookings = (bookings as any[]).filter(b => ["CONFIRMED", "IN_PROGRESS"].includes(b.status));
  const pastBookings = (bookings as any[]).filter(b => !["CONFIRMED", "IN_PROGRESS"].includes(b.status));

  const BookingCard = ({ b }: { b: any }) => (
    <Card
      key={b.id}
      className="transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:hover:shadow-[0_8px_30px_rgb(0,0,0,0.2)] bg-white/60 dark:bg-black/40 backdrop-blur-xl border-white/40 dark:border-white/10 rounded-2xl overflow-hidden group cursor-pointer"
      onClick={() => setSelectedBooking(b)}
    >
      <CardContent className="p-5 md:p-6">
        <div className="flex flex-col md:flex-row items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <p className="font-heading font-bold text-lg group-hover:text-primary transition-colors">
                {b.job?.title || `Booking #${String(b.id).slice(-8)}`}
              </p>
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
            <div className="flex items-center gap-2 mt-1">
              <User className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {b.customer ? `${b.customer.firstName} ${b.customer.lastName}` : "Customer"}
              </span>
            </div>
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
                  {new Date(b.scheduledDate).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0 w-full md:w-auto h-full justify-between">
            <Button variant="ghost" size="sm" className="gap-1 opacity-0 group-hover:opacity-100 transition-opacity text-xs mt-auto">
              View Details <ArrowRight className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const totalEarnings = (bookings as any[])
    .filter(b => b.status === "COMPLETED" && b.totalAmount)
    .reduce((sum, b) => sum + Number(b.totalAmount || 0), 0);

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-5xl mx-auto">
        <PageHeader
          eyebrow="Professional"
          title="My bookings"
          description="Active jobs and completed work. Mark progress, complete jobs, and chat with customers directly."
          icon={<ListChecks className="w-5 h-5" />}
        />

        {/* Summary tiles */}
        {(bookings as any[]).length > 0 && (
          <div className="grid grid-cols-3 gap-3 bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-2xl p-4 shadow-sm">
            <div className="text-center border-r border-border/40">
              <p className="text-2xl font-bold font-outfit text-indigo-600 dark:text-indigo-400">{activeBookings.length}</p>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mt-0.5">Active</p>
            </div>
            <div className="text-center border-r border-border/40">
              <p className="text-2xl font-bold font-outfit text-emerald-600 dark:text-emerald-400">
                {pastBookings.filter(b => b.status === "COMPLETED").length}
              </p>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mt-0.5">Completed</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold font-outfit text-foreground">
                €{totalEarnings.toLocaleString("en-IE", { maximumFractionDigits: 0 })}
              </p>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mt-0.5">Earnings</p>
            </div>
          </div>
        )}

        {isLoading ? (
          <ListSkeleton rows={3} />
        ) : (bookings as any[]).length === 0 ? (
          <EmptyState
            icon={<ListChecks className="w-7 h-7" />}
            title="No bookings yet"
            description="When a customer accepts your quote, the booking appears here. Unlock more jobs and submit quotes to grow your bookings."
          />
        ) : (
          <div className="space-y-6">
            {activeBookings.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">Active ({activeBookings.length})</p>
                {activeBookings.map(b => <BookingCard key={b.id} b={b} />)}
              </div>
            )}
            {pastBookings.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">Past ({pastBookings.length})</p>
                {pastBookings.map(b => <BookingCard key={b.id} b={b} />)}
              </div>
            )}
          </div>
        )}
      </div>

      <Dialog open={!!selectedBooking} onOpenChange={(open) => !open && setSelectedBooking(null)}>
        {selectedBooking && (
          <DialogContent className="max-w-md bg-white/90 dark:bg-black/90 backdrop-blur-2xl border-white/20 max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-heading text-xl">{selectedBooking.job?.title || "Booking Details"}</DialogTitle>
              <DialogDescription className="flex items-center gap-1.5 mt-1">
                {selectedBooking.job?.referenceCode && (
                  <span className="font-mono bg-muted/50 text-foreground px-1.5 py-0.5 rounded text-xs">
                    <Hash className="w-3 h-3 inline mr-0.5 relative -top-[1px]" />{selectedBooking.job.referenceCode}
                  </span>
                )}
                <span>Created {formatDistanceToNow(new Date(selectedBooking.createdAt), { addSuffix: true })}</span>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-2">
              {/* Timeline Status */}
              <div className="bg-muted/10 rounded-xl p-4 border border-border/40">
                <BookingTimeline booking={selectedBooking} />
              </div>

              {/* Customer */}
              <div className="bg-muted/30 rounded-xl p-4 space-y-3">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Customer</h4>
                {selectedBooking.customer ? (
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 border border-white/20 shadow-sm">
                      <AvatarImage src={selectedBooking.customer.avatarUrl || ""} />
                      <AvatarFallback className="bg-primary/10 text-primary uppercase text-sm">
                        {selectedBooking.customer.firstName?.[0]}{selectedBooking.customer.lastName?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-sm">{selectedBooking.customer.firstName} {selectedBooking.customer.lastName}</p>
                      {selectedBooking.customer.phone && (
                        <p className="text-xs text-muted-foreground">{selectedBooking.customer.phone}</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Details unavailable</p>
                )}
              </div>

              {/* Job details */}
              {selectedBooking.job && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Job Details</h4>
                  <p className="text-sm text-foreground/90 leading-relaxed">{selectedBooking.job.description}</p>
                  {selectedBooking.job.locationText && (
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <MapPin className="w-4 h-4" />
                      <span>{selectedBooking.job.locationText}</span>
                      {selectedBooking.job.locationEircode && (
                        <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded ml-1">{selectedBooking.job.locationEircode}</span>
                      )}
                    </div>
                  )}
                  {selectedBooking.job.category?.name && (
                    <Badge variant="outline" className="text-xs">{selectedBooking.job.category.name}</Badge>
                  )}
                </div>
              )}

              {/* Amount */}
              <div className="flex items-center justify-between border-t border-border/50 pt-4">
                <span className="font-medium text-sm">Agreed Amount</span>
                <span className="text-xl font-bold">€{selectedBooking.totalAmount}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => startMessage.mutate(selectedBooking)}
                disabled={startMessage.isPending}
              >
                <MessageCircle className="w-4 h-4" />
                {startMessage.isPending ? "Opening…" : "Open Chat"}
              </Button>
              {selectedBooking.status === "CONFIRMED" && (
                <Button
                  className="gap-2 shadow-lg shadow-primary/20 hover:shadow-primary/40"
                  onClick={() => markInProgress.mutate(selectedBooking.id)}
                  disabled={markInProgress.isPending}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {markInProgress.isPending ? "Updating…" : "Mark In Progress"}
                </Button>
              )}
              {selectedBooking.status === "IN_PROGRESS" && (
                <Button
                  className="gap-2 bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 text-white"
                  onClick={() => markComplete.mutate(selectedBooking.id)}
                  disabled={markComplete.isPending}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {markComplete.isPending ? "Completing…" : "Mark Complete"}
                </Button>
              )}
              {(selectedBooking.status === "CONFIRMED" || selectedBooking.status === "IN_PROGRESS") && !showCancelConfirm && (
                <Button
                  variant="outline"
                  className="gap-2 text-destructive border-destructive/20 hover:bg-destructive/10"
                  onClick={() => setShowCancelConfirm(true)}
                >
                  <XCircle className="w-4 h-4" /> Cancel Booking
                </Button>
              )}
            </div>
            {showCancelConfirm && (
              <div className="mt-2 flex flex-col gap-2 border border-destructive/30 rounded-xl p-3 bg-destructive/5">
                <p className="text-sm font-medium text-destructive">Cancel this booking? The customer will be notified.</p>
                <Textarea
                  placeholder="Reason (optional)…"
                  value={cancelReason}
                  onChange={e => setCancelReason(e.target.value)}
                  rows={2}
                  className="text-sm"
                />
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="ghost" onClick={() => setShowCancelConfirm(false)}>Back</Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => cancelBooking.mutate({ id: selectedBooking.id, reason: cancelReason })}
                    disabled={cancelBooking.isPending}
                  >
                    {cancelBooking.isPending ? "Cancelling…" : "Confirm Cancel"}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        )}
      </Dialog>
    </DashboardLayout>
  );
}
