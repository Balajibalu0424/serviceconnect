import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { apiRequest } from "@/lib/queryClient";
import { formatDistanceToNow, isToday, isYesterday, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import {
  Bell, CheckCheck, BellOff, Briefcase, MessageSquare, CreditCard,
  Star, AlertTriangle, ShieldCheck, Zap, Gift, Phone, FileText,
  UserCheck, ThumbsUp, Calendar, Filter, Loader2, Inbox
} from "lucide-react";

const NOTIFICATION_ICONS: Record<string, { icon: any; color: string; bg: string }> = {
  JOB_QUOTE: { icon: FileText, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/10" },
  JOB_UPDATE: { icon: Briefcase, color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-500/10" },
  JOB_MATCHED: { icon: ShieldCheck, color: "text-green-600 dark:text-green-400", bg: "bg-green-500/10" },
  JOB_COMPLETED: { icon: ThumbsUp, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10" },
  JOB_BOOSTED: { icon: Zap, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10" },
  NEW_MESSAGE: { icon: MessageSquare, color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-500/10" },
  PAYMENT: { icon: CreditCard, color: "text-green-600 dark:text-green-400", bg: "bg-green-500/10" },
  CREDIT: { icon: CreditCard, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10" },
  REVIEW: { icon: Star, color: "text-yellow-600 dark:text-yellow-400", bg: "bg-yellow-500/10" },
  SPIN_REWARD: { icon: Gift, color: "text-pink-600 dark:text-pink-400", bg: "bg-pink-500/10" },
  CALL_REQUEST: { icon: Phone, color: "text-green-600 dark:text-green-400", bg: "bg-green-500/10" },
  VERIFICATION: { icon: UserCheck, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/10" },
  AFTERCARE: { icon: Calendar, color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-500/10" },
  WARNING: { icon: AlertTriangle, color: "text-red-600 dark:text-red-400", bg: "bg-red-500/10" },
};

function getNotifStyle(type: string) {
  return NOTIFICATION_ICONS[type] || { icon: Bell, color: "text-primary", bg: "bg-primary/10" };
}

function groupByDate(notifications: any[]) {
  const groups: { label: string; items: any[] }[] = [];
  const today: any[] = [];
  const yesterday: any[] = [];
  const older: any[] = [];

  for (const n of notifications) {
    const date = parseISO(n.createdAt);
    if (isToday(date)) today.push(n);
    else if (isYesterday(date)) yesterday.push(n);
    else older.push(n);
  }

  if (today.length > 0) groups.push({ label: "Today", items: today });
  if (yesterday.length > 0) groups.push({ label: "Yesterday", items: yesterday });
  if (older.length > 0) groups.push({ label: "Earlier", items: older });

  return groups;
}

const FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "unread", label: "Unread" },
  { value: "JOB_QUOTE", label: "Quotes" },
  { value: "NEW_MESSAGE", label: "Messages" },
  { value: "JOB_UPDATE", label: "Job Updates" },
  { value: "PAYMENT", label: "Payments" },
];

export default function Notifications() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState("all");
  const { data, isLoading } = useQuery<any>({ queryKey: ["/api/notifications"] });
  const allNotifications: any[] = data?.notifications || [];

  const filtered = allNotifications.filter((n: any) => {
    if (filter === "all") return true;
    if (filter === "unread") return !n.isRead;
    return n.type === filter;
  });

  const groups = groupByDate(filtered);
  const unreadCount = data?.unreadCount || 0;

  const readAll = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/notifications/read-all");
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/notifications"] }),
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      const r = await apiRequest("POST", `/api/notifications/${id}/read`);
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/notifications"] }),
  });

  return (
    <DashboardLayout>
      <div className="p-4 md:p-8 space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-outfit flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Bell className="w-5 h-5 text-primary" />
              </div>
              Notifications
              {unreadCount > 0 && (
                <Badge variant="destructive" className="text-xs px-2.5 py-0.5 rounded-full font-bold">
                  {unreadCount} new
                </Badge>
              )}
            </h1>
            <p className="text-sm text-muted-foreground">Stay updated on your jobs, quotes, and messages</p>
          </div>
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2 rounded-xl bg-white/50 dark:bg-black/20 hover:bg-white dark:hover:bg-white/10 shadow-sm self-start"
              onClick={() => readAll.mutate()}
              disabled={readAll.isPending}
            >
              {readAll.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCheck className="w-4 h-4" />}
              Mark all as read
            </Button>
          )}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-muted-foreground" />
          {FILTER_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              size="sm"
              variant={filter === opt.value ? "default" : "outline"}
              className={cn(
                "rounded-full text-xs h-8 px-3.5",
                filter === opt.value
                  ? "shadow-md shadow-primary/20"
                  : "bg-white/50 dark:bg-black/20 hover:bg-white dark:hover:bg-white/10"
              )}
              onClick={() => setFilter(opt.value)}
            >
              {opt.label}
              {opt.value === "unread" && unreadCount > 0 && (
                <Badge variant="destructive" className="ml-1.5 text-[10px] px-1.5 py-0 h-4 rounded-full">
                  {unreadCount}
                </Badge>
              )}
            </Button>
          ))}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-2xl p-5 animate-pulse">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-48 bg-muted rounded" />
                    <div className="h-3 w-72 bg-muted rounded" />
                    <div className="h-3 w-24 bg-muted rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-2xl shadow-sm">
            <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
              <div className="w-20 h-20 rounded-2xl bg-muted/30 flex items-center justify-center mb-5">
                {filter === "unread" ? (
                  <CheckCheck className="w-10 h-10 text-green-500/40" />
                ) : (
                  <Inbox className="w-10 h-10 text-muted-foreground/30" />
                )}
              </div>
              <h3 className="text-lg font-semibold font-outfit mb-1.5">
                {filter === "unread" ? "All caught up!" : filter !== "all" ? "No matching notifications" : "No notifications yet"}
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                {filter === "unread"
                  ? "You've read all your notifications. Nice work!"
                  : filter !== "all"
                  ? "Try a different filter or check back later."
                  : "When you receive quotes, messages, or job updates, they'll appear here."}
              </p>
              {filter !== "all" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4 rounded-xl"
                  onClick={() => setFilter("all")}
                >
                  Show all notifications
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {groups.map((group) => (
              <div key={group.label}>
                <div className="flex items-center gap-3 mb-3">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{group.label}</h2>
                  <div className="flex-1 h-px bg-border/50" />
                  <span className="text-xs text-muted-foreground">{group.items.length}</span>
                </div>
                <div className="space-y-2">
                  {group.items.map((n: any) => {
                    const style = getNotifStyle(n.type);
                    const Icon = style.icon;
                    return (
                      <div
                        key={n.id}
                        data-testid={`notif-${n.id}`}
                        className={cn(
                          "group bg-white/60 dark:bg-black/40 backdrop-blur-xl border rounded-2xl p-4 md:p-5 transition-all duration-200 hover:shadow-md cursor-default",
                          !n.isRead
                            ? "border-primary/20 dark:border-primary/10 shadow-sm shadow-primary/5"
                            : "border-white/40 dark:border-white/10"
                        )}
                        onClick={() => !n.isRead && markRead.mutate(n.id)}
                      >
                        <div className="flex items-start gap-4">
                          {/* Icon */}
                          <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border border-white/20 dark:border-white/5", style.bg)}>
                            <Icon className={cn("w-5 h-5", style.color)} />
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <p className={cn(
                                  "text-sm leading-snug",
                                  !n.isRead ? "font-semibold text-foreground" : "font-medium text-foreground/80"
                                )}>
                                  {n.title}
                                </p>
                                <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">{n.message}</p>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                {!n.isRead && (
                                  <div className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-3 mt-2">
                              <span className="text-xs text-muted-foreground/70">
                                {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                              </span>
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-normal bg-muted/50">
                                {n.type?.replace(/_/g, " ").toLowerCase()}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
