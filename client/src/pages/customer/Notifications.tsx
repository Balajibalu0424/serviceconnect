import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, CheckCheck } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

export default function Notifications() {
  const qc = useQueryClient();
  const { data } = useQuery<any>({ queryKey: ["/api/notifications"] });
  const notifications = data?.notifications || [];

  const readAll = useMutation({
    mutationFn: async () => { const r = await apiRequest("POST", "/api/notifications/read-all"); return r.json(); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/notifications"] })
  });

  return (
    <DashboardLayout>
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Notifications</h1>
          {data?.unreadCount > 0 && (
            <Button variant="outline" size="sm" className="gap-1" onClick={() => readAll.mutate()}>
              <CheckCheck className="w-4 h-4" /> Mark all read
            </Button>
          )}
        </div>
        {notifications.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Bell className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>No notifications</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((n: any) => (
              <div key={n.id} className={cn("p-4 rounded-lg border transition-colors", !n.isRead ? "bg-primary/5 border-primary/20" : "bg-card border-border")} data-testid={`notif-${n.id}`}>
                <div className="flex items-start gap-3">
                  <div className={cn("w-2 h-2 rounded-full mt-2 flex-shrink-0", !n.isRead ? "bg-primary" : "bg-muted")} />
                  <div className="flex-1">
                    <p className="font-medium text-sm">{n.title}</p>
                    <p className="text-sm text-muted-foreground">{n.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">{formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}</p>
                  </div>
                  {!n.isRead && <Badge className="text-xs">New</Badge>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
