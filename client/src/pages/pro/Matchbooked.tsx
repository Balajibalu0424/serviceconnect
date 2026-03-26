import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Star, MapPin, Lock, Zap, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

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
      qc.invalidateQueries({ queryKey: ["/api/jobs/matchbooked"] });
      qc.invalidateQueries({ queryKey: ["/api/jobs/feed"] });
      refreshUser();
      if (tier === "STANDARD" && data.customerPhone) {
        toast({ title: "Unlocked!", description: `Customer's phone: ${data.customerPhone}` });
      } else {
        toast({ title: "Unlocked!", description: "Chat conversation ready." });
      }
      onClose();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-card rounded-xl max-w-md w-full p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold mb-1">Unlock Lead</h2>
        <p className="text-sm text-muted-foreground mb-2">{job.title}</p>
        <p className="text-sm text-muted-foreground mb-6">Choose your access level</p>
        <div className="grid grid-cols-2 gap-4">
          <button onClick={() => unlock.mutate("FREE")} disabled={unlock.isPending}
            className="p-4 rounded-xl border-2 border-border hover:border-primary/40 transition-all text-left"
            data-testid="button-unlock-free">
            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center mb-2">
              <Lock className="w-4 h-4" />
            </div>
            <p className="font-semibold text-sm">Free</p>
            <p className="text-xs text-muted-foreground mt-0.5">Chat only</p>
            <p className="text-xl font-bold mt-2 text-accent">0 cr</p>
            <p className="text-xs text-muted-foreground mt-1">Contact masked</p>
          </button>
          <button
            onClick={() => unlock.mutate("STANDARD")}
            disabled={unlock.isPending || (user?.creditBalance || 0) < job.creditCost}
            className={cn(
              "p-4 rounded-xl border-2 transition-all text-left relative overflow-hidden",
              (user?.creditBalance || 0) >= job.creditCost
                ? "border-primary bg-primary/5 hover:bg-primary/10"
                : "border-border opacity-50 cursor-not-allowed"
            )}
            data-testid="button-unlock-standard">
            <div className="absolute top-2 right-2">
              <Badge className="text-xs">Best</Badge>
            </div>
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
              <Zap className="w-4 h-4 text-primary" />
            </div>
            <p className="font-semibold text-sm">Standard</p>
            <p className="text-xs text-muted-foreground mt-0.5">Chat + Phone</p>
            <p className="text-xl font-bold mt-2 text-primary">{job.creditCost} cr</p>
            <p className="text-xs text-muted-foreground mt-1">Full contact</p>
          </button>
        </div>
        {(user?.creditBalance || 0) < job.creditCost && (
          <p className="text-xs text-destructive mt-3 text-center">
            You need {job.creditCost - (user?.creditBalance || 0)} more credits for Standard unlock.
          </p>
        )}
        <Button variant="outline" className="w-full mt-4" onClick={onClose}>Cancel</Button>
      </div>
    </div>
  );
}

export default function ProMatchbooked() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [unlockJob, setUnlockJob] = useState<any | null>(null);

  const { data: matchbooked = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/jobs/matchbooked"],
  });

  const unmatchbook = useMutation({
    mutationFn: async (jobId: string) => {
      const res = await apiRequest("DELETE", `/api/jobs/${jobId}/matchbook`);
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/jobs/matchbooked"] });
      toast({ title: "Removed from matchbook" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <DashboardLayout>
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Matchbooked</h1>
            <p className="text-sm text-muted-foreground">{(matchbooked as any[]).length} jobs saved</p>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-28 rounded-lg bg-muted animate-pulse" />)}
          </div>
        ) : (matchbooked as any[]).length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Star className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="font-medium">Nothing saved yet</p>
            <p className="text-sm mt-1">Matchbook jobs from the feed to save them here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {(matchbooked as any[]).map((row: any) => {
              const job = row.job || row;
              const mb = row.mb || {};
              const cat = row.cat || {};
              const isUnlocked = !!row.unlock;

              return (
                <Card key={mb.id || job.id} data-testid={`matchbook-${mb.id}`}
                  className={cn("transition-all", isUnlocked && "border-green-500/40")}>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          {cat.name && <Badge variant="outline" className="text-xs">{cat.name}</Badge>}
                          <Badge className="text-xs">{job.status}</Badge>
                          {job.isBoosted && <Badge className="text-xs bg-amber-500">Boosted</Badge>}
                          {isUnlocked && <Badge className="text-xs bg-green-600">Unlocked ({row.unlock?.tier})</Badge>}
                        </div>
                        <h3 className="font-semibold text-sm">{job.title}</h3>
                        <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{job.description}</p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                          {job.locationText && (
                            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{job.locationText}</span>
                          )}
                          {mb.matchbookedAt && (
                            <span>Saved {formatDistanceToNow(new Date(mb.matchbookedAt), { addSuffix: true })}</span>
                          )}
                          {job.budgetMin && <span>€{job.budgetMin}–€{job.budgetMax}</span>}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        <p className="text-xs text-muted-foreground">Unlock cost</p>
                        <p className="font-bold text-primary">{job.creditCost} cr</p>
                      </div>
                    </div>

                    <div className="flex gap-2 mt-3 flex-wrap">
                      {!isUnlocked && (
                        <Button size="sm" className="gap-1"
                          onClick={() => setUnlockJob(job)}
                          data-testid={`button-unlock-${job.id}`}>
                          <Lock className="w-3 h-3" /> Unlock
                        </Button>
                      )}
                      {isUnlocked && row.unlock?.conversationId && (
                        <Button size="sm" variant="outline" asChild>
                          <a href={`/#/pro/chat`}>Open chat</a>
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="text-muted-foreground"
                        onClick={() => unmatchbook.mutate(job.id)} disabled={unmatchbook.isPending}>
                        {unmatchbook.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Remove"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
      {unlockJob && <UnlockModal job={unlockJob} onClose={() => setUnlockJob(null)} />}
    </DashboardLayout>
  );
}
