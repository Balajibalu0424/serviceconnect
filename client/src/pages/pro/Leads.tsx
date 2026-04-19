import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusPill } from "@/components/ui/status-pill";
import { ListSkeleton } from "@/components/ui/loading-skeleton";
import { Users, MessageSquare, Briefcase, Euro, Clock, Tag, ChevronDown, ChevronUp, Archive, Hash, MapPin, Target } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { buildConversationPath } from "@shared/chatRoutes";

export default function ProLeads() {
  const { data: rawData, isLoading } = useQuery<any>({ queryKey: ["/api/quotes"] });
  const [showArchived, setShowArchived] = useState(false);

  const allQuotes: any[] = Array.isArray(rawData) ? rawData : (rawData?.quotes || []);
  const archivedQuotes: any[] = Array.isArray(rawData) ? [] : (rawData?.archived || []);

  const pending = allQuotes.filter(q => q.status === "PENDING");
  const accepted = allQuotes.filter(q => q.status === "ACCEPTED");
  const rejected = allQuotes.filter(q => q.status === "REJECTED");

  const renderQuoteCard = (q: any, archived = false) => {
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
              <StatusPill status={q.status} />

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

  const winRate = accepted.length + rejected.length > 0
    ? Math.round((accepted.length / (accepted.length + rejected.length)) * 100)
    : null;
  const totalWinValue = accepted.reduce((sum, q) => sum + Number(q.amount || 0), 0);

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-[1200px] mx-auto">
        <PageHeader
          eyebrow="Professional"
          title="My leads"
          description="Every quote you've submitted, grouped by status. Track what's pending, what you won and your win rate at a glance."
          icon={<Target className="w-5 h-5" />}
        />

        {/* Summary */}
        {allQuotes.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-2xl p-4 shadow-sm">
            <div className="text-center md:border-r md:border-border/40">
              <p className="text-2xl font-bold font-outfit text-amber-600 dark:text-amber-400">{pending.length}</p>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mt-0.5">Pending</p>
            </div>
            <div className="text-center md:border-r md:border-border/40">
              <p className="text-2xl font-bold font-outfit text-emerald-600 dark:text-emerald-400">{accepted.length}</p>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mt-0.5">Accepted</p>
            </div>
            <div className="text-center md:border-r md:border-border/40">
              <p className="text-2xl font-bold font-outfit text-muted-foreground">{rejected.length}</p>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mt-0.5">Rejected</p>
            </div>
            <div className="text-center md:border-r md:border-border/40">
              <p className="text-2xl font-bold font-outfit text-foreground">
                €{totalWinValue.toLocaleString("en-IE", { maximumFractionDigits: 0 })}
              </p>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mt-0.5">Won value</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold font-outfit text-primary">
                {winRate !== null ? `${winRate}%` : "—"}
              </p>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mt-0.5">Win rate</p>
            </div>
          </div>
        )}

        {isLoading ? (
          <ListSkeleton rows={3} />
        ) : allQuotes.length === 0 && archivedQuotes.length === 0 ? (
          <EmptyState
            icon={<Users className="w-7 h-7" />}
            title="No quotes submitted yet"
            description="Unlock jobs from your matchbooked list to start quoting customers. Quotes you send appear here with full status tracking."
            primaryAction={
              <Link href="/pro/feed">
                <Button className="rounded-xl shadow-md shadow-primary/20">Browse job feed</Button>
              </Link>
            }
            secondaryAction={
              <Link href="/pro/matchbooked">
                <Button variant="ghost" className="rounded-xl">View matchbooked</Button>
              </Link>
            }
          />
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
