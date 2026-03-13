import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Send } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

export default function Chat() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [selectedConv, setSelectedConv] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const { data: conversations = [] } = useQuery<any[]>({ queryKey: ["/api/chat/conversations"] });
  const { data: messages = [] } = useQuery<any[]>({
    queryKey: selectedConv ? [`/api/chat/conversations/${selectedConv}/messages`] : ["__disabled__"],
    enabled: !!selectedConv
  });

  const sendMsg = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest("POST", `/api/chat/conversations/${selectedConv}/messages`, { content });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/chat/conversations/${selectedConv}/messages`] });
      qc.invalidateQueries({ queryKey: ["/api/chat/conversations"] });
      setMessage("");
    }
  });

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !selectedConv) return;
    sendMsg.mutate(message.trim());
  };

  const activeConv = (conversations as any[]).find(c => c.id === selectedConv);
  const otherParticipant = activeConv?.participants?.find((p: any) => p.id !== user?.id);

  return (
    <DashboardLayout>
      <div className="flex h-[calc(100vh-64px)] lg:h-screen">
        {/* Conversation list */}
        <div className={cn("w-full lg:w-80 border-r border-border flex flex-col", selectedConv && "hidden lg:flex")}>
          <div className="p-4 border-b border-border">
            <h1 className="font-bold">Messages</h1>
          </div>
          <div className="flex-1 overflow-y-auto">
            {(conversations as any[]).length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No conversations yet</p>
              </div>
            ) : (
              (conversations as any[]).map((conv: any) => {
                const other = conv.participants?.find((p: any) => p.id !== user?.id);
                return (
                  <button key={conv.id} onClick={() => setSelectedConv(conv.id)}
                    className={cn("w-full p-4 text-left hover:bg-muted/50 transition-colors border-b border-border",
                      selectedConv === conv.id && "bg-muted")}
                    data-testid={`conv-${conv.id}`}>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9"><AvatarFallback className="text-xs">{other?.firstName?.[0]}{other?.lastName?.[0]}</AvatarFallback></Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-sm truncate">{other?.firstName} {other?.lastName}</p>
                          {conv.lastMessage && <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(conv.lastMessage.createdAt), { addSuffix: true })}</p>}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{conv.job?.title}</p>
                        {conv.unreadCount > 0 && <Badge className="text-xs h-4 mt-1">{conv.unreadCount} new</Badge>}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Message area */}
        <div className={cn("flex-1 flex flex-col", !selectedConv && "hidden lg:flex")}>
          {!selectedConv ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>Select a conversation</p>
              </div>
            </div>
          ) : (
            <>
              <div className="p-4 border-b border-border flex items-center gap-3">
                <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSelectedConv(null)}>←</Button>
                <Avatar className="h-8 w-8"><AvatarFallback className="text-xs">{otherParticipant?.firstName?.[0]}{otherParticipant?.lastName?.[0]}</AvatarFallback></Avatar>
                <div>
                  <p className="font-medium text-sm">{otherParticipant?.firstName} {otherParticipant?.lastName}</p>
                  <p className="text-xs text-muted-foreground">{activeConv?.job?.title}</p>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {(messages as any[]).map((msg: any) => {
                  const isOwn = msg.senderId === user?.id;
                  const isSystem = msg.type === "SYSTEM";
                  if (isSystem) return (
                    <div key={msg.id} className="text-center">
                      <span className="text-xs bg-muted text-muted-foreground px-3 py-1 rounded-full">{msg.content}</span>
                    </div>
                  );
                  return (
                    <div key={msg.id} className={cn("flex", isOwn ? "justify-end" : "justify-start")}>
                      <div className={cn("max-w-xs lg:max-w-md rounded-2xl px-4 py-2 text-sm",
                        isOwn ? "bg-primary text-primary-foreground" : "bg-muted")}>
                        {msg.isFiltered && <p className="text-xs opacity-70 mb-1">[Message filtered]</p>}
                        <p>{msg.content}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <form onSubmit={handleSend} className="p-4 border-t border-border flex gap-2">
                <Input value={message} onChange={e => setMessage(e.target.value)} placeholder="Type a message..." className="flex-1" data-testid="input-message" />
                <Button type="submit" size="icon" disabled={sendMsg.isPending || !message.trim()} data-testid="button-send">
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
