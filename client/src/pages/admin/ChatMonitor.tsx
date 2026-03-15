import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  MessageSquare, AlertTriangle, Search, Eye, CheckCircle, Trash2,
  ChevronRight, Users, Briefcase, Clock, X
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function AdminChatMonitor() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);

  // All conversations
  const { data: conversations = [], isLoading: loadingConvs } = useQuery<any[]>({
    queryKey: ["/api/admin/conversations", search, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await apiRequest("GET", `/api/admin/conversations?${params}`);
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 15000,
  });

  // Flagged messages
  const { data: flaggedMessages = [], isLoading: loadingFlagged } = useQuery<any[]>({
    queryKey: ["/api/admin/chat"],
    refetchInterval: 15000,
  });

  // Selected conversation thread
  const { data: threadMessages = [], isLoading: loadingThread } = useQuery<any[]>({
    queryKey: ["/api/admin/conversations", selectedConvId, "messages"],
    queryFn: async () => {
      if (!selectedConvId) return [];
      const res = await apiRequest("GET", `/api/admin/conversations/${selectedConvId}/messages`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedConvId,
    refetchInterval: 5000,
  });

  const dismissFlag = useMutation({
    mutationFn: async (msgId: string) => {
      const res = await apiRequest("PATCH", `/api/admin/messages/${msgId}/dismiss-flag`);
      if (!res.ok) throw new Error((await res.json()).error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/chat"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/conversations", selectedConvId, "messages"] });
      toast({ title: "Flag dismissed", description: "Message approved and cleared." });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMessage = useMutation({
    mutationFn: async (msgId: string) => {
      const res = await apiRequest("DELETE", `/api/admin/messages/${msgId}`);
      if (!res.ok) throw new Error((await res.json()).error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/chat"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/conversations", selectedConvId, "messages"] });
      toast({ title: "Message deleted" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const selectedConv = (conversations as any[]).find((c: any) => c.id === selectedConvId);
  const flaggedCount = (flaggedMessages as any[]).length;
  const totalConvs = (conversations as any[]).length;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Chat Monitor</h1>
            <p className="text-sm text-muted-foreground">
              Review all conversations and moderate flagged messages
            </p>
          </div>
          <div className="flex gap-3">
            <div className="text-center">
              <p className="text-2xl font-bold">{totalConvs}</p>
              <p className="text-xs text-muted-foreground">Conversations</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-orange-500">{flaggedCount}</p>
              <p className="text-xs text-muted-foreground">Flagged</p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="conversations">
          <TabsList>
            <TabsTrigger value="conversations">
              <MessageSquare className="w-4 h-4 mr-1.5" />
              All Conversations
              {totalConvs > 0 && (
                <Badge variant="secondary" className="ml-1.5 text-xs">{totalConvs}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="flagged">
              <AlertTriangle className="w-4 h-4 mr-1.5" />
              Flagged Messages
              {flaggedCount > 0 && (
                <Badge variant="destructive" className="ml-1.5 text-xs">{flaggedCount}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ─── ALL CONVERSATIONS ─────────────────────────────────── */}
          <TabsContent value="conversations" className="mt-4">
            <div className="flex gap-3 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by job, user name or email…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9"
                  data-testid="input-conv-search"
                />
                {search && (
                  <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36" data-testid="select-status-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="CLOSED">Closed</SelectItem>
                  <SelectItem value="ARCHIVED">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Split pane: list + thread */}
            <div className="flex gap-4 h-[calc(100vh-18rem)] min-h-[400px]">
              {/* Conversation list */}
              <div className={cn(
                "flex flex-col border rounded-lg bg-background overflow-hidden",
                selectedConvId ? "w-80 flex-shrink-0" : "flex-1"
              )}>
                <div className="px-4 py-2 border-b bg-muted/30 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {loadingConvs ? "Loading…" : `${(conversations as any[]).length} conversation${(conversations as any[]).length !== 1 ? "s" : ""}`}
                </div>
                <div className="flex-1 overflow-y-auto">
                  {loadingConvs ? (
                    <div className="p-4 space-y-3">
                      {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
                      ))}
                    </div>
                  ) : (conversations as any[]).length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-6 text-center">
                      <MessageSquare className="w-10 h-10 mb-3 opacity-20" />
                      <p className="text-sm">No conversations found</p>
                    </div>
                  ) : (
                    (conversations as any[]).map((conv: any) => (
                      <button
                        key={conv.id}
                        data-testid={`conv-row-${conv.id}`}
                        onClick={() => setSelectedConvId(conv.id)}
                        className={cn(
                          "w-full flex items-start gap-3 p-3.5 hover:bg-accent/50 transition-colors text-left border-b last:border-0",
                          selectedConvId === conv.id && "bg-accent",
                          conv.flaggedCount > 0 && "border-l-2 border-l-orange-400"
                        )}
                      >
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Briefcase className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <p className="text-sm font-medium truncate">
                              {conv.jobTitle || "Direct conversation"}
                            </p>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {conv.flaggedCount > 0 && (
                                <Badge variant="destructive" className="text-xs px-1.5 py-0">
                                  {conv.flaggedCount} ⚑
                                </Badge>
                              )}
                              <Badge
                                variant={conv.status === "ACTIVE" ? "default" : "secondary"}
                                className="text-xs px-1.5 py-0"
                              >
                                {conv.status}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 mt-0.5">
                            <Users className="w-3 h-3 text-muted-foreground" />
                            <p className="text-xs text-muted-foreground truncate">
                              {(conv.participants as any[]).map((p: any) => p.firstName).join(", ")}
                            </p>
                          </div>
                          {conv.lastMessage && (
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {conv.lastMessage}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-0.5">
                            <Clock className="w-3 h-3 text-muted-foreground" />
                            <p className="text-xs text-muted-foreground">
                              {conv.lastMessageAt
                                ? formatDistanceToNow(new Date(conv.lastMessageAt), { addSuffix: true })
                                : "No messages"}
                            </p>
                            <span className="text-xs text-muted-foreground">· {conv.messageCount} msgs</span>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1" />
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Thread view */}
              {selectedConvId && (
                <div className="flex-1 flex flex-col border rounded-lg bg-background overflow-hidden">
                  {/* Thread header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setSelectedConvId(null)}
                        className="text-muted-foreground hover:text-foreground"
                        data-testid="button-close-thread"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <div>
                        <p className="font-semibold text-sm">
                          {selectedConv?.jobTitle || "Conversation"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {(selectedConv?.participants as any[] || []).map((p: any) =>
                            `${p.firstName} ${p.lastName} (${p.role})`
                          ).join(" · ")}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant={selectedConv?.status === "ACTIVE" ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {selectedConv?.status}
                    </Badge>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {loadingThread ? (
                      <div className="p-4 space-y-3">
                        {[1, 2, 3].map(i => (
                          <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />
                        ))}
                      </div>
                    ) : (threadMessages as any[]).length === 0 ? (
                      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                        No messages in this conversation
                      </div>
                    ) : (
                      (threadMessages as any[]).map((msg: any) => (
                        <div
                          key={msg.id}
                          data-testid={`thread-msg-${msg.id}`}
                          className={cn(
                            "flex flex-col gap-1 rounded-lg p-3 text-sm border",
                            msg.isFiltered && "border-orange-300 bg-orange-50 dark:bg-orange-950/20",
                            msg.deletedAt && "opacity-50 border-dashed",
                            !msg.isFiltered && !msg.deletedAt && "bg-muted/30"
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-xs">{msg.senderName}</span>
                              <Badge variant="outline" className="text-xs px-1.5 py-0">
                                {msg.senderRole}
                              </Badge>
                              {msg.type !== "TEXT" && (
                                <Badge variant="secondary" className="text-xs px-1.5 py-0">
                                  {msg.type}
                                </Badge>
                              )}
                              {msg.isFiltered && (
                                <Badge variant="destructive" className="text-xs px-1.5 py-0">
                                  <AlertTriangle className="w-2.5 h-2.5 mr-1" />
                                  FLAGGED
                                </Badge>
                              )}
                              {msg.deletedAt && (
                                <Badge variant="secondary" className="text-xs px-1.5 py-0">
                                  DELETED
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {msg.isFiltered && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-6 text-xs px-2 text-green-600 border-green-300 hover:bg-green-50"
                                  onClick={() => dismissFlag.mutate(msg.id)}
                                  disabled={dismissFlag.isPending}
                                  data-testid={`btn-dismiss-${msg.id}`}
                                >
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  Approve
                                </Button>
                              )}
                              {!msg.deletedAt && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-6 text-xs px-2 text-destructive border-destructive/30 hover:bg-destructive/10"
                                  onClick={() => deleteMessage.mutate(msg.id)}
                                  disabled={deleteMessage.isPending}
                                  data-testid={`btn-delete-${msg.id}`}
                                >
                                  <Trash2 className="w-3 h-3 mr-1" />
                                  Delete
                                </Button>
                              )}
                            </div>
                          </div>

                          <p className="whitespace-pre-wrap break-words">{msg.content}</p>

                          {msg.isFiltered && msg.originalContent && (
                            <details className="mt-1">
                              <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                                Show original (pre-filter) content
                              </summary>
                              <p className="text-xs bg-destructive/10 p-2 rounded mt-1 font-mono break-words">
                                {msg.originalContent}
                              </p>
                            </details>
                          )}

                          {msg.isFiltered && (msg.filterFlags as string[] || []).length > 0 && (
                            <div className="flex gap-1 flex-wrap mt-1">
                              {(msg.filterFlags as string[]).map((flag: string) => (
                                <Badge key={flag} variant="destructive" className="text-xs">{flag}</Badge>
                              ))}
                            </div>
                          )}

                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(msg.createdAt), "d MMM yyyy, HH:mm")}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* ─── FLAGGED MESSAGES ──────────────────────────────────── */}
          <TabsContent value="flagged" className="mt-4">
            {loadingFlagged ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />)}
              </div>
            ) : (flaggedMessages as any[]).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <CheckCircle className="w-12 h-12 mb-3 opacity-20" />
                <p className="font-medium">All clear</p>
                <p className="text-sm">No flagged messages requiring review</p>
              </div>
            ) : (
              <div className="space-y-3">
                {(flaggedMessages as any[]).map((msg: any) => (
                  <Card
                    key={msg.id}
                    className="border-orange-200 dark:border-orange-800"
                    data-testid={`flagged-msg-${msg.id}`}
                  >
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium">{msg.senderName || "Unknown"}</span>
                              {msg.senderEmail && (
                                <span className="text-xs text-muted-foreground">{msg.senderEmail}</span>
                              )}
                              {(msg.filterFlags as string[] || []).map((flag: string) => (
                                <Badge key={flag} variant="destructive" className="text-xs">{flag}</Badge>
                              ))}
                            </div>
                            <div className="flex gap-1.5 flex-shrink-0">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs px-2 text-blue-600 border-blue-200 hover:bg-blue-50"
                                onClick={() => {
                                  setSelectedConvId(msg.conversationId);
                                  // switch to conversations tab by triggering click
                                  document.querySelector<HTMLButtonElement>('[value="conversations"]')?.click();
                                }}
                                data-testid={`btn-view-thread-${msg.id}`}
                              >
                                <Eye className="w-3 h-3 mr-1" />
                                View thread
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs px-2 text-green-600 border-green-300 hover:bg-green-50"
                                onClick={() => dismissFlag.mutate(msg.id)}
                                disabled={dismissFlag.isPending}
                                data-testid={`btn-dismiss-flagged-${msg.id}`}
                              >
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Approve
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs px-2 text-destructive border-destructive/30 hover:bg-destructive/10"
                                onClick={() => deleteMessage.mutate(msg.id)}
                                disabled={deleteMessage.isPending}
                                data-testid={`btn-delete-flagged-${msg.id}`}
                              >
                                <Trash2 className="w-3 h-3 mr-1" />
                                Delete
                              </Button>
                            </div>
                          </div>

                          <p className="text-sm bg-muted p-2 rounded break-words">{msg.content}</p>

                          {msg.originalContent && (
                            <details className="mt-2">
                              <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                                Original content (pre-filter)
                              </summary>
                              <p className="text-xs bg-destructive/10 p-2 rounded mt-1 font-mono break-words">
                                {msg.originalContent}
                              </p>
                            </details>
                          )}

                          <p className="text-xs text-muted-foreground mt-2">
                            {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                            {" · "}
                            <button
                              className="underline hover:text-foreground"
                              onClick={() => {
                                setSelectedConvId(msg.conversationId);
                                document.querySelector<HTMLButtonElement>('[value="conversations"]')?.click();
                              }}
                            >
                              Open conversation
                            </button>
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
