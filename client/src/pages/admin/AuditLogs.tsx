import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { formatDistanceToNow } from "date-fns";

export default function AdminAuditLogs() {
  const { data: logs = [] } = useQuery<any[]>({ queryKey: ["/api/admin/audit-logs"] });
  return (
    <DashboardLayout>
      <div className="p-6 space-y-4">
        <h1 className="text-xl font-bold">Audit Logs</h1>
        <div className="space-y-2">
          {(logs as any[]).map((log: any) => (
            <Card key={log.id}><CardContent className="pt-3 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm font-mono">{log.action} <span className="text-muted-foreground">on</span> {log.resourceType}</p>
                  <p className="text-xs text-muted-foreground">{log.ipAddress} · {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}</p>
                </div>
              </div>
            </CardContent></Card>
          ))}
          {(logs as any[]).length === 0 && <p className="text-center py-8 text-muted-foreground">No audit logs</p>}
        </div>
      </div>
    </DashboardLayout>
  );
}
