import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { MapPin, Clock, Star, Lock, Zap, Users, DollarSign } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

// Unlock Tier Modal
function UnlockModal({ job, onClose }: { job: any; onClose: () => void }) {
  const { toast } = useToast();
  const { user, refreshUser } = useAuth();
  const qc = useQueryClient();

  const unlock = useMutation({
    mutationFn: async (tier: "FREE" | "STANDARD") => {
      const res = await apiRequest("POST", `/api/jobs/${job.id}/unlock`, { tier });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: (data, tier) => {
      qc.invalidateQueries({ queryKey: ["/api/jobs/feed"] });
      refreshUser();
      if (tier === "STANDARD" && data.customerPhone) {
        toast({ title: "Unlocked!", description: `Customer's phone: ${data.customerPhone}` });
      } else {
        toast({ title: "Unlocked!", description: "Chat conversation created." });
      }
      onClose();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" })
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-card rounded-xl max-w-md w-full p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold mb-1">Unlock Lead</h2>
        <p className="text-sm text-muted-foreground mb-6">Choose how you want to access this lead</p>
        <div className="grid grid-cols-2 gap-4">
          <button onClick={() => unlock.mutate("FREE")} disabled={unlock.isPending}
            className="p-4 rounded-xl border-2 border-border hover:border-primary/40 transition-all text-left"
            data-testid="button-unlock-free">
            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center mb-2"><Lock className="w-4 h-4" /></div>
            <p className="font-semibold text-sm">Free Tier</p>
            <p className="text-xs text-muted-foreground mt-0.5">Chat only</p>
            <p className="text-lg font-bold mt-2 text-accent">0 credits</p>
            <p className="text-xs text-muted-foreground mt-1">Contact details hidden</p>
          </button>
          <button onClick={() => unlock.mutate("STANDARD")} disabled={unlock.isPending || (user?.creditBalance || 0) < job.creditCost}
            className={cn("p-4 rounded-xl border-2 transition-all text-left relative overflow-hidden",
              (user?.creditBalance || 0) >= job.creditCost ? "border-primary bg-primary/5 hover:bg-primary/10" : "border-border opacity-50 cursor-not-allowed")}
            data-testid="button-unlock-standard">
            <div className="absolute top-2 right-2"><Badge className="text-xs">Recommended</Badge></div>
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center mb-2"><Zap className="w-4 h-4 text-primary" /></div>
            <p className="font-semibold text-sm">Standard Tier</p>
            <p className="text-xs text-muted-foreground mt-0.5">Chat + Phone</p>
            <p className="text-lg font-bold mt-2 text-primary">{job.creditCost} credits</p>
            <p className="text-xs text-muted-foreground mt-1">Full contact access</p>
          </button>
        </div>
        <Button variant="outline" className="w-full mt-4" onClick={onClose}>Cancel</Button>
      </div>
    </div>
  );
}

export default function ProJobFeed() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [unlockJob, setUnlockJob] = useState<any | null>(null);

  const { data: jobs = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/jobs/feed"] });
  const { data: categories = [] } = useQuery<any[]>({ queryKey: ["/api/categories"] });

  const matchbook = useMutation({
    mutationFn: async (jobId: string) => {
      const res = await apiRequest("POST", `/api/jobs/${jobId}/matchbook`);
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/jobs/feed"] }); toast({ title: "Matchbooked!" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" })
  });

  const filteredJobs = categoryFilter === "all" ? jobs : (jobs as any[]).filter(j => j.category?.id === categoryFilter);

  const URGENCY_COLORS: Record<string, string> = { LOW: "secondary", NORMAL: "outline", HIGH: "default", URGENT: "destructive" };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Job Feed</h1>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-40"><SelectValue placeholder="All categories" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {(categories as any[]).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />)}</div>
        ) : filteredJobs.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">No jobs available</div>
        ) : (
          <div className="space-y-3">
            {(filteredJobs as any[]).map((job: any) => (
              <Card key={job.id} className={cn("job-card transition-all", job.isBoosted && "border-primary/40 ring-1 ring-primary/20")} data-testid={`feed-job-${job.id}`}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {job.isBoosted && <Badge className="text-xs bg-amber-500">Boosted</Badge>}
                        <Badge variant={URGENCY_COLORS[job.urgency] as any} className="text-xs">{job.urgency}</Badge>
                        <Badge variant="outline" className="text-xs">{job.category?.name}</Badge>
                      </div>
                      <h3 className="font-semibold">{job.title}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{job.description}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground mb-3">
                    {job.locationText && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{job.locationText}</span>}
                    {job.budgetMin && <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />€{job.budgetMin}–€{job.budgetMax}</span>}
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}</span>
                    <span className="flex items-center gap-1"><Users className="w-3 h-3" />{String(job.matchbookCount || 0)} interested</span>
                  </div>
                  <div className="flex gap-2">
                    {job.unlock ? (
                      <Badge variant="outline" className="gap-1"><Lock className="w-3 h-3" /> Unlocked ({job.unlock.tier})</Badge>
                    ) : job.isMatchbooked ? (
                      <Button size="sm" className="gap-1" onClick={() => setUnlockJob(job)} data-testid={`button-unlock-${job.id}`}>
                        <Lock className="w-3 h-3" /> Unlock ({job.creditCost}cr)
                      </Button>
                    ) : (
                      <>
                        <Button size="sm" variant="outline" className="gap-1" onClick={() => matchbook.mutate(job.id)} disabled={matchbook.isPending} data-testid={`button-matchbook-${job.id}`}>
                          <Star className="w-3 h-3" /> Matchbook
                        </Button>
                        <Button size="sm" variant="ghost" className="text-muted-foreground">Skip</Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
      {unlockJob && <UnlockModal job={unlockJob} onClose={() => setUnlockJob(null)} />}
    </DashboardLayout>
  );
}
