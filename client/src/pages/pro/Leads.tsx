import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Lock, Zap } from "lucide-react";

export default function ProLeads() {
  const { data: quotes = [] } = useQuery<any[]>({ queryKey: ["/api/quotes"] });

  return (
    <DashboardLayout>
      <div className="p-6 space-y-4">
        <h1 className="text-xl font-bold">My Leads</h1>
        {(quotes as any[]).length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>No leads yet — unlock jobs from your matchbooked list</p>
          </div>
        ) : (
          <div className="space-y-3">
            {(quotes as any[]).map((q: any) => (
              <Card key={q.id} data-testid={`lead-${q.id}`}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">Quote: €{q.amount}</p>
                      <p className="text-xs text-muted-foreground">{q.message}</p>
                    </div>
                    <Badge>{q.status}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
