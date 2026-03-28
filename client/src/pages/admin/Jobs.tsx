import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Briefcase, Flame, ShieldAlert } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "secondary", LIVE: "default", IN_DISCUSSION: "secondary",
  AFTERCARE_2D: "destructive", AFTERCARE_5D: "destructive", BOOSTED: "default",
  COMPLETED: "outline", CLOSED: "secondary"
};

const ALL_STATUSES = ["DRAFT", "LIVE", "BOOSTED", "IN_DISCUSSION", "AFTERCARE_2D", "AFTERCARE_5D", "COMPLETED", "CLOSED"];

export default function AdminJobs() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");

  const params = new URLSearchParams();
  if (statusFilter !== "all") params.set("status", statusFilter);

  const { data } = useQuery<any>({ queryKey: [`/api/admin/jobs?${params}`] });
  const jobs = data?.jobs || [];

  const publishJob = useMutation({
    mutationFn: async (jobId: string) => {
      const res = await apiRequest("POST", `/api/jobs/${jobId}/publish`, {});
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string)?.startsWith("/api/admin/jobs") }); toast({ title: "Job published" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const closeJob = useMutation({
    mutationFn: async (jobId: string) => {
      const res = await apiRequest("DELETE", `/api/jobs/${jobId}`, {});
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string)?.startsWith("/api/admin/jobs") }); toast({ title: "Job closed" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <DashboardLayout>
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Jobs <span className="text-muted-foreground font-normal text-base">({data?.total || 0})</span></h1>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44"><SelectValue placeholder="All statuses" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {ALL_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          {jobs.map((job: any) => (
            <Card key={job.id} data-testid={`admin-job-${job.id}`}>
              <CardContent className="pt-3 pb-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-sm truncate">{job.title}</p>
                      <Badge variant={STATUS_COLORS[job.status] as any} className="text-xs shrink-0">{job.status}</Badge>
                      {job.isBoosted && <Badge className="text-xs bg-amber-500 shrink-0">Boosted</Badge>}
                      {job.aiIsUrgent && <Badge className="text-xs bg-red-600 text-white shrink-0 gap-1"><Flame className="w-2.5 h-2.5" />Urgent</Badge>}
                      {job.aiIsFakeFlag && <Badge className="text-xs bg-orange-600 text-white shrink-0 gap-1"><ShieldAlert className="w-2.5 h-2.5" />Flagged</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {job.locationText && `${job.locationText} · `}
                      {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })} · {job.creditCost} credits
                      {job.aiQualityScore != null && ` · AI quality: ${job.aiQualityScore}/100`}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {job.status === "DRAFT" && (
                      <Button size="sm" variant="outline" onClick={() => publishJob.mutate(job.id)} disabled={publishJob.isPending} data-testid={`button-publish-${job.id}`}>
                        Publish
                      </Button>
                    )}
                    {job.status !== "CLOSED" && job.status !== "COMPLETED" && (
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => closeJob.mutate(job.id)} disabled={closeJob.isPending} data-testid={`button-close-${job.id}`}>
                        Close
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {jobs.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Briefcase className="w-8 h-8 mx-auto mb-2 opacity-20" />
              <p>No jobs found</p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
