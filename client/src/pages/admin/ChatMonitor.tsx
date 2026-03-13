import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, AlertTriangle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function AdminChatMonitor() {
  const { data: flaggedMessages = [] } = useQuery<any[]>({ queryKey: ["/api/admin/chat"] });

  return (
    <DashboardLayout>
      <div className="p-6 space-y-4">
        <div>
          <h1 className="text-xl font-bold">Chat Monitor</h1>
          <p className="text-sm text-muted-foreground">Flagged messages requiring review</p>
        </div>
        {(flaggedMessages as any[]).length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>No flagged messages</p>
          </div>
        ) : (
          <div className="space-y-3">
            {(flaggedMessages as any[]).map((msg: any) => (
              <Card key={msg.id} className="border-orange-200" data-testid={`flagged-msg-${msg.id}`}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-medium">Message flagged</p>
                        {(msg.filterFlags as string[]).map((flag: string) => (
                          <Badge key={flag} variant="destructive" className="text-xs">{flag}</Badge>
                        ))}
                      </div>
                      <p className="text-sm bg-muted p-2 rounded font-mono">{msg.content}</p>
                      {msg.originalContent && (
                        <details className="mt-2">
                          <summary className="text-xs text-muted-foreground cursor-pointer">Original content</summary>
                          <p className="text-xs bg-destructive/10 p-2 rounded mt-1 font-mono">{msg.originalContent}</p>
                        </details>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">{formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}</p>
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
