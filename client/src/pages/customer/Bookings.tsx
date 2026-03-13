import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ListChecks } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const STATUS_COLORS: Record<string, string> = { CONFIRMED: "default", IN_PROGRESS: "secondary", COMPLETED: "outline", CANCELLED: "destructive", DISPUTED: "destructive" };

export default function Bookings() {
  const { data: bookings = [] } = useQuery<any[]>({ queryKey: ["/api/bookings"] });

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <h1 className="text-xl font-bold">Bookings</h1>
        {(bookings as any[]).length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <ListChecks className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>No bookings yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {(bookings as any[]).map((b: any) => (
              <Card key={b.id} data-testid={`booking-${b.id}`}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">Booking #{b.id.slice(-8)}</p>
                      <p className="text-xs text-muted-foreground">€{b.totalAmount} · {formatDistanceToNow(new Date(b.createdAt), { addSuffix: true })}</p>
                    </div>
                    <Badge variant={STATUS_COLORS[b.status] as any}>{b.status}</Badge>
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
