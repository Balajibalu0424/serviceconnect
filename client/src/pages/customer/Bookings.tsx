import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ListChecks, CheckCircle2, XCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const STATUS_COLORS: Record<string, string> = {
  CONFIRMED: "default",
  IN_PROGRESS: "secondary",
  COMPLETED: "outline",
  CANCELLED: "destructive",
  DISPUTED: "destructive"
};

export default function Bookings() {
  const { data: bookings = [] } = useQuery<any[]>({ queryKey: ["/api/bookings"] });
  const qc = useQueryClient();
  const { toast } = useToast();

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

  const actionableStatuses = ["CONFIRMED", "IN_PROGRESS"];

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <h1 className="text-xl font-bold">Bookings</h1>
        {(bookings as any[]).length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <ListChecks className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>No bookings yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {(bookings as any[]).map((b: any) => (
              <Card key={b.id} data-testid={`booking-${b.id}`}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">Booking #{b.id.slice(-8)}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        €{b.totalAmount} · {formatDistanceToNow(new Date(b.createdAt), { addSuffix: true })}
                      </p>
                      {b.scheduledDate && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Scheduled: {new Date(b.scheduledDate).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={STATUS_COLORS[b.status] as any}>{b.status}</Badge>
                      {actionableStatuses.includes(b.status) && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 text-green-600 border-green-200 hover:bg-green-50 hover:text-green-700"
                            onClick={() => completeMutation.mutate(b.id)}
                            disabled={completeMutation.isPending}
                            data-testid={`button-complete-${b.id}`}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Complete
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 text-destructive border-destructive/30 hover:bg-destructive/5"
                            onClick={() => { setCancelDialog({ open: true, bookingId: b.id }); setCancelReason(""); }}
                            disabled={cancelMutation.isPending}
                            data-testid={`button-cancel-${b.id}`}
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            Cancel
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Cancel confirmation dialog */}
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
            <Button variant="outline" onClick={() => setCancelDialog({ open: false, bookingId: null })}>
              Keep Booking
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelConfirm}
              disabled={cancelMutation.isPending}
              data-testid="button-confirm-cancel"
            >
              {cancelMutation.isPending ? "Cancelling..." : "Yes, Cancel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
