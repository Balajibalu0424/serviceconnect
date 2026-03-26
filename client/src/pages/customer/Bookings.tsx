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
          <div className="space-y-3">
            {(bookings as any[]).map((b: any) => (
              <Card key={b.id} data-testid={`booking-${b.id}`} className="transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:hover:shadow-[0_8px_30px_rgb(0,0,0,0.2)] bg-white/60 dark:bg-black/40 backdrop-blur-xl border-white/40 dark:border-white/10 rounded-2xl overflow-hidden group">
                <CardContent className="p-5 md:p-6">
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-heading font-bold text-lg group-hover:text-primary transition-colors">Booking #{b.id.slice(-8)}</p>
                      <div className="flex items-center gap-x-4 gap-y-2 mt-2 flex-wrap text-sm text-muted-foreground">
                        <span className="font-medium text-foreground/80 bg-muted/40 px-2 py-0.5 rounded-md">€{b.totalAmount}</span>
                        <span>{formatDistanceToNow(new Date(b.createdAt), { addSuffix: true })}</span>
                        {b.scheduledDate && (
                          <span className="text-primary/80 font-medium">
                            Scheduled: {new Date(b.scheduledDate).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-3 shrink-0 w-full md:w-auto">
                      <Badge variant={STATUS_COLORS[b.status] as any} className="text-xs px-2.5 py-1 uppercase tracking-wider bg-white/50 shadow-sm">{b.status}</Badge>
                      {actionableStatuses.includes(b.status) && (
                        <div className="flex items-center gap-2 mt-2 md:mt-0 w-full md:w-auto">
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-2 text-green-600 border-green-200 bg-green-50/50 hover:bg-green-100 hover:text-green-700 hover:border-green-300 transition-colors rounded-xl h-9 px-4 flex-1 md:flex-auto"
                            onClick={() => completeMutation.mutate(b.id)}
                            disabled={completeMutation.isPending}
                            data-testid={`button-complete-${b.id}`}
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            Complete
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-2 text-destructive border-destructive/20 bg-destructive/5 hover:bg-destructive/10 hover:border-destructive/30 transition-colors rounded-xl h-9 px-4 flex-1 md:flex-auto"
                            onClick={() => { setCancelDialog({ open: true, bookingId: b.id }); setCancelReason(""); }}
                            disabled={cancelMutation.isPending}
                            data-testid={`button-cancel-${b.id}`}
                          >
                            <XCircle className="w-4 h-4" />
                            Cancel
                          </Button>
                        </div>
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
