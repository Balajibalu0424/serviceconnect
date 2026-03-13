import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, MapPin } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function ProMatchbooked() {
  const { data: matchbooked = [] } = useQuery<any[]>({ queryKey: ["/api/jobs/matchbooked"] });

  return (
    <DashboardLayout>
      <div className="p-6 space-y-4">
        <div>
          <h1 className="text-xl font-bold">Matchbooked Jobs</h1>
          <p className="text-sm text-muted-foreground">{(matchbooked as any[]).length} jobs saved</p>
        </div>
        {(matchbooked as any[]).length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Star className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>No matchbooked jobs yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {(matchbooked as any[]).map((row: any) => (
              <Card key={row.mb?.id} data-testid={`matchbook-${row.mb?.id}`}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs">{row.cat?.name}</Badge>
                        <Badge className="text-xs">{row.job?.status}</Badge>
                      </div>
                      <h3 className="font-medium">{row.job?.title}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{row.job?.description}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        {row.job?.locationText && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{row.job.locationText}</span>}
                        <span>{formatDistanceToNow(new Date(row.mb?.matchbookedAt), { addSuffix: true })}</span>
                        {row.job?.budgetMin && <span>€{row.job.budgetMin}–€{row.job.budgetMax}</span>}
                      </div>
                    </div>
                    <div className="text-right text-xs">
                      <p className="text-muted-foreground">Unlock cost</p>
                      <p className="font-bold text-primary">{row.job?.creditCost} credits</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
