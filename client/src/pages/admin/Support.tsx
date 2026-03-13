import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck, ArrowLeft, Send, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

const PRIORITY_COLORS: Record<string, string> = {
  LOW: "secondary", MEDIUM: "outline", HIGH: "default", URGENT: "destructive",
};
const STATUS_COLORS: Record<string, string> = {
  OPEN: "default", IN_PROGRESS: "secondary", WAITING: "outline", RESOLVED: "secondary", CLOSED: "destructive",
};

export default function AdminSupport() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [activeTicket, setActiveTicket] = useState<any | null>(null);
  const [reply, setReply] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: tickets = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/support/tickets"],
    refetchInterval: 15000,
  });

  const { data: messages = [] } = useQuery<any[]>({
    queryFn: async () => {
      if (!activeTicket) return [];
      const res = await apiRequest("GET", `/api/support/tickets/${activeTicket.id}/messages`);
      if (!res.ok) return [];
      return res.json();
    },
    queryKey: ["/api/support/tickets", activeTicket?.id, "messages"],
    enabled: !!activeTicket,
    refetchInterval: 10000,
  });

  const sendReply = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/support/tickets/${activeTicket.id}/reply`, { content: reply });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/support/tickets", activeTicket?.id, "messages"] });
      setReply("");
      toast({ title: "Reply sent" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateStatus = useMutation({
    mutationFn: async (status: string) => {
      const res = await apiRequest("PATCH", `/api/support/tickets/${activeTicket.id}`, { status });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/support/tickets"] });
      toast({ title: "Status updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const filteredTickets = statusFilter === "all"
    ? (tickets as any[])
    : (tickets as any[]).filter((t: any) => t.status === statusFilter);

  return (
    <DashboardLayout>
      <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
        {/* List */}
        <div className={cn(
          "w-full md:w-96 flex-shrink-0 border-r flex flex-col",
          activeTicket && "hidden md:flex"
        )}>
          <div className="p-4 border-b space-y-3">
            <div className="flex items-center justify-between">
              <h1 className="font-bold text-lg">Support Tickets</h1>
              <Badge variant="outline">{filteredTickets.length}</Badge>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Filter status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="OPEN">Open</SelectItem>
                <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                <SelectItem value="WAITING">Waiting</SelectItem>
                <SelectItem value="RESOLVED">Resolved</SelectItem>
                <SelectItem value="CLOSED">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="p-4 space-y-2">
                {[1,2,3].map(i => <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />)}
              </div>
            ) : filteredTickets.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-6">
                <ShieldCheck className="w-10 h-10 mb-3 opacity-20" />
                <p className="text-sm">No tickets</p>
              </div>
            ) : (
              filteredTickets.map((t: any) => (
                <button key={t.id}
                  onClick={() => setActiveTicket(t)}
                  data-testid={`ticket-${t.id}`}
                  className={cn(
                    "w-full text-left p-4 border-b hover:bg-accent/50 transition-colors",
                    activeTicket?.id === t.id && "bg-accent"
                  )}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{t.subject}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatDistanceToNow(new Date(t.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1 items-end">
                      <Badge variant={PRIORITY_COLORS[t.priority] as any} className="text-xs">{t.priority}</Badge>
                      <Badge variant={STATUS_COLORS[t.status] as any} className="text-xs">{t.status}</Badge>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Detail */}
        <div className={cn(
          "flex-1 flex flex-col bg-background",
          !activeTicket && "hidden md:flex items-center justify-center"
        )}>
          {!activeTicket ? (
            <div className="text-center text-muted-foreground">
              <ShieldCheck className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>Select a ticket to view</p>
            </div>
          ) : (
            <>
              {/* Ticket header */}
              <div className="p-4 border-b space-y-3">
                <div className="flex items-center gap-3">
                  <button className="md:hidden" onClick={() => setActiveTicket(null)}>
                    <ArrowLeft className="w-5 h-5 text-muted-foreground" />
                  </button>
                  <div className="flex-1">
                    <p className="font-semibold">{activeTicket.subject}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge variant={PRIORITY_COLORS[activeTicket.priority] as any} className="text-xs">
                        {activeTicket.priority}
                      </Badge>
                      <Badge variant={STATUS_COLORS[activeTicket.status] as any} className="text-xs">
                        {activeTicket.status}
                      </Badge>
                    </div>
                  </div>
                  <Select value={activeTicket.status} onValueChange={s => updateStatus.mutate(s)}>
                    <SelectTrigger className="w-36 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="OPEN">Open</SelectItem>
                      <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                      <SelectItem value="WAITING">Waiting</SelectItem>
                      <SelectItem value="RESOLVED">Resolved</SelectItem>
                      <SelectItem value="CLOSED">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {activeTicket.description && (
                  <Card>
                    <CardContent className="pt-3 pb-3">
                      <p className="text-sm text-muted-foreground">{activeTicket.description}</p>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {(messages as any[]).map((msg: any) => (
                  <div key={msg.id} className={cn(
                    "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm",
                    msg.isAdmin
                      ? "ml-auto bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-muted text-foreground rounded-bl-sm"
                  )}>
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                    <p className="text-xs opacity-60 mt-1">
                      {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                ))}
              </div>

              {/* Reply input */}
              <div className="p-4 border-t space-y-2">
                <Textarea
                  placeholder="Type your reply…"
                  value={reply}
                  onChange={e => setReply(e.target.value)}
                  rows={3}
                  data-testid="input-reply"
                />
                <div className="flex justify-end">
                  <Button size="sm" className="gap-2"
                    onClick={() => sendReply.mutate()}
                    disabled={!reply.trim() || sendReply.isPending}
                    data-testid="button-send-reply">
                    {sendReply.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Send Reply
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
