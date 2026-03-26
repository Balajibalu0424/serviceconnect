import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ListChecks } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function ProBookings() {
  const { data: bookings = [] } = useQuery<any[]>({ queryKey: ["/api/bookings"] });
  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-heading font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300">My Bookings</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage your active and past jobs</p>
          </div>
        </div>
        {(bookings as any[]).length === 0 ? (
          <div className="text-center py-24 text-muted-foreground bg-white/40 dark:bg-black/20 backdrop-blur-md rounded-3xl border border-white/20 dark:border-white/5">
            <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
              <ListChecks className="w-8 h-8 opacity-50" />
            </div>
            <p className="font-heading font-medium text-lg text-foreground">No bookings yet</p>
            <p className="text-sm mt-1 max-w-sm mx-auto">When a customer accepts your quote, the booking will appear here.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {(bookings as any[]).map((b: any) => (
              <Card key={b.id} className="transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:hover:shadow-[0_8px_30px_rgb(0,0,0,0.2)] bg-white/60 dark:bg-black/40 backdrop-blur-xl border-white/40 dark:border-white/10 rounded-2xl overflow-hidden group">
                <CardContent className="p-5 md:p-6">
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-heading font-bold text-lg group-hover:text-primary transition-colors">Booking #{b.id.slice(-8)}</p>
                      <div className="flex items-center gap-x-4 gap-y-2 mt-2 flex-wrap text-sm text-muted-foreground">
                        <span className="font-medium text-foreground/80 bg-muted/40 px-2 py-0.5 rounded-md">€{b.totalAmount}</span>
                        <span>{formatDistanceToNow(new Date(b.createdAt), { addSuffix: true })}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0 w-full md:w-auto">
                      <Badge className="text-xs px-2.5 py-1 uppercase tracking-wider bg-white/50 shadow-sm">{b.status}</Badge>
                    </div>
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
