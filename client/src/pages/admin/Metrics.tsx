import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { formatDistanceToNow } from "date-fns";

export default function AdminMetrics() {
  const { data: metrics = [] } = useQuery<any[]>({ queryKey: ["/api/admin/metrics"] });
  return (
    <DashboardLayout>
      <div className="p-6 space-y-4">
        <h1 className="text-xl font-bold">Platform Metrics</h1>
        <div className="space-y-2">
          {(metrics as any[]).map((m: any) => (
            <Card key={m.id}><CardContent className="pt-3 pb-3">
              <div className="flex items-center justify-between">
                <div><p className="font-medium text-sm">{m.metricName}</p><p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(m.recordedAt), { addSuffix: true })}</p></div>
                <p className="font-bold text-primary">{m.metricValue}</p>
              </div>
            </CardContent></Card>
          ))}
          {(metrics as any[]).length === 0 && <p className="text-center py-8 text-muted-foreground">No metrics recorded yet</p>}
        </div>
      </div>
    </DashboardLayout>
  );
}
