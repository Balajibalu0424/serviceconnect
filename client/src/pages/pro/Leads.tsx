import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, MessageSquare, Briefcase, Euro, Clock, Tag, ChevronDown, ChevronUp, Archive, Hash, CheckCircle2, XCircle, AlertCircle, MapPin } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { buildConversationPath } from "@shared/chatRoutes";

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  PENDING: { label: "Pending", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
  ACCEPTED: { label: "Accepted", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
  REJECTED: { label: "Rejected", color: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
  EXPIRED: { label: "Expired", color: "bg-muted text-muted-foreground" },
  WITHDRAWN: { label: "Withdrawn", color: "bg-muted text-muted-foreground" },
};

const STATUS_ICON: Record<string, any> = {
  PENDING: AlertCircle,
  ACCEPTED: CheckCircle2,
  REJECTED: XCircle,
  EXPIRED: Clock,
};

export default function ProLeads() {
  const { data: rawData, isLoading } = useQuery<any>({ queryKey: ["/api/quotes"] });
  const [showArchived, setShowArchived] = useState(false);

  const allQuotes: any[] = Array.isArray(rawData) ? rawData : (rawData?.quotes || []);
  const archivedQuotes: any[] = Array.isArray(rawData) ? [] : (rawData?.archived || []);

  const pending = allQuotes.filter(q => q.status === "PENDING");
  const accepted = allQuotes.filter(q => q.status === "ACCEPTED");
  const rejected = allQuotes.filter(q => q.status === "REJECTED");

  const renderQuoteCard = (q: any, archived = false) => {
    const StatusIcon = STATUS_ICON[q.status] || AlertCircle;
    const statusConf = STATUS_CONFIG[q.status] || { label: q.status, color: "bg-muted text-muted-foreground" };

    return (
      <Card
        key={q.id}
        data-testid={`lead-${q.id}`}
        className={cn(
          "transition-all duration-200 hover:shadow-sm bg-white/60 dark:bg-black/40 backdrop-blur-xl border-white/40 dark:border-white/10 rounded-2xl overflow-hidden",
          archived && "opacity-70"
        )}
      >
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0 space-y-2">
              {/* Job title + badges */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-muted-foreground" />
                  <p className="font-semibold text-sm">{q.job?.title || "Unknown job"}</p>
                </div>
                {q.job?.referenceCode && (
                  <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground flex items-center gap-0.5">
                    <Hash className="w-2.5 h-2.5" />{q.job.referenceCode}
                  </span>
                )}
                {q.category?.name && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Tag className="w-3 h-3" />
                    {q.category.name}
                  </div>
                )}
                {q.job?.status && (
                  <Badge variant="outline" className="text-xs px-1.5 py-0">Job: {q.job.status}</Badge>
                )}
              </div>
              {q.status === "PENDING" && q.job?.description && (
                <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5 pl-5">{q.job.description}</p>
              )}

              {/* Amount */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1">
                  <Euro className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="font-bold text-sm text-emerald-700 dark:text-emerald-400">€{parseFloat(q.amount).toFixed(2)}</span>
                </div>
                {q.estimatedDuration && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" />{q.estimatedDuration}
                  </span>
                )}
              </div>
              {q.job?.locationText && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="w-3 h-3" />
                  {q.job.locationText}
                  {q.job?.locationEircode && <span className="font-mono bg-muted px-1 rounded ml-1">{q.job.locationEircode}</span>}
                </div>
              )}

              {q.message && (
                <p className="text-xs text-muted-foreground line-clamp-2 italic">"{q.message}"</p>
              )}

              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                {formatDistanceToNow(new Date(q.createdAt), { addSuffix: true })}
              </div>
            </div>

            {/* Right side: status + chat */}
            <div className="flex flex-col items-end gap-2 flex-shrink-0">
              <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1", statusConf.color)}>
                <StatusIcon className="w-3 h-3" />
                {statusConf.label}
              </span>

              {q.conversationId && (
                <Link href={buildConversationPath(true, q.conversationId)}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-7 px-2.5 rounded-xl gap-1"
                    data-testid={`btn-chat-${q.id}`}
                  >
                    <MessageSquare className="w-3 h-3" /> Chat
                  </Button>
                </Link>
              )}

              {q.status === "ACCEPTED" && (
                <Link href="/pro/bookings">
                  <Button variant="outline" size="sm" className="text-xs h-7 px-2.5 rounded-xl gap-1 border-emerald-200 text-emerald-700 hover:bg-emerald-50">
                    View Booking
                  </Button>
                </Link>
              )}
              {q.status === "PENDING" && q.job?.status && ["LIVE", "IN_DISCUSSION", "BOOSTED"].includes(q.job.status) && (
                <Link href="/pro/feed">
                  <Button variant="ghost" size="sm" className="text-xs h-7 px-2.5 rounded-xl gap-1 text-muted-foreground hover:text-foreground">
                    <Briefcase className="w-3 h-3" /> View Feed
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-5">
        <div>
          <h1 className="text-3xl font-heading font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300">My Leads</h1>
          <p className="text-sm text-muted-foreground mt-1">Quotes you've submitted for jobs</p>
        </div>

        {/* Summary */}
        {allQuotes.length > 0 && (
          <div className="flex gap-5 bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-2xl p-4 w-fit">
            <div className="text-center">
              <p className="text-xl font-bold text-amber-600">{pending.length}</p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </div>
            <div className="w-px bg-border" />
            <div className="text-center">
              <p className="text-xl font-bold text-emerald-600">{accepted.length}</p>
              <p className="text-xs text-muted-foreground">Accepted</p>
            </div>
            <div className="w-px bg-border" />
            <div className="text-center">
              <p className="text-xl font-bold text-muted-foreground">{rejected.length}</p>
              <p className="text-xs text-muted-foreground">Rejected</p>
            </div>
            {archivedQuotes.length > 0 && (
              <>
                <div className="w-px bg-border" />
                <div className="text-center">
                  <p className="text-xl font-bold text-gray-400">{archivedQuotes.length}</p>
                  <p className="text-xs text-muted-foreground">Archived</p>
                </div>
              </>
            )}
            {accepted.length + rejected.length > 0 && (
              <>
                <div className="w-px bg-border" />
                <div className="text-center">
                  <p className="text-xl font-bold text-primary">
                    {Math.round((accepted.length / (accepted.length + rejected.length)) * 100)}%
                  </p>
                  <p className="text-xs text-muted-foreground">Win rate</p>
                </div>
              </>
            )}
          </div>
        )}

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-28 rounded-2xl bg-muted animate-pulse" />)}
          </div>
        ) : allQuotes.length === 0 && archivedQuotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground bg-white/40 dark:bg-black/20 backdrop-blur-md rounded-3xl border border-white/20 dark:border-white/5">
            <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 opacity-40" />
            </div>
            <p className="font-heading font-medium text-lg text-foreground">No active leads</p>
            <p className="text-sm mt-1 max-w-xs mx-auto">Unlock jobs from your matchbooked list to start quoting customers</p>
            <div className="flex flex-col sm:flex-row gap-2 mt-6">
              <Link href="/pro/matchbooked">
                <Button variant="outline" size="sm" className="gap-1.5 rounded-xl">View Matchbooked</Button>
              </Link>
              <Link href="/pro/feed">
                <Button variant="default" size="sm" className="gap-1.5 rounded-xl">Browse Job Feed</Button>
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* Active quotes — pending first, then accepted, then rejected */}
            <div className="space-y-3">
              {pending.length > 0 && (
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">Pending ({pending.length})</p>
              )}
              {pending.map(q => renderQuoteCard(q))}

              {accepted.length > 0 && (
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1 pt-2">Accepted ({accepted.length})</p>
              )}
              {accepted.map(q => renderQuoteCard(q))}

              {rejected.length > 0 && (
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1 pt-2">
                  Rejected ({rejected.length})
                </p>
              )}
              {rejected.map(q => renderQuoteCard(q))}
            </div>

            {/* Archived quotes */}
            {archivedQuotes.length > 0 && (
              <div className="space-y-3 pt-2">
                <button
                  onClick={() => setShowArchived(!showArchived)}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Archive className="w-4 h-4" />
                  <span className="font-medium">Archived ({archivedQuotes.length})</span>
                  {showArchived ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {showArchived && (
                  <div className="space-y-3">
                    {archivedQuotes.map(q => renderQuoteCard(q, true))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
