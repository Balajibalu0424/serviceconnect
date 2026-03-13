import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Clock, DollarSign } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function JobDetail() {
  const [, params] = useRoute("/jobs/:id");
  const { data: job, isLoading } = useQuery<any>({ queryKey: [`/api/jobs/${params?.id}`] });
  const { data: quotes = [] } = useQuery<any[]>({ queryKey: ["/api/quotes"] });

  if (isLoading) return <DashboardLayout><div className="p-6 text-muted-foreground">Loading...</div></DashboardLayout>;
  if (!job) return <DashboardLayout><div className="p-6">Job not found</div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-3xl">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-xl font-bold">{job.title}</h1>
            <Badge>{job.status}</Badge>
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            {job.locationText && <span className="flex items-center gap-1"><MapPin className="w-4 h-4" />{job.locationText}</span>}
            {job.budgetMin && <span className="flex items-center gap-1"><DollarSign className="w-4 h-4" />€{job.budgetMin} — €{job.budgetMax}</span>}
            <span className="flex items-center gap-1"><Clock className="w-4 h-4" />{formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}</span>
          </div>
        </div>
        <Card>
          <CardHeader><CardTitle className="text-sm">Description</CardTitle></CardHeader>
          <CardContent><p className="text-sm">{job.description}</p></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Quotes ({(quotes as any[]).filter((q: any) => q.jobId === params?.id).length})</CardTitle></CardHeader>
          <CardContent>
            {(quotes as any[]).filter((q: any) => q.jobId === params?.id).length === 0 ? (
              <p className="text-sm text-muted-foreground">No quotes received yet</p>
            ) : (
              <div className="space-y-3">
                {(quotes as any[]).filter((q: any) => q.jobId === params?.id).map((q: any) => (
                  <div key={q.id} className="p-3 rounded-lg border">
                    <div className="flex justify-between items-start">
                      <p className="font-medium">€{q.amount}</p>
                      <Badge>{q.status}</Badge>
                    </div>
                    {q.message && <p className="text-sm text-muted-foreground mt-1">{q.message}</p>}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
