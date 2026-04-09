import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  CalendarCheck, ChevronLeft, ChevronRight, CheckCircle2, XCircle,
  ShieldAlert, Clock, User, Briefcase, Inbox, Loader2, TrendingUp, Euro,
} from "lucide-react";
import { format } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, { color: string; label: string }> = {
  CONFIRMED:   { color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400", label: "Confirmed" },
  IN_PROGRESS: { color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", label: "In Progress" },
  COMPLETED:   { color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", label: "Completed" },
  CANCELLED:   { color: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400", label: "Cancelled" },
  DISPUTED:    { color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", label: "Disputed" },
};

const ALL_STATUSES = ["CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "DISPUTED"];
const PAGE_SIZE = 20;

export default function AdminBookings() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);

  // Cancel dialog state
  const [cancelDialog, setCancelDialog] = useState<{ open: boolean; bookingId: number | null }>({ open: false, bookingId: null });
  const [cancelReason, setCancelReason] = useState("");

  // Build query params
  const params = new URLSearchParams();
  if (statusFilter !== "all") params.set("status", statusFilter);
  params.set("page", String(page));
  params.set("limit", String(PAGE_SIZE));

  const { data, isLoading } = useQuery<any>({
    queryKey: [`/api/admin/bookings?${params}`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/bookings?${params}`);
      if (!res.ok) throw new Error("Failed to fetch bookings");
      return res.json();
    },
  });

  const bookings = data?.bookings || [];
  const total = data?.total || 0;
  const funnel = data?.funnel || {};
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const invalidateBookings = () => {
    qc.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string)?.startsWith("/api/admin/bookings") });
  };

  // Mutation: update booking status
  const updateStatus = useMutation({
    mutationFn: async ({ id, status, cancellationReason }: { id: number; status: string; cancellationReason?: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/bookings/${id}`, { status, cancellationReason });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to update booking");
      return res.json();
    },
    onSuccess: (_d, vars) => {
      invalidateBookings();
      toast({ title: `Booking ${vars.status === "COMPLETED" ? "marked complete" : vars.status === "CANCELLED" ? "cancelled" : "updated"}` });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleCancel = () => {
    if (!cancelDialog.bookingId || !cancelReason.trim()) return;
    updateStatus.mutate({ id: cancelDialog.bookingId, status: "CANCELLED", cancellationReason: cancelReason.trim() });
    setCancelDialog({ open: false, bookingId: null });
    setCancelReason("");
  };

  return (
    <DashboardLayout>
      <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-outfit flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                <CalendarCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              Booking Management
              <Badge variant="secondary" className="text-xs px-2.5 py-0.5 rounded-full font-mono">
                {total}
              </Badge>
            </h1>
            <p className="text-sm text-muted-foreground">Monitor, update, and resolve all platform bookings</p>
          </div>
        </div>

        {/* Funnel KPI Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {[
            { label: "Total Bookings", value: funnel.total ?? 0, icon: CalendarCheck, iconColor: "text-indigo-500" },
            { label: "Confirmed", value: funnel.confirmed ?? 0, icon: CheckCircle2, iconColor: "text-blue-500" },
            { label: "In Progress", value: funnel.inProgress ?? 0, icon: Clock, iconColor: "text-amber-500" },
            { label: "Completed", value: funnel.completed ?? 0, icon: CheckCircle2, iconColor: "text-green-500" },
            { label: "Cancelled", value: funnel.cancelled ?? 0, icon: XCircle, iconColor: "text-gray-400" },
            { label: "Disputed", value: funnel.disputed ?? 0, icon: ShieldAlert, iconColor: "text-red-500" },
            { label: "Completion Rate", value: `${parseFloat(String(funnel.completionRate ?? 0)).toFixed(1)}%`, icon: TrendingUp, iconColor: "text-emerald-500" },
            { label: "Total Value", value: `\u20AC${parseFloat(String(funnel.totalCompletedValue ?? 0)).toLocaleString("en-IE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, icon: Euro, iconColor: "text-emerald-600" },
          ].map((kpi) => (
            <Card key={kpi.label} className="bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-white/40 dark:border-white/10">
              <CardContent className="pt-4 pb-4 px-4">
                <div className="flex items-center justify-between mb-1">
                  <kpi.icon className={cn("w-4 h-4 opacity-70", kpi.iconColor)} />
                </div>
                <p className="text-lg font-bold leading-tight">{kpi.value}</p>
                <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">{kpi.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Status Filter */}
        <div className="bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-2xl p-4 shadow-sm">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
              <SelectTrigger className="w-full sm:w-52 rounded-xl">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {ALL_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    <span className="flex items-center gap-2">
                      <span className={cn("w-2 h-2 rounded-full", STATUS_STYLES[s]?.color.split(" ")[0])} />
                      {STATUS_STYLES[s]?.label || s}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {statusFilter !== "all" && (
              <Button variant="ghost" size="sm" onClick={() => { setStatusFilter("all"); setPage(1); }}>
                Clear filter
              </Button>
            )}
          </div>
        </div>

        {/* Booking List */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-2xl p-5 animate-pulse">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-48 bg-muted rounded" />
                    <div className="h-3 w-72 bg-muted rounded" />
                  </div>
                  <div className="h-8 w-20 bg-muted rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : bookings.length === 0 ? (
          <div className="bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-2xl shadow-sm">
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-2xl bg-muted/30 flex items-center justify-center mb-4">
                <Inbox className="w-8 h-8 text-muted-foreground/30" />
              </div>
              <h3 className="text-lg font-semibold font-outfit mb-1">No bookings found</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                {statusFilter !== "all" ? "Try adjusting your filter." : "No bookings have been created yet."}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {bookings.map((booking: any) => {
              const style = STATUS_STYLES[booking.status] || { color: "", label: booking.status };
              return (
                <div
                  key={booking.id}
                  data-testid={`admin-booking-${booking.id}`}
                  className="bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-2xl p-4 md:p-5 hover:shadow-md transition-all duration-200 group"
                >
                  <div className="flex flex-col md:flex-row md:items-center gap-4">
                    {/* Left: Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
                        <p className="font-bold text-sm">
                          {"\u20AC"}{parseFloat(booking.totalAmount || 0).toFixed(2)}
                        </p>
                        <Badge className={cn("text-[11px] px-2 py-0.5 rounded-full font-semibold border-0", style.color)}>
                          {style.label}
                        </Badge>
                        <p className="font-semibold text-sm truncate group-hover:text-primary transition-colors">
                          {booking.jobTitle || `Booking #${booking.id}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          <Briefcase className="w-3 h-3" /> {booking.proName || "Unassigned"}
                        </span>
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" /> {booking.customerName || "Unknown"}
                        </span>
                        <span className="flex items-center gap-1">
                          <CalendarCheck className="w-3 h-3" />
                          {booking.serviceDate
                            ? format(new Date(booking.serviceDate), "d MMM yyyy")
                            : "No date"}
                          {booking.serviceTime ? ` at ${booking.serviceTime}` : ""}
                        </span>
                        {booking.durationHours && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {booking.durationHours}h
                          </span>
                        )}
                      </div>
                      {booking.cancellationReason && (
                        <p className="text-xs text-red-500 mt-1 truncate">
                          Reason: {booking.cancellationReason}
                        </p>
                      )}
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {(booking.status === "CONFIRMED" || booking.status === "IN_PROGRESS") && (
                        <Button
                          size="sm"
                          className="gap-1.5 rounded-xl bg-green-600 hover:bg-green-700 text-white shadow-sm"
                          onClick={() => updateStatus.mutate({ id: booking.id, status: "COMPLETED" })}
                          disabled={updateStatus.isPending}
                        >
                          {updateStatus.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                          Complete
                        </Button>
                      )}
                      {booking.status === "DISPUTED" && (
                        <Button
                          size="sm"
                          className="gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                          onClick={() => updateStatus.mutate({ id: booking.id, status: "COMPLETED" })}
                          disabled={updateStatus.isPending}
                        >
                          {updateStatus.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldAlert className="w-3.5 h-3.5" />}
                          Resolve
                        </Button>
                      )}
                      {!["COMPLETED", "CANCELLED"].includes(booking.status) && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10 rounded-xl gap-1.5"
                          onClick={() => { setCancelDialog({ open: true, bookingId: booking.id }); setCancelReason(""); }}
                          disabled={updateStatus.isPending}
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-muted-foreground">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total} bookings
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1 rounded-xl"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="w-4 h-4" /> Previous
              </Button>
              <span className="text-sm font-medium px-2">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="gap-1 rounded-xl"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Cancel Dialog */}
      <Dialog open={cancelDialog.open} onOpenChange={(open) => { if (!open) setCancelDialog({ open: false, bookingId: null }); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel Booking</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="cancel-reason">Cancellation Reason</Label>
              <Textarea
                id="cancel-reason"
                placeholder="Provide a reason for cancelling this booking..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialog({ open: false, bookingId: null })}>
              Back
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={!cancelReason.trim() || updateStatus.isPending}
            >
              {updateStatus.isPending && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
              Confirm Cancellation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
