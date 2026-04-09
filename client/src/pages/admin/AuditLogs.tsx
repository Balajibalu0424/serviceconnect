import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ListChecks, Search, ChevronLeft, ChevronRight, Globe, User,
  Shield, Clock, Inbox, FileText, Settings, Trash2, CreditCard, Eye
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

const ACTION_ICONS: Record<string, { icon: any; color: string; bg: string }> = {
  LOGIN: { icon: User, color: "text-blue-600", bg: "bg-blue-500/10" },
  LOGOUT: { icon: User, color: "text-slate-600", bg: "bg-slate-500/10" },
  CREATE: { icon: FileText, color: "text-green-600", bg: "bg-green-500/10" },
  UPDATE: { icon: Settings, color: "text-amber-600", bg: "bg-amber-500/10" },
  DELETE: { icon: Trash2, color: "text-red-600", bg: "bg-red-500/10" },
  PAYMENT: { icon: CreditCard, color: "text-emerald-600", bg: "bg-emerald-500/10" },
  VIEW: { icon: Eye, color: "text-indigo-600", bg: "bg-indigo-500/10" },
  ADMIN: { icon: Shield, color: "text-violet-600", bg: "bg-violet-500/10" },
};

function getActionStyle(action: string) {
  const key = Object.keys(ACTION_ICONS).find(k => action?.toUpperCase().includes(k));
  return ACTION_ICONS[key || ""] || { icon: ListChecks, color: "text-muted-foreground", bg: "bg-muted/50" };
}

const PAGE_SIZE = 25;

export default function AdminAuditLogs() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const { data: logs = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/admin/audit-logs"] });

  const filtered = (logs as any[]).filter((log: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      log.action?.toLowerCase().includes(q) ||
      log.resourceType?.toLowerCase().includes(q) ||
      log.ipAddress?.toLowerCase().includes(q)
    );
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <DashboardLayout>
      <div className="p-4 md:p-8 space-y-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-outfit flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-violet-600 dark:text-violet-400" />
            </div>
            Audit Logs
            <Badge variant="secondary" className="text-xs px-2.5 py-0.5 rounded-full font-mono">
              {(logs as any[]).length}
            </Badge>
          </h1>
          <p className="text-sm text-muted-foreground">Track all admin actions and platform events</p>
        </div>

        {/* Search */}
        <div className="bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-2xl p-4 shadow-sm">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by action, resource type, or IP..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-9 rounded-xl border-border/60 focus:border-primary focus:ring-primary/20"
            />
          </div>
        </div>

        {/* Logs */}
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-2xl p-4 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-muted" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-4 w-40 bg-muted rounded" />
                    <div className="h-3 w-56 bg-muted rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : paginated.length === 0 ? (
          <div className="bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-2xl shadow-sm">
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-2xl bg-muted/30 flex items-center justify-center mb-4">
                <Inbox className="w-8 h-8 text-muted-foreground/30" />
              </div>
              <h3 className="text-lg font-semibold font-outfit mb-1">No audit logs</h3>
              <p className="text-sm text-muted-foreground">
                {search ? "No logs match your search." : "No admin actions have been recorded yet."}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            {paginated.map((log: any) => {
              const style = getActionStyle(log.action);
              const Icon = style.icon;
              return (
                <div
                  key={log.id}
                  className="bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-xl p-4 hover:shadow-sm transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0", style.bg)}>
                      <Icon className={cn("w-4 h-4", style.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm font-semibold">{log.action}</span>
                        <span className="text-muted-foreground text-xs">on</span>
                        <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 h-4 rounded">
                          {log.resourceType}
                        </Badge>
                        {log.resourceId && (
                          <span className="text-[10px] text-muted-foreground/60 font-mono truncate max-w-[120px]">
                            {log.resourceId}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Globe className="w-3 h-3" /> {log.ipAddress || "Unknown"}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                        </span>
                        {log.userId && (
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" /> {log.userId.substring(0, 8)}...
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-muted-foreground">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-1 rounded-xl" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="w-4 h-4" /> Prev
              </Button>
              <span className="text-sm font-medium px-2">{page} / {totalPages}</span>
              <Button variant="outline" size="sm" className="gap-1 rounded-xl" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                Next <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
