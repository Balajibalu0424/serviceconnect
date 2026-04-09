import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, MessageSquare, Briefcase, Euro, Clock, Tag, ChevronDown, ChevronUp, Archive } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Link } from "wouter";

const STATUS_VARIANT: Record<string, string> = {
  PENDING: "secondary",
  ACCEPTED: "default",
  REJECTED: "destructive",
  EXPIRED: "outline",
};

export default function ProLeads() {
  const { data: rawData, isLoading } = useQuery<any>({ queryKey: ["/api/quotes"] });
  const [showArchived, setShowArchived] = useState(false);

  // Handle both old array format and new {quotes, archived} format
  const allQuotes: any[] = Array.isArray(rawData) ? rawData : (rawData?.quotes || []);
  const archivedQuotes: any[] = Array.isArray(rawData) ? [] : (rawData?.archived || []);

  const pending = allQuotes.filter(q => q.status === "PENDING");
  const accepted = allQuotes.filter(q => q.status === "ACCEPTED");
  const rejected = allQuotes.filter(q => q.status === "REJECTED");

  const renderQuoteCard = (q: any) => (
    <Card key={q.id} data-testid={`lead-${q.id}`} className="hover:shadow-sm transition-shadow">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5 text-muted-foreground" />
                <p className="font-semibold text-sm">{q.job?.title || "Unknown job"}</p>
              </div>
              {q.job?.referenceCode && (
                <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{q.job.referenceCode}</span>
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
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <Euro className="w-3.5 h-3.5 text-emerald-600" />
                <span className="font-bold text-sm text-emerald-700">{"\u20AC"}{parseFloat(q.amount).toFixed(2)}</span>
              </div>
              {q.estimatedDuration && (
                <span className="text-xs text-muted-foreground">{q.estimatedDuration}</span>
              )}
            </div>
            {q.message && (
              <p className="text-xs text-muted-foreground line-clamp-2 italic">"{q.message}"</p>
            )}
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              {formatDistanceToNow(new Date(q.createdAt), { addSuffix: true })}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <Badge variant={STATUS_VARIANT[q.status] as any} className="text-xs">{q.status}</Badge>
            {q.conversationId && (
              <Link href={`/pro/chat?conversationId=${q.conversationId}`}>
                <Button variant="outline" size="sm" className="text-xs h-7 px-2" data-testid={`btn-chat-${q.id}`}>
                  <MessageSquare className="w-3 h-3 mr-1" /> Chat
                </Button>
              </Link>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <DashboardLayout>
      <div className="p-6 space-y-5">
        <div>
          <h1 className="text-xl font-bold">My Leads</h1>
          <p className="text-sm text-muted-foreground">Quotes you've submitted for jobs</p>
        </div>

        {/* Summary */}
        {allQuotes.length > 0 && (
          <div className="flex gap-4">
            <div className="text-center">
              <p className="text-xl font-bold text-yellow-600">{pending.length}</p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-emerald-600">{accepted.length}</p>
              <p className="text-xs text-muted-foreground">Accepted</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-muted-foreground">{rejected.length}</p>
              <p className="text-xs text-muted-foreground">Rejected</p>
            </div>
            {archivedQuotes.length > 0 && (
              <div className="text-center">
                <p className="text-xl font-bold text-gray-400">{archivedQuotes.length}</p>
                <p className="text-xs text-muted-foreground">Archived</p>
              </div>
            )}
          </div>
        )}

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-28 rounded-lg bg-muted animate-pulse" />)}
          </div>
        ) : allQuotes.length === 0 && archivedQuotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="font-medium">No leads yet</p>
            <p className="text-sm mt-1">Unlock jobs from your matchbooked list to start quoting</p>
            <Link href="/pro/matchbooked">
              <Button variant="outline" size="sm" className="mt-3">View Matchbooked</Button>
            </Link>
          </div>
        ) : (
          <>
            {/* Active quotes */}
            <div className="space-y-3">
              {allQuotes.map(renderQuoteCard)}
            </div>

            {/* Archived quotes (closed/completed jobs) */}
            {archivedQuotes.length > 0 && (
              <div className="space-y-3 pt-4">
                <button
                  onClick={() => setShowArchived(!showArchived)}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Archive className="w-4 h-4" />
                  <span className="font-medium">Archived ({archivedQuotes.length})</span>
                  {showArchived ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {showArchived && (
                  <div className="space-y-3 opacity-70">
                    {archivedQuotes.map(renderQuoteCard)}
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
