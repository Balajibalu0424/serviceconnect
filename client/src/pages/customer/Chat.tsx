import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Send, Loader2, ArrowLeft, Phone } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { useSearch } from "wouter";


export default function Chat() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const searchString = useSearch();
  const searchParams = new URLSearchParams(searchString);
  const urlConvId = searchParams.get("conversationId");

  const [activeConvId, setActiveConvId] = useState<string | null>(urlConvId);
  const [message, setMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Sync from URL param on mount or param change
  useEffect(() => {
    if (urlConvId && urlConvId !== activeConvId) {
      setActiveConvId(urlConvId);
    }
  }, [urlConvId]);

  const { data: conversations = [], isLoading: loadingConvs } = useQuery<any[]>({
    queryKey: ["/api/chat/conversations"],
    refetchInterval: 5000,
  });

  const { data: msgList = [], isLoading: loadingMsgs } = useQuery<any[]>({
    queryKey: ["/api/chat/conversations", activeConvId, "messages"],
    queryFn: async () => {
      if (!activeConvId) return [];
      const res = await apiRequest("GET", `/api/chat/conversations/${activeConvId}/messages`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!activeConvId,
    refetchInterval: 3000,
  });

  const { data: unreadCount } = useQuery<any>({
    queryKey: ["/api/chat/unread-count"],
    refetchInterval: 10000,
  });

  const sendMessage = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest("POST", `/api/chat/conversations/${activeConvId}/messages`, { content });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/chat/conversations", activeConvId, "messages"] });
      qc.invalidateQueries({ queryKey: ["/api/chat/conversations"] });
      setMessage("");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const requestCall = useMutation({
    mutationFn: async (targetId: string) => {
      const res = await apiRequest("POST", "/api/call-requests", {
        targetId,
        jobId: activeConv?.jobId,
        reason: "Would like to discuss the project details",
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => toast({ title: "Call requested", description: "The other party will be notified. They can accept or decline." }),
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const markRead = useMutation({
    mutationFn: async (convId: string) => {
      await apiRequest("PATCH", `/api/chat/conversations/${convId}/read`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/chat/unread-count"] }),
  });

  useEffect(() => {
    if (activeConvId) markRead.mutate(activeConvId);
  }, [activeConvId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgList]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !activeConvId) return;
    sendMessage.mutate(message.trim());
  };

  const activeConv = (conversations as any[]).find((c: any) => c.id === activeConvId);

  return (
    <DashboardLayout>
      <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
        {/* Sidebar: conversation list */}
        <div className={cn(
          "w-full md:w-80 flex-shrink-0 border-r bg-background flex flex-col",
          activeConvId && "hidden md:flex"
        )}>
          <div className="p-4 border-b">
            <div className="flex items-center justify-between">
              <h1 className="font-bold text-lg">Messages</h1>
              {(unreadCount?.count ?? 0) > 0 && (
                <Badge variant="destructive" className="text-xs">{unreadCount.count}</Badge>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loadingConvs ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map(i => <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />)}
              </div>
            ) : (conversations as any[]).length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-6 text-center">
                <MessageSquare className="w-10 h-10 mb-3 opacity-20" />
                <p className="text-sm">No conversations yet.</p>
                <p className="text-xs mt-1">Unlock a job to start chatting.</p>
              </div>
            ) : (
              (conversations as any[]).map((conv: any) => (
                <button
                  key={conv.id}
                  data-testid={`conv-${conv.id}`}
                  onClick={() => setActiveConvId(conv.id)}
                  className={cn(
                    "w-full flex items-start gap-3 p-4 hover:bg-accent/50 transition-colors text-left border-b last:border-0",
                    activeConvId === conv.id && "bg-accent"
                  )}
                >
                  <Avatar className="w-10 h-10 flex-shrink-0">
                    <AvatarFallback className="text-sm bg-primary/10 text-primary">
                      {(() => {
                        const other = conv.participants?.find((p: any) => p.id !== user?.id);
                        return other ? (other.firstName?.[0] || "?") : (conv.jobTitle?.[0] || "J");
                      })()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className="font-medium text-sm truncate">
                        {(() => {
                          const other = conv.participants?.find((p: any) => p.id !== user?.id);
                          return other ? `${other.firstName} ${other.lastName}`.trim() : (conv.jobTitle || "Conversation");
                        })()}
                      </p>
                      {conv.lastMessageAt && (
                        <span className="text-xs text-muted-foreground flex-shrink-0">
                          {formatDistanceToNow(new Date(conv.lastMessageAt), { addSuffix: false })}
                        </span>
                      )}
                    </div>
                    {conv.job?.title && (
                      <p className="text-[10px] text-primary/70 truncate">{conv.job.title}</p>
                    )}
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {conv.lastMessage || "Start the conversation…"}
                    </p>
                  </div>
                  {conv.unreadCount > 0 && (
                    <Badge className="text-xs w-5 h-5 flex items-center justify-center rounded-full p-0">
                      {conv.unreadCount}
                    </Badge>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Main: message thread */}
        <div className={cn(
          "flex-1 flex flex-col bg-background",
          !activeConvId && "hidden md:flex items-center justify-center"
        )}>
          {!activeConvId ? (
            <div className="text-center text-muted-foreground">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>Select a conversation to start messaging</p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="flex items-center gap-3 p-4 border-b">
                <button
                  className="md:hidden text-muted-foreground hover:text-foreground"
                  onClick={() => setActiveConvId(null)}
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <Avatar className="w-9 h-9">
                  <AvatarFallback className="bg-primary/10 text-primary text-sm">
                    {(() => {
                      const other = activeConv?.participants?.find((p: any) => p.id !== user?.id);
                      return other ? (other.firstName?.[0] || "?") : (activeConv?.jobTitle?.[0] || "J");
                    })()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-semibold text-sm">
                    {(() => {
                      const other = activeConv?.participants?.find((p: any) => p.id !== user?.id);
                      return other ? `${other.firstName} ${other.lastName}`.trim() : "Conversation";
                    })()}
                  </p>
                  <p className="text-xs text-muted-foreground">{activeConv?.jobTitle || "Active now"}</p>
                </div>
                <Button
                  variant="default"
                  size="sm"
                  className="gap-1.5 text-xs bg-green-500 hover:bg-green-600 shadow-lg"
                  disabled={requestCall.isPending}
                  onClick={() => {
                    const otherParticipant = activeConv?.participants?.find((p: any) => p.id !== user?.id);
                    if (otherParticipant) {
                      requestCall.mutate(otherParticipant.id);
                    } else {
                      toast({ title: "Error", description: "Could not find the other participant", variant: "destructive" });
                    }
                  }}
                >
                  <Phone className="w-4 h-4" />
                  {requestCall.isPending ? "Requesting…" : "Request Call"}
                </Button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {loadingMsgs ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (msgList as any[]).length === 0 ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                    No messages yet — say hello!
                  </div>
                ) : (
                  (msgList as any[]).map((msg: any) => {
                    const isMe = msg.senderId === user?.id;
                    const isSystem = msg.type === "SYSTEM";
                    if (isSystem) {
                      return (
                        <div key={msg.id} className="flex justify-center">
                          <div className="max-w-[85%] rounded-xl px-4 py-2 text-xs text-muted-foreground bg-muted/50 text-center italic">
                            {msg.content}
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div key={msg.id} className={cn("flex", isMe ? "justify-end" : "justify-start")}>
                        <div className={cn(
                          "max-w-[75%] rounded-2xl px-4 py-2.5 text-sm",
                          isMe
                            ? "bg-primary text-primary-foreground rounded-br-sm"
                            : "bg-muted text-foreground rounded-bl-sm"
                        )}>
                          {!isMe && msg.senderName && (
                            <p className="text-xs font-semibold mb-1 opacity-80">{msg.senderName}</p>
                          )}
                          <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                          <p className={cn("text-xs mt-1 opacity-70", isMe ? "text-right" : "text-left")}>
                            {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <form onSubmit={handleSend} className="p-4 border-t bg-background flex gap-2">
                <Input
                  data-testid="input-message"
                  placeholder="Type a message…"
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  className="flex-1"
                  autoComplete="off"
                />
                <Button
                  type="submit"
                  size="sm"
                  className="gap-2 px-4 h-10"
                  disabled={!message.trim() || sendMessage.isPending}
                  data-testid="button-send"
                >
                  {sendMessage.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      Send
                      <Send className="w-4 h-4" />
                    </>
                  )}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
