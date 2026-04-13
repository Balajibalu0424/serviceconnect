import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  CreditCard, Download, TrendingUp, AlertCircle, Clock, CheckCircle,
  Search, ChevronLeft, ChevronRight, Inbox, DollarSign, XCircle, Wallet,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { paymentCountsTowardsLiveRevenue } from "@shared/payments";

interface Payment {
  id: string;
  userId: string;
  amount: string;
  currency: string;
  status: "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED";
  paymentMethod: string;
  description: string | null;
  stripePaymentId: string | null;
  provider: string | null;
  mode: "LIVE" | "TEST" | "DEMO";
  providerChargeId: string | null;
  fulfilledAt: string | null;
  failedAt: string | null;
  failureReason: string | null;
  createdAt: string;
  userName: string | null;
  userEmail: string | null;
}

const PAGE_SIZE = 25;

const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: React.ElementType }> = {
  COMPLETED: { color: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-500/20", icon: CheckCircle },
  PENDING:   { color: "text-amber-700 dark:text-amber-400",   bg: "bg-amber-100 dark:bg-amber-500/20",   icon: Clock },
  FAILED:    { color: "text-red-700 dark:text-red-400",       bg: "bg-red-100 dark:bg-red-500/20",       icon: XCircle },
  REFUNDED:  { color: "text-blue-700 dark:text-blue-400",     bg: "bg-blue-100 dark:bg-blue-500/20",     icon: DollarSign },
};

const METHOD_COLORS: Record<string, string> = {
  stripe:  "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300",
  credits: "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300",
  manual:  "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300",
};

const MODE_COLORS: Record<string, string> = {
  LIVE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  TEST: "bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300",
  DEMO: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
};

function exportCSV(payments: Payment[]) {
  const headers = ["ID", "User", "Email", "Amount", "Currency", "Method", "Mode", "Description", "Status", "Stripe ID", "Charge ID", "Fulfilled At", "Date"];
  const rows = payments.map((p) => [
    p.id, p.userName || "", p.userEmail || "",
    parseFloat(p.amount).toFixed(2), p.currency || "EUR",
    p.paymentMethod, p.mode, p.description || "", p.status,
    p.stripePaymentId || "",
    p.providerChargeId || "",
    p.fulfilledAt ? format(new Date(p.fulfilledAt), "yyyy-MM-dd HH:mm") : "",
    format(new Date(p.createdAt), "yyyy-MM-dd HH:mm"),
  ]);
  const csv = [headers, ...rows]
    .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `payments-${format(new Date(), "yyyy-MM-dd")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function Skeleton({ className }: { className?: string }) {
  return <div className={cn("rounded-xl bg-muted/60 animate-pulse", className)} />;
}

export default function AdminPayments() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  if (typeFilter !== "all") params.set("type", typeFilter);

  const { data: payments = [], isLoading } = useQuery<Payment[]>({
    queryKey: [`/api/admin/payments?${params}`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/payments?${params}`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Client-side search filter
  const filtered = useMemo(() => {
    if (!search.trim()) return payments;
    const q = search.toLowerCase();
    return payments.filter(
      (p) =>
        (p.userName || "").toLowerCase().includes(q) ||
        (p.userEmail || "").toLowerCase().includes(q),
    );
  }, [payments, search]);

  // Reset page when filters change
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // KPI computations
  const fulfilledLivePayments = useMemo(
    () => payments.filter((p) => paymentCountsTowardsLiveRevenue(p)),
    [payments],
  );
  const totalRevenue = useMemo(
    () => fulfilledLivePayments.reduce((sum, payment) => sum + parseFloat(payment.amount || "0"), 0),
    [fulfilledLivePayments],
  );
  const pendingCount = useMemo(() => payments.filter((p) => p.status === "PENDING").length, [payments]);
  const failedCount = useMemo(() => payments.filter((p) => p.status === "FAILED").length, [payments]);
  const testOrDemoCount = useMemo(() => payments.filter((p) => p.mode !== "LIVE").length, [payments]);

  // Revenue breakdown by method
  const byMethod = useMemo(() => {
    const map: Record<string, number> = {};
    fulfilledLivePayments.forEach((p) => {
      const key = p.paymentMethod || "other";
      map[key] = (map[key] || 0) + parseFloat(p.amount || "0");
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [fulfilledLivePayments]);
  const maxMethodRevenue = byMethod.length > 0 ? byMethod[0][1] : 1;

  const glass = "bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-2xl shadow-sm";
  const hasFilters = from || to || typeFilter !== "all" || search;

  function clearFilters() {
    setFrom("");
    setTo("");
    setTypeFilter("all");
    setSearch("");
    setPage(1);
  }

  const kpis = [
    { label: "Live Revenue", value: `\u20AC${totalRevenue.toFixed(2)}`, icon: DollarSign, color: "text-emerald-500", bg: "bg-emerald-500/10" },
    { label: "Fulfilled Live", value: fulfilledLivePayments.length, icon: CheckCircle, color: "text-green-500", bg: "bg-green-500/10" },
    { label: "Pending", value: pendingCount, icon: Clock, color: "text-amber-500", bg: "bg-amber-500/10" },
    { label: "Failed", value: failedCount, icon: AlertCircle, color: "text-red-500", bg: "bg-red-500/10" },
    { label: "Test / Demo", value: testOrDemoCount, icon: CreditCard, color: "text-violet-500", bg: "bg-violet-500/10" },
  ];

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-heading font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300">
                Payment Operations
              </h1>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant="secondary" className="text-xs font-medium">
                  {filtered.length} payment{filtered.length !== 1 ? "s" : ""}
                </Badge>
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl"
            onClick={() => exportCSV(filtered)}
            disabled={filtered.length === 0}
          >
            <Download className="w-4 h-4 mr-1.5" />
            Export CSV
          </Button>
        </div>

        {/* KPI Row */}
        {isLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {kpis.map((k) => (
              <Card key={k.label} className={cn(glass, "hover:shadow-md transition-all")}>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{k.label}</p>
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", k.bg)}>
                      <k.icon className={cn("w-4 h-4", k.color)} />
                    </div>
                  </div>
                  <p className="text-2xl font-bold">{k.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Revenue breakdown by payment method */}
        {byMethod.length > 0 && (
          <Card className={cn(glass, "overflow-hidden")}>
            <CardHeader className="bg-muted/10 border-b border-border/40 pb-4">
              <CardTitle className="text-sm font-heading font-semibold text-foreground/80 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" /> Live Revenue by Payment Method
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-5 space-y-3">
              {byMethod.map(([method, amount]) => {
                const pct = totalRevenue > 0 ? (amount / totalRevenue) * 100 : 0;
                return (
                  <div key={method} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium capitalize">{method}</span>
                      <span className="text-muted-foreground">{"\u20AC"}{amount.toFixed(2)} ({pct.toFixed(1)}%)</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-muted/40 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-primary/80 to-primary transition-all duration-500"
                        style={{ width: `${(amount / maxMethodRevenue) * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <Card className={cn(glass, "overflow-hidden")}>
          <CardContent className="p-4">
            <div className="flex gap-3 flex-wrap items-end">
              <div className="flex-1 min-w-[200px] max-w-xs relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Search user name or email..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  className="pl-9 rounded-xl text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground whitespace-nowrap">From</label>
                <Input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="w-36 text-sm rounded-xl"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground whitespace-nowrap">To</label>
                <Input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="w-36 text-sm rounded-xl"
                />
              </div>
              <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
                <SelectTrigger className="w-40 rounded-xl">
                  <SelectValue placeholder="Method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All methods</SelectItem>
                  <SelectItem value="stripe">Stripe</SelectItem>
                  <SelectItem value="credits">Credits</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
              {hasFilters && (
                <Button variant="ghost" size="sm" className="rounded-xl" onClick={clearFilters}>
                  Clear
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Payment list */}
        <div className="space-y-2">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-[72px] rounded-2xl" />
            ))
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Inbox className="w-10 h-10 mb-3 opacity-20" />
              <p className="font-medium">No payments found</p>
              <p className="text-sm mt-1">Try adjusting your filters</p>
            </div>
          ) : (
            paginated.map((p) => {
              const cfg = STATUS_CONFIG[p.status] || STATUS_CONFIG.PENDING;
              const StatusIcon = cfg.icon;
              return (
                <Card key={p.id} className={cn(glass, "hover:shadow-md transition-all")}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0", cfg.bg)}>
                        <StatusIcon className={cn("w-4 h-4", cfg.color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-sm">{"\u20AC"}{parseFloat(p.amount).toFixed(2)}</p>
                        <Badge className={cn("text-xs border-0 font-medium", cfg.bg, cfg.color)}>
                          {p.status}
                        </Badge>
                        <Badge className={cn("text-xs border-0 font-medium", MODE_COLORS[p.mode] || "bg-muted text-muted-foreground")}>
                          {p.mode}
                        </Badge>
                        {p.paymentMethod && (
                          <Badge className={cn("text-xs border-0 font-medium", METHOD_COLORS[p.paymentMethod] || "bg-muted text-muted-foreground")}>
                            {p.paymentMethod}
                          </Badge>
                        )}
                      </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {p.userName || p.userEmail || `User #${p.userId}`}
                          {p.description ? ` \u00B7 ${p.description}` : ""}
                        </p>
                        {p.failureReason && (
                          <p className="mt-1 text-xs text-destructive truncate">{p.failureReason}</p>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground flex-shrink-0 text-right hidden sm:block">
                        {format(new Date(p.fulfilledAt || p.createdAt), "d MMM yyyy, HH:mm")}
                        <br />
                        <span className="text-[11px] opacity-70">
                          {formatDistanceToNow(new Date(p.fulfilledAt || p.createdAt), { addSuffix: true })}
                        </span>
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Pagination */}
        {filtered.length > PAGE_SIZE && (
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-muted-foreground">
              Showing {(safePage - 1) * PAGE_SIZE + 1}--{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length}
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-xl"
                disabled={safePage <= 1}
                onClick={() => setPage(safePage - 1)}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((n) => n === 1 || n === totalPages || Math.abs(n - safePage) <= 1)
                .reduce<(number | string)[]>((acc, n, idx, arr) => {
                  if (idx > 0 && n - (arr[idx - 1] as number) > 1) acc.push("...");
                  acc.push(n);
                  return acc;
                }, [])
                .map((item, idx) =>
                  typeof item === "string" ? (
                    <span key={`dots-${idx}`} className="px-1 text-xs text-muted-foreground">...</span>
                  ) : (
                    <Button
                      key={item}
                      variant={item === safePage ? "default" : "outline"}
                      size="icon"
                      className="h-8 w-8 rounded-xl text-xs"
                      onClick={() => setPage(item)}
                    >
                      {item}
                    </Button>
                  ),
                )}
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-xl"
                disabled={safePage >= totalPages}
                onClick={() => setPage(safePage + 1)}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
