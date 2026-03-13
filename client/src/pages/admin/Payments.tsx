import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";

export default function AdminPayments() {
  const { data: payments = [] } = useQuery<any[]>({ queryKey: ["/api/admin/payments"] });
  const total = (payments as any[]).filter(p => p.status === "COMPLETED").reduce((sum, p) => sum + parseFloat(p.amount), 0);

  return (
    <DashboardLayout>
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Payments</h1>
          <div className="text-right"><p className="text-2xl font-bold text-accent">€{total.toFixed(2)}</p><p className="text-xs text-muted-foreground">Total revenue</p></div>
        </div>
        <div className="space-y-2">
          {(payments as any[]).map((p: any) => (
            <Card key={p.id}><CardContent className="pt-3 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">€{p.amount}</p>
                  <p className="text-xs text-muted-foreground">{p.description} · {formatDistanceToNow(new Date(p.createdAt), { addSuffix: true })}</p>
                </div>
                <Badge variant={p.status === "COMPLETED" ? "default" : p.status === "FAILED" ? "destructive" : "secondary"}>{p.status}</Badge>
              </div>
            </CardContent></Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
