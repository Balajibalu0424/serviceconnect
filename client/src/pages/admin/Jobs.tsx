import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Briefcase } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const STATUS_COLORS: Record<string, string> = { DRAFT: "secondary", LIVE: "default", IN_DISCUSSION: "secondary", AFTERCARE_2D: "destructive", AFTERCARE_5D: "destructive", BOOSTED: "default", COMPLETED: "outline", CLOSED: "secondary" };

export default function AdminJobs() {
  const { data } = useQuery<any>({ queryKey: ["/api/admin/jobs"] });
  const jobs = data?.jobs || [];

  return (
    <DashboardLayout>
      <div className="p-6 space-y-4">
        <h1 className="text-xl font-bold">Jobs <span className="text-muted-foreground font-normal text-base">({data?.total || 0})</span></h1>
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
                    </div>
                    <p className="text-xs text-muted-foreground">{job.locationText} · {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })} · {job.creditCost} credits</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {jobs.length === 0 && <div className="text-center py-12 text-muted-foreground"><Briefcase className="w-8 h-8 mx-auto mb-2 opacity-20" /><p>No jobs found</p></div>}
        </div>
      </div>
    </DashboardLayout>
  );
}
