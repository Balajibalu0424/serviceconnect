import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function AdminSupport() {
  const { data: tickets = [] } = useQuery<any[]>({ queryKey: ["/api/support/tickets"] });
  return (
    <DashboardLayout>
      <div className="p-6 space-y-4">
        <h1 className="text-xl font-bold">Support Tickets</h1>
        {(tickets as any[]).length === 0 ? (
          <div className="text-center py-16 text-muted-foreground"><ShieldCheck className="w-12 h-12 mx-auto mb-3 opacity-20" /><p>No tickets</p></div>
        ) : (
          <div className="space-y-2">
            {(tickets as any[]).map((t: any) => (
              <Card key={t.id}><CardContent className="pt-3 pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-sm">{t.subject}</p>
                      <Badge className="text-xs">{t.priority}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(t.createdAt), { addSuffix: true })}</p>
                  </div>
                  <Badge variant="outline">{t.status}</Badge>
                </div>
              </CardContent></Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
