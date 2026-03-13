import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Briefcase, PlusCircle, MapPin, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "secondary", LIVE: "default", IN_DISCUSSION: "secondary",
  AFTERCARE_2D: "destructive", AFTERCARE_5D: "destructive", BOOSTED: "default",
  COMPLETED: "outline", CLOSED: "secondary"
};

export default function MyJobs() {
  const { data: jobs = [] } = useQuery<any[]>({ queryKey: ["/api/jobs"] });

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">My Jobs</h1>
            <p className="text-sm text-muted-foreground">{(jobs as any[]).length} total jobs</p>
          </div>
          <Link href="/post-job"><Button size="sm" className="gap-1"><PlusCircle className="w-4 h-4" /> Post Job</Button></Link>
        </div>

        {(jobs as any[]).length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Briefcase className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>You haven't posted any jobs yet</p>
            <Link href="/post-job"><Button className="mt-4">Post your first job</Button></Link>
          </div>
        ) : (
          <div className="space-y-3">
            {(jobs as any[]).map((job: any) => (
              <Link key={job.id} href={`/jobs/${job.id}`}>
                <Card className="cursor-pointer hover:shadow-sm transition-all job-card" data-testid={`job-${job.id}`}>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium truncate">{job.title}</h3>
                          <Badge variant={STATUS_COLORS[job.status] as any} className="shrink-0 text-xs">{job.status.replace("_", " ")}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">{job.description}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          {job.locationText && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{job.locationText}</span>}
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}</span>
                          {job.budgetMin && <span>€{job.budgetMin} — €{job.budgetMax}</span>}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
