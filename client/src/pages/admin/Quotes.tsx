import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  FileText, ChevronLeft, ChevronRight, Inbox, Loader2,
  Clock, TrendingUp, CheckCircle2, XCircle, BarChart3, Euro
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  ACCEPTED: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  REJECTED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  WITHDRAWN: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
};

const ALL_STATUSES = ["PENDING", "ACCEPTED", "REJECTED", "WITHDRAWN"];
const PAGE_SIZE = 20;

export default function AdminQuotes() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);

  const params = new URLSearchParams();
  if (statusFilter !== "all") params.set("status", statusFilter);
  params.set("page", String(page));
  params.set("limit", String(PAGE_SIZE));

  const { data, isLoading } = useQuery<any>({
    queryKey: [`/api/admin/quotes?${params}`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/quotes?${params}`);
      if (!res.ok) throw new Error("Failed to fetch quotes");
      return res.json();
    },
  });

  const quotes = data?.quotes || [];
  const total = data?.total || 0;
  const funnel = data?.funnel || { total: 0, pending: 0, accepted: 0, rejected: 0, avgAmount: 0, conversionRate: 0 };
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/quotes/${id}`, { status });
      if (!res.ok) throw new Error((await res.json()).error || "Update failed");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string)?.startsWith("/api/admin/quotes") });
      toast({ title: "Quote status updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const kpiCards = [
    { label: "Total Quotes", value: funnel.total, icon: FileText, color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-500/10" },
    { label: "Pending", value: funnel.pending, icon: Clock, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10" },
    { label: "Accepted", value: funnel.accepted, icon: CheckCircle2, color: "text-green-600 dark:text-green-400", bg: "bg-green-500/10" },
    { label: "Rejected", value: funnel.rejected, icon: XCircle, color: "text-red-600 dark:text-red-400", bg: "bg-red-500/10" },
    { label: "Avg Amount", value: `\u20AC${Number(funnel.avgAmount).toFixed(2)}`, icon: Euro, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10" },
    { label: "Conversion Rate", value: `${Number(funnel.conversionRate).toFixed(1)}%`, icon: TrendingUp, color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-500/10" },
  ];

  return (
    <DashboardLayout>
      <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-outfit flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              Quote Management
              <Badge variant="secondary" className="text-xs px-2.5 py-0.5 rounded-full font-mono">
                {total}
              </Badge>
            </h1>
            <p className="text-sm text-muted-foreground">Review and manage professional quotes across the marketplace</p>
          </div>
        </div>

        {/* KPI Funnel Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {kpiCards.map((kpi) => (
            <div
              key={kpi.label}
              className="bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-2xl p-4 shadow-sm"
            >
              <div className="flex items-center gap-2.5 mb-2">
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", kpi.bg)}>
                  <kpi.icon className={cn("w-4 h-4", kpi.color)} />
                </div>
              </div>
              <p className="text-xl font-bold tracking-tight">{kpi.value}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{kpi.label}</p>
            </div>
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
                      <span className={cn("w-2 h-2 rounded-full", STATUS_COLORS[s]?.split(" ")[0])} />
                      {s.charAt(0) + s.slice(1).toLowerCase()}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {statusFilter !== "all" && (
              <Button variant="ghost" size="sm" className="rounded-xl" onClick={() => { setStatusFilter("all"); setPage(1); }}>
                Clear filter
              </Button>
            )}
          </div>
        </div>

        {/* Quote List */}
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
        ) : quotes.length === 0 ? (
          <div className="bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-2xl shadow-sm">
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-2xl bg-muted/30 flex items-center justify-center mb-4">
                <Inbox className="w-8 h-8 text-muted-foreground/30" />
              </div>
              <h3 className="text-lg font-semibold font-outfit mb-1">No quotes found</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                {statusFilter !== "all" ? "Try adjusting your status filter." : "No quotes have been submitted yet."}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {quotes.map((quote: any) => {
              const statusColor = STATUS_COLORS[quote.status] || "";
              return (
                <div
                  key={quote.id}
                  data-testid={`admin-quote-${quote.id}`}
                  className="bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-2xl p-4 md:p-5 hover:shadow-md transition-all duration-200 group"
                >
                  <div className="flex flex-col md:flex-row md:items-center gap-4">
                    {/* Left: Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
                        <p className="font-bold text-sm">{"\u20AC"}{Number(quote.amount).toFixed(2)}</p>
                        <Badge className={cn("text-[11px] px-2 py-0.5 rounded-full font-semibold border-0", statusColor)}>
                          {quote.status}
                        </Badge>
                        <span className="text-sm font-medium text-foreground/80 truncate">{quote.jobTitle}</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                        <span>Pro: <span className="font-medium text-foreground/70">{quote.proName}</span></span>
                        <span>Customer: <span className="font-medium text-foreground/70">{quote.customerName}</span></span>
                        {quote.estimatedDuration && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {quote.estimatedDuration}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {formatDistanceToNow(new Date(quote.createdAt), { addSuffix: true })}
                        </span>
                        {quote.validUntil && (
                          <span>Valid until {format(new Date(quote.validUntil), "d MMM yyyy")}</span>
                        )}
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {quote.status === "PENDING" && (
                        <>
                          <Button
                            size="sm"
                            className="gap-1.5 rounded-xl bg-green-600 hover:bg-green-700 text-white shadow-sm"
                            onClick={() => updateStatus.mutate({ id: quote.id, status: "ACCEPTED" })}
                            disabled={updateStatus.isPending}
                          >
                            {updateStatus.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                            Accept
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10 rounded-xl gap-1.5"
                            onClick={() => updateStatus.mutate({ id: quote.id, status: "REJECTED" })}
                            disabled={updateStatus.isPending}
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            Reject
                          </Button>
                        </>
                      )}
                      {quote.status === "ACCEPTED" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10 rounded-xl gap-1.5"
                          onClick={() => updateStatus.mutate({ id: quote.id, status: "WITHDRAWN" })}
                          disabled={updateStatus.isPending}
                        >
                          Withdraw
                        </Button>
                      )}
                      {quote.status === "REJECTED" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-xl gap-1.5"
                          onClick={() => updateStatus.mutate({ id: quote.id, status: "PENDING" })}
                          disabled={updateStatus.isPending}
                        >
                          Re-open
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
              Showing {(page - 1) * PAGE_SIZE + 1}--{Math.min(page * PAGE_SIZE, total)} of {total} quotes
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
    </DashboardLayout>
  );
}
