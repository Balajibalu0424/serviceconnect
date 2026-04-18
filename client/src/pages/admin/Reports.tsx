import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Flag, Loader2, Inbox } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface UserReport {
  id: string;
  reporterId: string;
  targetType: "MESSAGE" | "USER" | "REVIEW" | "JOB";
  targetId: string;
  targetUserId: string | null;
  reason: string;
  details: string | null;
  status: "OPEN" | "REVIEWING" | "ACTIONED" | "DISMISSED";
  reviewNote: string | null;
  createdAt: string;
}

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: "OPEN", label: "Open" },
  { value: "REVIEWING", label: "Reviewing" },
  { value: "ACTIONED", label: "Actioned" },
  { value: "DISMISSED", label: "Dismissed" },
  { value: "ALL", label: "All" },
];

export default function AdminReports() {
  const [filter, setFilter] = useState<string>("OPEN");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: reports = [], isLoading } = useQuery<UserReport[]>({
    queryKey: ["/api/admin/reports", filter],
    queryFn: async () => {
      const q = filter === "ALL" ? "" : `?status=${filter}`;
      const res = await apiRequest("GET", `/api/admin/reports${q}`);
      if (!res.ok) throw new Error("Failed to load reports");
      return res.json();
    },
  });

  const updateReport = useMutation({
    mutationFn: async ({ id, status, reviewNote }: { id: string; status: string; reviewNote?: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/reports/${id}`, { status, reviewNote });
      if (!res.ok) throw new Error("Unable to update report");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/reports"] });
      toast({ title: "Report updated" });
    },
    onError: (err) => toast({ title: "Update failed", description: err instanceof Error ? err.message : "", variant: "destructive" }),
  });

  return (
    <DashboardLayout>
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Flag className="w-5 h-5 text-destructive" /> Trust &amp; Safety Reports
            </h1>
            <p className="text-sm text-muted-foreground">User-submitted reports for messages, reviews, users and jobs.</p>
          </div>
          <div className="flex gap-2">
            {STATUS_FILTERS.map((s) => (
              <Button
                key={s.value}
                size="sm"
                variant={filter === s.value ? "default" : "outline"}
                onClick={() => setFilter(s.value)}
              >
                {s.label}
              </Button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : reports.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              <Inbox className="mx-auto w-8 h-8 mb-3 opacity-70" />
              No reports in this view.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {reports.map((r) => (
              <Card key={r.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Badge variant="outline" className="uppercase">{r.targetType}</Badge>
                        <span className="text-muted-foreground font-normal">#{r.targetId.slice(0, 8)}</span>
                      </CardTitle>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>Reason: <span className="font-semibold text-foreground">{r.reason}</span></span>
                        <span>•</span>
                        <span>{formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })}</span>
                      </div>
                    </div>
                    <Badge
                      className={
                        r.status === "OPEN" ? "bg-red-100 text-red-700" :
                        r.status === "REVIEWING" ? "bg-amber-100 text-amber-700" :
                        r.status === "ACTIONED" ? "bg-emerald-100 text-emerald-700" :
                        "bg-muted text-muted-foreground"
                      }
                    >
                      {r.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {r.details && <p className="text-sm">{r.details}</p>}
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    <p>Reporter: <code>{r.reporterId}</code></p>
                    {r.targetUserId && <p>Target user: <code>{r.targetUserId}</code></p>}
                    {r.reviewNote && <p className="text-foreground">Review note: {r.reviewNote}</p>}
                  </div>
                  {r.status !== "ACTIONED" && r.status !== "DISMISSED" && (
                    <div className="space-y-2">
                      <Textarea
                        rows={2}
                        placeholder="Optional review note…"
                        value={notes[r.id] ?? ""}
                        onChange={(e) => setNotes((prev) => ({ ...prev, [r.id]: e.target.value }))}
                      />
                      <div className="flex gap-2">
                        {r.status === "OPEN" && (
                          <Button size="sm" variant="outline"
                            onClick={() => updateReport.mutate({ id: r.id, status: "REVIEWING", reviewNote: notes[r.id] })}
                          >
                            Start review
                          </Button>
                        )}
                        <Button size="sm" variant="default"
                          onClick={() => updateReport.mutate({ id: r.id, status: "ACTIONED", reviewNote: notes[r.id] })}
                        >
                          Mark actioned
                        </Button>
                        <Button size="sm" variant="ghost"
                          onClick={() => updateReport.mutate({ id: r.id, status: "DISMISSED", reviewNote: notes[r.id] })}
                        >
                          Dismiss
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
