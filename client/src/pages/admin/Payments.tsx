import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, CreditCard, TrendingUp, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { apiRequest } from "@/lib/queryClient";

const STATUS_VARIANT: Record<string, string> = {
  COMPLETED: "default", PENDING: "secondary", FAILED: "destructive", REFUNDED: "outline"
};

function exportCSV(payments: any[]) {
  const headers = ["ID", "User", "Email", "Amount (€)", "Method", "Description", "Status", "Date"];
  const rows = payments.map(p => [
    p.id, p.userName || "", p.userEmail || "",
    parseFloat(p.amount).toFixed(2),
    p.paymentMethod, p.description || "",
    p.status, format(new Date(p.createdAt), "yyyy-MM-dd HH:mm"),
  ]);
  const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `payments-${format(new Date(), "yyyy-MM-dd")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminPayments() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  if (typeFilter !== "all") params.set("type", typeFilter);

  const { data: payments = [], isLoading } = useQuery<any[]>({
    queryKey: [`/api/admin/payments?${params}`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/payments?${params}`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const completed = (payments as any[]).filter(p => p.status === "COMPLETED");
  const total = completed.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
  const failed = (payments as any[]).filter(p => p.status === "FAILED").length;
  const pending = (payments as any[]).filter(p => p.status === "PENDING").length;

  // Breakdown by description type
  const byType: Record<string, number> = {};
  completed.forEach(p => {
    const key = p.paymentMethod || "other";
    byType[key] = (byType[key] || 0) + parseFloat(p.amount || 0);
  });

  return (
    <DashboardLayout>
      <div className="p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h1 className="text-xl font-bold">Payments</h1>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportCSV(payments as any[])}
            disabled={(payments as any[]).length === 0}
            data-testid="button-export-csv"
          >
            <Download className="w-4 h-4 mr-1.5" />
            Export CSV
          </Button>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-emerald-600">€{total.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">Total revenue</p>
                </div>
                <CreditCard className="w-6 h-6 text-emerald-500 opacity-60" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div>
                <p className="text-2xl font-bold">{completed.length}</p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div>
                <p className="text-2xl font-bold text-yellow-600">{pending}</p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-destructive">{failed}</p>
                  <p className="text-xs text-muted-foreground">Failed</p>
                </div>
                {failed > 0 && <AlertCircle className="w-5 h-5 text-destructive opacity-60" />}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Breakdown by type */}
        {Object.keys(byType).length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="w-4 h-4" /> Revenue by Payment Method
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 flex-wrap">
                {Object.entries(byType).map(([method, amount]) => (
                  <div key={method} className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">{method}</Badge>
                    <span className="text-sm font-semibold">€{amount.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground whitespace-nowrap">From</label>
            <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-36 text-sm" data-testid="input-from" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground whitespace-nowrap">To</label>
            <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-36 text-sm" data-testid="input-to" />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-36" data-testid="select-type">
              <SelectValue placeholder="Method" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All methods</SelectItem>
              <SelectItem value="stripe">Stripe</SelectItem>
              <SelectItem value="credits">Credits</SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
            </SelectContent>
          </Select>
          {(from || to || typeFilter !== "all") && (
            <Button variant="ghost" size="sm" onClick={() => { setFrom(""); setTo(""); setTypeFilter("all"); }}>
              Clear
            </Button>
          )}
        </div>

        {/* Payment list */}
        <div className="space-y-2">
          {isLoading ? (
            [1, 2, 3, 4, 5].map(i => <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />)
          ) : (payments as any[]).length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CreditCard className="w-8 h-8 mx-auto mb-2 opacity-20" />
              <p>No payments found</p>
            </div>
          ) : (
            (payments as any[]).map((p: any) => (
              <Card key={p.id} data-testid={`payment-${p.id}`}>
                <CardContent className="pt-3 pb-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm">€{parseFloat(p.amount).toFixed(2)}</p>
                        <Badge variant={STATUS_VARIANT[p.status] as any} className="text-xs">{p.status}</Badge>
                        {p.paymentMethod && (
                          <Badge variant="outline" className="text-xs">{p.paymentMethod}</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {p.userName || p.userEmail || p.userId}
                        {p.description ? ` · ${p.description}` : ""}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground flex-shrink-0">
                      {format(new Date(p.createdAt), "d MMM yyyy, HH:mm")}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
